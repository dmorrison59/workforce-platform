import { redirect } from "next/navigation";
import type { ZodError, ZodType } from "zod";

export function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export function firstValidationMessage(error: ZodError) {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}

export function parseForm<T>(schema: ZodType<T>, formData: FormData): T {
  const result = schema.safeParse(formValues(formData));
  if (!result.success) {
    throw new FormValidationError(firstValidationMessage(result.error));
  }
  return result.data;
}

export class FormValidationError extends Error {}

export function redirectWithMessage(
  path: string,
  kind: "error" | "message" | "warning",
  message: string,
): never {
  const params = new URLSearchParams({ [kind]: message });
  redirect(`${path}${path.includes("?") ? "&" : "?"}${params.toString()}`);
}
