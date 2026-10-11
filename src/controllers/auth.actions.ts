"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, invalid, success, type ActionState } from "@/lib/action";
import { randomToken, sha256 } from "@/lib/crypto";
import { adminEmails, allowedEmailDomains } from "@/lib/env";
import { isDomainError } from "@/lib/errors";
import { sendLoginCode, type CodeIntent } from "@/lib/mailer";
import { burnPasswordCheck, hashPassword, newPasswordSchema, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import {
  clearFlowCookie,
  clearSessionCookie,
  readFlowCookie,
  readSessionCookie,
  requestIp,
  requestUserAgent,
  writeFlowCookie,
  writeSessionCookie,
} from "@/lib/session";
import { LoginCodeModel, SessionModel, type PendingPassword } from "@/models/auth.model";
import { isOnboarded, LOGIN_LOCK, UserModel, type User } from "@/models/user.model";
import { codeIntentSchema, emailSchema } from "./auth.controller";

/**
 * POST handlers for signing in. Each validates input and never trusts the client.
 *
 * Two ways in, both tied to a verified campus inbox:
 * - email + password (chosen at sign-up or reset, confirmed with an emailed code), and
 * - a one-time email code.
 */

const roleFor = (email: string) => (adminEmails().includes(email) ? "admin" : "member");

function campusEmail(raw: unknown): { ok: true; email: string } | { ok: false; state: ActionState<never> } {
  const parsed = emailSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, state: failure("Enter your university email address.", { email: ["Enter a valid email."] }) };
  }
  const domains = allowedEmailDomains();
  if (!domains.includes(parsed.data.split("@")[1] ?? "")) {
    return {
      ok: false,
      state: failure(`Use your @${domains[0]} email. Junto is only for the campus community.`, {
        email: [`Must end with @${domains[0]}`],
      }),
    };
  }
  return { ok: true, email: parsed.data };
}

/** Issues and emails a code. Returns an error state, or null once the email is on its way. */
async function issueCode(email: string, intent: CodeIntent, pending?: PendingPassword) {
  const limit = await rateLimit(`otp:ip:${await requestIp()}`, 20, 15 * 60_000);
  if (!limit.ok) return failure("Too many attempts from this network. Try again in a few minutes.");
  let code: string;
  try {
    code = await LoginCodeModel.issue(email, pending);
  } catch (error) {
    if (isDomainError(error)) return failure(error.message);
    throw error;
  }
  try {
    await sendLoginCode(email, code, intent);
  } catch (error) {
    // The code never arrived: drop it so the member can retry straight away.
    await LoginCodeModel.discardUnused(email, code);
    if (isDomainError(error)) return failure(error.message);
    console.error("[auth] could not send code", error);
    return failure("We couldn't send the code. Try again in a minute.");
  }
  return null;
}

/** Creates the session cookie and moves on. A reset signs out every other device first. */
async function startSession(user: User, opts: { signOutEverywhere?: boolean } = {}): Promise<never> {
  if (user.status === "suspended") redirect("/suspended");
  if (opts.signOutEverywhere) await SessionModel.destroyAllForUser(user.id);
  const session = await SessionModel.create(user.id, await requestUserAgent());
  await writeSessionCookie(session.token, session.expiresAt);
  redirect(isOnboarded(user) ? "/board" : "/onboarding");
}

/* ───────────── Email + password ───────────── */

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password.").max(200, "That's too long for a password."),
});

const WRONG_PASSWORD =
  "That email and password don't match. Signed up with an email code? Use “Forgot password” to create one.";

export async function signInWithPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return invalid(parsed.error);
  const { email, password } = parsed.data;
  const checked = campusEmail(email);
  if (!checked.ok) return checked.state;
  if (
    !(await rateLimit(`pw:ip:${await requestIp()}`, 30, 15 * 60_000)).ok ||
    !(await rateLimit(`pw:email:${email}`, 10, 15 * 60_000)).ok
  ) {
    return failure("Too many attempts. Wait a few minutes, or sign in with an email code.");
  }

  const user = await UserModel.findByEmail(email);
  if (!user || !user.passwordHash || user.status === "deleted") {
    // Same work as a real check, so the response doesn't reveal whether the account exists.
    await burnPasswordCheck(password);
    return failure(WRONG_PASSWORD);
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return failure(
      `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or sign in with an email code.`,
    );
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const { locked } = await UserModel.recordFailedLogin(user.id);
    return failure(
      locked
        ? `Too many wrong passwords. Password sign-in is paused for ${LOGIN_LOCK.minutes} minutes. You can still sign in with an email code.`
        : WRONG_PASSWORD,
    );
  }
  if (user.failedLogins > 0) await UserModel.clearFailedLogins(user.id);
  // findOrCreate also gives moderators listed in ADMIN_EMAILS their role.
  return startSession(await UserModel.findOrCreate(email, roleFor(email)));
}

/* ───────────── Create an account / reset a password ───────────── */

const passwordFlowSchema = z
  .object({ email: z.string(), password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords don't match." });

/**
 * Sign-up and "forgot password" are the same flow: choose a password, then prove
 * the inbox with an emailed code. The password waits (hashed) on the code and is
 * bound to this browser by a cookie, so it can't be planted on someone else's
 * account from another device.
 */
export async function startPasswordFlow(
  intent: "signup" | "reset",
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = passwordFlowSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const checked = campusEmail(parsed.data.email);
  if (!checked.ok) return checked.state;

  if (!(await rateLimit(`pwflow:ip:${await requestIp()}`, 10, 15 * 60_000)).ok ||
      !(await rateLimit(`pwflow:email:${checked.email}`, 5, 15 * 60_000)).ok) {
    return failure("Too many attempts. Try again in a few minutes.");
  }
  const flowToken = randomToken();
  const error = await issueCode(checked.email, intent, {
    passwordHash: await hashPassword(parsed.data.password),
    flowHash: sha256(flowToken),
  });
  if (error) return error;
  await writeFlowCookie(flowToken);
  redirect(`/login/verify?email=${encodeURIComponent(checked.email)}&intent=${intent}`);
}

/* ───────────── One-time email codes ───────────── */

export async function requestCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const checked = campusEmail(formData.get("email"));
  if (!checked.ok) return checked.state;
  const error = await issueCode(checked.email, "login");
  if (error) return error;
  redirect(`/login/verify?email=${encodeURIComponent(checked.email)}`);
}

export async function resendCode(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const checked = campusEmail(formData.get("email"));
  if (!checked.ok) return checked.state;
  const intent = codeIntentSchema.parse(formData.get("intent"));
  // A new code for a sign-up or reset keeps the password chosen in this browser.
  const flow = intent === "login" ? null : await readFlowCookie();
  const error = await issueCode(checked.email, intent, flow ? { carryFlowHash: sha256(flow) } : undefined);
  if (error) return error;
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
  const checked = campusEmail(email);
  if (!checked.ok) return checked.state;
  const limit = await rateLimit(`verify:${email}`, 15, 15 * 60_000);
  if (!limit.ok) return failure("Too many tries. Ask for a new code in a few minutes.");
  let pending: Awaited<ReturnType<typeof LoginCodeModel.verify>>;
  try {
    pending = await LoginCodeModel.verify(email, code);
  } catch (error) {
    if (isDomainError(error)) return failure(error.message);
    throw error;
  }

  const user = await UserModel.findOrCreate(email, roleFor(email));
  const flow = await readFlowCookie();
  const setsPassword = Boolean(pending.passwordHash && pending.flowHash && flow && sha256(flow) === pending.flowHash);
  if (setsPassword) {
    await UserModel.setPassword(user.id, pending.passwordHash!);
    await clearFlowCookie();
  } else if (user.failedLogins > 0 || user.lockedUntil) {
    // Proving the inbox also lifts a password lockout.
    await UserModel.clearFailedLogins(user.id);
  }
  return startSession(user, { signOutEverywhere: setsPassword });
}

export async function signOut() {
  const token = await readSessionCookie();
  if (token) await SessionModel.destroy(token);
  await clearSessionCookie();
  redirect("/");
}
