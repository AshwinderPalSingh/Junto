import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/models/db/client";
import { participations, plans, sessions } from "@/models/db/schema";
import { eq } from "drizzle-orm";
import { BlockModel } from "@/models/block.model";
import { IdentityModel } from "@/models/identity.model";
import { UserModel, type User } from "@/models/user.model";
import { AvatarController } from "@/controllers/avatar.controller";
import { IdentityController } from "@/controllers/identity.controller";
import { reportMember } from "@/controllers/safety.actions";
import { idleState } from "@/lib/action";
import { closeDatabase, makeMember, useFreshDatabase } from "./helpers/db";

const state = vi.hoisted(() => ({ viewer: null as User | null, token: "test-browser-session" as string | null, cookie: "", configured: true,
  grant: vi.fn(), userInfo: vi.fn(), setCookie: vi.fn(), writeSession: vi.fn() }));
vi.mock("@/controllers/guards", () => ({ currentUser: async () => state.viewer, requireMember: async () => state.viewer }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.cookie }), set: state.setCookie }) }));
vi.mock("@/lib/session", () => ({ readSessionCookie: async () => state.token, requestIp: async () => "local",
  requestUserAgent: async () => "identity-test", writeSessionCookie: state.writeSession }));
vi.mock("@/lib/campus-oidc", () => ({ campusIdentityConfigured: () => state.configured,
  campusCallbackUrl: () => "https://junto.test/auth/campus/callback", campusOidc: async () => ({}) }));
vi.mock("openid-client", () => ({ authorizationCodeGrant: state.grant, fetchUserInfo: state.userInfo,
  randomState: () => "generated-state", randomNonce: () => "generated-nonce", randomPKCECodeVerifier: () => "generated-verifier",
  calculatePKCECodeChallenge: async () => "generated-challenge",
  buildAuthorizationUrl: (_config: unknown, params: Record<string, string>) => {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url;
  },
}));

beforeAll(async () => { await useFreshDatabase(); process.env.CAMPUS_IDENTITY_PROVIDER = "google"; });
afterAll(closeDatabase);
beforeEach(() => { state.viewer = null; state.token = "test-browser-session"; state.cookie = ""; state.configured = true;
  state.grant.mockReset(); state.userInfo.mockReset(); state.setCookie.mockReset(); state.writeSession.mockReset(); });
afterEach(() => vi.useRealTimers());

describe("private avatar authorization", () => {
  it("denies anonymous and unonboarded access to other members but preserves own onboarding preview", async () => {
    const target = await makeMember();
    expect((await AvatarController.show(target.id)).status).toBe(401);
    state.viewer = await UserModel.findOrCreate("fresh-identity@thapar.edu", "member");
    expect((await AvatarController.show(target.id)).status).toBe(404);
    await UserModel.setPhoto(state.viewer!.id, Buffer.from("preview"));
    state.viewer = await UserModel.findById(state.viewer!.id);
    const own = await AvatarController.show(state.viewer!.id);
    expect(own.status).toBe(200);
    expect(own.headers.get("cache-control")).toBe("private, no-store");
    expect(own.headers.get("vary")).toBe("Cookie");
  });
  it("rechecks bilateral blocks and suspended targets", async () => {
    const viewer = await makeMember(); const target = await makeMember(); state.viewer = viewer;
    expect((await AvatarController.show(target.id)).status).toBe(200);
    await BlockModel.block(target.id, viewer.id);
    expect((await AvatarController.show(target.id)).status).toBe(404);
    await BlockModel.unblock(target.id, viewer.id);
    await UserModel.setStatus(target.id, "suspended");
    expect((await AvatarController.show(target.id)).status).toBe(404);
  });
});

describe("no-show reports", () => {
  it("rejects outsiders and live plans while permitting completed accepted commitments", async () => {
    const host = await makeMember(); const guest = await makeMember(); const outsider = await makeMember();
    const db = await getDb();
    const [plan] = await db.insert(plans).values({ hostId: host.id, activity: "chai", spot: "main-gate", capacity: 1,
      startsAt: new Date(Date.now() - 3600_000), endsAt: new Date(Date.now() - 1800_000), allowedGenders: ["woman"], status: "completed" }).returning();
    await db.insert(participations).values([{ planId: plan.id, userId: host.id, role: "host", status: "accepted" },
      { planId: plan.id, userId: guest.id, role: "guest", status: "accepted" }]);
    const form = new FormData(); form.set("reportedId", guest.id); form.set("planId", plan.id); form.set("category", "no_show");
    state.viewer = outsider; expect((await reportMember(idleState, form)).status).toBe("error");
    state.viewer = host; expect((await reportMember(idleState, form)).status).toBe("success");
    const [live] = await db.insert(plans).values({ hostId: host.id, activity: "chai", spot: "main-gate", capacity: 1,
      startsAt: new Date(Date.now() - 1200_000), endsAt: new Date(Date.now() + 1200_000), allowedGenders: ["woman"], status: "full" }).returning();
    await db.insert(participations).values([{ planId: live.id, userId: host.id, role: "host", status: "accepted" },
      { planId: live.id, userId: guest.id, role: "guest", status: "accepted" }]);
    form.set("planId", live.id); expect((await reportMember(idleState, form)).status).toBe("error");
  });
});

describe("university identity callback", () => {
  it("rejects mismatched browser state before token exchange", async () => {
    state.viewer = await makeMember(); state.cookie = "right-state";
    const response = await IdentityController.callback(new Request("https://junto.test/auth/campus/callback?state=wrong-state&code=secret"));
    expect(response.status).toBe(400); expect(state.grant).not.toHaveBeenCalled();
  });
  it("requires PKCE, state, nonce, matching UserInfo subject and consumes the callback once", async () => {
    const member = await makeMember(); state.viewer = member; state.cookie = "bound-state";
    await IdentityModel.begin({ state: state.cookie, userId: member.id, sessionToken: state.token!, nonce: "expected-nonce", verifier: "expected-verifier", provider: "google" });
    const claims = { sub: "provider-subject", email: member.email, email_verified: true, hd: "thapar.edu", name: "University Full Name" };
    state.grant.mockResolvedValue({ access_token: "temporary-token", claims: () => claims });
    state.userInfo.mockResolvedValue(claims);
    const request = new Request("https://junto.test/auth/campus/callback?state=bound-state&code=secret");
    expect((await IdentityController.callback(request)).status).toBe(303);
    expect(state.grant).toHaveBeenCalledWith(expect.anything(), expect.any(URL), {
      pkceCodeVerifier: "expected-verifier", expectedState: "bound-state", expectedNonce: "expected-nonce", idTokenExpected: true,
    });
    expect(state.userInfo).toHaveBeenCalledWith(expect.anything(), "temporary-token", "provider-subject");
    expect((await UserModel.findById(member.id))!.verifiedFullName).toBe(claims.name);
    expect((await IdentityController.callback(request)).status).toBe(400);
    expect(state.grant).toHaveBeenCalledTimes(1);
  });
  it("does not accept another university user's profile", async () => {
    const member = await makeMember(); state.viewer = member; state.cookie = "wrong-account";
    await IdentityModel.begin({ state: state.cookie, userId: member.id, sessionToken: state.token!, nonce: "nonce", verifier: "verifier", provider: "google" });
    const claims = { sub: "other-subject", email: "other-person@thapar.edu", email_verified: true, hd: "thapar.edu", name: "Wrong Person" };
    state.grant.mockResolvedValue({ access_token: "token", claims: () => claims }); state.userInfo.mockResolvedValue(claims);
    expect((await IdentityController.callback(new Request("https://junto.test/auth/campus/callback?state=wrong-account&code=secret"))).status).toBe(400);
    expect((await UserModel.findById(member.id))!.identityVerifiedAt).toBeNull();
  });

  it("starts anonymous sign-in with a browser binding, PKCE and the Thapar domain hint", async () => {
    state.token = null;
    const response = await IdentityController.start();
    expect(response.status).toBe(303);
    const url = new URL(response.headers.get("location")!);
    expect(url.searchParams.get("hd")).toBe("thapar.edu");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.has("login_hint")).toBe(false);
    const [, cookie, options] = state.setCookie.mock.calls[0];
    expect(cookie).toMatch(/^generated-state\.[a-zA-Z0-9_-]+$/);
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/auth/campus", maxAge: 600 });
  });

  let callbackCounter = 0;
  async function anonymousCallback(claims: Record<string, unknown>, info: Record<string, unknown> = claims) {
    callbackCounter += 1;
    const flowState = `anonymous-${callbackCounter}`;
    state.viewer = null; state.token = null; state.cookie = `${flowState}.browser-secret`;
    await IdentityModel.begin({ state: flowState, userId: null, sessionToken: "browser-secret", nonce: "nonce", verifier: "verifier", provider: "google" });
    state.grant.mockResolvedValue({ access_token: "temporary-token", claims: () => claims });
    state.userInfo.mockResolvedValue(info);
    return IdentityController.callback(new Request(`https://junto.test/auth/campus/callback?state=${flowState}&code=temporary-code`));
  }

  const campusClaims = { sub: "new-google-member", email: "new-google-member@thapar.edu", email_verified: true,
    hd: "thapar.edu", name: "Complete University Name", given_name: "Complete", family_name: "University Name" };

  it("creates a named Thapar account and session directly from Google sign-in", async () => {
    const response = await anonymousCallback(campusClaims);
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/onboarding");
    const user = await UserModel.findByEmail(campusClaims.email);
    expect(user).toMatchObject({ verifiedFullName: campusClaims.name, identitySubject: campusClaims.sub, role: "member" });
    const rows = await (await getDb()).select().from(sessions).where(eq(sessions.userId, user!.id));
    expect(rows).toHaveLength(1);
    expect(state.writeSession).toHaveBeenCalledTimes(1);
  });

  it("returns an existing member to the board without replacing their preferences or password", async () => {
    const member = await makeMember();
    await UserModel.setPassword(member.id, "existing-password-hash");
    const response = await anonymousCallback({ ...campusClaims, email: member.email, sub: "existing-google-member" });
    expect(response.status).toBe(303);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/board");
    expect(await UserModel.findById(member.id)).toMatchObject({ passwordHash: "existing-password-hash",
      gender: member.gender, interests: member.interests, photoUpdatedAt: member.photoUpdatedAt });
  });

  it("rejects personal mail, other domains, lookalikes, unverified claims and mismatched profile subjects", async () => {
    for (const email of ["outside@gmail.com", "outside@other.edu", "outside@thapar.edu.evil.com", "outside@students.thapar.edu"]) {
      expect((await anonymousCallback({ ...campusClaims, email, sub: email, hd: email.split("@")[1] })).status).toBe(400);
      expect(await UserModel.findByEmail(email)).toBeNull();
    }
    for (const changes of [{ email_verified: false }, { hd: "gmail.com" }, { hd: undefined }]) {
      expect((await anonymousCallback({ ...campusClaims, ...changes, email: "bad-claims@thapar.edu" })).status).toBe(400);
    }
    expect((await anonymousCallback({ ...campusClaims, email: "bad-subject@thapar.edu" }, { ...campusClaims, sub: "someone-else" })).status).toBe(400);
    expect(state.writeSession).not.toHaveBeenCalled();
  });

  it("never substitutes UserInfo security claims for validated ID token claims", async () => {
    const claims = { ...campusClaims, email: "unverified-token@thapar.edu", sub: "unverified-token", email_verified: false };
    expect((await anonymousCallback(claims, { ...claims, email_verified: true })).status).toBe(400);
    expect(await UserModel.findByEmail(claims.email)).toBeNull();
    expect(state.writeSession).not.toHaveBeenCalled();
  });

  it("requires the initiating browser token even when an attacker knows the state", async () => {
    await IdentityModel.begin({ state: "stolen-state", userId: null, sessionToken: "real-browser", nonce: "nonce", verifier: "verifier", provider: "google" });
    state.token = null; state.cookie = "stolen-state.other-browser";
    expect((await IdentityController.callback(new Request("https://junto.test/auth/campus/callback?state=stolen-state&code=code"))).status).toBe(400);
    expect(state.grant).not.toHaveBeenCalled();
    expect(await IdentityModel.consume("stolen-state", null, "real-browser", "google")).not.toBeNull();
  });

  it("cannot use Google sign-in to bypass an account suspension", async () => {
    const member = await makeMember(); await UserModel.setStatus(member.id, "suspended");
    expect((await anonymousCallback({ ...campusClaims, email: member.email, sub: "suspended-google" })).status).toBe(400);
    expect(state.writeSession).not.toHaveBeenCalled();
    expect((await UserModel.findById(member.id))!.status).toBe("suspended");
  });
});
