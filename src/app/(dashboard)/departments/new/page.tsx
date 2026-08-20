import Link from "next/link";
import { FormField, SelectField } from "@/components/form-field";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";
import { createDepartment } from "@/core/departments/actions";

export default async function NewDepartmentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const context = await requireOrganization(); const { supabase } = await requireUser();
  const { data: locations } = await supabase.from("locations").select("id,name").eq("organization_id", context.organization.id).eq("active", true).order("name"); const params = await searchParams;
  return (<><PageHeader title="Add department" description="Optionally connect it to an active location." /><section className="panel form-panel"><MessageBanner error={params.error} /><form action={createDepartment} className="form-grid"><FormField label="Department name" name="name" required /><SelectField label="Location" name="locationId" defaultValue=""><option value="">All locations</option>{locations?.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</SelectField><div className="button-row"><button className="button" type="submit">Add department</button><Link className="button ghost" href="/departments">Cancel</Link></div></form></section></>);
}
