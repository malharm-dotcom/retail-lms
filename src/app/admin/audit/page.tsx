import { AppShell } from "@/components/app-shell";
import { actionLabel } from "@/lib/audit";
import { EmptyState, PageHeader } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireAdminPage } from "@/lib/session";
import { formatDateTime } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

function summarise(diff: unknown): string {
  if (!diff || typeof diff !== "object") return "";
  return Object.entries(diff as Record<string, unknown>)
    .filter(([, value]) => value !== null && value !== "" && typeof value !== "object")
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ")
    .slice(0, 180);
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireAdminPage();
  const { q = "" } = await searchParams;
  const events = await prisma().auditEvent.findMany({
    where: q
      ? { OR: [{ action: { contains: q, mode: "insensitive" } }, { actorEmployeeCode: { contains: q, mode: "insensitive" } }] }
      : {},
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return (
    <AppShell active="audit" user={user}>
      <PageHeader eyebrow="Accountability" title="Audit log" lede="Every change made by HR and admins, newest first. Entries cannot be edited." />
      <section className="panel">
        <form className="toolbar" method="get">
          <label className="field grow">
            <span>Filter</span>
            <input name="q" defaultValue={q} placeholder="Action (e.g. module.published) or employee code" />
          </label>
          <button className="btn btn-secondary" type="submit">
            Filter
          </button>
        </form>
        {events.length === 0 ? (
          <EmptyState title="No events." />
        ) : (
          <div className="table-wrap">
            <table className="ledger">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="nowrap">{formatDateTime(event.createdAt)}</td>
                    <td className="code">{event.actorEmployeeCode}</td>
                    <td>
                      <span title={event.action}>{actionLabel(event.action)}</span>
                    </td>
                    <td className="muted">{summarise(event.diff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}
