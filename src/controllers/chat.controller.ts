import "server-only";
import { notFound } from "next/navigation";
import { RULES } from "@/config/app";
import { getActivity, getSpot } from "@/config/campus";
import { yearLabel } from "@/config/profile";
import { sendPush } from "@/lib/push";
import { localListenerCount, publish } from "@/lib/realtime";
import { rateLimit } from "@/lib/rate-limit";
import { formatClock, formatDay } from "@/lib/time";
import { BlockModel } from "@/models/block.model";
import { ChatModel, type InboxEntry } from "@/models/chat.model";
import { ConnectionModel } from "@/models/connection.model";
import type { ChatMessageRow, ConversationRow, PlanRow } from "@/models/db/schema";
import { memberOf, PlanModel } from "@/models/plan.model";
import { PushSubscriptionModel } from "@/models/push-subscription.model";
import {
  canSendDirect,
  canSendInPlan,
  canStartDirectChat,
  type ChatPerson,
  type SendCheck,
  type StartChatCheck,
} from "@/models/rules/chat";
import { displayName, firstNameOf, isOnboarded, type User } from "@/models/user.model";
import type { ChatThreadVM, ConversationListItemVM, ConversationVM, InboxVM } from "@/views/view-models";
import { requireMember } from "./guards";
import { presentActivity, presentChatMessage, presentPhoto } from "./presenters";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const chatPerson = (u: User): ChatPerson => ({
  id: u.id,
  status: u.ratingRestrictedUntil && u.ratingRestrictedUntil > new Date() ? "suspended" : u.status,
  onboarded: isOnboarded(u),
  gender: u.gender,
  companionGenders: u.companionGenders,
  chatPolicy: u.chatPolicy,
});

/** Whether `viewer` may open a new direct chat with each of `targets`. */
export async function directChatChecks(viewer: User, targets: readonly User[]): Promise<Map<string, StartChatCheck>> {
  const [related, met] = await Promise.all([
    BlockModel.relatedIds(viewer.id),
    ConnectionModel.metAmong(
      viewer.id,
      targets.map((t) => t.id),
    ),
  ]);
  return new Map(
    targets.map((t) => [
      t.id,
      canStartDirectChat(chatPerson(viewer), chatPerson(t), { blocked: related.has(t.id), haveMet: met.has(t.id) }),
    ]),
  );
}

/** What one member may do in one conversation. `null` means they can't see it at all. */
export type ChatAccess = {
  conversation: ConversationRow;
  viewer: User;
  send: SendCheck;
  /** The other person in a direct chat. */
  peer: User | null;
  blockedByMe: boolean;
  plan: PlanRow | null;
  /** Everyone else in the chat (live updates and push go to them). */
  others: User[];
};

/**
 * The single authorisation point for chats. Direct chats are visible to their
 * two members unless the other person blocked the viewer; plan chats to their
 * members (kept in step with the plan by ChatModel.syncPlan).
 */
export async function chatAccess(viewer: User, conversationId: string, opts: { sync?: boolean } = {}) {
  if (!UUID.test(conversationId)) return null;
  const conversation = await ChatModel.get(conversationId);
  if (!conversation) return null;
  if (opts.sync && conversation.kind === "plan" && conversation.planId) await ChatModel.syncPlan(conversation.planId);
  if (!(await ChatModel.membership(conversationId, viewer.id))) return null;
  const others = (await ChatModel.members(conversationId)).map((m) => m.user).filter((u) => u.id !== viewer.id);

  if (conversation.kind === "direct") {
    const peer = others[0];
    if (!peer) return null;
    const [blockedByMe, blockedMe] = await Promise.all([
      BlockModel.hasBlocked(viewer.id, peer.id),
      BlockModel.hasBlocked(peer.id, viewer.id),
    ]);
    if (blockedMe) return null;
    const send = canSendDirect(chatPerson(viewer), { status: chatPerson(peer).status, firstName: firstNameOf(peer) }, {
      blockedByMe,
      blockedMe,
    });
    return { conversation, viewer, send, peer, blockedByMe, plan: null, others } satisfies ChatAccess;
  }

  const bundle = conversation.planId ? await PlanModel.bundle(conversation.planId) : null;
  if (!bundle) return null;
  const send = canSendInPlan(
    {
      participationStatus: memberOf(bundle, viewer.id)?.participation.status ?? null,
      planStatus: bundle.plan.status,
      endsAt: bundle.plan.endsAt,
      now: new Date(),
    },
    RULES.chat.planChatOpenHoursAfterEnd,
  );
  return { conversation, viewer, send, peer: null, blockedByMe: false, plan: bundle.plan, others } satisfies ChatAccess;
}

/** The latest page of a chat, ready to render. */
export async function threadFor(access: ChatAccess): Promise<ChatThreadVM> {
  const id = access.conversation.id;
  const [{ rows, hasEarlier }, unread] = await Promise.all([
    ChatModel.messages(id, { limit: RULES.chat.pageSize }),
    ChatModel.unreadByConversation(access.viewer.id, [id]),
  ]);
  return {
    conversationId: id,
    kind: access.conversation.kind,
    messages: rows.map((r) => presentChatMessage(r.message, r.sender, access.viewer.id)),
    hasEarlier,
    unreadOnOpen: unread.get(id) ?? 0,
    canSend: access.send.ok,
    closedReason: access.send.ok ? null : access.send.message,
  };
}

const preview = (body: string) => (body.length > 140 ? `${body.slice(0, 139)}…` : body);

/**
 * Sends a new message to everyone else in the chat: live to open tabs (SSE via
 * Postgres LISTEN/NOTIFY) and as a Web Push to members with no tab open here.
 * Delivery problems are logged, never surfaced to the sender: the message is saved.
 */
export async function deliverChatMessage(access: ChatAccess, message: ChatMessageRow) {
  const sender = access.viewer;
  const senderName = displayName(sender);
  const planLabel = access.plan ? getActivity(access.plan.activity).label : null;
  await Promise.all(
    access.others
      .filter((u) => u.status === "active" && (!u.ratingRestrictedUntil || u.ratingRestrictedUntil <= new Date()))
      .map(async (recipient) => {
        try {
          await publish(recipient.id, {
            type: "chat",
            conversationId: message.conversationId,
            planId: access.plan?.id ?? null,
            senderName,
            preview: preview(message.body),
            message: presentChatMessage(message, sender, recipient.id),
          });
          // One push per chat every 30 seconds is plenty; the device replaces it by tag.
          if (localListenerCount(recipient.id) === 0 && (await rateLimit(`chatpush:${recipient.id}:${message.conversationId}`, 1, 30_000)).ok) {
            const subs = await PushSubscriptionModel.forUser(recipient.id);
            for (const sub of subs) {
              const result = await sendPush(sub, {
                title: planLabel ? `${senderName} · ${planLabel}` : senderName,
                body: preview(message.body),
                url: `/messages/${message.conversationId}`,
                tag: `chat-${message.conversationId}`,
              });
              if (result === "gone") await PushSubscriptionModel.removeByEndpoint(sub.endpoint);
            }
          }
        } catch (error) {
          console.warn("[chat] delivery failed", error);
        }
      }),
  );
}

function presentInboxItem(entry: InboxEntry, viewer: User, now: Date): ConversationListItemVM {
  const { conversation, other, plan, last, lastSender } = entry;
  const lastMessage =
    last && lastSender
      ? {
          body: preview(last.body),
          senderName: last.senderId === viewer.id ? "You" : displayName(lastSender),
          mine: last.senderId === viewer.id,
          at: last.createdAt.toISOString(),
        }
      : null;
  if (conversation.kind === "plan" && plan) {
    const activity = presentActivity(plan.activity);
    return {
      id: conversation.id,
      kind: "plan",
      title: activity.label,
      subtitle: `${getSpot(plan.spot).name} · ${formatDay(plan.startsAt, now)}`,
      photo: null,
      activity,
      lastMessage,
      unread: entry.unread,
    };
  }
  return {
    id: conversation.id,
    kind: "direct",
    title: other ? (other.status === "deleted" ? "Deleted member" : displayName(other)) : "Chat",
    subtitle: null,
    photo: other ? presentPhoto(other) : null,
    activity: null,
    lastMessage,
    unread: entry.unread,
  };
}

/** GET /messages and /messages/:id */
export const ChatController = {
  async inbox(): Promise<InboxVM> {
    const viewer = await requireMember();
    const now = new Date();
    const hidden = await BlockModel.relatedIds(viewer.id);
    const entries = await ChatModel.inbox(viewer.id, hidden);
    return { now: now.toISOString(), items: entries.map((e) => presentInboxItem(e, viewer, now)) };
  },

  async conversation(params: Promise<{ id: string }>): Promise<ConversationVM> {
    const viewer = await requireMember();
    const { id } = await params;
    const access = await chatAccess(viewer, id, { sync: true });
    if (!access) notFound();
    const now = new Date();
    const thread = await threadFor(access);

    if (access.peer) {
      const peer = access.peer;
      const visible = peer.status === "active" && !access.blockedByMe;
      return {
        now: now.toISOString(),
        title: peer.status === "deleted" ? "Deleted member" : displayName(peer),
        subtitle: [yearLabel(peer.year), peer.branch].filter(Boolean).join(" · ") || null,
        href: visible ? `/u/${peer.id}` : null,
        photo: presentPhoto(peer),
        activity: null,
        members: [],
        peer: { id: peer.id, firstName: firstNameOf(peer), blockedByMe: access.blockedByMe },
        thread,
      };
    }

    const plan = access.plan!;
    const members = [access.viewer, ...access.others];
    return {
      now: now.toISOString(),
      title: getActivity(plan.activity).label,
      subtitle: `${getSpot(plan.spot).name} · ${formatDay(plan.startsAt, now)}, ${formatClock(plan.startsAt)}`,
      href: `/plans/${plan.id}`,
      photo: null,
      activity: presentActivity(plan.activity),
      members: members.map((u) => ({
        id: u.id,
        name: u.id === viewer.id ? "You" : displayName(u),
        photo: presentPhoto(u),
      })),
      peer: null,
      thread,
    };
  },
};
