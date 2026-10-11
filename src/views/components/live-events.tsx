"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef } from "react";
import { toast } from "sonner";
import { CHAT_EVENT, RECONNECTED_EVENT, type ChatEventDetail } from "@/views/components/chat-thread";
import type { ChatMessageVM } from "@/views/view-models";

type NotificationEvent = {
  type: "notification";
  kind: string;
  title: string;
  body: string;
  href: string | null;
  planId: string | null;
};
type PlanEvent = { type: "plan"; planId: string };
type ChatEvent = {
  type: "chat";
  conversationId: string;
  planId: string | null;
  senderName: string;
  preview: string;
  message: ChatMessageVM | null;
};

/**
 * Subscribes to /api/events (Server-Sent Events). New notifications pop up as
 * toasts, chat messages go straight to any open chat, and the current screen
 * re-renders with fresh server data (badges, lists) when something changes.
 */
export function LiveEvents() {
  const router = useRouter();
  const pathname = usePathname();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** Several events in a burst cause one refresh. */
  const refreshSoon = useEffectEvent(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = undefined;
      router.refresh();
    }, 300);
  });

  const onNotification = useEffectEvent((data: NotificationEvent) => {
    const onThatPlan = data.planId && pathname === `/plans/${data.planId}`;
    toast(data.title, {
      description: data.body,
      action: data.href && !onThatPlan ? { label: "Open", onClick: () => router.push(data.href!) } : undefined,
    });
    refreshSoon();
  });

  const onPlan = useEffectEvent((data: PlanEvent) => {
    if (pathname === `/plans/${data.planId}`) refreshSoon();
  });

  const onChat = useEffectEvent((data: ChatEvent) => {
    window.dispatchEvent(
      new CustomEvent<ChatEventDetail>(CHAT_EVENT, {
        detail: { conversationId: data.conversationId, message: data.message },
      }),
    );
    const href = `/messages/${data.conversationId}`;
    const watching = pathname === href || (data.planId !== null && pathname === `/plans/${data.planId}`);
    if (watching) return;
    toast(data.senderName, {
      description: data.preview,
      action: { label: "Reply", onClick: () => router.push(href) },
    });
    refreshSoon();
  });

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    /** Something may have happened while disconnected: catch up on the next connection. */
    let missed = false;
    let stopped = false;

    const parse = <T,>(e: Event) => {
      try {
        return JSON.parse((e as MessageEvent).data) as T;
      } catch {
        return null;
      }
    };

    const close = () => {
      source?.close();
      source = null;
      clearTimeout(retryTimer);
    };

    const open = () => {
      if (source || stopped) return;
      // Hidden tabs wait until they're looked at (see onVisibility).
      if (document.visibilityState === "hidden") {
        missed = true;
        return;
      }
      const es = new EventSource("/api/events");
      source = es;
      // Events from a connection we've already replaced are ignored.
      const current = () => source === es;
      es.addEventListener("ready", () => {
        if (!current()) return;
        attempts = 0;
        if (missed) {
          missed = false;
          window.dispatchEvent(new Event(RECONNECTED_EVENT));
          refreshSoon();
        }
      });
      es.addEventListener("notification", (e) => {
        const data = current() ? parse<NotificationEvent>(e) : null;
        if (data) onNotification(data);
      });
      es.addEventListener("plan", (e) => {
        const data = current() ? parse<PlanEvent>(e) : null;
        if (data) onPlan(data);
      });
      es.addEventListener("chat", (e) => {
        const data = current() ? parse<ChatEvent>(e) : null;
        if (data) onChat(data);
      });
      // The server ends each stream on schedule; reconnect straight away.
      es.addEventListener("bye", () => {
        if (!current()) return;
        close();
        missed = true;
        open();
      });
      es.onerror = () => {
        if (!current()) return;
        close();
        if (stopped) return;
        missed = true;
        attempts += 1;
        retryTimer = setTimeout(open, Math.min(30_000, 1_000 * 2 ** attempts));
      };
    };

    // A tab left in the background lets its connection go after a minute (sparing the server and
    // database), and reconnects, catching up, as soon as it is looked at again.
    const onVisibility = () => {
      clearTimeout(hideTimer);
      if (document.visibilityState === "hidden") {
        hideTimer = setTimeout(() => {
          if (!source) return;
          close();
          missed = true;
        }, 60_000);
      } else if (!source) {
        missed = true;
        open();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    open();
    const timer = refreshTimer;
    return () => {
      stopped = true;
      close();
      clearTimeout(hideTimer);
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
