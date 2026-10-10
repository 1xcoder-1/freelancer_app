import { z } from "zod";
import { toast } from "sonner";

/**
 * Shared zod helpers so every feature page validates user input the same
 * way: build a schema, safeParse in the submit handler, and surface the
 * first readable problem with toastValidation().
 */

export const nameSchema = (label: string, max = 100) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

export const optionalTextSchema = (label: string, max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ?? "").trim());

export const moneySchema = (label: string, max = 10_000_000) =>
  z
    .number({ message: `${label} must be a number` })
    .min(0, `${label} cannot be negative`)
    .max(max, `${label} looks too large`);

/** Runs a schema in a submit handler; toasts the first error and returns false. */
export function validateOrToast<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown
): data is z.output<S> {
  const parsed = schema.safeParse(data);
  if (parsed.success) return true;
  const msgs = fieldErrors(parsed.error);
  toast.error(msgs[0] ?? "Please fix the highlighted fields");
  return false;
}

/** Human-readable messages from a ZodError, in field order. */
export function fieldErrors(error: z.ZodError): string[] {
  const seen = new Set<string>();
  for (const issue of error.issues) {
    seen.add(issue.message);
  }
  return [...seen];
}
