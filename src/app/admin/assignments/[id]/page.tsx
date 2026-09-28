import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ActionForm, SubmitButton } from "@/components/forms";
import { LearnerTable } from "@/components/learner-table";
import { PageHeader, StatCard } from "@/components/ui";
import { assignmentAudienceInclude, audienceLabel } from "@/lib/assignments";
import { prisma } from "@/lib/db";
import { learnerRows } from "@/lib/reporting";
import { requireAdminPage } from "@/lib/session";
import { formatDateTime } from "@/lib/text";
import { syncAudience, updateDueDate } from "../actions";

export const dynamic = "force-dynamic";

const FILTERS = [
  ["", "Everyone"],
  ["OVERDUE", "Overdue"],
  ["NOT_STARTED", "Not started"],
  ["IN_PROGRESS", "In progress"],
  ["COMPLETED", "Completed"],
] as const;

export default async function AssignmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ status?: string }> }) {
  const user = await requireAdminPage();
  const { id } = await params;
  const { status = "" } = await searchParams;

  const assignment = await prisma().assignment.findUnique({
    where: { id },
    include: { ...assignmentAudienceInclude, moduleVersion: { include: { module: true } }, createdBy: { select: { name: true } } },
  });
  if (!assignment) notFound();

  const rows = await learnerRows({ assignmentId: id });
  const count = (key: string) => rows.filter((row) => row.displayStatus === key).length;
  const completed = count("COMPLETED");
  const shown = status ? rows.filter((row) => row.displayStatus === status) : rows;

  return (
    <AppShell active="assignments" user={user}>
      <PageHeader
        back={{ href: "/admin/assignments", label: "All assignments" }}
        eyebrow={`Assignment · ${audienceLabel(assignment)}`}
        title={assignment.moduleVersion.title}
        lede={`Version ${assignment.moduleVersion.version} · ${assignment.mandatory ? "mandatory" : "optional"} · assigned by ${assignment.createdBy.name} on ${formatDateTime(assignment.createdAt)}`}
        actions={
          <>
            <Link className="btn btn-secondary" href={`/admin/modules/${assignment.moduleVersion.moduleId}?v=${assignment.moduleVersionId}`}>
              View content
            </Link>
            <a className="btn btn-primary" href={`/admin/assignments/${id}/export`}>
              Export CSV
            </a>
          </>
        }
      />

      <section className="stats-grid">
        <StatCard label="Learners" value={rows.length} note={audienceLabel(assignment)} />
        <StatCard label="Completed" value={completed} note={`${rows.length ? Math.round((completed / rows.length) * 100) : 0}% of learners`} tone="good" />
        <StatCard label="In progress" value={count("IN_PROGRESS")} note={`${count("NOT_STARTED")} not started`} />
        <StatCard label="Overdue" value={count("OVERDUE")} note="Mandatory, past due" tone={count("OVERDUE") ? "alert" : undefined} />
      </section>

      <div className="two-col">
        <section className="panel">
          <div className="toolbar">
            {FILTERS.map(([value, label]) => (
              <Link
                key={value}
                className={`btn btn-small ${status === value ? "btn-primary" : "btn-secondary"}`}
                href={value ? `/admin/assignments/${id}?status=${value}` : `/admin/assignments/${id}`}
              >
                {label}
              </Link>
            ))}
          </div>
          <LearnerTable rows={shown} show="person" />
        </section>

        <aside className="stack sticky">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Settings</p>
                <h2>Deadline</h2>
              </div>
            </div>
            <div className="panel-body">
              <ActionForm action={updateDueDate} className="form-stack">
                <input type="hidden" name="assignmentId" value={id} />
                <label className="field">
                  <span>Due date</span>
                  <input type="date" name="dueDate" defaultValue={assignment.dueDate?.toISOString().slice(0, 10) ?? ""} />
                </label>
                <label className="check">
                  <input type="checkbox" name="mandatory" defaultChecked={assignment.mandatory} />
                  <span>Mandatory</span>
                </label>
                <div className="form-actions">
                  <SubmitButton variant="secondary">Update</SubmitButton>
                </div>
              </ActionForm>
            </div>
          </section>
          {assignment.target !== "INDIVIDUAL" ? (
            <section className="panel">
              <div className="panel-body form-stack">
                <p className="panel-note" style={{ margin: 0 }}>
                  New employees are enrolled automatically when they are imported. Use this after moving people between stores or departments by hand.
                </p>
                <form action={syncAudience}>
                  <input type="hidden" name="assignmentId" value={id} />
                  <SubmitButton variant="secondary" pendingLabel="Checking…">Enrol anyone missing</SubmitButton>
                </form>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}
