"use client";

import { ArrowLeft, Eye, MessageCircleOff, Pencil, Settings } from "lucide-react";
import Link from "next/link";
import type { ActionState } from "@/lib/action";
import { cn } from "@/lib/utils";
import { ReputationLine, SectionTitle } from "@/views/components/bits";
import { Icon } from "@/views/components/icons";
import { MemberAvatar } from "@/views/components/member-avatar";
import { MessageButton, type StartChatAction } from "@/views/components/message-button";
import { BlockButton, ReportDialog } from "@/views/components/report-dialog";
import { Button } from "@/views/ui/button";
import type { ProfileVM } from "@/views/view-models";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function Note({ icon: IconComponent, children }: { icon: typeof Eye; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-3 rounded-2xl border border-border p-4 text-sm text-muted-foreground">
      <IconComponent className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <span>{children}</span>
    </p>
  );
}

export function ProfileView({
  vm,
  actions,
}: {
  vm: ProfileVM;
  actions?: { reportMember: Action; blockMember: Action; startChat: StartChatAction };
}) {
  const m = vm.member;
  return (
    <div className="space-y-6">
      {!vm.isMe && (
        <Link
          href="/board"
          className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" /> Back
        </Link>
      )}

      <section className="glass-strong relative animate-glass-in overflow-hidden">
        <div
          aria-hidden="true"
          className="relative h-28 overflow-hidden border-b border-border bg-primary [background-image:linear-gradient(color-mix(in_oklab,var(--primary-foreground)_12%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklab,var(--primary-foreground)_12%,transparent)_1px,transparent_1px)] [background-size:24px_24px]"
        >
          <div className="absolute inset-y-0 -left-1/3 w-1/3 animate-sweep bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>
        <div className="relative -mt-16 px-6 pb-7 text-center">
          <MemberAvatar
            photo={m.photo}
            name={m.name}
            size="2xl"
            className="mx-auto shadow-2xl ring-4 ring-background"
          />
          <h1 className="mt-5 text-[2rem] leading-tight tracking-[-0.035em]">{m.name}</h1>
          <p className="mt-1 text-muted-foreground">{[m.year, m.branch].filter(Boolean).join(" · ")}</p>
          <ReputationLine reputation={m.reputation} className="mt-2 justify-center text-sm" />
          {m.bio && <p className="mx-auto mt-4 max-w-md leading-relaxed">{m.bio}</p>}
          {(m.vibe || m.interests.length > 0) && (
            <div className="mt-5 flex flex-wrap justify-center gap-1.5">
              {m.vibe && <span className="border border-foreground/30 px-3 py-1 text-sm">{m.vibe.label}</span>}
              {m.interests.map((i) => (
                <span
                  key={i.id}
                  className={cn(
                    "px-3 py-1 text-sm",
                    i.shared ? "bg-primary font-medium text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {i.label}
                </span>
              ))}
            </div>
          )}
          {vm.isMe ? (
            <div className="mt-7 flex justify-center gap-2">
              <Button asChild variant="outline">
                <Link href="/profile/edit">
                  <Pencil /> Edit profile
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/settings">
                  <Settings /> Settings
                </Link>
              </Button>
            </div>
          ) : (
            actions && (
              <div className="mt-7 flex flex-col items-center gap-3">
                {vm.chat?.canStart && (
                  <MessageButton memberId={m.id} memberName={m.firstName} action={actions.startChat} variant="default" />
                )}
                <div className="flex justify-center gap-1">
                  <ReportDialog memberId={m.id} memberName={m.firstName} action={actions.reportMember} />
                  <BlockButton memberId={m.id} memberName={m.firstName} action={actions.blockMember} />
                </div>
              </div>
            )
          )}
        </div>
      </section>

      {vm.isMe && (
        <Note icon={Eye}>
          This is how other members see you. Your companion preferences and chat settings are never shown.
        </Note>
      )}
      {vm.chat?.note && <Note icon={MessageCircleOff}>{vm.chat.note}</Note>}

      {vm.stats && (
        <section className="grid grid-cols-3 gap-px border border-border bg-border">
          {[
            { label: "Meetups", value: vm.stats.attended },
            { label: "Activities tried", value: vm.stats.activitiesTried },
            { label: "Groups hosted", value: vm.stats.hostedGroups },
          ].map((s) => (
            <div key={s.label} className="bg-background/80 p-4 text-center backdrop-blur-md">
              <p className="font-mono text-3xl tracking-tight">{s.value}</p>
              <p className="mt-1 label-caps text-[0.6rem] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </section>
      )}

      <section>
        <SectionTitle>{vm.isMe ? "Achievements" : "Badges"}</SectionTitle>
        {vm.badges.length === 0 ? (
          <p className="glass border-dashed p-6 text-center text-sm text-muted-foreground">
            No badges yet. They come from showing up, not from saying yes.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {vm.badges.map((b) => (
              <div
                key={b.id}
                className={cn(
                  "glass flex items-start gap-3 p-4 transition-opacity",
                  b.earned ? "border-foreground/30" : "opacity-45",
                )}
              >
                <span
                  className={cn(
                    "grid size-10 shrink-0 place-items-center",
                    b.earned ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground",
                  )}
                >
                  <Icon name={b.icon} className="size-[1.1rem]" />
                </span>
                <div>
                  <p className="font-semibold">{b.label}</p>
                  <p className="text-sm text-muted-foreground">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {vm.stats && (vm.stats.lateCancels > 0 || vm.stats.pendingReports > 0 || vm.stats.noShows > 0) && (
          <p className="mt-4 text-xs text-muted-foreground">
            Only you can see this: {vm.stats.lateCancels} late cancellation{vm.stats.lateCancels === 1 ? "" : "s"}
            {vm.stats.noShows > 0 && `, ${vm.stats.noShows} missed meetup${vm.stats.noShows === 1 ? "" : "s"}`}.
            Cancelling early never counts against you.
          </p>
        )}
      </section>
    </div>
  );
}
