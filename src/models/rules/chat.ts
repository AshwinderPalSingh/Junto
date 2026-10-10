/**
 * Who may chat with whom. Pure rules (no I/O), unit-tested in tests/rules.test.ts.
 *
 * - Direct chats are for people who could meet: both are comfortable with each
 *   other's gender (the same mutual rule as plans), and neither has blocked the other.
 * - Each member decides who may *start* a new direct chat with them: anyone they
 *   could meet, only people they've met on a plan, or nobody. Existing chats keep
 *   working until one of them blocks the other.
 * - Plan group chats belong to the host and accepted guests, and close a day after
 *   the plan ends.
 */

export type ChatPolicy = "anyone" | "met" | "nobody";

export type ChatPerson = {
  id: string;
  status: string;
  onboarded: boolean;
  gender: string | null;
  companionGenders: readonly string[];
  chatPolicy: ChatPolicy;
};

export type StartChatCheck =
  | { ok: true }
  | { ok: false; reason: "self" | "unavailable" | "not_accepting" | "met_only" };

/** Can `viewer` open a new direct chat with `target`? */
export function canStartDirectChat(
  viewer: ChatPerson,
  target: ChatPerson,
  ctx: { blocked: boolean; haveMet: boolean },
): StartChatCheck {
  if (viewer.id === target.id) return { ok: false, reason: "self" };
  if (viewer.status !== "active" || target.status !== "active" || !target.onboarded) {
    return { ok: false, reason: "unavailable" };
  }
  // Blocks and private comfort preferences are never revealed: both read as "unavailable".
  if (ctx.blocked) return { ok: false, reason: "unavailable" };
  const mutual =
    Boolean(viewer.gender && target.companionGenders.includes(viewer.gender)) &&
    Boolean(target.gender && viewer.companionGenders.includes(target.gender));
  if (!mutual && !ctx.haveMet) return { ok: false, reason: "unavailable" };
  if (target.chatPolicy === "nobody") return { ok: false, reason: "not_accepting" };
  if (target.chatPolicy === "met" && !ctx.haveMet) return { ok: false, reason: "met_only" };
  return { ok: true };
}

export function startChatMessage(check: Exclude<StartChatCheck, { ok: true }>, firstName: string) {
  switch (check.reason) {
    case "self":
      return "That's you.";
    case "not_accepting":
      return `${firstName} isn't accepting new chats right now.`;
    case "met_only":
      return `${firstName} only accepts new chats from people they've met on a plan.`;
    default:
      return "This member isn't available to chat.";
  }
}

export type SendCheck = { ok: true } | { ok: false; message: string };

/** Can `sender` write in their existing direct chat with `other`? */
export function canSendDirect(
  sender: Pick<ChatPerson, "status">,
  other: Pick<ChatPerson, "status"> & { firstName: string },
  ctx: { blockedByMe: boolean; blockedMe: boolean },
): SendCheck {
  if (sender.status !== "active") return { ok: false, message: "Your account can't send messages right now." };
  if (other.status === "deleted") return { ok: false, message: "This account has been deleted." };
  if (ctx.blockedByMe) {
    return { ok: false, message: `You blocked ${other.firstName}. Unblock them in Settings to chat again.` };
  }
  if (ctx.blockedMe || other.status !== "active") return { ok: false, message: "This member isn't available to chat." };
  return { ok: true };
}

/** Can a plan member write in the plan's group chat right now? */
export function canSendInPlan(
  input: { participationStatus: string | null; planStatus: string; endsAt: Date; now: Date },
  openHoursAfterEnd: number,
): SendCheck {
  if (input.participationStatus !== "accepted") return { ok: false, message: "Only people on this plan can chat here." };
  if (input.planStatus === "cancelled") return { ok: false, message: "This plan was cancelled, so its chat is closed." };
  if (input.now.getTime() > input.endsAt.getTime() + openHoursAfterEnd * 3_600_000) {
    return { ok: false, message: "This plan's chat closed a day after it ended. Start a direct chat to keep talking." };
  }
  return { ok: true };
}
