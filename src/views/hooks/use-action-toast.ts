"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action";

/** Shows a toast whenever a Server Action reports success (with a message) or an error. */
export function useActionToast(state: ActionState<unknown>, options: { onSuccess?: () => void } = {}) {
  const { onSuccess } = options;
  useEffect(() => {
    if (state.status === "success") {
      if (state.message) toast.success(state.message);
      onSuccess?.();
    } else if (state.status === "error") {
      toast.error(state.message);
    }
    // Only react to new results, not to a changed callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
