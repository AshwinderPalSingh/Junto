"use server";

import { refresh } from "next/cache";
import { NotificationModel } from "@/models/notification.model";
import { requireMember } from "./guards";

/** POST: mark everything as read (called when the inbox is opened). */
export async function markAllRead(): Promise<void> {
  const user = await requireMember();
  await NotificationModel.markAllRead(user.id);
  refresh();
}
