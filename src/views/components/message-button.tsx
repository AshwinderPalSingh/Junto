"use client";

import { MessageCircle } from "lucide-react";
import { useActionState } from "react";
import { idleState, type ActionState } from "@/lib/action";
import { SubmitButton } from "@/views/components/form-bits";
import { useActionToast } from "@/views/hooks/use-action-toast";

export type StartChatAction = (targetId: string, prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Opens the direct chat with a member (the server checks they can be messaged). */
export function MessageButton({
  memberId,
  memberName,
  action,
  compact = false,
  variant = "outline",
}: {
  memberId: string;
  memberName: string;
  action: StartChatAction;
  /** Icon-only, for dense lists. */
  compact?: boolean;
  variant?: "default" | "outline" | "ghost";
}) {
  const [state, formAction] = useActionState(action.bind(null, memberId), idleState);
  useActionToast(state);
  return (
    <form action={formAction}>
      {compact ? (
        <SubmitButton variant="ghost" size="icon-sm" aria-label={`Message ${memberName}`} pendingLabel="">
          <MessageCircle className="text-muted-foreground" />
        </SubmitButton>
      ) : (
        <SubmitButton variant={variant} pendingLabel="Opening…">
          <MessageCircle /> Message
        </SubmitButton>
      )}
    </form>
  );
}
