import type { Metadata } from "next";
import { Suspense } from "react";
import { finishOnboarding, saveAbout, savePreferences, uploadPhoto } from "@/controllers/onboarding.actions";
import { OnboardingController } from "@/controllers/onboarding.controller";
import { OnboardingView } from "@/views/screens/onboarding/onboarding-view";
import { Skeleton } from "@/views/ui/skeleton";

export const metadata: Metadata = { title: "Set up your profile" };

/** Router: GET /onboarding?step= → OnboardingController.show → OnboardingView */
export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <Suspense fallback={<OnboardingSkeleton />}>
      <OnboardingContent searchParams={searchParams} />
    </Suspense>
  );
}

async function OnboardingContent({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const vm = await OnboardingController.show(searchParams);
  return (
    <OnboardingView vm={vm} actions={{ saveAbout, savePreferences, uploadPhoto, finishOnboarding }} />
  );
}

function OnboardingSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 pt-6" aria-busy="true">
      <Skeleton className="h-8 w-28" />
      <div className="grid grid-cols-4 gap-2 pt-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-1.5" />
        ))}
      </div>
      <Skeleton className="mt-8 h-10 w-3/4" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="h-64 w-full " />
    </div>
  );
}
