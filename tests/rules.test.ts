import { describe, expect, it } from "vitest";
import { groupPreferenceAllows, isMutuallyCompatible, type PersonTraits } from "@/models/rules/compatibility";
import { cancellationKind, planPhase, validatePlanStart } from "@/models/rules/plan-timing";
import { computeReputation, type MeetupRecord } from "@/models/rules/reliability";
import { campusTimeToDate, formatClock, formatDay, formatRelative, isWithinCampusHours } from "@/lib/time";

const ALL = ["woman", "man", "nonbinary"];
const person = (id: string, gender: string, companionGenders = ALL): PersonTraits => ({
  id,
  gender,
  companionGenders,
  groupPref: "both",
});

describe("mutual consent", () => {
  const plan = (allowedGenders = ALL, capacity = 1) => ({ hostId: "h", allowedGenders, capacity });

  it("matches when both sides are open to each other", () => {
    expect(isMutuallyCompatible(person("j", "man"), plan(), person("h", "woman"), [])).toBe(true);
  });

  it("respects the host's plan-level boundary", () => {
    expect(isMutuallyCompatible(person("j", "man"), plan(["woman"]), person("h", "woman"), [])).toBe(false);
  });

  it("respects the joiner's own boundary", () => {
    expect(isMutuallyCompatible(person("j", "woman", ["woman"]), plan(), person("h", "man"), [])).toBe(false);
  });

  it("requires every accepted guest to be comfortable too", () => {
    const guest = person("g", "woman", ["woman"]);
    expect(isMutuallyCompatible(person("j", "man"), plan(ALL, 3), person("h", "woman"), [guest])).toBe(false);
    expect(isMutuallyCompatible(person("j", "woman"), plan(ALL, 3), person("h", "woman"), [guest])).toBe(true);
  });

  it("requires a gender on file", () => {
    expect(isMutuallyCompatible({ ...person("j", "man"), gender: null }, plan(), person("h", "woman"), [])).toBe(false);
  });

  it("applies one-on-one / group preference", () => {
    expect(groupPreferenceAllows("one_on_one", 1)).toBe(true);
    expect(groupPreferenceAllows("one_on_one", 3)).toBe(false);
    expect(groupPreferenceAllows("group", 1)).toBe(false);
    expect(groupPreferenceAllows("both", 4)).toBe(true);
  });
});

describe("reliability", () => {
  const meetup = (over: Partial<MeetupRecord> = {}): MeetupRecord => ({
    planId: Math.random().toString(36),
    activity: "chai",
    role: "guest",
    capacity: 1,
    checkedIn: false,
    selfReport: null,
    confirmedBy: ["x"],
    reportedMissingBy: [],
    guestsAttended: 0,
    ...over,
  });

  it("hides numbers until there is a meaningful sample", () => {
    const rep = computeReputation([meetup(), meetup()], []);
    expect(rep.showUpRate).toBeNull();
    expect(rep.level).toBe("new");
    expect(rep.summary).toBe("New here · 2 meetups so far");
  });

  it("shows a show-up record once there are enough meetups", () => {
    const rep = computeReputation(Array.from({ length: 6 }, () => meetup()), []);
    expect(rep.summary).toBe("Showed up to 6 of 6 meetups");
    expect(rep.badges).toContain("reliable");
  });

  it("lets a mutual 'we met' beat a no-show report", () => {
    const rep = computeReputation([meetup({ confirmedBy: ["a"], reportedMissingBy: ["b"] })], []);
    expect(rep.attended).toBe(1);
    expect(rep.noShows).toBe(0);
  });

  it("ignores a single person's no-show reports until a second reporter agrees", () => {
    const one = computeReputation(
      [meetup({ confirmedBy: [], reportedMissingBy: ["a"] }), meetup({ confirmedBy: [], reportedMissingBy: ["a"] })],
      [],
    );
    expect(one.noShows).toBe(0);
    expect(one.pendingReports).toBe(2);
    const two = computeReputation(
      [meetup({ confirmedBy: [], reportedMissingBy: ["a"] }), meetup({ confirmedBy: [], reportedMissingBy: ["b"] })],
      [],
    );
    expect(two.noShows).toBe(2);
  });

  it("never penalises safety cancellations and rewards early notice", () => {
    const rep = computeReputation([meetup()], [{ kind: "early" }, { kind: "safety" }]);
    expect(rep.lateCancels).toBe(0);
    expect(rep.badges).toContain("communicator");
    const late = computeReputation([meetup()], [{ kind: "late" }]);
    expect(late.badges).not.toContain("communicator");
  });

  it("awards explorer for four different activities", () => {
    const rep = computeReputation(
      ["chai", "walk", "games", "study"].map((activity) => meetup({ activity })),
      [],
    );
    expect(rep.badges).toContain("explorer");
  });
});

describe("plan timing", () => {
  const morning = campusTimeToDate(new Date("2026-10-12T00:00:00Z"), 0, "10:00");

  it("formats campus time", () => {
    expect(formatClock(morning)).toBe("10:00 am");
    expect(formatDay(morning, morning)).toBe("Today");
    expect(formatRelative(new Date(morning.getTime() + 12 * 60_000), morning)).toBe("in 12 min");
    expect(formatRelative(new Date(morning.getTime() - 90 * 60_000), morning)).toBe("1 h 30 min ago");
  });

  it("enforces campus hours and the horizon", () => {
    const night = campusTimeToDate(morning, 0, "23:30");
    expect(isWithinCampusHours(night)).toBe(false);
    expect(validatePlanStart(night, morning)).toMatch(/between/);
    expect(validatePlanStart(new Date(morning.getTime() + 30 * 60_000), morning)).toBeNull();
    expect(validatePlanStart(new Date(morning.getTime() - 60 * 60_000), morning)).toMatch(/passed/);
  });

  it("classifies phases and cancellations", () => {
    const start = new Date(morning.getTime() + 30 * 60_000);
    const end = new Date(start.getTime() + 30 * 60_000);
    expect(planPhase(start, end, morning)).toBe("soon");
    expect(planPhase(start, end, new Date(start.getTime() + 60_000))).toBe("live");
    expect(cancellationKind(start, morning)).toBe("late");
    expect(cancellationKind(new Date(morning.getTime() + 3 * 3_600_000), morning)).toBe("early");
  });
});
