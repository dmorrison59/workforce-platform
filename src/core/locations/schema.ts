import { z } from "zod";

export const locationSchema = z.object({
  name: z.string().trim().min(1, "Location name is required.").max(120),
  address: z.string().trim().min(1, "Street address is required.").max(200),
  city: z.string().trim().min(1, "City is required.").max(100),
  state: z.string().trim().min(1, "State is required.").max(80),
  postalCode: z.string().trim().min(1, "Postal code is required.").max(20),
});
