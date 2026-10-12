import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { User } from "@/models/user.model";
import { canonicalNavigation } from "@/lib/canonical-origin";
import { proxy } from "@/proxy";
import HomePage from "@/app/page";
import SafetyPage from "@/app/safety/page";
import { AuthController } from "@/controllers/auth.controller";

const state = vi.hoisted(() => ({ user: null as User | null }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/controllers/guards", async importOriginal => ({
  ...await importOriginal<typeof import("@/controllers/guards")>(), currentUser: async () => state.user,
}));
vi.mock("@/views/screens/landing/landing-view", () => ({ LandingView: () => null }));
vi.mock("@/views/screens/public/safety-view", () => ({ SafetyView: () => null }));

afterEach(() => { state.user = null; vi.unstubAllEnvs(); });

function member(changes: Partial<User> = {}): User {
  return { status: "active", gender: "woman", onboardedAt: new Date(), photoUpdatedAt: new Date(),
    photoRejectedAt: null, ratingRestrictedUntil: null, ...changes } as User;
}

describe("session-aware public navigation", () => {
  it("keeps home public for visitors and returns signed-in members to their account", async () => {
    expect((await HomePage()).type).toBeTypeOf("function");
    for (const [user, destination] of [
      [member(), "/board"], [member({ onboardedAt: null }), "/onboarding"],
      [member({ status: "suspended" }), "/suspended"],
      [member({ ratingRestrictedUntil: new Date(Date.now() + 3600_000) }), "/restricted"],
    ] as const) {
      state.user = user;
      await expect(HomePage()).rejects.toThrow(`redirect:${destination}`);
      await expect(AuthController.login()).rejects.toThrow(`redirect:${destination}`);
      expect((await SafetyPage()).props.returnHref).toBe(destination);
    }
  });
  it("lets anonymous safety visitors return home without a sign-in detour", async () => {
    expect((await SafetyPage()).props.returnHref).toBe("/");
  });
});

describe("production domain consistency", () => {
  const canonical = "https://junto-lyart-eta.vercel.app";
  function production() { vi.stubEnv("VERCEL_ENV", "production"); vi.stubEnv("APP_URL", canonical); }
  it("keeps safety, home, sign-in and account links on the canonical origin without rewriting cookies", () => {
    production();
    for (const pathname of ["/", "/safety", "/board", "/settings", "/profile/edit", "/login", "/signup", "/auth/campus/start"]) {
      const request = new NextRequest(`https://junto-deployment.vercel.app${pathname}?example=1`, {
        headers: { cookie: "junto_session=existing-session" },
      });
      const response = proxy(request);
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(`${canonical}${pathname}?example=1`);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
  });
  it("does not forward a password or mutation body between deployment domains", () => {
    production();
    expect(canonicalNavigation(new URL("https://junto-deployment.vercel.app/login?private=value"), "POST")!.href).toBe(`${canonical}/`);
  });
  it("avoids redirect loops and leaves previews, local development and OAuth callbacks on their origin", () => {
    production();
    expect(canonicalNavigation(new URL(`${canonical}/safety`), "GET")).toBeNull();
    expect(canonicalNavigation(new URL("https://junto-deployment.vercel.app/auth/campus/callback?code=private"), "GET")).toBeNull();
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(canonicalNavigation(new URL("https://junto-preview.vercel.app/safety"), "GET")).toBeNull();
    vi.stubEnv("VERCEL_ENV", "");
    expect(canonicalNavigation(new URL("http://localhost:3002/safety"), "GET")).toBeNull();
  });
});
