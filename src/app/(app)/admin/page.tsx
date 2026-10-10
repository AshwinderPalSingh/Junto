import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminController } from "@/controllers/admin.controller";
import { PageSkeleton } from "@/views/components/skeletons";
import { DashboardView } from "@/views/screens/admin/dashboard-view";

export const metadata: Metadata = { title: "Moderation" };

/** Router: GET /admin → AdminController.dashboard → DashboardView */
export default function AdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  const { metrics } = await AdminController.dashboard();
  return <DashboardView metrics={metrics} />;
}
