import type { Metadata } from "next";
import { Suspense } from "react";
import { closeReport } from "@/controllers/admin.actions";
import { AdminController } from "@/controllers/admin.controller";
import { PageSkeleton } from "@/views/components/skeletons";
import { ReportsView } from "@/views/screens/admin/reports-view";

export const metadata: Metadata = { title: "Reports" };

/** Router: GET /admin/reports?status= → AdminController.reports → ReportsView */
export default function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReportsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ReportsContent({ searchParams }: Pick<PageProps<"/admin/reports">, "searchParams">) {
  const { view, reports, now } = await AdminController.reports(searchParams);
  return <ReportsView view={view} reports={reports} now={now} closeReport={closeReport} />;
}
