import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { EmptyState, Meter, PageHeader } from "@/components/ui";
import { assignmentAudienceInclude, audienceLabel } from "@/lib/assignments";
import { todayInIst } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { formatDate } from "@/lib/text";
import { AssignmentForm } from "./assignment-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Assignments" };

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  const user = await requireAdminPage();
  const { module: defaultModule } = await searchParams;
  const today = todayInIst();

  const [assignments, versions, stores, departments, employeeCount, counts] = await Promise.all([
    prisma().assignment.findMany({
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        ...assignmentAudienceInclude,
        moduleVersion: { select: { title: true, version: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma().moduleVersion.findMany({
      where: { status: "PUBLISHED", module: { status: "PUBLISHED" } },
      orderBy: { title: "asc" },
      select: { id: true, title: true, version: true },
    }),
    prisma().store.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    prisma().department.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma().user.count({ where: { active: true, role: "EMPLOYEE" } }),
    prisma().enrollment.groupBy({ by: ["assignmentId", "status"], _count: true }),
  ]);

  const stats = new Map<string, { total: number; done: number }>();
  for (const row of counts) {
    const entry = stats.get(row.assignmentId) ?? { total: 0, done: 0 };
    entry.total += row._count;
    if (row.status === "COMPLETED") entry.done += row._count;
    stats.set(row.assignmentId, entry);
  }

  return (
    <AppShell active="assignments" user={user}>
      <PageHeader
        eyebrow="Distribution"
        title="Assignments"
        lede="Every assignment creates one record per employee, so each person's progress is tracked individually."
      />

      <div className="two-col">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Rollouts</p>
              <h2>{assignments.length} assignment{assignments.length === 1 ? "" : "s"}</h2>
            </div>
          </div>
          {assignments.length === 0 ? (
            <EmptyState title="Nothing assigned yet.">Pick a published module on the right and choose who should complete it.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Audience</th>
                    <th>Due</th>
                    <th className="num">People</th>
                    <th>Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((assignment) => {
                    const row = stats.get(assignment.id) ?? { total: 0, done: 0 };
                    const due = assignment.dueDate?.toISOString().slice(0, 10) ?? null;
                    const overdue = due !== null && due < today && row.done < row.total;
                    return (
                      <tr key={assignment.id}>
                        <td className="primary">
                          <Link href={`/admin/assignments/${assignment.id}`}>{assignment.moduleVersion.title}</Link>
                          <span className="sub">
                            v{assignment.moduleVersion.version} · {assignment.mandatory ? "Mandatory" : "Optional"} · by {assignment.createdBy.name}
                          </span>
                        </td>
                        <td>{audienceLabel(assignment)}</td>
                        <td className={`nowrap${overdue ? " queue-due is-overdue" : ""}`}>{due ? formatDate(due) : "—"}</td>
                        <td className="num">{row.total}</td>
                        <td>{row.total ? <Meter value={Math.round((row.done / row.total) * 100)} /> : <span className="muted">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel sticky">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">New</p>
              <h2>Assign a module</h2>
            </div>
          </div>
          <div className="panel-body">
            <AssignmentForm
              modules={versions.map((version) => ({ id: version.id, label: `${version.title} (v${version.version})` }))}
              stores={stores.map((store) => ({ id: store.id, label: `${store.name} · ${store.code}` }))}
              departments={departments.map((department) => ({ id: department.id, label: department.name }))}
              defaultModule={versions.some((version) => version.id === defaultModule) ? defaultModule : undefined}
              employeeCount={employeeCount}
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
