import "server-only";
import { and, desc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "./db/client";
import type { UniversityProfile } from "@/lib/campus-identity";
import { photos, sessions, users, type ChatPolicy, type UserRow } from "./db/schema";
import { sha256 } from "@/lib/crypto";
import { DomainError } from "@/lib/errors";

export type User = UserRow;

export type ProfileInput = {
  year: string;
  branch: string;
  bio: string | null;
  interests: string[];
  vibe: "quiet" | "activity" | "social" | null;
};

export type PreferencesInput = {
  companionGenders: string[];
  groupPref: "both" | "one_on_one" | "group";
};

/** Wrong passwords allowed in a row, and how long password sign-in then pauses. */
export const LOGIN_LOCK = { attempts: 5, minutes: 15 } as const;

export const hasPhoto = (user: Pick<User, "photoUpdatedAt" | "photoRejectedAt">) =>
  Boolean(user.photoUpdatedAt && !user.photoRejectedAt);

/** A member is fully set up once they have identity, preferences and their one photo. */
export function isOnboarded(user: User): boolean {
  return Boolean(user.onboardedAt && user.gender && hasPhoto(user));
}

export const displayName = (user: Pick<User, "verifiedFullName" | "identityVerifiedAt" | "status">) =>
  user.status === "deleted" ? "Deleted member" : user.identityVerifiedAt && user.verifiedFullName ? user.verifiedFullName : "Campus member";

export const firstNameOf = (user: User) =>
  user.status === "deleted" ? "Deleted member" : user.identityVerifiedAt ? user.firstName ?? displayName(user) : "Campus member";

export const UserModel = {
  async findById(id: string) {
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user ?? null;
  },

  async findByEmail(email: string) {
    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user ?? null;
  },

  async findManyByIds(ids: readonly string[]) {
    if (ids.length === 0) return [];
    const db = await getDb();
    return db.select().from(users).where(inArray(users.id, [...ids]));
  },

  /** Signs in an existing member or creates a brand-new one. */
  async findOrCreate(email: string, role: "member" | "admin") {
    const db = await getDb();
    await db.insert(users).values({ email, role }).onConflictDoNothing({ target: users.email });
    const user = await UserModel.findByEmail(email);
    if (!user) throw new Error("Could not create user");
    if (role === "admin" && user.role !== "admin") {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
      user.role = "admin";
    }
    return user;
  },

  async setVerifiedIdentity(id: string, profile: UniversityProfile) {
    const db = await getDb();
    const [updated] = await db.update(users).set({
      firstName: profile.givenName, lastName: profile.familyName, verifiedFullName: profile.fullName,
      identityProvider: profile.provider, identitySubject: profile.subject, identityVerifiedAt: new Date(), updatedAt: new Date(),
    }).where(and(eq(users.id, id), eq(users.status, "active"), or(
      sql`${users.identitySubject} is null`,
      and(eq(users.identityProvider, profile.provider), eq(users.identitySubject, profile.subject)),
    ))).returning({ id: users.id });
    if (!updated) throw new Error("This account is already connected to a different university profile.");
  },

  async saveProfile(id: string, input: ProfileInput, gender?: "woman" | "man" | "nonbinary") {
    const db = await getDb();
    const user = await UserModel.findById(id);
    if (!user || user.status === "deleted") return;
    const { year, branch, bio, interests, vibe } = input;
    await db
      .update(users)
      .set({ year, branch, bio, interests, vibe, ...(gender ? { gender } : {}), updatedAt: new Date() })
      .where(eq(users.id, id));
  },

  async savePreferences(id: string, input: PreferencesInput) {
    const db = await getDb();
    await db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, id));
  },

  /** Stores (or replaces) the member's one profile photo. */
  async setPhoto(id: string, image: Buffer) {
    const db = await getDb();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .insert(photos)
        .values({ userId: id, data: image, bytes: image.length, contentType: "image/webp", updatedAt: now })
        .onConflictDoUpdate({
          target: photos.userId,
          set: { data: image, bytes: image.length, contentType: "image/webp", updatedAt: now },
        });
      await tx
        .update(users)
        .set({ photoUpdatedAt: now, photoRejectedAt: null, updatedAt: now })
        .where(eq(users.id, id));
    });
  },

  async getPhoto(id: string) {
    const db = await getDb();
    const [row] = await db
      .select({ data: photos.data, contentType: photos.contentType, updatedAt: photos.updatedAt })
      .from(photos)
      .where(eq(photos.userId, id))
      .limit(1);
    return row ?? null;
  },

  /** Sets (or replaces) the member's password and clears any lockout. */
  async setPassword(id: string, passwordHash: string) {
    const db = await getDb();
    const now = new Date();
    await db
      .update(users)
      .set({ passwordHash, passwordUpdatedAt: now, failedLogins: 0, lockedUntil: null, updatedAt: now })
      .where(eq(users.id, id));
  },

  /** Compare-and-swap the verified current hash and revoke other devices in the same transaction. */
  async changePassword(id: string, expectedHash: string | null, passwordHash: string, keepToken: string) {
    const db = await getDb();
    await db.transaction(async (tx) => {
      const [changed] = await tx.update(users).set({ passwordHash, passwordUpdatedAt: new Date(),
        failedLogins: 0, lockedUntil: null, updatedAt: new Date(),
      }).where(and(eq(users.id, id), eq(users.status, "active"),
        expectedHash === null ? isNull(users.passwordHash) : eq(users.passwordHash, expectedHash),
      )).returning({ id: users.id });
      if (!changed) throw new DomainError("Your account changed while this form was open. Refresh and try again.");
      await tx.delete(sessions).where(and(eq(sessions.userId, id), ne(sessions.tokenHash, sha256(keepToken))));
    });
  },

  /** A wrong password. After LOGIN_LOCK.attempts in a row, password sign-in pauses for a while. */
  async recordFailedLogin(id: string) {
    const db = await getDb();
    const now = new Date();
    const currentTime = sql`${now.toISOString()}::timestamptz`;
    const expiry = sql`${new Date(now.getTime() + LOGIN_LOCK.minutes * 60_000).toISOString()}::timestamptz`;
    const nextCount = sql`case when ${users.lockedUntil} <= ${currentTime} then 1 else least(${users.failedLogins} + 1, ${LOGIN_LOCK.attempts}) end`;
    const [row] = await db
      .update(users)
      .set({ failedLogins: nextCount, lockedUntil: sql`case
        when ${users.lockedUntil} > ${currentTime} then ${users.lockedUntil}
        when (${nextCount}) >= ${LOGIN_LOCK.attempts} then ${expiry}
        else null end` })
      .where(eq(users.id, id))
      .returning({ lockedUntil: users.lockedUntil });
    return { locked: Boolean(row?.lockedUntil && row.lockedUntil > now) };
  },

  async clearFailedLogins(id: string) {
    const db = await getDb();
    await db.update(users).set({ failedLogins: 0, lockedUntil: null }).where(eq(users.id, id));
  },

  async saveChatPolicy(id: string, chatPolicy: ChatPolicy) {
    const db = await getDb();
    await db.update(users).set({ chatPolicy, updatedAt: new Date() }).where(eq(users.id, id));
  },

  async acceptGuidelines(id: string) {
    const db = await getDb();
    const now = new Date();
    await db
      .update(users)
      .set({ isAdult: true, guidelinesAcceptedAt: now, updatedAt: now })
      .where(eq(users.id, id));
  },

  async completeOnboarding(id: string) {
    const db = await getDb();
    const now = new Date();
    await db.update(users).set({ onboardedAt: now, updatedAt: now }).where(eq(users.id, id));
  },

  async touch(id: string) {
    const db = await getDb();
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, id));
  },

  /** Moderator action: removes the photo and asks the member for a new one. */
  async rejectPhoto(id: string) {
    const db = await getDb();
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.delete(photos).where(eq(photos.userId, id));
      await tx
        .update(users)
        .set({ photoUpdatedAt: null, photoRejectedAt: now, updatedAt: now })
        .where(eq(users.id, id));
    });
  },

  async setStatus(id: string, status: "active" | "suspended", reason: string | null = null) {
    const db = await getDb();
    await db
      .update(users)
      .set({ status, suspendedReason: status === "suspended" ? reason : null, updatedAt: new Date() })
      .where(eq(users.id, id));
  },

  /** Account deletion: personal data and the photo are wiped; safety records keep an anonymous row. */
  async anonymize(id: string) {
    const db = await getDb();
    await db.transaction(async (tx) => {
      await tx.delete(photos).where(eq(photos.userId, id));
      await tx
        .update(users)
        .set({
          email: `deleted+${id}@invalid.local`,
          status: "deleted",
          firstName: "Deleted",
          lastName: null,
          verifiedFullName: null,
          identityProvider: null,
          identitySubject: null,
          identityVerifiedAt: null,
          passwordHash: null,
          passwordUpdatedAt: null,
          failedLogins: 0,
          lockedUntil: null,
          gender: null,
          year: null,
          vibe: null,
          companionGenders: [],
          groupPref: "both",
          chatPolicy: "nobody",
          isAdult: false,
          lastSeenAt: null,
          bio: null,
          interests: [],
          photoUpdatedAt: null,
          branch: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));
    });
  },

  async search(query: string, limit = 30) {
    const db = await getDb();
    const q = `%${query.trim().replace(/[%_]/g, "")}%`;
    return db
      .select()
      .from(users)
      .where(
        and(
          ne(users.status, "deleted"),
          query.trim()
            ? or(ilike(users.email, q), ilike(users.firstName, q), ilike(users.lastName, q))
            : undefined,
        ),
      )
      .orderBy(desc(users.createdAt))
      .limit(limit);
  },

  async recentPhotos(limit = 48) {
    const db = await getDb();
    return db
      .select()
      .from(users)
      .where(and(isNotNull(users.photoUpdatedAt), ne(users.status, "deleted")))
      .orderBy(desc(users.photoUpdatedAt))
      .limit(limit);
  },

  async countOnboarded() {
    const db = await getDb();
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(and(isNotNull(users.onboardedAt), eq(users.status, "active")));
    return row?.n ?? 0;
  },
};
