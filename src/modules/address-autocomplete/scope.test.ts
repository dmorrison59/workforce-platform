import { describe, expect, it } from "vitest";
import {
  capabilityForAddressAutocompleteScope,
  parseAddressAutocompleteScope,
} from "./scope";

describe("address autocomplete scope", () => {
  it("preserves employee behavior when older clients omit scope", () => {
    expect(parseAddressAutocompleteScope(null)).toBe("employee");
    expect(capabilityForAddressAutocompleteScope("employee")).toBe("employee.manage");
  });

  it("requires location management for location suggestions", () => {
    expect(parseAddressAutocompleteScope("location")).toBe("location");
    expect(capabilityForAddressAutocompleteScope("location")).toBe("location.manage");
  });

  it("rejects unknown scopes", () => {
    expect(parseAddressAutocompleteScope("unknown")).toBeNull();
  });
});
