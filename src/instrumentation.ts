/** Runs once when a server instance starts: flags configuration that would break sign-in. */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const e = process.env;
  if (!e.DATABASE_URL) {
    console.warn("[junto] DATABASE_URL is not set: every page that needs data will fail.");
  }
  if (!(e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS) && !e.RESEND_API_KEY) {
    console.warn(
      "[junto] No email transport configured: sign-in codes can't be sent. " +
        "Set SMTP_HOST/SMTP_USER/SMTP_PASS (e.g. Gmail + App Password) or RESEND_API_KEY.",
    );
  }
}
