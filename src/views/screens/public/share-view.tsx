import { Clock, MapPin, Phone, ShieldCheck, Users } from "lucide-react";
import { APP } from "@/config/app";
import { formatClock, formatDay } from "@/lib/time";
import { ActivityTile } from "@/views/components/activity-tile";
import { LiveDot } from "@/views/components/bits";
import { Logo } from "@/views/components/logo";
import type { ShareVM } from "@/views/view-models";

const STATUS_COPY: Record<ShareVM["status"], string> = {
  open: "Planned",
  full: "Planned",
  completed: "Finished",
  cancelled: "Cancelled",
  expired: "Didn't happen",
};

/** Read-only meetup card for a trusted contact. */
export function ShareView({ vm }: { vm: ShareVM }) {
  const nowMs = new Date(vm.now).getTime();
  const live =
    vm.status !== "cancelled" && new Date(vm.startsAt).getTime() <= nowMs && new Date(vm.endsAt).getTime() > nowMs;
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 py-8">
      <Logo />
      <main className="mt-12 flex-1 animate-glass-in">
        <p className="label-caps text-muted-foreground">{vm.sharer} shared this meetup with you</p>
        <div className="glass-strong mt-4 p-6">
          <div className="flex items-center gap-4">
            <ActivityTile activity={vm.activity} size="lg" className="bg-primary text-primary-foreground" />
            <div>
              <h1 className="text-2xl tracking-[-0.03em]">{vm.activity.label}</h1>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                {live && <LiveDot className="size-1.5" />}
                {live ? "Happening now" : STATUS_COPY[vm.status]}
              </p>
            </div>
          </div>
          <dl className="mt-6 divide-y divide-border border-y border-border text-sm">
            <div className="flex gap-3 py-3">
              <dt className="sr-only">Where</dt>
              <MapPin className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <dd>
                {vm.spot.name} <span className="text-muted-foreground">({vm.spot.area})</span>
              </dd>
            </div>
            <div className="flex gap-3 py-3">
              <dt className="sr-only">When</dt>
              <Clock className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <dd>
                {formatDay(vm.startsAt, vm.now)}, {formatClock(vm.startsAt)} – {formatClock(vm.endsAt)}
              </dd>
            </div>
            <div className="flex gap-3 py-3">
              <dt className="sr-only">Who</dt>
              <Users className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <dd>With {vm.people.length ? vm.people.join(", ") : "nobody yet"}</dd>
            </div>
          </dl>
        </div>
        <div className="glass mt-4 space-y-3 p-5 text-sm">
          <p className="flex gap-2.5 font-medium">
            <ShieldCheck className="size-4 shrink-0" strokeWidth={1.75} /> Everyone on this plan is a verified{" "}
            {APP.campusShort} student.
          </p>
          <p className="flex gap-2.5 text-muted-foreground">
            <Phone className="size-4 shrink-0" strokeWidth={1.75} /> If you can&apos;t reach{" "}
            {vm.sharer.split(" ")[0]} and you&apos;re worried, call 112 or campus security.
          </p>
        </div>
      </main>
      <p className="mt-8 text-center text-xs text-muted-foreground">This link expires a few hours after the meetup.</p>
    </div>
  );
}
