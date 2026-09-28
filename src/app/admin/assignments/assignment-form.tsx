"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { createAssignment } from "./actions";

type Option = { id: string; label: string };

export function AssignmentForm({
  modules,
  stores,
  departments,
  defaultModule,
  employeeCount,
}: {
  modules: Option[];
  stores: Option[];
  departments: Option[];
  defaultModule?: string;
  employeeCount: number;
}) {
  const [target, setTarget] = useState("ALL_EMPLOYEES");

  if (modules.length === 0) {
    return <p className="panel-note">Publish a module first — only published versions can be assigned.</p>;
  }

  return (
    <ActionForm action={createAssignment} className="form-stack">
      <label className="field">
        <span>Module</span>
        <select name="moduleVersionId" defaultValue={defaultModule ?? modules[0].id} required>
          {modules.map((module) => (
            <option key={module.id} value={module.id}>
              {module.label}
            </option>
          ))}
        </select>
      </label>

      <div className="field">
        <span className="field-label">Who should complete it</span>
        <div className="segmented" role="radiogroup">
          {[
            ["ALL_EMPLOYEES", "Everyone"],
            ["STORE", "A store"],
            ["DEPARTMENT", "A department"],
            ["INDIVIDUAL", "Specific people"],
          ].map(([value, label]) => (
            <label key={value}>
              <input type="radio" name="target" value={value} checked={target === value} onChange={() => setTarget(value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {target === "ALL_EMPLOYEES" ? <small>All {employeeCount} active employees, plus anyone added later.</small> : null}
      </div>

      {target === "STORE" ? (
        <label className="field">
          <span>Store</span>
          <select name="storeId" required defaultValue="">
            <option value="" disabled>
              Choose a store…
            </option>
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.label}
              </option>
            ))}
          </select>
          <small>New employees joining this store are enrolled automatically.</small>
        </label>
      ) : null}
      {target === "DEPARTMENT" ? (
        <label className="field">
          <span>Department</span>
          <select name="departmentId" required defaultValue="">
            <option value="" disabled>
              Choose a department…
            </option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {target === "INDIVIDUAL" ? (
        <label className="field">
          <span>Employee codes</span>
          <textarea name="employeeCodes" rows={3} style={{ minHeight: 80 }} placeholder="EMP1001, EMP1002…" required />
          <small>Separate with commas, spaces or new lines.</small>
        </label>
      ) : null}

      <div className="form-grid">
        <label className="field">
          <span>Due date</span>
          <input name="dueDate" type="date" />
        </label>
        <label className="check" style={{ alignSelf: "end", paddingBottom: 10 }}>
          <input type="checkbox" name="mandatory" defaultChecked />
          <span>Mandatory</span>
        </label>
      </div>

      <div className="form-actions">
        <SubmitButton pendingLabel="Assigning…">Assign module</SubmitButton>
      </div>
    </ActionForm>
  );
}
