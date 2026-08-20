"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getPublicEnvironment } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { formValues, redirectWithMessage } from "@/core/shared/forms";

const signUpSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must contain at least 8 characters.").max(128),
});

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirectWithMessage("/sign-up", "error", parsed.error.issues[0]?.message ?? "Invalid sign-up details.");
  }

  const supabase = await createClient();
  const environment = getPublicEnvironment();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { first_name: parsed.data.firstName, last_name: parsed.data.lastName },
      emailRedirectTo: `${environment.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) redirectWithMessage("/sign-up", "error", error.message);
  if (data.session) redirect("/organization-setup");
  redirectWithMessage("/sign-in", "message", "Check your email to confirm your account, then sign in.");
}

export async function signIn(formData: FormData) {
  const parsed = signInSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirectWithMessage("/sign-in", "error", parsed.error.issues[0]?.message ?? "Invalid credentials.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirectWithMessage("/sign-in", "error", "Email or password was not recognized.");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
