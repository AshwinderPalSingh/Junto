"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { RULES } from "@/config/app";
import { ACTIVITY_IDS } from "@/config/campus";
import { formToObject, invalid, success, type ActionState } from "@/lib/action";
import { formatClock } from "@/lib/time";
import { AvailabilityModel } from "@/models/availability.model";
import { requireMember } from "./guards";

const freeSchema = z.object({
  minutes: z.coerce
    .number()
    .int()
    .refine((v) => (RULES.freeDurations as readonly number[]).includes(v), "Choose how long you're free."),
  activities: z.array(z.enum(ACTIVITY_IDS)).max(ACTIVITY_IDS.length),
});

/** POST: "I'm free" for a while — opt into spontaneous plans. */
export async function goFree(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMember();
  const parsed = freeSchema.safeParse(formToObject(formData, ["activities"]));
  if (!parsed.success) return invalid(parsed.error);
  const until = await AvailabilityModel.setFree(user.id, parsed.data.minutes, parsed.data.activities, new Date());
  refresh();
  return success(`You're free until ${formatClock(until)}. We'll ping you when something fits.`);
}

export async function stopFree(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const user = await requireMember();
  await AvailabilityModel.clear(user.id);
  refresh();
  return success("You're no longer marked as free.");
}
