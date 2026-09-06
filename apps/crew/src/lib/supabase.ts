import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createClient,
  processLock,
  type SupabaseClient,
} from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

import { getPublicEnvironment } from "@/lib/environment";
import type { MobileDatabase } from "@/types/database";

let client: SupabaseClient<MobileDatabase> | null = null;

export function getSupabaseClient() {
  if (client) return client;

  const environment = getPublicEnvironment();
  client = createClient<MobileDatabase>(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    },
  );

  return client;
}
