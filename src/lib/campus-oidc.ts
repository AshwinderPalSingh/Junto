import "server-only";
import * as oidc from "openid-client";
import { env } from "@/lib/env";

export function campusIdentityConfigured(): boolean {
  const e = env();
  return Boolean(e.CAMPUS_IDENTITY_PROVIDER && e.CAMPUS_OIDC_CLIENT_ID && e.CAMPUS_OIDC_CLIENT_SECRET &&
    (e.CAMPUS_IDENTITY_PROVIDER !== "microsoft" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(e.CAMPUS_MICROSOFT_TENANT_ID ?? "")));
}

export function campusCallbackUrl(): string {
  return new URL("/auth/campus/callback", env().APP_URL).href;
}

let discovery: Promise<oidc.Configuration> | undefined;

export async function campusOidc(): Promise<oidc.Configuration> {
  if (!campusIdentityConfigured()) throw new Error("University-account sign-in is not configured.");
  const e = env();
  const issuer = e.CAMPUS_IDENTITY_PROVIDER === "google" ? "https://accounts.google.com" :
    `https://login.microsoftonline.com/${e.CAMPUS_MICROSOFT_TENANT_ID}/v2.0`;
  if (!discovery) {
    discovery = oidc.discovery(new URL(issuer), e.CAMPUS_OIDC_CLIENT_ID!, e.CAMPUS_OIDC_CLIENT_SECRET!, undefined,
      { timeout: 10, execute: [oidc.enableNonRepudiationChecks] }).catch((error) => {
      discovery = undefined;
      throw error;
    });
  }
  return discovery;
}
