import { prisma } from "./db";
import { versionContentInclude, type VersionContent } from "./learning";

type PublishCheckVersion = Pick<VersionContent, "title" | "sections" | "quiz">;

/** Returns human-readable problems that block publishing; empty means publishable. */
export function publishProblems(version: PublishCheckVersion): string[] {
  const problems: string[] = [];
  if (!version.title.trim()) problems.push("The module needs a title.");
  const lessons = version.sections.flatMap((section) => section.lessons);
  if (lessons.length === 0) problems.push("Add at least one lesson.");
  if (lessons.length > 0 && !lessons.some((lesson) => lesson.required)) problems.push("At least one lesson must be required.");
  for (const lesson of lessons) {
    if (lesson.type === "VIDEO" && !lesson.youtubeVideoId) problems.push(`“${lesson.title}” has no YouTube video.`);
    if (lesson.type === "PDF" && !lesson.assetId) problems.push(`“${lesson.title}” has no PDF uploaded.`);
    if (lesson.type === "RICH_TEXT" && !lesson.body?.trim()) problems.push(`“${lesson.title}” has no text.`);
  }
  for (const [index, question] of (version.quiz?.questions ?? []).entries()) {
    if (question.options.length < 2) problems.push(`Quiz question ${index + 1} needs at least two options.`);
    if (question.options.filter((option) => option.isCorrect).length !== 1)
      problems.push(`Quiz question ${index + 1} needs exactly one correct answer.`);
  }
  return problems;
}

export async function loadVersion(versionId: string) {
  return prisma().moduleVersion.findUnique({ where: { id: versionId }, include: { ...versionContentInclude, module: true } });
}

/** Copy a version's content into a new draft. Assets are shared, not duplicated. */
export async function createDraftFrom(versionId: string) {
  const source = await prisma().moduleVersion.findUniqueOrThrow({ where: { id: versionId }, include: versionContentInclude });
  const latest = await prisma().moduleVersion.aggregate({ where: { moduleId: source.moduleId }, _max: { version: true } });

  return prisma().moduleVersion.create({
    data: {
      moduleId: source.moduleId,
      version: (latest._max.version ?? 0) + 1,
      title: source.title,
      description: source.description,
      policyStatement: source.policyStatement,
      sequential: source.sequential,
      sections: {
        create: source.sections.map((section) => ({
          title: section.title,
          position: section.position,
          lessons: {
            create: section.lessons.map((lesson) => ({
              title: lesson.title,
              type: lesson.type,
              position: lesson.position,
              body: lesson.body,
              sourceUrl: lesson.sourceUrl,
              youtubeVideoId: lesson.youtubeVideoId,
              required: lesson.required,
              videoDurationSeconds: lesson.videoDurationSeconds,
              requiredWatchPercentage: lesson.requiredWatchPercentage,
              assetId: lesson.assetId,
            })),
          },
        })),
      },
      quiz: source.quiz
        ? {
            create: {
              title: source.quiz.title,
              passingScore: source.quiz.passingScore,
              questions: {
                create: source.quiz.questions.map((question) => ({
                  position: question.position,
                  prompt: question.prompt,
                  type: question.type,
                  options: {
                    create: question.options.map((option) => ({
                      position: option.position,
                      label: option.label,
                      isCorrect: option.isCorrect,
                    })),
                  },
                })),
              },
            },
          }
        : undefined,
    },
  });
}

/** The version HR edits or views by default: the open draft, else the latest version. */
export async function workingVersionId(moduleId: string) {
  const versions = await prisma().moduleVersion.findMany({
    where: { moduleId },
    orderBy: { version: "desc" },
    select: { id: true, status: true },
  });
  return (versions.find((version) => version.status === "DRAFT") ?? versions[0])?.id ?? null;
}
