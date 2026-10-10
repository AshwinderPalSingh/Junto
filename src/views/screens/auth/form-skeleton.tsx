import { Skeleton } from "@/views/ui/skeleton";

export function FormSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="size-11" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="mt-6 h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
