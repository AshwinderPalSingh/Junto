import "server-only";
import webpush from "web-push";
import { env } from "@/lib/env";
import { safePushEndpoint, safePushKeys } from "@/lib/push-validation";

/**
 * Web Push (installed PWAs on Android, desktop browsers, and iOS 16.4+ once
 * added to the Home Screen). Keys come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY;
 * without them push is simply turned off.
 */
const globalForPush = globalThis as unknown as { __juntoVapidReady?: boolean };

function configured() {
  const e = env();
  if (!e.VAPID_PUBLIC_KEY || !e.VAPID_PRIVATE_KEY) return false;
  if (!globalForPush.__juntoVapidReady) {
    webpush.setVapidDetails(e.VAPID_SUBJECT, e.VAPID_PUBLIC_KEY, e.VAPID_PRIVATE_KEY);
    globalForPush.__juntoVapidReady = true;
  }
  return true;
}

export const getVapidPublicKey = (): string | null => (configured() ? env().VAPID_PUBLIC_KEY! : null);

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string; tag?: string };

/** Returns "gone" when the browser has revoked the subscription (delete it). */
export async function sendPush(target: PushTarget, payload: PushPayload): Promise<"ok" | "gone" | "error" | "off"> {
  if (!safePushEndpoint(target.endpoint) || !safePushKeys(target.p256dh, target.auth)) return "gone";
  if (!configured()) return "off";
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 30, urgency: "high", timeout: 5000 },
    );
    return "ok";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) return "gone";
    console.warn("[push] delivery failed", status ?? "network error");
    return "error";
  }
}
