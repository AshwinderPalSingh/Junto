import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { campusIdentity } from "@/lib/campus-identity";
import { UserModel, type ProfileInput } from "@/models/user.model";
import { closeDatabase, useFreshDatabase } from "./helpers/db";

describe("campus email identity", () => {
  it("handles separators, enrolment suffixes and numbered mailboxes", () => {
    expect(campusIdentity("Asha.Sharma_be23@thapar.edu")).toEqual({ firstName: "Asha", lastName: "Sharma" });
    expect(campusIdentity("ravi_kumar123@thapar.edu")).toEqual({ firstName: "Ravi", lastName: "Kumar" });
    expect(campusIdentity("priya@thapar.edu")).toEqual({ firstName: "Priya", lastName: null });
    expect(campusIdentity("102303123@thapar.edu")).toEqual({ firstName: "Campus member", lastName: null });
  });
  beforeAll(async () => { await useFreshDatabase(); });
  afterAll(closeDatabase);
  it("creates a named account without asking for a name and ignores submitted name overrides", async () => {
    const user = await UserModel.findOrCreate("asha.sharma_be23@thapar.edu", "member");
    expect(user.firstName).toBe("Asha");
    await UserModel.saveProfile(user.id, {
      firstName: "Impersonated", lastName: "Person", year: "faculty", branch: "Computer Science and Engineering",
      bio: null, interests: ["coding"], vibe: null,
    } as ProfileInput);
    expect(await UserModel.findById(user.id)).toMatchObject({ firstName: "Asha", lastName: "Sharma", year: "faculty" });
  });
});
