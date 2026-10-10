import "server-only";
import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { env, mailTransport } from "@/lib/env";
import { getVapidPublicKey } from "@/lib/push";
import { getDb } from "@/models/db/client";
import { runMaintenance } from "@/models/maintenance";

/** Operational endpoints for hosting platforms. */
export const SystemController = {
  /** GET /api/health — 200 when the app can reach its database. */
  async health(): Promise<Response> {
    await connection();
    const started = Date.now();
    try {
      const db = await getDb();
      await db.execute(sql`select 1`);
      const email = mailTransport();
      return Response.json(
        {
          // Without email nobody can sign in: still serving (200), but not healthy.
          status: email === "none" ? "degraded" : "ok",
          database: "ok",
          email: email === "none" ? "unconfigured" : email,
          push: getVapidPublicKey() ? "on" : "off",
          latencyMs: Date.now() - started,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      console.error("[health] database check failed", error);
      return Response.json({ status: "error", database: "unreachable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  },

  /** GET|POST /api/cron/maintenance — for schedulers on hosts without long-running servers. */
  async maintenance(request: Request): Promise<Response> {
    await connection();
    const secret = env().CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    const result = await runMaintenance(new Date());
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  },
};
