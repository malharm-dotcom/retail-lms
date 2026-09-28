import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { getAdminDashboard } from "@/lib/dashboard";
import { canAccessAdmin } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireCurrentUser();
  if (!canAccessAdmin(user.role)) redirect("/learn");

  const dashboard = await getAdminDashboard();

  return (
    <AppShell active="admin" user={user}>
      <header className="page-header">
        <div>
          <p className="eyebrow">HR CONTROL DESK</p>
          <h1>Learning operations, at a glance.</h1>
          <p>Track the rollout now. Content publishing and employee imports are the next build step.</p>
        </div>
        <div className="date-stamp">LIVE DATABASE</div>
      </header>

      <section className="stats-grid" aria-label="Administration summary">
        <StatCard label="Active employees" value={dashboard.employeeCount} note="Eligible for assignments" />
        <StatCard label="Published modules" value={dashboard.activeModuleCount} note="Available to assign" />
        <StatCard label="Assignments" value={dashboard.assignmentCount} note="Current rollout rules" />
        <StatCard label="Completion" value={`${dashboard.summary.completionRate}%`} note={`${dashboard.summary.completed} of ${dashboard.summary.total} enrollments`} />
      </section>

      <section className="admin-grid">
        <article className="panel compliance-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">COMPLIANCE</p>
              <h2>Mandatory learning</h2>
            </div>
            <span>{dashboard.summary.overdue} overdue</span>
          </div>
          <div className="compliance-meter">
            <div style={{ width: `${dashboard.summary.completionRate}%` }} />
          </div>
          <div className="compliance-numbers">
            <div><strong>{dashboard.summary.completed}</strong><span>Completed</span></div>
            <div><strong>{dashboard.summary.inProgress}</strong><span>In progress</span></div>
            <div><strong>{dashboard.summary.notStarted}</strong><span>Not started</span></div>
          </div>
        </article>

        <article className="panel release-panel">
          <p className="eyebrow">NEXT RELEASE</p>
          <h2>HR authoring tools</h2>
          <p>Module builder, CSV employee import, assignment controls, quiz setup and email delivery.</p>
          <ul>
            <li>Schema is ready</li>
            <li>Roles are enforced</li>
            <li>SMTP variables are scoped</li>
          </ul>
        </article>
      </section>
    </AppShell>
  );
}
