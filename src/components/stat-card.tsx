type StatCardProps = {
  label: string;
  value: string | number;
  note: string;
};

export function StatCard({ label, value, note }: StatCardProps) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
