export type EnrollmentProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export function deriveEnrollmentStatus(
  requiredLessonCount: number,
  completedLessonCount: number,
  quizPassed: boolean,
  acknowledgementRequired: boolean,
  acknowledged: boolean,
): EnrollmentProgressStatus {
  if (completedLessonCount === 0) return "NOT_STARTED";

  const lessonsComplete = completedLessonCount >= requiredLessonCount;
  const acknowledgementComplete = !acknowledgementRequired || acknowledged;

  return lessonsComplete && quizPassed && acknowledgementComplete ? "COMPLETED" : "IN_PROGRESS";
}

