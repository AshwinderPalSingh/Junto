import "server-only";
import { and, desc, eq, or } from "drizzle-orm";
import { getDb, type Executor } from "./db/client";
import { blocks, users } from "./db/schema";

/** Blocking is mutual invisibility: neither person sees the other's plans again. */
export const BlockModel = {
  async block(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) return;
    const db = await getDb();
    await db.insert(blocks).values({ blockerId, blockedId }).onConflictDoNothing();
  },

  async unblock(blockerId: string, blockedId: string) {
    const db = await getDb();
    await db.delete(blocks).where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)));
  },

  /** Everyone this member blocked or was blocked by. */
  async relatedIds(userId: string): Promise<Set<string>> {
    const db = await getDb();
    const rows = await db
      .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
      .from(blocks)
      .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
    return new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)));
  },

  /** Did `blockerId` block `blockedId`? (One direction only.) */
  async hasBlocked(blockerId: string, blockedId: string) {
    const db = await getDb();
    const [row] = await db
      .select({ blockerId: blocks.blockerId })
      .from(blocks)
      .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)))
      .limit(1);
    return Boolean(row);
  },

  /** Pass the transaction handle when called inside a transaction (PGlite serialises queries). */
  async isBlockedEitherWay(a: string, b: string, executor?: Executor) {
    const db = executor ?? (await getDb());
    const [row] = await db
      .select({ blockerId: blocks.blockerId })
      .from(blocks)
      .where(
        or(
          and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
          and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
        ),
      )
      .limit(1);
    return Boolean(row);
  },

  async listBlockedBy(userId: string) {
    const db = await getDb();
    return db
      .select({ user: users, createdAt: blocks.createdAt })
      .from(blocks)
      .innerJoin(users, eq(users.id, blocks.blockedId))
      .where(eq(blocks.blockerId, userId))
      .orderBy(desc(blocks.createdAt));
  },
};
