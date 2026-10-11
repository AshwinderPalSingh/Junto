"use client";

import { ArrowUpRight, Check, Hourglass, MapPinCheck, Share2, ShieldCheck, UserCheck, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import { RULES } from "@/config/app";
import { CANCEL_REASONS, FEEDBACK_FLAGS } from "@/config/safety";
import { idleState, type ActionState } from "@/lib/action";
import { formatClock } from "@/lib/time";
import { cn } from "@/lib/utils";
import { Pill } from "@/views/components/bits";
import { ChoiceCard, ChoiceChip } from "@/views/components/choice";
import { FormMessage, SubmitButton } from "@/views/components/form-bits";
import { ChatThread, type ChatActions } from "@/views/components/chat-thread";
import { MemberAvatar } from "@/views/components/member-avatar";
import { MemberCard } from "@/views/components/member-card";
import { MessageButton, type StartChatAction } from "@/views/components/message-button";
import { BlockButton, ReportDialog } from "@/views/components/report-dialog";
import { useActionToast } from "@/views/hooks/use-action-toast";
import { Button } from "@/views/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/views/ui/dialog";
import { Input } from "@/views/ui/input";
import type { PlanDetailVM } from "@/views/view-models";

export type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export type PlanActions = {
  requestToJoin: Action;
  withdrawRequest: Action;
  decideRequest: Action;
  leavePlan: Action;
  cancelPlan: Action;
  checkIn: Action;
  submitFeedback: Action;
  createShareLink: () => Promise<ActionState<{ url: string; text: string }>>;
  reportMember: Action;
  blockMember: Action;
  startChat: StartChatAction;
  /** Bound to this plan's group chat (null until someone has joined). */
  chat: ChatActions | null;
};

const card = "glass p-5 sm:p-6 animate-glass-in";

function PanelTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-xl tracking-[-0.025em]">{children}</h2>
      {aside}
    </div>
  );
}

/* ───────────── Outsider: ask to join ───────────── */

const NOTE_IDEAS = ["Heading that way too!", "First time on Junto", "Happy to keep it short"];

export function JoinPanel({ vm, action }: { vm: PlanDetailVM; action: Action }) {
  const [state, formAction] = useActionState(action, idleState);
  const [note, setNote] = useState("");
  useActionToast(state);
  return (
    <section className={cn(card, "space-y-5")}>
      <div>
        <PanelTitle>Want to join?</PanelTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          If {vm.plan.host.firstName} accepts, you&apos;ll both see each other&apos;s photo and get a small meetup space
          for &ldquo;on my way&rdquo; updates.
        </p>
      </div>
      <form action={formAction} className="space-y-3">
        <Input
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={RULES.requestNoteMaxLength}
          placeholder="Add a short hello (optional)"
          className="h-11"
        />
        <div className="flex flex-wrap gap-1.5">
          {NOTE_IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => setNote(idea)}
              className="border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              {idea}
            </button>
          ))}
        </div>
        <FormMessage state={state} />
        <SubmitButton size="xl" className="w-full text-base" pendingLabel="Sending…">
          Ask to join
        </SubmitButton>
      </form>
    </section>
  );
}

export function PendingPanel({ vm, action }: { vm: PlanDetailVM; action: Action }) {
  const [state, formAction] = useActionState(action, idleState);
  useActionToast(state);
  return (
    <section className={cn(card, "flex flex-col gap-4 border-foreground/40 sm:flex-row sm:items-center")}>
      <span className="grid size-11 shrink-0 place-items-center bg-primary text-primary-foreground">
        <Hourglass className="size-5 animate-float" strokeWidth={1.75} />
      </span>
      <div className="flex-1">
        <p className="font-semibold">Request sent</p>
        <p className="text-sm text-muted-foreground">
          Waiting for {vm.plan.host.firstName}. You&apos;ll get a notification either way.
        </p>
      </div>
      {vm.can.withdraw && (
        <form action={formAction}>
          <SubmitButton variant="outline">Withdraw</SubmitButton>
        </form>
      )}
    </section>
  );
}

/* ───────────── Host: incoming requests ───────────── */

function RequestCard({
  request,
  full,
  action,
}: {
  request: PlanDetailVM["requests"][number];
  full: boolean;
  action: Action;
}) {
  const [state, formAction] = useActionState(action, idleState);
  useActionToast(state);
  return (
    <li className="space-y-3">
      <MemberCard member={request.member} />
      {request.note && (
        <p className="border-l-2 border-foreground bg-muted/50 px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Note:</span> {request.note}
        </p>
      )}
      <form action={formAction} className="grid grid-cols-2 gap-2">
        <input type="hidden" name="participationId" value={request.participationId} />
        <SubmitButton name="decision" value="decline" variant="outline" size="lg">
          <X /> Decline
        </SubmitButton>
        <SubmitButton name="decision" value="accept" disabled={full} size="lg">
          <Check /> Accept
        </SubmitButton>
      </form>
    </li>
  );
}

export function RequestsPanel({ vm, action }: { vm: PlanDetailVM; action: Action }) {
  const full = vm.plan.spotsLeft === 0;
  return (
    <section className={cn(card, "space-y-5")}>
      <div>
        <PanelTitle aside={full && <Pill tone="outline">Plan is full</Pill>}>
          {vm.requests.length} {vm.requests.length === 1 ? "request" : "requests"} to join
        </PanelTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Decline freely, they&apos;ll only see &ldquo;not this time&rdquo;. Accepting adds them to the plan&apos;s group chat.
        </p>
      </div>
      <ul className="space-y-6">
        {vm.requests.map((r) => (
          <RequestCard key={r.participationId} request={r} full={full} action={action} />
        ))}
      </ul>
    </section>
  );
}

/* ───────────── Insiders: the meetup space ───────────── */

export function MembersPanel({ vm, actions }: { vm: PlanDetailVM; actions: PlanActions }) {
  return (
    <section className={cn(card, "space-y-4")}>
      <PanelTitle aside={<span className="text-xs text-muted-foreground">{vm.members.length} going</span>}>
        Who&apos;s going
      </PanelTitle>
      <ul className="divide-y divide-border">
        {vm.members.map(({ member, role, checkedIn, canMessage }) => (
          <li key={member.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <MemberAvatar photo={member.photo} name={member.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {member.isYou ? "You" : member.name}
                {role === "host" && <span className="ml-2 label-caps text-[0.6rem] text-muted-foreground">Host</span>}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {[member.year, member.branch].filter(Boolean).join(" · ")}
              </p>
            </div>
            {checkedIn ? (
              <Pill tone="solid">
                <UserCheck className="size-3.5" /> Here
              </Pill>
            ) : null}
            {canMessage && (
              <MessageButton memberId={member.id} memberName={member.firstName} action={actions.startChat} compact />
            )}
            {!member.isYou && (
              <ReportDialog
                memberId={member.id}
                memberName={member.firstName}
                planId={vm.plan.id}
                action={actions.reportMember}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Report or block ${member.firstName}`}>
                    <ShieldCheck className="text-muted-foreground" />
                  </Button>
                }
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CheckInPanel({ vm, action }: { vm: PlanDetailVM; action: Action }) {
  const [state, formAction] = useActionState(action, idleState);
  useActionToast(state);
  return (
    <form action={formAction}>
      <SubmitButton size="xl" className="glass-sheen h-14 w-full text-base shadow-2xl">
        <MapPinCheck className="size-5" /> I&apos;m here at {vm.plan.spot.name}
      </SubmitButton>
    </form>
  );
}

/** The plan's group chat, live, for the host and confirmed guests. */
export function PlanChatPanel({ vm, actions }: { vm: PlanDetailVM; actions: ChatActions | null }) {
  if (!vm.chat || !actions) return null;
  return (
    <section className={cn(card, "space-y-3")}>
      <PanelTitle
        aside={
          <Button asChild variant="ghost" size="sm">
            <Link href={`/messages/${vm.chat.conversationId}`}>
              Open chat <ArrowUpRight />
            </Link>
          </Button>
        }
      >
        Group chat
      </PanelTitle>
      <p className="-mt-1 text-sm text-muted-foreground">
        Everyone confirmed on this plan. Share where you are or what you&apos;re wearing so you can find each other.
      </p>
      <ChatThread
        thread={vm.chat}
        now={vm.now}
        actions={actions}
        mode="panel"
        quickUpdates
        emptyHint="No messages yet. A quick hello makes meeting up easier."
      />
    </section>
  );
}

export function ShareButton({ action }: { action: PlanActions["createShareLink"] }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await action();
          if (result.status !== "success" || !result.data) {
            toast.error(result.status === "error" ? result.message : "Couldn't create a link.");
            return;
          }
          const { url, text } = result.data;
          try {
            if (navigator.share) {
              await navigator.share({ title: "My Junto meetup", text, url });
              return;
            }
          } catch {
            // fall back to copying
          }
          await navigator.clipboard.writeText(`${text} ${url}`);
          toast.success("Link copied. Send it to someone you trust.");
        })
      }
    >
      <Share2 /> Share with a trusted contact
    </Button>
  );
}

/* ───────────── Leaving / cancelling ───────────── */

export function ChangePlansDialog({
  mode,
  action,
  startsAt,
}: {
  mode: "leave" | "cancel";
  action: Action;
  startsAt: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, idleState);
  useActionToast(state, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-muted-foreground">
          {mode === "leave" ? "I can't make it" : "Cancel this plan"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "leave" ? "Can't make it?" : "Cancel this plan?"}</DialogTitle>
          <DialogDescription>
            That&apos;s okay. Cancelling more than an hour before {formatClock(startsAt)} never counts against you, and
            safety cancellations never do.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-2">
          {CANCEL_REASONS.map((r, i) => (
            <ChoiceCard key={r.id} name="reason" value={r.id} defaultChecked={i === 0} title={r.label} />
          ))}
          <FormMessage state={state} />
          <SubmitButton variant="destructive" size="lg" className="mt-2 w-full">
            {mode === "leave" ? "Leave plan" : "Cancel plan"}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── Afterwards: private feedback ───────────── */

export function FeedbackForm({ vm, action }: { vm: PlanDetailVM; action: Action }) {
  const [state, formAction] = useActionState(action, idleState);
  const [attended, setAttended] = useState<"yes" | "no">("yes");
  useActionToast(state);
  return (
    <section className={cn(card, "space-y-5 border-foreground/40")}>
      <div>
        <PanelTitle>How did it go?</PanelTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Private feedback. No-show reports affect ratings after corroboration or moderator review.
        </p>
      </div>
      <form action={formAction} className="space-y-5">
        <div className="grid grid-cols-2 gap-2">
          <ChoiceCard
            name="attended"
            value="yes"
            checked={attended === "yes"}
            onChange={() => setAttended("yes")}
            title="I went"
            icon={<Check strokeWidth={1.75} />}
          />
          <ChoiceCard
            name="attended"
            value="no"
            checked={attended === "no"}
            onChange={() => setAttended("no")}
            title="Didn't go"
            icon={<X strokeWidth={1.75} />}
          />
        </div>
        {attended === "yes" && (
          <ul className="space-y-3">
            {vm.feedbackTargets.map((t) => (
              <li key={t.id} className="space-y-3 border border-border p-4">
                <div className="flex items-center gap-3">
                  <MemberAvatar photo={t.photo} name={t.name} size="md" />
                  <p className="font-semibold">{t.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="mr-1 text-muted-foreground">Showed up?</span>
                  <ChoiceChip type="radio" name={`showed_${t.id}`} value="yes" required>
                    Yes
                  </ChoiceChip>
                  <ChoiceChip type="radio" name={`showed_${t.id}`} value="no">
                    Report no-show
                  </ChoiceChip>
                  <ChoiceChip name={`again_${t.id}`}>Would meet again</ChoiceChip>
                </div>
                <details className="group text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Anything to flag? (private)
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {FEEDBACK_FLAGS.map((f) => (
                      <ChoiceChip key={f.id} name={`flags_${t.id}`} value={f.id}>
                        {f.label}
                      </ChoiceChip>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <FormMessage state={state} />
        <SubmitButton size="xl" className="w-full text-base">
          Send feedback
        </SubmitButton>
      </form>
    </section>
  );
}

export { BlockButton };
