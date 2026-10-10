import { cn } from "@/lib/utils";

/** Two overlapping squares — two people, one plan. Monochrome, follows the text colour. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7 shrink-0", className)} aria-hidden="true">
      <rect x="3" y="9" width="17" height="17" fill="currentColor" />
      <rect x="12" y="4" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="12" y="9" width="8" height="12" fill="var(--background)" />
      <rect x="13" y="10" width="6" height="10" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

export function Logo({ className, showTagline = false }: { className?: string; showTagline?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[1.15rem] font-semibold tracking-[-0.03em]">Junto</span>
        {showTagline && <span className="mt-1 label-caps text-[0.6rem] text-muted-foreground">Campus companion</span>}
      </span>
    </span>
  );
}
