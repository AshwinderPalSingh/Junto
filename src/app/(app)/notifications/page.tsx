import type { Metadata } from "next";
import { Suspense } from "react";
import { markAllRead } from "@/controllers/notification.actions";
import { NotificationController } from "@/controllers/notification.controller";
import { PageSkeleton } from "@/views/components/skeletons";
import { NotificationsView } from "@/views/screens/notifications/notifications-view";

export const metadata: Metadata = { title: "Notifications" };

/** Router: GET /notifications → NotificationController.index → NotificationsView */
export default function NotificationsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NotificationsContent />
    </Suspense>
  );
}

async function NotificationsContent() {
  return <NotificationsView vm={await NotificationController.index()} markAllRead={markAllRead} />;
}
