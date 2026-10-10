"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { RULES } from "@/config/app";
import { REPORT_CATEGORY_IDS } from "@/config/safety";
import { failure, formToObject, invalid, success, type ActionState } from "@/lib/action";
import { BlockModel } from "@/models/block.model";
import { ReportModel } from "@/models/report.model";
import { UserModel } from "@/models/user.model";
import { requireMember } from "./guards";

/** POST handlers for reporting and blocking. Always available, never paywalled. */

const uuid = z.uuid("Something went wrong — refresh and try again.");

const reportSchema = z.object({
  reportedId: uuid,
  planId: uuid.optional().or(z.literal("").transform(() => undefined)),
  category: z.enum(REPORT_CATEGORY_IDS, "Choose what happened."),
  details: z
    .string()
    .trim()
    .max(1000, "Keep it under 1000 characters.")
    .optional()
    .transform((v) => v || null),
  alsoBlock: z.literal("on").optional(),
});

export async function reportMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMember();
  const parsed = reportSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { reportedId, planId, category, details, alsoBlock } = parsed.data;
  if (reportedId === user.id) return failure("You can't report yourself.");
  if (!(await UserModel.findById(reportedId))) return failure("That member no longer exists.");
  const since = new Date(Date.now() - 24 * 60 * 60_000);
  if ((await ReportModel.countSince(user.id, since)) >= RULES.reportsPerDay) {
    return failure("You've sent a lot of reports today. If you're in danger, contact campus security right away.");
  }
  await ReportModel.create({ reporterId: user.id, reportedId, planId: planId ?? null, category, details });
  if (alsoBlock) await BlockModel.block(user.id, reportedId);
  refresh();
  return success(
    `Thanks for telling us. A moderator will review it.${alsoBlock ? " You won't see each other's plans or chats any more." : ""}`,
  );
}

export async function blockMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMember();
  const parsed = uuid.safeParse(formData.get("userId"));
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data === user.id) return failure("You can't block yourself.");
  await BlockModel.block(user.id, parsed.data);
  refresh();
  return success("Blocked. You won't see each other's plans or chats, and they won't be told.");
}

export async function unblockMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMember();
  const parsed = uuid.safeParse(formData.get("userId"));
  if (!parsed.success) return invalid(parsed.error);
  await BlockModel.unblock(user.id, parsed.data);
  refresh();
  return success("Unblocked.");
}
