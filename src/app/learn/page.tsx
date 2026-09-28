import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StatCard } from "@/components/stat-card";
import { getEmployeeDashboard } from "@/lib/dashboard";
import { canAccessAdmin } from "@/lib/rbac";
import { requireCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function formatDueDate(value: string | null) {
  if (!value) return "No due date";
  const [year, month, day] = value.split("-").map(Number);
  return `Due ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(year, month - 1, day))}`;
}

export default async function LearnPage() {
  const user = await requireCurrentUser();
  if (canAccessAdmin(user.role)) redirect("/admin");

  const dashboard = await getEmployeeDashboard(user.id);

  return (
    <AppShell active="learn" user={user}>
      <header className="page-header">
        <div>
          <p className="eyebrow">EMPLOYEE LEARNING</p>
          <h1>Good to see you, {user.name.split(" ")[0]}.</h1>
          <p>Complete mandatory learning before its due date. Your progress is saved lesson by lesson.</p>
        </div>
        <div className="date-stamp">ENGLISH · IST</div>
      </header>

      <section className="stats-grid" aria-label="Learning summary">
        <StatCard label="Assigned" value={dashboard.summary.total} note="All active learning" />
        <StatCard label="In progress" value={dashboard.summary.inProgress} note="Continue where you stopped" />
        <StatCard label="Completed" value={dashboard.summary.completed} note={`${dashboard.summary.completionRate}% completion rate`} />
        <StatCard label="Overdue" value={dashboard.summary.overdue} note="Mandatory items only" />
      </section>

      <section className="panel learning-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">YOUR QUEUE</p>
            <h2>Assigned learning</h2>
          </div>
          <span>{dashboard.summary.mandatory} mandatory</span>
        </div>

        {dashboard.items.length === 0 ? (
          <div className="empty-state">
            <strong>You are all caught up.</strong>
            <p>New learning assigned by HR will appear here.</p>
          </div>
        ) : (
          <div className="learning-list">
            {dashboard.items.map((item) => {
              const progress = item.totalLessons === 0 ? 0 : Math.round((item.completedLessons / item.totalLessons) * 100);
              return (
                <article className="learning-row" key={item.id}>
                  <div className="module-mark" aria-hidden="true">{item.title.slice(0, 2).toUpperCase()}</div>
                  <div>
                    <div className="module-meta">
                      <span className={`status status-${item.status.toLowerCase().replace("_", "-")}`}>{item.status.replace("_", " ")}</span>
                      {item.mandatory ? <span>Mandatory</span> : <span>Optional</span>}
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description ?? "Training assigned by HR."}</p>
                  </div>
                  <div className="module-progress">
                    <strong>{progress}%</strong>
                    <span>{formatDueDate(item.dueDate)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}
