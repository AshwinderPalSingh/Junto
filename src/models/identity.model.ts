import "server-only";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { sha256 } from "@/lib/crypto";
import { getDb } from "./db/client";
import { identityFlows } from "./db/schema";

export const IdentityModel = {
  async begin(input: { state: string; userId: string | null; sessionToken: string; verifier: string; nonce: string; provider: string }) {
    const db = await getDb();
    await db.insert(identityFlows).values({ stateHash: sha256(input.state), userId: input.userId,
      sessionHash: sha256(input.sessionToken), verifier: input.verifier, nonce: input.nonce, provider: input.provider,
      expiresAt: new Date(Date.now() + 10 * 60_000) });
  },
  async consume(state: string, userId: string | null, sessionToken: string, provider: string) {
    const db = await getDb();
    const [flow] = await db.delete(identityFlows).where(and(
      eq(identityFlows.stateHash, sha256(state)),
      userId === null ? isNull(identityFlows.userId) : eq(identityFlows.userId, userId),
      eq(identityFlows.sessionHash, sha256(sessionToken)), eq(identityFlows.provider, provider),
      gt(identityFlows.expiresAt, new Date()),
    )).returning();
    return flow ?? null;
  },
  async purge(now: Date) {
    const db = await getDb();
    await db.delete(identityFlows).where(lt(identityFlows.expiresAt, now));
  },
};
