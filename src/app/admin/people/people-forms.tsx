"use client";

import { useActionState, useMemo } from "react";
import { SubmitButton } from "@/components/forms";
import type { IssuedCredential } from "@/lib/people";
import { addPerson, importPeople, issuePendingPasswords, type ImportResult } from "./actions";

function toCsvText(rows: string[][]) {
  return rows.map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",")).join("\r\n");
}

function Credentials({ credentials }: { credentials: IssuedCredential[] }) {
  const href = useMemo(() => {
    const csv = toCsvText([
      ["employee_code", "name", "email", "temporary_password", "emailed"],
      ...credentials.map((row) => [row.employeeCode, row.name, row.email ?? "", row.password, row.emailed ? "yes" : "no"]),
    ]);
    return URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv" }));
  }, [credentials]);

  if (credentials.length === 0) return null;
  return (
    <div className="callout is-good form-stack">
      <div>
        <strong>{credentials.length} temporary password{credentials.length === 1 ? "" : "s"} issued.</strong> Download them now — they are not stored
        and will not be shown again. Each person must set their own password at first sign-in.
      </div>
      <div className="form-actions">
        <a className="btn btn-primary btn-small" href={href} download={`credentials-${new Date().toISOString().slice(0, 10)}.csv`}>
          Download credentials CSV
        </a>
      </div>
      {credentials.length <= 5 ? (
        <table className="ledger">
          <tbody>
            {credentials.map((row) => (
              <tr key={row.employeeCode}>
                <td className="code">{row.employeeCode}</td>
                <td>{row.name}</td>
                <td className="mono">{row.password}</td>
                <td className="muted">{row.emailed ? "emailed" : row.email ? "" : "no email"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function Outcome({ state }: { state: ImportResult }) {
  if (!state) return null;
  return (
    <>
      {state.error ? (
        <div className="callout is-error" role="alert">
          {state.error}
          {state.problems?.length ? (
            <ul>
              {state.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {state.ok ? <p className="form-message is-ok">{state.ok}</p> : null}
      {state.credentials ? <Credentials credentials={state.credentials} /> : null}
    </>
  );
}

/** Email checkbox; disabled with an explanation until SMTP is configured. */
function SendEmailCheck({ emailOn, label }: { emailOn: boolean; label: string }) {
  return (
    <label className="check" style={emailOn ? undefined : { opacity: 0.6, cursor: "not-allowed" }}>
      <input type="checkbox" name="sendEmail" defaultChecked={emailOn} disabled={!emailOn} />
      <span>
        {label}
        {emailOn ? null : <small className="muted" style={{ display: "block" }}>Email is not set up yet — you will get a credentials CSV to share instead.</small>}
      </span>
    </label>
  );
}

export function ImportForm({ emailOn }: { emailOn: boolean }) {
  const [state, action] = useActionState(importPeople, null);
  return (
    <form action={action} className="form-stack">
      <label className="field">
        <span>Employee CSV</span>
        <input type="file" name="file" accept=".csv,text/csv" required />
        <small>
          Columns: employee_code, name, email, store_code, store_name, department_code, department_name, role. Existing codes are updated;
          passwords are only issued to new people.{" "}
          <a className="text-link" href="/admin/people/template" download>
            Download template
          </a>
        </small>
      </label>
      <SendEmailCheck emailOn={emailOn} label="Email sign-in details to new people who have an email address" />
      <div className="form-actions">
        <SubmitButton pendingLabel="Importing…">Import</SubmitButton>
      </div>
      <Outcome state={state} />
    </form>
  );
}

export function IssuePasswordsForm({ emailOn, stores, pending }: { emailOn: boolean; stores: { id: string; name: string }[]; pending: number }) {
  const [state, action] = useActionState(issuePendingPasswords, null);
  return (
    <form
      action={action}
      className="form-stack"
      onSubmit={(event) => {
        if (!window.confirm("Issue new temporary passwords? Any temporary passwords already handed out for these people will stop working.")) event.preventDefault();
      }}
    >
      <p className="panel-note" style={{ margin: 0 }}>
        {pending
          ? `${pending} ${pending === 1 ? "person has" : "people have"} not signed in yet. Issue them fresh temporary passwords in one go — useful if the credentials download after an import was missed.`
          : "Everyone has signed in and set their own password."}
      </p>
      <label className="field">
        <span>Who</span>
        <select name="storeId" defaultValue="">
          <option value="">Everyone who has not signed in</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              Not signed in · {store.name}
            </option>
          ))}
        </select>
      </label>
      <SendEmailCheck emailOn={emailOn} label="Email each person their sign-in details" />
      <div className="form-actions">
        <SubmitButton variant="secondary" pendingLabel="Issuing…">Issue temporary passwords</SubmitButton>
      </div>
      <Outcome state={state} />
    </form>
  );
}

export function AddPersonForm({ emailOn }: { emailOn: boolean }) {
  const [state, action] = useActionState(addPerson, null);
  return (
    <form action={action} className="form-grid">
      <label className="field">
        <span>Employee code</span>
        <input name="employee_code" required maxLength={32} />
      </label>
      <label className="field">
        <span>Full name</span>
        <input name="name" required maxLength={120} />
      </label>
      <label className="field span-2">
        <span>Email (for reminders)</span>
        <input name="email" type="email" />
      </label>
      <label className="field">
        <span>Store code</span>
        <input name="store_code" placeholder="e.g. BLR-IND" />
      </label>
      <label className="field">
        <span>Store name</span>
        <input name="store_name" placeholder="Only needed for a new store" />
      </label>
      <label className="field">
        <span>Department code</span>
        <input name="department_code" placeholder="e.g. RETAIL" />
      </label>
      <label className="field">
        <span>Role</span>
        <select name="role" defaultValue="EMPLOYEE">
          <option value="EMPLOYEE">Employee</option>
          <option value="HR_ADMIN">HR admin</option>
        </select>
      </label>
      <div className="span-2">
        <SendEmailCheck emailOn={emailOn} label="Email their sign-in details" />
      </div>
      <div className="form-actions span-2">
        <SubmitButton pendingLabel="Adding…">Add person</SubmitButton>
      </div>
      <div className="span-2">
        <Outcome state={state} />
      </div>
    </form>
  );
}
