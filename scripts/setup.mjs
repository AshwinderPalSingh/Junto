// One-time setup: creates .env.local from .env.example and fills in the
// secrets that can be generated (Web Push VAPID keys, CRON_SECRET).
// Existing values are never overwritten. Usage: npm run setup
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import webpush from "web-push";

const file = ".env.local";
if (!existsSync(file)) {
  copyFileSync(".env.example", file);
  console.log("Created .env.local from .env.example");
}

const lines = readFileSync(file, "utf8").split("\n");
const valueOf = (key) => {
  const line = lines.find((l) => l.startsWith(`${key}=`));
  return line === undefined ? undefined : line.slice(key.length + 1).trim();
};
const set = (key, value) => {
  const index = lines.findIndex((l) => l.startsWith(`${key}=`));
  if (index === -1) lines.push(`${key}=${value}`);
  else lines[index] = `${key}=${value}`;
};

const generated = [];
if (!valueOf("VAPID_PUBLIC_KEY") || !valueOf("VAPID_PRIVATE_KEY")) {
  const keys = webpush.generateVAPIDKeys();
  set("VAPID_PUBLIC_KEY", keys.publicKey);
  set("VAPID_PRIVATE_KEY", keys.privateKey);
  generated.push("VAPID keys");
}
if (!valueOf("CRON_SECRET")) {
  set("CRON_SECRET", randomBytes(32).toString("base64url"));
  generated.push("CRON_SECRET");
}
writeFileSync(file, lines.join("\n"));
console.log(generated.length ? `Generated ${generated.join(" and ")} in .env.local` : "Secrets already set.");

const missing = ["DATABASE_URL", "SMTP_USER", "SMTP_PASS"].filter((key) => !valueOf(key));
if (missing.length) {
  console.log(`\nStill to fill in .env.local: ${missing.join(", ")}`);
  console.log("Then run: npm run email:test -- you@example.com");
}
