"use client";

import { useState } from "react";

export function HelpTabs() {
  const [tab, setTab] = useState<"owner" | "employee">("owner");

  return (
    <div className="help-tabs">
      <div className="button-row" style={{ marginBottom: "1.5rem" }}>
        <button
          className={`button ${tab === "owner" ? "" : "secondary"}`}
          onClick={() => setTab("owner")}
          type="button"
        >
          For the Owner / Manager
        </button>
        <button
          className={`button ${tab === "employee" ? "" : "secondary"}`}
          onClick={() => setTab("employee")}
          type="button"
        >
          For the Crew Member
        </button>
      </div>

      {tab === "owner" && <OwnerGuide />}
      {tab === "employee" && <EmployeeGuide />}
    </div>
  );
}

function OwnerGuide() {
  return (
    <div className="help-content">
      <section className="panel">
        <h2>1. Quick Start: Signup to your first published week (about 30 min)</h2>
        <ol>
          <li><strong>Create your account:</strong> Sign up, confirm your email, and log in.</li>
          <li><strong>Name your company:</strong> The setup wizard creates your private workspace.</li>
          <li><strong>Add your crew:</strong> Go to <strong>Employees</strong>. Choose <em>Give app access now</em> to send them an invite, or <em>Record only</em> if they just need to be on the schedule.</li>
          <li><strong>Add locations and departments:</strong> Add your yard, job sites, and how you split work (Mowing, Planting, etc.).</li>
          <li><strong>Build the week:</strong> Go to <strong>Schedule</strong>, pick a week, and add shifts.</li>
          <li><strong>Publish:</strong> Hit <strong>Publish schedule</strong>. Until you hit this, the crew cannot see the week on their phones.</li>
          <li><strong>Watch the pills:</strong> Employees show <em>Invited</em> until they accept, then flip to <em>Active</em>.</li>
          <li><strong>End of week:</strong> Open <strong>Timesheets</strong>, approve entries, and export the CSV for payroll.</li>
        </ol>
      </section>

      <section className="panel">
        <h2>2. Field Clock: Turn on GPS tracking (10 min)</h2>
        <ol>
          <li>Go to <strong>Field Clock</strong> settings. Turn it on and set the allowed distance (start at 500 meters).</li>
          <li>Turn <strong>manager override</strong> ON. GPS is not perfect; you want the final say if it glitches.</li>
          <li>Pin your job sites with coordinates. That is the target the phone checks against.</li>
          <li>Assign crew to jobs so they have the right options when clocking in.</li>
          <li>Test it: Have someone clock in at the yard (should pass), then from their couch (should flag).</li>
        </ol>
      </section>
    </div>
  );
}

function EmployeeGuide() {
  return (
    <div className="help-content">
      <section className="panel">
        <h2>Your schedule and clock-in, on your phone</h2>
        <ol>
          <li><strong>Accept your invite:</strong> Tap the link in the email from your boss. Set a password. Bookmark the site on your phone.</li>
          <li><strong>See your week:</strong> Tap <strong>My Schedule</strong>. If it is empty, your boss has not published it yet.</li>
          <li><strong>Clock in:</strong> Tap <strong>Time Clock</strong> then <strong>Clock In</strong>. Take breaks and clock out from the same screen.</li>
          <li><strong>Field clock (GPS):</strong> If your boss uses it, tap <em>Verify location and clock in</em>. Your phone asks for location <strong>one time, only when you press the button</strong>. It does not track you all day.</li>
          <li><strong>GPS acting up?</strong> If it says you are too far away but you are on site, just message your boss. They can override it.</li>
          <li><strong>Life happens:</strong>
            <ul>
              <li>Cannot make a day? Use <strong>Time Off</strong>.</li>
              <li>Want more hours? Check <strong>Open Shifts</strong>.</li>
              <li>Need to change your hours? Update <strong>My Availability</strong>.</li>
            </ul>
          </li>
        </ol>
      </section>
    </div>
  );
}