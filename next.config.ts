import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone for container images (the Dockerfile sets this).
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // Request-specific CSP nonces cannot be reused in static/PPR HTML shells.
  cacheComponents: false,
  reactCompiler: true,
  // sharp and web-push use native/Node APIs: load them from node_modules at runtime.
  serverExternalPackages: ["sharp", "web-push", "@tensorflow-models/face-detection", "@tensorflow/tfjs-core", "@tensorflow/tfjs-converter", "@tensorflow/tfjs-backend-cpu"],
  outputFileTracingIncludes: { "/*": ["./models/face-detection/**/*"] },
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
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(production
            ? [
                // Browsers ignore HSTS over plain http, so this is safe for a local `next start`.
                { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
              ]
            : []),
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" },
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
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
