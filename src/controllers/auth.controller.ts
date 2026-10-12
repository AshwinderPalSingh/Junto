import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { RULES } from "@/config/app";
import { allowedEmailDomains } from "@/lib/env";
import { campusIdentityConfigured } from "@/lib/campus-oidc";
import { accountHome, currentUser } from "./guards";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

export const codeIntentSchema = z.enum(["login", "signup", "reset"]).catch("login");

/** Signed-in members don't need the sign-in screens. */
async function leaveIfSignedIn() {
  const user = await currentUser();
  if (user) redirect(accountHome(user));
}

/** GET handlers for the sign-in screens (/login, /signup, /login/reset, /login/verify). */
export const AuthController = {
  async login() {
    await leaveIfSignedIn();
    return { domain: allowedEmailDomains()[0] ?? "thapar.edu", campusSignIn: campusIdentityConfigured() };
  },

  async verify(searchParams: Promise<Record<string, string | string[] | undefined>>) {
    const params = await searchParams;
    const parsed = emailSchema.safeParse(params.email);
    if (!parsed.success) redirect("/login");
    await leaveIfSignedIn();
    return {
      email: parsed.data,
      intent: codeIntentSchema.parse(params.intent),
      codeLength: RULES.otp.length,
      resendAfterSeconds: RULES.otp.resendAfterSeconds,
      ttlMinutes: RULES.otp.ttlMinutes,
    };
  },
};
