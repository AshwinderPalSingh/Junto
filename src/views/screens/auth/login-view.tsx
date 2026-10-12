"use client";

import { ArrowRight, LogIn, Mail } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { idleState, type ActionState } from "@/lib/action";
import { FormMessage, SubmitButton, fieldError } from "@/views/components/form-bits";
import { PasswordInput } from "@/views/components/password-input";
import { CampusSignIn } from "@/views/components/campus-sign-in";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/views/ui/field";
import { Input } from "@/views/ui/input";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Props = {
  domain: string;
  campusSignIn: boolean;
  signIn: Action;
  requestCode: Action;
};

export function LoginView({ domain, campusSignIn, signIn, requestCode }: Props) {
  const [passwordState, passwordAction] = useActionState(signIn, idleState);
  const [codeState, codeAction] = useActionState(requestCode, idleState);
  // Controlled, so the email survives a wrong password and is shared with the code option.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const emailError = fieldError(passwordState, "email") ?? fieldError(codeState, "email");

  return (
    <div>
      <span className="grid size-11 place-items-center bg-primary text-primary-foreground">
        <LogIn className="size-5" strokeWidth={1.75} />
      </span>
      <h1 className="mt-6 text-3xl tracking-[-0.035em]">Sign in to Junto</h1>
      <p className="mt-2 text-sm text-muted-foreground">Only @{domain} accounts can sign in.</p>
      {campusSignIn && <CampusSignIn />}

      <form action={passwordAction} className="mt-7 space-y-4">
        <Field data-invalid={Boolean(emailError)}>
          <FieldLabel htmlFor="email">University email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
        <Field data-invalid={Boolean(fieldError(passwordState, "password"))}>
          <div className="flex items-baseline justify-between gap-3">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link href="/login/reset" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 text-base"
          />
          <FieldError>{fieldError(passwordState, "password")}</FieldError>
        </Field>
        <FormMessage state={passwordState} />
        <SubmitButton size="xl" className="w-full" pendingLabel="Signing in…">
          Sign in <ArrowRight />
        </SubmitButton>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground" role="separator">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={codeAction} className="space-y-3">
        <input type="hidden" name="email" value={email} />
        <FormMessage state={codeState} />
        <SubmitButton variant="outline" size="lg" className="w-full px-3" pendingLabel="Sending code…">
          <Mail /> Email me a sign-in code
        </SubmitButton>
      </form>

      <p className="mt-7 text-center text-sm text-muted-foreground">
        New to Junto?{" "}
        <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        By continuing you agree to meet only at public spots, respect people&apos;s boundaries and follow the{" "}
        <Link href="/safety" className="text-foreground underline underline-offset-2">
          community guidelines
        </Link>
        .
      </p>
    </div>
  );
}
