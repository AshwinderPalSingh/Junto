"use client";

import { ArrowLeft, ArrowUpRight, Flag } from "lucide-react";
import Link from "next/link";
import type { ActionState } from "@/lib/action";
import { ActivityTile } from "@/views/components/activity-tile";
import { ChatThread, type ChatActions } from "@/views/components/chat-thread";
import { AvatarStack, MemberAvatar } from "@/views/components/member-avatar";
import { BlockButton, ReportDialog } from "@/views/components/report-dialog";
import { Button } from "@/views/ui/button";
import type { ConversationVM } from "@/views/view-models";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function ConversationView({
  vm,
  actions,
  safety,
}: {
  vm: ConversationVM;
  actions: ChatActions;
  safety: { reportMember: Action; blockMember: Action };
}) {
  const isPlan = vm.thread.kind === "plan";
  const heading = (
    <span className="min-w-0">
      <span className="block truncate text-lg leading-tight font-semibold">{vm.title}</span>
      {vm.subtitle && <span className="block truncate text-xs text-muted-foreground">{vm.subtitle}</span>}
    </span>
  );

  return (
    <div>
      {/* Stays in view below the app's top bar while a long chat scrolls underneath. */}
      <header className="glass-strong sticky top-[4.5rem] z-20 mb-5 flex animate-glass-in items-center gap-3 rounded-[1.4rem] p-2.5 pr-3 lg:top-[5.25rem]">
        <Button asChild variant="ghost" size="icon" aria-label="All messages">
          <Link href="/messages">
            <ArrowLeft />
          </Link>
        </Button>
        {vm.activity ? (
          <ActivityTile activity={vm.activity} className="size-11 rounded-full" />
        ) : (
          vm.photo && <MemberAvatar photo={vm.photo} name={vm.title} size="md" className="size-11" />
        )}
        {vm.href ? (
          <Link href={vm.href} className="min-w-0 flex-1 rounded-lg hover:opacity-80">
            {heading}
          </Link>
        ) : (
          <span className="min-w-0 flex-1">{heading}</span>
        )}
        {isPlan ? (
          <>
            {vm.members.length > 0 && (
              <span className="hidden sm:block">
                <AvatarStack people={vm.members} size="sm" max={4} />
              </span>
            )}
            {vm.href && (
              <Button asChild variant="outline" size="sm">
                <Link href={vm.href}>
                  Plan <ArrowUpRight />
                </Link>
              </Button>
            )}
          </>
        ) : (
          vm.peer && (
            <div className="flex items-center">
              <ReportDialog
                memberId={vm.peer.id}
                memberName={vm.peer.firstName}
                action={safety.reportMember}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Report ${vm.peer.firstName}`}>
                    <Flag className="text-muted-foreground" />
                  </Button>
                }
              />
              {!vm.peer.blockedByMe && (
                <BlockButton memberId={vm.peer.id} memberName={vm.peer.firstName} action={safety.blockMember} />
              )}
            </div>
          )
        )}
      </header>

      <ChatThread
        thread={vm.thread}
        now={vm.now}
        actions={actions}
        mode="page"
        quickUpdates={isPlan}
        emptyHint={
          isPlan
            ? "Say hi to the group. Share where you'll be or what you're wearing so you can find each other."
            : `This is the start of your chat with ${vm.title}. Keep it friendly and about the plan.`
        }
      />
    </div>
  );
}
