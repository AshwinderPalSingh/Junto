"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/views/theme-script";

/**
 * Light / dark / system theme without a provider. The pre-paint script in the
 * root layout applies the saved choice before first paint (no flash).
 */
export type ThemePreference = "light" | "dark" | "system";

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

export function setTheme(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Private mode: the choice just won't persist.
  }
  apply(pref);
  listeners.forEach((l) => l());
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const media = matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (readPreference() === "system") apply("system");
    callback();
  };
  media.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(callback);
    media.removeEventListener("change", onSystemChange);
  };
}

const resolvedTheme = (): "dark" | "light" =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as ThemePreference);
  const resolved = useSyncExternalStore(subscribe, resolvedTheme, () => "light" as const);
  return { preference, resolved, setTheme };
}
