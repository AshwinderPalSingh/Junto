"use client";

import { Search, Users } from "lucide-react";
import { useActionState } from "react";
import { GENDERS, yearLabel } from "@/config/profile";
import { idleState, type ActionState } from "@/lib/action";
import { PageHeader, Pill } from "@/views/components/bits";
import { SubmitButton } from "@/views/components/form-bits";
import { RelativeTime } from "@/views/components/relative-time";
import { useActionToast } from "@/views/hooks/use-action-toast";
import { Input } from "@/views/ui/input";
import type { AdminMemberVM } from "@/views/view-models";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function MemberRow({
  member,
  now,
  setMemberStatus,
}: {
  member: AdminMemberVM;
  now: string;
  setMemberStatus: Action;
}) {
  const [state, action] = useActionState(setMemberStatus, idleState);
  useActionToast(state);
  const suspended = member.status === "suspended";
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {member.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={member.photoUrl} alt="" className="size-11 object-cover ring-1 ring-border" />
        ) : (
          <span className="size-11 bg-muted" />
        )}
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 font-medium">
            {member.name}
            {member.role === "admin" && <Pill tone="solid">Moderator</Pill>}
            {suspended && <Pill tone="destructive">Suspended</Pill>}
            {!member.onboarded && <Pill>Setting up</Pill>}
            {member.reportsAgainst > 0 && (
              <Pill tone="outline">
                {member.reportsAgainst} report{member.reportsAgainst === 1 ? "" : "s"}
              </Pill>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono">{member.email}</span> ·{" "}
            {[GENDERS.find((g) => g.id === member.gender)?.label, yearLabel(member.year), member.branch]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-xs text-muted-foreground">
            Joined <RelativeTime date={member.createdAt} serverNow={now} />
            {member.lastSeenAt && (
              <>
                {" "}
                · seen <RelativeTime date={member.lastSeenAt} serverNow={now} />
              </>
            )}
          </p>
          {suspended && member.suspendedReason && (
            <p className="text-xs text-destructive">Reason: {member.suspendedReason}</p>
          )}
        </div>
      </div>
      {member.role !== "admin" && (
        <form action={action} className="flex gap-2">
          <input type="hidden" name="userId" value={member.id} />
          <input type="hidden" name="status" value={suspended ? "active" : "suspended"} />
          {!suspended && <Input name="reason" placeholder="Reason" className="h-9 w-36" />}
          <SubmitButton variant={suspended ? "outline" : "destructive"} size="sm" className="h-9">
            {suspended ? "Reinstate" : "Suspend"}
          </SubmitButton>
        </form>
      )}
    </li>
  );
}

export function MembersView({
  query,
  members,
  now,
  setMemberStatus,
}: {
  query: string;
  members: AdminMemberVM[];
  now: string;
  setMemberStatus: Action;
}) {
  return (
    <div>
      <PageHeader eyebrow="Moderation" title="Members" description="Search by name or email." />
      <form className="relative mb-6" role="search">
        <Search className="absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input name="q" defaultValue={query} placeholder="Search members…" className="h-11 pl-10" />
      </form>
      {members.length === 0 ? (
        <div className="glass border-dashed p-12 text-center">
          <Users className="mx-auto size-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-3 text-muted-foreground">{query ? "No members match that search." : "No members yet."}</p>
        </div>
      ) : (
        <ul className="glass animate-glass-in divide-y divide-border">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} now={now} setMemberStatus={setMemberStatus} />
          ))}
        </ul>
      )}
    </div>
  );
}
