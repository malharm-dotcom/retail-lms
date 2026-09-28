import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LearnerTable } from "@/components/learner-table";
import { PageHeader, StatCard, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { learnerRows } from "@/lib/reporting";
import { requireAdminPage } from "@/lib/session";
import { formatDateTime } from "@/lib/text";
import { resetPassword, setActive, updatePerson } from "../actions";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdminPage();
  const { id } = await params;

  const person = await prisma().user.findUnique({ where: { id }, include: { store: true, department: true } });
  if (!person) notFound();

  const [rows, stores, departments, acknowledgements] = await Promise.all([
    learnerRows({ userId: id }),
    prisma().store.findMany({ where: { OR: [{ active: true }, { id: person.storeId ?? "" }] }, orderBy: { name: "asc" } }),
    prisma().department.findMany({ where: { OR: [{ active: true }, { id: person.departmentId ?? "" }] }, orderBy: { name: "asc" } }),
    prisma().acknowledgement.findMany({
      where: { enrollment: { userId: id } },
      orderBy: { acknowledgedAt: "desc" },
      include: { moduleVersion: { select: { title: true, version: true } } },
    }),
  ]);

  const locked = person.role === "SUPER_ADMIN" && user.role !== "SUPER_ADMIN";
  const self = person.id === user.id;
  const count = (status: string) => rows.filter((row) => row.displayStatus === status).length;

  return (
    <AppShell active="people" user={user}>
      <PageHeader
        back={{ href: "/admin/people", label: "People" }}
        eyebrow={`${person.employeeCode} · ${person.role.replace("_", " ").toLowerCase()}`}
        title={person.name}
        lede={[person.store?.name, person.department?.name, person.email].filter(Boolean).join(" · ") || "No store or department yet."}
        actions={<StatusPill status={person.active ? (person.forcePasswordChange ? "PENDING" : "ACTIVE") : "INACTIVE"} />}
      />

      <section className="stats-grid">
        <StatCard label="Assigned" value={rows.length} />
        <StatCard label="Completed" value={count("COMPLETED")} tone="good" />
        <StatCard label="In progress" value={count("IN_PROGRESS") + count("NOT_STARTED")} note={`${count("NOT_STARTED")} not started`} />
        <StatCard label="Overdue" value={count("OVERDUE")} tone={count("OVERDUE") ? "alert" : undefined} />
      </section>

      <div className="two-col">
        <div className="stack">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Learning record</p>
                <h2>Modules</h2>
              </div>
            </div>
            <LearnerTable rows={rows} show="module" />
          </section>

          {acknowledgements.length ? (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Evidence</p>
                  <h2>Policy acknowledgements</h2>
                </div>
              </div>
              <div className="table-wrap">
                <table className="ledger">
                  <thead>
                    <tr>
                      <th>Module</th>
                      <th>Statement confirmed</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acknowledgements.map((ack) => (
                      <tr key={ack.id}>
                        <td className="primary">
                          {ack.moduleVersion.title}
                          <span className="sub">v{ack.moduleVersion.version}</span>
                        </td>
                        <td>“{ack.statement}”</td>
                        <td className="nowrap">{formatDateTime(ack.acknowledgedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="stack sticky">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Profile</p>
                <h2>Details</h2>
              </div>
            </div>
            <div className="panel-body">
              {locked ? (
                <p className="panel-note">Super admin accounts can only be changed by a super admin.</p>
              ) : (
                <ActionForm action={updatePerson} className="form-stack">
                  <input type="hidden" name="userId" value={person.id} />
                  <label className="field">
                    <span>Name</span>
                    <input name="name" defaultValue={person.name} required />
                  </label>
                  <label className="field">
                    <span>Email</span>
                    <input name="email" type="email" defaultValue={person.email ?? ""} />
                  </label>
                  <label className="field">
                    <span>Store</span>
                    <select name="storeId" defaultValue={person.storeId ?? ""}>
                      <option value="">No store</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name} · {store.code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Department</span>
                    <select name="departmentId" defaultValue={person.departmentId ?? ""}>
                      <option value="">No department</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Role</span>
                    <select name="role" defaultValue={person.role} disabled={self}>
                      <option value="EMPLOYEE">Employee</option>
                      <option value="HR_ADMIN">HR admin</option>
                      {user.role === "SUPER_ADMIN" ? <option value="SUPER_ADMIN">Super admin</option> : null}
                    </select>
                    {self ? <small>You cannot change your own role.</small> : null}
                  </label>
                  <div className="form-actions">
                    <SubmitButton variant="secondary">Save</SubmitButton>
                  </div>
                </ActionForm>
              )}
            </div>
          </section>

          {!locked && !self ? (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Access</p>
                  <h2>Sign-in</h2>
                </div>
              </div>
              <div className="panel-body form-stack">
                <ActionForm action={resetPassword} confirm={`Issue a new temporary password for ${person.employeeCode}? Their current password stops working.`}>
                  <input type="hidden" name="userId" value={person.id} />
                  <SubmitButton variant="secondary" pendingLabel="Resetting…">Reset password</SubmitButton>
                </ActionForm>
                <ActionForm
                  action={setActive}
                  confirm={person.active ? `Deactivate ${person.name}? They will be signed out and blocked.` : undefined}
                >
                  <input type="hidden" name="userId" value={person.id} />
                  <input type="hidden" name="active" value={person.active ? "false" : "true"} />
                  <SubmitButton variant={person.active ? "danger" : "secondary"}>{person.active ? "Deactivate" : "Reactivate"}</SubmitButton>
                </ActionForm>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}
