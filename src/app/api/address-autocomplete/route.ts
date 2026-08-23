import { createClient } from "@/lib/supabase/server";
import {
  capabilityForAddressAutocompleteScope,
  parseAddressAutocompleteScope,
} from "@/modules/address-autocomplete/scope";
import { searchGeoapifyAddresses } from "@/modules/address-autocomplete/services/geoapify";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const scope = parseAddressAutocompleteScope(requestUrl.searchParams.get("scope"));
  if (!scope) return Response.json({ error: "Invalid address autocomplete scope." }, { status: 400 });

  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return Response.json({ error: "Active organization required." }, { status: 403 });
  }

  const { data: hasRequiredPermission, error: permissionError } = await supabase.rpc("has_permission", {
    target_organization_id: membership.organization_id,
    requested_capability: capabilityForAddressAutocompleteScope(scope),
  });
  if (permissionError || !hasRequiredPermission) {
    return Response.json({ error: "Address autocomplete permission required." }, { status: 403 });
  }

  const query = requestUrl.searchParams.get("query")?.trim() ?? "";
  if (query.length < 3) return Response.json({ enabled: true, suggestions: [] });
  if (query.length > 200) {
    return Response.json({ error: "Address query is too long." }, { status: 400 });
  }

  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) return Response.json({ enabled: false, suggestions: [] });

  try {
    const suggestions = await searchGeoapifyAddresses(query, apiKey);
    return Response.json({ enabled: true, suggestions });
  } catch (error) {
    console.error("Address autocomplete provider request failed.", error);
    return Response.json({ error: "Address suggestions are temporarily unavailable." }, { status: 502 });
  }
}
