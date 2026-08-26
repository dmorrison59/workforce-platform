/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Invited employees get linked on first confirmed sign-in.
      const { data: linkedOrganizationId } = await supabase.rpc("accept_employee_invitation" as any);
      return NextResponse.redirect(
        new URL(linkedOrganizationId ? "/dashboard" : "/organization-setup", url.origin),
      );
    }
  }
  return NextResponse.redirect(new URL("/sign-in?error=Unable+to+confirm+your+account", url.origin));
}