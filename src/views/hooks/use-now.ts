"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared clock that ticks every 20 seconds. During hydration it returns the
 * server's "now" so the first client render matches the server HTML exactly.
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let current = Date.now();

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 20_000);
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(serverNow: string): number {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => new Date(serverNow).getTime(),
  );
}
