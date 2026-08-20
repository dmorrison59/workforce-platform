"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="auth-shell"><section className="auth-card"><span className="eyebrow">Something went wrong</span><h1 className="title">We could not load this page.</h1><p className="muted">Try again. If the problem continues, verify the Supabase environment settings and migration status.</p><button className="button" onClick={reset}>Try again</button></section></main>;
}
