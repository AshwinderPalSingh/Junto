import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/controllers/auth.actions";
import { Logo } from "@/views/components/logo";
import { Button } from "@/views/ui/button";

export const metadata: Metadata = { title: "Account paused" };

/** Router: GET /suspended — shown to members whose account is paused by a moderator. */
export default function SuspendedPage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10 text-center">
      <Logo className="mx-auto" />
      <div className="glass-strong mt-10 animate-glass-in p-8">
        <span className="mx-auto grid size-14 place-items-center border border-destructive/40 text-destructive">
          <ShieldAlert className="size-7" strokeWidth={1.5} />
        </span>
        <h1 className="mt-6 text-3xl tracking-[-0.035em]">Your account is paused</h1>
        <p className="mt-3 text-muted-foreground">
          A moderator paused this account after a report or a pattern of missed meetups. If you think this is a
          mistake, contact the student welfare office.
        </p>
        <div className="mt-8 flex flex-col gap-2">
          <Button asChild variant="outline">
            <Link href="/safety">Read the community guidelines</Link>
          </Button>
          <form action={signOut}>
            <Button type="submit" variant="ghost" className="w-full">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
