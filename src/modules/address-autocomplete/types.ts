export interface AddressSuggestion {
  id: string;
  label: string;
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
}

export interface AddressAutocompleteResponse {
  enabled: boolean;
  suggestions: AddressSuggestion[];
}
