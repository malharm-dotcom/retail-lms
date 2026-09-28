import Link from "next/link";

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  OVERDUE: "Overdue",
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
  RETIRED: "Retired",
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  PENDING: "Pending",
  SENT: "Sent",
  FAILED: "Failed",
};

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill pill-${status.toLowerCase().replace(/_/g, "-")}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function Meter({ value, label }: { value: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <span className="meter" role="img" aria-label={label ?? `${clamped}% complete`}>
      <span className="meter-track">
        <span className="meter-fill" style={{ width: `${clamped}%` }} />
      </span>
      <span className="meter-value">{clamped}%</span>
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  actions,
  back,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="page-header">
      <div>
        {back ? (
          <Link className="back-link" href={back.href}>
            ← {back.label}
          </Link>
        ) : null}
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

export function StatCard({ label, value, note, tone }: { label: string; value: string | number; note?: string; tone?: "alert" | "good" }) {
  return (
    <article className={`stat-card${tone ? ` is-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}
