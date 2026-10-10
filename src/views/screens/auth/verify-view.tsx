"use client";

import { REGEXP_ONLY_DIGITS } from "input-otp";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { idleState, type ActionState } from "@/lib/action";
import { FormMessage, SubmitButton } from "@/views/components/form-bits";
import { useActionToast } from "@/views/hooks/use-action-toast";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/views/ui/input-otp";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Props = {
  email: string;
  codeLength: number;
  resendAfterSeconds: number;
  ttlMinutes: number;
  verifyCode: Action;
  resendCode: Action;
};

export function VerifyView({ email, codeLength, resendAfterSeconds, ttlMinutes, verifyCode, resendCode }: Props) {
  const [state, action] = useActionState(verifyCode, idleState);
  const [resendState, resendAction] = useActionState(resendCode, idleState);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(resendAfterSeconds);
  const formRef = useRef<HTMLFormElement>(null);
  const half = Math.ceil(codeLength / 2);

  useActionToast(resendState, { onSuccess: () => setCooldown(resendAfterSeconds) });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // A wrong or expired code clears the boxes so the next attempt starts fresh.
  useEffect(() => {
    if (state.status === "error") queueMicrotask(() => setCode(""));
  }, [state]);

  const submit = () => formRef.current?.requestSubmit();

  return (
    <div>
      <span className="grid size-11 place-items-center bg-primary text-primary-foreground">
        <KeyRound className="size-5" strokeWidth={1.75} />
      </span>
      <h1 className="mt-6 text-3xl tracking-[-0.035em]">Check your inbox</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We sent a {codeLength}-digit code to <span className="font-medium text-foreground">{email}</span>. It expires in{" "}
        {ttlMinutes} minutes. Can&apos;t see it? Check spam or promotions.
      </p>

      <form ref={formRef} action={action} className="mt-7 space-y-5">
        <input type="hidden" name="email" value={email} />
        <InputOTP
          maxLength={codeLength}
          name="code"
          value={code}
          onChange={setCode}
          onComplete={submit}
          pattern={REGEXP_ONLY_DIGITS}
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          containerClassName="justify-between"
          aria-label="One-time code"
        >
          <InputOTPGroup>
            {Array.from({ length: half }, (_, i) => (
              <InputOTPSlot key={i} index={i} className="size-12 bg-[var(--glass-fill)] font-mono text-lg" />
            ))}
          </InputOTPGroup>
          <InputOTPSeparator />
          <InputOTPGroup>
            {Array.from({ length: codeLength - half }, (_, i) => (
              <InputOTPSlot key={i} index={half + i} className="size-12 bg-[var(--glass-fill)] font-mono text-lg" />
            ))}
          </InputOTPGroup>
        </InputOTP>
        <FormMessage state={state} />
        <SubmitButton size="xl" className="w-full" pendingLabel="Checking…" disabled={code.length < codeLength}>
          Continue
        </SubmitButton>
      </form>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href="/login" className="text-muted-foreground hover:text-foreground">
          Use a different email
        </Link>
        <form action={resendAction}>
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            disabled={cooldown > 0}
            className="font-medium text-foreground underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </button>
        </form>
      </div>
    </div>
  );
}
