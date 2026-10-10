"use client";

import { Ban, Flag } from "lucide-react";
import { useActionState, useState } from "react";
import { REPORT_CATEGORIES } from "@/config/safety";
import { idleState, type ActionState } from "@/lib/action";
import { FormMessage, SubmitButton } from "@/views/components/form-bits";
import { useActionToast } from "@/views/hooks/use-action-toast";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/views/ui/alert-dialog";
import { Button } from "@/views/ui/button";
import { Checkbox } from "@/views/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/views/ui/dialog";
import { Field, FieldLabel } from "@/views/ui/field";
import { Textarea } from "@/views/ui/textarea";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function ReportDialog({
  memberId,
  memberName,
  planId,
  action,
  trigger,
}: {
  memberId: string;
  memberName: string;
  planId?: string;
  action: Action;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, idleState);
  useActionToast(state, { onSuccess: () => setOpen(false) });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Flag /> Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {memberName}</DialogTitle>
          <DialogDescription>
            Reports are private and reviewed by a real person. If you&apos;re in danger right now, contact campus
            security first.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="reportedId" value={memberId} />
          {planId && <input type="hidden" name="planId" value={planId} />}
          <div className="grid gap-2">
            {REPORT_CATEGORIES.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm transition-colors hover:border-foreground/30 has-[:checked]:border-primary has-[:checked]:bg-primary has-[:checked]:text-primary-foreground"
              >
                <input type="radio" name="category" value={c.id} className="sr-only" required />
                {c.label}
              </label>
            ))}
          </div>
          <Field>
            <FieldLabel htmlFor={`details-${memberId}`}>What happened? (optional)</FieldLabel>
            <Textarea id={`details-${memberId}`} name="details" maxLength={1000} className="min-h-20" />
          </Field>
          <Field orientation="horizontal">
            <Checkbox id={`block-${memberId}`} name="alsoBlock" defaultChecked />
            <FieldLabel htmlFor={`block-${memberId}`} className="font-normal">
              Also block {memberName}
            </FieldLabel>
          </Field>
          <FormMessage state={state} />
          <SubmitButton variant="destructive" className="w-full">
            Send report
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BlockButton({ memberId, memberName, action }: { memberId: string; memberName: string; action: Action }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, idleState);
  useActionToast(state, { onSuccess: () => setOpen(false) });
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Ban /> Block
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Block {memberName}?</AlertDialogTitle>
          <AlertDialogDescription>
            You won&apos;t see each other&apos;s plans, profiles or chats, and they can&apos;t message you. They
            won&apos;t be told. You can unblock them in Settings.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <form action={formAction}>
            <input type="hidden" name="userId" value={memberId} />
            <SubmitButton variant="destructive" className="w-full sm:w-auto">
              <Ban /> Block
            </SubmitButton>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
