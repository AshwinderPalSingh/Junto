import "server-only";
import { cookies } from "next/headers";
import * as oidc from "openid-client";
import { campusCallbackUrl, campusIdentityConfigured, campusOidc } from "@/lib/campus-oidc";
import { CAMPUS_EMAIL_DOMAIN, universitySignInProfile } from "@/lib/campus-identity";
import { randomToken } from "@/lib/crypto";
import { adminEmails, env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { readSessionCookie, requestIp, requestUserAgent, writeSessionCookie } from "@/lib/session";
import { SessionModel } from "@/models/auth.model";
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
    if (user && (user.status !== "active" || !sessionToken)) return deny("This account cannot sign in.", 403);
    if (!campusIdentityConfigured()) return deny("University-account sign-in is not configured yet.", 503);
    if (!(await rateLimit(`identity:${user?.id ?? `ip:${await requestIp()}`}`, user ? 5 : 60, 10 * 60_000)).ok) return deny("Try again in a few minutes.", 429);
    try {
      const config = await campusOidc();
      const state = oidc.randomState();
      const nonce = oidc.randomNonce();
      const verifier = oidc.randomPKCECodeVerifier();
      const browserToken = user ? sessionToken! : randomToken();
      await IdentityModel.begin({ state, nonce, verifier, userId: user?.id ?? null, sessionToken: browserToken, provider: env().CAMPUS_IDENTITY_PROVIDER! });
      (await cookies()).set(FLOW_COOKIE, user ? state : `${state}.${browserToken}`, {
        httpOnly: true, sameSite: "lax", secure: Boolean(process.env.VERCEL) || new URL(env().APP_URL).protocol === "https:", path: "/auth/campus", maxAge: 600,
      });
      const url = oidc.buildAuthorizationUrl(config, {
        redirect_uri: campusCallbackUrl(), scope: "openid email profile", state, nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: "S256",
        prompt: "select_account", ...(user ? { login_hint: user.email } : {}),
        ...(env().CAMPUS_IDENTITY_PROVIDER === "google" ? { hd: CAMPUS_EMAIL_DOMAIN } : {}),
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
    const [stateCookie, browserToken] = (jar.get(FLOW_COOKIE)?.value ?? "").split(".");
    jar.set(FLOW_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: Boolean(process.env.VERCEL) || new URL(env().APP_URL).protocol === "https:", path: "/auth/campus", maxAge: 0 });
    const url = new URL(campusCallbackUrl());
    url.search = new URL(request.url).search;
    const state = url.searchParams.get("state");
    if ((user && (user.status !== "active" || !sessionToken)) || (!user && !browserToken) ||
        !state || state !== stateCookie || !campusIdentityConfigured()) {
      return deny("This sign-in expired or belongs to another browser. Sign in again from Junto.");
    }
    const flow = await IdentityModel.consume(state, user?.id ?? null, user ? sessionToken! : browserToken!, env().CAMPUS_IDENTITY_PROVIDER!);
    if (!flow) return deny("This sign-in was already used or expired. Please start again.");
    try {
      const config = await campusOidc();
      const tokens = await oidc.authorizationCodeGrant(config, url, {
        pkceCodeVerifier: flow.verifier, expectedState: state, expectedNonce: flow.nonce, idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims) return deny("Your university account did not return an identity profile.");
      const info = await oidc.fetchUserInfo(config, tokens.access_token, claims.sub);
      if (info.sub !== claims.sub) return deny("Your university profile did not match the signed-in account.");
      // UserInfo supplies profile fields; security claims always come from the validated ID token.
      const profile = universitySignInProfile(env().CAMPUS_IDENTITY_PROVIDER!, { ...info, ...claims,
        name: info.name ?? claims.name, given_name: info.given_name ?? claims.given_name,
        family_name: info.family_name ?? claims.family_name,
      }, env().CAMPUS_MICROSOFT_TENANT_ID);
      if (info.email && info.email !== claims.email) return deny("Your university profile returned inconsistent email details.");
      if (user && user.email !== profile.email) return deny("Choose the same @thapar.edu account you use in Junto.");
      const member = await UserModel.signInWithIdentity(profile.email, profile, adminEmails().includes(profile.email) ? "admin" : "member");
      const session = await SessionModel.create(member.id, await requestUserAgent());
      await writeSessionCookie(session.token, session.expiresAt);
      if (sessionToken) await SessionModel.destroy(sessionToken);
      const destination = member.ratingRestrictedUntil && member.ratingRestrictedUntil > new Date() ? "/restricted" :
        isOnboarded(member) ? "/board" : "/onboarding";
      return new Response(null, { status: 303, headers: { ...noStore,
        Location: new URL(destination, env().APP_URL).href,
      } });
    } catch {
      return deny("Only verified @thapar.edu university accounts can sign in. Choose your Thapar account and try again.");
    }
  },
};
