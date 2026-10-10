import { z } from "zod";

/**
 * The shape every Server Action returns to its View (via useActionState).
 * Views render `message` and `fieldErrors`; they never see raw errors.
 */
export type ActionState<TData = undefined> =
  | { status: "idle" }
  | { status: "success"; message?: string; data?: TData }
  | { status: "error"; message: string; fieldErrors?: Partial<Record<string, string[]>> };

export const idleState = { status: "idle" } as const satisfies ActionState;

export const success = <TData = undefined>(message?: string, data?: TData): ActionState<TData> => ({
  status: "success",
  message,
  data,
});

export const failure = (
  message: string,
  fieldErrors?: Partial<Record<string, string[]>>,
): ActionState<never> => ({ status: "error", message, fieldErrors });

export function invalid(error: z.ZodError): ActionState<never> {
  const { fieldErrors, formErrors } = z.flattenError(error);
  const first = formErrors[0] ?? Object.values(fieldErrors).flat()[0];
  return failure(first ?? "Please check the highlighted fields.", fieldErrors as Partial<Record<string, string[]>>);
}

/** FormData → plain object, collecting repeated keys (checkbox groups) into arrays. */
export function formToObject(formData: FormData, arrayKeys: readonly string[] = []) {
  const out: Record<string, unknown> = {};
  for (const key of new Set(formData.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const values = formData.getAll(key);
    out[key] = arrayKeys.includes(key) ? values : values[values.length - 1];
  }
  for (const key of arrayKeys) out[key] ??= [];
  return out;
}
