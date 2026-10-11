import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { RULES } from "@/config/app";
import { getDb } from "@/models/db/client";
import { availability, notifications, participations, plans, users } from "@/models/db/schema";
import { FeedbackModel } from "@/models/feedback.model";
import { ReportModel } from "@/models/report.model";
import { ReputationModel } from "@/models/reputation.model";
import { computeReputation, ratingRestriction, type MeetupRecord } from "@/models/rules/reliability";
import { closeDatabase, makeMember, useFreshDatabase } from "./helpers/db";

const now = new Date("2026-10-12T12:00:00Z");
const meetup = (id: string, missed = false): MeetupRecord => ({
  planId: id, activity: "chai", role: "guest", capacity: 1, checkedIn: false,
  selfReport: missed ? "missed" : "attended", confirmedBy: [], reportedMissingBy: [], guestsAttended: 0,
});

describe("five-point ratings and pauses", () => {
  it("waits for three outcomes and excludes declines, early and safety cancellations", () => {
    expect(computeReputation([meetup("a"), meetup("b")], []).rating).toBeNull();
    const rep = computeReputation([meetup("a"), meetup("b"), meetup("c")], [{ kind: "early" }, { kind: "safety" }], { acceptedPlans: 5, declinedRequests: 12 });
    expect(rep.rating).toBe(5);
    expect(rep.declinedRequests).toBe(12);
  });
  it("weights a late cancellation less than a no-show", () => {
    expect(computeReputation([meetup("a"), meetup("b")], [{ id: "late", kind: "late" }]).rating).toBe(4);
    expect(computeReputation([meetup("a"), meetup("b"), meetup("c", true)], []).rating).toBe(3.3);
  });
  it("ends after 48 hours and does not renew for the same incidents", () => {
    const rep = computeReputation([meetup("a"), meetup("b", true), meetup("c", true)], []);
    const first = ratingRestriction(rep, { until: null, reviewed: [] }, now);
    expect(first.until!.getTime() - now.getTime()).toBe(RULES.ratingRestrictionHours * 3_600_000);
    expect(ratingRestriction(rep, first, new Date(now.getTime() + 3_600_000)).until).toEqual(first.until);
    expect(ratingRestriction(rep, first, new Date(first.until!.getTime() + 1)).until).toBeNull();
    const worse = computeReputation([meetup("a"), meetup("b", true), meetup("c", true), meetup("d", true)], []);
    expect(ratingRestriction(worse, first, new Date(first.until!.getTime() + 1)).until).not.toBeNull();
  });
});

describe("ratings with database-backed attendance", () => {
  beforeAll(async () => { await useFreshDatabase(); });
  afterAll(closeDatabase);
  it("keeps a single report pending, supports moderator confirmation and lifts a mistaken pause", async () => {
    const host = await makeMember();
    const guest = await makeMember();
    const db = await getDb();
    for (let i = 0; i < 3; i += 1) {
      const [plan] = await db.insert(plans).values({ hostId: host.id, activity: "chai", spot: "main-gate", startsAt: new Date(now.getTime() - 2 * 3_600_000), endsAt: new Date(now.getTime() - 3_600_000), capacity: 1, allowedGenders: ["woman"], status: "completed" }).returning();
      await db.insert(participations).values([
        { planId: plan.id, userId: host.id, role: "host", status: "accepted" },
        { planId: plan.id, userId: guest.id, role: "guest", status: "accepted" },
      ]);
      await FeedbackModel.submit(plan.id, host.id, true, [{ rateeId: guest.id, showedUp: false, wouldMeetAgain: null, flags: [] }], now);
    }
    expect(await ReputationModel.forUser(guest.id)).toMatchObject({ noShows: 0, pendingReports: 3, rating: null });
    const reports = (await ReportModel.list("open")).filter((r) => r.report.reportedId === guest.id);
    expect(reports).toHaveLength(3);
    for (const r of reports) await ReportModel.close(r.report.id, host.id, "resolved", "Confirmed");
    expect(await ReputationModel.forUser(guest.id)).toMatchObject({ noShows: 3, rating: 0 });
    const until = await ReputationModel.assessRestriction(guest.id, now);
    expect(until).not.toBeNull();
    expect((await db.select().from(users).where(eq(users.id, guest.id)))[0].ratingRestrictedUntil).toEqual(until);
    expect(await ReputationModel.assessRestriction(guest.id, new Date(until!.getTime() + 1))).toBeNull();
    for (const r of reports) await ReportModel.close(r.report.id, host.id, "dismissed", "Mistaken report");
    expect(await ReputationModel.forUser(guest.id)).toMatchObject({ noShows: 0, pendingReports: 0 });
    expect(await ReputationModel.assessRestriction(guest.id, now)).toBeNull();
  });
  it("does not accept feedback from outsiders or against a cancelled guest", async () => {
    const host = await makeMember(); const guest = await makeMember(); const outsider = await makeMember();
    const db = await getDb();
    const [plan] = await db.insert(plans).values({ hostId: host.id, activity: "chai", spot: "main-gate", startsAt: new Date(now.getTime() - 2 * 3_600_000), endsAt: new Date(now.getTime() - 3_600_000), capacity: 1, allowedGenders: ["woman"], status: "completed" }).returning();
    await db.insert(participations).values([{ planId: plan.id, userId: host.id, role: "host", status: "accepted" }, { planId: plan.id, userId: guest.id, role: "guest", status: "cancelled", cancelKind: "early" }]);
    await expect(FeedbackModel.submit(plan.id, outsider.id, true, [], now)).rejects.toThrow("weren't booked");
    await FeedbackModel.submit(plan.id, host.id, true, [{ rateeId: guest.id, showedUp: false, wouldMeetAgain: null, flags: [] }], now);
    expect(await ReputationModel.forUser(guest.id)).toMatchObject({ noShows: 0, earlyCancels: 1 });
  });
  it("releases future commitments, reopens guest spots and notifies companions once", async () => {
    const paused = await makeMember(); const companion = await makeMember();
    const db = await getDb();
    for (let i = 0; i < 3; i += 1) {
      const [past] = await db.insert(plans).values({ hostId: companion.id, activity: "chai", spot: "main-gate", startsAt: new Date(now.getTime() - 2 * 3_600_000), endsAt: new Date(now.getTime() - 3_600_000), capacity: 1, allowedGenders: ["woman"], status: "completed" }).returning();
      await db.insert(participations).values({ planId: past.id, userId: paused.id, role: "guest", status: "accepted", selfReport: "missed" });
    }
    const future = { activity: "chai", spot: "main-gate", startsAt: new Date(now.getTime() + 3_600_000), endsAt: new Date(now.getTime() + 2 * 3_600_000), capacity: 1, allowedGenders: ["woman"] };
    const [hosted] = await db.insert(plans).values({ ...future, hostId: paused.id, status: "full" }).returning();
    const [joined] = await db.insert(plans).values({ ...future, hostId: companion.id, status: "full" }).returning();
    await db.insert(participations).values([
      { planId: hosted.id, userId: paused.id, role: "host", status: "accepted" },
      { planId: hosted.id, userId: companion.id, role: "guest", status: "accepted" },
      { planId: joined.id, userId: companion.id, role: "host", status: "accepted" },
      { planId: joined.id, userId: paused.id, role: "guest", status: "accepted" },
    ]);
    await db.insert(availability).values({ userId: paused.id, until: future.endsAt });
    expect(await ReputationModel.assessRestriction(paused.id, now)).not.toBeNull();
    expect((await db.select().from(plans).where(eq(plans.id, hosted.id)))[0].status).toBe("cancelled");
    expect((await db.select().from(plans).where(eq(plans.id, joined.id)))[0].status).toBe("open");
    const commitments = await db.select().from(participations).where(eq(participations.userId, paused.id));
    expect(commitments.find(p => p.planId === hosted.id)).toMatchObject({ status: "cancelled", cancelKind: "plan_cancelled" });
    expect(commitments.find(p => p.planId === joined.id)).toMatchObject({ status: "cancelled", cancelKind: "removed" });
    expect(await db.select().from(availability).where(eq(availability.userId, paused.id))).toHaveLength(0);
    expect(await ReputationModel.forUser(paused.id)).toMatchObject({ noShows: 3, lateCancels: 0, ratingSample: 3 });
    expect(await db.select().from(notifications).where(eq(notifications.userId, companion.id))).toHaveLength(2);
    await ReputationModel.assessRestriction(paused.id, now);
    expect(await db.select().from(notifications).where(eq(notifications.userId, companion.id))).toHaveLength(2);
  });
});
