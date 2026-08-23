"use client";

import { useEffect, useId, useRef, useState } from "react";
import type {
  AddressAutocompleteResponse,
  AddressAutocompleteScope,
  AddressSuggestion,
} from "@/modules/address-autocomplete/types";

type Availability = "unknown" | "disabled";

interface AddressFieldNames {
  streetAddress: string;
  addressLine2?: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country?: string;
}

interface StructuredAddressFieldsProps {
  scope: AddressAutocompleteScope;
  fieldNames: AddressFieldNames;
  defaultCountry?: string;
  required?: boolean;
}

export function StructuredAddressFields({
  scope,
  fieldNames,
  defaultCountry = "",
  required = false,
}: StructuredAddressFieldsProps) {
  const listboxId = useId();
  const helpId = useId();
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateProvince, setStateProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState(defaultCountry);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [availability, setAvailability] = useState<Availability>("unknown");
  const [providerEnabled, setProviderEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const suppressNextLookup = useRef(false);

  useEffect(() => {
    const query = streetAddress.trim();
    if (suppressNextLookup.current) {
      suppressNextLookup.current = false;
      return;
    }
    if (availability === "disabled" || query.length < 3) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setMessage("");
      try {
        const search = new URLSearchParams({ query, scope });
        const response = await fetch(`/api/address-autocomplete?${search.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Address suggestions are unavailable.");

        const result = await response.json() as AddressAutocompleteResponse;
        if (!result.enabled) setAvailability("disabled");
        setProviderEnabled(result.enabled);
        setSuggestions(result.suggestions);
        setActiveIndex(-1);
        setOpen(result.suggestions.length > 0);
      } catch (error) {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setOpen(false);
          setMessage(error instanceof Error ? error.message : "Address suggestions are unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [availability, scope, streetAddress]);

  function selectSuggestion(suggestion: AddressSuggestion) {
    suppressNextLookup.current = true;
    setStreetAddress(suggestion.streetAddress);
    setCity(suggestion.city);
    setStateProvince(suggestion.stateProvince);
    setPostalCode(suggestion.postalCode);
    setCountry(suggestion.country || defaultCountry);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    setMessage("Address selected. Review the populated fields before saving.");
  }

  function handleStreetKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) {
      if (event.key === "Escape") setOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <>
      <div className="field address-autocomplete-field">
        <label htmlFor={fieldNames.streetAddress}>Street address</label>
        <div className="address-autocomplete-control">
          <input
            id={fieldNames.streetAddress}
            name={fieldNames.streetAddress}
            autoComplete="address-line1"
            required={required}
            value={streetAddress}
            onChange={(event) => {
              const value = event.target.value;
              setStreetAddress(value);
              setMessage("");
              if (value.trim().length < 3) {
                setSuggestions([]);
                setOpen(false);
                setLoading(false);
              }
            }}
            onFocus={() => setOpen(suggestions.length > 0)}
            onBlur={() => setOpen(false)}
            onKeyDown={handleStreetKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
            aria-describedby={helpId}
          />
          {loading ? <span className="address-loading" aria-live="polite">Searching…</span> : null}
          {open ? (
            <div className="address-suggestions" id={listboxId} role="listbox" aria-label="Address suggestions">
              {suggestions.map((suggestion, index) => (
                <button
                  id={`${listboxId}-${index}`}
                  key={suggestion.id}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  className={activeIndex === index ? "active" : undefined}
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectSuggestion(suggestion)}
                >
                  {suggestion.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <span className="help" id={helpId} aria-live="polite">
          {availability === "disabled"
            ? "Address suggestions are not configured. Enter the address manually."
            : message || "Start typing to search, or enter the address manually."}
        </span>
        {providerEnabled ? <a className="address-attribution" href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a> : null}
      </div>

      {fieldNames.addressLine2 ? (
        <div className="field">
          <label htmlFor={fieldNames.addressLine2}>Address line 2</label>
          <input id={fieldNames.addressLine2} name={fieldNames.addressLine2} autoComplete="address-line2" />
          <span className="help">Apartment, suite, unit, or building (optional).</span>
        </div>
      ) : null}

      <div className="two-col">
        <div className="field">
          <label htmlFor={fieldNames.city}>City</label>
          <input id={fieldNames.city} name={fieldNames.city} autoComplete="address-level2" required={required} value={city} onChange={(event) => setCity(event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor={fieldNames.stateProvince}>State / province</label>
          <input id={fieldNames.stateProvince} name={fieldNames.stateProvince} autoComplete="address-level1" required={required} value={stateProvince} onChange={(event) => setStateProvince(event.target.value)} />
        </div>
      </div>

      <div className={fieldNames.country ? "two-col" : undefined}>
        <div className="field">
          <label htmlFor={fieldNames.postalCode}>Postal code</label>
          <input id={fieldNames.postalCode} name={fieldNames.postalCode} autoComplete="postal-code" required={required} value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
        </div>
        {fieldNames.country ? (
          <div className="field">
            <label htmlFor={fieldNames.country}>Country</label>
            <input id={fieldNames.country} name={fieldNames.country} autoComplete="country-name" required={required} value={country} onChange={(event) => setCountry(event.target.value)} />
          </div>
        ) : null}
      </div>
    </>
  );
}
