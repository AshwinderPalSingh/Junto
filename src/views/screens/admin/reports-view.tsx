"use client";

import { ArrowRight, CheckCircle2, Inbox } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { idleState, type ActionState } from "@/lib/action";
import { cn } from "@/lib/utils";
import { PageHeader, Pill } from "@/views/components/bits";
import { SubmitButton } from "@/views/components/form-bits";
import { RelativeTime } from "@/views/components/relative-time";
import { useActionToast } from "@/views/hooks/use-action-toast";
import { Checkbox } from "@/views/ui/checkbox";
import { Field, FieldLabel } from "@/views/ui/field";
import { Textarea } from "@/views/ui/textarea";
import type { AdminPersonVM, AdminReportVM } from "@/views/view-models";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function Person({ person, label }: { person: AdminPersonVM; label: string }) {
  return (
    <div className="flex items-center gap-3">
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.photoUrl} alt="" className="size-10 object-cover ring-1 ring-border" />
      ) : (
        <span className="size-10 bg-muted" />
      )}
      <div className="min-w-0">
        <p className="label-caps text-[0.58rem] text-muted-foreground">{label}</p>
        <p className="flex items-center gap-2 truncate text-sm font-medium">
          {person.name} {person.status === "suspended" && <Pill tone="destructive">Suspended</Pill>}
        </p>
        <p className="truncate font-mono text-xs text-muted-foreground">{person.email}</p>
      </div>
    </div>
  );
}

function ReportCard({ report, now, closeReport }: { report: AdminReportVM; now: string; closeReport: Action }) {
  const [state, action] = useActionState(closeReport, idleState);
  useActionToast(state);
  const open = report.status === "open";
  return (
    <li className={cn("glass animate-glass-in space-y-4 p-5", open && "border-destructive/30")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Pill tone={open ? "destructive" : "muted"}>{report.categoryLabel}</Pill>
        <span className="font-mono text-xs text-muted-foreground">
          <RelativeTime date={report.createdAt} serverNow={now} />
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Person person={report.reported} label={`Reported · ${report.reported.reportsAgainst} in total`} />
        <Person person={report.reporter} label="Reported by" />
      </div>
      {report.details && (
        <p className="border-l-2 border-foreground bg-muted/50 p-3 text-sm">{report.details}</p>
      )}
      {report.plan && (
        <Link
          href={`/plans/${report.plan.id}`}
          className="group inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
        >
          Plan: {report.plan.label}{" "}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
      {open ? (
        <form action={action} className="space-y-3 border-t border-border pt-4">
          <input type="hidden" name="reportId" value={report.id} />
          <Textarea name="note" placeholder="Resolution note (visible to moderators)" className="min-h-16" />
          <Field orientation="horizontal">
            <Checkbox id={`suspend-${report.id}`} name="suspend" />
            <FieldLabel htmlFor={`suspend-${report.id}`} className="font-normal">
              Suspend {report.reported.name}
            </FieldLabel>
          </Field>
          <div className="flex gap-2">
            <SubmitButton name="outcome" value="resolved">
              Resolve
            </SubmitButton>
            <SubmitButton name="outcome" value="dismissed" variant="outline">
              Dismiss
            </SubmitButton>
          </div>
        </form>
      ) : (
        <p className="flex items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4" strokeWidth={1.75} />{" "}
          {report.status === "resolved" ? "Resolved" : "Dismissed"}
          {report.resolution ? ` · ${report.resolution}` : ""}
        </p>
      )}
    </li>
  );
}

export function ReportsView({
  view,
  reports,
  now,
  closeReport,
}: {
  view: "open" | "closed";
  reports: AdminReportVM[];
  now: string;
  closeReport: Action;
}) {
  return (
    <div>
      <PageHeader
        eyebrow="Moderation"
        title="Reports"
        description="Every report is read by a person. Act on patterns, not single claims."
      />
      <div className="glass mb-6 inline-flex gap-0.5 p-0.5 text-sm">
        {(["open", "closed"] as const).map((v) => (
          <Link
            key={v}
            href={v === "open" ? "/admin/reports" : "/admin/reports?status=closed"}
            className={cn(
              "px-4 py-1.5 font-medium capitalize transition-colors",
              view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v}
          </Link>
        ))}
      </div>
      {reports.length === 0 ? (
        <div className="glass border-dashed p-12 text-center">
          <Inbox className="mx-auto size-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-3 text-muted-foreground">
            {view === "open" ? "No open reports. All clear." : "No closed reports yet."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} now={now} closeReport={closeReport} />
          ))}
        </ul>
      )}
    </div>
  );
}
