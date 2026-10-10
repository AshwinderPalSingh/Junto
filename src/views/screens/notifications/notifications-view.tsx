"use client";

import { BellOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useTransition } from "react";
import { campusDayDiff } from "@/lib/time";
import { cn } from "@/lib/utils";
import { PageHeader, SectionTitle } from "@/views/components/bits";
import { Icon } from "@/views/components/icons";
import { RelativeTime } from "@/views/components/relative-time";
import type { NotificationVM, NotificationsVM } from "@/views/view-models";

function Item({ item, now }: { item: NotificationVM; now: string }) {
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "group relative flex items-start gap-3.5 p-4 transition-colors hover:bg-accent/60",
          !item.read && "bg-accent/40",
        )}
      >
        {!item.read && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-foreground" />}
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center",
            item.read ? "border border-border text-muted-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          <Icon name={item.icon} className="size-[1.1rem]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate", item.read ? "font-medium" : "font-semibold")}>{item.title}</span>
            <RelativeTime
              date={item.at}
              serverNow={now}
              className="shrink-0 font-mono text-[0.68rem] tracking-wide text-muted-foreground uppercase"
            />
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">{item.body}</span>
        </span>
        {!item.read && <span className="sr-only">Unread</span>}
      </Link>
    </li>
  );
}

export function NotificationsView({ vm, markAllRead }: { vm: NotificationsVM; markAllRead: () => Promise<void> }) {
  const [, startTransition] = useTransition();
  const hasUnread = vm.items.some((i) => !i.read);
  useEffect(() => {
    if (!hasUnread) return;
    const timer = setTimeout(() => startTransition(() => markAllRead()), 1500);
    return () => clearTimeout(timer);
  }, [hasUnread, markAllRead]);

  const today = vm.items.filter((i) => campusDayDiff(i.at, vm.now) === 0);
  const earlier = vm.items.filter((i) => campusDayDiff(i.at, vm.now) !== 0);

  return (
    <div>
      <PageHeader eyebrow="Inbox" title="Notifications" description="Requests, confirmations and meetup updates." />
      {vm.items.length === 0 ? (
        <div className="glass animate-glass-in border-dashed px-6 py-14 text-center">
          <span className="mx-auto grid size-12 animate-float place-items-center border border-border">
            <BellOff className="size-5 text-muted-foreground" strokeWidth={1.5} />
          </span>
          <p className="mt-4 text-lg tracking-[-0.02em]">All quiet</p>
          <p className="mt-1 text-sm text-muted-foreground">You&apos;ll hear here when someone wants to join your plan.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {today.length > 0 && (
            <section>
              <SectionTitle>Today</SectionTitle>
              <ul className="glass animate-glass-in divide-y divide-border">
                {today.map((i) => (
                  <Item key={i.id} item={i} now={vm.now} />
                ))}
              </ul>
            </section>
          )}
          {earlier.length > 0 && (
            <section>
              <SectionTitle>Earlier</SectionTitle>
              <ul className="glass animate-glass-in divide-y divide-border">
                {earlier.map((i) => (
                  <Item key={i.id} item={i} now={vm.now} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
