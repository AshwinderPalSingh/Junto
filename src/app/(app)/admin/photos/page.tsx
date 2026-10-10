import type { Metadata } from "next";
import { Suspense } from "react";
import { rejectPhoto } from "@/controllers/admin.actions";
import { AdminController } from "@/controllers/admin.controller";
import { PageSkeleton } from "@/views/components/skeletons";
import { PhotosView } from "@/views/screens/admin/photos-view";

export const metadata: Metadata = { title: "Photo review" };

/** Router: GET /admin/photos → AdminController.photos → PhotosView */
export default function PhotosPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PhotosContent />
    </Suspense>
  );
}

async function PhotosContent() {
  const { members } = await AdminController.photos();
  return <PhotosView members={members} rejectPhoto={rejectPhoto} />;
}
