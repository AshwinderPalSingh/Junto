"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/photos", label: "Photos" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Moderation" className="-mx-4 mb-8 overflow-x-auto px-4 scrollbar-none">
      <div className="glass inline-flex gap-0.5 p-0.5">
        {TABS.map((t) => {
          const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-200",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
