"use client";

import { ImageOff } from "lucide-react";
import { useActionState, useState } from "react";
import { idleState, type ActionState } from "@/lib/action";
import { PageHeader } from "@/views/components/bits";
import { SubmitButton } from "@/views/components/form-bits";
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
import type { AdminMemberVM } from "@/views/view-models";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

function PhotoTile({ member, rejectPhoto }: { member: AdminMemberVM; rejectPhoto: Action }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(rejectPhoto, idleState);
  useActionToast(state, { onSuccess: () => setOpen(false) });
  return (
    <li className="glass group animate-glass-in overflow-hidden">
      {member.photoUrl && (
        <div className="overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={member.photoUrl}
            alt={member.name}
            className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            loading="lazy"
          />
        </div>
      )}
      <div className="space-y-2 p-3">
        <p className="truncate text-sm font-medium">{member.name}</p>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              Ask for a new photo
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ask {member.name} for a new photo?</AlertDialogTitle>
              <AlertDialogDescription>
                Their current photo is deleted straight away. They&apos;ll be asked to upload a clear, recent photo of
                their face before they can use Junto again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <form action={action}>
                <input type="hidden" name="userId" value={member.id} />
                <SubmitButton variant="destructive" className="w-full sm:w-auto">
                  Remove photo
                </SubmitButton>
              </form>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

export function PhotosView({ members, rejectPhoto }: { members: AdminMemberVM[]; rejectPhoto: Action }) {
  return (
    <div>
      <PageHeader
        eyebrow="Moderation"
        title="Photo review"
        description="Newest first. Ask for a new photo if it isn't a clear, real photo of the member's face."
      />
      {members.length === 0 ? (
        <div className="glass border-dashed p-12 text-center">
          <ImageOff className="mx-auto size-6 text-muted-foreground" strokeWidth={1.5} />
          <p className="mt-3 text-muted-foreground">No photos to review yet.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {members.map((m) => (
            <PhotoTile key={m.id} member={m} rejectPhoto={rejectPhoto} />
          ))}
        </ul>
      )}
    </div>
  );
}
