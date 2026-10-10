import "server-only";
import { notFound } from "next/navigation";
import { RULES } from "@/config/app";
import { ACTIVITY_IDS } from "@/config/campus";
import { AvailabilityModel } from "@/models/availability.model";
import { ChatModel } from "@/models/chat.model";
import {
  acceptedGuests,
  acceptedMembers,
  isActivePlan,
  memberOf,
  needsFeedbackFrom,
  PlanModel,
  pendingRequests,
} from "@/models/plan.model";
import { JOIN_BLOCK_MESSAGES } from "@/models/rules/compatibility";
import { checkInOpen, planPhase } from "@/models/rules/plan-timing";
import { displayName } from "@/models/user.model";
import type { NewPlanVM, PlanDetailVM, PlanViewerRole } from "@/views/view-models";
import { chatAccess, directChatChecks, threadFor } from "./chat.controller";
import { requireMember } from "./guards";
import { buildContext, peopleIn, presentMember, presentPhoto, presentPlanCard } from "./presenters";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
type Params = Record<string, string | string[] | undefined>;

export const PlanController = {
  /** GET /plans/new?activity= */
  async newForm(searchParams: Promise<Params>): Promise<NewPlanVM> {
    const viewer = await requireMember();
    const params = await searchParams;
    const now = new Date();
    const [activeHosted, freeCounts, ctx] = await Promise.all([
      PlanModel.countActiveHosted(viewer.id, now),
      AvailabilityModel.matchCountsFor(viewer, now),
      buildContext(viewer, []),
    ]);
    const preset = typeof params.activity === "string" ? params.activity : null;
    return {
      now: now.toISOString(),
      host: presentMember(viewer, ctx),
      myGender: viewer.gender ?? "woman",
      defaultAllowed: viewer.companionGenders,
      freeCounts,
      activeHosted,
      maxHosted: RULES.maxOpenHostedPlans,
      campusHours: RULES.campusHours,
      presetActivity: preset && (ACTIVITY_IDS as string[]).includes(preset) ? preset : null,
    };
  },

  /** GET /plans/:id — one screen whose content depends on who is looking. */
  async show(params: Promise<{ id: string }>): Promise<PlanDetailVM> {
    const viewer = await requireMember();
    const { id } = await params;
    if (!UUID.test(id)) notFound();
    const now = new Date();
    const bundle = await PlanModel.bundle(id);
    if (!bundle) notFound();

    const mine = memberOf(bundle, viewer.id);
    const isHost = bundle.plan.hostId === viewer.id;
    const joinCtx = await PlanModel.joinContext(viewer.id, now);
    const check = PlanModel.joinCheck(bundle, viewer, joinCtx);

    // Outsiders only ever see plans they could join; no browsing other people's private plans.
    if (!isHost && !mine) {
      if (!check.ok && ["blocked", "hidden", "incompatible", "closed"].includes(check.reason)) notFound();
    }
    if (!isHost && joinCtx.blocked.has(bundle.host.id)) notFound();

    const status = mine?.participation.status ?? null;
    const role: PlanViewerRole = isHost
      ? "host"
      : status === "accepted"
        ? "guest"
        : status === "requested"
          ? "requested"
          : "outsider";
    const insider = role === "host" || role === "guest";
    const guests = acceptedGuests(bundle);
    const active = isActivePlan(bundle.plan) && bundle.plan.endsAt > now;

    const ctx = await buildContext(viewer, peopleIn([bundle], isHost));
    const card = presentPlanCard(bundle, ctx);

    // The plan's group chat: host and confirmed guests (and, once a plan is cancelled, whoever was on it).
    const conversationId = insider || mine ? await ChatModel.syncPlan(bundle.plan.id) : null;
    const access = conversationId ? await chatAccess(viewer, conversationId) : null;
    const chat = access ? await threadFor(access) : null;

    // Who the viewer could message directly from this page.
    const shown = insider ? acceptedMembers(bundle).map((m) => m.user) : [bundle.host];
    const chatChecks = await directChatChecks(viewer, shown);
    const canMessage = (userId: string) => userId !== viewer.id && Boolean(chatChecks.get(userId)?.ok);

    let requestBlockedReason: string | null = null;
    if (role === "outsider") {
      if (status === "declined") requestBlockedReason = "This one didn't work out — there are other plans on the board.";
      else if (!check.ok) requestBlockedReason = JOIN_BLOCK_MESSAGES[check.reason];
    }

    return {
      now: now.toISOString(),
      plan: {
        ...card,
        allowedGenders: isHost ? bundle.plan.allowedGenders : [],
        cancelReason: bundle.plan.cancelReason,
        removedByAdmin: bundle.plan.removedByAdmin,
      },
      phase: planPhase(bundle.plan.startsAt, bundle.plan.endsAt, now),
      viewer: {
        id: viewer.id,
        role,
        participationStatus: status,
        checkedIn: Boolean(mine?.participation.checkedInAt),
        feedbackDone: Boolean(mine?.participation.feedbackAt),
      },
      requestBlockedReason,
      requests: isHost
        ? pendingRequests(bundle).map((m) => ({
            participationId: m.participation.id,
            note: m.participation.note,
            requestedAt: m.participation.requestedAt.toISOString(),
            member: presentMember(m.user, ctx),
          }))
        : [],
      members: insider
        ? acceptedMembers(bundle).map((m) => ({
            member: presentMember(m.user, ctx),
            role: m.participation.role,
            checkedIn: Boolean(m.participation.checkedInAt),
            canMessage: canMessage(m.user.id),
          }))
        : [],
      chat,
      canMessageHost: role === "outsider" && !isHost && canMessage(bundle.host.id),
      can: {
        request: role === "outsider" && check.ok && status !== "declined",
        withdraw: role === "requested" && active,
        checkIn: insider && active && guests.length > 0 && !mine?.participation.checkedInAt &&
          checkInOpen(bundle.plan.startsAt, bundle.plan.endsAt, now),
        feedback: needsFeedbackFrom(bundle, viewer.id, now),
        cancelPlan: isHost && active,
        leave: role === "guest" && active,
        share: insider && active && guests.length > 0,
      },
      feedbackTargets: insider
        ? acceptedMembers(bundle)
            .filter((m) => m.user.id !== viewer.id)
            .map((m) => ({
              id: m.user.id,
              name: displayName(m.user),
              photo: presentPhoto(m.user),
            }))
        : [],
    };
  },
};
