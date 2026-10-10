"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { RULES } from "@/config/app";
import { BRANCHES, GENDER_IDS, GROUP_PREF_IDS, INTEREST_IDS, VIBE_IDS, YEAR_IDS } from "@/config/profile";
import { failure, formToObject, invalid, success, type ActionState } from "@/lib/action";
import { isDomainError } from "@/lib/errors";
import { processProfilePhoto } from "@/lib/images";
import { rateLimit } from "@/lib/rate-limit";
import { isOnboarded, UserModel } from "@/models/user.model";
import { requireAccount } from "./guards";
import { completedSteps } from "./onboarding.controller";

const aboutSchema = z.object({
  firstName: z.string().trim().min(1, "Tell us your first name.").max(40, "That's a long name — 40 characters max."),
  lastName: z.string().trim().max(40).optional().default(""),
  gender: z.enum(GENDER_IDS, "Choose how you identify.").optional(),
  year: z.enum(YEAR_IDS, "Choose your year."),
  branch: z.enum(BRANCHES, "Choose your department."),
  bio: z
    .string()
    .trim()
    .max(RULES.bioMaxLength, `Keep it under ${RULES.bioMaxLength} characters.`)
    .optional()
    .transform((v) => v || null),
  interests: z
    .array(z.enum(INTEREST_IDS))
    .min(RULES.minInterests, "Pick at least one interest.")
    .max(RULES.maxInterests, `Pick up to ${RULES.maxInterests}.`),
  vibe: z
    .enum(VIBE_IDS)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** POST: step 1 (and profile edits) — name, gender, year, interests. */
export async function saveAbout(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAccount();
  const parsed = aboutSchema.safeParse(formToObject(formData, ["interests"]));
  if (!parsed.success) return invalid(parsed.error);
  const { gender, vibe, ...profile } = parsed.data;
  const genderLocked = Boolean(user.onboardedAt);
  if (!genderLocked && !gender) return failure("Choose how you identify.", { gender: ["Choose one."] });
  await UserModel.saveProfile(user.id, { ...profile, vibe: vibe ?? null }, genderLocked ? undefined : gender);
  redirect(formData.get("return") === "profile" ? "/profile" : "/onboarding?step=preferences");
}

const preferencesSchema = z.object({
  companionGenders: z.array(z.enum(GENDER_IDS)).min(1, "Choose at least one."),
  groupPref: z.enum(GROUP_PREF_IDS),
});

/** POST: step 2 (and settings) — who you're comfortable meeting. Private. */
export async function savePreferences(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAccount();
  const parsed = preferencesSchema.safeParse(formToObject(formData, ["companionGenders"]));
  if (!parsed.success) return invalid(parsed.error);
  await UserModel.savePreferences(user.id, parsed.data);
  if (formData.get("return") === "settings") return success("Preferences saved.");
  redirect("/onboarding?step=photo");
}

/** POST: step 3 — the one mandatory profile photo. */
export async function uploadPhoto(
  _prev: ActionState<{ url: string }>,
  formData: FormData,
): Promise<ActionState<{ url: string }>> {
  const user = await requireAccount();
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return failure("Choose a photo first.");
  if (file.size > RULES.photo.maxBytes) return failure("That photo is over 5 MB. Try a smaller one.");
  if (!rateLimit(`photo:${user.id}`, 12, 60 * 60_000).ok) {
    return failure("Too many uploads. Try again in a little while.");
  }
  try {
    const { image } = await processProfilePhoto(Buffer.from(await file.arrayBuffer()));
    await UserModel.setPhoto(user.id, image);
    return success("Photo saved.", { url: `/api/avatars/${user.id}?v=${Date.now()}` });
  } catch (error) {
    if (isDomainError(error)) return failure(error.message);
    console.error("[photo] upload failed", error);
    return failure("We couldn't process that photo. Try a different one.");
  }
}

/** POST: step 4 — 18+ confirmation and community guidelines. */
export async function finishOnboarding(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireAccount();
  if (formData.get("adult") !== "on") return failure("Junto is for members who are 18 or older.");
  if (formData.get("guidelines") !== "on") return failure("Please agree to the community guidelines.");
  const done = completedSteps(user);
  for (const step of ["about", "preferences", "photo"] as const) {
    if (!done.includes(step)) redirect(`/onboarding?step=${step}`);
  }
  await UserModel.acceptGuidelines(user.id);
  if (!isOnboarded(user)) await UserModel.completeOnboarding(user.id);
  redirect("/board?welcome=1");
}
