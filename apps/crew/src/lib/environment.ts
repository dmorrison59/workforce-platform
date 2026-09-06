export interface PublicEnvironment {
  supabaseUrl: string;
  supabaseAnonKey: string;
}

let cachedEnvironment: PublicEnvironment | null = null;

function isLocalDevelopmentHost(hostname: string) {
  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) return true;
  if (hostname.startsWith("10.") || hostname.startsWith("192.168.")) return true;

  const match = /^172\.(\d{1,2})\./.exec(hostname);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

export function getPublicEnvironment(): PublicEnvironment {
  if (cachedEnvironment) return cachedEnvironment;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "YardClock Crew is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to apps/crew/.env.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL must be a valid URL.");
  }

  if (parsedUrl.protocol !== "https:" && !isLocalDevelopmentHost(parsedUrl.hostname)) {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL must use HTTPS outside local development.");
  }

  cachedEnvironment = { supabaseUrl, supabaseAnonKey };
  return cachedEnvironment;
}
