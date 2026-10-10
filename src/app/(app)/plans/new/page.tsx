import type { Metadata } from "next";
import { Suspense } from "react";
import { createPlan } from "@/controllers/plan.actions";
import { PlanController } from "@/controllers/plan.controller";
import { PageSkeleton } from "@/views/components/skeletons";
import { NewPlanView } from "@/views/screens/plans/new-plan-view";

export const metadata: Metadata = { title: "Post a plan" };

/** Router: GET /plans/new → PlanController.newForm → NewPlanView (POST → createPlan) */
export default function NewPlanPage({ searchParams }: PageProps<"/plans/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewPlanContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewPlanContent({ searchParams }: Pick<PageProps<"/plans/new">, "searchParams">) {
  const vm = await PlanController.newForm(searchParams);
  return <NewPlanView vm={vm} createPlan={createPlan} />;
}
