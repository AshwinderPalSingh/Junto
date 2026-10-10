// Checks the email settings in .env.local and sends a test message.
// Usage: npm run email:test -- someone@example.com
import nodemailer from "nodemailer";
import { loadEnv } from "./load-env.mjs";

loadEnv();
const e = process.env;
const to = process.argv[2] ?? e.SMTP_USER;

if (e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS) {
  const port = Number(e.SMTP_PORT ?? 465);
  const transporter = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port,
    secure: e.SMTP_SECURE ? e.SMTP_SECURE === "true" : port === 465,
    auth: { user: e.SMTP_USER, pass: e.SMTP_PASS },
    connectionTimeout: 15_000,
  });
  try {
    await transporter.verify();
    console.log(`Connected to ${e.SMTP_HOST}:${port} as ${e.SMTP_USER}`);
    if (!to) throw new Error("Pass a recipient: npm run email:test -- you@example.com");
    const info = await transporter.sendMail({
      from: e.EMAIL_FROM || `Junto <${e.SMTP_USER}>`,
      to,
      subject: "Junto email test",
      text: "Email delivery works. Sign-in codes will arrive like this one.",
    });
    console.log(`Sent to ${to} (${info.messageId}). Check the inbox and the spam folder.`);
  } catch (error) {
    console.error(`Email test failed: ${error.message}`);
    if (error.code === "EAUTH" && /gmail/i.test(e.SMTP_HOST)) {
      console.error(
        "Gmail rejected the login. Turn on 2-Step Verification and use a 16-character App Password\n" +
          "(https://myaccount.google.com/apppasswords) as SMTP_PASS, not your normal password.",
      );
    }
    process.exitCode = 1;
  }
} else if (e.RESEND_API_KEY) {
  if (!to) {
    console.error("Pass a recipient: npm run email:test -- you@example.com");
    process.exit(1);
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${e.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: e.EMAIL_FROM || "Junto <onboarding@resend.dev>",
      to,
      subject: "Junto email test",
      text: "Email delivery works. Sign-in codes will arrive like this one.",
    }),
  });
  console.log(response.ok ? `Sent to ${to} via Resend.` : `Resend error ${response.status}: ${await response.text()}`);
  if (!response.ok) process.exitCode = 1;
} else {
  console.error("No email transport configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in .env.local.");
  process.exitCode = 1;
}
