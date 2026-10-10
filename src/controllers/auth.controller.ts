import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { RULES } from "@/config/app";
import { allowedEmailDomains } from "@/lib/env";
import { isOnboarded } from "@/models/user.model";
import { currentUser } from "./guards";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."));

/** GET handlers for the sign-in screens. */
export const AuthController = {
  async login() {
    const user = await currentUser();
    if (user) redirect(isOnboarded(user) ? "/board" : "/onboarding");
    return { domain: allowedEmailDomains()[0] ?? "thapar.edu" };
  },

  async verify(searchParams: Promise<Record<string, string | string[] | undefined>>) {
    const params = await searchParams;
    const parsed = emailSchema.safeParse(params.email);
    if (!parsed.success) redirect("/login");
    const user = await currentUser();
    if (user) redirect(isOnboarded(user) ? "/board" : "/onboarding");
    return {
      email: parsed.data,
      codeLength: RULES.otp.length,
      resendAfterSeconds: RULES.otp.resendAfterSeconds,
      ttlMinutes: RULES.otp.ttlMinutes,
    };
  },
};
