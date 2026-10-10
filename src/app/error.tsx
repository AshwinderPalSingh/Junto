"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/views/ui/button";

/** Route-level error boundary: friendly message plus a retry. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-5 text-center">
      <div className="glass-strong animate-glass-in p-8">
        <span className="mx-auto grid size-12 place-items-center border border-border">
          <TriangleAlert className="size-5" strokeWidth={1.5} />
        </span>
        <h1 className="mt-6 text-3xl tracking-[-0.035em]">Something went wrong</h1>
        <p className="mt-2 text-muted-foreground">
          That didn&apos;t work. Try again, and if it keeps happening, let a moderator know.
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-muted-foreground">ref {error.digest}</p>}
        <div className="mt-7 flex justify-center gap-2">
          <Button onClick={() => reset()}>
            <RotateCcw /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/board">Board</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
