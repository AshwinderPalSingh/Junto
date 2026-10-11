"use client";

import { Clock3, LogOut, ShieldCheck, Star } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RULES } from "@/config/app";
import { formatClock, formatDay } from "@/lib/time";
import { useNow } from "@/views/hooks/use-now";
import { Logo } from "@/views/components/logo";
import { Button } from "@/views/ui/button";

export function RestrictionView({ vm, signOut }: {
  vm: { now: string; until: string; rating: number | null; noShows: number; lateCancels: number };
  signOut: () => Promise<void>;
}) {
  const now = new Date(useNow(vm.now));
  const router = useRouter();
  const remaining = Math.max(0, new Date(vm.until).getTime() - now.getTime());
  useEffect(() => { if (remaining === 0) router.refresh(); }, [remaining, router]);
  const totalMinutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6 py-12">
      <Logo />
      <Clock3 className="mt-12 size-10 text-primary" strokeWidth={1.5} />
      <h1 className="mt-5 text-3xl">A short pause</h1>
      <p className="mt-4 leading-relaxed text-muted-foreground">Your reliability rating fell below {RULES.ratingRestrictionThreshold} / 5. Meetups and messaging are paused for two days. Your account and history are still here.</p>
      <div className="mt-7 flex items-center justify-between border-y border-border py-5">
        <span className="flex items-center gap-2"><Star className="size-4 text-warning" /> {vm.rating?.toFixed(1) ?? "--"} / 5</span>
        <span className="font-mono">{hours}h {minutes}m remaining</span>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{vm.noShows} confirmed no-shows · {vm.lateCancels} late cancellations. Access returns {formatDay(vm.until, now).toLowerCase()} at {formatClock(vm.until)}.</p>
      <p className="mt-4 text-sm text-muted-foreground">Upcoming commitments were cancelled without another rating penalty. The people involved have been notified.</p>
      <p className="mt-5 text-sm leading-relaxed text-muted-foreground">Think a report is wrong? Contact a Junto moderator through the student welfare office. A dismissed report restores your rating. Declines, early cancellations and safety cancellations never lower it.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="outline"><Link href="/safety"><ShieldCheck /> Safety centre</Link></Button>
        <form action={signOut}><Button variant="ghost" type="submit"><LogOut /> Sign out</Button></form>
      </div>
    </main>
  );
}
