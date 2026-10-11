import "server-only";
import { purgeRateLimits } from "@/lib/rate-limit";
import { IdentityModel } from "./identity.model";
import { LoginCodeModel, SessionModel } from "./auth.model";
import { AvailabilityModel } from "./availability.model";
import { NotificationModel } from "./notification.model";
import { acceptedMembers, PlanModel, type PlanBundle } from "./plan.model";
import { displayName } from "./user.model";

/**
 * Background housekeeping: expire unanswered requests and empty plans,
 * complete finished meetups (feedback opens), send reminders, purge old
 * sessions and codes. Safe to run from several servers at once — the sweep
 * holds a Postgres advisory lock.
 *
 * Triggered by an in-process timer, by incoming requests (throttled) and,
 * on serverless hosts, by a scheduler calling /api/cron/maintenance.
 */
type LoopState = { timer?: NodeJS.Timeout; running: boolean; lastRun: number; lastPurge: number };
const globalForLoop = globalThis as unknown as { __juntoLoop?: LoopState };
const state = (globalForLoop.__juntoLoop ??= { running: false, lastRun: 0, lastPurge: 0 });

export const planNotificationData = (bundle: PlanBundle) => ({
  actor: displayName(bundle.host),
  activity: bundle.plan.activity,
  spot: bundle.plan.spot,
  startsAt: bundle.plan.startsAt.toISOString(),
});

export async function runMaintenance(now = new Date()) {
  if (state.running) return { skipped: true as const };
  state.running = true;
  state.lastRun = now.getTime();
  try {
    const result = await PlanModel.sweep(now);
    for (const b of result.expiredPlans) {
      await NotificationModel.send({
        userId: b.host.id,
        kind: "plan_expired",
        planId: b.plan.id,
        data: planNotificationData(b),
      });
    }
    for (const { bundle, userId } of result.expiredRequests) {
      await NotificationModel.send({
        userId,
        kind: "request_expired",
        planId: bundle.plan.id,
        actorId: bundle.host.id,
        data: planNotificationData(bundle),
      });
    }
    for (const b of result.completedPlans) {
      for (const m of acceptedMembers(b)) {
        await NotificationModel.send({
          userId: m.user.id,
          kind: "feedback_prompt",
          planId: b.plan.id,
          data: planNotificationData(b),
        });
      }
    }
    for (const b of result.reminders) {
      for (const m of acceptedMembers(b)) {
        await NotificationModel.send({
          userId: m.user.id,
          kind: "plan_reminder",
          planId: b.plan.id,
          data: planNotificationData(b),
        });
      }
    }
    if (now.getTime() - state.lastPurge > 10 * 60_000) {
      state.lastPurge = now.getTime();
      await Promise.all([SessionModel.purge(now), LoginCodeModel.purge(now), AvailabilityModel.purge(now), purgeRateLimits(now), IdentityModel.purge(now)]);
    }
    return {
      skipped: false as const,
      expiredPlans: result.expiredPlans.length,
      completedPlans: result.completedPlans.length,
      reminders: result.reminders.length,
      expiredRequests: result.expiredRequests.length,
    };
  } catch (error) {
    console.error("[maintenance] failed", error);
    return { skipped: true as const };
  } finally {
    state.running = false;
  }
}

/**
 * On serverless hosts (Vercel) there is no long-running process: maintenance
 * runs only when people use the site, so an idle site lets the database sleep
 * (and keeps a scale-to-zero database such as Neon's free plan within its hours).
 */
const SERVERLESS = Boolean(process.env.VERCEL);

/** Cheap to call on every request: runs at most once a minute per server instance. */
export async function maybeRunMaintenance(now = new Date()) {
  if (now.getTime() - state.lastRun < 60_000) return;
  await runMaintenance(now);
}

/** Long-running servers (Docker, Render…) sweep every 30 seconds; serverless hosts don't. */
export function startMaintenanceLoop() {
  if (state.timer || SERVERLESS) return;
  state.timer = setInterval(() => void runMaintenance(), 30_000);
  state.timer.unref?.();
}
