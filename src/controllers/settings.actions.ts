"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failure, invalid, success, type ActionState } from "@/lib/action";
import { sendPush } from "@/lib/push";
import { safePushEndpoint, safePushKeys } from "@/lib/push-validation";
import { hashPassword, newPasswordSchema, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { clearSessionCookie, readSessionCookie } from "@/lib/session";
import { SessionModel } from "@/models/auth.model";
import { AvailabilityModel } from "@/models/availability.model";
import { ChatModel } from "@/models/chat.model";
import { PlanModel } from "@/models/plan.model";
import { PushSubscriptionModel } from "@/models/push-subscription.model";
import { UserModel } from "@/models/user.model";
import { requireMember } from "./guards";
import { isDomainError } from "@/lib/errors";

const subscriptionSchema = z.object({
  endpoint: z.url().max(2000).refine(safePushEndpoint, "Unsupported notification service."),
  keys: z.object({ p256dh: z.string().min(10).max(500), auth: z.string().min(4).max(200) }),
}).refine((sub) => safePushKeys(sub.keys.p256dh, sub.keys.auth), "Invalid notification keys.");

const passwordSchema = z
  .object({ current: z.string().max(200).optional(), password: newPasswordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords don't match." });

/** POST: create a password (accounts made with email codes) or change the existing one. */
export async function savePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMember();
  const parsed = passwordSchema.safeParse({
    current: formData.get("current") ?? undefined,
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return invalid(parsed.error);
  if (!(await rateLimit(`password:${user.id}`, 10, 15 * 60_000)).ok) return failure("Too many attempts. Try again in a few minutes.");
  if (user.passwordHash && !(await verifyPassword(parsed.data.current ?? "", user.passwordHash))) {
    return failure("Your current password isn't right.", { current: ["Your current password isn't right."] });
  }
  const token = await readSessionCookie();
  const session = token ? await SessionModel.findValid(token) : null;
  if (!session || (!user.passwordHash && session.createdAt.getTime() < Date.now() - 10 * 60_000)) {
    return failure("Please sign out and sign in again before creating a password.");
  }
  try {
    await UserModel.changePassword(user.id, user.passwordHash, await hashPassword(parsed.data.password), token!);
  } catch (error) {
    if (isDomainError(error)) return failure(error.message);
    throw error;
  }
  refresh();
  return success(
    user.passwordHash
      ? "Password changed. Your other devices have been signed out."
      : "Password created. Next time you can sign in with it.",
  );
}

const chatPolicySchema = z.enum(["anyone", "met", "nobody"], "Choose who can start a chat with you.");

/** POST: who may start a new direct chat with me. */
export async function saveChatPolicy(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMember();
  const parsed = chatPolicySchema.safeParse(formData.get("chatPolicy"));
  if (!parsed.success) return invalid(parsed.error);
  await UserModel.saveChatPolicy(user.id, parsed.data);
  refresh();
  return success("Chat settings saved.");
}

/** POST: remember this browser for Web Push notifications. */
export async function savePushSubscription(json: string): Promise<ActionState> {
  const user = await requireMember();
  if (!(await rateLimit(`push:save:${user.id}`, 15, 60_000)).ok) return failure("Try again in a minute.");
  if (json.length > 4000) return failure("That subscription didn't look right.");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return failure("That subscription didn't look right.");
  }
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  try {
    await PushSubscriptionModel.save(user.id, {
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    });
  } catch (error) {
    if (isDomainError(error)) return failure(error.message);
    throw error;
  }
  refresh();
  return success("Notifications are on for this device.");
}

export async function removePushSubscription(endpoint: string): Promise<ActionState> {
  const user = await requireMember();
  await PushSubscriptionModel.remove(user.id, endpoint);
  refresh();
  return success("Notifications are off for this device.");
}

export async function sendTestPush(): Promise<ActionState> {
  const user = await requireMember();
  if (!(await rateLimit(`push:test:${user.id}`, 3, 60_000)).ok) return failure("Try again in a minute.");
  const subs = await PushSubscriptionModel.forUser(user.id);
  if (subs.length === 0) return failure("Turn on notifications first.");
  let delivered = 0;
  for (const sub of subs) {
    const result = await sendPush(sub, {
      title: "Junto test notification",
      body: "Notifications work! You'll hear about requests and meetups here.",
      url: "/board",
      tag: "test",
    });
    if (result === "ok") delivered += 1;
    if (result === "gone") await PushSubscriptionModel.removeByEndpoint(sub.endpoint);
  }
  return delivered ? success("Test notification sent.") : failure("Couldn't reach this device. Try turning notifications off and on.");
}

/** POST: delete my account. Hosted plans are cancelled; personal data is wiped. */
export async function deleteAccount(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMember();
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") {
    return failure('Type DELETE to confirm.');
  }
  if (!(await rateLimit(`delete:${user.id}`, 5, 15 * 60_000)).ok) return failure("Try again in a few minutes.");
  if (user.passwordHash) {
    const current = formData.get("current");
    if (typeof current !== "string" || current.length > 200 || !(await verifyPassword(current, user.passwordHash))) {
      return failure("Enter your current password to delete your account.");
    }
  } else {
    const token = await readSessionCookie();
    const session = token ? await SessionModel.findValid(token) : null;
    if (!session || session.createdAt.getTime() < Date.now() - 10 * 60_000) {
      return failure("Please sign out and sign in again before deleting your account.");
    }
  }
  const now = new Date();
  const { upcoming } = await PlanModel.forMember(user.id, now);
  for (const bundle of upcoming) {
    try {
      if (bundle.plan.hostId === user.id) await PlanModel.cancel(bundle.plan.id, user, "changed_plans", now);
      else await PlanModel.leave(bundle.plan.id, user, "changed_plans", now);
      await ChatModel.syncPlan(bundle.plan.id);
    } catch {
      // Already closed — nothing to do.
    }
  }
  await AvailabilityModel.clear(user.id);
  await PushSubscriptionModel.removeAllForUser(user.id);
  await UserModel.anonymize(user.id);
  await SessionModel.destroyAllForUser(user.id);
  await clearSessionCookie();
  redirect("/?deleted=1");
}
