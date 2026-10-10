import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/models/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
  verbose: true,
});
