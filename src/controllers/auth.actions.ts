"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, success, type ActionState } from "@/lib/action";
import { adminEmails, allowedEmailDomains } from "@/lib/env";
import { isDomainError } from "@/lib/errors";
import { sendLoginCode } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";
import {
  clearSessionCookie,
  readSessionCookie,
  requestIp,
  requestUserAgent,
  writeSessionCookie,
} from "@/lib/session";
import { LoginCodeModel, SessionModel } from "@/models/auth.model";
import { isOnboarded, UserModel } from "@/models/user.model";
import { emailSchema } from "./auth.controller";

/** POST handlers for sign-in. Each validates input and never trusts the client. */

async function issueCode(rawEmail: unknown): Promise<ActionState | { email: string }> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return failure("Enter your university email address.", { email: ["Enter a valid email."] });
  const email = parsed.data;
  const domains = allowedEmailDomains();
  if (!domains.includes(email.split("@")[1] ?? "")) {
    return failure(`Use your @${domains[0]} email — Junto is only for the campus community.`, {
      email: [`Must end with @${domains[0]}`],
    });
  }
  const limit = rateLimit(`otp:ip:${await requestIp()}`, 20, 15 * 60_000);
  if (!limit.ok) return failure("Too many attempts from this network. Try again in a few minutes.");
  let code: string;
  try {
    code = await LoginCodeModel.issue(email);
  } catch (error) {
    if (isDomainError(error)) return failure(error.message);
    throw error;
  }
  try {
    await sendLoginCode(email, code);
  } catch (error) {
    // The code never arrived: drop it so the member can retry straight away.
    await LoginCodeModel.discardUnused(email);
    if (isDomainError(error)) return failure(error.message);
    console.error("[auth] could not send code", error);
    return failure("We couldn't send the code. Try again in a minute.");
  }
  return { email };
}

export async function requestCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await issueCode(formData.get("email"));
  if ("status" in result) return result;
  redirect(`/login/verify?email=${encodeURIComponent(result.email)}`);
}

export async function resendCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await issueCode(formData.get("email"));
  if ("status" in result) return result;
  return success("A new code is on its way. Check your inbox (and spam).");
}

const verifySchema = z.object({
  email: emailSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export async function verifyCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = verifySchema.safeParse({ email: formData.get("email"), code: formData.get("code") });
  if (!parsed.success) return failure("Enter the 6-digit code from your email.");
  const { email, code } = parsed.data;

  const limit = rateLimit(`verify:${email}`, 15, 15 * 60_000);
  if (!limit.ok) return failure("Too many tries. Ask for a new code in a few minutes.");
  try {
    await LoginCodeModel.verify(email, code);
  } catch (error) {
    if (isDomainError(error)) return failure(error.message);
    throw error;
  }

  const user = await UserModel.findOrCreate(email, adminEmails().includes(email) ? "admin" : "member");
  if (user.status === "suspended") redirect("/suspended");
  const session = await SessionModel.create(user.id, await requestUserAgent());
  await writeSessionCookie(session.token, session.expiresAt);
  redirect(isOnboarded(user) ? "/board" : "/onboarding");
}

export async function signOut() {
  const token = await readSessionCookie();
  if (token) await SessionModel.destroy(token);
  await clearSessionCookie();
  redirect("/");
}
