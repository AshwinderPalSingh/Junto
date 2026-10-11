import "server-only";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { readSessionCookie } from "@/lib/session";
import { SessionModel } from "@/models/auth.model";
import { maybeRunMaintenance, startMaintenanceLoop } from "@/models/maintenance";
import { isOnboarded, UserModel, type User } from "@/models/user.model";
import { ReputationModel } from "@/models/reputation.model";

/**
 * Request authentication (the controller-side Data Access Layer).
 * Every controller action starts here; UI checks are never trusted.
 */
export const currentUser = cache(async (): Promise<User | null> => {
  // Everything behind authentication is per-request (and uses the clock).
  await connection();
  const token = await readSessionCookie();
  if (!token) return null;
  const session = await SessionModel.findValid(token);
  if (!session) return null;
  let user = await UserModel.findById(session.userId);
  if (!user || user.status === "deleted") return null;
  if (user.status === "active" && user.onboardedAt) {
    user.ratingRestrictedUntil = await ReputationModel.assessRestriction(user.id);
  }
  const now = Date.now();
  if (!user.lastSeenAt || now - user.lastSeenAt.getTime() > 5 * 60_000) {
    UserModel.touch(user.id).catch((error) => console.warn("[auth] could not update last seen", error));
  }
  startMaintenanceLoop();
  void maybeRunMaintenance(new Date(now));
  return user;
});

/** Signed-in, active, fully onboarded member — or a redirect to wherever they need to go. */
export async function requireMember(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.status === "suspended") redirect("/suspended");
  if (user.ratingRestrictedUntil && user.ratingRestrictedUntil > new Date()) redirect("/restricted");
  if (!isOnboarded(user)) redirect("/onboarding");
  return user;
}

/** Signed in but possibly still onboarding. */
export async function requireAccount(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.status === "suspended") redirect("/suspended");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireMember();
  if (user.role !== "admin") notFound();
  return user;
}
