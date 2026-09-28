import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmptyState, PageHeader, StatCard, StatusPill } from "@/components/ui";
import { learnerRows, type LearnerRow } from "@/lib/reporting";
import { requireCurrentUser } from "@/lib/session";
import { formatDate } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata = { title: "My learning" };

function QueueRow({ row }: { row: LearnerRow }) {
  const done = row.status === "COMPLETED";
  const cta = done ? "Review" : row.status === "NOT_STARTED" ? "Start" : "Continue";
  return (
    <Link className="queue-row" href={`/learn/${row.enrollmentId}`}>
      <span className={`module-mark${done ? " is-done" : row.mandatory ? " is-mandatory" : ""}`} aria-hidden="true">
        {row.moduleTitle.slice(0, 1).toUpperCase()}
      </span>
      <span>
        <span className="queue-meta">
          <StatusPill status={row.displayStatus} />
          <span className="tag">{row.mandatory ? "Mandatory" : "Optional"}</span>
        </span>
        <h3>{row.moduleTitle}</h3>
        <p>{row.moduleDescription ?? "Assigned by HR."}</p>
      </span>
      <span>
        <span className="meter" aria-label={`${row.percent}% complete`}>
          <span className="meter-track">
            <span className="meter-fill" style={{ width: `${row.percent}%` }} />
          </span>
          <span className="meter-value">{row.percent}%</span>
        </span>
        <span className={`queue-due${row.displayStatus === "OVERDUE" ? " is-overdue" : ""}`} style={{ display: "block", marginTop: 6 }}>
          {done ? `Done ${formatDate(row.completedAt)}` : row.dueDate ? `Due ${formatDate(row.dueDate)}` : "No due date"}
        </span>
      </span>
      <span className="queue-cta">{cta} →</span>
    </Link>
  );
}

function Group({ title, rows }: { title: string; rows: LearnerRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="queue-group">
      <h2>
        {title} <small>{rows.length}</small>
      </h2>
      <div className="queue">
        {rows.map((row) => (
          <QueueRow key={row.enrollmentId} row={row} />
        ))}
      </div>
    </section>
  );
}

export default async function LearnPage() {
  const user = await requireCurrentUser();
  const rows = await learnerRows({ userId: user.id });

  const byDue = (a: LearnerRow, b: LearnerRow) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  const overdue = rows.filter((row) => row.displayStatus === "OVERDUE").sort(byDue);
  const todo = rows.filter((row) => row.mandatory && row.displayStatus !== "OVERDUE" && row.status !== "COMPLETED").sort(byDue);
  const optional = rows.filter((row) => !row.mandatory && row.status !== "COMPLETED");
  const completed = rows.filter((row) => row.status === "COMPLETED");
  const next = [...overdue, ...todo, ...optional][0];

  return (
    <AppShell active="learn" user={user}>
      <PageHeader
        eyebrow={user.store?.name ?? "My learning"}
        title={
          <>
            Hello, <em>{user.name.split(" ")[0]}</em>.
          </>
        }
        lede={
          overdue.length
            ? `You have ${overdue.length} overdue module${overdue.length === 1 ? "" : "s"}. Please finish ${overdue.length === 1 ? "it" : "them"} first.`
            : todo.length
              ? "Complete your mandatory learning before its due date. Progress saves automatically."
              : "You are all caught up on mandatory learning."
        }
        actions={
          next ? (
            <Link className="btn btn-primary" href={`/learn/${next.enrollmentId}`}>
              {next.status === "NOT_STARTED" ? "Start" : "Continue"}: {next.moduleTitle.length > 28 ? `${next.moduleTitle.slice(0, 28)}…` : next.moduleTitle}
            </Link>
          ) : null
        }
      />

      <section className="stats-grid" aria-label="Summary">
        <StatCard label="To do" value={overdue.length + todo.length} note="Mandatory, not finished" />
        <StatCard label="Overdue" value={overdue.length} note="Past the due date" tone={overdue.length ? "alert" : undefined} />
        <StatCard label="Optional" value={optional.length} note="Recommended by HR" />
        <StatCard label="Completed" value={completed.length} note="Recorded in your file" tone="good" />
      </section>

      {rows.length === 0 ? (
        <section className="panel">
          <EmptyState title="Nothing assigned yet.">When HR assigns you learning, it will appear here.</EmptyState>
        </section>
      ) : (
        <>
          <Group title="Overdue" rows={overdue} />
          <Group title="Mandatory" rows={todo} />
          <Group title="Optional" rows={optional} />
          <Group title="Completed" rows={completed} />
        </>
      )}
    </AppShell>
  );
}
