import Link from "next/link";
import { FormField } from "@/components/form-field";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { createLocation } from "@/core/locations/actions";

export default async function NewLocationPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (<><PageHeader title="Add location" description="Create an organization-scoped workplace." /><section className="panel form-panel"><MessageBanner error={params.error} /><form action={createLocation} className="form-grid"><FormField label="Location name" name="name" required /><FormField label="Street address" name="address" required /><div className="two-col"><FormField label="City" name="city" required /><FormField label="State / province" name="state" required /></div><FormField label="Postal code" name="postalCode" required /><div className="button-row"><button className="button" type="submit">Add location</button><Link className="button ghost" href="/locations">Cancel</Link></div></form></section></>);
}
