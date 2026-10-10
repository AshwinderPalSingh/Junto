"use client";

import { ArrowRight, Mail } from "lucide-react";
import { useActionState } from "react";
import { idleState, type ActionState } from "@/lib/action";
import { FormMessage, SubmitButton, fieldError } from "@/views/components/form-bits";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/views/ui/field";
import { Input } from "@/views/ui/input";

type Props = {
  domain: string;
  requestCode: (prev: ActionState, formData: FormData) => Promise<ActionState>;
};

export function LoginView({ domain, requestCode }: Props) {
  const [state, action] = useActionState(requestCode, idleState);
  const emailError = fieldError(state, "email");
  return (
    <div>
      <span className="grid size-11 place-items-center bg-primary text-primary-foreground">
        <Mail className="size-5" strokeWidth={1.75} />
      </span>
      <h1 className="mt-6 text-3xl tracking-[-0.035em]">Sign in to Junto</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        New or returning, it&apos;s the same: we email you a 6-digit code. No passwords.
      </p>
      <form action={action} className="mt-7 space-y-5">
        <Field data-invalid={Boolean(emailError)}>
          <FieldLabel htmlFor="email">University email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            required
            placeholder={`you@${domain}`}
            aria-invalid={Boolean(emailError)}
            className="h-12 text-base"
          />
          {emailError ? (
            <FieldError>{emailError}</FieldError>
          ) : (
            <FieldDescription>Only @{domain} addresses can join.</FieldDescription>
          )}
        </Field>
        <FormMessage state={state} />
        <SubmitButton size="xl" className="w-full" pendingLabel="Sending code…">
          Email me a code <ArrowRight />
        </SubmitButton>
      </form>
      <p className="mt-7 text-xs leading-relaxed text-muted-foreground">
        By continuing you agree to meet only at public spots, respect people&apos;s boundaries and follow the{" "}
        <a href="/safety" className="text-foreground underline underline-offset-2">
          community guidelines
        </a>
        .
      </p>
    </div>
  );
}
