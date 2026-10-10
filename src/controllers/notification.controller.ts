import "server-only";
import { notificationCopy } from "@/lib/notification-copy";
import { NotificationModel } from "@/models/notification.model";
import type { NotificationsVM } from "@/views/view-models";
import { requireMember } from "./guards";

/** GET /notifications */
export const NotificationController = {
  async index(): Promise<NotificationsVM> {
    const viewer = await requireMember();
    const rows = await NotificationModel.list(viewer.id);
    return {
      now: new Date().toISOString(),
      items: rows.map(({ notification: n }) => {
        const copy = notificationCopy(n.kind, n.data, n.planId);
        return {
          id: n.id,
          kind: n.kind,
          icon: copy.icon,
          title: copy.title,
          body: copy.body,
          href: copy.href,
          at: n.createdAt.toISOString(),
          read: Boolean(n.readAt),
        };
      }),
    };
  },
};
