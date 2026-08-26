import type { AppAccessChoice } from "@/modules/onboarding/types";

export const onboardingSteps = [
  { id: "details", label: "Employee details", optional: false },
  { id: "address", label: "Address", optional: false },
  { id: "work", label: "Work setup", optional: false },
  { id: "access", label: "App access", optional: false },
  { id: "crew", label: "Crew assignment", optional: true },
  { id: "schedule", label: "First schedule", optional: true },
  { id: "review", label: "Review & finish", optional: false },
] as const;

export type OnboardingStepId = (typeof onboardingSteps)[number]["id"];
export type WizardValues = Record<string, string>;

export function mergeWizardValues(current: WizardValues, updates: WizardValues) {
  return { ...current, ...updates };
}

export function formDataValues(formData: FormData): WizardValues {
  const values: WizardValues = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") values[key] = value;
  });
  return values;
}

export function addressValidationMessage(values: WizardValues) {
  const hasAddress = Boolean(
    values.streetAddress?.trim()
      || values.addressLine2?.trim()
      || values.city?.trim()
      || values.stateProvince?.trim()
      || values.postalCode?.trim(),
  );
  if (!hasAddress) return null;
  if (!values.streetAddress?.trim()) return "Street address is required when adding an address.";
  if (!values.city?.trim()) return "City is required when adding an address.";
  if (!values.stateProvince?.trim()) return "State / province is required when adding an address.";
  if (!values.postalCode?.trim()) return "Postal code is required when adding an address.";
  if (!values.country?.trim()) return "Country is required when adding an address.";
  return null;
}

export function appAccessSummary(choice: string) {
  const summaries: Record<AppAccessChoice, string> = {
    "give-now": "App access pending — a secure manager-driven invitation flow is not available yet.",
    later: "App access deferred for later setup.",
    none: "No app access requested.",
  };
  return summaries[choice as AppAccessChoice] ?? "Choose an app-access option.";
}

export function skippedStepValues(step: "crew" | "schedule"): WizardValues {
  return step === "crew"
    ? { crewId: "", crewEffectiveFrom: "" }
    : { createFirstShift: "", shiftLocationId: "", shiftDepartmentId: "", shiftRoleId: "" };
}

export function reviewSummary(values: WizardValues, canViewWage: boolean) {
  const address = [
    values.streetAddress,
    values.addressLine2,
    [values.city, [values.stateProvince, values.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    values.country,
  ].filter(Boolean);
  return {
    name: [values.firstName, values.lastName].filter(Boolean).join(" "),
    contact: [values.email, values.phone].filter(Boolean).join(" · "),
    address: address.length ? address.join(" · ") : "Not provided",
    employment: [values.employmentStatus || "active", values.hireDate ? `Hired ${values.hireDate}` : "No hire date"].join(" · "),
    hourlyRate: canViewWage && values.hourlyRate ? `$${Number(values.hourlyRate).toFixed(2)}/hour` : null,
    appAccess: appAccessSummary(values.appAccess),
  };
}
