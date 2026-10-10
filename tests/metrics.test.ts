import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMinutes, campusTimeToDate } from "@/lib/time";
import { MetricsModel } from "@/models/metrics.model";
import { PlanModel } from "@/models/plan.model";
import { UserModel } from "@/models/user.model";
import { closeDatabase, makeMember, useFreshDatabase } from "./helpers/db";

// 10:00 campus time today keeps the plan inside campus hours.
const NOW = campusTimeToDate(new Date(), 0, "10:00");

describe("moderator dashboard metrics", () => {
  beforeAll(async () => {
    await useFreshDatabase();
  });
  afterAll(closeDatabase);

  it("counts real members, recent activity and open plans", async () => {
    const host = await makeMember({ gender: "woman" });
    await makeMember({ gender: "man" });
    await UserModel.touch(host.id);
    // Signed in but never finished setup: not a member yet, so not counted anywhere.
    const visitor = await UserModel.findOrCreate("visitor@thapar.edu", "member");
    await UserModel.touch(visitor.id);
    await PlanModel.create(
      host,
      {
        activity: "walk",
        spot: "cafeteria",
        note: null,
        startsAt: addMinutes(NOW, 45),
        durationMinutes: 30,
        capacity: 2,
        allowedGenders: ["woman", "man", "nonbinary"],
      },
      NOW,
    );

    const m = await MetricsModel.dashboard(NOW);
    expect(m.members).toBe(2);
    expect(m.active7).toBe(1);
    expect(m.openNow).toBe(1);
    expect(m.days).toHaveLength(14);
    expect(m.byActivity.find((a) => a.id === "walk")?.count).toBe(1);
  });
});
