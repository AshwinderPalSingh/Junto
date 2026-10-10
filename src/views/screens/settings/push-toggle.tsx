"use client";

import { BellOff, BellRing, Send } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action";
import { Button } from "@/views/ui/button";
import { Spinner } from "@/views/ui/spinner";

type Props = {
  /** Null when the server has no VAPID keys configured. */
  vapidPublicKey: string | null;
  save: (json: string) => Promise<ActionState>;
  remove: (endpoint: string) => Promise<ActionState>;
  test: () => Promise<ActionState>;
};

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Status = "loading" | "unsupported" | "denied" | "off" | "on";

/** Web Push opt-in for this device (service worker + PushManager). */
export function PushToggle({ vapidPublicKey, save, remove, test }: Props) {
  const [status, setStatus] = useState<Status>("loading");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!vapidPublicKey) return;
    let cancelled = false;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const sub = await registration.pushManager.getSubscription();
      if (!cancelled) setStatus(sub ? "on" : "off");
    })().catch(() => !cancelled && setStatus("unsupported"));
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  const report = (result: ActionState) => {
    if (result.status === "error") toast.error(result.message);
    else if (result.status === "success" && result.message) toast.success(result.message);
  };

  function enable() {
    if (!vapidPublicKey) return;
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setStatus(permission === "denied" ? "denied" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        report(await save(JSON.stringify(sub.toJSON())));
        setStatus("on");
      } catch (error) {
        console.error(error);
        toast.error("Couldn't turn on notifications in this browser.");
      }
    });
  }

  function disable() {
    startTransition(async () => {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        report(await remove(sub.endpoint));
      }
      setStatus("off");
    });
  }

  if (!vapidPublicKey) {
    return (
      <p className="text-sm text-muted-foreground">
        Push notifications aren&apos;t enabled on this server. You&apos;ll still see everything live in the app.
      </p>
    );
  }
  if (status === "loading") {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-3.5" /> Checking this device…
      </p>
    );
  }
  if (status === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        This browser doesn&apos;t support push notifications. On iPhone, add Junto to your Home Screen first.
      </p>
    );
  }
  if (status === "denied") {
    return (
      <p className="text-sm text-muted-foreground">
        Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then come back.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status === "on" ? (
        <>
          <Button variant="outline" onClick={disable} disabled={pending}>
            <BellOff /> Turn off on this device
          </Button>
          <Button
            variant="ghost"
            onClick={() => startTransition(async () => report(await test()))}
            disabled={pending}
          >
            <Send /> Send a test
          </Button>
        </>
      ) : (
        <Button onClick={enable} disabled={pending}>
          {pending ? <Spinner /> : <BellRing />} Turn on notifications
        </Button>
      )}
    </div>
  );
}
