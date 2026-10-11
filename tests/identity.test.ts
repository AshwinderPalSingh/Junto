import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { universityProfile } from "@/lib/campus-identity";
import { displayName, UserModel, type ProfileInput } from "@/models/user.model";
import { closeDatabase, useFreshDatabase } from "./helpers/db";

const claims = { sub: "google-stable-id", email: "102303123@thapar.edu", email_verified: true, hd: "thapar.edu",
  name: "Asha Kaur Sharma", given_name: "Asha Kaur", family_name: "Sharma" };

describe("university account profile", () => {
  it("uses the provider's complete name, not the mailbox spelling", () => {
    expect(universityProfile("google", claims, claims.email, ["thapar.edu"])).toMatchObject({
      fullName: "Asha Kaur Sharma", givenName: "Asha Kaur", familyName: "Sharma", subject: claims.sub,
    });
  });
  it("rejects other mailboxes, domains and unverified Google accounts", () => {
    for (const changes of [{ email: "other@thapar.edu" }, { email_verified: false }, { hd: "gmail.com" }, { hd: undefined }, { name: "" }, { name: "Admin\u202e" }]) {
      expect(() => universityProfile("google", { ...claims, ...changes }, claims.email, ["thapar.edu"])).toThrow();
    }
  });
  it("binds Microsoft profiles to the configured university tenant", () => {
    expect(() => universityProfile("microsoft", { ...claims, tid: "outside" }, claims.email, ["thapar.edu"], "university")).toThrow();
    expect(universityProfile("microsoft", { ...claims, tid: "university" }, claims.email, ["thapar.edu"], "university").fullName).toBe(claims.name);
  });
  beforeAll(async () => { await useFreshDatabase(); });
  afterAll(closeDatabase);
  it("never guesses names and ignores submitted name overrides", async () => {
    const user = await UserModel.findOrCreate("asha.sharma_be23@thapar.edu", "member");
    expect(user.firstName).toBeNull();
    expect(displayName(user)).toBe("Campus member");
    await UserModel.saveProfile(user.id, {
      firstName: "Impersonated", lastName: "Person", year: "faculty", branch: "Computer Science and Engineering",
      bio: null, interests: ["coding"], vibe: null,
    } as ProfileInput);
    expect(await UserModel.findById(user.id)).toMatchObject({ firstName: null, lastName: null, year: "faculty" });
    const profile = universityProfile("google", claims, claims.email, ["thapar.edu"]);
    await UserModel.setVerifiedIdentity(user.id, profile);
    expect(displayName((await UserModel.findById(user.id))!)).toBe("Asha Kaur Sharma");
    await expect(UserModel.setVerifiedIdentity(user.id, { ...profile, subject: "different-account" })).rejects.toThrow();
    const other = await UserModel.findOrCreate("other@thapar.edu", "member");
    await expect(UserModel.setVerifiedIdentity(other.id, profile)).rejects.toThrow();
  });
});
