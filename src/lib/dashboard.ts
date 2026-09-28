import type { EnrollmentStatus } from "@/generated/prisma/client";
import { prisma } from "./db";

type EnrollmentSummaryInput = {
  status: EnrollmentStatus;
  mandatory: boolean;
  dueDate: string | null;
};

export function summarizeEnrollments(rows: EnrollmentSummaryInput[], today: string) {
  const completed = rows.filter((row) => row.status === "COMPLETED").length;

  return {
    total: rows.length,
    notStarted: rows.filter((row) => row.status === "NOT_STARTED").length,
    inProgress: rows.filter((row) => row.status === "IN_PROGRESS").length,
    completed,
    mandatory: rows.filter((row) => row.mandatory).length,
    overdue: rows.filter(
      (row) => row.mandatory && row.status !== "COMPLETED" && row.dueDate !== null && row.dueDate < today,
    ).length,
    completionRate: rows.length === 0 ? 0 : Math.round((completed / rows.length) * 100),
  };
}

export function todayInIst(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function calendarDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export async function getEmployeeDashboard(userId: string) {
  const enrollments = await prisma().enrollment.findMany({
    where: { userId },
    include: {
      assignment: {
        include: {
          moduleVersion: {
            include: {
              module: true,
              sections: { include: { lessons: { where: { required: true }, select: { id: true } } } },
            },
          },
        },
      },
      lessonProgress: { where: { completedAt: { not: null } }, select: { lessonId: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const items = enrollments.map((enrollment) => ({
    id: enrollment.id,
    title: enrollment.assignment.moduleVersion.title,
    description:
      enrollment.assignment.moduleVersion.description ?? enrollment.assignment.moduleVersion.module.description,
    status: enrollment.status,
    mandatory: enrollment.assignment.mandatory,
    dueDate: calendarDate(enrollment.assignment.dueDate),
    completedLessons: enrollment.lessonProgress.length,
    totalLessons: enrollment.assignment.moduleVersion.sections.reduce(
      (total, section) => total + section.lessons.length,
      0,
    ),
  }));

  return {
    summary: summarizeEnrollments(
      items.map((item) => ({ status: item.status, mandatory: item.mandatory, dueDate: item.dueDate })),
      todayInIst(),
    ),
    items,
  };
}

export async function getAdminDashboard() {
  const [employeeCount, activeModuleCount, assignmentCount, enrollments] = await Promise.all([
    prisma().user.count({ where: { role: "EMPLOYEE", active: true } }),
    prisma().trainingModule.count({ where: { status: "PUBLISHED" } }),
    prisma().assignment.count(),
    prisma().enrollment.findMany({
      select: { status: true, assignment: { select: { mandatory: true, dueDate: true } } },
    }),
  ]);

  const summary = summarizeEnrollments(
    enrollments.map((row) => ({
      status: row.status,
      mandatory: row.assignment.mandatory,
      dueDate: calendarDate(row.assignment.dueDate),
    })),
    todayInIst(),
  );

  return { employeeCount, activeModuleCount, assignmentCount, summary };
}

