import { Skeleton } from "@/views/ui/skeleton";

export function PlanCardSkeleton() {
  return (
    <div className="glass p-5">
      <div className="flex gap-3.5">
        <Skeleton className="size-12" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </div>
      <Skeleton className="mt-4 h-4 w-4/5" />
      <div className="mt-4 flex items-center gap-2.5 border-t border-border pt-3">
        <Skeleton className="size-8" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}

export function FeedSkeleton({ withHeader = false, count = 3 }: { withHeader?: boolean; count?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      {withHeader && (
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-10 w-72" />
        </div>
      )}
      {withHeader && (
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="size-16" />
          ))}
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: count }, (_, i) => (
          <PlanCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-5 w-80" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
