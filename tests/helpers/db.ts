import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { migrate as migratePostgres } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { Database } from "@/models/db/client";
import * as schema from "@/models/db/schema";
import { UserModel } from "@/models/user.model";

const install = (db: Database) => {
  (globalThis as unknown as { __juntoDb?: Promise<Database> }).__juntoDb = Promise.resolve(db);
};

let cleanup: (() => Promise<void>) | null = null;

/**
 * A fresh database per test file, installed as the app's database.
 *
 * - Default: in-memory PGlite (no setup needed).
 * - With TEST_DATABASE_URL (a role that may CREATE DATABASE, e.g.
 *   postgres://localhost/postgres): a throwaway database on a real PostgreSQL
 *   server through the same postgres.js driver as production.
 */
export async function useFreshDatabase(): Promise<Database> {
  const adminUrl = process.env.TEST_DATABASE_URL;
  if (adminUrl) {
    const name = `junto_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
    const admin = postgres(adminUrl, { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database "${name}"`);
    const url = new URL(adminUrl);
    url.pathname = `/${name}`;
    const client = postgres(url.toString(), { max: 5, onnotice: () => {} });
    const db = drizzlePostgres({ client, schema });
    await migratePostgres(db, { migrationsFolder: "drizzle" });
    install(db);
    cleanup = async () => {
      await client.end();
      await admin.unsafe(`drop database if exists "${name}" with (force)`);
      await admin.end();
    };
    return db;
  }
  const client = new PGlite();
  // PGlite and postgres.js share Drizzle's query API; only raw `execute` results differ.
  const db = drizzlePglite({ client, schema }) as unknown as Database;
  await migratePglite(db as unknown as Parameters<typeof migratePglite>[0], { migrationsFolder: "drizzle" });
  install(db);
  cleanup = () => client.close();
  return db;
}

/** Closes (and, on a real server, drops) the database from useFreshDatabase. */
export async function closeDatabase() {
  await cleanup?.();
  cleanup = null;
}

let counter = 0;

export async function makeMember(
  overrides: Partial<{
    firstName: string;
    gender: "woman" | "man" | "nonbinary";
    companionGenders: string[];
    groupPref: "both" | "one_on_one" | "group";
  }> = {},
) {
  counter += 1;
  const user = await UserModel.findOrCreate(`member${counter}@thapar.edu`, "member");
  await UserModel.saveProfile(
    user.id,
    {
      year: "y2",
      branch: "Computer Engineering",
      bio: null,
      interests: ["music"],
      vibe: null,
    },
    overrides.gender ?? "woman",
  );
  await UserModel.savePreferences(user.id, {
    companionGenders: overrides.companionGenders ?? ["woman", "man", "nonbinary"],
    groupPref: overrides.groupPref ?? "both",
  });
  await UserModel.setPhoto(user.id, Buffer.from("webp-bytes"));
  await UserModel.acceptGuidelines(user.id);
  await UserModel.completeOnboarding(user.id);
  return (await UserModel.findById(user.id))!;
}
