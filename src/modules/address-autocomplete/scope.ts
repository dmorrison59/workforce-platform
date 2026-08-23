import type { Capability } from "@/core/permissions/capabilities";
import type { AddressAutocompleteScope } from "./types";

const scopeCapabilities: Record<AddressAutocompleteScope, Capability> = {
  employee: "employee.manage",
  location: "location.manage",
};

export function parseAddressAutocompleteScope(value: string | null): AddressAutocompleteScope | null {
  if (value === null) return "employee";
  return value === "employee" || value === "location" ? value : null;
}

export function capabilityForAddressAutocompleteScope(scope: AddressAutocompleteScope) {
  return scopeCapabilities[scope];
}
