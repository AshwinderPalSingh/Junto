import "server-only";
import { z } from "zod";

/**
 * Environment configuration. Parsed lazily (at first use, not at import) so a
 * production build doesn't need secrets, while a running server fails fast
 * with a clear message when something required is missing.
 */
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Public origin, e.g. https://junto.example.com (used in emails and links). */
  APP_URL: z.url().refine((value) => {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password &&
      (!process.env.VERCEL || url.protocol === "https:") &&
      (url.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || process.env.NODE_ENV !== "production");
  }, "Use an HTTPS public URL, or HTTP localhost for local development.").default(
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000",
  ),
  CAMPUS_IDENTITY_PROVIDER: optional.pipe(z.enum(["google", "microsoft"]).optional()),
  CAMPUS_OIDC_CLIENT_ID: optional,
  CAMPUS_OIDC_CLIENT_SECRET: optional,
  CAMPUS_MICROSOFT_TENANT_ID: optional,
  /** postgres://user:password@host:5432/database */
  DATABASE_URL: optional,
  /** Max connections in this server's pool. */
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  /** Comma-separated list of email domains allowed to sign up. */
  ALLOWED_EMAIL_DOMAINS: z.string().default("thapar.edu"),
  /** Comma-separated list of emails that get the moderator role on sign-in. */
  ADMIN_EMAILS: z.string().default(""),
  /** Sender shown on sign-in emails, e.g. "Junto <yourname@gmail.com>". */
  EMAIL_FROM: optional,
  /** SMTP (Gmail: smtp.gmail.com, port 465, your address + an app password). */
  SMTP_HOST: optional,
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  SMTP_USER: optional,
  SMTP_PASS: optional,
  /** Alternative to SMTP: https://resend.com API key. */
  RESEND_API_KEY: optional,
  /** Web Push keys (`npm run setup` generates them). Without them, push is off. */
  VAPID_PUBLIC_KEY: optional,
  VAPID_PRIVATE_KEY: optional,
  VAPID_SUBJECT: z.string().default("mailto:support@junto.app"),
  /** Protects /api/cron/maintenance when called by a scheduler. */
  CRON_SECRET: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

const list = (value: string) =>
  value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const allowedEmailDomains = () => list(env().ALLOWED_EMAIL_DOMAINS);
export const adminEmails = () => list(env().ADMIN_EMAILS);
export const isProduction = () => env().NODE_ENV === "production";

export function requireDatabaseUrl(): string {
  const url = env().DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at your PostgreSQL database, e.g. " +
        "postgres://junto:password@localhost:5432/junto (see .env.example).",
    );
  }
  return url;
}

export type MailTransport = "smtp" | "resend" | "none";

export function mailTransport(): MailTransport {
  const e = env();
  if (e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS) return "smtp";
  if (e.RESEND_API_KEY) return "resend";
  return "none";
}
