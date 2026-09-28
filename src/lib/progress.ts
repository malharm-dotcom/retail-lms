export type EnrollmentProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export type EnrollmentEvidence = {
  requiredLessonIds: string[];
  completedLessonIds: string[];
  hasQuiz: boolean;
  quizPassed: boolean;
  needsAcknowledgement: boolean;
  acknowledged: boolean;
  anyActivity: boolean;
};

export function evaluateEnrollment(evidence: EnrollmentEvidence): EnrollmentProgressStatus {
  const done = new Set(evidence.completedLessonIds);
  const lessonsComplete = evidence.requiredLessonIds.every((id) => done.has(id));
  const quizComplete = !evidence.hasQuiz || evidence.quizPassed;
  const ackComplete = !evidence.needsAcknowledgement || evidence.acknowledged;

  if (lessonsComplete && quizComplete && ackComplete && evidence.requiredLessonIds.length > 0) return "COMPLETED";
  return evidence.anyActivity || done.size > 0 ? "IN_PROGRESS" : "NOT_STARTED";
}

/** Share of the module finished, counting the quiz and acknowledgement as one step each. */
export function progressPercent(evidence: EnrollmentEvidence): number {
  const done = new Set(evidence.completedLessonIds);
  let total = evidence.requiredLessonIds.length;
  let complete = evidence.requiredLessonIds.filter((id) => done.has(id)).length;
  if (evidence.hasQuiz) {
    total += 1;
    if (evidence.quizPassed) complete += 1;
  }
  if (evidence.needsAcknowledgement) {
    total += 1;
    if (evidence.acknowledged) complete += 1;
  }
  return total === 0 ? 0 : Math.round((complete / total) * 100);
}

/**
 * In sequential modules a lesson unlocks once every earlier required lesson is complete.
 * Returns the ids of lessons the learner may open.
 */
export function unlockedLessonIds(
  orderedLessons: { id: string; required: boolean }[],
  completedLessonIds: string[],
  sequential: boolean,
): Set<string> {
  if (!sequential) return new Set(orderedLessons.map((lesson) => lesson.id));
  const done = new Set(completedLessonIds);
  const unlocked = new Set<string>();
  for (const lesson of orderedLessons) {
    unlocked.add(lesson.id);
    if (lesson.required && !done.has(lesson.id)) break;
  }
  return unlocked;
}

export type Range = [number, number];

/** Merge overlapping or touching [start, end] second ranges. */
export function mergeRanges(ranges: Range[]): Range[] {
  const sorted = ranges
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .map(([start, end]) => [Math.max(0, start), end] as Range)
    .sort((a, b) => a[0] - b[0]);
  const merged: Range[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1] + 0.5) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }
  return merged;
}

export function coveredSeconds(ranges: Range[], durationSeconds?: number | null): number {
  const cap = durationSeconds && durationSeconds > 0 ? durationSeconds : Infinity;
  return Math.round(
    mergeRanges(ranges).reduce((total, [start, end]) => total + Math.max(0, Math.min(end, cap) - Math.min(start, cap)), 0),
  );
}

export function videoPercent(watched: number, durationSeconds: number | null | undefined): number {
  if (!durationSeconds || durationSeconds <= 0) return 0;
  return Math.min(100, Math.floor((watched / durationSeconds) * 100));
}

export type QuizQuestionKey = { id: string; options: { id: string; isCorrect: boolean }[] };

export function scoreQuiz(questions: QuizQuestionKey[], answers: Record<string, string | undefined>, passingScore: number) {
  const wrongQuestionIds: string[] = [];
  let correct = 0;
  for (const question of questions) {
    const chosen = question.options.find((option) => option.id === answers[question.id]);
    if (chosen?.isCorrect) correct += 1;
    else wrongQuestionIds.push(question.id);
  }
  const score = questions.length === 0 ? 0 : Math.round((correct / questions.length) * 100);
  return { score, correct, total: questions.length, passed: score >= passingScore, wrongQuestionIds };
}
