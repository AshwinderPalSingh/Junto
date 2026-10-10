"use client";

import {
  Bell,
  CalendarCheck2,
  House,
  LifeBuoy,
  MessageCircle,
  Plus,
  Settings,
  UserRound,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/views/components/logo";
import { ThemeToggle } from "@/views/components/theme-toggle";
import { Button } from "@/views/ui/button";

const PRIMARY_NAV = [
  { href: "/board", label: "Board", icon: House },
  { href: "/activity", label: "My plans", icon: CalendarCheck2 },
  { href: "/free", label: "I'm free", icon: Zap },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

const MESSAGES_NAV = { href: "/messages", label: "Messages", icon: MessageCircle } as const;

const SECONDARY_NAV = [
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/safety", label: "Safety centre", icon: LifeBuoy },
] as const;

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/*
 * The active-link highlight depends on the URL. On dynamic routes (/plans/[id])
 * that isn't known when the static shell is prerendered, so the URL-aware
 * parts render behind <Suspense> with a neutral fallback.
 */

function SideNav({ pathname, messagesBadge }: { pathname: string | null; messagesBadge: React.ReactNode }) {
  const items = [...PRIMARY_NAV.slice(0, 2), MESSAGES_NAV, ...PRIMARY_NAV.slice(2), ...SECONDARY_NAV];
  return (
    <>
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-11 items-center gap-3 rounded-full px-4 text-sm transition-[background-color,color,transform] duration-300",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-[17px]" strokeWidth={1.75} />
            {label}
            {href === MESSAGES_NAV.href && messagesBadge}
          </Link>
        );
      })}
    </>
  );
}

function LiveSideNav({ messagesBadge }: { messagesBadge: React.ReactNode }) {
  return <SideNav pathname={usePathname()} messagesBadge={messagesBadge} />;
}

function TabItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof House;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-col items-center gap-1 rounded-full py-2 text-[10px] transition-colors",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <Icon className="size-[21px]" strokeWidth={active ? 2.2 : 1.6} />
        {label}
      </Link>
    </li>
  );
}

function TabBar({ pathname }: { pathname: string | null }) {
  return (
    <ul className="grid grid-cols-5 items-center px-1">
      {PRIMARY_NAV.slice(0, 2).map((item) => (
        <TabItem key={item.href} {...item} active={isActive(pathname, item.href)} />
      ))}
      <li className="grid place-items-center">
        <Link
          href="/plans/new"
          aria-label="Post a plan"
          className="grid size-12 -translate-y-3 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_25px_-12px_rgb(0_0_0/0.4)] transition-transform hover:-translate-y-4 active:scale-95"
        >
          <Plus className="size-6" strokeWidth={2} />
        </Link>
      </li>
      {PRIMARY_NAV.slice(2).map((item) => (
        <TabItem key={item.href} {...item} active={isActive(pathname, item.href)} />
      ))}
    </ul>
  );
}

function LiveTabBar() {
  return <TabBar pathname={usePathname()} />;
}

type Props = {
  children: React.ReactNode;
  /** Server-rendered slots (they stream in behind Suspense). */
  bell: React.ReactNode;
  /** Top-bar chat shortcut with its unread badge. */
  messages: React.ReactNode;
  /** Unread-chats badge for the sidebar's Messages item. */
  messagesBadge: React.ReactNode;
  avatar: React.ReactNode;
  adminLink: React.ReactNode;
  live: React.ReactNode;
};

export function AppShell({ children, bell, messages, messagesBadge, avatar, adminLink, live }: Props) {
  return (
    <div className="app-shell min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-5 lg:p-4">
      {/* Desktop sidebar */}
      <aside className="app-sidebar glass sticky top-4 hidden h-[calc(100dvh-2rem)] flex-col gap-7 p-5 lg:flex">
        <Link href="/board" className="px-2 py-3">
          <Logo showTagline />
        </Link>
        <Button asChild size="lg" className="w-full">
          <Link href="/plans/new">
            <Plus /> Post a plan
          </Link>
        </Button>
        <nav className="flex flex-col gap-1" aria-label="Main">
          <Suspense fallback={<SideNav pathname={null} messagesBadge={messagesBadge} />}>
            <LiveSideNav messagesBadge={messagesBadge} />
          </Suspense>
          {adminLink}
        </nav>
        <div className="mt-auto flex items-center justify-between border-t border-border pt-5">
          <ThemeToggle />
        </div>
      </aside>

      <div className="min-w-0">
        {/* Top bar */}
        <header className="app-topbar glass sticky top-0 z-30 border-x-0 border-t-0 lg:top-4 lg:rounded-full lg:border lg:border-border">
          <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 lg:h-14 lg:justify-end">
            <Link href="/board" className="lg:hidden">
              <Logo />
            </Link>
            <div className="flex items-center gap-1">
              {messages}
              {bell}
              <Link
                href="/profile"
                aria-label="Your profile"
                className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                {avatar}
              </Link>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl px-4 pt-7 pb-36 sm:px-6 lg:pt-9 lg:pb-16">{children}</main>
      </div>

      {/* Mobile tab bar */}
      <nav aria-label="Main" className="app-tabbar glass-strong fixed inset-x-3 bottom-3 z-40 mx-auto max-w-lg pt-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] lg:hidden">
        <Suspense fallback={<TabBar pathname={null} />}>
          <LiveTabBar />
        </Suspense>
      </nav>
      <Suspense fallback={null}>{live}</Suspense>
    </div>
  );
}
