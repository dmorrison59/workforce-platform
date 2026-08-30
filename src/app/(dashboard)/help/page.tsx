import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/core/auth/context";
import { HelpTabs } from "@/components/help-tabs";

export default async function HelpPage() {
  // Just checking auth; no database queries needed for static help text
  await requireOrganization(); 

  return (
    <>
      <PageHeader
        title="Help & Quick Start Guides"
        description="Plain-language guides for owners and crew members."
      />
      <HelpTabs />
    </>
  );
}