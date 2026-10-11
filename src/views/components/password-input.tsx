"use client";

import { Check, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/views/ui/input";

/** A password field with a show/hide toggle. */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-12", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        {visible ? <EyeOff className="size-[18px]" strokeWidth={1.75} /> : <Eye className="size-[18px]" strokeWidth={1.75} />}
      </button>
    </div>
  );
}

/** 0 = too short, 1 = weak, 2 = good, 3 = strong. A hint, not a rule: the server checks the rules. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 {
  if (password.trim().length < 8) return 0;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  const score = kinds + (password.length >= 12 ? 1 : 0) + (password.length >= 16 ? 1 : 0);
  return score >= 4 ? 3 : score >= 3 ? 2 : 1;
}

const LABELS = ["At least 8 characters", "Weak: add numbers, symbols or more length", "Good", "Strong"] as const;

export function PasswordHint({ value }: { value: string }) {
  const strength = passwordStrength(value);
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="grid grid-cols-3 gap-1" aria-hidden="true">
        {[1, 2, 3].map((level) => (
          <span
            key={level}
            className={cn(
              "h-1 rounded-full transition-colors duration-300",
              strength >= level ? (strength === 3 ? "bg-success" : "bg-foreground/70") : "bg-muted",
            )}
          />
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {strength > 0 && <Check className="size-3.5" strokeWidth={2} />}
        {LABELS[strength]}
      </p>
    </div>
  );
}
