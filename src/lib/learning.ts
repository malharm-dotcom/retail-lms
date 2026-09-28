import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { evaluateEnrollment, progressPercent, type EnrollmentEvidence } from "./progress";

export const versionContentInclude = {
  sections: {
    orderBy: { position: "asc" },
    include: {
      lessons: {
        orderBy: { position: "asc" },
        include: { asset: { select: { id: true, fileName: true, sizeBytes: true, mimeType: true } } },
      },
    },
  },
  quiz: { include: { questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } } } },
} satisfies Prisma.ModuleVersionInclude;

export type VersionContent = Prisma.ModuleVersionGetPayload<{ include: typeof versionContentInclude }>;

export function orderedLessons(version: Pick<VersionContent, "sections">) {
  return version.sections.flatMap((section) => section.lessons.map((lesson) => ({ ...lesson, sectionTitle: section.title })));
}

export function hasQuiz(version: Pick<VersionContent, "quiz">): boolean {
  return Boolean(version.quiz && version.quiz.questions.length > 0);
}

export function needsAcknowledgement(version: { policyStatement: string | null }): boolean {
  return Boolean(version.policyStatement?.trim());
}

const enrollmentEvidenceInclude = {
  lessonProgress: { select: { lessonId: true, completedAt: true, watchedSeconds: true, percentComplete: true } },
  quizAttempts: { select: { passed: true, score: true } },
  acknowledgement: { select: { id: true } },
} satisfies Prisma.EnrollmentInclude;

type EvidenceSource = Prisma.EnrollmentGetPayload<{ include: typeof enrollmentEvidenceInclude }>;

export function evidenceFor(enrollment: EvidenceSource, version: VersionContent): EnrollmentEvidence {
  return {
    requiredLessonIds: orderedLessons(version)
      .filter((lesson) => lesson.required)
      .map((lesson) => lesson.id),
    completedLessonIds: enrollment.lessonProgress.filter((row) => row.completedAt).map((row) => row.lessonId),
    hasQuiz: hasQuiz(version),
    quizPassed: enrollment.quizAttempts.some((attempt) => attempt.passed),
    needsAcknowledgement: needsAcknowledgement(version),
    acknowledged: Boolean(enrollment.acknowledgement),
    anyActivity:
      enrollment.lessonProgress.some((row) => row.watchedSeconds > 0 || row.percentComplete > 0) ||
      enrollment.quizAttempts.length > 0,
  };
}

/** Load an enrollment the given user owns, with everything the player needs. */
export async function loadLearnerEnrollment(enrollmentId: string, userId: string) {
  const enrollment = await prisma().enrollment.findFirst({
    where: { id: enrollmentId, userId },
    include: {
      ...enrollmentEvidenceInclude,
      lessonProgress: true,
      quizAttempts: { orderBy: { completedAt: "desc" } },
      acknowledgement: true,
      assignment: { include: { moduleVersion: { include: versionContentInclude } } },
    },
  });
  if (!enrollment) return null;
  const version = enrollment.assignment.moduleVersion;
  const evidence = evidenceFor(enrollment, version);
  return { enrollment, version, evidence, percent: progressPercent(evidence) };
}

/** Server-side source of truth for enrollment status. Call after every learner event. */
export async function recomputeEnrollment(enrollmentId: string) {
  const enrollment = await prisma().enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { ...enrollmentEvidenceInclude, assignment: { include: { moduleVersion: { include: versionContentInclude } } } },
  });
  const status = evaluateEnrollment(evidenceFor(enrollment, enrollment.assignment.moduleVersion));
  const now = new Date();
  await prisma().enrollment.update({
    where: { id: enrollmentId },
    data: {
      status,
      startedAt: status === "NOT_STARTED" ? enrollment.startedAt : (enrollment.startedAt ?? now),
      completedAt: status === "COMPLETED" ? (enrollment.completedAt ?? now) : null,
    },
  });
  return status;
}

type AudienceAssignment = {
  target: "ALL_EMPLOYEES" | "STORE" | "DEPARTMENT" | "INDIVIDUAL";
  storeId: string | null;
  departmentId: string | null;
  targetUserId: string | null;
};

export function audienceWhere(assignment: AudienceAssignment): Prisma.UserWhereInput {
  switch (assignment.target) {
    case "ALL_EMPLOYEES":
      return { active: true, role: "EMPLOYEE" };
    case "STORE":
      return { active: true, role: "EMPLOYEE", storeId: assignment.storeId ?? "__none__" };
    case "DEPARTMENT":
      return { active: true, role: "EMPLOYEE", departmentId: assignment.departmentId ?? "__none__" };
    case "INDIVIDUAL":
      return { active: true, id: assignment.targetUserId ?? "__none__" };
  }
}

/**
 * Materialise one enrollment per audience member. A learner already enrolled in the
 * same module version through another assignment is skipped, so nobody does it twice.
 */
export async function enrollAudience(assignmentId: string, onlyUserIds?: string[]) {
  const assignment = await prisma().assignment.findUniqueOrThrow({ where: { id: assignmentId } });
  const users = await prisma().user.findMany({
    where: { AND: [audienceWhere(assignment), onlyUserIds ? { id: { in: onlyUserIds } } : {}] },
    select: { id: true },
  });
  if (users.length === 0) return [];

  const already = await prisma().enrollment.findMany({
    where: { userId: { in: users.map((user) => user.id) }, assignment: { moduleVersionId: assignment.moduleVersionId } },
    select: { userId: true },
  });
  const skip = new Set(already.map((row) => row.userId));
  const userIds = users.map((user) => user.id).filter((id) => !skip.has(id));
  if (userIds.length === 0) return [];

  await prisma().enrollment.createMany({
    data: userIds.map((userId) => ({ assignmentId, userId })),
    skipDuplicates: true,
  });
  return userIds;
}

/** New or moved employees pick up open group assignments (all, their store, their department). */
export async function enrollIntoOpenAssignments(userIds: string[]) {
  if (userIds.length === 0) return;
  const assignments = await prisma().assignment.findMany({
    where: {
      target: { not: "INDIVIDUAL" },
      moduleVersion: { module: { status: { not: "ARCHIVED" } } },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  for (const assignment of assignments) await enrollAudience(assignment.id, userIds);
}
