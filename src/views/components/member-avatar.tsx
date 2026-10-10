import { cn } from "@/lib/utils";
import type { PhotoVM } from "@/views/view-models";

const SIZES = {
  xs: "size-6 text-[9px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-xs",
  lg: "size-14 text-sm",
  xl: "size-24 text-xl",
  "2xl": "size-32 text-2xl",
} as const;

type Props = {
  photo: PhotoVM;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
};

/** A member's profile photo (every signed-in member can see it), or their initials. */
export function MemberAvatar({ photo, name, size = "md", className }: Props) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-medium tracking-wide ring-1 ring-[var(--glass-edge)] select-none",
        SIZES[size],
        className,
      )}
    >
      <span className="relative inline-flex size-full items-center justify-center overflow-hidden rounded-full">
        {photo.url ? (
          // Auth-gated image served by our own route (not the public optimiser).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt={name} loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <span className="text-muted-foreground">{photo.initials}</span>
        )}
      </span>
      <span className="sr-only">{name}</span>
    </span>
  );
}

export function AvatarStack({
  people,
  size = "sm",
  max = 4,
}: {
  people: { id: string; name: string; photo: PhotoVM }[];
  size?: keyof typeof SIZES;
  max?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <span className="flex -space-x-1.5">
      {shown.map((p) => (
        <MemberAvatar key={p.id} photo={p.photo} name={p.name} size={size} className="ring-2 ring-background" />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background",
            SIZES[size],
          )}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
