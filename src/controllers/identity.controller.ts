import "server-only";
import { cookies } from "next/headers";
import * as oidc from "openid-client";
import { campusCallbackUrl, campusIdentityConfigured, campusOidc } from "@/lib/campus-oidc";
import { universityProfile } from "@/lib/campus-identity";
import { allowedEmailDomains, env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { readSessionCookie } from "@/lib/session";
import { IdentityModel } from "@/models/identity.model";
import { isOnboarded, UserModel } from "@/models/user.model";
import { currentUser } from "./guards";

const FLOW_COOKIE = "junto_campus_flow";
const noStore = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const deny = (message: string, status = 400) => new Response(message, { status, headers: noStore });

export const IdentityController = {
  async start(): Promise<Response> {
    const user = await currentUser();
    const sessionToken = await readSessionCookie();
    if (!user || user.status !== "active" || !sessionToken) return deny("Sign in to Junto first.", 401);
    if (!campusIdentityConfigured()) return deny("University-account sign-in is not configured yet.", 503);
    if (!(await rateLimit(`identity:${user.id}`, 5, 10 * 60_000)).ok) return deny("Try again in a few minutes.", 429);
    try {
      const config = await campusOidc();
      const state = oidc.randomState();
      const nonce = oidc.randomNonce();
      const verifier = oidc.randomPKCECodeVerifier();
      await IdentityModel.begin({ state, nonce, verifier, userId: user.id, sessionToken, provider: env().CAMPUS_IDENTITY_PROVIDER! });
      (await cookies()).set(FLOW_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: new URL(env().APP_URL).protocol === "https:", path: "/auth/campus", maxAge: 600 });
      const url = oidc.buildAuthorizationUrl(config, {
        redirect_uri: campusCallbackUrl(), scope: "openid email profile", state, nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: "S256",
        prompt: "select_account", login_hint: user.email,
        ...(env().CAMPUS_IDENTITY_PROVIDER === "google" ? { hd: user.email.split("@")[1] } : {}),
      });
      return new Response(null, { status: 303, headers: { ...noStore, Location: url.href } });
    } catch {
      return deny("University-account sign-in is temporarily unavailable. Please try again.", 503);
    }
  },

  async callback(request: Request): Promise<Response> {
    const user = await currentUser();
    const sessionToken = await readSessionCookie();
    const jar = await cookies();
    const stateCookie = jar.get(FLOW_COOKIE)?.value;
    jar.set(FLOW_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: new URL(env().APP_URL).protocol === "https:", path: "/auth/campus", maxAge: 0 });
    const url = new URL(campusCallbackUrl());
    url.search = new URL(request.url).search;
    const state = url.searchParams.get("state");
    if (!user || user.status !== "active" || !sessionToken || !state || state !== stateCookie || !campusIdentityConfigured()) {
      return deny("This sign-in expired or belongs to another browser. Start again from your Junto profile.");
    }
    const flow = await IdentityModel.consume(state, user.id, sessionToken, env().CAMPUS_IDENTITY_PROVIDER!);
    if (!flow) return deny("This sign-in was already used or expired. Please start again.");
    try {
      const config = await campusOidc();
      const tokens = await oidc.authorizationCodeGrant(config, url, {
        pkceCodeVerifier: flow.verifier, expectedState: state, expectedNonce: flow.nonce, idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims) return deny("Your university account did not return an identity profile.");
      const info = await oidc.fetchUserInfo(config, tokens.access_token, claims.sub);
      // UserInfo supplies profile fields; security claims always come from the validated ID token.
      const profile = universityProfile(env().CAMPUS_IDENTITY_PROVIDER!, { ...info, ...claims,
        name: info.name ?? claims.name, given_name: info.given_name ?? claims.given_name,
        family_name: info.family_name ?? claims.family_name, email: info.email ?? claims.email,
      }, user.email, allowedEmailDomains(), env().CAMPUS_MICROSOFT_TENANT_ID);
      await UserModel.setVerifiedIdentity(user.id, profile);
      return new Response(null, { status: 303, headers: { ...noStore,
        Location: new URL(isOnboarded(user) ? "/profile/edit?identity=connected" : "/onboarding?identity=connected", env().APP_URL).href,
      } });
    } catch {
      return deny("We couldn't verify this university profile. Choose the same campus account you use in Junto and try again.");
    }
  },
};
