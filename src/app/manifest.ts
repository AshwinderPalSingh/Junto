import type { MetadataRoute } from "next";
import { APP } from "@/config/app";

/** Installable PWA: "Add to Home Screen" also enables Web Push on iPhone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP.name} · ${APP.tagline}`,
    short_name: APP.name,
    description: "Find a verified campus companion for chai, walks, games and errands, right now.",
    start_url: "/board",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["social", "lifestyle", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Post a plan", url: "/plans/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "I'm free", url: "/free", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
