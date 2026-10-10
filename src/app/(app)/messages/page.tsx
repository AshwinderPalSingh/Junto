import type { Metadata } from "next";
import { Suspense } from "react";
import { ChatController } from "@/controllers/chat.controller";
import { PageSkeleton } from "@/views/components/skeletons";
import { InboxView } from "@/views/screens/chat/inbox-view";

export const metadata: Metadata = { title: "Messages" };

/** Router: GET /messages → ChatController.inbox → InboxView */
export default function MessagesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <InboxContent />
    </Suspense>
  );
}

async function InboxContent() {
  return <InboxView vm={await ChatController.inbox()} />;
}
