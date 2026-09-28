import type { Prisma } from "@/generated/prisma/client";
import { todayInIst } from "./dashboard";
import { prisma } from "./db";
import { evidenceFor, versionContentInclude, type VersionContent } from "./learning";
import { progressPercent } from "./progress";
import { toCsv } from "./text";

export type LearnerRow = Awaited<ReturnType<typeof learnerRows>>[number];

/** One row per enrollment with computed progress; the single source for admin tables and CSV exports. */
export async function learnerRows(where: Prisma.EnrollmentWhereInput, take = 5000) {
  const enrollments = await prisma().enrollment.findMany({
    where,
    take,
    orderBy: [{ user: { employeeCode: "asc" } }, { createdAt: "asc" }],
    include: {
      user: { select: { id: true, employeeCode: true, name: true, active: true, store: { select: { name: true } }, department: { select: { name: true } } } },
      assignment: { select: { id: true, mandatory: true, dueDate: true, moduleVersionId: true } },
      lessonProgress: { select: { lessonId: true, completedAt: true, watchedSeconds: true, percentComplete: true } },
      quizAttempts: { select: { passed: true, score: true } },
      acknowledgement: { select: { id: true, acknowledgedAt: true } },
    },
  });

  const versionIds = [...new Set(enrollments.map((row) => row.assignment.moduleVersionId))];
  const versions = new Map<string, VersionContent>(
    (await prisma().moduleVersion.findMany({ where: { id: { in: versionIds } }, include: versionContentInclude })).map((version) => [
      version.id,
      version,
    ]),
  );
  const today = todayInIst();

  return enrollments.map((row) => {
    const version = versions.get(row.assignment.moduleVersionId)!;
    const due = row.assignment.dueDate?.toISOString().slice(0, 10) ?? null;
    const overdue = row.assignment.mandatory && row.status !== "COMPLETED" && due !== null && due < today;
    return {
      enrollmentId: row.id,
      assignmentId: row.assignment.id,
      user: row.user,
      moduleTitle: version.title,
      moduleDescription: version.description,
      moduleVersion: version.version,
      mandatory: row.assignment.mandatory,
      dueDate: due,
      status: row.status,
      displayStatus: overdue ? "OVERDUE" : row.status,
      percent: progressPercent(evidenceFor(row, version)),
      attempts: row.quizAttempts.length,
      bestScore: row.quizAttempts.length ? Math.max(...row.quizAttempts.map((attempt) => attempt.score)) : null,
      hasQuiz: Boolean(version.quiz?.questions.length),
      acknowledgedAt: row.acknowledgement?.acknowledgedAt ?? null,
      needsAck: Boolean(version.policyStatement?.trim()),
      startedAt: row.startedAt,
      completedAt: row.completedAt,
    };
  });
}

export function learnerRowsCsv(rows: LearnerRow[]): string {
  const iso = (value: Date | null) => (value ? value.toISOString() : "");
  return toCsv([
    [
      "employee_code",
      "name",
      "store",
      "department",
      "module",
      "version",
      "mandatory",
      "due_date",
      "status",
      "progress_percent",
      "quiz_best_score",
      "quiz_attempts",
      "acknowledged_at",
      "started_at",
      "completed_at",
    ],
    ...rows.map((row) => [
      row.user.employeeCode,
      row.user.name,
      row.user.store?.name ?? "",
      row.user.department?.name ?? "",
      row.moduleTitle,
      row.moduleVersion,
      row.mandatory ? "yes" : "no",
      row.dueDate ?? "",
      row.displayStatus,
      row.percent,
      row.bestScore ?? "",
      row.attempts,
      iso(row.acknowledgedAt),
      iso(row.startedAt),
      iso(row.completedAt),
    ]),
  ]);
}

export function csvResponse(csv: string, fileName: string) {
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
