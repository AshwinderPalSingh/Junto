import "server-only";
import { redirect } from "next/navigation";
import { hasPhoto, isOnboarded, type User } from "@/models/user.model";
import type { OnboardingStep, OnboardingVM } from "@/views/view-models";
import { requireAccount } from "./guards";
import { avatarUrl } from "./presenters";

export const ONBOARDING_STEPS: OnboardingStep[] = ["about", "preferences", "photo", "guidelines"];

export function completedSteps(user: User): OnboardingStep[] {
  const done: OnboardingStep[] = [];
  if (user.firstName && user.gender && user.year && user.branch && user.interests.length > 0) done.push("about");
  if (user.companionGenders.length > 0) done.push("preferences");
  if (hasPhoto(user)) done.push("photo");
  if (user.guidelinesAcceptedAt && user.onboardedAt) done.push("guidelines");
  return done;
}

/** GET /onboarding?step= */
export const OnboardingController = {
  async show(searchParams: Promise<Record<string, string | string[] | undefined>>): Promise<OnboardingVM> {
    const user = await requireAccount();
    const { step: requestedRaw } = await searchParams;
    const requested = ONBOARDING_STEPS.find((s) => s === requestedRaw);
    const completed = completedSteps(user);
    const editing = isOnboarded(user);
    if (editing && !requested) redirect("/board");

    const firstIncomplete = ONBOARDING_STEPS.find((s) => !completed.includes(s));
    let step: OnboardingStep = requested ?? firstIncomplete ?? "guidelines";
    // No skipping ahead of an unfinished step.
    if (firstIncomplete && ONBOARDING_STEPS.indexOf(step) > ONBOARDING_STEPS.indexOf(firstIncomplete)) {
      step = firstIncomplete;
    }

    return {
      email: user.email,
      step,
      completed,
      editing,
      profile: {
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        year: user.year ?? "",
        branch: user.branch ?? "",
        bio: user.bio ?? "",
        interests: user.interests,
        vibe: user.vibe,
        gender: user.gender,
        genderLocked: Boolean(user.onboardedAt),
      },
      preferences: {
        companionGenders: user.companionGenders.length ? user.companionGenders : ["woman", "man", "nonbinary"],
        groupPref: user.groupPref,
      },
      photo: { url: avatarUrl(user), rejected: Boolean(user.photoRejectedAt) },
    };
  },
};
