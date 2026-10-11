import { getActivity, getSpot } from "@/config/campus";
import { getPreset } from "@/config/safety";
import { formatClock } from "@/lib/time";

export type NotificationData = Record<string, string | number | boolean | null>;

/** `icon` is a line-icon name rendered by the views (no emoji anywhere). */
export type NotificationCopy = { icon: string; title: string; body: string; href: string };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Human text for a notification. Shared by the in-app list, live toasts and push. */
export function notificationCopy(
  kind: string,
  data: NotificationData | null | undefined,
  planId: string | null | undefined,
): NotificationCopy {
  const d = data ?? {};
  const actor = typeof d.actor === "string" ? d.actor : "Someone";
  const what = typeof d.activity === "string" ? getActivity(d.activity).short.toLowerCase() : "plan";
  const at = typeof d.startsAt === "string" ? formatClock(d.startsAt) : "";
  const spot = typeof d.spot === "string" ? getSpot(d.spot).name : "";
  const planHref = planId ? `/plans/${planId}` : "/activity";
  const atSpot = [at, spot].filter(Boolean).join(" · ");

  switch (kind) {
    case "join_request":
      return { icon: "user-plus", title: `${actor} wants to join`, body: `Your ${what} · ${atSpot}`, href: planHref };
    case "request_accepted":
      return { icon: "check", title: "You're in", body: `${actor} accepted you for ${what} · ${atSpot}`, href: planHref };
    case "request_declined":
      return {
        icon: "x",
        title: "Not this time",
        body: `Your request for ${what} at ${at} wasn't accepted. There's more on the board.`,
        href: "/board",
      };
    case "request_expired":
      return {
        icon: "hourglass",
        title: "Request expired",
        body: `The ${what} at ${at} started before ${actor} could respond.`,
        href: "/board",
      };
    case "plan_cancelled":
      return { icon: "ban", title: "Plan cancelled", body: `${actor} cancelled the ${what} at ${at}.`, href: planHref };
    case "guest_cancelled":
      return {
        icon: "user-minus",
        title: `${actor} can't make it`,
        body: `They left your ${what} at ${at}. The spot is open again.`,
        href: planHref,
      };
    case "plan_reminder":
      return {
        icon: "alarm-clock",
        title: `${cap(what)} starts soon`,
        body: `${atSpot}. Tap “I'm here” when you arrive.`,
        href: planHref,
      };
    case "feedback_prompt":
      return {
        icon: "message-square",
        title: "How did it go?",
        body: `Let us know if everyone showed up for ${what}. It stays private.`,
        href: planHref,
      };
    case "free_match":
      return { icon: "zap", title: `${actor} is up for ${what}`, body: `${atSpot} — you said you're free.`, href: planHref };
    case "message": {
      const preset = typeof d.preset === "string" ? getPreset(d.preset) : undefined;
      const detail = typeof d.detail === "string" && d.detail ? ` ${d.detail}` : "";
      return {
        icon: preset?.icon ?? "message-square",
        title: actor,
        body: `${preset?.text ?? "Sent a message"}${detail}`,
        href: planHref,
      };
    }
    case "checked_in":
      return { icon: "map-pin-check", title: `${actor} is here`, body: `${actor} has arrived at ${spot || "the spot"}.`, href: planHref };
    case "plan_expired":
      return {
        icon: "moon",
        title: "No one could make it",
        body: `Your ${what} at ${at} ended without companions. Try another time?`,
        href: "/plans/new",
      };
    case "photo_rejected":
      return {
        icon: "camera",
        title: "Please update your photo",
        body: "A moderator asked for a clear, recent photo of your face.",
        href: "/onboarding",
      };
    default:
      return {
        icon: "shield",
        title: typeof d.title === "string" ? d.title : "Account notice",
        body: typeof d.body === "string" ? d.body : "",
        href: typeof d.href === "string" && /^\/plans\/[0-9a-f-]{36}$/.test(d.href) ? d.href : "/settings",
      };
  }
}
