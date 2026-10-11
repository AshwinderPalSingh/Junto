import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { loadEnv } from "./load-env.mjs";

loadEnv();
if (!process.env.DATABASE_URL) {
  console.error("Database check failed: DATABASE_URL is not configured.");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 15, onnotice: () => {} });
try {
  const readWrite = await sql.begin(async (tx) => {
    await tx`create temporary table junto_connection_probe (value integer) on commit drop`;
    await tx`insert into junto_connection_probe values (42)`;
    const [row] = await tx`select value from junto_connection_probe`;
    return row.value === 42;
  });
  const [row] = await sql`select count(*)::integer as applied from drizzle.__drizzle_migrations`;
  const journal = JSON.parse(await readFile(new URL("../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  const pending = Math.max(0, journal.entries.length - row.applied);
  console.log(JSON.stringify({ database: "connected", readWrite: readWrite ? "passed" : "failed", appliedMigrations: row.applied, pendingMigrations: pending }));
  if (!readWrite || pending) process.exitCode = 1;
} catch (error) {
  console.error(`Database check failed (${error.code ?? "connection_error"}). No credentials or account data have been printed.`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
