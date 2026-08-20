import { describe, expect, it } from "vitest";
import { departmentSchema } from "@/core/departments/schema";
import { employeeSchema } from "@/core/employees/schema";
import { locationSchema } from "@/core/locations/schema";
import { organizationSchema } from "@/core/organizations/schema";
import { capabilities } from "@/core/permissions/capabilities";

describe("Gate 0 input validation", () => {
  it("accepts a valid organization and rejects unsafe slugs", () => {
    expect(organizationSchema.safeParse({ name: "Company A", slug: "company-a", timezone: "America/New_York" }).success).toBe(true);
    expect(organizationSchema.safeParse({ name: "Company A", slug: "Company A!", timezone: "America/New_York" }).success).toBe(false);
  });

  it("keeps an employee account optional and validates core employee data", () => {
    const result = employeeSchema.safeParse({
      firstName: "Sam", lastName: "Example", email: "sam@example.test",
      phone: "", employeeNumber: "E-100", employmentStatus: "active",
      hireDate: "2026-08-20", hourlyRate: "22.50",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hourlyRate).toBe(22.5);
  });

  it("validates locations and optional department locations", () => {
    expect(locationSchema.safeParse({ name: "Main", address: "1 Test St", city: "Test", state: "NY", postalCode: "10001" }).success).toBe(true);
    expect(departmentSchema.safeParse({ name: "Operations", locationId: "" }).success).toBe(true);
  });
});

describe("capability registry", () => {
  it("contains every required Gate 0 capability", () => {
    expect(capabilities).toEqual(expect.arrayContaining([
      "employee.view", "employee.manage", "location.view", "location.manage",
      "department.view", "department.manage", "settings.manage",
    ]));
  });
});
