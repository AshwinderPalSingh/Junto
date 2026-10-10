import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ActivityTile } from "@/views/components/activity-tile";
import { PageHeader } from "@/views/components/bits";
import { MemberAvatar } from "@/views/components/member-avatar";
import { RelativeTime } from "@/views/components/relative-time";
import { Button } from "@/views/ui/button";
import type { ConversationListItemVM, InboxVM } from "@/views/view-models";

function Row({ item, now }: { item: ConversationListItemVM; now: string }) {
  const unread = item.unread > 0;
  return (
    <li>
      <Link
        href={`/messages/${item.id}`}
        className="flex items-center gap-3.5 rounded-[1.1rem] px-3 py-3 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
      >
        {item.activity ? (
          <ActivityTile activity={item.activity} className="size-12 rounded-full" />
        ) : (
          <MemberAvatar photo={item.photo ?? { url: null, initials: "?" }} name={item.title} size="md" className="size-12" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className={cn("truncate", unread ? "font-semibold" : "font-medium")}>{item.title}</span>
            {item.lastMessage && (
              <RelativeTime
                date={item.lastMessage.at}
                serverNow={now}
                className={cn("shrink-0 text-xs", unread ? "font-medium text-foreground" : "text-muted-foreground")}
              />
            )}
          </span>
          {item.subtitle && <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>}
          <span className="mt-0.5 flex items-center justify-between gap-3">
            <span className={cn("truncate text-sm", unread ? "text-foreground" : "text-muted-foreground")}>
              {item.lastMessage
                ? `${item.lastMessage.mine || item.kind === "plan" ? `${item.lastMessage.senderName}: ` : ""}${item.lastMessage.body}`
                : "No messages yet"}
            </span>
            {unread && (
              <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {item.unread > 99 ? "99+" : item.unread}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function InboxView({ vm }: { vm: InboxVM }) {
  return (
    <div>
      <PageHeader
        eyebrow="Chats"
        title="Messages"
        description="Plan group chats and direct messages, newest first."
      />
      {vm.items.length === 0 ? (
        <div className="glass animate-glass-in px-6 py-14 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full border border-border">
            <MessageCircle className="size-5" strokeWidth={1.5} />
          </span>
          <p className="mt-4 text-lg">No chats yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Join a plan to chat with the group, or open a member&apos;s profile and tap Message.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/board">Browse plans</Link>
          </Button>
        </div>
      ) : (
        <ul className="glass animate-glass-in space-y-0.5 p-2">
          {vm.items.map((item) => (
            <Row key={item.id} item={item} now={vm.now} />
          ))}
        </ul>
      )}
    </div>
  );
}
