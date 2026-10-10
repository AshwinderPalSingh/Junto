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
    let attempts = 0;
    let reconnecting = false;
    let stopped = false;

    const parse = <T,>(e: Event) => {
      try {
        return JSON.parse((e as MessageEvent).data) as T;
      } catch {
        return null;
      }
    };

    const connect = () => {
      source = new EventSource("/api/events");
      source.addEventListener("ready", () => {
        attempts = 0;
        if (reconnecting) {
          reconnecting = false;
          // Anything missed while offline: open chats catch up, the screen refreshes.
          window.dispatchEvent(new Event(RECONNECTED_EVENT));
          refreshSoon();
        }
      });
      source.addEventListener("notification", (e) => {
        const data = parse<NotificationEvent>(e);
        if (data) onNotification(data);
      });
      source.addEventListener("plan", (e) => {
        const data = parse<PlanEvent>(e);
        if (data) onPlan(data);
      });
      source.addEventListener("chat", (e) => {
        const data = parse<ChatEvent>(e);
        if (data) onChat(data);
      });
      source.onerror = () => {
        source?.close();
        if (stopped) return;
        reconnecting = true;
        attempts += 1;
        retryTimer = setTimeout(connect, Math.min(30_000, 1_000 * 2 ** attempts));
      };
    };

    connect();
    const timer = refreshTimer;
    return () => {
      stopped = true;
      source?.close();
      clearTimeout(retryTimer);
      clearTimeout(timer.current);
    };
  }, []);

  return null;
}
