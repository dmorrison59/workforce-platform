import { describe, expect, it } from "vitest";
import { normalizeGeoapifySuggestions } from "./normalize";

describe("Geoapify address normalization", () => {
  it("maps a provider selection into structured employee address fields", () => {
    const suggestions = normalizeGeoapifySuggestions({
      results: [{
        place_id: "place-1",
        formatted: "350 Fifth Avenue, New York, NY 10118, United States",
        address_line1: "350 Fifth Avenue",
        city: "New York",
        state: "New York",
        state_code: "NY",
        postcode: "10118",
        country: "United States",
        country_code: "us",
      }],
    });

    expect(suggestions).toEqual([{
      id: "place-1",
      label: "350 Fifth Avenue, New York, NY 10118, United States",
      streetAddress: "350 Fifth Avenue",
      city: "New York",
      stateProvince: "NY",
      postalCode: "10118",
      country: "United States",
    }]);
  });

  it("ignores malformed suggestions instead of leaking provider-specific data", () => {
    expect(normalizeGeoapifySuggestions({ results: [null, { city: "Nowhere" }] })).toEqual([]);
    expect(normalizeGeoapifySuggestions(null)).toEqual([]);
  });
});
