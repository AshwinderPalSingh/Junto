import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ReputationLine } from "@/views/components/bits";
import { Icon } from "@/views/components/icons";
import { MemberAvatar } from "@/views/components/member-avatar";
import type { MemberVM } from "@/views/view-models";

/** A member as others see them. */
export function MemberCard({
  member,
  label,
  action,
  className,
  linkToProfile = true,
}: {
  member: MemberVM;
  label?: string;
  action?: React.ReactNode;
  className?: string;
  linkToProfile?: boolean;
}) {
  const name = member.isYou ? `${member.name} (you)` : member.name;
  return (
    <div className={cn("glass p-5", className)}>
      <div className="flex items-start gap-4">
        <MemberAvatar photo={member.photo} name={member.name} size="lg" />
        <div className="min-w-0 flex-1">
          {label && <p className="label-caps text-muted-foreground">{label}</p>}
          {linkToProfile && !member.isYou ? (
            <Link href={`/u/${member.id}`} className="text-lg font-semibold tracking-[-0.02em] hover:underline">
              {name}
            </Link>
          ) : (
            <p className="text-lg font-semibold tracking-[-0.02em]">{name}</p>
          )}
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <GraduationCap className="size-3.5" strokeWidth={1.75} />
            {[member.year, member.branch].filter(Boolean).join(" · ")}
          </p>
          <ReputationLine reputation={member.reputation} className="mt-1.5" />
        </div>
        {action}
      </div>
      {member.bio && <p className="mt-4 text-sm leading-relaxed">{member.bio}</p>}
      {(member.interests.length > 0 || member.vibe) && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {member.vibe && <span className="border border-foreground/25 px-2.5 py-1 text-xs">{member.vibe.label}</span>}
          {member.interests.map((i) => (
            <span
              key={i.id}
              className={cn(
                "px-2.5 py-1 text-xs",
                i.shared ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {i.label}
            </span>
          ))}
        </div>
      )}
      {member.reputation.badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {member.reputation.badges.map((b) => (
            <span
              key={b.id}
              title={b.description}
              className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1 text-xs font-medium"
            >
              <Icon name={b.icon} className="size-3.5" />
              {b.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
