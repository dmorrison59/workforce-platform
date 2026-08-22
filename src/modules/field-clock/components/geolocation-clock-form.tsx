"use client";

import { useState } from "react";
import { fieldClockInAction } from "@/modules/field-clock/actions/actions";

interface Option { id: string; label: string }

export function GeolocationClockForm({
  jobs,
  locations,
  shifts,
}: {
  jobs: Option[];
  locations: Option[];
  shifts: Option[];
}) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  function locateAndSubmit(event: React.MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.form;
    if (!form?.reportValidity()) return;
    if (!navigator.geolocation) {
      setError("This browser does not support location access.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition((position) => {
      const values: Record<string, string> = {
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
        accuracyM: String(position.coords.accuracy),
      };
      for (const [name, value] of Object.entries(values)) {
        const input = form.elements.namedItem(name) as HTMLInputElement | null;
        if (input) input.value = value;
      }
      form.requestSubmit();
    }, (locationError) => {
      setLocating(false);
      setError(locationError.code === locationError.PERMISSION_DENIED
        ? "Location permission is required for this field clock-in. No location was collected."
        : "Your location could not be obtained. Check device location services and try again.");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 });
  }

  return <form action={fieldClockInAction} className="form-grid clock-in-form">
    <div className="field">
      <label htmlFor="fieldJobId">Assigned field job</label>
      <select id="fieldJobId" name="jobId" required defaultValue="">
        <option value="">Choose an assigned job</option>
        {jobs.map((job) => <option key={job.id} value={job.id}>{job.label}</option>)}
      </select>
    </div>
    <div className="field">
      <label htmlFor="fieldLocationId">Time-entry location</label>
      <select id="fieldLocationId" name="locationId" required defaultValue={locations[0]?.id ?? ""}>
        {locations.map((location) => <option key={location.id} value={location.id}>{location.label}</option>)}
      </select>
    </div>
    <div className="field">
      <label htmlFor="fieldShiftId">Assigned shift (optional)</label>
      <select id="fieldShiftId" name="shiftId" defaultValue="">
        <option value="">No scheduled shift</option>
        {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.label}</option>)}
      </select>
    </div>
    <input name="latitude" type="hidden" />
    <input name="longitude" type="hidden" />
    <input name="accuracyM" type="hidden" />
    <p className="help">Your browser will request one location reading only when you press the button. The app does not track you continuously or in the background.</p>
    {error ? <p className="geo-error" role="alert">{error}</p> : null}
    <button className="button clock-primary" type="button" disabled={locating || !jobs.length || !locations.length} onClick={locateAndSubmit}>
      {locating ? "Verifying location…" : "Verify location and clock in"}
    </button>
  </form>;
}
