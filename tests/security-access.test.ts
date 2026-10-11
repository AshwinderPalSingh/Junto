import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/models/db/client";
import { participations, plans } from "@/models/db/schema";
import { BlockModel } from "@/models/block.model";
import { IdentityModel } from "@/models/identity.model";
import { UserModel, type User } from "@/models/user.model";
import { AvatarController } from "@/controllers/avatar.controller";
import { IdentityController } from "@/controllers/identity.controller";
import { reportMember } from "@/controllers/safety.actions";
import { idleState } from "@/lib/action";
import { closeDatabase, makeMember, useFreshDatabase } from "./helpers/db";

const state = vi.hoisted(() => ({ viewer: null as User | null, token: "test-browser-session", cookie: "", configured: true,
  grant: vi.fn(), userInfo: vi.fn() }));
vi.mock("@/controllers/guards", () => ({ currentUser: async () => state.viewer, requireMember: async () => state.viewer }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.cookie }), set: vi.fn() }) }));
vi.mock("@/lib/session", () => ({ readSessionCookie: async () => state.token }));
vi.mock("@/lib/campus-oidc", () => ({ campusIdentityConfigured: () => state.configured,
  campusCallbackUrl: () => "https://junto.test/auth/campus/callback", campusOidc: async () => ({}) }));
vi.mock("openid-client", () => ({ authorizationCodeGrant: state.grant, fetchUserInfo: state.userInfo }));

beforeAll(async () => { await useFreshDatabase(); process.env.CAMPUS_IDENTITY_PROVIDER = "google"; });
afterAll(closeDatabase);
beforeEach(() => { state.viewer = null; state.cookie = ""; state.configured = true; state.grant.mockReset(); state.userInfo.mockReset(); });
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
    await IdentityModel.begin({ state: state.cookie, userId: member.id, sessionToken: state.token, nonce: "expected-nonce", verifier: "expected-verifier", provider: "google" });
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
    await IdentityModel.begin({ state: state.cookie, userId: member.id, sessionToken: state.token, nonce: "nonce", verifier: "verifier", provider: "google" });
    const claims = { sub: "other-subject", email: "other-person@thapar.edu", email_verified: true, hd: "thapar.edu", name: "Wrong Person" };
    state.grant.mockResolvedValue({ access_token: "token", claims: () => claims }); state.userInfo.mockResolvedValue(claims);
    expect((await IdentityController.callback(new Request("https://junto.test/auth/campus/callback?state=wrong-account&code=secret"))).status).toBe(400);
    expect((await UserModel.findById(member.id))!.identityVerifiedAt).toBeNull();
  });
});
