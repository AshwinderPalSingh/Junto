import { ShieldCheck, UserRound } from "lucide-react";

export function CampusIdentity({ fullName, connected, available }: {
  fullName: string | null; connected: boolean; available: boolean;
}) {
  const Icon = connected ? ShieldCheck : UserRound;
  return <div className="flex min-w-0 items-start gap-3">
    <Icon className="mt-1 size-5 shrink-0 text-muted-foreground" />
    <div className="min-w-0 space-y-2">
      <p className="text-xs text-muted-foreground">University account profile</p>
      <p className="break-words font-semibold">{fullName ?? "Campus member"}</p>
      <p className="text-sm text-muted-foreground">{connected ? "Name supplied by your university account." :
        available ? "Your Thapar account name is verified during sign-in." : "University sign-in is currently unavailable."}</p>
    </div>
  </div>;
}
