import type { Metadata } from "next";
import { Suspense } from "react";
import { ShareController } from "@/controllers/share.controller";
import { ShareView } from "@/views/screens/public/share-view";
import { Skeleton } from "@/views/ui/skeleton";

export const metadata: Metadata = { title: "Shared meetup", robots: { index: false, follow: false } };

/** Router: GET /s/:token → ShareController.show → ShareView (public, read-only) */
export default function SharePage({ params }: PageProps<"/s/[token]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-24 h-72 max-w-md " />}>
      <ShareContent params={params} />
    </Suspense>
  );
}

async function ShareContent({ params }: Pick<PageProps<"/s/[token]">, "params">) {
  return <ShareView vm={await ShareController.show(params)} />;
}
