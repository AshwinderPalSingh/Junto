import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-shimmer bg-[linear-gradient(100deg,var(--muted)_30%,color-mix(in_srgb,var(--foreground)_9%,transparent)_50%,var(--muted)_70%)] bg-[length:220%_100%]", className)}
      {...props}
    />
  )
}

export { Skeleton }
