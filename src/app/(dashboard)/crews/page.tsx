import { redirect } from "next/navigation";
import { MessageBanner } from "@/components/message-banner";
import { PageHeader } from "@/components/page-header";
import { requireOrganization } from "@/core/auth/context";
import { hasCapability } from "@/core/permissions/capabilities";
import {
  addCrewMemberAction,
  createCrewAction,
  endCrewMembershipAction,
  updateCrewAction,
} from "@/modules/field-operations/actions/actions";
import { getCrewManagerData } from "@/modules/field-operations/services/field-query-service";
import { isMembershipActiveOn } from "@/modules/field-operations/validation/rules";

function localDate(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function CrewsPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const context = await requireOrganization();
  if (!(await hasCapability(context.organization.id, "crew.manage"))) redirect("/dashboard");
  const data = await getCrewManagerData(context.organization.id);
  const params = await searchParams;
  const today = localDate(context.organization.timezone);
  const employeeNames = new Map(data.employees.map((employee) => [employee.id, `${employee.first_name} ${employee.last_name}`]));
  return (
    <>
      <PageHeader title="Crews" description="Manage effective-dated field teams without changing employee records." />
      <MessageBanner error={params.error} message={params.message} />
      <section className="panel field-create-panel">
        <h2>Create crew</h2>
        <form action={createCrewAction} className="form-grid field-inline-form">
          <div className="field"><label htmlFor="new-crew-name">Crew name</label><input id="new-crew-name" name="name" maxLength={120} required /></div>
          <div className="field"><label htmlFor="new-crew-leader">Crew leader (optional)</label><select id="new-crew-leader" name="crewLeaderId"><option value="">No leader</option>{data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeNames.get(employee.id)}</option>)}</select></div>
          <button className="button" type="submit">Create crew</button>
        </form>
      </section>
      <section className="field-list">
        {data.crews.length ? data.crews.map((crew) => {
          const memberships = data.memberships.filter((membership) => membership.crew_id === crew.id);
          const activeMemberships = memberships.filter((membership) => isMembershipActiveOn(membership, today));
          return <article className="panel field-card" key={crew.id}>
            <div className="request-heading"><div><span className="eyebrow">Field crew</span><h2>{crew.name}</h2><p className="muted">Leader: {employeeNames.get(crew.crew_leader_id ?? "") ?? "Not assigned"}</p></div><span className={crew.active ? "status" : "status off"}>{crew.active ? "active" : "inactive"}</span></div>
            <form action={updateCrewAction} className="form-grid field-inline-form">
              <input type="hidden" name="crewId" value={crew.id} />
              <div className="field"><label htmlFor={`crew-name-${crew.id}`}>Crew name</label><input id={`crew-name-${crew.id}`} name="name" defaultValue={crew.name} maxLength={120} required /></div>
              <div className="field"><label htmlFor={`crew-leader-${crew.id}`}>Crew leader</label><select id={`crew-leader-${crew.id}`} name="crewLeaderId" defaultValue={crew.crew_leader_id ?? ""}><option value="">No leader</option>{data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeNames.get(employee.id)}</option>)}</select></div>
              <label className="check-field"><input name="active" type="checkbox" defaultChecked={crew.active} /> Active and assignable</label>
              <button className="button secondary" type="submit">Save crew</button>
            </form>
            <div className="field-subsection"><h3>Active members</h3>{activeMemberships.length ? <div className="member-list">{activeMemberships.map((membership) => <div className="member-row" key={membership.id}><span><strong>{employeeNames.get(membership.employee_id)}</strong><small>{membership.effective_from} onward</small></span><form action={endCrewMembershipAction} className="button-row"><input type="hidden" name="membershipId" value={membership.id} /><label htmlFor={`end-${membership.id}`}>End</label><input id={`end-${membership.id}`} name="effectiveUntil" type="date" min={membership.effective_from} defaultValue={today} required /><button className="button ghost" type="submit">End membership</button></form></div>)}</div> : <p className="muted">No active members today.</p>}</div>
            {crew.active ? <form action={addCrewMemberAction} className="form-grid membership-form">
              <input type="hidden" name="crewId" value={crew.id} />
              <div className="field"><label htmlFor={`member-${crew.id}`}>Add employee</label><select id={`member-${crew.id}`} name="employeeId" required><option value="">Choose employee</option>{data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employeeNames.get(employee.id)}</option>)}</select></div>
              <div className="field"><label htmlFor={`from-${crew.id}`}>Effective from</label><input id={`from-${crew.id}`} name="effectiveFrom" type="date" defaultValue={today} required /></div>
              <div className="field"><label htmlFor={`until-${crew.id}`}>Effective until (optional)</label><input id={`until-${crew.id}`} name="effectiveUntil" type="date" /></div>
              <button className="button" type="submit">Add member</button>
            </form> : <p className="banner warning">Reactivate this crew before adding members or assigning new work.</p>}
            {memberships.length > activeMemberships.length ? <details className="field-history"><summary>Membership history</summary><ul className="list">{memberships.map((membership) => <li key={membership.id}>{employeeNames.get(membership.employee_id)} · {membership.effective_from} to {membership.effective_until ?? "ongoing"}</li>)}</ul></details> : null}
          </article>;
        }) : <div className="panel empty">No crews yet.</div>}
      </section>
    </>
  );
}
