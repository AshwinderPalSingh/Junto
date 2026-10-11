"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { failure, formToObject, invalid, success, type ActionState } from "@/lib/action";
import { isDomainError } from "@/lib/errors";
import { planNotificationData } from "@/models/maintenance";
import { NotificationModel } from "@/models/notification.model";
import { PlanModel } from "@/models/plan.model";
import { ReportModel } from "@/models/report.model";
import { ReputationModel } from "@/models/reputation.model";
import { UserModel } from "@/models/user.model";
import { requireAdmin } from "./guards";

/** POST handlers for moderators. Each one re-checks the admin role. */

const closeSchema = z.object({
  reportId: z.uuid(),
  outcome: z.enum(["resolved", "dismissed"]),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null),
  suspend: z.literal("on").optional(),
});

export async function closeReport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = closeSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const report = await ReportModel.findById(parsed.data.reportId);
  if (!report) return failure("Report not found.");
  await ReportModel.close(report.id, admin.id, parsed.data.outcome, parsed.data.note);
  if (report.category === "no_show") await ReputationModel.assessRestriction(report.reportedId);
  if (parsed.data.suspend) {
    await UserModel.setStatus(report.reportedId, "suspended", parsed.data.note ?? "Community guidelines violation");
  }
  refresh();
  return success(parsed.data.suspend ? "Report resolved and member suspended." : "Report closed.");
}

const statusSchema = z.object({
  userId: z.uuid(),
  status: z.enum(["active", "suspended"]),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null),
});

export async function setMemberStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = statusSchema.safeParse(formToObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.userId === admin.id) return failure("You can't change your own status.");
  await UserModel.setStatus(parsed.data.userId, parsed.data.status, parsed.data.reason);
  refresh();
  return success(parsed.data.status === "suspended" ? "Member suspended." : "Member reinstated.");
}

export async function rejectPhoto(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const userId = z.uuid().safeParse(formData.get("userId"));
  if (!userId.success) return failure("Member not found.");
  await UserModel.rejectPhoto(userId.data);
  await NotificationModel.send({ userId: userId.data, kind: "photo_rejected" });
  refresh();
  return success("Photo removed. They'll be asked for a new one.");
}

export async function removePlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const planId = z.uuid().safeParse(formData.get("planId"));
  if (!planId.success) return failure("Plan not found.");
  try {
    const { bundle, affected } = await PlanModel.cancel(planId.data, admin, "removed", new Date(), true);
    await NotificationModel.sendMany(
      [bundle.host.id, ...affected].map((userId) => ({
        userId,
        kind: "plan_cancelled" as const,
        planId: bundle.plan.id,
        data: { ...planNotificationData(bundle), actor: "A moderator" },
      })),
    );
  } catch (error) {
    if (isDomainError(error)) return failure(error.message);
    throw error;
  }
  refresh();
  return success("Plan removed.");
}
