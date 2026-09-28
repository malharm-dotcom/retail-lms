import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ActionForm, SubmitButton } from "@/components/forms";
import { EmptyState, Meter, PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { formatDate } from "@/lib/text";
import { createModule } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modules" };

export default async function ModulesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const user = await requireAdminPage();
  const { show } = await searchParams;
  const showArchived = show === "archived";

  const modules = await prisma().trainingModule.findMany({
    where: { status: showArchived ? "ARCHIVED" : { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
    include: {
      versions: {
        orderBy: { version: "desc" },
        select: {
          id: true,
          version: true,
          status: true,
          publishedAt: true,
          sections: { select: { _count: { select: { lessons: true } } } },
        },
      },
    },
  });

  const enrollmentStats = await prisma().enrollment.groupBy({
    by: ["status", "assignmentId"],
    _count: true,
    where: { assignment: { moduleVersion: { moduleId: { in: modules.map((module) => module.id) } } } },
  });
  const assignmentModule = new Map(
    (
      await prisma().assignment.findMany({
        where: { id: { in: [...new Set(enrollmentStats.map((row) => row.assignmentId))] } },
        select: { id: true, moduleVersion: { select: { moduleId: true } } },
      })
    ).map((row) => [row.id, row.moduleVersion.moduleId]),
  );
  const totals = new Map<string, { total: number; done: number }>();
  for (const row of enrollmentStats) {
    const moduleId = assignmentModule.get(row.assignmentId)!;
    const entry = totals.get(moduleId) ?? { total: 0, done: 0 };
    entry.total += row._count;
    if (row.status === "COMPLETED") entry.done += row._count;
    totals.set(moduleId, entry);
  }

  return (
    <AppShell active="modules" user={user}>
      <PageHeader
        eyebrow="Content"
        title="Learning modules"
        lede="Build a module as a draft, publish it, then assign it. Published versions are locked so completion records always match what people saw."
      />

      <div className="two-col">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">{showArchived ? "Archived" : "Library"}</p>
              <h2>{modules.length} module{modules.length === 1 ? "" : "s"}</h2>
            </div>
            <Link className="text-link" href={showArchived ? "/admin/modules" : "/admin/modules?show=archived"}>
              {showArchived ? "Back to library" : "View archived"}
            </Link>
          </div>
          {modules.length === 0 ? (
            <EmptyState title={showArchived ? "Nothing archived." : "No modules yet."}>
              {showArchived ? null : "Create your first module with the form on the right."}
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Module</th>
                    <th>Status</th>
                    <th className="num">Lessons</th>
                    <th className="num">Learners</th>
                    <th>Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {modules.map((module) => {
                    const latest = module.versions[0];
                    const live = module.versions.find((version) => version.status === "PUBLISHED");
                    const draft = module.versions.find((version) => version.status === "DRAFT");
                    const lessons = (live ?? latest)?.sections.reduce((sum, section) => sum + section._count.lessons, 0) ?? 0;
                    const stats = totals.get(module.id) ?? { total: 0, done: 0 };
                    return (
                      <tr key={module.id}>
                        <td className="primary">
                          <Link href={`/admin/modules/${module.id}`}>{module.title}</Link>
                          <span className="sub">
                            {live ? `v${live.version} live since ${formatDate(live.publishedAt)}` : "Never published"}
                            {draft && live ? ` · v${draft.version} draft open` : ""}
                          </span>
                        </td>
                        <td>
                          <StatusPill status={module.status} />
                        </td>
                        <td className="num">{lessons}</td>
                        <td className="num">{stats.total}</td>
                        <td>{stats.total ? <Meter value={Math.round((stats.done / stats.total) * 100)} /> : <span className="muted">—</span>}</td>
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
              <h2>Create a module</h2>
            </div>
          </div>
          <div className="panel-body">
            <ActionForm action={createModule} className="form-stack">
              <label className="field">
                <span>Title</span>
                <input name="title" placeholder="e.g. Store opening standards" required maxLength={120} />
              </label>
              <label className="field">
                <span>Short description</span>
                <textarea name="description" rows={3} style={{ minHeight: 84 }} placeholder="What employees will learn, in one or two lines." />
              </label>
              <div className="form-actions">
                <SubmitButton pendingLabel="Creating…">Create draft</SubmitButton>
              </div>
            </ActionForm>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
