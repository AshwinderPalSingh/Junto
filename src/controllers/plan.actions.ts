"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { RULES } from "@/config/app";
import { ACTIVITY_IDS, getActivity, getSpot, SPOT_IDS } from "@/config/campus";
import { GENDER_IDS } from "@/config/profile";
import { CANCEL_REASON_IDS, FEEDBACK_FLAG_IDS } from "@/config/safety";
import { failure, formToObject, invalid, success, type ActionState } from "@/lib/action";
import { isDomainError } from "@/lib/errors";
import { publish } from "@/lib/realtime";
import { rateLimit } from "@/lib/rate-limit";
import { requestOrigin } from "@/lib/session";
import { addMinutes, campusTimeToDate, formatClock, formatDay, roundUpMinutes } from "@/lib/time";
import { FeedbackModel } from "@/models/feedback.model";
import { planNotificationData } from "@/models/maintenance";
import { ChatModel } from "@/models/chat.model";
import { NotificationModel } from "@/models/notification.model";
import { acceptedMembers, memberOf, PlanModel, type PlanBundle } from "@/models/plan.model";
import { ReportModel } from "@/models/report.model";
import { ReputationModel } from "@/models/reputation.model";
import { ShareLinkModel } from "@/models/share-link.model";
import { displayName, firstNameOf, type User } from "@/models/user.model";
import { chatAccess, deliverChatMessage } from "./chat.controller";
import { requireMember } from "./guards";

/**
 * POST handlers for plans. Every action re-authenticates, validates its input
 * with Zod and lets the Model enforce the rules; ids arriving from the client
 * are only ever treated as references.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; state: ActionState<never> }> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    if (isDomainError(error)) return { ok: false, state: failure(error.message) };
    throw error;
  }
}

const actorData = (bundle: PlanBundle, actor: User) => ({ ...planNotificationData(bundle), actor: displayName(actor) });

/** Live-refresh the plan screen for everyone else on it. */
function pingMembers(bundle: PlanBundle, exceptId: string) {
  for (const m of acceptedMembers(bundle)) {
    if (m.user.id !== exceptId) void publish(m.user.id, { type: "plan", planId: bundle.plan.id, reason: "update" });
  }
}

/* ───────────── Posting ───────────── */

const createSchema = z.object({
  activity: z.enum(ACTIVITY_IDS, "Choose an activity."),
  spot: z.enum(SPOT_IDS, "Choose a meeting spot."),
  when: z.enum(["now", "15", "30", "60", "custom"], "Choose when."),
  day: z.enum(["today", "tomorrow"]).default("today"),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Pick a time.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  duration: z.coerce
    .number()
    .int()
    .refine((v) => (RULES.durations as readonly number[]).includes(v), "Choose how long."),
  capacity: z.coerce.number().int().min(RULES.minCapacity).max(RULES.maxCapacity),
  allowedGenders: z.array(z.enum(GENDER_IDS)).min(1, "Choose who can join."),
  note: z
    .string()
    .trim()
    .max(RULES.noteMaxLength, `Keep the note under ${RULES.noteMaxLength} characters.`)
    .optional()
    .transform((v) => v || null),
});

export async function createPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const host = await requireMember();
  const parsed = createSchema.safeParse(formToObject(formData, ["allowedGenders"]));
  if (!parsed.success) return invalid(parsed.error);
  const input = parsed.data;
  if (!(await rateLimit(`plan:create:${host.id}`, 10, 60 * 60_000)).ok) {
    return failure("You've posted a lot in the last hour. Try again a little later.");
  }

  const now = new Date();
  let startsAt: Date;
  if (input.when === "now") startsAt = now;
  else if (input.when === "custom") {
    if (!input.time) return failure("Pick a start time.", { time: ["Pick a time."] });
    startsAt = campusTimeToDate(now, input.day === "tomorrow" ? 1 : 0, input.time);
  } else startsAt = roundUpMinutes(addMinutes(now, Number(input.when)), 5);

  const result = await attempt(() =>
    PlanModel.create(
      host,
      {
        activity: input.activity,
        spot: input.spot,
        note: input.note,
        startsAt,
        durationMinutes: input.duration,
        capacity: input.capacity,
        allowedGenders: input.allowedGenders,
      },
      now,
    ),
  );
  if (!result.ok) return result.state;

  // People who said they're free (and fit this plan) hear about it right away.
  const bundle = await PlanModel.bundle(result.value.id);
  if (bundle) {
    const matches = (await PlanModel.freeMatches(bundle, now)).slice(0, 25);
    await NotificationModel.sendMany(
      matches.map((u) => ({
        userId: u.id,
        kind: "free_match" as const,
        planId: bundle.plan.id,
        actorId: host.id,
        data: planNotificationData(bundle),
      })),
    );
  }
  redirect(`/plans/${result.value.id}?posted=1`);
}

/* ───────────── Joining ───────────── */

const noteSchema = z
  .string()
  .trim()
  .max(RULES.requestNoteMaxLength, `Keep it under ${RULES.requestNoteMaxLength} characters.`)
  .optional()
  .transform((v) => v || null);

export async function requestToJoin(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const joiner = await requireMember();
  if (!UUID.test(planId)) return failure("Plan not found.");
  const note = noteSchema.safeParse(formData.get("note") ?? undefined);
  if (!note.success) return invalid(note.error);
  if (!(await rateLimit(`join:${joiner.id}`, 20, 60 * 60_000)).ok) return failure("Slow down a little and try again soon.");

  const result = await attempt(() => PlanModel.request(planId, joiner, note.data, new Date()));
  if (!result.ok) return result.state;
  const bundle = result.value;
  await NotificationModel.send({
    userId: bundle.host.id,
    kind: "join_request",
    planId,
    actorId: joiner.id,
    data: actorData(bundle, joiner),
  });
  refresh();
  return success(`Request sent. ${firstNameOf(bundle.host)} will get a notification.`);
}

export async function withdrawRequest(planId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await requireMember();
  if (!UUID.test(planId)) return failure("Plan not found.");
  const result = await attempt(() => PlanModel.withdraw(planId, user.id, new Date()));
  if (!result.ok) return result.state;
  refresh();
  return success("Request withdrawn.");
}

export async function decideRequest(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const host = await requireMember();
  const participationId = String(formData.get("participationId") ?? "");
  const decision = formData.get("decision") === "accept" ? "accept" : "decline";
  if (!UUID.test(planId) || !UUID.test(participationId)) return failure("Request not found.");

  const result = await attempt(() => PlanModel.decide(planId, host, participationId, decision, new Date()));
  if (!result.ok) return result.state;
  const { bundle, guest, accepted } = result.value;
  await NotificationModel.send({
    userId: guest.id,
    kind: accepted ? "request_accepted" : "request_declined",
    planId,
    actorId: host.id,
    data: planNotificationData(bundle),
  });
  if (accepted) {
    await ChatModel.syncPlan(planId);
    pingMembers(bundle, host.id);
  }
  refresh();
  return success(
    accepted
      ? `${firstNameOf(guest)} is in. Say hi in the plan's group chat.`
      : "Declined. They'll just see a gentle “not this time”.",
  );
}

/* ───────────── Changing plans ───────────── */

const reasonSchema = z.enum(CANCEL_REASON_IDS, "Choose a reason.");

export async function leavePlan(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMember();
  const reason = reasonSchema.safeParse(formData.get("reason"));
  if (!reason.success) return invalid(reason.error);
  if (!UUID.test(planId)) return failure("Plan not found.");

  const result = await attempt(() => PlanModel.leave(planId, user, reason.data, new Date()));
  if (!result.ok) return result.state;
  const { bundle, kind } = result.value;
  await ChatModel.syncPlan(planId);
  await NotificationModel.send({
    userId: bundle.host.id,
    kind: "guest_cancelled",
    planId,
    actorId: user.id,
    data: actorData(bundle, user),
  });
  pingMembers(bundle, user.id);
  refresh();
  if (kind === "safety") return success("You've left. If something felt wrong, please report it — every report is reviewed.");
  return success(kind === "late" ? "You've left the plan. A little more notice helps next time." : "You've left the plan.");
}

export async function cancelPlan(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const host = await requireMember();
  const reason = reasonSchema.safeParse(formData.get("reason"));
  if (!reason.success) return invalid(reason.error);
  if (!UUID.test(planId)) return failure("Plan not found.");

  const result = await attempt(() => PlanModel.cancel(planId, host, reason.data, new Date()));
  if (!result.ok) return result.state;
  const { bundle, affected } = result.value;
  await NotificationModel.sendMany(
    affected.map((userId) => ({
      userId,
      kind: "plan_cancelled" as const,
      planId,
      actorId: host.id,
      data: planNotificationData(bundle),
    })),
  );
  refresh();
  return success(affected.length ? "Plan cancelled. Everyone involved has been told." : "Plan cancelled.");
}

/* ───────────── At the meetup ───────────── */

export async function checkIn(planId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await requireMember();
  if (!UUID.test(planId)) return failure("Plan not found.");
  const result = await attempt(() => PlanModel.checkIn(planId, user.id, new Date()));
  if (!result.ok) return result.state;
  const { bundle, already } = result.value;
  if (!already) {
    await postToPlanChat(planId, user, "I'm here", "map-pin-check");
    for (const m of acceptedMembers(bundle)) {
      if (m.user.id === user.id) continue;
      await NotificationModel.send({
        userId: m.user.id,
        kind: "checked_in",
        planId,
        actorId: user.id,
        data: actorData(bundle, user),
      });
    }
  }
  refresh();
  return success("You're checked in. Have fun!");
}

/** Posts an automatic update (like a check-in) into the plan's group chat. */
async function postToPlanChat(planId: string, user: User, body: string, icon: string) {
  try {
    const conversationId = await ChatModel.syncPlan(planId);
    const access = conversationId ? await chatAccess(user, conversationId) : null;
    if (!access?.send.ok) return;
    const message = await ChatModel.send({ conversationId: access.conversation.id, senderId: user.id, body, icon });
    await deliverChatMessage(access, message);
  } catch (error) {
    console.warn("[chat] automatic update failed", error);
  }
}

/* ───────────── After ───────────── */

const FLAG_TO_REPORT: Record<string, string> = {
  uncomfortable: "unsafe",
  disrespectful: "harassment",
  profile_mismatch: "profile_mismatch",
};

export async function submitFeedback(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMember();
  if (!UUID.test(planId)) return failure("Plan not found.");
  const attendedRaw = formData.get("attended");
  if (attendedRaw !== "yes" && attendedRaw !== "no") return failure("Let us know if you made it.");
  const attended = attendedRaw === "yes";

  const bundle = await PlanModel.bundle(planId);
  if (!bundle) return failure("Plan not found.");
  const validFlags = new Set<string>(FEEDBACK_FLAG_IDS);
  if (attended && acceptedMembers(bundle).some((m) => m.user.id !== user.id && !["yes", "no"].includes(String(formData.get(`showed_${m.user.id}`))))) {
    return failure("Confirm whether each person showed up before sending feedback.");
  }
  const entries = acceptedMembers(bundle)
    .filter((m) => m.user.id !== user.id)
    .map((m) => ({
      rateeId: m.user.id,
      showedUp: formData.get(`showed_${m.user.id}`) !== "no",
      wouldMeetAgain: formData.get(`again_${m.user.id}`) === "on" ? true : null,
      flags: formData
        .getAll(`flags_${m.user.id}`)
        .map(String)
        .filter((f) => validFlags.has(f)),
    }));

  const result = await attempt(() => FeedbackModel.submit(planId, user.id, attended, entries, new Date()));
  if (!result.ok) return result.state;

  // Serious flags go straight to the moderators.
  if (attended) {
    for (const e of entries) {
      for (const flag of e.flags) {
        const category = FLAG_TO_REPORT[flag];
        if (!category) continue;
        await ReportModel.create({
          reporterId: user.id,
          reportedId: e.rateeId,
          planId,
          category,
          details: `Flagged in private post-meetup feedback (${flag.replace("_", " ")}).`,
        });
      }
    }
  }
  await Promise.all([user.id, ...entries.map((e) => e.rateeId)].map((id) => ReputationModel.assessRestriction(id)));
  refresh();
  return success("Thanks! That keeps Junto reliable for everyone.");
}

export async function createShareLink(planId: string): Promise<ActionState<{ url: string; text: string }>> {
  const user = await requireMember();
  if (!UUID.test(planId)) return failure("Plan not found.");
  const bundle = await PlanModel.bundle(planId);
  const mine = bundle ? memberOf(bundle, user.id) : null;
  if (!bundle || mine?.participation.status !== "accepted") return failure("You're not on this plan.");
  const link = await ShareLinkModel.getOrCreate(planId, user.id, addMinutes(bundle.plan.endsAt, 6 * 60));
  const url = `${await requestOrigin()}/s/${link.token}`;
  const now = new Date();
  const text = `I'm meeting up through Junto: ${getActivity(bundle.plan.activity).label} at ${getSpot(bundle.plan.spot).name}, ${formatDay(bundle.plan.startsAt, now).toLowerCase()} at ${formatClock(bundle.plan.startsAt)}.`;
  return success(undefined, { url, text });
}
