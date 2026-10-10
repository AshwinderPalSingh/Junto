import { cn } from "@/lib/utils";

/**
 * Content comes into focus like frosted glass as it scrolls into view.
 * Pure CSS (scroll-driven animations, see `.reveal` in globals.css): the
 * content is in the HTML and visible without JavaScript; browsers without
 * `animation-timeline` and people who prefer reduced motion simply see it.
 * `delay` (seconds) staggers siblings by shifting where the reveal starts.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("reveal", className)}
      style={delay ? ({ "--reveal-shift": `${Math.round(delay * 120)}px` } as React.CSSProperties) : undefined}
    >
      {children}
    </div>
  );
}
