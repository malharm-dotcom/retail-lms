import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { PageHeader, StatusPill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { loadVersion, publishProblems, workingVersionId } from "@/lib/modules";
import { requireAdminPage } from "@/lib/session";
import { formatDate, formatDuration } from "@/lib/text";
import {
  addSection,
  deleteLesson,
  deleteQuestion,
  deleteSection,
  discardDraft,
  moveLesson,
  moveSection,
  publishVersion,
  renameSection,
  saveQuizSettings,
  setArchived,
  startNewVersion,
  updateDetails,
  updateLesson,
} from "../actions";
import { AddLessonForm, PdfUploadForm, QuestionForm, RichTextHelp, VideoUploadForm } from "./builder-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Module" };

const TYPE_LABEL = { VIDEO: "Video", PDF: "PDF", RICH_TEXT: "Text" } as const;

function MoveButtons({ action, idName, id }: { action: (formData: FormData) => Promise<void>; idName: string; id: string }) {
  return (
    <>
      <form action={action}>
        <input type="hidden" name={idName} value={id} />
        <input type="hidden" name="direction" value="up" />
        <button className="btn btn-ghost btn-small" type="submit" aria-label="Move up" title="Move up">↑</button>
      </form>
      <form action={action}>
        <input type="hidden" name={idName} value={id} />
        <input type="hidden" name="direction" value="down" />
        <button className="btn btn-ghost btn-small" type="submit" aria-label="Move down" title="Move down">↓</button>
      </form>
    </>
  );
}

export default async function ModuleBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const user = await requireAdminPage();
  const { id } = await params;
  const { v } = await searchParams;

  const trainingModule = await prisma().trainingModule.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: "desc" }, select: { id: true, version: true, status: true } } },
  });
  if (!trainingModule) notFound();

  const versionId = v && trainingModule.versions.some((row) => row.id === v) ? v : await workingVersionId(trainingModule.id);
  const version = versionId ? await loadVersion(versionId) : null;
  if (!version) notFound();

  const editable = version.status === "DRAFT";
  const hasDraft = trainingModule.versions.some((row) => row.status === "DRAFT");
  const problems = publishProblems(version);
  const lessonCount = version.sections.reduce((sum, section) => sum + section.lessons.length, 0);
  const [assignmentCount, learnerCount] = await Promise.all([
    prisma().assignment.count({ where: { moduleVersion: { moduleId: trainingModule.id } } }),
    prisma().enrollment.count({ where: { assignment: { moduleVersion: { moduleId: trainingModule.id } } } }),
  ]);

  return (
    <AppShell active="modules" user={user}>
      <PageHeader
        back={{ href: "/admin/modules", label: "All modules" }}
        eyebrow={`Module · version ${version.version}`}
        title={version.title}
        lede={
          editable
            ? "You are editing a draft. Employees see nothing until you publish."
            : `This version is ${version.status.toLowerCase()} and locked${version.publishedAt ? ` (published ${formatDate(version.publishedAt)})` : ""}. Start a new version to make changes.`
        }
        actions={
          <>
            <StatusPill status={version.status} />
            {!editable && !hasDraft && trainingModule.status !== "ARCHIVED" ? (
              <form action={startNewVersion}>
                <input type="hidden" name="moduleId" value={trainingModule.id} />
                <SubmitButton variant="secondary" pendingLabel="Copying…">Edit as new version</SubmitButton>
              </form>
            ) : null}
            {version.status === "PUBLISHED" ? (
              <Link className="btn btn-primary" href={`/admin/assignments?module=${version.id}`}>
                Assign
              </Link>
            ) : null}
          </>
        }
      />

      <div className="two-col">
        <div className="stack">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">01 · Details</p>
                <h2>About this module</h2>
              </div>
            </div>
            <div className="panel-body">
              {editable ? (
                <ActionForm action={updateDetails} className="form-grid">
                  <input type="hidden" name="versionId" value={version.id} />
                  <label className="field span-2">
                    <span>Title</span>
                    <input name="title" defaultValue={version.title} required maxLength={120} />
                  </label>
                  <label className="field span-2">
                    <span>Description</span>
                    <textarea name="description" rows={3} style={{ minHeight: 80 }} defaultValue={version.description ?? ""} />
                  </label>
                  <label className="field span-2">
                    <span>Policy acknowledgement (optional)</span>
                    <textarea
                      name="policyStatement"
                      rows={3}
                      style={{ minHeight: 80 }}
                      defaultValue={version.policyStatement ?? ""}
                      placeholder="e.g. I have read and will follow the cash handling policy."
                    />
                    <small>If filled, employees must confirm this statement to complete the module. The exact wording is stored with their record.</small>
                  </label>
                  <label className="check span-2">
                    <input type="checkbox" name="sequential" defaultChecked={version.sequential} />
                    <span>Lessons must be completed in order</span>
                  </label>
                  <div className="form-actions span-2">
                    <SubmitButton variant="secondary">Save details</SubmitButton>
                  </div>
                </ActionForm>
              ) : (
                <dl className="key-list">
                  <div><dt>Description</dt><dd>{version.description ?? "—"}</dd></div>
                  <div><dt>Policy acknowledgement</dt><dd>{version.policyStatement ?? "None"}</dd></div>
                  <div><dt>Lesson order</dt><dd>{version.sequential ? "Enforced" : "Free"}</dd></div>
                </dl>
              )}
            </div>
          </section>

          <section>
            <div className="panel-heading" style={{ border: 0, padding: "0 0 14px" }}>
              <div>
                <p className="eyebrow">02 · Content</p>
                <h2>
                  {version.sections.length} section{version.sections.length === 1 ? "" : "s"} · {lessonCount} lesson{lessonCount === 1 ? "" : "s"}
                </h2>
              </div>
              {editable ? (
                <form action={addSection}>
                  <input type="hidden" name="versionId" value={version.id} />
                  <SubmitButton variant="secondary" pendingLabel="Adding…">+ Add section</SubmitButton>
                </form>
              ) : null}
            </div>

            {version.sections.map((section, sectionIndex) => (
              <div className="builder-section" key={section.id}>
                <div className="builder-section-head">
                  <span className="section-index">{String(sectionIndex + 1).padStart(2, "0")}</span>
                  {editable ? (
                    <>
                      <ActionForm action={renameSection}>
                        <input type="hidden" name="sectionId" value={section.id} />
                        <input name="title" defaultValue={section.title} aria-label="Section title" required />
                        <SubmitButton variant="ghost" pendingLabel="…">Rename</SubmitButton>
                      </ActionForm>
                      <div className="lesson-tools">
                        <MoveButtons action={moveSection} idName="sectionId" id={section.id} />
                        <form action={deleteSection}>
                          <input type="hidden" name="sectionId" value={section.id} />
                          <ConfirmButton variant="ghost" message={`Delete “${section.title}” and its ${section.lessons.length} lesson(s)?`}>
                            Delete
                          </ConfirmButton>
                        </form>
                      </div>
                    </>
                  ) : (
                    <strong style={{ fontFamily: "var(--display)", fontSize: 20, fontWeight: 400 }}>{section.title}</strong>
                  )}
                </div>

                {section.lessons.length === 0 ? <p className="panel-note" style={{ padding: "14px 16px", margin: 0 }}>No lessons in this section yet.</p> : null}

                {section.lessons.map((lesson, lessonIndex) => (
                  <details className="lesson-item" key={lesson.id}>
                    <summary>
                      <span className="lesson-num">{lessonIndex + 1}</span>
                      <span className={`type-badge type-${lesson.type.toLowerCase().replace("_", "-")}`}>{TYPE_LABEL[lesson.type]}</span>
                      <span className="lesson-title">
                        {lesson.title}
                        <small>
                          {lesson.type === "VIDEO"
                            ? `${lesson.videoDurationSeconds ? formatDuration(lesson.videoDurationSeconds) : "Length detected on first play"} · watch ${lesson.requiredWatchPercentage}%`
                            : lesson.type === "PDF"
                              ? (lesson.asset?.fileName ?? "No file")
                              : `${(lesson.body ?? "").split(/\s+/).filter(Boolean).length} words`}
                          {lesson.required ? "" : " · optional"}
                        </small>
                      </span>
                      <span className="lesson-tools">
                        {editable ? <MoveButtons action={moveLesson} idName="lessonId" id={lesson.id} /> : null}
                        <span className="btn btn-ghost btn-small">{editable ? "Edit" : "View"}</span>
                      </span>
                    </summary>
                    <div className="lesson-edit">
                      {lesson.type === "VIDEO" && lesson.youtubeVideoId ? (
                        <p className="panel-note">
                          Video:{" "}
                          <a className="text-link" href={`https://www.youtube.com/watch?v=${lesson.youtubeVideoId}`} target="_blank" rel="noreferrer">
                            open on YouTube ↗
                          </a>
                        </p>
                      ) : null}
                      {lesson.type === "VIDEO" && lesson.asset ? (
                        <p className="panel-note">
                          Uploaded video:{" "}
                          <a className="text-link" href={`/api/files/${lesson.asset.id}`} target="_blank" rel="noreferrer">
                            {lesson.asset.fileName} ↗
                          </a>{" "}
                          ({(lesson.asset.sizeBytes / 1024 / 1024).toFixed(1)} MB)
                        </p>
                      ) : null}
                      {lesson.type === "PDF" && lesson.asset ? (
                        <p className="panel-note">
                          File:{" "}
                          <a className="text-link" href={`/api/files/${lesson.asset.id}`} target="_blank" rel="noreferrer">
                            {lesson.asset.fileName} ↗
                          </a>{" "}
                          ({(lesson.asset.sizeBytes / 1024 / 1024).toFixed(1)} MB)
                        </p>
                      ) : null}
                      {editable ? (
                        <div className="form-stack">
                          <ActionForm action={updateLesson} className="form-grid">
                            <input type="hidden" name="lessonId" value={lesson.id} />
                            <label className="field span-2">
                              <span>Lesson title</span>
                              <input name="title" defaultValue={lesson.title} required maxLength={140} />
                            </label>
                            {lesson.type === "VIDEO" && lesson.asset ? (
                              <label className="field">
                                <span>Required watch %</span>
                                <input name="requiredWatchPercentage" type="number" min={50} max={100} defaultValue={lesson.requiredWatchPercentage} />
                              </label>
                            ) : lesson.type === "VIDEO" ? (
                              <>
                                <label className="field">
                                  <span>YouTube link</span>
                                  <input name="youtubeUrl" defaultValue={lesson.youtubeVideoId ? `https://youtu.be/${lesson.youtubeVideoId}` : ""} required />
                                </label>
                                <label className="field">
                                  <span>Required watch %</span>
                                  <input name="requiredWatchPercentage" type="number" min={50} max={100} defaultValue={lesson.requiredWatchPercentage} />
                                </label>
                              </>
                            ) : null}
                            {lesson.type === "RICH_TEXT" ? (
                              <label className="field span-2">
                                <span>Lesson text</span>
                                <textarea name="body" rows={10} defaultValue={lesson.body ?? ""} required />
                                <RichTextHelp />
                              </label>
                            ) : null}
                            <label className="check span-2">
                              <input type="checkbox" name="required" defaultChecked={lesson.required} />
                              <span>Required to complete the module</span>
                            </label>
                            <div className="form-actions span-2">
                              <SubmitButton variant="secondary">Save lesson</SubmitButton>
                            </div>
                          </ActionForm>
                          {lesson.type === "PDF" ? <PdfUploadForm lessonId={lesson.id} /> : null}
                          {lesson.type === "VIDEO" && lesson.asset ? <VideoUploadForm lessonId={lesson.id} /> : null}
                          <form action={deleteLesson}>
                            <input type="hidden" name="lessonId" value={lesson.id} />
                            <ConfirmButton message={`Delete the lesson “${lesson.title}”?`}>Delete lesson</ConfirmButton>
                          </form>
                        </div>
                      ) : lesson.type === "RICH_TEXT" ? (
                        <p style={{ whiteSpace: "pre-line", margin: 0 }}>{lesson.body}</p>
                      ) : null}
                    </div>
                  </details>
                ))}

                {editable ? <AddLessonForm sectionId={section.id} /> : null}
              </div>
            ))}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">03 · Assessment</p>
                <h2>Quiz {version.quiz?.questions.length ? `· ${version.quiz.questions.length} question${version.quiz.questions.length === 1 ? "" : "s"}` : ""}</h2>
              </div>
              {editable ? (
                <ActionForm action={saveQuizSettings} className="form-actions">
                  <input type="hidden" name="versionId" value={version.id} />
                  <label className="field" style={{ gridTemplateColumns: "auto 80px", alignItems: "center", display: "grid" }}>
                    <span>Pass mark %</span>
                    <input name="passingScore" type="number" min={1} max={100} defaultValue={version.quiz?.passingScore ?? 80} />
                  </label>
                  <SubmitButton variant="ghost">Save</SubmitButton>
                </ActionForm>
              ) : version.quiz ? (
                <span className="tag">Pass mark {version.quiz.passingScore}%</span>
              ) : null}
            </div>
            {version.quiz?.questions.length ? (
              <div>
                {version.quiz.questions.map((question, index) => (
                  <div className="question-card" key={question.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                      <strong>
                        {index + 1}. {question.prompt}
                      </strong>
                      {editable ? (
                        <form action={deleteQuestion}>
                          <input type="hidden" name="questionId" value={question.id} />
                          <ConfirmButton variant="ghost" message="Remove this question?">Remove</ConfirmButton>
                        </form>
                      ) : null}
                    </div>
                    <ol type="a">
                      {question.options.map((option) => (
                        <li key={option.id} className={option.isCorrect ? "correct" : ""}>
                          {option.label} {option.isCorrect ? "✓" : ""}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-note" style={{ padding: "18px 22px 0" }}>
                No quiz. The module completes once lessons{version.policyStatement ? " and the acknowledgement" : ""} are done.
              </p>
            )}
            {editable ? (
              <div className="panel-body" style={{ borderTop: version.quiz?.questions.length ? "1px solid var(--line)" : 0 }}>
                <QuestionForm versionId={version.id} />
              </div>
            ) : null}
          </section>
        </div>

        <aside className="stack sticky">
          {editable ? (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Publish</p>
                  <h2>{problems.length ? "Not ready yet" : "Ready to publish"}</h2>
                </div>
              </div>
              <div className="panel-body form-stack">
                {problems.length ? (
                  <div className="callout">
                    <strong>Before publishing:</strong>
                    <ul>
                      {problems.map((problem) => (
                        <li key={problem}>{problem}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="callout is-good">
                    {version.version > 1
                      ? "Publishing replaces the live version for new assignments. Existing learners keep the version they were assigned."
                      : "Once published, the content is locked and can be assigned."}
                  </div>
                )}
                <ActionForm action={publishVersion} className="form-stack" confirm="Publish this version? Its content will be locked.">
                  <input type="hidden" name="versionId" value={version.id} />
                  <SubmitButton pendingLabel="Publishing…">Publish version {version.version}</SubmitButton>
                </ActionForm>
                <form action={discardDraft}>
                  <input type="hidden" name="versionId" value={version.id} />
                  <ConfirmButton message={trainingModule.versions.length === 1 ? "Delete this module permanently?" : "Discard this draft? Published versions are not affected."}>
                    {trainingModule.versions.length === 1 ? "Delete this module" : "Discard this draft"}
                  </ConfirmButton>
                </form>
              </div>
            </section>
          ) : null}

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Record</p>
                <h2>Usage</h2>
              </div>
            </div>
            <div className="panel-body">
              <dl className="key-list">
                <div><dt>Module status</dt><dd><StatusPill status={trainingModule.status} /></dd></div>
                <div><dt>Assignments</dt><dd>{assignmentCount}</dd></div>
                <div><dt>Learners enrolled</dt><dd>{learnerCount}</dd></div>
              </dl>
              <div className="version-strip" aria-label="Versions">
                {trainingModule.versions.map((row) => (
                  <Link key={row.id} className={row.id === version.id ? "current" : ""} href={`/admin/modules/${trainingModule.id}?v=${row.id}`}>
                    v{row.version} · {row.status.toLowerCase()}
                  </Link>
                ))}
              </div>
              {trainingModule.versions.some((row) => row.status !== "DRAFT") ? (
                <form action={setArchived} style={{ marginTop: 18 }}>
                  <input type="hidden" name="moduleId" value={trainingModule.id} />
                  <input type="hidden" name="archive" value={trainingModule.status === "ARCHIVED" ? "false" : "true"} />
                  <button className="btn btn-secondary btn-small" type="submit">
                    {trainingModule.status === "ARCHIVED" ? "Restore module" : "Archive module"}
                  </button>
                  <p className="panel-note" style={{ marginTop: 8 }}>
                    {trainingModule.status === "ARCHIVED"
                      ? "Archived modules cannot be assigned. Existing records stay."
                      : "Archiving hides it from new assignments; learners keep their records."}
                  </p>
                </form>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
