import Link from "next/link";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";

export default async function DepartmentsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const context = await requireOrganization(); const { supabase } = await requireUser();
  const [{ data: departments }, { data: locations }] = await Promise.all([supabase.from("departments").select("*").eq("organization_id", context.organization.id).order("name"), supabase.from("locations").select("id,name").eq("organization_id", context.organization.id)]);
  const locationNames = new Map((locations ?? []).map((location) => [location.id, location.name])); const params = await searchParams;
  return (<><PageHeader title="Departments" description="Departments may apply organization-wide or to one location." action={<Link className="button" href="/departments/new">Add department</Link>} /><MessageBanner message={params.message} /><section className="panel table-wrap">{departments?.length ? <table className="data-table"><thead><tr><th>Name</th><th>Location</th><th>Status</th></tr></thead><tbody>{departments.map((department) => <tr key={department.id}><td><strong>{department.name}</strong></td><td>{department.location_id ? locationNames.get(department.location_id) ?? "Unknown" : "All locations"}</td><td><span className={department.active ? "status" : "status off"}>{department.active ? "Active" : "Inactive"}</span></td></tr>)}</tbody></table> : <div className="empty">No departments yet.</div>}</section></>);
}
