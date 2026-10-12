"use client";

import { ArrowRight, KeyRound, UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { idleState, type ActionState } from "@/lib/action";
import { FormMessage, SubmitButton, fieldError } from "@/views/components/form-bits";
import { PasswordHint, PasswordInput } from "@/views/components/password-input";
import { CampusSignIn } from "@/views/components/campus-sign-in";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/views/ui/field";
import { Input } from "@/views/ui/input";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const COPY = {
  signup: {
    icon: UserPlus,
    title: "Create your account",
    lead: "Use your campus email and choose a password. We'll email you a code to confirm the address is yours.",
    password: "Password",
    submit: "Create account",
    pending: "Sending code…",
    footer: { text: "Already have an account?", link: "Sign in", href: "/login" },
  },
  reset: {
    icon: KeyRound,
    title: "Reset your password",
    lead: "Choose a new password. We'll email you a code to confirm it's you, then sign you in.",
    password: "New password",
    submit: "Email me a code",
    pending: "Sending code…",
    footer: { text: "Remembered it?", link: "Sign in", href: "/login" },
  },
} as const;

/** Sign-up and "forgot password" share one screen: choose a password, then confirm the inbox. */
export function PasswordFlowView({
  intent,
  domain,
  campusSignIn = false,
  action,
}: {
  intent: "signup" | "reset";
  domain: string;
  campusSignIn?: boolean;
  action: Action;
}) {
  const copy = COPY[intent];
  const IconComponent = copy.icon;
  const [state, formAction] = useActionState(action, idleState);
  // Controlled, so nothing typed is lost if the server sends the form back.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && confirm !== password;

  return (
    <div>
      <span className="grid size-11 place-items-center bg-primary text-primary-foreground">
        <IconComponent className="size-5" strokeWidth={1.75} />
      </span>
      <h1 className="mt-6 text-3xl tracking-[-0.035em]">{copy.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{intent === "signup" && campusSignIn ? `Join with your @${domain} account.` : copy.lead}</p>
      {intent === "signup" && campusSignIn && <CampusSignIn />}

      <form action={formAction} className="mt-7 space-y-4">
        <Field data-invalid={Boolean(fieldError(state, "email"))}>
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
            className="h-12 text-base"
          />
          {fieldError(state, "email") ? (
            <FieldError>{fieldError(state, "email")}</FieldError>
          ) : (
            <FieldDescription>Only @{domain} addresses can join.</FieldDescription>
          )}
        </Field>
        <Field data-invalid={Boolean(fieldError(state, "password"))}>
          <FieldLabel htmlFor="password">{copy.password}</FieldLabel>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 text-base"
          />
          {fieldError(state, "password") ? <FieldError>{fieldError(state, "password")}</FieldError> : <PasswordHint value={password} />}
        </Field>
        <Field data-invalid={mismatch || Boolean(fieldError(state, "confirm"))}>
          <FieldLabel htmlFor="confirm">Confirm {copy.password.toLowerCase()}</FieldLabel>
          <PasswordInput
            id="confirm"
            name="confirm"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            aria-invalid={mismatch}
            className="h-12 text-base"
          />
          <FieldError>{mismatch ? "The two passwords don't match." : fieldError(state, "confirm")}</FieldError>
        </Field>
        <FormMessage state={state} />
        <SubmitButton size="xl" className="w-full" pendingLabel={copy.pending}>
          {copy.submit} <ArrowRight />
        </SubmitButton>
      </form>

      <p className="mt-7 text-center text-sm text-muted-foreground">
        {copy.footer.text}{" "}
        <Link href={copy.footer.href} className="font-medium text-foreground underline-offset-4 hover:underline">
          {copy.footer.link}
        </Link>
      </p>
    </div>
  );
}
