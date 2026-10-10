import { cn } from "@/lib/utils";
import { Icon } from "@/views/components/icons";
import type { ActivityVM } from "@/views/view-models";

const SIZES = {
  sm: "size-9 [&_svg]:size-4",
  md: "size-12 [&_svg]:size-5",
  lg: "size-16 [&_svg]:size-6",
} as const;

/** A square glass tile carrying the activity's line icon. */
export function ActivityTile({
  activity,
  size = "md",
  className,
  style,
}: {
  activity: Pick<ActivityVM, "icon" | "label">;
  size?: keyof typeof SIZES;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      role="img"
      aria-label={activity.label}
      style={style}
      className={cn("glass inline-grid shrink-0 place-items-center text-foreground", SIZES[size], className)}
    >
      <Icon name={activity.icon} />
    </span>
  );
}
