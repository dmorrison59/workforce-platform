import Link from "next/link";
import { signUp } from "@/core/auth/actions";
import { FormField } from "@/components/form-field";
import { MessageBanner } from "@/components/message-banner";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <section className="auth-card">
      <span className="eyebrow">YardClock</span>
      <h1 className="title">Create your account</h1>
      <p className="muted">Start with a secure organization workspace. Employee accounts stay separate from employee records.</p>
      <MessageBanner error={params.error} />
      <form action={signUp} className="form-grid">
        <div className="two-col">
          <FormField label="First name" name="firstName" autoComplete="given-name" required />
          <FormField label="Last name" name="lastName" autoComplete="family-name" required />
        </div>
        <FormField label="Email" name="email" type="email" autoComplete="email" required />
        <FormField label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required hint="Use at least 8 characters." />
        <button className="button" type="submit">Create account</button>
      </form>
      <p className="muted">Already have an account? <Link href="/sign-in"><strong>Sign in</strong></Link></p>
    </section>
  );
}
