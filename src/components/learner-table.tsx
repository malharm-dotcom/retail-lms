import Link from "next/link";
import type { LearnerRow } from "@/lib/reporting";
import { formatDate, formatDateTime } from "@/lib/text";
import { EmptyState, Meter, StatusPill } from "./ui";

/** Enrollment ledger. `show` picks whether to lead with the person or the module. */
export function LearnerTable({ rows, show }: { rows: LearnerRow[]; show: "person" | "module" }) {
  if (rows.length === 0) return <EmptyState title="No records match." />;
  return (
    <div className="table-wrap">
      <table className="ledger">
        <thead>
          <tr>
            <th>{show === "person" ? "Employee" : "Module"}</th>
            {show === "person" ? <th>Store</th> : <th>Due</th>}
            <th>Status</th>
            <th>Progress</th>
            <th className="num">Quiz</th>
            <th>Completed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.enrollmentId}>
              {show === "person" ? (
                <td className="primary">
                  <Link href={`/admin/people/${row.user.id}`}>{row.user.name}</Link>
                  <span className="sub mono">
                    {row.user.employeeCode}
                    {row.user.active ? "" : " · inactive"}
                  </span>
                </td>
              ) : (
                <td className="primary">
                  <Link href={`/admin/assignments/${row.assignmentId}`}>{row.moduleTitle}</Link>
                  <span className="sub">
                    v{row.moduleVersion} · {row.mandatory ? "Mandatory" : "Optional"}
                  </span>
                </td>
              )}
              {show === "person" ? <td>{row.user.store?.name ?? "—"}</td> : <td className="nowrap">{formatDate(row.dueDate)}</td>}
              <td>
                <StatusPill status={row.displayStatus} />
              </td>
              <td>
                <Meter value={row.percent} />
              </td>
              <td className="num">
                {row.hasQuiz ? (row.bestScore === null ? <span className="muted">—</span> : `${row.bestScore}% · ${row.attempts}×`) : <span className="muted">n/a</span>}
              </td>
              <td className="nowrap">{formatDateTime(row.completedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
