import "server-only";
import { and, desc, eq, gt, isNull, lt, ne, sql } from "drizzle-orm";
import { RULES } from "@/config/app";
import { randomDigits, randomToken, safeEqualHex, sha256 } from "@/lib/crypto";
import { DomainError } from "@/lib/errors";
import { getDb } from "./db/client";
import { loginCodes, sessions } from "./db/schema";

/** A password chosen during sign-up or a reset, waiting for the inbox owner to confirm it. */
export type PendingPassword =
  | { passwordHash: string; flowHash: string }
  /** "Resend code": keep the password chosen in this same browser, if there is one. */
  | { carryFlowHash: string };

/** One-time email codes. Only a hash of each code is stored. */
export const LoginCodeModel = {
  async issue(email: string, pending?: PendingPassword) {
    const db = await getDb();
    return db.transaction(async (tx) => {
      // Serializes code issuance for one mailbox across all server instances.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${email}))`);
      const now = new Date();
      const windowStart = new Date(now.getTime() - RULES.otp.windowMinutes * 60_000);
      const [recent] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(loginCodes)
        .where(and(eq(loginCodes.email, email), gt(loginCodes.createdAt, windowStart)));
      if ((recent?.n ?? 0) >= RULES.otp.maxPerWindow) {
        throw new DomainError("Too many codes requested. Wait a few minutes and try again.", "rate_limited");
      }
      const [last] = await tx
        .select({ createdAt: loginCodes.createdAt })
        .from(loginCodes)
        .where(eq(loginCodes.email, email))
        .orderBy(desc(loginCodes.createdAt))
        .limit(1);
      const waitMs = last ? last.createdAt.getTime() + RULES.otp.resendAfterSeconds * 1000 - now.getTime() : 0;
      if (waitMs > 0) {
        throw new DomainError(`Please wait ${Math.ceil(waitMs / 1000)} seconds before asking for another code.`, "too_soon");
      }
      let password: { passwordHash: string | null; flowHash: string | null } = { passwordHash: null, flowHash: null };
      if (pending && "passwordHash" in pending) {
        password = pending;
      } else if (pending) {
        const [previous] = await tx
          .select({ passwordHash: loginCodes.passwordHash, flowHash: loginCodes.flowHash })
          .from(loginCodes)
          .where(
            and(
              eq(loginCodes.email, email),
              isNull(loginCodes.consumedAt),
              gt(loginCodes.expiresAt, now),
              eq(loginCodes.flowHash, pending.carryFlowHash),
            ),
          )
          .orderBy(desc(loginCodes.createdAt))
          .limit(1);
        if (previous) password = previous;
      }
      await tx
        .update(loginCodes)
        .set({ consumedAt: now })
        .where(and(eq(loginCodes.email, email), isNull(loginCodes.consumedAt)));
      const code = randomDigits(RULES.otp.length);
      await tx.insert(loginCodes).values({
        email,
        codeHash: sha256(`${email}:${code}`),
        expiresAt: new Date(now.getTime() + RULES.otp.ttlMinutes * 60_000),
        passwordHash: password.passwordHash,
        flowHash: password.flowHash,
      });
      return code;
    });
  },

  async verify(email: string, code: string) {
    const db = await getDb();
    const now = new Date();
    const [row] = await db
      .select()
      .from(loginCodes)
      .where(and(eq(loginCodes.email, email), isNull(loginCodes.consumedAt), gt(loginCodes.expiresAt, now)))
      .orderBy(desc(loginCodes.createdAt))
      .limit(1);
    if (!row) throw new DomainError("That code has expired. Ask for a new one.", "expired");
    if (row.attempts >= RULES.otp.maxAttempts) {
      throw new DomainError("Too many wrong tries. Ask for a new code.", "locked");
    }
    if (!safeEqualHex(row.codeHash, sha256(`${email}:${code}`))) {
      const [attempt] = await db.update(loginCodes)
        .set({ attempts: sql`${loginCodes.attempts} + 1` })
        .where(and(eq(loginCodes.id, row.id), isNull(loginCodes.consumedAt), lt(loginCodes.attempts, RULES.otp.maxAttempts)))
        .returning({ attempts: loginCodes.attempts });
      const left = RULES.otp.maxAttempts - (attempt?.attempts ?? RULES.otp.maxAttempts);
      throw new DomainError(
        left > 0 ? `That code isn't right. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong tries. Ask for a new code.",
        "mismatch",
      );
    }
    const [claimed] = await db.update(loginCodes).set({ consumedAt: now })
      .where(and(eq(loginCodes.id, row.id), isNull(loginCodes.consumedAt), gt(loginCodes.expiresAt, now), lt(loginCodes.attempts, RULES.otp.maxAttempts)))
      .returning({ passwordHash: loginCodes.passwordHash, flowHash: loginCodes.flowHash });
    if (!claimed) throw new DomainError("That code was already used or expired. Ask for a new one.", "expired");
    return claimed;
  },

  /** Removes an unused code that never reached the member (e.g. the email failed to send). */
  async discardUnused(email: string, code: string) {
    const db = await getDb();
    await db.delete(loginCodes).where(and(eq(loginCodes.email, email), eq(loginCodes.codeHash, sha256(`${email}:${code}`)), isNull(loginCodes.consumedAt)));
  },

  async purge(now: Date) {
    const db = await getDb();
    await db.delete(loginCodes).where(lt(loginCodes.expiresAt, new Date(now.getTime() - 86_400_000)));
  },
};

/** Database-backed sessions: the cookie holds a random token, the table holds its hash. */
export const SessionModel = {
  async create(userId: string, userAgent: string | null) {
    const db = await getDb();
    const token = randomToken();
    const expiresAt = new Date(Date.now() + RULES.session.ttlDays * 86_400_000);
    await db.insert(sessions).values({
      userId,
      tokenHash: sha256(token),
      userAgent: userAgent?.slice(0, 200) ?? null,
      expiresAt,
    });
    return { token, expiresAt };
  },

  async findValid(token: string) {
    const db = await getDb();
    const now = new Date();
    const [row] = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, now)))
      .limit(1);
    if (!row) return null;
    if (now.getTime() - row.lastUsedAt.getTime() > 10 * 60_000) {
      await db.update(sessions).set({ lastUsedAt: now }).where(eq(sessions.id, row.id));
    }
    return row;
  },

  async destroy(token: string) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  },

  /** Signs a member out everywhere except the session holding `keepToken`. */
  async destroyAllExcept(userId: string, keepToken: string) {
    const db = await getDb();
    await db.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, sha256(keepToken))));
  },

  async destroyAllForUser(userId: string) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.userId, userId));
  },

  async purge(now: Date) {
    const db = await getDb();
    await db.delete(sessions).where(lt(sessions.expiresAt, now));
  },
};
