import "server-only";
import { cache } from "react";
import { BlockModel } from "@/models/block.model";
import { ChatModel } from "@/models/chat.model";
import { MetricsModel } from "@/models/metrics.model";
import { NotificationModel } from "@/models/notification.model";
import { displayName } from "@/models/user.model";
import type { ShellVM } from "@/views/view-models";
import { currentUser } from "./guards";
import { presentPhoto } from "./presenters";

/** Data for the app chrome (nav badges, avatar). Loaded once per request. */
export const ShellController = {
  data: cache(async (): Promise<ShellVM | null> => {
    const user = await currentUser();
    if (!user) return null;
    const isAdmin = user.role === "admin";
    const [unread, unreadChats, openReports] = await Promise.all([
      NotificationModel.unreadCount(user.id),
      BlockModel.relatedIds(user.id).then((hidden) => ChatModel.unreadConversationCount(user.id, hidden)),
      isAdmin ? MetricsModel.openReportCount() : Promise.resolve(0),
    ]);
    return { name: displayName(user), photo: presentPhoto(user), unread, unreadChats, isAdmin, openReports };
  }),
};
