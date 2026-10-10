import { Bell, MessageCircle, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MemberAvatar } from "@/views/components/member-avatar";
import type { ShellVM } from "@/views/view-models";

/** Pure views for the server-rendered parts of the app chrome. */

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] leading-4 font-semibold text-primary-foreground",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export function BellView({ shell }: { shell: ShellVM | null }) {
  const unread = shell?.unread ?? 0;
  return (
    <Link
      href="/notifications"
      aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
      className="relative grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Bell className="size-[19px]" strokeWidth={1.75} />
      <CountBadge count={unread} className="absolute top-1 right-1" />
    </Link>
  );
}

/** Top-bar shortcut to chats, with the number of chats that have unread messages. */
export function MessagesLinkView({ shell }: { shell: ShellVM | null }) {
  const unread = shell?.unreadChats ?? 0;
  return (
    <Link
      href="/messages"
      aria-label={unread ? `Messages (${unread} unread)` : "Messages"}
      className="relative grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <MessageCircle className="size-[19px]" strokeWidth={1.75} />
      <CountBadge count={unread} className="absolute top-1 right-1" />
    </Link>
  );
}

/** Unread-chats count next to "Messages" in the sidebar. */
export function MessagesBadgeView({ shell }: { shell: ShellVM | null }) {
  return <CountBadge count={shell?.unreadChats ?? 0} className="ml-auto h-5 min-w-5 text-[10px]" />;
}

export function AvatarView({ shell }: { shell: ShellVM | null }) {
  if (!shell) return <span className="block size-8 rounded-full bg-muted" />;
  return <MemberAvatar photo={shell.photo} name={shell.name} size="sm" />;
}

export function AdminLinkView({ shell, active }: { shell: ShellVM | null; active?: boolean }) {
  if (!shell?.isAdmin) return null;
  return (
    <Link
      href="/admin"
      className={cn(
        "flex h-11 items-center gap-3 rounded-full px-4 text-sm transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <ShieldAlert className="size-[17px]" strokeWidth={1.75} />
      Moderation
      {shell.openReports > 0 && (
        <span className="ml-auto rounded-full bg-destructive px-1.5 text-[10px] leading-5 text-white">{shell.openReports}</span>
      )}
    </Link>
  );
}
