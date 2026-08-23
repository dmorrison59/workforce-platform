"use client";

import { useMemo, useRef, useState } from "react";
import { DatePickerField } from "@/components/date-picker-field";
import { FormField, SelectField } from "@/components/form-field";
import { StructuredAddressFields } from "@/components/structured-address-fields";
import { addDays } from "@/modules/scheduling/lib/dates";
import type { Crew, Department, Location, Role } from "@/types/database";

type StepId = "details" | "address" | "work" | "access" | "crew" | "schedule" | "review";

const STEP_LABELS: Record<StepId, string> = {
  details: "Employee details",
  address: "Address",
  work: "Work setup",
  access: "App access",
  crew: "Crew assignment",
  schedule: "First schedule",
  review: "Review & finish",
};

interface ReviewSnapshot {
  name: string;
  email: string;
  employmentStatus: string;
  hireDate: string;
  crewName: string | null;
  scheduleSummary: string | null;
}

export function OnboardingWizard({
  action,
  organizationTimezone,
  defaultWeekStart,
  defaultToday,
  locations,
  departments,
  roles,
  crews,
}: {
  action: (formData: FormData) => void;
  organizationTimezone: string;
  defaultWeekStart: string;
  defaultToday: string;
  locations: Location[];
  departments: Department[];
  roles: Role[];
  crews: Crew[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [includeCrew, setIncludeCrew] = useState(crews.length > 0);
  const [includeSchedule, setIncludeSchedule] = useState(locations.length > 0);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? "");
  const [weekStart, setWeekStart] = useState(defaultWeekStart);
  const [reviewSnapshot, setReviewSnapshot] = useState<ReviewSnapshot | null>(null);
  const [stepError, setStepError] = useState("");

  const steps = useMemo<StepId[]>(() => {
    const list: StepId[] = ["details", "address", "work", "access"];
    if (crews.length > 0) list.push("crew");
    if (locations.length > 0) list.push("schedule");
    list.push("review");
    return list;
  }, [crews.length, locations.length]);

  const step = steps[stepIndex];
  const availableDepartments = departments.filter(
    (department) => !department.location_id || department.location_id === locationId,
  );

  function fieldValue(name: string) {
    if (!formRef.current) return "";
    return String(new FormData(formRef.current).get(name) ?? "").trim();
  }

  function validateStep(id: StepId): string {
    if (id === "details") {
      if (!fieldValue("firstName")) return "First name is required.";
      if (!fieldValue("lastName")) return "Last name is required.";
      if (!/\S+@\S+\.\S+/.test(fieldValue("email"))) return "Enter a valid email address.";
    }
    if (id === "crew" && includeCrew) {
      if (!fieldValue("crewId")) return "Select a crew, or turn off crew assignment for now.";
      if (!fieldValue("effectiveFrom")) return "Set when the crew membership starts.";
    }
    if (id === "schedule" && includeSchedule) {
      if (!fieldValue("locationId")) return "Select a location.";
      if (!fieldValue("departmentId")) return "Select a department.";
      if (!fieldValue("startLocal") || !fieldValue("endLocal")) return "Set the shift's start and end time.";
    }
    return "";
  }

  function buildReviewSnapshot(): ReviewSnapshot {
    const crewId = fieldValue("crewId");
    const crewName = includeCrew ? crews.find((crew) => crew.id === crewId)?.name ?? null : null;
    const departmentId = fieldValue("departmentId");
    const departmentName = availableDepartments.find((department) => department.id === departmentId)?.name;
    const locationName = locations.find((location) => location.id === fieldValue("locationId"))?.name;
    const scheduleSummary = includeSchedule && departmentName && locationName
      ? `${departmentName} at ${locationName}, week of ${weekStart}`
      : null;
    return {
      name: `${fieldValue("firstName")} ${fieldValue("lastName")}`.trim(),
      email: fieldValue("email"),
      employmentStatus: fieldValue("employmentStatus") || "active",
      hireDate: fieldValue("hireDate") || "Not set",
      crewName,
      scheduleSummary,
    };
  }

  function goNext() {
    const error = validateStep(step);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError("");
    const nextIndex = Math.min(stepIndex + 1, steps.length - 1);
    if (steps[nextIndex] === "review") setReviewSnapshot(buildReviewSnapshot());
    setStepIndex(nextIndex);
  }

  function goBack() {
    setStepError("");
    setStepIndex((index) => Math.max(index - 1, 0));
  }

  return (
    <section className="panel form-panel employee-form-panel">
      <ol className="wizard-steps" aria-label="Onboarding steps">
        {steps.map((id, index) => (
          <li key={id} aria-current={index === stepIndex ? "step" : undefined} className={index < stepIndex ? "done" : undefined}>
            {STEP_LABELS[id]}
          </li>
        ))}
      </ol>

      <form action={action} ref={formRef} className="form-grid employee-form">
        <fieldset className="employee-form-section" hidden={step !== "details"}>
          <legend>Employee details</legend>
          <p>Contact details for the employee directory.</p>
          <div className="two-col">
            <FormField label="First name" name="firstName" autoComplete="given-name" required />
            <FormField label="Last name" name="lastName" autoComplete="family-name" required />
          </div>
          <div className="two-col">
            <FormField label="Email" name="email" type="email" autoComplete="email" required />
            <FormField label="Phone" name="phone" type="tel" autoComplete="tel" />
          </div>
        </fieldset>

        <fieldset className="employee-form-section" hidden={step !== "address"}>
          <legend>Address</legend>
          <p>Optional structured address details. Search for an address or enter it manually.</p>
          <StructuredAddressFields
            scope="employee"
            fieldNames={{
              streetAddress: "streetAddress",
              addressLine2: "addressLine2",
              city: "city",
              stateProvince: "stateProvince",
              postalCode: "postalCode",
              country: "country",
            }}
            defaultCountry="United States"
          />
        </fieldset>

        <fieldset className="employee-form-section" hidden={step !== "work"}>
          <legend>Work setup</legend>
          <p>Workforce status, start date, and wage details.</p>
          <div className="two-col">
            <FormField label="Employee number" name="employeeNumber" />
            <SelectField label="Employment status" name="employmentStatus" defaultValue="active">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </SelectField>
          </div>
          <div className="two-col">
            <DatePickerField
              label="Hire date"
              name="hireDate"
              defaultValue={defaultToday}
              hint="Select a calendar date; it is saved exactly as shown."
            />
            <FormField
              label="Hourly rate"
              name="hourlyRate"
              type="number"
              min="0"
              step="0.01"
              hint="Stored separately under wage-specific RLS."
            />
          </div>
        </fieldset>

        <fieldset className="employee-form-section" hidden={step !== "access"}>
          <legend>App access</legend>
          <p className="help">
            This employee record does not include a login. Invite-based app access is not available yet — a
            manager can link this employee to a login later once that capability ships. Nothing here creates a
            password or grants sign-in access on this employee&apos;s behalf.
          </p>
        </fieldset>

        <fieldset className="employee-form-section" hidden={step !== "crew"}>
          <legend>Crew assignment</legend>
          <label className="check-field">
            <input
              type="checkbox"
              name="includeCrew"
              checked={includeCrew}
              onChange={(event) => setIncludeCrew(event.target.checked)}
            />
            Add this employee to a crew now
          </label>
          {includeCrew ? (
            <div className="two-col">
              <SelectField label="Crew" name="crewId" required defaultValue={crews[0]?.id ?? ""}>
                <option value="" disabled>Select crew</option>
                {crews.map((crew) => <option value={crew.id} key={crew.id}>{crew.name}</option>)}
              </SelectField>
              <FormField label="Membership starts" name="effectiveFrom" type="date" defaultValue={defaultToday} required />
            </div>
          ) : (
            <p className="help">You can assign a crew any time from the Crews page.</p>
          )}
        </fieldset>

        <fieldset className="employee-form-section" hidden={step !== "schedule"}>
          <legend>First schedule</legend>
          <label className="check-field">
            <input
              type="checkbox"
              name="includeSchedule"
              checked={includeSchedule}
              onChange={(event) => setIncludeSchedule(event.target.checked)}
            />
            Put this employee on a shift now
          </label>
          {includeSchedule ? (
            <>
              <input type="hidden" name="weekStart" value={weekStart} />
              <div className="two-col">
                <SelectField
                  label="Location"
                  name="locationId"
                  required
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                >
                  {locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}
                </SelectField>
                <SelectField label="Department" name="departmentId" required defaultValue="">
                  <option value="" disabled>Select department</option>
                  {availableDepartments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}
                </SelectField>
              </div>
              <div className="two-col">
                <SelectField label="Role" name="roleId" defaultValue="">
                  <option value="">No role</option>
                  {roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}
                </SelectField>
                <FormField label="Break minutes" name="breakMinutes" type="number" min="0" step="1" defaultValue={0} />
              </div>
              <div className="button-row">
                <button type="button" className="button ghost" onClick={() => setWeekStart((current) => addDays(current, -7))}>
                  ◀ Previous week
                </button>
                <span className="help">Week of {weekStart}</span>
                <button type="button" className="button ghost" onClick={() => setWeekStart((current) => addDays(current, 7))}>
                  Next week ▶
                </button>
              </div>
              <div className="two-col">
                <FormField label="Start time" name="startLocal" type="datetime-local" required />
                <FormField label="End time" name="endLocal" type="datetime-local" required />
              </div>
              <div className="field">
                <label htmlFor="notes">Notes</label>
                <textarea id="notes" name="notes" rows={3} maxLength={2000} />
              </div>
              <p className="help">Uses the same scheduling checks as the regular schedule builder, including availability and time-off warnings.</p>
            </>
          ) : (
            <p className="help">You can build this employee&apos;s first shift any time from the Schedule page.</p>
          )}
        </fieldset>

        <fieldset className="employee-form-section" hidden={step !== "review"}>
          <legend>Review &amp; finish</legend>
          {reviewSnapshot ? (
            <ul className="list">
              <li><strong>{reviewSnapshot.name || "Unnamed employee"}</strong><br /><span className="muted">{reviewSnapshot.email}</span></li>
              <li>Status: {reviewSnapshot.employmentStatus} · Hire date: {reviewSnapshot.hireDate}</li>
              <li>Address: entered on the Address step (not shown here — go back to edit it)</li>
              <li>Crew: {reviewSnapshot.crewName ?? "Not assigned yet"}</li>
              <li>First shift: {reviewSnapshot.scheduleSummary ?? "Not scheduled yet"}</li>
            </ul>
          ) : null}
          <p className="help">
            Timezone for schedule times: {organizationTimezone}. Selecting Finish creates the employee record and,
            for any optional step you filled in, the crew membership and first shift.
          </p>
        </fieldset>

        {stepError ? <div className="banner error" role="alert">{stepError}</div> : null}

        <div className="button-row">
          {stepIndex > 0 ? <button type="button" className="button ghost" onClick={goBack}>Back</button> : null}
          {step === "review"
            ? <button type="submit" className="button">Finish</button>
            : <button type="button" className="button" onClick={goNext}>Next</button>}
        </div>
      </form>
    </section>
  );
}
