import "server-only";
import { getBadge } from "@/config/badges";
import { campusIdentity } from "@/lib/campus-identity";
import { getActivity, getSpot } from "@/config/campus";
import { interestOf, VIBES, yearLabel } from "@/config/profile";
import { acceptedGuests, memberOf, pendingRequests, type PlanBundle } from "@/models/plan.model";
import { ReputationModel } from "@/models/reputation.model";
import { emptyReputation, type Reputation } from "@/models/rules/reliability";
import { displayName, hasPhoto, type User } from "@/models/user.model";
import type { ChatMessageRow } from "@/models/db/schema";
import type {
  ActivityVM,
  ChatMessageVM,
  MemberVM,
  PhotoVM,
  PlanCardVM,
  PlanStatusVM,
  ReputationVM,
  SpotVM,
} from "@/views/view-models";

/**
 * Presenters turn model rows into view models. This is where privacy rules
 * are applied to what leaves the server (no emails, no private preferences).
 * Profile photos are visible to every signed-in member, served by an
 * auth-gated route rather than a public URL.
 */

export type PresentContext = {
  viewer: User;
  reputations: Map<string, Reputation>;
};

export const initialsOf = (u: User) => {
  const identity = u.status === "deleted" ? u : campusIdentity(u.email);
  return `${identity.firstName?.charAt(0) ?? "?"}${identity.lastName?.charAt(0) ?? ""}`.toUpperCase();
};

export const avatarUrl = (u: User) =>
  hasPhoto(u) ? `/api/avatars/${u.id}?v=${u.photoUpdatedAt?.getTime() ?? 0}` : null;

export const presentPhoto = (u: User): PhotoVM => ({
  url: u.status === "deleted" ? null : avatarUrl(u),
  initials: u.status === "deleted" ? "?" : initialsOf(u),
});

export function presentReputation(rep: Reputation): ReputationVM {
  return {
    level: rep.level,
    summary: rep.summary,
    attended: rep.attended,
    rating: rep.rating,
    ratingSample: rep.ratingSample,
    badges: rep.badges.map((id) => {
      const b = getBadge(id);
      return { id: b.id, label: b.label, icon: b.icon, description: b.description };
    }),
  };
}

export function presentActivity(id: string): ActivityVM {
  const a = getActivity(id);
  return { id: a.id, label: a.label, short: a.short, icon: a.icon, hint: a.hint };
}

export function presentSpot(id: string): SpotVM {
  const s = getSpot(id);
  return { id: s.id, name: s.name, area: s.area };
}

export function presentMember(user: User, ctx: PresentContext): MemberVM {
  const viewerInterests = new Set(ctx.viewer.interests);
  const vibe = VIBES.find((v) => v.id === user.vibe);
  const isYou = user.id === ctx.viewer.id;
  return {
    id: user.id,
    name: displayName(user),
    firstName: user.status === "deleted" ? "Deleted" : campusIdentity(user.email).firstName,
    year: yearLabel(user.year),
    branch: user.branch,
    bio: user.bio,
    vibe: vibe ? { label: vibe.label } : null,
    interests: user.interests.flatMap((id) => {
      const i = interestOf(id);
      return i ? [{ id: i.id, label: i.label, shared: !isYou && viewerInterests.has(i.id) }] : [];
    }),
    photo: presentPhoto(user),
    reputation: presentReputation(ctx.reputations.get(user.id) ?? emptyReputation()),
    isYou,
  };
}

export function presentPlanCard(bundle: PlanBundle, ctx: PresentContext): PlanCardVM {
  const { plan } = bundle;
  const guests = acceptedGuests(bundle);
  const mine = memberOf(bundle, ctx.viewer.id);
  const host = presentMember(bundle.host, ctx);
  const isHost = plan.hostId === ctx.viewer.id;
  return {
    id: plan.id,
    activity: presentActivity(plan.activity),
    spot: presentSpot(plan.spot),
    note: plan.note,
    startsAt: plan.startsAt.toISOString(),
    endsAt: plan.endsAt.toISOString(),
    durationMinutes: Math.round((plan.endsAt.getTime() - plan.startsAt.getTime()) / 60_000),
    capacity: plan.capacity,
    joined: guests.length,
    spotsLeft: Math.max(0, plan.capacity - guests.length),
    isGroup: plan.capacity > 1,
    status: plan.status as PlanStatusVM,
    host,
    companions: guests.map((g) => ({
      id: g.user.id,
      name: displayName(g.user),
      photo: presentPhoto(g.user),
    })),
    my: { role: mine?.participation.role ?? null, status: mine?.participation.status ?? null },
    sharedInterests: host.interests.filter((i) => i.shared).length,
    pendingRequests: isHost ? pendingRequests(bundle).length : 0,
  };
}

/** Everyone whose card data a list of plans will show. */
export function peopleIn(bundles: readonly PlanBundle[], includeRequests = false): User[] {
  const people = new Map<string, User>();
  for (const b of bundles) {
    people.set(b.host.id, b.host);
    for (const m of b.members) {
      if (m.participation.status === "accepted" || (includeRequests && m.participation.status === "requested")) {
        people.set(m.user.id, m.user);
      }
    }
  }
  return [...people.values()];
}

/** Loads reputations for everyone a screen is about to show. */
export async function buildContext(viewer: User, people: readonly User[]): Promise<PresentContext> {
  const ids = [...new Set([viewer.id, ...people.map((p) => p.id)])];
  return { viewer, reputations: await ReputationModel.forUsers(ids) };
}

/** A chat message as one particular member sees it. */
export function presentChatMessage(message: ChatMessageRow, sender: User, viewerId: string): ChatMessageVM {
  const mine = message.senderId === viewerId;
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    senderName: mine ? "You" : sender.status === "deleted" ? "Deleted member" : displayName(sender),
    senderPhoto: presentPhoto(sender),
    body: message.body,
    icon: message.icon,
    at: message.createdAt.toISOString(),
    mine,
  };
}
