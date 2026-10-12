import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signInWithPassword, requestCode, resendCode, startPasswordFlow, verifyCode } from "@/controllers/auth.actions";
import { idleState } from "@/lib/action";
import { hashPassword } from "@/lib/password";
import { LoginCodeModel } from "@/models/auth.model";
import { UserModel } from "@/models/user.model";
import { SessionModel } from "@/models/auth.model";
import { getDb } from "@/models/db/client";
import { users } from "@/models/db/schema";
import { currentUser, requireAccount } from "@/controllers/guards";
import { closeDatabase, useFreshDatabase } from "./helpers/db";

const state = vi.hoisted(() => ({ mail: vi.fn(), writeSession: vi.fn(), configured: true, token: null as string | null }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/mailer", () => ({ sendLoginCode: state.mail }));
vi.mock("@/lib/campus-oidc", () => ({ campusIdentityConfigured: () => state.configured }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/models/maintenance", () => ({ maybeRunMaintenance: async () => {}, startMaintenanceLoop: () => {} }));
vi.mock("@/lib/session", () => ({ requestIp: async () => "auth-test", requestUserAgent: async () => "auth-test",
  readFlowCookie: async () => null, readSessionCookie: async () => state.token,
  writeSessionCookie: state.writeSession, writeFlowCookie: vi.fn(), clearFlowCookie: vi.fn(), clearSessionCookie: vi.fn() }));

beforeAll(async () => { await useFreshDatabase(); });
afterAll(closeDatabase);
beforeEach(() => { state.mail.mockClear(); state.writeSession.mockClear(); state.configured = true; state.token = null; });

function form(email: string, password = "meet at the library") {
  const data = new FormData(); data.set("email", email); data.set("password", password); data.set("confirm", password);
  data.set("code", "123456"); data.set("intent", "signup"); return data;
}

describe("campus-only password and code entry points", () => {
  it("rejects non-Thapar accounts through every authentication action before sending mail", async () => {
    for (const email of ["outside@gmail.com", "outside@other.edu", "outside@thapar.edu.evil.com", "outside@students.thapar.edu"]) {
      const data = form(email);
      for (const action of [signInWithPassword, requestCode, resendCode, verifyCode,
        startPasswordFlow.bind(null, "signup"), startPasswordFlow.bind(null, "reset")]) {
        expect((await action(idleState, data)).status).toBe("error");
      }
      expect(await UserModel.findByEmail(email)).toBeNull();
    }
    expect(state.mail).not.toHaveBeenCalled();
    expect(state.writeSession).not.toHaveBeenCalled();
  });

  it("automatically completes university verification after a correct campus password", async () => {
    const user = await UserModel.findOrCreate("campus-password@thapar.edu", "member");
    await UserModel.setPassword(user.id, await hashPassword("meet at the library"));
    await expect(signInWithPassword(idleState, form(user.email))).rejects.toThrow("redirect:/auth/campus/start");
    expect(state.writeSession).toHaveBeenCalledTimes(1);
  });

  it("automatically completes university verification after a campus email code", async () => {
    const email = "campus-code@thapar.edu";
    const code = await LoginCodeModel.issue(email);
    const data = form(email); data.set("code", code);
    await expect(verifyCode(idleState, data)).rejects.toThrow("redirect:/auth/campus/start");
    expect(state.writeSession).toHaveBeenCalledTimes(1);
  });

  it("keeps password sign-in available without OAuth credentials", async () => {
    state.configured = false;
    const user = await UserModel.findOrCreate("campus-fallback@thapar.edu", "member");
    await UserModel.setPassword(user.id, await hashPassword("meet at the library"));
    await expect(signInWithPassword(idleState, form(user.email))).rejects.toThrow("redirect:/onboarding");
    expect(state.writeSession).toHaveBeenCalledTimes(1);
  });
  it("denies legacy non-campus sessions and verifies unnamed campus sessions before onboarding", async () => {
    const [outside] = await (await getDb()).insert(users).values({ email: "legacy@gmail.com" }).returning();
    state.token = (await SessionModel.create(outside.id, "legacy-browser")).token;
    expect(await currentUser()).toBeNull();
    const member = await UserModel.findOrCreate("legacy-campus@thapar.edu", "member");
    state.token = (await SessionModel.create(member.id, "campus-browser")).token;
    expect((await currentUser())!.id).toBe(member.id);
    await expect(requireAccount()).rejects.toThrow("redirect:/auth/campus/start");
  });
});
