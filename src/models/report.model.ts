import "server-only";
import { aliasedTable, and, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "./db/client";
import { plans, reports, users } from "./db/schema";

export const ReportModel = {
  async create(input: {
    reporterId: string;
    reportedId: string;
    planId: string | null;
    category: string;
    details: string | null;
  }) {
    const db = await getDb();
    const [row] = await db.insert(reports).values(input).returning();
    return row;
  },

  async countSince(reporterId: string, since: Date) {
    const db = await getDb();
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(reports)
      .where(and(eq(reports.reporterId, reporterId), gt(reports.createdAt, since)));
    return row?.n ?? 0;
  },

  async list(status: "open" | "closed") {
    const db = await getDb();
    const reporter = aliasedTable(users, "reporter");
    const reported = aliasedTable(users, "reported");
    return db
      .select({ report: reports, reporter, reported, plan: plans })
      .from(reports)
      .innerJoin(reporter, eq(reporter.id, reports.reporterId))
      .innerJoin(reported, eq(reported.id, reports.reportedId))
      .leftJoin(plans, eq(plans.id, reports.planId))
      .where(status === "open" ? eq(reports.status, "open") : sql`${reports.status} <> 'open'`)
      .orderBy(desc(reports.createdAt))
      .limit(100);
  },

  async countAgainst(userId: string) {
    const db = await getDb();
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(reports)
      .where(eq(reports.reportedId, userId));
    return row?.n ?? 0;
  },

  async close(id: string, reviewerId: string, status: "resolved" | "dismissed", resolution: string | null) {
    const db = await getDb();
    await db
      .update(reports)
      .set({ status, resolution, reviewedById: reviewerId, resolvedAt: new Date() })
      .where(eq(reports.id, id));
  },

  async findById(id: string) {
    const db = await getDb();
    const [row] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
    return row ?? null;
  },
};
