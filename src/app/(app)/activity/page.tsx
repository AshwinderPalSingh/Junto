import type { Metadata } from "next";
import { Suspense } from "react";
import { ActivityController } from "@/controllers/activity.controller";
import { FeedSkeleton } from "@/views/components/skeletons";
import { ActivityView } from "@/views/screens/activity/activity-view";

export const metadata: Metadata = { title: "My plans" };

/** Router: GET /activity → ActivityController.index → ActivityView */
export default function ActivityPage() {
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <ActivityContent />
    </Suspense>
  );
}

async function ActivityContent() {
  return <ActivityView vm={await ActivityController.index()} />;
}
