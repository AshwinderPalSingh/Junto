// Applies pending migrations from ./drizzle to DATABASE_URL.
// The server also does this on start-up; run it explicitly in CI/CD before a deploy.
// Usage: npm run db:migrate
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { loadEnv } from "./load-env.mjs";

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local (see .env.example).");
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle({ client: sql }), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  console.log("Database is up to date.");
} catch (error) {
  console.error("Migration failed:", error.message ?? error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
