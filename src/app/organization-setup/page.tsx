import { redirect } from "next/navigation";
import { FormField, SelectField } from "@/components/form-field";
import { MessageBanner } from "@/components/message-banner";
import { getOrganizationContext, requireUser } from "@/core/auth/context";
import { createOrganization } from "@/core/organizations/actions";

export default async function OrganizationSetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser();
  if (await getOrganizationContext()) redirect("/dashboard");
  const params = await searchParams;
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="eyebrow">Organization setup</span>
        <h1 className="title">Create your workspace</h1>
        <p className="muted">You will become the owner with full Gate 0 permissions.</p>
        <MessageBanner error={params.error} />
        <form action={createOrganization} className="form-grid">
          <FormField label="Organization name" name="name" required maxLength={120} />
          <FormField label="Workspace slug" name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" hint="Lowercase letters, numbers, and hyphens only." />
          <SelectField label="Timezone" name="timezone" defaultValue="America/New_York">
            <option value="America/New_York">Eastern Time</option>
            <option value="America/Chicago">Central Time</option>
            <option value="America/Denver">Mountain Time</option>
            <option value="America/Los_Angeles">Pacific Time</option>
            <option value="America/Anchorage">Alaska Time</option>
            <option value="Pacific/Honolulu">Hawaii Time</option>
          </SelectField>
          <button className="button" type="submit">Create organization</button>
        </form>
      </section>
    </main>
  );
}
