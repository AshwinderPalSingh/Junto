"use client";

import { Check, Eye, Info, Minus, Plus, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { RULES } from "@/config/app";
import { ACTIVITIES, getActivity, getSpot, SPOTS } from "@/config/campus";
import { GENDERS } from "@/config/profile";
import { idleState, type ActionState } from "@/lib/action";
import {
  addMinutes,
  campusHHMM,
  campusTimeToDate,
  formatDuration,
  formatHHMM,
  roundUpMinutes,
} from "@/lib/time";
import { cn } from "@/lib/utils";
import { ActivityTile } from "@/views/components/activity-tile";
import { PageHeader } from "@/views/components/bits";
import { ChoiceChip } from "@/views/components/choice";
import { FormMessage, SubmitButton, fieldError } from "@/views/components/form-bits";
import { PlanCard } from "@/views/components/plan-card";
import { Button } from "@/views/ui/button";
import { FieldError } from "@/views/ui/field";
import { Input } from "@/views/ui/input";
import { Textarea } from "@/views/ui/textarea";
import type { NewPlanVM, PlanCardVM } from "@/views/view-models";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const WHEN_OPTIONS = [
  { id: "now", label: "Now" },
  { id: "15", label: "In 15 min" },
  { id: "30", label: "In 30 min" },
  { id: "60", label: "In 1 hour" },
  { id: "custom", label: "Pick a time" },
] as const;

const NOTE_PLACEHOLDERS: Record<string, string> = {
  chai: "Need a break after the lab",
  meal: "Trying the new rolls place",
  walk: "Slow evening walk, good playlists",
  games: "Pool doubles? Beginners welcome",
  sports: "Badminton, spare racket available",
  errand: "Picking up stationery and snacks",
  study: "Quiet pomodoro sprint before the quiz",
};

/** Plain-language summary of who will be able to see a plan. */
function audienceLine(allowed: string[]) {
  if (allowed.length === 0) return "Pick at least one group, or nobody will see this plan.";
  if (allowed.length === GENDERS.length) return "Everyone who's comfortable meeting you will see this plan.";
  const names = GENDERS.filter((g) => allowed.includes(g.id)).map((g) => g.plural.toLowerCase());
  const missing = GENDERS.filter((g) => !allowed.includes(g.id)).map((g) => g.plural.toLowerCase());
  return `Only ${names.join(" and ")} will see this plan. It stays hidden from ${missing.join(" and ")}.`;
}

function Step({
  n,
  title,
  children,
  aside,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3.5">
      <legend className="flex w-full items-center justify-between gap-3">
        <span className="flex items-baseline gap-3">
          <span className="font-mono text-xs text-muted-foreground">{String(n).padStart(2, "0")}</span>
          <span className="text-lg tracking-[-0.02em]">{title}</span>
        </span>
        {aside}
      </legend>
      {children}
    </fieldset>
  );
}

export function NewPlanView({ vm, createPlan }: { vm: NewPlanVM; createPlan: Action }) {
  const [state, formAction] = useActionState(createPlan, idleState);
  const [activity, setActivity] = useState(vm.presetActivity ?? "chai");
  const [spot, setSpot] = useState<string>(activity === "study" ? "library" : "cafeteria");
  const [when, setWhen] = useState<(typeof WHEN_OPTIONS)[number]["id"]>("30");
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [time, setTime] = useState(() => campusHHMM(roundUpMinutes(addMinutes(vm.now, 60), 15)));
  const [duration, setDuration] = useState<number>(getActivity(activity).defaultDuration);
  const [capacity, setCapacity] = useState(1);
  const [note, setNote] = useState("");
  const [allowed, setAllowed] = useState<string[]>(vm.defaultAllowed);
  const atLimit = vm.activeHosted >= vm.maxHosted;

  const startsAt =
    when === "now"
      ? new Date(vm.now)
      : when === "custom"
        ? campusTimeToDate(vm.now, day === "tomorrow" ? 1 : 0, time || "18:00")
        : roundUpMinutes(addMinutes(vm.now, Number(when)), 5);
  const a = getActivity(activity);
  const s = getSpot(spot);
  const preview: PlanCardVM = {
    id: "preview",
    activity: { id: a.id, label: a.label, short: a.short, icon: a.icon, hint: a.hint },
    spot: { id: s.id, name: s.name, area: s.area },
    note: note.trim() || null,
    startsAt: startsAt.toISOString(),
    endsAt: addMinutes(startsAt, duration).toISOString(),
    durationMinutes: duration,
    capacity,
    joined: 0,
    spotsLeft: capacity,
    isGroup: capacity > 1,
    status: "open",
    host: vm.host,
    companions: [],
    my: { role: "host", status: "accepted" },
    sharedInterests: 0,
    pendingRequests: 0,
  };
  const free = vm.freeCounts[activity] ?? 0;

  return (
    <div>
      <PageHeader eyebrow="New plan" title="Post a plan" description="Ten seconds. You can always cancel." />

      {atLimit && (
        <div className="glass mb-8 flex gap-3 border-foreground/40 p-4 text-sm">
          <Info className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
          <p>
            You&apos;re hosting {vm.activeHosted} upcoming plans, the most at once is {vm.maxHosted}.{" "}
            <Link href="/activity" className="font-medium underline underline-offset-2">
              Manage your plans
            </Link>
            .
          </p>
        </div>
      )}

      <form action={formAction} className="space-y-10">
        <Step
          n={1}
          title="What?"
          aside={
            free > 0 ? (
              <span className="inline-flex items-center gap-1.5 border border-foreground/25 px-2.5 py-1 text-xs font-medium">
                <Zap className="size-3" strokeWidth={2} /> {free} free {free === 1 ? "person is" : "people are"} up for
                this
              </span>
            ) : null
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ACTIVITIES.map((option) => (
              <label
                key={option.id}
                className="group glass glass-sheen flex cursor-pointer flex-col items-center gap-2.5 p-3.5 text-center transition-[border-color,box-shadow] hover:border-foreground/25 has-[:checked]:border-foreground has-[:checked]:shadow-[inset_0_0_0_1px_var(--foreground)] has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40"
              >
                <input
                  type="radio"
                  name="activity"
                  value={option.id}
                  checked={activity === option.id}
                  onChange={() => {
                    setActivity(option.id);
                    setDuration(option.defaultDuration);
                    if (option.id === "study") setSpot("library");
                    if (option.id === "sports") setSpot("sports-complex");
                    if (option.id === "errand") setSpot("market");
                  }}
                  className="peer sr-only"
                />
                <ActivityTile
                  activity={option}
                  size="md"
                  className="transition-colors group-has-[:checked]:bg-primary group-has-[:checked]:text-primary-foreground"
                />
                <span className="text-sm leading-tight font-medium">{option.label}</span>
                <span className="text-[11px] leading-tight text-muted-foreground">{option.hint}</span>
              </label>
            ))}
          </div>
        </Step>

        <Step n={2} title="Where?">
          <div className="flex flex-wrap gap-1.5">
            {SPOTS.map((option) => (
              <ChoiceChip
                key={option.id}
                type="radio"
                name="spot"
                value={option.id}
                checked={spot === option.id}
                onChange={() => setSpot(option.id)}
              >
                {option.name}
              </ChoiceChip>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Only public campus spots. Never hostels or vehicles.</p>
        </Step>

        <Step n={3} title="When?">
          <div className="flex flex-wrap gap-1.5">
            {WHEN_OPTIONS.map((option) => (
              <ChoiceChip
                key={option.id}
                type="radio"
                name="when"
                value={option.id}
                checked={when === option.id}
                onChange={() => setWhen(option.id)}
              >
                {option.label}
              </ChoiceChip>
            ))}
          </div>
          {when === "custom" && (
            <div className="glass flex animate-glass-in flex-wrap items-center gap-3 p-3">
              <div className="inline-flex border border-border p-0.5">
                {(["today", "tomorrow"] as const).map((d) => (
                  <label
                    key={d}
                    className="cursor-pointer px-3.5 py-1.5 text-sm font-medium capitalize text-muted-foreground transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground"
                  >
                    <input
                      type="radio"
                      name="day"
                      value={d}
                      checked={day === d}
                      onChange={() => setDay(d)}
                      className="sr-only"
                    />
                    {d}
                  </label>
                ))}
              </div>
              <Input
                type="time"
                name="time"
                value={time}
                step={300}
                onChange={(e) => setTime(e.target.value)}
                className="w-36"
                aria-label="Start time"
              />
              <span className="text-xs text-muted-foreground">
                Between {formatHHMM(vm.campusHours.open)} and {formatHHMM(vm.campusHours.close)}
              </span>
              <FieldError>{fieldError(state, "time")}</FieldError>
            </div>
          )}
        </Step>

        <Step n={4} title="For how long?">
          <div className="flex flex-wrap gap-1.5">
            {RULES.durations.map((d) => (
              <ChoiceChip
                key={d}
                type="radio"
                name="duration"
                value={String(d)}
                checked={duration === d}
                onChange={() => setDuration(d)}
              >
                {formatDuration(d)}
              </ChoiceChip>
            ))}
          </div>
        </Step>

        <Step n={5} title="How many companions?">
          <div className="glass flex items-center gap-4 p-3">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={() => setCapacity((c) => Math.max(RULES.minCapacity, c - 1))}
              disabled={capacity <= RULES.minCapacity}
              aria-label="Fewer people"
            >
              <Minus />
            </Button>
            <div className="flex-1 text-center">
              <p key={capacity} className="animate-glass-in font-mono text-3xl tracking-tight">
                {capacity}
              </p>
              <p className="text-xs text-muted-foreground">
                {capacity === 1 ? "Just one person (one-on-one)" : `A small group: ${capacity} people plus you`}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={() => setCapacity((c) => Math.min(RULES.maxCapacity, c + 1))}
              disabled={capacity >= RULES.maxCapacity}
              aria-label="More people"
            >
              <Plus />
            </Button>
            <input type="hidden" name="capacity" value={capacity} />
          </div>
          {capacity === 1 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5" strokeWidth={1.75} /> Groups fill faster and often feel easier for a first
              meetup.
            </p>
          )}
        </Step>

        <Step n={6} title="Who can join?">
          <div className="flex flex-wrap gap-1.5">
            {GENDERS.map((g) => (
              <ChoiceChip
                key={g.id}
                name="allowedGenders"
                value={g.id}
                checked={allowed.includes(g.id)}
                onChange={(e) =>
                  setAllowed((cur) => (e.target.checked ? [...cur, g.id] : cur.filter((x) => x !== g.id)))
                }
              >
                {allowed.includes(g.id) && <Check className="size-3.5" strokeWidth={2.5} />}
                {g.plural}
              </ChoiceChip>
            ))}
          </div>
          <FieldError>{fieldError(state, "allowedGenders")}</FieldError>
          <p
            aria-live="polite"
            className={cn(
              "flex items-start gap-2 border px-3 py-2.5 text-sm",
              allowed.length === GENDERS.length ? "border-border text-muted-foreground" : "border-foreground/40",
            )}
          >
            <Eye className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
            <span>{audienceLine(allowed)}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            Pre-filled from your private preferences. People also only see plans from hosts they&apos;re comfortable
            with.
          </p>
        </Step>

        <Step
          n={7}
          title="Add a note"
          aside={
            <span className="font-mono text-xs text-muted-foreground">
              {note.length}/{RULES.noteMaxLength}
            </span>
          }
        >
          <Textarea
            name="note"
            value={note}
            maxLength={RULES.noteMaxLength}
            onChange={(e) => setNote(e.target.value)}
            placeholder={NOTE_PLACEHOLDERS[activity]}
            className="min-h-20"
          />
        </Step>

        <section aria-label="Preview" className="space-y-3">
          <p className="label-caps text-muted-foreground">Preview</p>
          <div className="pointer-events-none select-none" aria-hidden="true">
            <PlanCard plan={preview} now={vm.now} />
          </div>
        </section>

        <FormMessage state={state} />
        <div className="sticky bottom-24 z-10 lg:bottom-4">
          <SubmitButton size="xl" disabled={atLimit} className="w-full text-base shadow-2xl" pendingLabel="Posting…">
            Post plan
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
