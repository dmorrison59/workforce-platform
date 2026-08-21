import { FormField, SelectField } from "@/components/form-field";
import type { Department, Employee, Role } from "@/types/database";

export function ShiftFields({
  departments,
  employees,
  roles,
  defaults,
}: {
  departments: Department[];
  employees: Employee[];
  roles: Role[];
  defaults?: {
    departmentId?: string;
    roleId?: string | null;
    employeeId?: string | null;
    startLocal?: string;
    endLocal?: string;
    breakMinutes?: number;
    notes?: string;
  };
}) {
  return (
    <>
      <div className="two-col">
        <SelectField label="Department" name="departmentId" required defaultValue={defaults?.departmentId ?? ""}>
          <option value="" disabled>Select department</option>
          {departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}
        </SelectField>
        <SelectField label="Employee" name="employeeId" defaultValue={defaults?.employeeId ?? ""}>
          <option value="">Unassigned</option>
          {employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.first_name} {employee.last_name}</option>)}
        </SelectField>
      </div>
      <div className="two-col">
        <SelectField label="Role" name="roleId" defaultValue={defaults?.roleId ?? ""}>
          <option value="">No role</option>
          {roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}
        </SelectField>
        <FormField label="Break minutes" name="breakMinutes" type="number" min="0" step="1" required defaultValue={defaults?.breakMinutes ?? 0} />
      </div>
      <div className="two-col">
        <FormField label="Start time" name="startLocal" type="datetime-local" required defaultValue={defaults?.startLocal} />
        <FormField label="End time" name="endLocal" type="datetime-local" required defaultValue={defaults?.endLocal} />
      </div>
      <div className="field">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={3} maxLength={2000} defaultValue={defaults?.notes} />
      </div>
    </>
  );
}

