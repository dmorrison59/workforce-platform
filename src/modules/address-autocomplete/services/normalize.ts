import type { AddressSuggestion } from "../types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeGeoapifySuggestions(payload: unknown): AddressSuggestion[] {
  if (!isRecord(payload) || !Array.isArray(payload.results)) return [];

  return payload.results.flatMap((candidate, index) => {
    if (!isRecord(candidate)) return [];

    const streetAddress = textValue(candidate.address_line1)
      || [textValue(candidate.housenumber), textValue(candidate.street)].filter(Boolean).join(" ");
    const city = textValue(candidate.city)
      || textValue(candidate.town)
      || textValue(candidate.village)
      || textValue(candidate.county);
    const countryCode = textValue(candidate.country_code).toUpperCase();
    const stateProvince = textValue(candidate.state_code) || textValue(candidate.state);
    const postalCode = textValue(candidate.postcode);
    const country = textValue(candidate.country) || countryCode;
    const label = textValue(candidate.formatted)
      || [streetAddress, city, stateProvince, postalCode, country].filter(Boolean).join(", ");

    if (!streetAddress || !label) return [];

    return [{
      id: textValue(candidate.place_id) || `${streetAddress}-${postalCode}-${index}`,
      label,
      streetAddress,
      city,
      stateProvince,
      postalCode,
      country,
    }];
  });
}
