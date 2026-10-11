"use client";

import { LogOut, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { GENDERS } from "@/config/profile";
import { idleState, type ActionState } from "@/lib/action";
import { PageHeader } from "@/views/components/bits";
import { ChoiceCard } from "@/views/components/choice";
import { FormMessage, SubmitButton, fieldError } from "@/views/components/form-bits";
import { PasswordHint, PasswordInput } from "@/views/components/password-input";
import { MemberAvatar } from "@/views/components/member-avatar";
import { ThemeToggle } from "@/views/components/theme-toggle";
import { useActionToast } from "@/views/hooks/use-action-toast";
import { PreferencesForm } from "@/views/screens/onboarding/profile-forms";
import { Button } from "@/views/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/views/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/views/ui/field";
import { Input } from "@/views/ui/input";
import type { SettingsVM } from "@/views/view-models";
import { PushToggle } from "./push-toggle";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export type SettingsActions = {
  savePreferences: Action;
  savePassword: Action;
  saveChatPolicy: Action;
  savePushSubscription: (json: string) => Promise<ActionState>;
  removePushSubscription: (endpoint: string) => Promise<ActionState>;
  sendTestPush: () => Promise<ActionState>;
  unblockMember: Action;
  deleteAccount: Action;
  signOut: () => Promise<void>;
};

function Section({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section className={`glass animate-glass-in p-5 sm:p-6 ${danger ? "border-destructive/30" : ""}`}>
      <h2 className="label-caps text-muted-foreground">{title}</h2>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function UnblockRow({ person, action }: { person: SettingsVM["blocked"][number]; action: Action }) {
  const [state, formAction] = useActionState(action, idleState);
  useActionToast(state);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <MemberAvatar photo={person.photo} name={person.name} size="sm" />
      <span className="flex-1 text-sm font-medium">{person.name}</span>
      <form action={formAction}>
        <input type="hidden" name="userId" value={person.id} />
        <SubmitButton variant="outline" size="sm">
          Unblock
        </SubmitButton>
      </form>
    </li>
  );
}

function DeleteAccount({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, idleState);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">Delete my account</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            Your profile and photo are deleted, upcoming plans are cancelled and everyone involved is told. Safety
            reports are kept anonymously. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-3">
          <Input name="confirm" placeholder="Type DELETE to confirm" autoComplete="off" className="h-11" />
          <FormMessage state={state} />
          <SubmitButton variant="destructive" size="lg" className="w-full">
            Delete forever
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const CHAT_POLICIES = [
  {
    id: "anyone",
    title: "Anyone you could meet",
    description: "Members who are comfortable meeting you, and you them, can start a chat.",
  },
  { id: "met", title: "Only people you've met", description: "Someone you've been confirmed on a plan with." },
  { id: "nobody", title: "Nobody", description: "No new direct chats. Plan group chats still work." },
] as const;

function PasswordForm({ email, hasPassword, action }: { email: string; hasPassword: boolean; action: Action }) {
  const [state, formAction] = useActionState(action, idleState);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && confirm !== password;
  useActionToast(state, {
    onSuccess: () => {
      setCurrent("");
      setPassword("");
      setConfirm("");
    },
  });
  return (
    <form action={formAction} className="max-w-sm space-y-4">
      {/* Lets password managers save the new password against the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      {hasPassword && (
        <Field data-invalid={Boolean(fieldError(state, "current"))}>
          <FieldLabel htmlFor="current-password">Current password</FieldLabel>
          <PasswordInput
            id="current-password"
            name="current"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
          <FieldError>{fieldError(state, "current")}</FieldError>
        </Field>
      )}
      <Field data-invalid={Boolean(fieldError(state, "password"))}>
        <FieldLabel htmlFor="new-password">{hasPassword ? "New password" : "Password"}</FieldLabel>
        <PasswordInput
          id="new-password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {fieldError(state, "password") ? <FieldError>{fieldError(state, "password")}</FieldError> : <PasswordHint value={password} />}
      </Field>
      <Field data-invalid={mismatch}>
        <FieldLabel htmlFor="confirm-password">Confirm {hasPassword ? "new password" : "password"}</FieldLabel>
        <PasswordInput
          id="confirm-password"
          name="confirm"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <FieldError>{mismatch ? "The two passwords don't match." : fieldError(state, "confirm")}</FieldError>
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="outline">{hasPassword ? "Change password" : "Create password"}</SubmitButton>
    </form>
  );
}

function ChatPolicyForm({ policy, action }: { policy: SettingsVM["chatPolicy"]; action: Action }) {
  const [state, formAction] = useActionState(action, idleState);
  useActionToast(state);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-2">
        {CHAT_POLICIES.map((p) => (
          <ChoiceCard
            key={p.id}
            name="chatPolicy"
            value={p.id}
            defaultChecked={policy === p.id}
            title={p.title}
            description={p.description}
          />
        ))}
      </div>
      <FormMessage state={state} />
      <SubmitButton variant="outline">Save chat settings</SubmitButton>
    </form>
  );
}

export function SettingsView({ vm, actions }: { vm: SettingsVM; actions: SettingsActions }) {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Account" title="Settings" />

      <Section title="Account">
        <dl className="grid gap-px border border-border bg-border text-sm sm:grid-cols-2">
          <div className="bg-background/70 p-3.5 backdrop-blur-md">
            <dt className="label-caps text-[0.6rem] text-muted-foreground">Email</dt>
            <dd className="mt-1 truncate font-medium">{vm.email}</dd>
          </div>
          <div className="bg-background/70 p-3.5 backdrop-blur-md">
            <dt className="label-caps text-[0.6rem] text-muted-foreground">Gender (locked)</dt>
            <dd className="mt-1 font-medium">{GENDERS.find((g) => g.id === vm.gender)?.label ?? "—"}</dd>
          </div>
        </dl>
        <form action={actions.signOut} className="mt-4">
          <SubmitButton variant="outline">
            <LogOut /> Sign out
          </SubmitButton>
        </form>
      </Section>

      <Section
        title="Password"
        description={
          vm.hasPassword
            ? "Changing it signs you out on your other devices."
            : "You sign in with email codes. Add a password to sign in faster; codes keep working too."
        }
      >
        <PasswordForm email={vm.email} hasPassword={vm.hasPassword} action={actions.savePassword} />
      </Section>

      <Section title="Appearance" description="Light mode uses frosted glass. Dark mode uses calm, solid surfaces.">
        <ThemeToggle />
      </Section>

      <Section
        title="Who you're comfortable meeting"
        description="Private. Changes apply to plans you see and who can see yours."
      >
        <PreferencesForm
          preferences={{ companionGenders: vm.companionGenders, groupPref: vm.groupPref }}
          action={actions.savePreferences}
          submitLabel="Save preferences"
          returnTo="settings"
        />
      </Section>

      <Section
        title="Who can start a chat with you"
        description="Existing chats keep working until you block someone. Blocking always ends a chat."
      >
        <ChatPolicyForm policy={vm.chatPolicy} action={actions.saveChatPolicy} />
      </Section>

      <Section
        title="Notifications"
        description={`Hear about requests and meetups even when Junto isn't open.${vm.pushDevices ? ` On for ${vm.pushDevices} device${vm.pushDevices === 1 ? "" : "s"}.` : ""}`}
      >
        <PushToggle
          vapidPublicKey={vm.vapidPublicKey}
          save={actions.savePushSubscription}
          remove={actions.removePushSubscription}
          test={actions.sendTestPush}
        />
      </Section>

      <Section title="Blocked members" description="You can't see each other's plans, profiles or chats.">
        {vm.blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven&apos;t blocked anyone.</p>
        ) : (
          <ul className="divide-y divide-border">
            {vm.blocked.map((p) => (
              <UnblockRow key={p.id} person={p} action={actions.unblockMember} />
            ))}
          </ul>
        )}
      </Section>

      {vm.isAdmin && (
        <Section title="Moderation">
          <Button asChild variant="outline">
            <Link href="/admin">
              <ShieldAlert /> Open moderation tools
            </Link>
          </Button>
        </Section>
      )}

      <Section title="Danger zone" danger>
        <DeleteAccount action={actions.deleteAccount} />
      </Section>
    </div>
  );
}
