import "server-only";
import path from "node:path";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { env, requireDatabaseUrl } from "@/lib/env";
import { deliverFromTransport, registerTransport } from "@/lib/realtime";
import * as schema from "./schema";

/**
 * PostgreSQL connection (postgres.js + Drizzle).
 *
 * - One pooled client per server process (kept on globalThis across reloads).
 * - Pending migrations in /drizzle run once on first use.
 * - A LISTEN connection on the `junto_events` channel carries live updates
 *   between server instances (see lib/realtime.ts).
 */
export type Database = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Tx;

const REALTIME_CHANNEL = "junto_events";

const globalForDb = globalThis as unknown as { __juntoDb?: Promise<Database>; __juntoSql?: postgres.Sql };

async function connect(): Promise<Database> {
  const url = requireDatabaseUrl();
  // Transaction-mode poolers (Neon "-pooler", Supabase :6543, PgBouncer) can't use prepared statements.
  const pooled = /pooler|pgbouncer|:6543\//i.test(url);
  const sql = postgres(url, {
    max: env().DATABASE_POOL_MAX,
    prepare: !pooled,
    idle_timeout: 30,
    connect_timeout: 15,
    onnotice: () => {},
  });
  globalForDb.__juntoSql = sql;
  const db = drizzle({ client: sql, schema });

  await runMigrations(db);

  if (!pooled) {
    try {
      await sql.listen(REALTIME_CHANNEL, deliverFromTransport);
      registerTransport({ notify: (payload) => sql.notify(REALTIME_CHANNEL, payload) });
    } catch (error) {
      console.warn("[db] LISTEN unavailable, live updates stay on this instance", error);
    }
  }
  return db;
}

async function runMigrations(db: Database) {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  try {
    await migrate(db, { migrationsFolder });
  } catch (error) {
    // Another instance may be migrating at the same moment: wait and retry once.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      await migrate(db, { migrationsFolder });
    } catch {
      throw error;
    }
  }
}

/** Lazily opens (once per process) and returns the database. */
export function getDb(): Promise<Database> {
  globalForDb.__juntoDb ??= connect().catch((error) => {
    globalForDb.__juntoDb = undefined;
    throw error;
  });
  return globalForDb.__juntoDb;
}
