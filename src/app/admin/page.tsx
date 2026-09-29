import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { actionLabel } from "@/lib/audit";
import { LearnerTable } from "@/components/learner-table";
import { EmptyState, Meter, PageHeader, StatCard } from "@/components/ui";
import { getAdminDashboard, todayInIst } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { learnerRows } from "@/lib/reporting";
import { requireAdminPage } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata = { title: "Overview" };

export default async function AdminPage() {
  const user = await requireAdminPage();
  const today = new Date(`${todayInIst()}T00:00:00.000Z`);

  const [dashboard, modules, overdue, recent, draftCount] = await Promise.all([
    getAdminDashboard(),
    prisma().trainingModule.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, title: true, versions: { select: { assignments: { select: { enrollments: { select: { status: true } } } } } } },
    }),
    learnerRows({ status: { not: "COMPLETED" }, assignment: { mandatory: true, dueDate: { lt: today } } }, 8),
    prisma().auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    prisma().trainingModule.count({ where: { status: "DRAFT" } }),
  ]);

  const steps = [
    { done: dashboard.employeeCount > 0, label: "Import your staff", href: "/admin/people", note: "Upload the HR master CSV." },
    { done: dashboard.activeModuleCount + draftCount > 0, label: "Build a module", href: "/admin/modules", note: "YouTube or uploaded videos, PDFs, text and a quiz." },
    { done: dashboard.activeModuleCount > 0, label: "Publish it", href: "/admin/modules", note: "Locks the content for tracking." },
    { done: dashboard.assignmentCount > 0, label: "Assign it", href: "/admin/assignments", note: "To everyone, a store, or people." },
  ];
  const setupDone = steps.every((step) => step.done);

  return (
    <AppShell active="admin" user={user}>
      <PageHeader
        eyebrow={`HR desk · ${formatDate(new Date())}`}
        title={
          <>
            Good {Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date())) < 12 ? "morning" : "day"},{" "}
            <em>{user.name.split(" ")[0]}</em>.
          </>
        }
        lede="Where learning stands across stores today."
        actions={
          <>
            <Link className="btn btn-secondary" href="/admin/modules">
              New module
            </Link>
            <Link className="btn btn-primary" href="/admin/assignments">
              Assign learning
            </Link>
          </>
        }
      />

      <section className="stats-grid" aria-label="Summary">
        <StatCard label="Active employees" value={dashboard.employeeCount} note="Can sign in and learn" />
        <StatCard label="Live modules" value={dashboard.activeModuleCount} note={draftCount ? `${draftCount} in draft` : "Published and assignable"} />
        <StatCard
          label="Completion"
          value={`${dashboard.summary.completionRate}%`}
          note={`${dashboard.summary.completed} of ${dashboard.summary.total} enrolments`}
          tone="good"
        />
        <StatCard label="Overdue" value={dashboard.summary.overdue} note="Mandatory, past due date" tone={dashboard.summary.overdue ? "alert" : undefined} />
      </section>

      {!setupDone ? (
        <section className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Getting started</p>
              <h2>Four steps to your first rollout</h2>
            </div>
          </div>
          <div className="stats-grid" style={{ margin: 0, border: 0 }}>
            {steps.map((step, index) => (
              <Link key={step.label} href={step.href} className="stat-card" style={{ minHeight: 110 }}>
                <span>
                  {step.done ? "✓ Done" : `Step ${index + 1}`}
                </span>
                <strong style={{ fontSize: 22, color: step.done ? "var(--faint)" : undefined }}>{step.label}</strong>
                <small>{step.note}</small>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="two-col">
        <div className="stack">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Needs attention</p>
                <h2>Overdue mandatory learning</h2>
              </div>
              <Link className="text-link" href="/admin/reports">
                Full report
              </Link>
            </div>
            {overdue.length ? <LearnerTable rows={overdue} show="person" /> : <EmptyState title="Nothing overdue.">Everyone is on track.</EmptyState>}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Modules</p>
                <h2>Completion by module</h2>
              </div>
              <Link className="text-link" href="/admin/modules">
                All modules
              </Link>
            </div>
            {modules.length === 0 ? (
              <EmptyState title="No live modules yet." />
            ) : (
              <table className="ledger">
                <tbody>
                  {modules.map((module) => {
                    const statuses = module.versions.flatMap((version) => version.assignments.flatMap((assignment) => assignment.enrollments));
                    const done = statuses.filter((row) => row.status === "COMPLETED").length;
                    return (
                      <tr key={module.id}>
                        <td className="primary">
                          <Link href={`/admin/modules/${module.id}`}>{module.title}</Link>
                          <span className="sub">
                            {statuses.length} learner{statuses.length === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td style={{ width: 240 }}>{statuses.length ? <Meter value={Math.round((done / statuses.length) * 100)} /> : <span className="muted">Not assigned</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <section className="panel sticky">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Activity</p>
              <h2>Recent changes</h2>
            </div>
            <Link className="text-link" href="/admin/audit">
              Audit log
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState title="No activity yet." />
          ) : (
            <dl className="key-list" style={{ padding: "4px 22px 10px" }}>
              {recent.map((event) => (
                <div key={event.id}>
                  <dt>
                    <span title={event.action}>{actionLabel(event.action)}</span>
                    <span className="sub" style={{ display: "block", fontSize: 12 }}>
                      {event.actorEmployeeCode}
                    </span>
                  </dt>
                  <dd className="muted" style={{ fontWeight: 400, fontSize: 12.5 }}>
                    {formatDateTime(event.createdAt)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>
    </AppShell>
  );
}
