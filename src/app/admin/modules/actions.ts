"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attempt, requiredText, text, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { createDraftFrom, publishProblems, loadVersion } from "@/lib/modules";
import { requireAdmin } from "@/lib/session";
import { slugify, youtubeVideoId } from "@/lib/text";

function refresh() {
  revalidatePath("/admin", "layout");
}

async function draftVersion(versionId: string) {
  const version = await prisma().moduleVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new Error("Version not found.");
  if (version.status !== "DRAFT") throw new Error("Published versions are locked. Create a new version to edit.");
  return version;
}

async function draftSection(sectionId: string) {
  const section = await prisma().section.findUnique({ where: { id: sectionId }, include: { moduleVersion: true } });
  if (!section) throw new Error("Section not found.");
  if (section.moduleVersion.status !== "DRAFT") throw new Error("Published versions are locked.");
  return section;
}

async function draftLesson(lessonId: string) {
  const lesson = await prisma().lesson.findUnique({ where: { id: lessonId }, include: { section: { include: { moduleVersion: true } } } });
  if (!lesson) throw new Error("Lesson not found.");
  if (lesson.section.moduleVersion.status !== "DRAFT") throw new Error("Published versions are locked.");
  return lesson;
}

function percentField(formData: FormData) {
  const value = Number(text(formData, "requiredWatchPercentage") || 95);
  if (!Number.isInteger(value) || value < 50 || value > 100) throw new Error("Required watch % must be between 50 and 100.");
  return value;
}

function videoField(formData: FormData) {
  const url = requiredText(formData, "youtubeUrl", "YouTube link");
  const id = youtubeVideoId(url);
  if (!id) throw new Error("That does not look like a YouTube link.");
  return id;
}

/* ---------- Modules ---------- */

export async function createModule(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  let moduleId = "";
  const result = await attempt(async () => {
    const title = requiredText(formData, "title", "Title");
    const description = text(formData, "description") || null;
    const base = slugify(title);
    const taken = await prisma().trainingModule.count({ where: { slug: { startsWith: base } } });
    const created = await prisma().trainingModule.create({
      data: {
        slug: taken ? `${base}-${taken + 1}` : base,
        title,
        description,
        versions: { create: { version: 1, title, description, sections: { create: { title: "Section 1", position: 1 } } } },
      },
    });
    moduleId = created.id;
    await audit(user, "module.created", "TrainingModule", created.id, { title });
  });
  if (!moduleId) return result;
  refresh();
  redirect(`/admin/modules/${moduleId}`);
}

export async function updateDetails(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  return attempt(async () => {
    const version = await draftVersion(text(formData, "versionId"));
    const data = {
      title: requiredText(formData, "title", "Title"),
      description: text(formData, "description") || null,
      policyStatement: text(formData, "policyStatement") || null,
      sequential: formData.get("sequential") === "on",
    };
    await prisma().moduleVersion.update({ where: { id: version.id }, data });
    await audit(user, "module.draft_updated", "ModuleVersion", version.id, data);
    refresh();
    return "Details saved.";
  });
}

export async function publishVersion(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  return attempt(async () => {
    const version = await loadVersion(text(formData, "versionId"));
    if (!version || version.status !== "DRAFT") throw new Error("Only drafts can be published.");
    const problems = publishProblems(version);
    if (problems.length) throw new Error(`Fix before publishing: ${problems.join(" ")}`);

    await prisma().$transaction([
      prisma().moduleVersion.updateMany({
        where: { moduleId: version.moduleId, status: "PUBLISHED" },
        data: { status: "RETIRED" },
      }),
      prisma().moduleVersion.update({ where: { id: version.id }, data: { status: "PUBLISHED", publishedAt: new Date() } }),
      prisma().trainingModule.update({
        where: { id: version.moduleId },
        data: { status: "PUBLISHED", title: version.title, description: version.description },
      }),
    ]);
    await audit(user, "module.published", "ModuleVersion", version.id, { version: version.version });
    refresh();
    return `Version ${version.version} is live. Assign it from Assignments.`;
  });
}

export async function startNewVersion(formData: FormData) {
  const user = await requireAdmin();
  const moduleId = text(formData, "moduleId");
  const open = await prisma().moduleVersion.findFirst({ where: { moduleId, status: "DRAFT" } });
  if (!open) {
    const latest = await prisma().moduleVersion.findFirstOrThrow({ where: { moduleId }, orderBy: { version: "desc" } });
    const draft = await createDraftFrom(latest.id);
    await audit(user, "module.draft_created", "ModuleVersion", draft.id, { from: latest.version });
  }
  refresh();
  redirect(`/admin/modules/${moduleId}`);
}

export async function discardDraft(formData: FormData) {
  const user = await requireAdmin();
  const version = await draftVersion(text(formData, "versionId"));
  const others = await prisma().moduleVersion.count({ where: { moduleId: version.moduleId, id: { not: version.id } } });
  if (others === 0) {
    await prisma().trainingModule.delete({ where: { id: version.moduleId } });
    await audit(user, "module.deleted", "TrainingModule", version.moduleId, { title: version.title });
    refresh();
    redirect("/admin/modules");
  }
  await prisma().moduleVersion.delete({ where: { id: version.id } });
  await audit(user, "module.draft_discarded", "ModuleVersion", version.id, { version: version.version });
  refresh();
  redirect(`/admin/modules/${version.moduleId}`);
}

export async function setArchived(formData: FormData) {
  const user = await requireAdmin();
  const moduleId = text(formData, "moduleId");
  const archive = text(formData, "archive") === "true";
  const published = await prisma().moduleVersion.count({ where: { moduleId, status: "PUBLISHED" } });
  await prisma().trainingModule.update({
    where: { id: moduleId },
    data: { status: archive ? "ARCHIVED" : published ? "PUBLISHED" : "DRAFT" },
  });
  await audit(user, archive ? "module.archived" : "module.restored", "TrainingModule", moduleId);
  refresh();
}

/* ---------- Sections ---------- */

export async function addSection(formData: FormData) {
  await requireAdmin();
  const version = await draftVersion(text(formData, "versionId"));
  const last = await prisma().section.aggregate({ where: { moduleVersionId: version.id }, _max: { position: true } });
  const position = (last._max.position ?? 0) + 1;
  await prisma().section.create({ data: { moduleVersionId: version.id, title: `Section ${position}`, position } });
  refresh();
}

export async function renameSection(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  return attempt(async () => {
    const section = await draftSection(text(formData, "sectionId"));
    await prisma().section.update({ where: { id: section.id }, data: { title: requiredText(formData, "title", "Section title") } });
    refresh();
    return "Renamed.";
  });
}

export async function deleteSection(formData: FormData) {
  await requireAdmin();
  const section = await draftSection(text(formData, "sectionId"));
  await prisma().section.delete({ where: { id: section.id } });
  refresh();
}

/** Swap with the neighbour above/below. Uses a temporary slot to respect the unique position index. */
async function swapPositions(
  table: "section" | "lesson",
  a: { id: string; position: number },
  b: { id: string; position: number } | null,
) {
  if (!b) return;
  await prisma().$transaction(async (tx) => {
    const delegate = tx[table] as unknown as {
      update: (args: { where: { id: string }; data: { position: number } }) => Promise<unknown>;
    };
    await delegate.update({ where: { id: a.id }, data: { position: -1 } });
    await delegate.update({ where: { id: b.id }, data: { position: a.position } });
    await delegate.update({ where: { id: a.id }, data: { position: b.position } });
  });
}

export async function moveSection(formData: FormData) {
  await requireAdmin();
  const section = await draftSection(text(formData, "sectionId"));
  const up = text(formData, "direction") === "up";
  const neighbour = await prisma().section.findFirst({
    where: { moduleVersionId: section.moduleVersionId, position: up ? { lt: section.position } : { gt: section.position } },
    orderBy: { position: up ? "desc" : "asc" },
  });
  await swapPositions("section", section, neighbour);
  refresh();
}

/* ---------- Lessons ---------- */

export async function addLesson(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  return attempt(async () => {
    const section = await draftSection(text(formData, "sectionId"));
    const type = text(formData, "type");
    if (type !== "VIDEO" && type !== "RICH_TEXT") throw new Error("Choose a lesson type.");
    const title = requiredText(formData, "title", "Lesson title");
    const last = await prisma().lesson.aggregate({ where: { sectionId: section.id }, _max: { position: true } });
    const lesson = await prisma().lesson.create({
      data: {
        sectionId: section.id,
        title,
        type,
        position: (last._max.position ?? 0) + 1,
        required: formData.get("required") === "on",
        ...(type === "VIDEO"
          ? { youtubeVideoId: videoField(formData), requiredWatchPercentage: percentField(formData) }
          : { body: requiredText(formData, "body", "Lesson text") }),
      },
    });
    await audit(user, "lesson.created", "Lesson", lesson.id, { title, type });
    refresh();
    return "Lesson added.";
  });
}

export async function updateLesson(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  const user = await requireAdmin();
  return attempt(async () => {
    const lesson = await draftLesson(text(formData, "lessonId"));
    const data: Record<string, unknown> = {
      title: requiredText(formData, "title", "Lesson title"),
      required: formData.get("required") === "on",
    };
    if (lesson.type === "VIDEO") data.requiredWatchPercentage = percentField(formData);
    // Uploaded-video lessons (assetId) change their file through /api/files/video instead.
    if (lesson.type === "VIDEO" && !lesson.assetId) {
      const id = videoField(formData);
      data.youtubeVideoId = id;
      if (id !== lesson.youtubeVideoId) data.videoDurationSeconds = null;
    }
    if (lesson.type === "RICH_TEXT") data.body = requiredText(formData, "body", "Lesson text");
    await prisma().lesson.update({ where: { id: lesson.id }, data });
    await audit(user, "lesson.updated", "Lesson", lesson.id, { title: data.title as string });
    refresh();
    return "Lesson saved.";
  });
}

export async function deleteLesson(formData: FormData) {
  const user = await requireAdmin();
  const lesson = await draftLesson(text(formData, "lessonId"));
  await prisma().lesson.delete({ where: { id: lesson.id } });
  await audit(user, "lesson.deleted", "Lesson", lesson.id, { title: lesson.title });
  refresh();
}

export async function moveLesson(formData: FormData) {
  await requireAdmin();
  const lesson = await draftLesson(text(formData, "lessonId"));
  const up = text(formData, "direction") === "up";
  const neighbour = await prisma().lesson.findFirst({
    where: { sectionId: lesson.sectionId, position: up ? { lt: lesson.position } : { gt: lesson.position } },
    orderBy: { position: up ? "desc" : "asc" },
  });
  await swapPositions("lesson", lesson, neighbour);
  refresh();
}

/* ---------- Quiz ---------- */

async function ensureQuiz(versionId: string) {
  await draftVersion(versionId);
  return prisma().quiz.upsert({
    where: { moduleVersionId: versionId },
    update: {},
    create: { moduleVersionId: versionId, title: "Knowledge check", passingScore: 80 },
  });
}

export async function saveQuizSettings(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  return attempt(async () => {
    const quiz = await ensureQuiz(text(formData, "versionId"));
    const passingScore = Number(text(formData, "passingScore"));
    if (!Number.isInteger(passingScore) || passingScore < 1 || passingScore > 100) throw new Error("Pass mark must be 1–100%.");
    await prisma().quiz.update({ where: { id: quiz.id }, data: { passingScore } });
    refresh();
    return "Pass mark saved.";
  });
}

function questionInput(formData: FormData) {
  const prompt = requiredText(formData, "prompt", "Question");
  const type = text(formData, "type") === "TRUE_FALSE" ? "TRUE_FALSE" : "SINGLE_CHOICE";
  const correct = Number(text(formData, "correct"));
  const labels =
    type === "TRUE_FALSE"
      ? ["True", "False"]
      : [0, 1, 2, 3, 4, 5].map((index) => text(formData, `option_${index}`));

  const options = labels
    .map((label, index) => ({ label, isCorrect: index === correct }))
    .filter((option) => option.label);
  if (options.length < 2) throw new Error("Give at least two answer options.");
  if (!options.some((option) => option.isCorrect)) throw new Error("Mark the correct answer.");
  return { prompt, type, options: options.map((option, index) => ({ ...option, position: index + 1 })) } as const;
}

export async function addQuestion(_previous: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  return attempt(async () => {
    const quiz = await ensureQuiz(text(formData, "versionId"));
    const input = questionInput(formData);
    const last = await prisma().question.aggregate({ where: { quizId: quiz.id }, _max: { position: true } });
    await prisma().question.create({
      data: {
        quizId: quiz.id,
        position: (last._max.position ?? 0) + 1,
        prompt: input.prompt,
        type: input.type,
        options: { create: input.options },
      },
    });
    refresh();
    return "Question added.";
  });
}

export async function deleteQuestion(formData: FormData) {
  await requireAdmin();
  const question = await prisma().question.findUniqueOrThrow({ where: { id: text(formData, "questionId") }, include: { quiz: true } });
  await draftVersion(question.quiz.moduleVersionId);
  await prisma().question.delete({ where: { id: question.id } });
  refresh();
}
