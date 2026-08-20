import Link from "next/link";
import { signIn } from "@/core/auth/actions";
import { FormField } from "@/components/form-field";
import { MessageBanner } from "@/components/message-banner";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams;
  return (
    <section className="auth-card">
      <span className="eyebrow">Workforce Core</span>
      <h1 className="title">Welcome back</h1>
      <p className="muted">Sign in to manage your organization.</p>
      <MessageBanner error={params.error} message={params.message} />
      <form action={signIn} className="form-grid">
        <FormField label="Email" name="email" type="email" autoComplete="email" required />
        <FormField label="Password" name="password" type="password" autoComplete="current-password" required />
        <button className="button" type="submit">Sign in</button>
      </form>
      <p className="muted">New to Workforce Core? <Link href="/sign-up"><strong>Create an account</strong></Link></p>
    </section>
  );
}
