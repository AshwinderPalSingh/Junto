"use client";

import { ArrowLeft, CircleCheck, CircleSlash, Clock, Eye, Hourglass, MapPin, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { GENDERS } from "@/config/profile";
import { formatClock, formatDay, formatDuration } from "@/lib/time";
import { ActivityTile } from "@/views/components/activity-tile";
import { LiveDot, Pill } from "@/views/components/bits";
import { AvatarStack } from "@/views/components/member-avatar";
import { MemberCard } from "@/views/components/member-card";
import { MessageButton } from "@/views/components/message-button";
import { RelativeTime } from "@/views/components/relative-time";
import { ReportDialog } from "@/views/components/report-dialog";
import type { PlanDetailVM } from "@/views/view-models";
import {
  ChangePlansDialog,
  CheckInPanel,
  FeedbackForm,
  JoinPanel,
  MembersPanel,
  PlanChatPanel,
  PendingPanel,
  RequestsPanel,
  ShareButton,
  type PlanActions,
} from "./plan-panels";

function PhasePill({ vm }: { vm: PlanDetailVM }) {
  const { plan, phase } = vm;
  if (plan.status === "cancelled") return <Pill tone="destructive">Cancelled</Pill>;
  if (plan.status === "expired") return <Pill>Expired</Pill>;
  if (phase === "ended" || plan.status === "completed") return <Pill>Ended</Pill>;
  if (phase === "live")
    return (
      <Pill tone="solid">
        <LiveDot className="size-1.5 [&>span]:bg-primary-foreground" /> Happening now
      </Pill>
    );
  return (
    <Pill tone={phase === "soon" ? "solid" : "outline"}>
      Starts <RelativeTime date={plan.startsAt} serverNow={vm.now} />
    </Pill>
  );
}

function Notice({ icon: Icon, children, strong }: { icon: typeof Clock; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`glass flex animate-glass-in gap-3 p-4 text-sm ${strong ? "border-foreground/40" : ""}`}>
      <Icon className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} />
      <div>{children}</div>
    </div>
  );
}

export function PlanDetailView({
  vm,
  actions,
  justPosted,
}: {
  vm: PlanDetailVM;
  actions: PlanActions;
  justPosted: boolean;
}) {
  const { plan, viewer, can } = vm;
  const insider = viewer.role === "host" || viewer.role === "guest";
  const closed = plan.status === "cancelled" || plan.status === "expired";
  const hasCompanions = plan.joined > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href={insider ? "/activity" : "/board"}
          className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />{" "}
          {insider ? "My plans" : "Board"}
        </Link>
        <PhasePill vm={vm} />
      </div>

      {/* Hero */}
      <header className="glass-strong relative animate-glass-in overflow-hidden p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <ActivityTile activity={plan.activity} size="lg" className="bg-primary text-primary-foreground" />
          <div className="min-w-0">
            <p className="label-caps text-muted-foreground">
              {viewer.role === "host" ? "Your plan" : `Hosted by ${plan.host.name}`}
            </p>
            <h1 className="mt-1.5 text-[1.9rem] leading-[1.05] tracking-[-0.035em] sm:text-[2.4rem]">
              {plan.activity.label}
            </h1>
          </div>
        </div>
        <dl className="mt-6 grid gap-px border border-border bg-border sm:grid-cols-3">
          {[
            {
              icon: Clock,
              label: "When",
              value: `${formatDay(plan.startsAt, vm.now)} · ${formatClock(plan.startsAt)}`,
              sub: formatDuration(plan.durationMinutes),
            },
            { icon: MapPin, label: "Where", value: plan.spot.name, sub: plan.spot.area },
            {
              icon: Users,
              label: "Who",
              value: plan.isGroup ? `Group of ${plan.capacity + 1}` : "One-on-one",
              sub:
                closed || vm.phase === "ended" || plan.status === "completed"
                  ? `${plan.joined} joined`
                  : plan.spotsLeft > 0
                    ? `${plan.spotsLeft} spot${plan.spotsLeft === 1 ? "" : "s"} left`
                    : "Full",
            },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="bg-background/70 p-3.5 backdrop-blur-md">
              <dt className="flex items-center gap-1.5 label-caps text-[0.62rem] text-muted-foreground">
                <Icon className="size-3.5" strokeWidth={1.75} /> {label}
              </dt>
              <dd className="mt-1.5 text-sm font-semibold">{value}</dd>
              <dd className="text-xs text-muted-foreground">{sub}</dd>
            </div>
          ))}
        </dl>
        {viewer.role === "host" && plan.allowedGenders.length < GENDERS.length && (
          <p className="mt-3 flex items-center gap-2 border border-foreground/30 px-3 py-2 text-xs">
            <Eye className="size-3.5 shrink-0" strokeWidth={1.75} />
            Only visible to{" "}
            {GENDERS.filter((g) => plan.allowedGenders.includes(g.id))
              .map((g) => g.plural.toLowerCase())
              .join(" and ")}
            , as you chose when posting.
          </p>
        )}
        {plan.note && (
          <p className="mt-5 border-l-2 border-foreground pl-4 text-[15px] leading-relaxed">{plan.note}</p>
        )}
        {!insider && plan.companions.length > 0 && (
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <AvatarStack people={plan.companions} size="sm" />
            {plan.joined} already going
          </div>
        )}
      </header>

      {/* Status banners */}
      {justPosted && viewer.role === "host" && !closed && (
        <Notice icon={CircleCheck} strong>
          <strong className="font-semibold">Your plan is live.</strong> People who are free and comfortable with you have
          been told. You&apos;ll get a notification when someone asks to join.
        </Notice>
      )}
      {closed && (
        <Notice icon={CircleSlash}>
          {plan.status === "expired"
            ? "This plan ended without companions."
            : plan.removedByAdmin
              ? "This plan was removed by a moderator."
              : "This plan was cancelled."}
        </Notice>
      )}
      {viewer.role === "outsider" && viewer.participationStatus === "cancelled" && (
        <Notice icon={CircleSlash}>You left this plan.</Notice>
      )}

      {/* What this viewer can do */}
      {viewer.role === "outsider" && !closed && (
        <>
          <MemberCard
            member={plan.host}
            label="Host"
            action={
              vm.canMessageHost ? (
                <MessageButton memberId={plan.host.id} memberName={plan.host.firstName} action={actions.startChat} />
              ) : undefined
            }
          />
          {can.request ? (
            <JoinPanel vm={vm} action={actions.requestToJoin} />
          ) : (
            vm.requestBlockedReason && (
              <p className="glass p-4 text-sm text-muted-foreground">{vm.requestBlockedReason}</p>
            )
          )}
        </>
      )}

      {viewer.role === "requested" && (
        <>
          <PendingPanel vm={vm} action={actions.withdrawRequest} />
          <MemberCard
            member={plan.host}
            label="Host"
            action={
              vm.canMessageHost ? (
                <MessageButton memberId={plan.host.id} memberName={plan.host.firstName} action={actions.startChat} />
              ) : undefined
            }
          />
        </>
      )}

      {viewer.role === "host" && vm.requests.length > 0 && !closed && (
        <RequestsPanel vm={vm} action={actions.decideRequest} />
      )}

      {viewer.role === "host" && !hasCompanions && vm.requests.length === 0 && !closed && vm.phase !== "ended" && (
        <section className="glass border-dashed p-8 text-center">
          <span className="mx-auto grid size-12 animate-float place-items-center border border-border">
            <Hourglass className="size-5" strokeWidth={1.5} />
          </span>
          <p className="mt-4 font-semibold">Waiting for someone to ask</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Your plan is on the board for everyone it fits. Free members who match were notified.
          </p>
        </section>
      )}

      {insider && hasCompanions && (
        <>
          {can.checkIn && <CheckInPanel vm={vm} action={actions.checkIn} />}
          <MembersPanel vm={vm} actions={actions} />
          <PlanChatPanel vm={vm} actions={actions.chat} />
          {can.share && (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <ShareButton action={actions.createShareLink} />
              <Link
                href="/safety"
                className="inline-flex h-11 items-center justify-center gap-1.5 px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                <ShieldCheck className="size-4" strokeWidth={1.75} /> Safety tips
              </Link>
            </div>
          )}
        </>
      )}

      {vm.chat && !(insider && hasCompanions) && <PlanChatPanel vm={vm} actions={actions.chat} />}

      {can.feedback && <FeedbackForm vm={vm} action={actions.submitFeedback} />}
      {insider && viewer.feedbackDone && (
        <Notice icon={CircleCheck}>Thanks for your feedback on this one.</Notice>
      )}

      {(can.leave || can.cancelPlan) && (
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border pt-4">
          {can.leave && <ChangePlansDialog mode="leave" action={actions.leavePlan} startsAt={plan.startsAt} />}
          {can.cancelPlan && <ChangePlansDialog mode="cancel" action={actions.cancelPlan} startsAt={plan.startsAt} />}
        </div>
      )}

      {!insider && !plan.host.isYou && (
        <div className="flex justify-center">
          <ReportDialog
            memberId={plan.host.id}
            memberName={plan.host.firstName}
            planId={plan.id}
            action={actions.reportMember}
          />
        </div>
      )}
    </div>
  );
}
