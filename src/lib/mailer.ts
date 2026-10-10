import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { APP, RULES } from "@/config/app";
import { env, isProduction, mailTransport } from "@/lib/env";
import { DomainError } from "@/lib/errors";

/**
 * Transactional email (sign-in codes).
 *
 * - SMTP (Gmail, Outlook, Zoho, SES…) when SMTP_HOST/SMTP_USER/SMTP_PASS are set.
 * - Resend's HTTP API when RESEND_API_KEY is set.
 * - Neither: production refuses to send; `next dev` prints the code in the
 *   server terminal so local development is still possible.
 */
const globalForMail = globalThis as unknown as { __juntoSmtp?: Transporter };

function smtp(): Transporter {
  if (globalForMail.__juntoSmtp) return globalForMail.__juntoSmtp;
  const e = env();
  const transporter = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: e.SMTP_PORT,
    secure: e.SMTP_SECURE ?? e.SMTP_PORT === 465,
    auth: { user: e.SMTP_USER, pass: e.SMTP_PASS },
    pool: true,
    maxConnections: 3,
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  globalForMail.__juntoSmtp = transporter;
  return transporter;
}

function sender() {
  const e = env();
  return e.EMAIL_FROM ?? (e.SMTP_USER ? `${APP.name} <${e.SMTP_USER}>` : `${APP.name} <no-reply@junto.app>`);
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function loginCodeEmail(code: string) {
  const subject = `${code} is your ${APP.name} sign-in code`;
  const text = [
    `Your ${APP.name} sign-in code is ${code}.`,
    "",
    `It expires in ${RULES.otp.ttlMinutes} minutes and can only be used once.`,
    "If you didn't try to sign in, you can ignore this email.",
    "",
    `${APP.name} · ${APP.campus}`,
  ].join("\n");
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#0a0a0a">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:40px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:440px;background:#ffffff;border:1px solid #e5e5e5">
<tr><td style="padding:32px 32px 0;font-size:15px;font-weight:600;letter-spacing:-0.01em">${escapeHtml(APP.name)}</td></tr>
<tr><td style="padding:24px 32px 0;font-size:22px;font-weight:600;letter-spacing:-0.02em">Your sign-in code</td></tr>
<tr><td style="padding:20px 32px 0">
<div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:34px;font-weight:600;letter-spacing:10px;padding:18px 0;text-align:center;background:#0a0a0a;color:#ffffff">${escapeHtml(code)}</div>
</td></tr>
<tr><td style="padding:20px 32px 0;font-size:14px;line-height:1.6;color:#525252">It expires in ${RULES.otp.ttlMinutes} minutes and can only be used once. If you didn't try to sign in, ignore this email — nobody can sign in without the code.</td></tr>
<tr><td style="padding:28px 32px 32px;font-size:12px;color:#a3a3a3">${escapeHtml(APP.name)} · ${escapeHtml(APP.campus)}</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  return { subject, text, html };
}

async function deliver(to: string, message: { subject: string; text: string; html: string }) {
  const transport = mailTransport();
  if (transport === "smtp") {
    await smtp().sendMail({ from: sender(), to, ...message });
    return;
  }
  if (transport === "resend") {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env().RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: sender(), to: [to], ...message }),
    });
    if (!response.ok) throw new Error(`Resend error ${response.status}: ${await response.text()}`);
    return;
  }
  throw new Error("No email transport configured");
}

/** Sends a sign-in code. Throws a DomainError with a user-safe message on failure. */
export async function sendLoginCode(email: string, code: string) {
  if (mailTransport() === "none") {
    if (isProduction()) {
      console.error("[mail] Sign-in email is not configured. Set SMTP_HOST/SMTP_USER/SMTP_PASS or RESEND_API_KEY.");
      throw new DomainError("Sign-in emails aren't set up on this server yet. Please try again later.", "mail_unconfigured");
    }
    console.info(`\n[mail] Email is not configured — development sign-in code for ${email}: ${code}\n`);
    return;
  }
  try {
    await deliver(email, loginCodeEmail(code));
  } catch (error) {
    console.error("[mail] Could not send sign-in code", error);
    throw new DomainError("We couldn't send the email. Check the address and try again in a minute.", "mail_failed");
  }
}

/** Verifies SMTP credentials without sending anything (used by the health check). */
export async function verifyMailTransport(): Promise<"ok" | "unconfigured" | "error"> {
  const transport = mailTransport();
  if (transport === "none") return "unconfigured";
  if (transport === "resend") return "ok";
  try {
    await smtp().verify();
    return "ok";
  } catch {
    return "error";
  }
}
