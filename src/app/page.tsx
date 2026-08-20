import { redirect } from "next/navigation";
import { getOrganizationContext, requireUser } from "@/core/auth/context";

export default async function Home() {
  await requireUser();
  const context = await getOrganizationContext();
  redirect(context ? "/dashboard" : "/organization-setup");
}
