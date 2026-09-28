"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { text } from "@/lib/action-result";
import { prisma } from "@/lib/db";
import { loadLearnerEnrollment, orderedLessons, recomputeEnrollment } from "@/lib/learning";
import { scoreQuiz, unlockedLessonIds } from "@/lib/progress";
import { requireLearner } from "@/lib/session";

async function ownedEnrollment(enrollmentId: string) {
  const user = await requireLearner();
  const loaded = await loadLearnerEnrollment(enrollmentId, user.id);
  if (!loaded) throw new Error("Not found");
  return loaded;
}

/** PDF and text lessons: the learner confirms they have read it. Videos complete via /api/progress. */
export async function markLessonComplete(formData: FormData) {
  const enrollmentId = text(formData, "enrollmentId");
  const lessonId = text(formData, "lessonId");
  const { enrollment, version, evidence } = await ownedEnrollment(enrollmentId);

  const lessons = orderedLessons(version);
  const lesson = lessons.find((row) => row.id === lessonId);
  if (!lesson || lesson.type === "VIDEO") throw new Error("This lesson cannot be marked manually.");
  if (!unlockedLessonIds(lessons, evidence.completedLessonIds, version.sequential).has(lessonId)) throw new Error("Complete earlier lessons first.");

  const now = new Date();
  await prisma().lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId, lessonId } },
    update: { completedAt: now, percentComplete: 100 },
    create: { enrollmentId, lessonId, completedAt: now, percentComplete: 100 },
  });
  await recomputeEnrollment(enrollment.id);

  const next = lessons[lessons.findIndex((row) => row.id === lessonId) + 1];
  revalidatePath("/learn", "layout");
  redirect(`/learn/${enrollmentId}${next ? `?lesson=${next.id}` : "?step=next"}`);
}

export async function submitQuiz(formData: FormData) {
  const enrollmentId = text(formData, "enrollmentId");
  const { enrollment, version, evidence } = await ownedEnrollment(enrollmentId);
  const quiz = version.quiz;
  if (!quiz || quiz.questions.length === 0) throw new Error("No quiz.");
  const done = new Set(evidence.completedLessonIds);
  if (!evidence.requiredLessonIds.every((id) => done.has(id))) throw new Error("Finish the lessons before the quiz.");

  const answers = Object.fromEntries(quiz.questions.map((question) => [question.id, text(formData, `q_${question.id}`) || undefined]));
  const result = scoreQuiz(quiz.questions, answers, quiz.passingScore);
  const attempt = await prisma().quizAttempt.create({
    data: { enrollmentId, quizId: quiz.id, score: result.score, passed: result.passed, answers: { answers, wrong: result.wrongQuestionIds } },
  });
  await recomputeEnrollment(enrollment.id);
  revalidatePath("/learn", "layout");
  redirect(`/learn/${enrollmentId}?step=quiz&attempt=${attempt.id}`);
}

export async function acknowledgePolicy(formData: FormData) {
  const enrollmentId = text(formData, "enrollmentId");
  const { enrollment, version, evidence } = await ownedEnrollment(enrollmentId);
  if (!version.policyStatement?.trim()) throw new Error("Nothing to acknowledge.");
  if (formData.get("confirm") !== "on") redirect(`/learn/${enrollmentId}?step=ack`);
  const done = new Set(evidence.completedLessonIds);
  if (!evidence.requiredLessonIds.every((id) => done.has(id)) || (evidence.hasQuiz && !evidence.quizPassed))
    throw new Error("Finish the lessons and quiz first.");

  if (!enrollment.acknowledgement) {
    await prisma().acknowledgement.create({
      data: { enrollmentId, moduleVersionId: version.id, statement: version.policyStatement },
    });
  }
  await recomputeEnrollment(enrollment.id);
  revalidatePath("/learn", "layout");
  redirect(`/learn/${enrollmentId}?step=next`);
}
