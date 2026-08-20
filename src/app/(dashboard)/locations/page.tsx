import Link from "next/link";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization, requireUser } from "@/core/auth/context";

export default async function LocationsPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const context = await requireOrganization(); const { supabase } = await requireUser();
  const { data: locations } = await supabase.from("locations").select("*").eq("organization_id", context.organization.id).order("name");
  const params = await searchParams;
  return (<><PageHeader title="Locations" description="Physical workplaces owned by this organization." action={<Link className="button" href="/locations/new">Add location</Link>} /><MessageBanner message={params.message} /><section className="panel table-wrap">{locations?.length ? <table className="data-table"><thead><tr><th>Name</th><th>Address</th><th>Status</th></tr></thead><tbody>{locations.map((location) => <tr key={location.id}><td><strong>{location.name}</strong></td><td>{location.address}<br />{location.city}, {location.state} {location.postal_code}</td><td><span className={location.active ? "status" : "status off"}>{location.active ? "Active" : "Inactive"}</span></td></tr>)}</tbody></table> : <div className="empty">No locations yet.</div>}</section></>);
}
