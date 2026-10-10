import "server-only";
import { notFound, redirect } from "next/navigation";
import { BADGES } from "@/config/badges";
import { BlockModel } from "@/models/block.model";
import { ChatModel } from "@/models/chat.model";
import { ReputationModel } from "@/models/reputation.model";
import { startChatMessage } from "@/models/rules/chat";
import { UserModel } from "@/models/user.model";
import type { OnboardingVM, ProfileVM } from "@/views/view-models";
import { directChatChecks } from "./chat.controller";
import { requireMember } from "./guards";
import { avatarUrl, buildContext, presentMember } from "./presenters";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const ProfileController = {
  /** GET /profile — how others see me, plus my own private numbers. */
  async me(): Promise<ProfileVM> {
    const viewer = await requireMember();
    const [ctx, rep] = await Promise.all([buildContext(viewer, []), ReputationModel.forUser(viewer.id)]);
    const earned = new Set<string>(rep.badges);
    return {
      now: new Date().toISOString(),
      member: presentMember(viewer, ctx),
      isMe: true,
      blockedByMe: false,
      chat: null,
      badges: BADGES.map((b) => ({ ...b, earned: earned.has(b.id) })),
      stats: {
        attended: rep.attended,
        activitiesTried: rep.activitiesTried,
        hostedGroups: rep.hostedGroups,
        lateCancels: rep.lateCancels,
        noShows: rep.noShows,
        pendingReports: rep.pendingReports,
      },
    };
  },

  /** GET /u/:id — another member's public card. */
  async show(params: Promise<{ id: string }>): Promise<ProfileVM> {
    const viewer = await requireMember();
    const { id } = await params;
    if (!UUID.test(id)) notFound();
    if (id === viewer.id) redirect("/profile");
    const [target, related] = await Promise.all([UserModel.findById(id), BlockModel.relatedIds(viewer.id)]);
    if (!target || target.status !== "active" || !target.onboardedAt) notFound();
    if (related.has(target.id)) notFound();
    const [ctx, existingChat, checks] = await Promise.all([
      buildContext(viewer, [target]),
      ChatModel.findDirect(viewer.id, target.id),
      directChatChecks(viewer, [target]),
    ]);
    const member = presentMember(target, ctx);
    const check = checks.get(target.id)!;
    // An existing chat stays open; otherwise their chat setting decides. Only the
    // setting is ever explained: blocks and comfort preferences stay private.
    const chat = existingChat || check.ok
      ? { canStart: true, note: null }
      : { canStart: false, note: check.reason === "not_accepting" || check.reason === "met_only" ? startChatMessage(check, member.firstName) : null };
    return {
      now: new Date().toISOString(),
      member,
      isMe: false,
      blockedByMe: false,
      chat,
      badges: member.reputation.badges.map((b) => ({ ...b, earned: true })),
      stats: null,
    };
  },

  /** GET /profile/edit */
  async edit(): Promise<Pick<OnboardingVM, "profile" | "photo">> {
    const user = await requireMember();
    return {
      profile: {
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        year: user.year ?? "",
        branch: user.branch ?? "",
        bio: user.bio ?? "",
        interests: user.interests,
        vibe: user.vibe,
        gender: user.gender,
        genderLocked: true,
      },
      photo: { url: avatarUrl(user), rejected: Boolean(user.photoRejectedAt) },
    };
  },
};
