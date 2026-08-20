import { z } from "zod";

const optionalDate = z.string().trim().transform((value) => value || null).refine(
  (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
  "Use a valid hire date.",
);

export const employeeSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required.").max(80),
  lastName: z.string().trim().min(1, "Last name is required.").max(80),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().max(40).transform((value) => value || null),
  employeeNumber: z.string().trim().max(40).transform((value) => value || null),
  employmentStatus: z.enum(["active", "inactive", "terminated"]),
  hireDate: optionalDate,
  hourlyRate: z.string().trim().transform((value) => value === "" ? null : Number(value)).refine(
    (value) => value === null || (Number.isFinite(value) && value >= 0 && value <= 1_000_000),
    "Hourly rate must be a positive number.",
  ),
});
