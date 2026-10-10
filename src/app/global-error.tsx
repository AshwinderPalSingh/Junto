"use client";

import Link from "next/link";

/**
 * Last-resort error screen, used only if the root layout itself fails. It
 * replaces the whole document, so it carries its own minimal styles.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f1f3f2",
          color: "#202321",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#656b68", lineHeight: 1.5, marginTop: 12 }}>
            Junto hit an unexpected problem. Try again in a moment.
          </p>
          {error.digest && <p style={{ fontFamily: "monospace", fontSize: 12, color: "#656b68" }}>ref {error.digest}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                border: 0,
                borderRadius: 999,
                padding: "10px 20px",
                background: "#202321",
                color: "#fafafa",
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <Link
              href="/"
              style={{
                borderRadius: 999,
                padding: "10px 20px",
                border: "1px solid rgb(0 0 0 / 0.15)",
                color: "#202321",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              Home
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
