import { ArrowUpRight, Clock, MapPin } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatClock, formatDay, formatDuration } from "@/lib/time";
import { ActivityTile } from "@/views/components/activity-tile";
import { LiveDot, Pill, ReputationLine } from "@/views/components/bits";
import { AvatarStack, MemberAvatar } from "@/views/components/member-avatar";
import { RelativeTime } from "@/views/components/relative-time";
import type { PlanCardVM } from "@/views/view-models";

function StatusChips({ plan }: { plan: PlanCardVM }) {
  if (plan.my.role === "host") {
    return (
      <>
        {plan.pendingRequests > 0 && (
          <Pill tone="solid">
            {plan.pendingRequests} request{plan.pendingRequests === 1 ? "" : "s"}
          </Pill>
        )}
        <Pill tone="outline">Your plan</Pill>
      </>
    );
  }
  if (plan.my.status === "accepted") return <Pill tone="solid">You&apos;re in</Pill>;
  if (plan.my.status === "requested") return <Pill tone="outline">Requested</Pill>;
  if (plan.spotsLeft === 0) return <Pill>Full</Pill>;
  return <Pill>{plan.isGroup ? `${plan.spotsLeft} of ${plan.capacity} spots` : "1-on-1"}</Pill>;
}

export function PlanCard({ plan, now, className }: { plan: PlanCardVM; now: string; className?: string }) {
  const startMs = new Date(plan.startsAt).getTime();
  const nowMs = new Date(now).getTime();
  const happening = startMs - nowMs <= 15 * 60_000 && new Date(plan.endsAt).getTime() > nowMs;
  const day = formatDay(plan.startsAt, now);
  return (
    <Link
      href={`/plans/${plan.id}`}
      className={cn(
        "group glass glass-sheen glass-lift block p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:p-5",
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <ActivityTile activity={plan.activity} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[1.05rem] leading-tight font-semibold tracking-[-0.02em]">{plan.activity.label}</h3>
            <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[0.7rem] tracking-wide text-foreground uppercase">
              {happening && <LiveDot className="size-1.5" />}
              <RelativeTime date={plan.startsAt} serverNow={now} />
            </span>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.8rem] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" strokeWidth={1.75} />
              {plan.spot.name}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" strokeWidth={1.75} />
              {day === "Today" ? "" : `${day} · `}
              {formatClock(plan.startsAt)} · {formatDuration(plan.durationMinutes)}
            </span>
          </p>
        </div>
      </div>

      {plan.note && <p className="mt-3.5 text-[0.95rem] leading-snug text-foreground/85">&ldquo;{plan.note}&rdquo;</p>}

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <MemberAvatar photo={plan.host.photo} name={plan.host.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {plan.host.isYou ? "You" : plan.host.name}
              <span className="font-normal text-muted-foreground"> · {plan.host.year}</span>
            </p>
            <ReputationLine reputation={plan.host.reputation} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {plan.companions.length > 0 && <AvatarStack people={plan.companions} size="xs" max={3} />}
          <StatusChips plan={plan} />
          <ArrowUpRight
            className="size-4 text-muted-foreground transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground"
            strokeWidth={1.75}
          />
        </div>
      </div>
      {plan.sharedInterests > 0 && !plan.host.isYou && (
        <p className="mt-2 text-xs text-muted-foreground">
          {plan.sharedInterests} shared interest{plan.sharedInterests === 1 ? "" : "s"}
        </p>
      )}
    </Link>
  );
}
