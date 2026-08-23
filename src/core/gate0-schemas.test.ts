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
      streetAddress: "145 Manual Lane", addressLine2: "Suite 200",
      city: "Sampleville", stateProvince: "NY", postalCode: "10001",
      country: "United States",
      hireDate: "2026-08-20", hourlyRate: "22.50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.hourlyRate).toBe(22.5);
      expect(result.data.streetAddress).toBe("145 Manual Lane");
      expect(result.data.hireDate).toBe("2026-08-20");
    }
  });

  it("keeps a blank address optional but rejects incomplete structured addresses", () => {
    const baseEmployee = {
      firstName: "Sam", lastName: "Example", email: "sam@example.test",
      phone: "", employeeNumber: "", employmentStatus: "active",
      hireDate: "", hourlyRate: "",
    };

    const blankAddress = employeeSchema.safeParse({ ...baseEmployee, country: "United States" });
    expect(blankAddress.success).toBe(true);
    if (blankAddress.success) expect(blankAddress.data.country).toBeNull();

    expect(employeeSchema.safeParse({
      ...baseEmployee,
      streetAddress: "145 Manual Lane",
      country: "United States",
    }).success).toBe(false);
  });

  it("rejects impossible hire dates without converting the selected value", () => {
    expect(employeeSchema.safeParse({
      firstName: "Sam", lastName: "Example", email: "sam@example.test",
      employmentStatus: "active", hireDate: "2026-02-29", hourlyRate: "",
    }).success).toBe(false);
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
