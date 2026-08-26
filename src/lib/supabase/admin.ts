import { createServerClient } from "@supabase/ssr";
import { getPublicEnvironment } from "@/lib/env";
import type { Database } from "@/types/database";

// Service-role client for server-only operations (e.g. sending invite emails).
// Never import this from client components; the key must never reach the browser.
export function createAdminClient() {
  const environment = getPublicEnvironment();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing from the server environment.");
  }

  return createServerClient<Database>(environment.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}