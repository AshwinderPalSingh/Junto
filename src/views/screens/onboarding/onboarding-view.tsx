"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import type { ActionState } from "@/lib/action";
import { cn } from "@/lib/utils";
import { Logo } from "@/views/components/logo";
import { Button } from "@/views/ui/button";
import type { OnboardingStep, OnboardingVM } from "@/views/view-models";
import { AboutForm, GuidelinesForm, PhotoUploader, PreferencesForm } from "./profile-forms";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type Props = {
  vm: OnboardingVM;
  actions: {
    saveAbout: Action;
    savePreferences: Action;
    uploadPhoto: (prev: ActionState<{ url: string }>, formData: FormData) => Promise<ActionState<{ url: string }>>;
    finishOnboarding: Action;
  };
};

const STEPS: { id: OnboardingStep; label: string; title: string; description: string }[] = [
  { id: "about", label: "About you", title: "Set up your profile", description: "The basics people see when you ask to join their plan." },
  { id: "preferences", label: "Comfort", title: "Who are you comfortable meeting?", description: "Your boundaries, kept private. Matching only happens when it's mutual." },
  { id: "photo", label: "Photo", title: "One photo, so people can find you", description: "Required, and the only photo we'll ever ask for." },
  { id: "guidelines", label: "Guidelines", title: "A few ground rules", description: "Junto works because everyone keeps it safe and low-pressure." },
];

export function OnboardingView({ vm, actions }: Props) {
  const index = STEPS.findIndex((s) => s.id === vm.step);
  const step = STEPS[index];
  const previous = STEPS[index - 1];

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-5 pt-6 pb-16">
      <header className="flex items-center justify-between">
        <Logo />
        {vm.editing ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/profile">Done</Link>
          </Button>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">{vm.email}</span>
        )}
      </header>

      <nav aria-label="Setup progress" className="mt-10">
        <ol className="grid grid-cols-4 gap-1.5">
          {STEPS.map((s, i) => {
            const done = vm.completed.includes(s.id);
            const current = s.id === vm.step;
            const reachable = done || i <= index;
            return (
              <li key={s.id}>
                <Link
                  href={`/onboarding?step=${s.id}`}
                  aria-current={current ? "step" : undefined}
                  className={cn("group block", !reachable && "pointer-events-none")}
                  tabIndex={reachable ? 0 : -1}
                >
                  <span className="block h-1 overflow-hidden bg-muted">
                    <span
                      className={cn(
                        "block h-full bg-foreground transition-[width] duration-700 ease-out",
                        current || done ? "w-full" : "w-0",
                        done && !current && "opacity-40",
                      )}
                    />
                  </span>
                  <span
                    className={cn(
                      "mt-2.5 flex items-center gap-1 label-caps text-[0.62rem]",
                      current ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {done && !current && <Check className="size-3" />}
                    {s.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </nav>

      <section key={vm.step} className="mt-12 animate-glass-in">
        <p className="label-caps text-muted-foreground">
          Step {index + 1} of {STEPS.length}
        </p>
        <h1 className="mt-2 text-4xl leading-[1.05] tracking-[-0.04em] sm:text-5xl">{step.title}</h1>
        <p className="mt-3 text-muted-foreground">{step.description}</p>

        <div className="mt-10">
          {vm.step === "about" && <AboutForm profile={vm.profile} action={actions.saveAbout} />}
          {vm.step === "preferences" && <PreferencesForm preferences={vm.preferences} action={actions.savePreferences} />}
          {vm.step === "photo" && (
            <PhotoUploader
              photo={vm.photo}
              action={actions.uploadPhoto}
              footer={(hasPhoto) => (
                <Button
                  asChild
                  size="xl"
                  className={cn("w-full sm:w-auto sm:px-10", !hasPhoto && "pointer-events-none opacity-40")}
                >
                  <Link href="/onboarding?step=guidelines" aria-disabled={!hasPhoto} tabIndex={hasPhoto ? 0 : -1}>
                    Continue <ArrowRight />
                  </Link>
                </Button>
              )}
            />
          )}
          {vm.step === "guidelines" && <GuidelinesForm action={actions.finishOnboarding} />}
        </div>

        {previous && (
          <Button asChild variant="ghost" className="mt-8 -ml-3 text-muted-foreground">
            <Link href={`/onboarding?step=${previous.id}`}>
              <ArrowLeft /> Back
            </Link>
          </Button>
        )}
      </section>
    </div>
  );
}
