import "server-only";
import { aliasedTable, and, eq, inArray } from "drizzle-orm";
import { getDb } from "./db/client";
import { participations } from "./db/schema";

/** Who has met whom: two members "have met" once both were confirmed on the same plan. */
export const ConnectionModel = {
  /** Of `targetIds`, the members `viewerId` has been confirmed on a plan with. */
  async metAmong(viewerId: string, targetIds: readonly string[]): Promise<Set<string>> {
    const ids = [...new Set(targetIds)].filter((id) => id !== viewerId);
    if (ids.length === 0) return new Set();
    const db = await getDb();
    const mine = aliasedTable(participations, "mine");
    const theirs = aliasedTable(participations, "theirs");
    const rows = await db
      .selectDistinct({ userId: theirs.userId })
      .from(mine)
      .innerJoin(theirs, eq(theirs.planId, mine.planId))
      .where(
        and(
          eq(mine.userId, viewerId),
          eq(mine.status, "accepted"),
          eq(theirs.status, "accepted"),
          inArray(theirs.userId, ids),
        ),
      );
    return new Set(rows.map((r) => r.userId));
  },

  async haveMet(a: string, b: string) {
    return (await ConnectionModel.metAmong(a, [b])).has(b);
  },
};
