"use client";

import { ArrowRight, ArrowUpRight, BellRing, LayoutGrid, MessageSquareText, Plus, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { ACTIVITIES } from "@/config/campus";
import { formatClock } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ActivityTile } from "@/views/components/activity-tile";
import { LiveDot, SectionTitle } from "@/views/components/bits";
import { Icon } from "@/views/components/icons";
import { PlanCard } from "@/views/components/plan-card";
import { Button } from "@/views/ui/button";
import type { BoardVM, PlanCardVM } from "@/views/view-models";

const SOON_MS = 60 * 60_000;

function FeedList({ plans, now }: { plans: PlanCardVM[]; now: string }) {
  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {plans.map((plan, i) => (
          <motion.div
            key={plan.id}
            layout
            initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { delay: Math.min(i, 6) * 0.04 } }}
            exit={{ opacity: 0, scale: 0.98, filter: "blur(6px)" }}
          >
            <PlanCard plan={plan} now={now} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function BoardView({ vm }: { vm: BoardVM }) {
  const [filter, setFilter] = useState("all");
  const nowMs = new Date(vm.now).getTime();
  const visible = filter === "all" ? vm.plans : vm.plans.filter((p) => p.activity.id === filter);
  const soon = visible.filter((p) => new Date(p.startsAt).getTime() - nowMs <= SOON_MS);
  const later = visible.filter((p) => new Date(p.startsAt).getTime() - nowMs > SOON_MS);
  const counts = new Map<string, number>();
  for (const p of vm.plans) counts.set(p.activity.id, (counts.get(p.activity.id) ?? 0) + 1);
  const filters = [{ id: "all", short: "All", icon: "" }, ...ACTIVITIES];

  return (
    <div className="space-y-10">
      {vm.welcome && (
        <motion.div
          initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          className="relative overflow-hidden rounded-lg bg-primary p-6 text-primary-foreground"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:28px_28px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/15 to-transparent"
          />
          <p className="relative label-caps opacity-70">Welcome to Junto</p>
          <p className="relative mt-2 text-2xl tracking-[-0.03em]">You&apos;re in, {vm.firstName}.</p>
          <p className="relative mt-1.5 max-w-sm text-sm opacity-75">
            Join a plan below, post your own, or tap &ldquo;I&apos;m free&rdquo; and we&apos;ll let you know when
            something fits.
          </p>
        </motion.div>
      )}

      <header className="board-header relative isolate overflow-hidden px-6 py-8 text-white animate-glass-in">
        <Image src="/images/thapar-courtyard.webp" alt="Thapar's red-brick courtyard" fill loading="eager" fetchPriority="high" sizes="(max-width: 1024px) 100vw, 768px" className="-z-20 object-cover object-[center_55%]" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#211324]/50" />
        <p className="label-caps text-white/85">
          {vm.greeting}, {vm.firstName}
        </p>
        <h1 className="mt-2 text-[2.25rem] leading-[1.02] tracking-[-0.04em] sm:text-[2.75rem]">What are you up to?</h1>
      </header>

      {/* One-tap posting */}
      <section aria-label="Post a plan in one tap" className="-mx-4 overflow-x-auto px-4 scrollbar-none">
        <div className="flex gap-2 pb-1 sm:grid sm:grid-cols-7">
          {ACTIVITIES.map((a, i) => (
            <Link
              key={a.id}
              href={`/plans/new?activity=${a.id}`}
              style={{ animationDelay: `${i * 40}ms` }}
              className="group flex w-[4.75rem] shrink-0 animate-glass-in flex-col items-center gap-2 p-1.5 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:w-auto"
            >
              <ActivityTile
                activity={a}
                size="lg"
                className="transition-[transform,background-color,color] duration-300 group-hover:-translate-y-1 group-hover:bg-primary group-hover:text-primary-foreground group-active:scale-95"
              />
              <span className="text-xs leading-tight font-medium">{a.short}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Free status */}
      <section className={cn("glass flex items-center justify-between gap-3 p-4", vm.myFree && "border-foreground/40")}>
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center",
              vm.myFree ? "bg-primary text-primary-foreground" : "border border-border text-foreground",
            )}
          >
            <Zap className="size-[1.1rem]" strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            {vm.myFree ? (
              <>
                <p className="flex items-center gap-2 font-medium">
                  <LiveDot className="size-1.5" /> You&apos;re free until {formatClock(vm.myFree.until)}
                </p>
                <p className="text-xs text-muted-foreground">We&apos;ll let you know when a matching plan goes up.</p>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 font-medium">
                  {vm.freeCount > 0 && <LiveDot className="size-1.5" />}
                  {vm.freeCount === 0
                    ? "Free for a bit?"
                    : `${vm.freeCount} ${vm.freeCount === 1 ? "person is" : "people are"} free right now`}
                </p>
                <p className="text-xs text-muted-foreground">Go free and hear about plans you&apos;d like.</p>
              </>
            )}
          </div>
        </div>
        <Button asChild variant={vm.myFree ? "outline" : "default"} className="shrink-0">
          <Link href="/free">{vm.myFree ? "Change" : "I'm free"}</Link>
        </Button>
      </section>

      {(vm.hostRequests > 0 || vm.needsFeedback) && (
        <section className="space-y-2">
          {vm.hostRequests > 0 && (
            <Link
              href="/activity"
              className="group glass glass-sheen flex items-center gap-3 border-foreground/40 p-3.5 text-sm"
            >
              <BellRing className="size-5 shrink-0" strokeWidth={1.75} />
              <span className="flex-1">
                <strong className="font-semibold">{vm.hostRequests}</strong>{" "}
                {vm.hostRequests === 1 ? "person wants" : "people want"} to join your plans
              </span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          {vm.needsFeedback && (
            <Link
              href={`/plans/${vm.needsFeedback.planId}`}
              className="group glass glass-sheen flex items-center gap-3 p-3.5 text-sm"
            >
              <MessageSquareText className="size-5 shrink-0" strokeWidth={1.75} />
              <span className="flex-1">How did your {vm.needsFeedback.label} go? Takes 10 seconds.</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </section>
      )}

      {vm.mine.length > 0 && (
        <section>
          <SectionTitle>Coming up for you</SectionTitle>
          <FeedList plans={vm.mine} now={vm.now} />
        </section>
      )}

      <section>
        <div className="-mx-4 mb-5 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:overflow-visible sm:px-0">
          <div className="flex gap-1.5 sm:flex-wrap" role="tablist" aria-label="Filter by activity">
            {filters.map((a) => {
              const count = a.id === "all" ? vm.plans.length : (counts.get(a.id) ?? 0);
              const active = filter === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(a.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-[background-color,color,border-color] duration-300",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "glass text-muted-foreground hover:text-foreground",
                    count === 0 && !active && "opacity-50",
                  )}
                >
                  {a.icon ? (
                    <Icon name={a.icon} className="size-3.5" />
                  ) : (
                    <LayoutGrid className="size-3.5" strokeWidth={1.75} />
                  )}
                  {a.short}
                  <span className="font-mono text-[0.7rem] opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="glass border-dashed px-6 py-14 text-center">
            <span className="mx-auto grid size-12 animate-float place-items-center border border-border">
              <ArrowUpRight className="size-5" strokeWidth={1.5} />
            </span>
            <h2 className="mt-5 text-xl tracking-[-0.025em]">
              {vm.plans.length === 0 ? "No plans yet" : "Nothing for this activity yet"}
            </h2>
            <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
              Be the one who starts something. Plans posted 1–3 hours ahead fill up best.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button asChild>
                <Link href={filter === "all" ? "/plans/new" : `/plans/new?activity=${filter}`}>
                  <Plus /> Post a plan
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/free">
                  <Zap /> I&apos;m free
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-10">
            {soon.length > 0 && (
              <div>
                <SectionTitle aside={<LiveDot className="size-1.5" />}>Starting within the hour</SectionTitle>
                <FeedList plans={soon} now={vm.now} />
              </div>
            )}
            {later.length > 0 && (
              <div>
                <SectionTitle>Later</SectionTitle>
                <FeedList plans={later} now={vm.now} />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
