import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { AppShell } from "@/components/app-shell";
import { EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { emailEnabled } from "@/lib/email";
import { AddPersonForm, ImportForm, IssuePasswordsForm } from "./people-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "People" };

const PAGE = 200;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; store?: string; status?: string; role?: string }>;
}) {
  const user = await requireAdminPage();
  const { q = "", store = "", status = "active", role = "" } = await searchParams;

  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ employeeCode: { contains: q.trim(), mode: "insensitive" } }, { name: { contains: q.trim(), mode: "insensitive" } }] } : {}),
    ...(store ? { storeId: store } : {}),
    ...(status === "all" ? {} : { active: status !== "inactive" }),
    ...(role ? { role: role as Prisma.EnumRoleFilter["equals"] } : {}),
  };

  const emailOn = emailEnabled();
  const [people, total, stores, enrollmentCounts, pending] = await Promise.all([
    prisma().user.findMany({
      where,
      take: PAGE,
      orderBy: { employeeCode: "asc" },
      include: { store: { select: { name: true } }, department: { select: { name: true } } },
    }),
    prisma().user.count({ where }),
    prisma().store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma().enrollment.groupBy({ by: ["userId", "status"], _count: true, where: { user: where } }),
    prisma().user.count({ where: { active: true, forcePasswordChange: true, id: { not: user.id } } }),
  ]);

  const learning = new Map<string, { total: number; done: number }>();
  for (const row of enrollmentCounts) {
    const entry = learning.get(row.userId) ?? { total: 0, done: 0 };
    entry.total += row._count;
    if (row.status === "COMPLETED") entry.done += row._count;
    learning.set(row.userId, entry);
  }

  return (
    <AppShell active="people" user={user}>
      <PageHeader
        eyebrow="Directory"
        title="People"
        lede="Import staff from HR's master sheet, or add someone by hand. Deactivating a person blocks sign-in but keeps their training history."
      />

      <div className="two-col">
        <section className="panel">
          <form className="toolbar" method="get">
            <label className="field grow">
              <span>Search</span>
              <input name="q" defaultValue={q} placeholder="Name or employee code" />
            </label>
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
            <label className="field" style={{ minWidth: 130 }}>
              <span>Role</span>
              <select name="role" defaultValue={role}>
                <option value="">Any</option>
                <option value="EMPLOYEE">Employee</option>
                <option value="HR_ADMIN">HR admin</option>
                <option value="SUPER_ADMIN">Super admin</option>
              </select>
            </label>
            <label className="field" style={{ minWidth: 130 }}>
              <span>Status</span>
              <select name="status" defaultValue={status}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="all">All</option>
              </select>
            </label>
            <button className="btn btn-secondary" type="submit">
              Filter
            </button>
          </form>

          {people.length === 0 ? (
            <EmptyState title="No one matches.">Try a different filter, or import your staff list.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="ledger">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Store</th>
                    <th>Role</th>
                    <th className="num">Learning</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => {
                    const stats = learning.get(person.id);
                    return (
                      <tr key={person.id}>
                        <td className="code">{person.employeeCode}</td>
                        <td className="primary">
                          <Link href={`/admin/people/${person.id}`}>{person.name}</Link>
                          <span className="sub">{person.department?.name ?? person.email ?? ""}</span>
                        </td>
                        <td>{person.store?.name ?? "—"}</td>
                        <td>
                          <span className={`tag${person.role === "EMPLOYEE" ? "" : " tag-rust"}`}>{person.role.replace("_", " ").toLowerCase()}</span>
                        </td>
                        <td className="num">{stats ? `${stats.done}/${stats.total}` : "—"}</td>
                        <td>
                          <StatusPill status={person.active ? (person.forcePasswordChange ? "PENDING" : "ACTIVE") : "INACTIVE"} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="panel-note" style={{ padding: "12px 22px", margin: 0, borderTop: "1px solid var(--line)" }}>
            {total > PAGE ? `Showing the first ${PAGE} of ${total}. Narrow the filter to find someone.` : `${total} ${total === 1 ? "person" : "people"}.`}{" "}
            “Pending” means they have not yet replaced their temporary password.
          </p>
        </section>

        <aside className="stack sticky">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Bulk</p>
                <h2>Import CSV</h2>
              </div>
            </div>
            <div className="panel-body">
              <ImportForm emailOn={emailOn} />
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">First sign-in</p>
                <h2>Temporary passwords</h2>
              </div>
            </div>
            <div className="panel-body">
              <IssuePasswordsForm emailOn={emailOn} stores={stores} pending={pending} />
            </div>
          </section>
          <section className="panel">
            <details>
              <summary className="panel-heading" style={{ cursor: "pointer", listStyle: "none" }}>
                <div>
                  <p className="eyebrow">Single</p>
                  <h2>Add a person</h2>
                </div>
                <span className="text-link">Open</span>
              </summary>
              <div className="panel-body">
                <AddPersonForm emailOn={emailOn} />
              </div>
            </details>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
