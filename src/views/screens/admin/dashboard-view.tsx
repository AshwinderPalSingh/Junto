"use client";

import { Flag } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/views/components/bits";
import type { AdminMetricsVM } from "@/views/view-models";
import { ActivityChart, FulfilmentChart, Meter } from "./charts";

const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="bg-background/70 p-4 backdrop-blur-md">
      <p className="label-caps text-[0.6rem] text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-3xl tracking-tight">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RateTile({
  label,
  value,
  sample,
  hint,
}: {
  label: string;
  value: number | null;
  sample: string;
  hint: string;
}) {
  return (
    <div className="bg-background/70 p-4 backdrop-blur-md">
      <p className="label-caps text-[0.6rem] text-muted-foreground">{label}</p>
      <p className="mt-2 font-mono text-3xl tracking-tight">{pct(value)}</p>
      {value !== null && <Meter value={value} label={label} />}
      <p className="mt-2 text-xs text-muted-foreground">
        {sample} · {hint}
      </p>
    </div>
  );
}

function Grid({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <section className={`glass animate-glass-in grid gap-px overflow-hidden bg-border p-0 ${className}`}>
      {children}
    </section>
  );
}

export function DashboardView({ metrics: m }: { metrics: AdminMetricsVM }) {
  const wait = m.medianMinutesToFirstRequest;
  const firstRequest =
    wait === null ? "—" : wait < 1 ? "<1 min" : wait < 60 ? `${Math.round(wait)} min` : `${(wait / 60).toFixed(1)} h`;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Moderation"
        title="How Junto is doing"
        description="Success is completed meetups, not sign-ups."
        action={
          m.openReports > 0 ? (
            <Link
              href="/admin/reports"
              className="inline-flex items-center gap-1.5 border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <Flag className="size-4" strokeWidth={1.75} /> {m.openReports} open
            </Link>
          ) : null
        }
      />

      <Grid className="grid-cols-2 sm:grid-cols-4">
        <Tile label="Members" value={m.members.toLocaleString("en-IN")} sub={`${m.active7} active this week`} />
        <Tile label="Free right now" value={m.freeNow} />
        <Tile label="Open plans" value={m.openNow} />
        <Tile label="Plans this week" value={m.plansPosted7} />
      </Grid>

      <Grid className="sm:grid-cols-3">
        <RateTile
          label="Fulfilment"
          value={m.fulfilmentRate}
          sample={`${m.fulfilmentSample} plans`}
          hint="found at least one companion"
        />
        <RateTile
          label="Completion"
          value={m.completionRate}
          sample={`${m.completionSample} confirmed spots`}
          hint="turned into a real meetup"
        />
        <RateTile label="Repeat use" value={m.repeatRate} sample="14 days" hint="members with 2+ meetups" />
      </Grid>

      <Grid className="grid-cols-1 sm:grid-cols-3">
        <Tile label="First request" value={firstRequest} sub="median wait" />
        <Tile label="New connections" value={m.newConnections14} sub="first-time pairs, 14 days" />
        <Tile
          label="Reports / 100"
          value={m.reportsPer100 === null ? "—" : m.reportsPer100.toFixed(1)}
          sub={`meetups (${m.meetups14} in 14 days)`}
        />
      </Grid>

      <FulfilmentChart days={m.days} />
      <ActivityChart rows={m.byActivity} />
    </div>
  );
}
