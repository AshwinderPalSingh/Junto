import type { Metadata } from "next";
import { Suspense } from "react";
import { goFree, stopFree } from "@/controllers/free.actions";
import { FreeController } from "@/controllers/free.controller";
import { PageSkeleton } from "@/views/components/skeletons";
import { FreeView } from "@/views/screens/free/free-view";

export const metadata: Metadata = { title: "I'm free" };

/** Router: GET /free → FreeController.show → FreeView (POST → goFree / stopFree) */
export default function FreePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <FreeContent />
    </Suspense>
  );
}

async function FreeContent() {
  return <FreeView vm={await FreeController.show()} goFree={goFree} stopFree={stopFree} />;
}
