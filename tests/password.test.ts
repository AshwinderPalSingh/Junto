import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { RULES } from "@/config/app";
import { sha256 } from "@/lib/crypto";
import { burnPasswordCheck, hashPassword, newPasswordSchema, verifyPassword } from "@/lib/password";
import { LoginCodeModel, SessionModel } from "@/models/auth.model";
import { LOGIN_LOCK, UserModel } from "@/models/user.model";
import { closeDatabase, makeMember, useFreshDatabase } from "./helpers/db";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const hash = await hashPassword("chai at five!");
    expect(hash).toMatch(/^scrypt\$\d+\$8\$3\$/);
    expect(await verifyPassword("chai at five!", hash)).toBe(true);
    expect(await verifyPassword("chai at six!", hash)).toBe(false);
    expect(await verifyPassword("chai at five!", "not-a-hash")).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });

  it("spends the same effort on unknown accounts", async () => {
    await expect(burnPasswordCheck("whatever")).resolves.toBeUndefined();
  });

  it("asks for a reasonable new password", () => {
    expect(newPasswordSchema.safeParse("short").success).toBe(false);
    expect(newPasswordSchema.safeParse("        ").success).toBe(false);
    expect(newPasswordSchema.safeParse("password123").success).toBe(false);
    expect(newPasswordSchema.safeParse("x".repeat(129)).success).toBe(false);
    expect(newPasswordSchema.safeParse("walk by the lake").success).toBe(true);
  });
});

/** Moves the clock past the resend cooldown (Date only, so the database keeps running). */
function pastCooldown() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(Date.now() + (RULES.otp.resendAfterSeconds + 1) * 1000);
}

describe("passwords in the database", () => {
  beforeAll(async () => {
    await useFreshDatabase();
  });
  afterAll(closeDatabase);
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a chosen password on the code until the inbox owner enters it", async () => {
    const email = "newbie@thapar.edu";
    const flowHash = sha256("browser-cookie");
    const passwordHash = await hashPassword("library at nine");
    const code = await LoginCodeModel.issue(email, { passwordHash, flowHash });
    const pending = await LoginCodeModel.verify(email, code);
    expect(pending).toEqual({ passwordHash, flowHash });
  });

  it("a plain sign-in code never carries a password", async () => {
    const email = "plain@thapar.edu";
    const code = await LoginCodeModel.issue(email);
    expect(await LoginCodeModel.verify(email, code)).toEqual({ passwordHash: null, flowHash: null });
  });

  it("consumes a verification code only once, including concurrent submissions", async () => {
    const email = "concurrent-code@thapar.edu";
    const code = await LoginCodeModel.issue(email);
    const results = await Promise.allSettled([LoginCodeModel.verify(email, code), LoginCodeModel.verify(email, code)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(LoginCodeModel.verify(email, code)).rejects.toThrow();
  });

  it("'resend' keeps the password only for the browser that chose it", async () => {
    const email = "resend-pw@thapar.edu";
    const flowHash = sha256("this-browser");
    const passwordHash = await hashPassword("tennis at four");

    await LoginCodeModel.issue(email, { passwordHash, flowHash });
    pastCooldown();
    const sameBrowser = await LoginCodeModel.issue(email, { carryFlowHash: flowHash });
    expect(await LoginCodeModel.verify(email, sameBrowser)).toEqual({ passwordHash, flowHash });

    pastCooldown();
    await LoginCodeModel.issue(email, { passwordHash, flowHash });
    pastCooldown();
    const otherBrowser = await LoginCodeModel.issue(email, { carryFlowHash: sha256("other-browser") });
    expect(await LoginCodeModel.verify(email, otherBrowser)).toEqual({ passwordHash: null, flowHash: null });
  });

  it("locks password sign-in after too many wrong tries", async () => {
    const member = await makeMember();
    for (let i = 1; i < LOGIN_LOCK.attempts; i += 1) {
      expect(await UserModel.recordFailedLogin(member.id)).toEqual({ locked: false });
    }
    expect(await UserModel.recordFailedLogin(member.id)).toEqual({ locked: true });
    const locked = (await UserModel.findById(member.id))!;
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    await UserModel.setPassword(member.id, await hashPassword("a fresh start"));
    const reset = (await UserModel.findById(member.id))!;
    expect(reset.lockedUntil).toBeNull();
    expect(reset.failedLogins).toBe(0);
    expect(reset.passwordHash).toMatch(/^scrypt\$/);
  });

  it("changing a password signs out every other device", async () => {
    const member = await makeMember();
    const here = await SessionModel.create(member.id, "this phone");
    const there = await SessionModel.create(member.id, "old laptop");
    await SessionModel.destroyAllExcept(member.id, here.token);
    expect(await SessionModel.findValid(here.token)).not.toBeNull();
    expect(await SessionModel.findValid(there.token)).toBeNull();
  });
});
