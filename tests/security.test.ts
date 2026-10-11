import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { contentSecurityPolicy } from "@/lib/content-security-policy";
import { hashPassword, verifyPassword } from "@/lib/password";
import { safePushEndpoint, safePushKeys } from "@/lib/push-validation";
import { rateLimit } from "@/lib/rate-limit";
import { LoginCodeModel, SessionModel } from "@/models/auth.model";
import { IdentityModel } from "@/models/identity.model";
import { getDb } from "@/models/db/client";
import { rateLimits, users } from "@/models/db/schema";
import { UserModel } from "@/models/user.model";
import { closeDatabase, makeMember, useFreshDatabase } from "./helpers/db";

beforeAll(async () => { await useFreshDatabase(); });
afterAll(closeDatabase);
afterEach(() => vi.useRealTimers());

describe("outbound notification safety", () => {
  it("allows known browser push services only", () => {
    for (const url of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/token", "https://web.push.apple.com/token", "https://wns2-bn1p.notify.windows.com/token"]) {
      expect(safePushEndpoint(url)).toBe(true);
    }
    for (const url of ["http://fcm.googleapis.com/a", "https://127.0.0.1/a", "https://[::1]/a", "https://169.254.169.254/latest/meta-data", "https://fcm.googleapis.com.attacker.test/a", "https://fcm.googleapis.com@attacker.test/a", "https://fcm.googleapis.com:8443/a", "https://localhost/a", "file:///etc/passwd", "https://attacker.test/fcm.googleapis.com"]) {
      expect(safePushEndpoint(url)).toBe(false);
    }
  });
  it("rejects malformed encryption keys", () => {
    const key = Buffer.alloc(65, 1); key[0] = 4;
    expect(safePushKeys(key.toString("base64url"), Buffer.alloc(16).toString("base64url"))).toBe(true);
    expect(safePushKeys(Buffer.alloc(65).toString("base64url"), Buffer.alloc(16).toString("base64url"))).toBe(false);
    expect(safePushKeys("not-a-key", "bad")).toBe(false);
  });
});

describe("shared authentication controls", () => {
  it("enforces concurrent requests atomically and stores no raw emails/IPs", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit("security:test@thapar.edu", 5, 60_000)));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    const db = await getDb();
    const rows = await db.select().from(rateLimits);
    expect(rows.every((r) => /^[a-f0-9]{64}$/.test(r.keyHash))).toBe(true);
    expect((await rateLimit("independent", 1, 60_000)).ok).toBe(true);
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(Date.now() + 60_001);
    expect((await rateLimit("security:test@thapar.edu", 5, 60_000)).ok).toBe(true);
  });
  it("issues only one code under concurrent issuance", async () => {
    const results = await Promise.allSettled([LoginCodeModel.issue("racing@thapar.edu"), LoginCodeModel.issue("racing@thapar.edu")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("a failed old email send does not discard a newer code", async () => {
    const email = "slow-send@thapar.edu";
    const old = await LoginCodeModel.issue(email);
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(Date.now() + 31_000);
    const fresh = await LoginCodeModel.issue(email);
    await LoginCodeModel.discardUnused(email, old);
    await expect(LoginCodeModel.verify(email, fresh)).resolves.toBeDefined();
  });
  it("retains password lockout under concurrent failures and resets its budget after expiry", async () => {
    const member = await makeMember();
    await Promise.all(Array.from({ length: 12 }, () => UserModel.recordFailedLogin(member.id)));
    const locked = (await UserModel.findById(member.id))!;
    expect(locked.failedLogins).toBe(5);
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(locked.lockedUntil!.getTime() + 1);
    expect(await UserModel.recordFailedLogin(member.id)).toEqual({ locked: false });
    expect((await UserModel.findById(member.id))!.failedLogins).toBe(1);
  });
  it("rejects empty/malformed hashes and attacker-controlled expensive parameters", async () => {
    const hash = await hashPassword("test password");
    const parts = hash.split("$");
    for (const changes of [{ 5: "!!!" }, { 5: "A" }, { 4: "invalid" }, { 1: "1073741824" }, { 2: "9999999" }, { 1: "1023" }]) {
      const bad = [...parts]; Object.assign(bad, changes);
      expect(await verifyPassword("anything", bad.join("$"))).toBe(false);
    }
  });
  it("binds provider handshakes to account/session and consumes them once", async () => {
    const member = await makeMember();
    const flow = { state: "random-state", userId: member.id, sessionToken: "browser-one", verifier: "pkce-secret", nonce: "id-token-nonce", provider: "google" };
    await IdentityModel.begin(flow);
    expect(await IdentityModel.consume(flow.state, member.id, "browser-two", "google")).toBeNull();
    expect(await IdentityModel.consume(flow.state, member.id, flow.sessionToken, "microsoft")).toBeNull();
    const results = await Promise.all([IdentityModel.consume(flow.state, member.id, flow.sessionToken, "google"), IdentityModel.consume(flow.state, member.id, flow.sessionToken, "google")]);
    expect(results.filter(Boolean)).toHaveLength(1);
    await IdentityModel.begin({ ...flow, state: "expired-state" });
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(Date.now() + 600_001);
    expect(await IdentityModel.consume("expired-state", member.id, flow.sessionToken, "google")).toBeNull();
  });
  it("wipes credentials and profile identity on deletion", async () => {
    const member = await makeMember();
    await UserModel.setPassword(member.id, await hashPassword("private credential"));
    await UserModel.setVerifiedIdentity(member.id, { provider: "google", subject: "deleted-subject", fullName: "Full University Name", givenName: "Full", familyName: "Name" });
    await UserModel.anonymize(member.id);
    expect(await UserModel.findById(member.id)).toMatchObject({ status: "deleted", passwordHash: null, verifiedFullName: null, identitySubject: null, gender: null, companionGenders: [] });
  });
  it("changes a password once and revokes other devices atomically", async () => {
    const member = await makeMember();
    const current = await hashPassword("current password"); await UserModel.setPassword(member.id, current);
    const here = await SessionModel.create(member.id, "here"); const there = await SessionModel.create(member.id, "there");
    const next = await hashPassword("new password");
    const results = await Promise.allSettled([UserModel.changePassword(member.id, current, next, here.token), UserModel.changePassword(member.id, current, next, here.token)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await SessionModel.findValid(here.token)).not.toBeNull(); expect(await SessionModel.findValid(there.token)).toBeNull();
  });
});

it("production CSP does not allow arbitrary inline scripts or eval", () => {
  const script = contentSecurityPolicy("random-nonce").split("; ").find((d) => d.startsWith("script-src"))!;
  expect(script).toContain("'nonce-random-nonce'");
  expect(script).toContain("'strict-dynamic'");
  expect(script).not.toContain("unsafe-inline");
  expect(script).not.toContain("unsafe-eval");
});
