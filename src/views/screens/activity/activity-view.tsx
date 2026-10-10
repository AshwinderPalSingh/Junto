"use client";

import { ArrowRight, CalendarPlus, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { PageHeader, Pill } from "@/views/components/bits";
import { PlanCard } from "@/views/components/plan-card";
import { Button } from "@/views/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/views/ui/tabs";
import type { MyPlansVM, PlanCardVM } from "@/views/view-models";

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass animate-glass-in border-dashed px-6 py-12 text-center">
      <p className="text-lg tracking-[-0.02em]">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
      <Button asChild variant="outline" className="mt-5">
        <Link href="/board">
          Browse the board <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}

function List({ plans, now }: { plans: PlanCardVM[]; now: string }) {
  return (
    <div className="space-y-3">
      {plans.map((p, i) => (
        <div key={p.id} className="animate-glass-in" style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}>
          <PlanCard plan={p} now={now} />
        </div>
      ))}
    </div>
  );
}

export function ActivityView({ vm }: { vm: MyPlansVM }) {
  const feedbackCount = vm.past.filter((p) => p.needsFeedback).length;
  return (
    <div>
      <PageHeader
        eyebrow="Activity"
        title="My plans"
        description="Everything you're hosting, joining or waiting on."
        action={
          <Button asChild variant="outline">
            <Link href="/plans/new">
              <CalendarPlus /> New
            </Link>
          </Button>
        }
      />
      <Tabs defaultValue={vm.upcoming.length || !vm.requested.length ? "upcoming" : "requested"}>
        <TabsList className="mb-6 grid w-full grid-cols-3">
          <TabsTrigger value="upcoming">
            Upcoming <span className="font-mono text-[0.7rem] opacity-60">{vm.upcoming.length}</span>
          </TabsTrigger>
          <TabsTrigger value="requested">
            Requests <span className="font-mono text-[0.7rem] opacity-60">{vm.requested.length}</span>
          </TabsTrigger>
          <TabsTrigger value="past">
            Past
            {feedbackCount > 0 && <span className="size-1.5 bg-current" aria-label="feedback due" />}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          {vm.upcoming.length ? (
            <List plans={vm.upcoming} now={vm.now} />
          ) : (
            <Empty title="Nothing planned yet" body="Join something on the board or post your own plan." />
          )}
        </TabsContent>
        <TabsContent value="requested">
          {vm.requested.length ? (
            <List plans={vm.requested} now={vm.now} />
          ) : (
            <Empty
              title="No pending requests"
              body="When you ask to join a plan, it waits here until the host replies."
            />
          )}
        </TabsContent>
        <TabsContent value="past">
          {vm.past.length ? (
            <div className="space-y-4">
              {vm.past.map((p) => (
                <div key={p.id} className="animate-glass-in space-y-2">
                  <PlanCard plan={p} now={vm.now} className="opacity-85" />
                  <div className="flex items-center justify-between px-1">
                    <Pill tone={p.outcome === "Met up" ? "solid" : "muted"}>{p.outcome}</Pill>
                    {p.needsFeedback && (
                      <Link
                        href={`/plans/${p.id}`}
                        className="inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
                      >
                        <MessageSquareText className="size-4" strokeWidth={1.75} /> Leave feedback
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="No past plans yet" body="Your meetups from the last 30 days will show up here." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
