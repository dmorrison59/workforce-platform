"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";
import { DatePickerField } from "@/components/date-picker-field";
import { FormField, SelectField } from "@/components/form-field";
import { StructuredAddressFields } from "@/components/structured-address-fields";
import { onboardEmployee } from "@/modules/onboarding/actions/actions";
import {
  addressValidationMessage,
  formDataValues,
  onboardingSteps,
  reviewSummary,
  skippedStepValues,
  type WizardValues,
} from "@/modules/onboarding/lib/wizard";
import type { OnboardingActionState, OnboardingWizardProps } from "@/modules/onboarding/types";

const initialActionState: OnboardingActionState = { outcome: "idle", message: "" };

function statusClass(state: string) {
  if (state === "success") return "status";
  if (state === "failed") return "status warning-status";
  return "status off";
}

function Completion({ result }: { result: OnboardingActionState }) {
  const items = [
    ["Location / department", result.workSetup],
    ["App access", result.appAccess],
    ["Crew assignment", result.crew],
    ["First shift", result.shift],
  ] as const;
  return (
    <section className="panel onboarding-completion" aria-labelledby="onboarding-complete-title">
      <span className="completion-mark" aria-hidden="true">✓</span>
      <div>
        <span className="eyebrow">Onboarding complete</span>
        <h2 id="onboarding-complete-title">{result.employeeName} was created</h2>
        <p>{result.message}</p>
      </div>
      <div className="completion-status-grid">
        {items.map(([label, item]) => item ? (
          <article className="completion-status" key={label}>
            <div><h3>{label}</h3><span className={statusClass(item.state)}>{item.state}</span></div>
            <p>{item.message}</p>
          </article>
        ) : null)}
      </div>
      <div className="button-row completion-actions">
        <Link className="button" href="/employees">View Employees</Link>
        {result.schedulePath ? <Link className="button secondary" href={result.schedulePath}>View Schedule</Link> : null}
        {result.crew?.state === "failed" ? <Link className="button secondary" href="/crews">Retry in Crews</Link> : null}
        {result.shift?.state === "failed" ? <Link className="button secondary" href="/schedule">Retry in Schedule</Link> : null}
        <a className="button ghost" href="/employees/onboard">Add another employee</a>
      </div>
      <p className="help">Employee editing remains a future improvement because the application does not currently have an employee detail route.</p>
    </section>
  );
}

export function OnboardingWizard(props: OnboardingWizardProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [result, formAction, pending] = useActionState(onboardEmployee, initialActionState);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState("");
  const [reviewValues, setReviewValues] = useState<WizardValues>({});
  const [workLocationId, setWorkLocationId] = useState(props.locations[0]?.id ?? "");
  const firstWorkDepartment = props.departments.find((department) => (
    department.locationId === null || department.locationId === props.locations[0]?.id
  ));
  const [workDepartmentId, setWorkDepartmentId] = useState(firstWorkDepartment?.id ?? "");
  const [appAccess, setAppAccess] = useState("");
  const [crewId, setCrewId] = useState("");
  const [crewEffectiveFrom, setCrewEffectiveFrom] = useState(props.today);
  const [createFirstShift, setCreateFirstShift] = useState(false);
  const [shiftLocationId, setShiftLocationId] = useState(props.locations[0]?.id ?? "");
  const [shiftDepartmentId, setShiftDepartmentId] = useState(firstWorkDepartment?.id ?? "");
  const currentStep = onboardingSteps[stepIndex];
  const workDepartments = useMemo(
    () => props.departments.filter((department) => !department.locationId || department.locationId === workLocationId),
    [props.departments, workLocationId],
  );
  const shiftDepartments = useMemo(
    () => props.departments.filter((department) => !department.locationId || department.locationId === shiftLocationId),
    [props.departments, shiftLocationId],
  );
  const summary = reviewSummary(reviewValues, props.canManageWage);
  const selectedWorkLocation = props.locations.find((location) => location.id === reviewValues.workLocationId)?.name;
  const selectedWorkDepartment = props.departments.find((department) => department.id === reviewValues.workDepartmentId)?.name;
  const selectedCrew = props.crews.find((crew) => crew.id === reviewValues.crewId)?.name;
  const selectedShiftLocation = props.locations.find((location) => location.id === reviewValues.shiftLocationId)?.name;
  const selectedShiftDepartment = props.departments.find((department) => department.id === reviewValues.shiftDepartmentId)?.name;
  const selectedShiftRole = props.roles.find((role) => role.id === reviewValues.shiftRoleId)?.name;

  if (result.outcome === "complete") return <Completion result={result} />;

  function currentValues() {
    return formDataValues(new FormData(formRef.current!));
  }

  function validateCurrentStep() {
    const fieldset = formRef.current?.querySelector<HTMLElement>(`[data-step="${currentStep.id}"]`);
    const controls = Array.from(fieldset?.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      "input, select, textarea",
    ) ?? []);
    const invalid = controls.find((control) => !control.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    const values = currentValues();
    if (currentStep.id === "address") {
      const message = addressValidationMessage(values);
      if (message) {
        setStepError(message);
        return false;
      }
    }
    if (currentStep.id === "work" && props.locations.length && workDepartments.length
      && (!workLocationId || !workDepartmentId)) {
      setStepError("Choose both a location and department, or create the missing workplace records first.");
      return false;
    }
    if (currentStep.id === "access" && !appAccess) {
      setStepError("Choose an app-access option.");
      return false;
    }
    if (currentStep.id === "schedule" && createFirstShift) {
      const start = values.shiftStartTime;
      const end = values.shiftEndTime;
      if (start && end && end <= start) {
        setStepError("Shift end time must be after start time.");
        return false;
      }
    }
    setStepError("");
    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    if (currentStep.id === "work") {
      if (!workDepartments.length) {
        setWorkLocationId("");
        setWorkDepartmentId("");
        setShiftLocationId("");
        setShiftDepartmentId("");
      } else {
        setShiftLocationId(workLocationId);
        setShiftDepartmentId(workDepartmentId);
      }
    }
    const next = Math.min(stepIndex + 1, onboardingSteps.length - 1);
    if (onboardingSteps[next].id === "review") setReviewValues(currentValues());
    setStepIndex(next);
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function previousStep() {
    setStepError("");
    setStepIndex((current) => Math.max(0, current - 1));
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  function skipOptionalStep() {
    const skipped = skippedStepValues(currentStep.id as "crew" | "schedule");
    if (currentStep.id === "crew") {
      setCrewId(skipped.crewId ?? "");
      setCrewEffectiveFrom(skipped.crewEffectiveFrom ?? props.today);
    } else {
      setCreateFirstShift(false);
      setShiftLocationId(skipped.shiftLocationId ?? "");
      setShiftDepartmentId(skipped.shiftDepartmentId ?? "");
      setReviewValues({ ...currentValues(), ...skipped });
    }
    setStepError("");
    setStepIndex((current) => Math.min(current + 1, onboardingSteps.length - 1));
  }

  function changeWorkLocation(locationId: string) {
    const department = props.departments.find((item) => !item.locationId || item.locationId === locationId);
    setWorkLocationId(locationId);
    setWorkDepartmentId(department?.id ?? "");
  }

  function changeShiftLocation(locationId: string) {
    const department = props.departments.find((item) => !item.locationId || item.locationId === locationId);
    setShiftLocationId(locationId);
    setShiftDepartmentId(department?.id ?? "");
  }

  return (
    <div className="onboarding-shell">
      <nav className="panel onboarding-stepper" aria-label="Employee onboarding progress">
        <ol>
          {onboardingSteps.map((step, index) => (
            <li className={index < stepIndex ? "complete" : index === stepIndex ? "current" : "remaining"} key={step.id} aria-current={index === stepIndex ? "step" : undefined}>
              <span aria-hidden="true">{index < stepIndex ? "✓" : index + 1}</span>
              <div><strong>{step.label}</strong>{step.optional ? <small>Optional</small> : null}</div>
            </li>
          ))}
        </ol>
      </nav>

      <form ref={formRef} action={formAction} className="panel onboarding-form">
        <div className="wizard-heading">
          <span className="eyebrow">Step {stepIndex + 1} of {onboardingSteps.length}</span>
          <h2>{currentStep.label}</h2>
          <p>{currentStep.optional ? "This step is optional and can be skipped." : "Complete this step to continue."}</p>
        </div>
        {stepError || result.outcome === "error" ? (
          <p className="banner error" role="alert">{stepError || result.message}</p>
        ) : null}

        <fieldset className="wizard-step" data-step="details" hidden={currentStep.id !== "details"}>
          <legend>Employee details</legend>
          <p>Core contact and employment information. The employee record remains separate from login access.</p>
          <div className="two-col">
            <FormField label="First name" name="firstName" autoComplete="given-name" required />
            <FormField label="Last name" name="lastName" autoComplete="family-name" required />
          </div>
          <div className="two-col">
            <FormField label="Email" name="email" type="email" autoComplete="email" required />
            <FormField label="Phone" name="phone" type="tel" autoComplete="tel" />
          </div>
          <div className="two-col">
            <FormField label="Employee number" name="employeeNumber" />
            <SelectField label="Employment status" name="employmentStatus" defaultValue="active">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="terminated">Terminated</option>
            </SelectField>
          </div>
          <div className="two-col">
            <DatePickerField label="Hire date" name="hireDate" hint="Saved exactly as the selected calendar date." />
            {props.canManageWage ? (
              <FormField label="Hourly rate" name="hourlyRate" type="number" min="0" step="0.01" hint="Protected by wage-specific permissions." />
            ) : <p className="wizard-permission-note">Hourly rate is hidden because you do not have wage-management permission.</p>}
          </div>
        </fieldset>

        <fieldset className="wizard-step" data-step="address" hidden={currentStep.id !== "address"}>
          <legend>Structured address</legend>
          <p>Search with the shared Geoapify integration or enter the address manually. Address details are optional.</p>
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

        <fieldset className="wizard-step" data-step="work" hidden={currentStep.id !== "work"}>
          <legend>Work setup</legend>
          <p>Choose workplace defaults for this onboarding flow. The current employee schema does not store a primary location or department.</p>
          {props.locations.length ? (
            <div className="two-col">
              <SelectField label="Starting location" name="workLocationId" value={workLocationId} onChange={(event) => changeWorkLocation(event.target.value)} required={workDepartments.length > 0}>
                <option value="">Choose location</option>
                {props.locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}
              </SelectField>
              <SelectField label="Starting department" name="workDepartmentId" value={workDepartmentId} onChange={(event) => setWorkDepartmentId(event.target.value)} required={workDepartments.length > 0}>
                <option value="">{workDepartments.length ? "Choose department" : "No department available"}</option>
                {workDepartments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}
              </SelectField>
            </div>
          ) : <p className="banner warning">No active locations exist. You can finish onboarding and add workplace setup later.</p>}
          {props.locations.length && !workDepartments.length ? <p className="banner warning">No active department is available for this location. You can continue and add one later.</p> : null}
          <p className="help">Role and access level are not assigned here because employee records, shift roles, and login memberships are separate concepts.</p>
        </fieldset>

        <fieldset className="wizard-step" data-step="access" hidden={currentStep.id !== "access"}>
          <legend>App access</legend>
          <p>Choose what should happen with login access. Managers never set another user’s password.</p>
          <div className="choice-grid">
            <label className={appAccess === "give-now" ? "choice-card selected" : "choice-card"}>
              <input type="radio" name="appAccess" value="give-now" checked={appAccess === "give-now"} onChange={(event) => setAppAccess(event.target.value)} required />
              <span><strong>Give app access now</strong><small>Records a pending-access outcome until a secure invitation workflow is available.</small></span>
            </label>
            <label className={appAccess === "later" ? "choice-card selected" : "choice-card"}>
              <input type="radio" name="appAccess" value="later" checked={appAccess === "later"} onChange={(event) => setAppAccess(event.target.value)} />
              <span><strong>Set up app access later</strong><small>Finish onboarding without creating an authentication account.</small></span>
            </label>
            <label className={appAccess === "none" ? "choice-card selected" : "choice-card"}>
              <input type="radio" name="appAccess" value="none" checked={appAccess === "none"} onChange={(event) => setAppAccess(event.target.value)} />
              <span><strong>Employee does not need app access</strong><small>Keeps the workforce record independent of authentication.</small></span>
            </label>
          </div>
        </fieldset>

        <fieldset className="wizard-step" data-step="crew" hidden={currentStep.id !== "crew"}>
          <legend>Crew assignment</legend>
          {props.canManageCrew && props.crewsEnabled && props.crews.length ? (
            <div className="two-col">
              <SelectField label="Crew" name="crewId" value={crewId} onChange={(event) => setCrewId(event.target.value)}>
                <option value="">Skip crew assignment</option>
                {props.crews.map((crew) => <option value={crew.id} key={crew.id}>{crew.name}</option>)}
              </SelectField>
              <DatePickerField
                label="Effective from"
                name="crewEffectiveFrom"
                value={crewEffectiveFrom}
                onChange={(event) => setCrewEffectiveFrom(event.target.value)}
                required={Boolean(crewId)}
              />
            </div>
          ) : (
            <p className="banner warning">
              {!props.canManageCrew
                ? "You do not have crew-management permission. This step will be skipped."
                : !props.crewsEnabled
                  ? "Field Operations crews are not enabled. This step will be skipped."
                  : "No active crews exist. This step will be skipped."}
            </p>
          )}
          <p className="help">Assignments use the existing effective-dated crew-membership service.</p>
        </fieldset>

        <fieldset className="wizard-step" data-step="schedule" hidden={currentStep.id !== "schedule"}>
          <legend>First schedule</legend>
          {props.canManageSchedule && props.schedulingEnabled && props.locations.length && props.departments.length ? (
            <>
              <label className="check-field wizard-toggle">
                <input type="checkbox" name="createFirstShift" checked={createFirstShift} onChange={(event) => setCreateFirstShift(event.target.checked)} />
                Add the employee’s first shift to a draft schedule
              </label>
              <div className="wizard-conditional" hidden={!createFirstShift}>
                <div className="two-col">
                  <SelectField label="Shift location" name="shiftLocationId" value={shiftLocationId} onChange={(event) => changeShiftLocation(event.target.value)} required={createFirstShift}>
                    <option value="">Choose location</option>
                    {props.locations.map((location) => <option value={location.id} key={location.id}>{location.name}</option>)}
                  </SelectField>
                  <SelectField label="Shift department" name="shiftDepartmentId" value={shiftDepartmentId} onChange={(event) => setShiftDepartmentId(event.target.value)} required={createFirstShift}>
                    <option value="">Choose department</option>
                    {shiftDepartments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}
                  </SelectField>
                </div>
                <div className="two-col">
                  <SelectField label="Shift role" name="shiftRoleId" defaultValue="">
                    <option value="">No shift role</option>
                    {props.roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}
                  </SelectField>
                  <DatePickerField label="Shift date" name="shiftDate" defaultValue={props.today} required={createFirstShift} />
                </div>
                <div className="three-col">
                  <FormField label="Start time" name="shiftStartTime" type="time" defaultValue="09:00" required={createFirstShift} />
                  <FormField label="End time" name="shiftEndTime" type="time" defaultValue="17:00" required={createFirstShift} />
                  <FormField label="Break minutes" name="shiftBreakMinutes" type="number" min="0" step="1" defaultValue="0" required={createFirstShift} />
                </div>
                <label className="check-field">
                  <input type="checkbox" name="overrideWarnings" />
                  Save despite availability or approved time-off warnings
                </label>
                <p className="help">Overlap rules and employee availability/time-off warnings are enforced by the existing scheduling service.</p>
              </div>
            </>
          ) : (
            <p className="banner warning">
              {!props.canManageSchedule
                ? "You do not have schedule-management permission. This step will be skipped."
                : !props.schedulingEnabled
                  ? "Scheduling is not enabled. This step will be skipped."
                  : "An active location and department are required before creating a first shift."}
            </p>
          )}
        </fieldset>

        <fieldset className="wizard-step" data-step="review" hidden={currentStep.id !== "review"}>
          <legend>Review & finish</legend>
          <p>The employee will be created only after you select Finish onboarding.</p>
          <div className="review-grid">
            <article><span>Employee</span><strong>{summary.name || "Not provided"}</strong><p>{summary.contact || "No contact details"}</p></article>
            <article><span>Address</span><strong>{summary.address}</strong></article>
            <article><span>Employment</span><strong>{summary.employment}</strong>{summary.hourlyRate ? <p>{summary.hourlyRate}</p> : null}</article>
            <article><span>Work setup</span><strong>{selectedWorkLocation && selectedWorkDepartment ? `${selectedWorkLocation} · ${selectedWorkDepartment}` : "Not available / skipped"}</strong><p>Not stored as a primary employee relationship.</p></article>
            <article><span>App access</span><strong>{summary.appAccess}</strong></article>
            <article><span>Crew assignment</span><strong>{selectedCrew ? `${selectedCrew} from ${reviewValues.crewEffectiveFrom}` : "Skipped"}</strong></article>
            <article><span>First shift</span><strong>{reviewValues.createFirstShift ? `${reviewValues.shiftDate} · ${reviewValues.shiftStartTime}–${reviewValues.shiftEndTime}` : "Skipped"}</strong>{reviewValues.createFirstShift ? <p>{selectedShiftLocation} · {selectedShiftDepartment}{selectedShiftRole ? ` · ${selectedShiftRole}` : ""} · {reviewValues.shiftBreakMinutes || 0} min break</p> : null}</article>
          </div>
          <p className="banner warning">A created first shift remains in a draft schedule until a manager intentionally publishes it.</p>
        </fieldset>

        <div className="wizard-actions">
          <div className="button-row">
            {stepIndex > 0 ? <button className="button ghost" type="button" onClick={previousStep} disabled={pending}>Back</button> : <Link className="button ghost" href="/employees">Cancel</Link>}
            {currentStep.optional ? <button className="button ghost" type="button" onClick={skipOptionalStep} disabled={pending}>Skip this step</button> : null}
          </div>
          {currentStep.id === "review" ? (
            <button className="button" type="submit" disabled={pending}>{pending ? "Finishing…" : "Finish onboarding"}</button>
          ) : (
            <button className="button" type="button" onClick={(event) => { event.preventDefault(); nextStep(); }}>Continue</button>
          )}
        </div>
      </form>
    </div>
  );
}
