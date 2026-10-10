"use client";

import { formatRelative } from "@/lib/time";
import { useNow } from "@/views/hooks/use-now";

/** "in 12 min" / "5 min ago", kept fresh while the page is open. */
export function RelativeTime({
  date,
  serverNow,
  className,
}: {
  date: string;
  serverNow: string;
  className?: string;
}) {
  const now = useNow(serverNow);
  return (
    <time dateTime={date} className={className} suppressHydrationWarning>
      {formatRelative(date, now)}
    </time>
  );
}
