"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { RULES } from "@/config/app";
import { MESSAGE_PRESETS } from "@/config/safety";
import { failure, invalid, success, type ActionState } from "@/lib/action";
import { rateLimit } from "@/lib/rate-limit";
import { ChatModel } from "@/models/chat.model";
import { startChatMessage } from "@/models/rules/chat";
import { firstNameOf, UserModel } from "@/models/user.model";
import type { ChatMessageVM } from "@/views/view-models";
import { chatAccess, deliverChatMessage, directChatChecks, UUID } from "./chat.controller";
import { requireMember } from "./guards";
import { presentChatMessage } from "./presenters";

/**
 * POST handlers for chats. Each one re-authenticates and goes through
 * chatAccess(), so ids from the browser are only ever references.
 */

const PRESET_ICONS = new Set<string>(MESSAGE_PRESETS.map((p) => p.icon));

const sendSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write a message first.")
    .max(RULES.chat.maxLength, `Keep it under ${RULES.chat.maxLength} characters.`),
  icon: z
    .string()
    .nullish()
    .transform((v) => (v && PRESET_ICONS.has(v) ? v : null)),
});

/** Opens the direct chat with a member (creating it the first time), then goes there. */
export async function startChat(targetId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const viewer = await requireMember();
  if (!UUID.test(targetId) || targetId === viewer.id) return failure("Member not found.");
  const target = await UserModel.findById(targetId);
  if (!target) return failure("Member not found.");

  const existing = await ChatModel.findDirect(viewer.id, target.id);
  if (!existing) {
    const check = (await directChatChecks(viewer, [target])).get(target.id)!;
    if (!check.ok) return failure(startChatMessage(check, firstNameOf(target)));
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    if ((await ChatModel.countStartedSince(viewer.id, since)) >= RULES.chat.newChatsPerDay) {
      return failure("You've started a lot of new chats today. Try again tomorrow.");
    }
  }
  const conversation = existing ?? (await ChatModel.openDirect(viewer.id, target.id));
  redirect(`/messages/${conversation.id}`);
}

export async function sendChatMessage(
  conversationId: string,
  input: { body: string; icon?: string | null },
): Promise<ActionState<{ message: ChatMessageVM }>> {
  const viewer = await requireMember();
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const access = await chatAccess(viewer, conversationId);
  if (!access) return failure("This chat isn't available any more.");
  if (!access.send.ok) return failure(access.send.message);
  if (!(await rateLimit(`chat:${viewer.id}`, RULES.chat.perMinute, 60_000)).ok) {
    return failure("You're sending messages very fast. Wait a moment and try again.");
  }
  const message = await ChatModel.send({
    conversationId: access.conversation.id,
    senderId: viewer.id,
    body: parsed.data.body,
    icon: parsed.data.icon,
  });
  await deliverChatMessage(access, message);
  return success(undefined, { message: presentChatMessage(message, viewer, viewer.id) });
}

/** Marks everything in a chat as read (called when it is on screen). */
export async function markChatRead(conversationId: string): Promise<void> {
  const viewer = await requireMember();
  if (!UUID.test(conversationId)) return;
  if (!(await ChatModel.membership(conversationId, viewer.id))) return;
  await ChatModel.markRead(conversationId, viewer.id);
}

const cursorSchema = z.object({ at: z.iso.datetime(), id: z.string().regex(UUID) });

export async function loadEarlierMessages(
  conversationId: string,
  before: { at: string; id: string },
): Promise<{ messages: ChatMessageVM[]; hasEarlier: boolean }> {
  const viewer = await requireMember();
  const cursor = cursorSchema.safeParse(before);
  const access = cursor.success ? await chatAccess(viewer, conversationId) : null;
  if (!cursor.success || !access) return { messages: [], hasEarlier: false };
  const { rows, hasEarlier } = await ChatModel.messages(access.conversation.id, {
    before: { at: new Date(cursor.data.at), id: cursor.data.id },
    limit: RULES.chat.pageSize,
  });
  return { messages: rows.map((r) => presentChatMessage(r.message, r.sender, viewer.id)), hasEarlier };
}

/** Messages newer than `after` (after a reconnect, or when a live update was too large to inline). */
export async function loadNewMessages(conversationId: string, after: string): Promise<ChatMessageVM[]> {
  const viewer = await requireMember();
  const since = z.iso.datetime().safeParse(after);
  const access = since.success ? await chatAccess(viewer, conversationId) : null;
  if (!since.success || !access) return [];
  const rows = await ChatModel.messagesAfter(access.conversation.id, new Date(since.data));
  return rows.map((r) => presentChatMessage(r.message, r.sender, viewer.id));
}
