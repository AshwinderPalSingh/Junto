"use client";

import { EyeOff, Zap } from "lucide-react";
import { useActionState } from "react";
import { RULES } from "@/config/app";
import { ACTIVITIES } from "@/config/campus";
import { idleState, type ActionState } from "@/lib/action";
import { formatClock, formatDuration } from "@/lib/time";
import { LiveDot, PageHeader, SectionTitle } from "@/views/components/bits";
import { ChoiceChip } from "@/views/components/choice";
import { FormMessage, SubmitButton } from "@/views/components/form-bits";
import { Icon } from "@/views/components/icons";
import { PlanCard } from "@/views/components/plan-card";
import { RelativeTime } from "@/views/components/relative-time";
import { useActionToast } from "@/views/hooks/use-action-toast";
import type { FreeVM } from "@/views/view-models";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function FreeView({ vm, goFree, stopFree }: { vm: FreeVM; goFree: Action; stopFree: Action }) {
  const [goState, goAction] = useActionState(goFree, idleState);
  const [stopState, stopAction] = useActionState(stopFree, idleState);
  useActionToast(goState);
  useActionToast(stopState);
  const current = vm.current;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Availability"
        title="I'm free"
        description="No plan yet? Say so, and we'll match you with plans as they go up."
      />

      {current ? (
        <section className="relative animate-glass-in overflow-hidden bg-primary p-6 text-primary-foreground sm:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.1] [background-image:linear-gradient(currentColor_1px,transparent_1px),linear-gradient(90deg,currentColor_1px,transparent_1px)] [background-size:28px_28px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/15 to-transparent"
          />
          <Zap aria-hidden="true" className="absolute -right-6 -bottom-8 size-40 opacity-10" strokeWidth={1} />
          <p className="relative flex items-center gap-2 label-caps opacity-80">
            <LiveDot className="size-1.5 [&>span]:bg-primary-foreground" /> You&apos;re free
          </p>
          <p className="relative mt-3 font-mono text-4xl tracking-tight">Until {formatClock(current.until)}</p>
          <p className="relative mt-2 text-sm opacity-75">
            Ends <RelativeTime date={current.until} serverNow={vm.now} /> ·{" "}
            {current.activities.length === 0
              ? "up for anything"
              : `up for ${ACTIVITIES.filter((a) => current.activities.includes(a.id))
                  .map((a) => a.short.toLowerCase())
                  .join(", ")}`}
          </p>
          <form action={stopAction} className="relative mt-6">
            <SubmitButton
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              I&apos;m not free any more
            </SubmitButton>
          </form>
        </section>
      ) : null}

      <form action={goAction} className="glass animate-glass-in space-y-7 p-5 sm:p-6">
        <div>
          <p className="text-lg tracking-[-0.02em]">{current ? "Change your window" : "How long are you free?"}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {RULES.freeDurations.map((m, i) => (
              <ChoiceChip key={m} type="radio" name="minutes" value={String(m)} defaultChecked={i === 1}>
                {formatDuration(m)}
              </ChoiceChip>
            ))}
          </div>
        </div>
        <div>
          <p className="text-lg tracking-[-0.02em]">Up for</p>
          <p className="text-sm text-muted-foreground">Leave all unticked for &ldquo;anything&rdquo;.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ACTIVITIES.map((a) => (
              <ChoiceChip
                key={a.id}
                name="activities"
                value={a.id}
                defaultChecked={current?.activities.includes(a.id)}
              >
                <Icon name={a.icon} className="size-3.5" /> {a.short}
              </ChoiceChip>
            ))}
          </div>
        </div>
        <FormMessage state={goState} />
        <SubmitButton size="xl" className="glass-sheen w-full text-base">
          <Zap /> {current ? "Update" : "I'm free"}
        </SubmitButton>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <EyeOff className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
          Nobody sees a list of free people. Hosts only see a count, and you&apos;re only told about plans you&apos;d
          fit.
        </p>
      </form>

      <section>
        <SectionTitle
          aside={
            vm.freeCount > 0 ? (
              <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                <LiveDot className="size-1.5" /> {vm.freeCount} other{vm.freeCount === 1 ? "" : "s"} free now
              </span>
            ) : undefined
          }
        >
          {current ? "Plans that fit your window" : "Happening in the next few hours"}
        </SectionTitle>
        {vm.matchingPlans.length ? (
          <div className="space-y-3">
            {vm.matchingPlans.map((p) => (
              <PlanCard key={p.id} plan={p} now={vm.now} />
            ))}
          </div>
        ) : (
          <p className="glass border-dashed p-6 text-center text-sm text-muted-foreground">
            Nothing that fits yet. Stay free and you&apos;ll hear the moment someone posts.
          </p>
        )}
      </section>
    </div>
  );
}
