import { z } from "zod";

function isIsoCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;

  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const optionalDate = z.string().trim().transform((value) => value || null).refine(
  (value) => value === null || isIsoCalendarDate(value),
  "Use a valid hire date.",
);

const optionalText = (maximum: number) => z.string().optional().default("").transform((value) => value.trim()).pipe(
  z.string().max(maximum).transform((value) => value || null),
);

export const employeeSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z.string().trim().email("Enter a valid email address."),
  phone: optionalText(40),
  streetAddress: optionalText(200),
  addressLine2: optionalText(120),
  city: optionalText(100),
  stateProvince: optionalText(100),
  postalCode: optionalText(32),
  country: optionalText(100),
  employeeNumber: optionalText(40),
  employmentStatus: z.enum(["active", "inactive", "terminated"]),
  hireDate: optionalDate,
  hourlyRate: z.string().trim().transform((value) => value === "" ? null : Number(value)).refine(
    (value) => value === null || (Number.isFinite(value) && value >= 0 && value <= 1_000_000),
    "Hourly rate must be a positive number.",
  ),
}).superRefine((data, context) => {
  const hasAddress = Boolean(
    data.streetAddress || data.addressLine2 || data.city || data.stateProvince || data.postalCode,
  );
  if (!hasAddress) return;

  const requiredAddressFields = [
    ["streetAddress", data.streetAddress, "Street address is required when adding an address."],
    ["city", data.city, "City is required when adding an address."],
    ["stateProvince", data.stateProvince, "State / province is required when adding an address."],
    ["postalCode", data.postalCode, "Postal code is required when adding an address."],
    ["country", data.country, "Country is required when adding an address."],
  ] as const;

  requiredAddressFields.forEach(([path, value, message]) => {
    if (!value) context.addIssue({ code: "custom", path: [path], message });
  });
}).transform((data) => {
  const hasAddress = Boolean(
    data.streetAddress || data.addressLine2 || data.city || data.stateProvince || data.postalCode,
  );
  if (hasAddress) return data;

  return {
    ...data,
    streetAddress: null,
    addressLine2: null,
    city: null,
    stateProvince: null,
    postalCode: null,
    country: null,
  };
});
