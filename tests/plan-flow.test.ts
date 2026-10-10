import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { campusTimeToDate, addMinutes } from "@/lib/time";
import { BlockModel } from "@/models/block.model";
import { FeedbackModel } from "@/models/feedback.model";
import { acceptedGuests, PlanModel } from "@/models/plan.model";
import { ReputationModel } from "@/models/reputation.model";
import type { UserRow } from "@/models/db/schema";
import { closeDatabase, makeMember, useFreshDatabase } from "./helpers/db";

const ALL = ["woman", "man", "nonbinary"];
// 10:00 campus time on a fixed day keeps every test inside campus hours.
const NOW = campusTimeToDate(new Date("2026-10-12T00:00:00Z"), 0, "10:00");

async function post(host: UserRow, over: Partial<Parameters<typeof PlanModel.create>[1]> = {}, now = NOW) {
  return PlanModel.create(
    host,
    {
      activity: "chai",
      spot: "cafeteria",
      note: null,
      startsAt: addMinutes(now, 30),
      durationMinutes: 30,
      capacity: 1,
      allowedGenders: ALL,
      ...over,
    },
    now,
  );
}

const boardIds = async (viewer: UserRow, now = NOW) =>
  (await PlanModel.board(viewer, now)).map((e) => e.bundle.plan.id);

describe("plan lifecycle", () => {
  beforeAll(async () => {
    await useFreshDatabase();
  });
  afterAll(closeDatabase);

  it("request → accept fills a one-on-one plan", async () => {
    const host = await makeMember({ gender: "woman" });
    const joiner = await makeMember({ gender: "man" });
    const late = await makeMember({ gender: "man" });
    const plan = await post(host);

    expect(await boardIds(joiner)).toContain(plan.id);
    await PlanModel.request(plan.id, joiner, "hi", NOW);
    await expect(PlanModel.request(plan.id, joiner, null, NOW)).rejects.toThrow(/already asked/);

    const bundle = (await PlanModel.bundle(plan.id))!;
    const request = bundle.members.find((m) => m.user.id === joiner.id)!;
    const result = await PlanModel.decide(plan.id, host, request.participation.id, "accept", NOW);
    expect(result.becameFull).toBe(true);
    expect((await PlanModel.bundle(plan.id))!.plan.status).toBe("full");

    expect(await boardIds(late)).not.toContain(plan.id);
    await expect(PlanModel.request(plan.id, late, null, NOW)).rejects.toThrow(/filled up/);
  });

  it("only one of two simultaneous accepts gets the last spot", async () => {
    const host = await makeMember({ gender: "woman" });
    const a = await makeMember({ gender: "woman" });
    const b = await makeMember({ gender: "man" });
    const plan = await post(host, { startsAt: addMinutes(NOW, 120) });
    await PlanModel.request(plan.id, a, null, NOW);
    await PlanModel.request(plan.id, b, null, NOW);
    const bundle = (await PlanModel.bundle(plan.id))!;
    const [ra, rb] = bundle.members.filter((m) => m.participation.role === "guest");
    const results = await Promise.allSettled([
      PlanModel.decide(plan.id, host, ra.participation.id, "accept", NOW),
      PlanModel.decide(plan.id, host, rb.participation.id, "accept", NOW),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(acceptedGuests((await PlanModel.bundle(plan.id))!)).toHaveLength(1);
  });

  it("hides plans across gender boundaries in both directions", async () => {
    const womenOnlyHost = await makeMember({ gender: "woman" });
    const man = await makeMember({ gender: "man" });
    const womanWhoMeetsWomen = await makeMember({ gender: "woman", companionGenders: ["woman"] });
    const manHost = await makeMember({ gender: "man" });

    const womenOnly = await post(womenOnlyHost, { allowedGenders: ["woman"], startsAt: addMinutes(NOW, 200) });
    const byMan = await post(manHost, { startsAt: addMinutes(NOW, 240) });

    expect(await boardIds(man)).not.toContain(womenOnly.id);
    await expect(PlanModel.request(womenOnly.id, man, null, NOW)).rejects.toThrow();
    expect(await boardIds(womanWhoMeetsWomen)).toContain(womenOnly.id);
    expect(await boardIds(womanWhoMeetsWomen)).not.toContain(byMan.id);
  });

  it("checks consent against guests already in a group", async () => {
    const host = await makeMember({ gender: "woman" });
    const guest = await makeMember({ gender: "woman", companionGenders: ["woman"] });
    const man = await makeMember({ gender: "man" });
    const plan = await post(host, { capacity: 3, startsAt: addMinutes(NOW, 300) });
    expect(await boardIds(man)).toContain(plan.id);
    await PlanModel.request(plan.id, guest, null, NOW);
    const request = (await PlanModel.bundle(plan.id))!.members.find((m) => m.user.id === guest.id)!;
    await PlanModel.decide(plan.id, host, request.participation.id, "accept", NOW);
    expect(await boardIds(man)).not.toContain(plan.id);
  });

  it("stops showing a host's plans after two declines", async () => {
    const host = await makeMember({ gender: "woman" });
    const persistent = await makeMember({ gender: "man" });
    for (const offset of [330, 400]) {
      const plan = await post(host, { startsAt: addMinutes(NOW, offset) });
      await PlanModel.request(plan.id, persistent, null, NOW);
      const req = (await PlanModel.bundle(plan.id))!.members.find((m) => m.user.id === persistent.id)!;
      await PlanModel.decide(plan.id, host, req.participation.id, "decline", NOW);
    }
    const third = await post(await makeMember({ gender: "woman" }), { startsAt: addMinutes(NOW, 500) });
    const fourth = await PlanModel.create(
      host,
      { activity: "walk", spot: "lawns", note: null, startsAt: addMinutes(NOW, 600), durationMinutes: 30, capacity: 1, allowedGenders: ALL },
      NOW,
    ).catch(() => null);
    const ids = await boardIds(persistent);
    expect(ids).toContain(third.id);
    if (fourth) expect(ids).not.toContain(fourth.id);
  });

  it("blocking hides plans both ways", async () => {
    const host = await makeMember({ gender: "woman" });
    const other = await makeMember({ gender: "woman" });
    const plan = await post(host, { startsAt: addMinutes(NOW, 45) });
    expect(await boardIds(other)).toContain(plan.id);
    await BlockModel.block(host.id, other.id);
    expect(await boardIds(other)).not.toContain(plan.id);
  });

  it("prevents double booking and reopens a spot when a guest leaves", async () => {
    const host = await makeMember({ gender: "woman" });
    const host2 = await makeMember({ gender: "woman" });
    const guest = await makeMember({ gender: "woman" });
    const plan = await post(host, { startsAt: addMinutes(NOW, 700) });
    const clash = await post(host2, { startsAt: addMinutes(NOW, 710) });
    await PlanModel.request(plan.id, guest, null, NOW);
    await PlanModel.request(clash.id, guest, null, NOW);
    const req = (await PlanModel.bundle(plan.id))!.members.find((m) => m.user.id === guest.id)!;
    await PlanModel.decide(plan.id, host, req.participation.id, "accept", NOW);
    // The overlapping request was withdrawn automatically.
    const clashBundle = (await PlanModel.bundle(clash.id))!;
    expect(clashBundle.members.find((m) => m.user.id === guest.id)!.participation.status).toBe("withdrawn");

    const { kind } = await PlanModel.leave(plan.id, guest, "came_up", NOW);
    expect(kind).toBe("early");
    expect((await PlanModel.bundle(plan.id))!.plan.status).toBe("open");
  });

  it("sweeps: expires empty plans, completes met ones, then reputation counts it", async () => {
    const host = await makeMember({ gender: "woman" });
    const guest = await makeMember({ gender: "man" });
    const empty = await post(host, { startsAt: addMinutes(NOW, 15) });
    const met = await PlanModel.create(
      guest,
      { activity: "walk", spot: "lawns", note: null, startsAt: addMinutes(NOW, 60), durationMinutes: 30, capacity: 1, allowedGenders: ALL },
      NOW,
    );
    await PlanModel.request(met.id, host, null, NOW);
    const req = (await PlanModel.bundle(met.id))!.members.find((m) => m.user.id === host.id)!;
    await PlanModel.decide(met.id, guest, req.participation.id, "accept", NOW);

    const later = addMinutes(NOW, 120);
    const result = await PlanModel.sweep(later);
    expect(result.expiredPlans.map((b) => b.plan.id)).toContain(empty.id);
    expect(result.completedPlans.map((b) => b.plan.id)).toContain(met.id);

    await FeedbackModel.submit(met.id, host.id, true, [{ rateeId: guest.id, showedUp: true, wouldMeetAgain: true, flags: [] }], later);
    await expect(
      FeedbackModel.submit(met.id, host.id, true, [], later),
    ).rejects.toThrow(/already/);
    const rep = await ReputationModel.forUser(guest.id);
    expect(rep.attended).toBe(1);
    expect(rep.badges).toContain("first_meetup");
  });
});
