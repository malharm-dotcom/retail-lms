import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { LearnerTable } from "@/components/learner-table";
import { EmptyState, Meter, PageHeader } from "@/components/ui";
import { todayInIst } from "@/lib/dashboard";
import { prisma } from "@/lib/db";
import { learnerRows } from "@/lib/reporting";
import { requireAdminPage } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

type Rollup = { key: string; label: string; learners: number; total: number; completed: number; overdue: number };

async function rollup(by: "store" | "module", store: string, module: string): Promise<Rollup[]> {
  const rows =
    by === "store"
      ? await prisma().$queryRaw<{ key: string; label: string; learners: bigint; total: bigint; completed: bigint; overdue: bigint }[]>`
          SELECT coalesce(s.id, 'none') AS key, coalesce(s.name, 'No store') AS label,
                 count(DISTINCT e."userId") AS learners, count(*) AS total,
                 count(*) FILTER (WHERE e.status = 'COMPLETED') AS completed,
                 count(*) FILTER (WHERE e.status <> 'COMPLETED' AND a.mandatory AND a."dueDate" < ${todayInIst()}::date) AS overdue
            FROM "Enrollment" e
            JOIN "Assignment" a ON a.id = e."assignmentId"
            JOIN "ModuleVersion" v ON v.id = a."moduleVersionId"
            JOIN "User" u ON u.id = e."userId"
       LEFT JOIN "Store" s ON s.id = u."storeId"
           WHERE (${store} = '' OR u."storeId" = ${store}) AND (${module} = '' OR v."moduleId" = ${module})
        GROUP BY 1, 2 ORDER BY 2`
      : await prisma().$queryRaw<{ key: string; label: string; learners: bigint; total: bigint; completed: bigint; overdue: bigint }[]>`
          SELECT m.id AS key, m.title AS label,
                 count(DISTINCT e."userId") AS learners, count(*) AS total,
                 count(*) FILTER (WHERE e.status = 'COMPLETED') AS completed,
                 count(*) FILTER (WHERE e.status <> 'COMPLETED' AND a.mandatory AND a."dueDate" < ${todayInIst()}::date) AS overdue
            FROM "Enrollment" e
            JOIN "Assignment" a ON a.id = e."assignmentId"
            JOIN "ModuleVersion" v ON v.id = a."moduleVersionId"
            JOIN "TrainingModule" m ON m.id = v."moduleId"
            JOIN "User" u ON u.id = e."userId"
           WHERE (${store} = '' OR u."storeId" = ${store}) AND (${module} = '' OR m.id = ${module})
        GROUP BY 1, 2 ORDER BY 2`;
  return rows.map((row) => ({
    key: row.key,
    label: row.label,
    learners: Number(row.learners),
    total: Number(row.total),
    completed: Number(row.completed),
    overdue: Number(row.overdue),
  }));
}

function RollupTable({ rows, title, heading, link }: { rows: Rollup[]; title: string; heading: string; link: (key: string) => string }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Completion</p>
          <h2>{title}</h2>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No data yet." />
      ) : (
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>{heading}</th>
                <th className="num">People</th>
                <th className="num">Overdue</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td className="primary">
                    <Link href={link(row.key)}>{row.label}</Link>
                  </td>
                  <td className="num">{row.learners}</td>
                  <td className="num">{row.overdue ? <span style={{ color: "var(--rust)" }}>{row.overdue}</span> : 0}</td>
                  <td>
                    <Meter value={row.total ? Math.round((row.completed / row.total) * 100) : 0} label={`${row.completed} of ${row.total} complete`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ store?: string; module?: string }> }) {
  const user = await requireAdminPage();
  const { store = "", module = "" } = await searchParams;
  const today = new Date(`${todayInIst()}T00:00:00.000Z`);

  const [stores, modules, byStore, byModule, overdue] = await Promise.all([
    prisma().store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma().trainingModule.findMany({
      where: { versions: { some: { status: { not: "DRAFT" } } } },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    rollup("store", store, module),
    rollup("module", store, module),
    learnerRows(
      {
        ...(store ? { user: { storeId: store } } : {}),
        status: { not: "COMPLETED" },
        assignment: { mandatory: true, dueDate: { lt: today }, ...(module ? { moduleVersion: { moduleId: module } } : {}) },
      },
      200,
    ),
  ]);

  const query = new URLSearchParams({ ...(store ? { store } : {}), ...(module ? { module } : {}) }).toString();

  return (
    <AppShell active="reports" user={user}>
      <PageHeader
        eyebrow="Compliance"
        title="Reports"
        lede="Completion by store and by module. Export the full record for audits or to share with store managers."
        actions={
          <a className="btn btn-primary" href={`/admin/reports/export${query ? `?${query}` : ""}`}>
            Export CSV
          </a>
        }
      />

      <form className="panel toolbar" method="get" style={{ marginBottom: 24 }}>
        <label className="field">
          <span>Store</span>
          <select name="store" defaultValue={store}>
            <option value="">All stores</option>
            {stores.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Module</span>
          <select name="module" defaultValue={module}>
            <option value="">All modules</option>
            {modules.map((row) => (
              <option key={row.id} value={row.id}>
                {row.title}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-secondary" type="submit">
          Apply
        </button>
        {query ? (
          <Link className="text-link" href="/admin/reports">
            Clear filters
          </Link>
        ) : null}
      </form>

      <div className="two-col-even">
        <RollupTable
          rows={byStore}
          title="By store"
          heading="Store"
          link={(key) => `/admin/reports?${new URLSearchParams({ ...(key !== "none" ? { store: key } : {}), ...(module ? { module } : {}) })}`}
        />
        <RollupTable
          rows={byModule}
          title="By module"
          heading="Module"
          link={(key) => `/admin/reports?${new URLSearchParams({ module: key, ...(store ? { store } : {}) })}`}
        />
      </div>

      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Follow up</p>
            <h2>Overdue mandatory learning · {overdue.length}</h2>
          </div>
        </div>
        {overdue.length ? <LearnerTable rows={overdue} show="person" /> : <EmptyState title="Nothing overdue.">Everyone is on track.</EmptyState>}
      </section>
    </AppShell>
  );
}
