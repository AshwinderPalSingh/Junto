import "server-only";
import { and, asc, eq, gt, inArray, lt, lte, ne, or, sql } from "drizzle-orm";
import { RULES } from "@/config/app";
import { DomainError } from "@/lib/errors";
import { addMinutes } from "@/lib/time";
import { getDb, type Executor } from "./db/client";
import {
  participations,
  plans,
  users,
  type CancelKind,
  type ParticipationRow,
  type PlanRow,
  type UserRow,
} from "./db/schema";
import { AvailabilityModel } from "./availability.model";
import { BlockModel } from "./block.model";
import {
  groupPreferenceAllows,
  isMutuallyCompatible,
  type JoinCheck,
  type PersonTraits,
} from "./rules/compatibility";
import {
  cancellationKind,
  checkInOpen,
  feedbackOpen,
  joinWindowOpen,
  validatePlanStart,
} from "./rules/plan-timing";

export type Member = { participation: ParticipationRow; user: UserRow };
export type PlanBundle = { plan: PlanRow; host: UserRow; members: Member[] };

export type NewPlanInput = {
  activity: string;
  spot: string;
  note: string | null;
  startsAt: Date;
  durationMinutes: number;
  capacity: number;
  allowedGenders: string[];
};

export type JoinContext = { blocked: Set<string>; hiddenHosts: Set<string>; now: Date };

const ACTIVE = ["open", "full"] as const;

export const traitsOf = (u: UserRow): PersonTraits => ({
  id: u.id,
  gender: u.gender,
  companionGenders: u.companionGenders,
  groupPref: u.groupPref,
});

export const acceptedMembers = (b: PlanBundle) => b.members.filter((m) => m.participation.status === "accepted");
export const acceptedGuests = (b: PlanBundle) =>
  b.members.filter((m) => m.participation.role === "guest" && m.participation.status === "accepted");
export const pendingRequests = (b: PlanBundle) => b.members.filter((m) => m.participation.status === "requested");
export const memberOf = (b: PlanBundle, userId: string) => b.members.find((m) => m.user.id === userId) ?? null;
export const isActivePlan = (p: PlanRow) => (ACTIVE as readonly string[]).includes(p.status);

/** True when `userId` was confirmed on a finished plan and hasn't left feedback yet. */
export function needsFeedbackFrom(b: PlanBundle, userId: string, now: Date) {
  const mine = memberOf(b, userId);
  return Boolean(
    mine &&
      mine.participation.status === "accepted" &&
      !mine.participation.feedbackAt &&
      acceptedGuests(b).length > 0 &&
      feedbackOpen(b.plan.startsAt, b.plan.endsAt, now) &&
      (b.plan.status === "completed" || b.plan.endsAt <= now),
  );
}

async function loadBundles(ex: Executor, planIds: readonly string[], lock = false): Promise<PlanBundle[]> {
  if (planIds.length === 0) return [];
  const headQuery = ex
    .select({ plan: plans, host: users })
    .from(plans)
    .innerJoin(users, eq(users.id, plans.hostId))
    .where(inArray(plans.id, [...planIds]))
    .orderBy(asc(plans.startsAt));
  const heads = lock ? await headQuery.for("update", { of: plans }) : await headQuery;
  const rows = await ex
    .select({ participation: participations, user: users })
    .from(participations)
    .innerJoin(users, eq(users.id, participations.userId))
    .where(inArray(participations.planId, [...planIds]))
    .orderBy(asc(participations.requestedAt));
  const byPlan = new Map<string, Member[]>();
  for (const r of rows) {
    const list = byPlan.get(r.participation.planId) ?? [];
    list.push(r);
    byPlan.set(r.participation.planId, list);
  }
  return heads.map((h) => ({ plan: h.plan, host: h.host, members: byPlan.get(h.plan.id) ?? [] }));
}

async function loadBundle(ex: Executor, planId: string, lock = false) {
  const [bundle] = await loadBundles(ex, [planId], lock);
  return bundle ?? null;
}

async function findOverlap(ex: Executor, userId: string, startsAt: Date, endsAt: Date, excludePlanId?: string) {
  const [row] = await ex
    .select({ plan: plans })
    .from(participations)
    .innerJoin(plans, eq(plans.id, participations.planId))
    .where(
      and(
        eq(participations.userId, userId),
        eq(participations.status, "accepted"),
        inArray(plans.status, [...ACTIVE]),
        lt(plans.startsAt, endsAt),
        gt(plans.endsAt, startsAt),
        excludePlanId ? ne(plans.id, excludePlanId) : undefined,
      ),
    )
    .limit(1);
  return row?.plan ?? null;
}

export const PlanModel = {
  bundle: async (planId: string) => loadBundle(await getDb(), planId),

  bundles: async (planIds: readonly string[]) => loadBundles(await getDb(), planIds),

  /** Can `viewer` ask to join? Hard filters first, then capacity and timing. */
  joinCheck(bundle: PlanBundle, viewer: UserRow, ctx: JoinContext): JoinCheck {
    const { plan, host } = bundle;
    const guests = acceptedGuests(bundle);
    if (plan.hostId === viewer.id) return { ok: false, reason: "own_plan" };
    if (ctx.blocked.has(host.id) || guests.some((g) => ctx.blocked.has(g.user.id))) {
      return { ok: false, reason: "blocked" };
    }
    if (ctx.hiddenHosts.has(host.id)) return { ok: false, reason: "hidden" };
    if (!isMutuallyCompatible(traitsOf(viewer), plan, traitsOf(host), guests.map((g) => traitsOf(g.user)))) {
      return { ok: false, reason: "incompatible" };
    }
    if (!isActivePlan(plan) || plan.removedByAdmin) return { ok: false, reason: "closed" };
    if (!joinWindowOpen(plan.startsAt, ctx.now)) return { ok: false, reason: "started" };
    if (guests.length >= plan.capacity) return { ok: false, reason: "full" };
    if (!groupPreferenceAllows(viewer.groupPref, plan.capacity)) return { ok: false, reason: "group_pref" };
    return { ok: true };
  },

  /** Hosts who have declined this member enough times that their plans stop showing. */
  async hiddenHostsFor(userId: string): Promise<Set<string>> {
    const db = await getDb();
    const rows = await db
      .select({ hostId: plans.hostId, n: sql<number>`count(*)::int` })
      .from(participations)
      .innerJoin(plans, eq(plans.id, participations.planId))
      .where(and(eq(participations.userId, userId), eq(participations.status, "declined")))
      .groupBy(plans.hostId);
    return new Set(rows.filter((r) => r.n >= RULES.declinesBeforeHidden).map((r) => r.hostId));
  },

  async joinContext(userId: string, now: Date): Promise<JoinContext> {
    const [blocked, hiddenHosts] = await Promise.all([
      BlockModel.relatedIds(userId),
      PlanModel.hiddenHostsFor(userId),
    ]);
    return { blocked, hiddenHosts, now };
  },

  /**
   * The board: upcoming plans this member is allowed to see — ones they can
   * join, plus ones they've already asked to join or are part of.
   */
  async board(viewer: UserRow, now: Date) {
    const db = await getDb();
    const candidates = await db
      .select({ id: plans.id })
      .from(plans)
      .innerJoin(users, eq(users.id, plans.hostId))
      .where(
        and(
          inArray(plans.status, [...ACTIVE]),
          eq(plans.removedByAdmin, false),
          gt(plans.startsAt, addMinutes(now, -RULES.joinGraceMinutes)),
          lt(plans.startsAt, addMinutes(now, RULES.planHorizonHours * 60)),
          ne(plans.hostId, viewer.id),
          eq(users.status, "active"),
        ),
      )
      .orderBy(asc(plans.startsAt))
      .limit(120);
    const [bundles, ctx] = await Promise.all([
      loadBundles(db, candidates.map((c) => c.id)),
      PlanModel.joinContext(viewer.id, now),
    ]);
    return bundles
      .map((bundle) => {
        const mine = memberOf(bundle, viewer.id);
        const check = PlanModel.joinCheck(bundle, viewer, ctx);
        const involved = mine && ["requested", "accepted"].includes(mine.participation.status);
        return { bundle, mine, check, visible: check.ok || Boolean(involved) };
      })
      .filter((entry) => entry.visible);
  },

  async countActiveHosted(hostId: string, now: Date) {
    const db = await getDb();
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(plans)
      .where(and(eq(plans.hostId, hostId), inArray(plans.status, [...ACTIVE]), gt(plans.endsAt, now)));
    return row?.n ?? 0;
  },

  async create(host: UserRow, input: NewPlanInput, now: Date) {
    const startError = validatePlanStart(input.startsAt, now);
    if (startError) throw new DomainError(startError, "invalid_time");
    if ((await PlanModel.countActiveHosted(host.id, now)) >= RULES.maxOpenHostedPlans) {
      throw new DomainError(
        `You can host up to ${RULES.maxOpenHostedPlans} upcoming plans at a time. Finish or cancel one first.`,
        "too_many_plans",
      );
    }
    const startsAt = input.startsAt < now ? now : input.startsAt;
    const endsAt = addMinutes(startsAt, input.durationMinutes);
    const db = await getDb();
    return db.transaction(async (tx) => {
      const clash = await findOverlap(tx, host.id, startsAt, endsAt);
      if (clash) throw new DomainError("You already have a plan at that time.", "overlap");
      const [plan] = await tx
        .insert(plans)
        .values({
          hostId: host.id,
          activity: input.activity,
          spot: input.spot,
          note: input.note,
          startsAt,
          endsAt,
          capacity: input.capacity,
          allowedGenders: input.allowedGenders,
        })
        .returning();
      await tx.insert(participations).values({
        planId: plan.id,
        userId: host.id,
        role: "host",
        status: "accepted",
        requestedAt: now,
        decidedAt: now,
      });
      return plan;
    });
  },

  async request(planId: string, joiner: UserRow, note: string | null, now: Date) {
    const db = await getDb();
    const ctx = await PlanModel.joinContext(joiner.id, now);
    return db.transaction(async (tx) => {
      const bundle = await loadBundle(tx, planId, true);
      if (!bundle) throw new DomainError("That plan doesn't exist any more.", "not_found");
      const existing = memberOf(bundle, joiner.id);
      if (existing?.participation.status === "requested") throw new DomainError("You've already asked to join.");
      if (existing?.participation.status === "accepted") throw new DomainError("You're already in this plan.");
      if (existing?.participation.status === "declined") throw new DomainError("This one didn't work out — try another plan.");
      const check = PlanModel.joinCheck(bundle, joiner, ctx);
      if (!check.ok) {
        const messages: Record<string, string> = {
          full: "This plan just filled up.",
          started: "This plan has already started.",
          closed: "This plan isn't taking requests any more.",
          group_pref: "This plan doesn't match your one-on-one / group preference.",
        };
        throw new DomainError(messages[check.reason] ?? "This plan isn't available.", check.reason);
      }
      const [pending] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(participations)
        .innerJoin(plans, eq(plans.id, participations.planId))
        .where(
          and(
            eq(participations.userId, joiner.id),
            eq(participations.status, "requested"),
            inArray(plans.status, [...ACTIVE]),
          ),
        );
      if ((pending?.n ?? 0) >= RULES.maxPendingRequests) {
        throw new DomainError(
          `You have ${RULES.maxPendingRequests} requests waiting. Withdraw one or wait for replies.`,
          "too_many_requests",
        );
      }
      const clash = await findOverlap(tx, joiner.id, bundle.plan.startsAt, bundle.plan.endsAt);
      if (clash) throw new DomainError("You already have a plan at that time.", "overlap");

      if (existing) {
        await tx
          .update(participations)
          .set({ status: "requested", note, requestedAt: now, decidedAt: null, cancelledAt: null, cancelKind: null })
          .where(eq(participations.id, existing.participation.id));
      } else {
        await tx.insert(participations).values({
          planId,
          userId: joiner.id,
          role: "guest",
          status: "requested",
          note,
          requestedAt: now,
        });
      }
      return bundle;
    });
  },

  async withdraw(planId: string, userId: string, now: Date) {
    const db = await getDb();
    const result = await db
      .update(participations)
      .set({ status: "withdrawn", decidedAt: now })
      .where(
        and(
          eq(participations.planId, planId),
          eq(participations.userId, userId),
          eq(participations.status, "requested"),
        ),
      )
      .returning({ id: participations.id });
    if (result.length === 0) throw new DomainError("There's no pending request to withdraw.");
  },

  /** Host accepts or declines a request. Accepting re-checks capacity and consent under a row lock. */
  async decide(planId: string, host: UserRow, participationId: string, decision: "accept" | "decline", now: Date) {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const bundle = await loadBundle(tx, planId, true);
      if (!bundle || bundle.plan.hostId !== host.id) throw new DomainError("Plan not found.", "not_found");
      const request = bundle.members.find(
        (m) => m.participation.id === participationId && m.participation.status === "requested",
      );
      if (!request) throw new DomainError("That request is no longer waiting.", "stale");

      if (decision === "decline") {
        await tx
          .update(participations)
          .set({ status: "declined", decidedAt: now })
          .where(eq(participations.id, participationId));
        return { bundle, guest: request.user, accepted: false, becameFull: false };
      }

      if (!isActivePlan(bundle.plan)) throw new DomainError("This plan is no longer active.");
      if (!joinWindowOpen(bundle.plan.startsAt, now)) throw new DomainError("This plan has already started.");
      const guests = acceptedGuests(bundle);
      if (guests.length >= bundle.plan.capacity) {
        throw new DomainError("The plan is full. Someone needs to drop out before you can accept more.", "full");
      }
      const consent = isMutuallyCompatible(
        traitsOf(request.user),
        bundle.plan,
        traitsOf(bundle.host),
        guests.map((g) => traitsOf(g.user)),
      );
      if (!consent || (await BlockModel.isBlockedEitherWay(host.id, request.user.id, tx))) {
        throw new DomainError("This request can't be accepted with the current group.", "incompatible");
      }
      const clash = await findOverlap(tx, request.user.id, bundle.plan.startsAt, bundle.plan.endsAt, planId);
      if (clash) throw new DomainError(`${request.user.firstName} is already booked at that time.`, "overlap");

      await tx
        .update(participations)
        .set({ status: "accepted", decidedAt: now })
        .where(eq(participations.id, participationId));
      const becameFull = guests.length + 1 >= bundle.plan.capacity;
      if (becameFull) {
        await tx.update(plans).set({ status: "full", updatedAt: now }).where(eq(plans.id, planId));
      }
      // A confirmed guest can't be double-booked: drop their other overlapping requests.
      const overlappingRequests = await tx
        .select({ id: participations.id })
        .from(participations)
        .innerJoin(plans, eq(plans.id, participations.planId))
        .where(
          and(
            eq(participations.userId, request.user.id),
            eq(participations.status, "requested"),
            ne(participations.planId, planId),
            lt(plans.startsAt, bundle.plan.endsAt),
            gt(plans.endsAt, bundle.plan.startsAt),
          ),
        );
      if (overlappingRequests.length) {
        await tx
          .update(participations)
          .set({ status: "withdrawn", decidedAt: now })
          .where(inArray(participations.id, overlappingRequests.map((r) => r.id)));
      }
      return { bundle, guest: request.user, accepted: true, becameFull };
    });
  },

  /** An accepted guest drops out. Early, late and safety cancellations are recorded differently. */
  async leave(planId: string, user: UserRow, reason: string, now: Date) {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const bundle = await loadBundle(tx, planId, true);
      const mine = bundle ? memberOf(bundle, user.id) : null;
      if (!bundle || !mine || mine.participation.role !== "guest" || mine.participation.status !== "accepted") {
        throw new DomainError("You're not booked on this plan.");
      }
      if (now >= bundle.plan.endsAt) throw new DomainError("This plan has already ended.");
      const kind: CancelKind = reason === "unsafe" ? "safety" : cancellationKind(bundle.plan.startsAt, now);
      await tx
        .update(participations)
        .set({ status: "cancelled", cancelledAt: now, cancelKind: kind, cancelReason: reason })
        .where(eq(participations.id, mine.participation.id));
      if (bundle.plan.status === "full") {
        await tx.update(plans).set({ status: "open", updatedAt: now }).where(eq(plans.id, planId));
      }
      return { bundle, kind };
    });
  },

  /** The host cancels the whole plan. */
  async cancel(planId: string, host: UserRow, reason: string, now: Date, byAdmin = false) {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const bundle = await loadBundle(tx, planId, true);
      if (!bundle || (!byAdmin && bundle.plan.hostId !== host.id)) throw new DomainError("Plan not found.", "not_found");
      if (!isActivePlan(bundle.plan)) throw new DomainError("This plan is already closed.");
      const guests = acceptedGuests(bundle);
      const hostKind: CancelKind = byAdmin
        ? "removed"
        : guests.length === 0
          ? "plan_cancelled"
          : reason === "unsafe"
            ? "safety"
            : cancellationKind(bundle.plan.startsAt, now);
      await tx
        .update(plans)
        .set({ status: "cancelled", cancelledAt: now, cancelReason: reason, removedByAdmin: byAdmin, updatedAt: now })
        .where(eq(plans.id, planId));
      await tx
        .update(participations)
        .set({ status: "cancelled", cancelledAt: now, cancelKind: hostKind, cancelReason: reason })
        .where(and(eq(participations.planId, planId), eq(participations.role, "host")));
      await tx
        .update(participations)
        .set({ status: "cancelled", cancelledAt: now, cancelKind: "plan_cancelled" })
        .where(
          and(eq(participations.planId, planId), eq(participations.role, "guest"), eq(participations.status, "accepted")),
        );
      await tx
        .update(participations)
        .set({ status: "expired", decidedAt: now })
        .where(and(eq(participations.planId, planId), eq(participations.status, "requested")));
      return {
        bundle,
        affected: bundle.members
          .filter((m) => m.participation.role === "guest" && ["accepted", "requested"].includes(m.participation.status))
          .map((m) => m.user.id),
      };
    });
  },

  async checkIn(planId: string, userId: string, now: Date) {
    const db = await getDb();
    const bundle = await loadBundle(db, planId);
    const mine = bundle ? memberOf(bundle, userId) : null;
    if (!bundle || !mine || mine.participation.status !== "accepted") throw new DomainError("You're not on this plan.");
    if (!checkInOpen(bundle.plan.startsAt, bundle.plan.endsAt, now)) {
      throw new DomainError(`Check-in opens ${RULES.checkInOpensMinutes} minutes before the start.`);
    }
    if (mine.participation.checkedInAt) return { bundle, already: true };
    await db
      .update(participations)
      .set({ checkedInAt: now })
      .where(eq(participations.id, mine.participation.id));
    return { bundle, already: false };
  },

  /** Plans the member is part of, grouped for the Activity screen. */
  async forMember(userId: string, now: Date) {
    const db = await getDb();
    const since = addMinutes(now, -30 * 24 * 60);
    const ids = await db
      .select({ planId: participations.planId })
      .from(participations)
      .innerJoin(plans, eq(plans.id, participations.planId))
      .where(and(eq(participations.userId, userId), gt(plans.endsAt, since)));
    const bundles = await loadBundles(
      db,
      ids.map((r) => r.planId),
    );
    const upcoming: PlanBundle[] = [];
    const requested: PlanBundle[] = [];
    const past: PlanBundle[] = [];
    for (const b of bundles) {
      const mine = memberOf(b, userId);
      if (!mine) continue;
      const live = isActivePlan(b.plan) && b.plan.endsAt > now;
      const status = mine.participation.status;
      if (live && status === "accepted") upcoming.push(b);
      else if (live && status === "requested") requested.push(b);
      else if (!live && (status === "accepted" || (status === "cancelled" && mine.participation.role === "host"))) {
        past.push(b);
      }
    }
    past.sort((a, b) => b.plan.startsAt.getTime() - a.plan.startsAt.getTime());
    return { upcoming, requested, past };
  },

  /** Free members who'd be allowed (and comfortable) to join this plan. */
  async freeMatches(bundle: PlanBundle, now: Date): Promise<UserRow[]> {
    const db = await getDb();
    const [candidates, hostBlocks, declines] = await Promise.all([
      AvailabilityModel.freeFor(bundle.plan.activity, now),
      BlockModel.relatedIds(bundle.host.id),
      db
        .select({ userId: participations.userId, n: sql<number>`count(*)::int` })
        .from(participations)
        .innerJoin(plans, eq(plans.id, participations.planId))
        .where(and(eq(plans.hostId, bundle.host.id), eq(participations.status, "declined")))
        .groupBy(participations.userId),
    ]);
    const declined = new Map(declines.map((d) => [d.userId, d.n]));
    const guests = acceptedGuests(bundle).map((g) => traitsOf(g.user));
    return candidates
      .map((c) => c.user)
      .filter(
        (u) =>
          u.id !== bundle.host.id &&
          !hostBlocks.has(u.id) &&
          (declined.get(u.id) ?? 0) < RULES.declinesBeforeHidden &&
          !memberOf(bundle, u.id) &&
          groupPreferenceAllows(u.groupPref, bundle.plan.capacity) &&
          isMutuallyCompatible(traitsOf(u), bundle.plan, traitsOf(bundle.host), guests),
      );
  },

  /**
   * Housekeeping, run every half minute:
   * - pending requests close once a plan has started,
   * - plans nobody joined expire,
   * - plans with companions complete when they end (feedback opens),
   * - reminders go out shortly before the start.
   */
  async sweep(now: Date) {
    const db = await getDb();
    return db.transaction(async (tx) => {
      const result = {
        expiredPlans: [] as PlanBundle[],
        completedPlans: [] as PlanBundle[],
        reminders: [] as PlanBundle[],
        expiredRequests: [] as { bundle: PlanBundle; userId: string }[],
      };
      // Only one server instance sweeps at a time (lock released at commit).
      const lock: unknown = await tx.execute(sql`select pg_try_advisory_xact_lock(${SWEEP_LOCK_KEY}) as locked`);
      const lockRows = (Array.isArray(lock) ? lock : (lock as { rows: unknown[] }).rows) as { locked?: boolean }[];
      if (!lockRows[0]?.locked) return result;
      return sweepWithin(tx, now, result);
    });
  },
};

const SWEEP_LOCK_KEY = 4_207_001;

async function sweepWithin(
  db: Executor,
  now: Date,
  result: {
    expiredPlans: PlanBundle[];
    completedPlans: PlanBundle[];
    reminders: PlanBundle[];
    expiredRequests: { bundle: PlanBundle; userId: string }[];
  },
) {
    const graceEdge = addMinutes(now, -RULES.joinGraceMinutes);
    const due = await db
      .select({ id: plans.id })
      .from(plans)
      .where(
        and(
          inArray(plans.status, [...ACTIVE]),
          or(lt(plans.startsAt, graceEdge), lte(plans.startsAt, addMinutes(now, RULES.reminderMinutes))),
        ),
      );
    const bundles = await loadBundles(
      db,
      due.map((d) => d.id),
    );
    for (const b of bundles) {
      const guests = acceptedGuests(b);
      const joinClosed = b.plan.startsAt < graceEdge;
      if (joinClosed) {
        const pending = pendingRequests(b);
        if (pending.length) {
          await db
            .update(participations)
            .set({ status: "expired", decidedAt: now })
            .where(and(eq(participations.planId, b.plan.id), eq(participations.status, "requested")));
          for (const p of pending) result.expiredRequests.push({ bundle: b, userId: p.user.id });
        }
        if (guests.length === 0) {
          await db.update(plans).set({ status: "expired", updatedAt: now }).where(eq(plans.id, b.plan.id));
          result.expiredPlans.push(b);
          continue;
        }
      }
      if (b.plan.endsAt <= now && guests.length > 0) {
        await db
          .update(plans)
          .set({ status: "completed", completedAt: now, updatedAt: now })
          .where(eq(plans.id, b.plan.id));
        result.completedPlans.push(b);
        continue;
      }
      if (!b.plan.reminderSentAt && guests.length > 0 && b.plan.startsAt > now) {
        await db.update(plans).set({ reminderSentAt: now }).where(eq(plans.id, b.plan.id));
        result.reminders.push(b);
      }
    }
    return result;
}
