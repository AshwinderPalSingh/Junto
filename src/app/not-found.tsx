import { Compass } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/views/components/logo";
import { Button } from "@/views/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">
      <Logo />
      <div className="mt-12 animate-glass-in">
        <p className="font-mono text-[5.5rem] leading-none tracking-[-0.06em]">404</p>
        <span className="mx-auto mt-6 grid size-12 animate-float place-items-center border border-border">
          <Compass className="size-5" strokeWidth={1.5} />
        </span>
        <h1 className="mt-6 text-3xl tracking-[-0.035em]">Nothing here</h1>
        <p className="mt-2 text-muted-foreground">
          This page doesn&apos;t exist, or it&apos;s a plan you can&apos;t see. Plans only show to people they&apos;re
          meant for.
        </p>
        <Button asChild className="mt-8">
          <Link href="/board">Back to the board</Link>
        </Button>
      </div>
    </div>
  );
}
