import "server-only";
import { normalizeGeoapifySuggestions } from "./normalize";

const GEOAPIFY_AUTOCOMPLETE_URL = "https://api.geoapify.com/v1/geocode/autocomplete";

export async function searchGeoapifyAddresses(query: string, apiKey: string) {
  const url = new URL(GEOAPIFY_AUTOCOMPLETE_URL);
  url.searchParams.set("text", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "6");
  url.searchParams.set("apiKey", apiKey);

  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Geoapify autocomplete returned ${response.status}.`);

  return normalizeGeoapifySuggestions(await response.json());
}
