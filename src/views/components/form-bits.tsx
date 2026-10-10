"use client";

import { AlertCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action";
import { cn } from "@/lib/utils";
import { Button } from "@/views/ui/button";
import { Spinner } from "@/views/ui/spinner";

type ButtonProps = React.ComponentProps<typeof Button> & { pendingLabel?: string };

/**
 * A submit button that shows progress while its form's Server Action runs.
 * In forms with several submit buttons (name/value), only the one that was
 * pressed shows the spinner.
 */
export function SubmitButton({ children, pendingLabel, disabled, ...props }: ButtonProps) {
  const { pending, data } = useFormStatus();
  const isSubmitter =
    pending && (props.name === undefined || data?.get(props.name) === String(props.value ?? ""));
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={isSubmitter} {...props}>
      {isSubmitter ? (
        <>
          <Spinner />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export function FormMessage({ state, className }: { state: ActionState<unknown>; className?: string }) {
  if (state.status !== "error") return null;
  return (
    <p
      role="alert"
      className={cn(
        "flex items-start gap-2 border border-destructive/35 bg-destructive/6 px-3 py-2.5 text-sm text-destructive animate-glass-in",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
      <span>{state.message}</span>
    </p>
  );
}

export function fieldError(state: ActionState<unknown>, field: string) {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}
