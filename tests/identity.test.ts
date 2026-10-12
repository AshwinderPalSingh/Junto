import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isCampusEmail, universityProfile, universitySignInProfile } from "@/lib/campus-identity";
import { allowedEmailDomains } from "@/lib/env";
import { IdentityModel } from "@/models/identity.model";
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
  it("enforces the exact Thapar domain even if configuration tries to broaden it", () => {
    process.env.ALLOWED_EMAIL_DOMAINS = "thapar.edu,gmail.com";
    expect(allowedEmailDomains()).toEqual(["thapar.edu"]);
    expect(isCampusEmail("member@THAPAR.EDU")).toBe(true);
    for (const email of ["member@gmail.com", "member@students.thapar.edu", "member@thapar.edu.evil.com", "member@thapar.edu@evil.com"]) {
      expect(isCampusEmail(email)).toBe(false);
      expect(() => universitySignInProfile("google", { ...claims, email, hd: email.split("@")[1] })).toThrow();
    }
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
  it("prevents replacing a provider subject or reusing it on another campus account", async () => {
    const profile = universitySignInProfile("google", { ...claims, email: "atomic-google@thapar.edu", sub: "atomic-google" });
    const user = await UserModel.signInWithIdentity(profile.email, profile, "admin");
    const same = await UserModel.signInWithIdentity(profile.email, { ...profile, fullName: "Updated University Name" }, "member");
    expect(same.id).toBe(user.id);
    expect(same.role).toBe("admin");
    await expect(UserModel.signInWithIdentity(profile.email, { ...profile, subject: "replaced-subject" }, "member")).rejects.toThrow();
    await expect(UserModel.signInWithIdentity("different-google@thapar.edu", profile, "member")).rejects.toThrow();
    expect(await UserModel.findByEmail("different-google@thapar.edu")).toBeNull();
    await expect(UserModel.findOrCreate("outside@gmail.com", "member")).rejects.toThrow();
    await expect(UserModel.signInWithIdentity("outside@gmail.com", profile, "member")).rejects.toThrow();
  });
  it("binds anonymous flows to one browser and consumes concurrent callbacks only once", async () => {
    await IdentityModel.begin({ state: "single-use", userId: null, sessionToken: "browser", verifier: "verifier", nonce: "nonce", provider: "google" });
    expect(await IdentityModel.consume("single-use", null, "other-browser", "google")).toBeNull();
    expect(await IdentityModel.consume("single-use", null, "browser", "microsoft")).toBeNull();
    const attempts = await Promise.all([IdentityModel.consume("single-use", null, "browser", "google"), IdentityModel.consume("single-use", null, "browser", "google")]);
    expect(attempts.filter(Boolean)).toHaveLength(1);
  });
});
