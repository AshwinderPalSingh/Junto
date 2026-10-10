import { ShieldCheck, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReputationVM } from "@/views/view-models";

/** A live indicator with a soft expanding pulse. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2", className)} aria-hidden="true">
      <span className="absolute inset-0 animate-pulse-square rounded-full bg-success" />
      <span className="relative inline-flex size-full rounded-full bg-success" />
    </span>
  );
}

export function PageHeader({
  title,
  eyebrow,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 flex flex-wrap items-end justify-between gap-4 animate-glass-in", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-2 label-caps text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-[2rem] leading-[1.05] tracking-[-0.035em] sm:text-[2.5rem]">{title}</h1>
        {description && <p className="mt-2 text-[0.95rem] text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-2">
      <h2 className="label-caps font-normal text-muted-foreground">{children}</h2>
      {aside}
    </div>
  );
}

export function ReputationLine({ reputation, className }: { reputation: ReputationVM; className?: string }) {
  const Icon = reputation.level === "new" ? Sprout : ShieldCheck;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{reputation.summary}</span>
    </span>
  );
}

export function Pill({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "solid" | "outline" | "destructive";
  className?: string;
}) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    solid: "bg-primary text-primary-foreground",
    outline: "border border-foreground/25 text-foreground",
    destructive: "border border-destructive/30 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[0.7rem] font-medium whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
