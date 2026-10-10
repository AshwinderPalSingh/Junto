import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";

/**
 * Content-Security-Policy. Everything is self-hosted (fonts are bundled by
 * next/font, photos are served by our own route), so only 'self' is allowed.
 * Inline scripts stay permitted for Next's streaming/hydration payloads and
 * the no-flash theme script; dev additionally needs eval for Fast Refresh.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone for container images (the Dockerfile sets this).
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // sharp and web-push use native/Node APIs: load them from node_modules at runtime.
  serverExternalPackages: ["sharp", "web-push"],
  poweredByHeader: false,
  // Hide the Next.js development toolbar (the floating "N" button in `next dev`).
  devIndicators: false,
  experimental: {
    serverActions: {
      // Profile photos are cropped client-side to ~100KB, this is head-room.
      bodySizeLimit: "6mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(production
            ? [
                { key: "Content-Security-Policy", value: csp },
                // Browsers ignore HSTS over plain http, so this is safe for a local `next start`.
                { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
              ]
            : []),
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
