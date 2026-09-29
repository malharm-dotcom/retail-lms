import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/forms";
import { RichText } from "@/components/rich-text";
import { Meter } from "@/components/ui";
import { todayInIst } from "@/lib/dashboard";
import { loadLearnerEnrollment, orderedLessons } from "@/lib/learning";
import { unlockedLessonIds } from "@/lib/progress";
import { requireCurrentUser } from "@/lib/session";
import { formatDate, formatDateTime } from "@/lib/text";
import { acknowledgePolicy, markLessonComplete, submitQuiz } from "../actions";
import { VideoLesson } from "./video-lesson";

export const dynamic = "force-dynamic";

const TYPE_LABEL = { VIDEO: "Video", PDF: "Document", RICH_TEXT: "Reading" } as const;

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string; step?: string; attempt?: string }>;
}) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const query = await searchParams;

  const loaded = await loadLearnerEnrollment(id, user.id);
  if (!loaded) notFound();
  const { enrollment, version, evidence, percent } = loaded;

  const lessons = orderedLessons(version);
  const done = new Set(evidence.completedLessonIds);
  const unlocked = unlockedLessonIds(lessons, evidence.completedLessonIds, version.sequential);
  const lessonsDone = evidence.requiredLessonIds.every((lessonId) => done.has(lessonId));
  const quizOpen = evidence.hasQuiz && lessonsDone;
  const ackOpen = evidence.needsAcknowledgement && lessonsDone && (!evidence.hasQuiz || evidence.quizPassed);
  const completed = enrollment.status === "COMPLETED";

  // Resolve "what next" into a concrete view.
  if (!query.lesson && (!query.step || query.step === "next")) {
    const nextLesson = lessons.find((lesson) => lesson.required && !done.has(lesson.id) && unlocked.has(lesson.id));
    if (nextLesson) redirect(`/learn/${id}?lesson=${nextLesson.id}`);
    if (evidence.hasQuiz && !evidence.quizPassed) redirect(`/learn/${id}?step=quiz`);
    if (evidence.needsAcknowledgement && !evidence.acknowledged) redirect(`/learn/${id}?step=ack`);
    if (!completed && lessons[0]) redirect(`/learn/${id}?lesson=${lessons[0].id}`);
  }

  const view = query.lesson ? "lesson" : query.step === "quiz" ? "quiz" : query.step === "ack" ? "ack" : "done";
  const lessonIndex = lessons.findIndex((lesson) => lesson.id === query.lesson);
  const lesson = lessonIndex >= 0 ? lessons[lessonIndex] : null;
  if (view === "lesson" && !lesson) notFound();

  const due = enrollment.assignment.dueDate?.toISOString().slice(0, 10) ?? null;
  const overdue = !completed && due !== null && due < todayInIst();
  const bestScore = enrollment.quizAttempts.length ? Math.max(...enrollment.quizAttempts.map((row) => row.score)) : null;

  return (
    <AppShell active="learn" user={user}>
      <Link className="back-link" href="/learn">
        ← My learning
      </Link>
      <div className="player">
        <aside className="outline" aria-label="Module outline">
          <div className="outline-head">
            <p className="eyebrow">{enrollment.assignment.mandatory ? "Mandatory" : "Optional"} module</p>
            <h2>{version.title}</h2>
            <Meter value={percent} />
            <p className={`queue-due${overdue ? " is-overdue" : ""}`} style={{ margin: "10px 0 0" }}>
              {completed ? `Completed ${formatDate(enrollment.completedAt)}` : due ? `${overdue ? "Overdue · was due" : "Due"} ${formatDate(due)}` : "No due date"}
            </p>
          </div>
          {version.sections.map((section) => (
            <div className="outline-section" key={section.id}>
              <p>{section.title}</p>
              {section.lessons.map((row) => {
                const isDone = done.has(row.id);
                const open = unlocked.has(row.id);
                const mark = <span className={`outline-mark${isDone ? " is-done" : open ? "" : " is-locked"}`}>{isDone ? "✓" : ""}</span>;
                return open ? (
                  <Link key={row.id} href={`/learn/${id}?lesson=${row.id}`} className={row.id === lesson?.id ? "current" : ""}>
                    {mark}
                    <span>
                      {row.title}
                      {row.required ? "" : <span className="muted"> · optional</span>}
                    </span>
                  </Link>
                ) : (
                  <span key={row.id} className="locked" title="Complete the previous lesson first">
                    {mark}
                    <span>{row.title}</span>
                  </span>
                );
              })}
            </div>
          ))}
          {evidence.hasQuiz || evidence.needsAcknowledgement ? (
            <div className="outline-steps">
              {evidence.hasQuiz ? (
                quizOpen ? (
                  <Link href={`/learn/${id}?step=quiz`} className={view === "quiz" ? "current" : ""}>
                    <span className={`outline-mark${evidence.quizPassed ? " is-done" : ""}`}>{evidence.quizPassed ? "✓" : ""}</span>
                    <span>Quiz{bestScore !== null ? ` · best ${bestScore}%` : ""}</span>
                  </Link>
                ) : (
                  <span className="locked">
                    <span className="outline-mark is-locked" />
                    <span>Quiz</span>
                  </span>
                )
              ) : null}
              {evidence.needsAcknowledgement ? (
                ackOpen ? (
                  <Link href={`/learn/${id}?step=ack`} className={view === "ack" ? "current" : ""}>
                    <span className={`outline-mark${evidence.acknowledged ? " is-done" : ""}`}>{evidence.acknowledged ? "✓" : ""}</span>
                    <span>Acknowledgement</span>
                  </Link>
                ) : (
                  <span className="locked">
                    <span className="outline-mark is-locked" />
                    <span>Acknowledgement</span>
                  </span>
                )
              ) : null}
            </div>
          ) : null}
        </aside>

        <section className="stage">
          {view === "lesson" && lesson ? (
            <LessonStage
              enrollmentId={id}
              lesson={lesson}
              position={lessonIndex + 1}
              total={lessons.length}
              isOpen={unlocked.has(lesson.id)}
              isDone={done.has(lesson.id)}
              progress={enrollment.lessonProgress.find((row) => row.lessonId === lesson.id)}
              previous={lessons[lessonIndex - 1]?.id}
              next={lessons[lessonIndex + 1]?.id}
              nextUnlocked={done.has(lesson.id) || !lesson.required || (lessons[lessonIndex + 1] ? unlocked.has(lessons[lessonIndex + 1].id) : false)}
            />
          ) : null}

          {view === "quiz" ? (
            <QuizStage
              enrollmentId={id}
              open={quizOpen}
              quiz={version.quiz!}
              attempts={enrollment.quizAttempts}
              attemptId={query.attempt}
              passed={evidence.quizPassed}
            />
          ) : null}

          {view === "ack" ? (
            <>
              <div className="stage-head">
                <div>
                  <p className="eyebrow">Final step</p>
                  <h1>Policy acknowledgement</h1>
                </div>
              </div>
              <div className="stage-body form-stack" style={{ maxWidth: 720 }}>
                {!ackOpen ? (
                  <p className="callout">Finish the lessons{evidence.hasQuiz ? " and pass the quiz" : ""} first.</p>
                ) : enrollment.acknowledgement ? (
                  <>
                    <blockquote className="policy-statement" style={{ margin: 0 }}>{enrollment.acknowledgement.statement}</blockquote>
                    <p className="callout is-good">You confirmed this on {formatDateTime(enrollment.acknowledgement.acknowledgedAt)}.</p>
                  </>
                ) : (
                  <form action={acknowledgePolicy} className="form-stack">
                    <input type="hidden" name="enrollmentId" value={id} />
                    <p className="muted" style={{ margin: 0 }}>Read the statement below. Your confirmation is recorded with the date and time.</p>
                    <blockquote className="policy-statement" style={{ margin: 0 }}>{version.policyStatement}</blockquote>
                    <label className="check">
                      <input type="checkbox" name="confirm" required />
                      <span>I have read and understood this, and I agree to follow it.</span>
                    </label>
                    <div className="form-actions">
                      <SubmitButton pendingLabel="Recording…">Confirm and finish</SubmitButton>
                    </div>
                  </form>
                )}
              </div>
            </>
          ) : null}

          {view === "done" ? (
            <div className="stage-body" style={{ display: "grid", placeItems: "center", minHeight: 420 }}>
              <div className="complete-banner">
                <p className="eyebrow">{completed ? "Complete" : "Almost there"}</p>
                <h2>{completed ? "Module complete. Well done." : "A few steps remain."}</h2>
                <p className="muted">
                  {completed
                    ? `Recorded on ${formatDateTime(enrollment.completedAt)}${bestScore !== null ? ` with a quiz score of ${bestScore}%` : ""}. HR can see this in your learning record.`
                    : "Use the outline on the left to finish the remaining items."}
                </p>
                <div className="form-actions">
                  <Link className="btn btn-primary" href="/learn">
                    Back to my learning
                  </Link>
                  {lessons[0] ? (
                    <Link className="btn btn-secondary" href={`/learn/${id}?lesson=${lessons[0].id}`}>
                      Review lessons
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}

type LoadedLesson = ReturnType<typeof orderedLessons>[number];

function LessonStage({
  enrollmentId,
  lesson,
  position,
  total,
  isOpen,
  isDone,
  progress,
  previous,
  next,
  nextUnlocked,
}: {
  enrollmentId: string;
  lesson: LoadedLesson;
  position: number;
  total: number;
  isOpen: boolean;
  isDone: boolean;
  progress?: { lastPositionSeconds: number; percentComplete: number };
  previous?: string;
  next?: string;
  nextUnlocked: boolean;
}) {
  const nextHref = next ? `/learn/${enrollmentId}?lesson=${next}` : `/learn/${enrollmentId}?step=next`;

  return (
    <>
      <div className="stage-head">
        <div>
          <p className="eyebrow">
            {lesson.sectionTitle} · Lesson {position} of {total}
          </p>
          <h1>{lesson.title}</h1>
        </div>
        <span className="tag">{TYPE_LABEL[lesson.type]}</span>
      </div>
      <div className="stage-body">
        {!isOpen ? (
          <p className="callout">This lesson unlocks when you finish the one before it.</p>
        ) : lesson.type === "VIDEO" && (lesson.youtubeVideoId || lesson.asset) ? (
          <VideoLesson
            key={lesson.id}
            enrollmentId={enrollmentId}
            lessonId={lesson.id}
            videoId={lesson.youtubeVideoId ?? undefined}
            src={lesson.asset && !lesson.youtubeVideoId ? `/api/files/${lesson.asset.id}` : undefined}
            startAt={isDone ? 0 : (progress?.lastPositionSeconds ?? 0)}
            initialPercent={progress?.percentComplete ?? 0}
            required={lesson.requiredWatchPercentage}
            alreadyComplete={isDone}
          />
        ) : lesson.type === "PDF" && lesson.asset ? (
          <div className="form-stack">
            <iframe className="pdf-frame" src={`/api/files/${lesson.asset.id}#view=FitH`} title={lesson.title} />
            <p className="muted" style={{ margin: 0 }}>
              Trouble viewing?{" "}
              <a className="text-link" href={`/api/files/${lesson.asset.id}`} target="_blank" rel="noreferrer">
                Open the document in a new tab
              </a>
            </p>
          </div>
        ) : lesson.type === "RICH_TEXT" ? (
          <RichText source={lesson.body ?? ""} />
        ) : (
          <p className="callout">This lesson has no content. Please tell HR.</p>
        )}
      </div>
      <div className="stage-foot">
        {previous ? (
          <Link className="btn btn-ghost" href={`/learn/${enrollmentId}?lesson=${previous}`}>
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        {!isOpen ? null : lesson.type !== "VIDEO" && !isDone ? (
          <form action={markLessonComplete}>
            <input type="hidden" name="enrollmentId" value={enrollmentId} />
            <input type="hidden" name="lessonId" value={lesson.id} />
            <SubmitButton pendingLabel="Saving…">{lesson.type === "PDF" ? "I have read this document →" : "Mark as read →"}</SubmitButton>
          </form>
        ) : isDone || nextUnlocked ? (
          <Link className="btn btn-primary" href={nextHref}>
            {next ? "Next lesson →" : "Continue →"}
          </Link>
        ) : (
          <span className="muted">Watch the video to continue</span>
        )}
      </div>
    </>
  );
}

type Quiz = NonNullable<Awaited<ReturnType<typeof loadLearnerEnrollment>>>["version"]["quiz"];

function QuizStage({
  enrollmentId,
  open,
  quiz,
  attempts,
  attemptId,
  passed,
}: {
  enrollmentId: string;
  open: boolean;
  quiz: NonNullable<Quiz>;
  attempts: { id: string; score: number; passed: boolean; answers: unknown; completedAt: Date }[];
  attemptId?: string;
  passed: boolean;
}) {
  const attempt = attemptId ? attempts.find((row) => row.id === attemptId) : undefined;
  const wrong = new Set(((attempt?.answers as { wrong?: string[] } | undefined)?.wrong ?? []) as string[]);
  const bestPass = attempts.find((row) => row.passed);

  return (
    <>
      <div className="stage-head">
        <div>
          <p className="eyebrow">
            Knowledge check · pass mark {quiz.passingScore}% · {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"}
          </p>
          <h1>Quiz</h1>
        </div>
        {attempts.length ? <span className="tag">{attempts.length} attempt{attempts.length === 1 ? "" : "s"}</span> : null}
      </div>
      <div className="stage-body" style={{ maxWidth: 780 }}>
        {!open ? (
          <p className="callout">Finish all required lessons to unlock the quiz.</p>
        ) : attempt ? (
          <div className="form-stack">
            <div className={`result-card ${attempt.passed ? "is-pass" : "is-fail"}`}>
              <span className="result-score">{attempt.score}%</span>
              <div>
                <h2 style={{ margin: "0 0 6px", fontSize: 28 }}>{attempt.passed ? "Passed." : "Not this time."}</h2>
                <p className="muted" style={{ margin: 0 }}>
                  {attempt.passed
                    ? "Your result is recorded."
                    : `You need ${quiz.passingScore}% to pass. Review the lessons and try again — every attempt is recorded, and there is no limit.`}
                </p>
              </div>
            </div>
            {wrong.size ? (
              <p className="muted" style={{ margin: 0 }}>
                Questions to revisit:{" "}
                {quiz.questions
                  .map((question, index) => (wrong.has(question.id) ? index + 1 : null))
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : null}
            <div className="form-actions">
              {attempt.passed ? (
                <Link className="btn btn-primary" href={`/learn/${enrollmentId}?step=next`}>
                  Continue →
                </Link>
              ) : (
                <Link className="btn btn-primary" href={`/learn/${enrollmentId}?step=quiz&retry=1`}>
                  Try again
                </Link>
              )}
            </div>
          </div>
        ) : passed && bestPass ? (
          <div className="form-stack">
            <p className="callout is-good">
              You passed on {formatDateTime(bestPass.completedAt)} with {bestPass.score}%.
            </p>
            <div className="form-actions">
              <Link className="btn btn-primary" href={`/learn/${enrollmentId}?step=next`}>
                Continue →
              </Link>
            </div>
          </div>
        ) : (
          <form action={submitQuiz}>
            <input type="hidden" name="enrollmentId" value={enrollmentId} />
            {quiz.questions.map((question, index) => (
              <div className="quiz-question" key={question.id}>
                <fieldset>
                  <legend>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {question.prompt}
                  </legend>
                  {question.options.map((option) => (
                    <label className="quiz-option" key={option.id}>
                      <input type="radio" name={`q_${question.id}`} value={option.id} required />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </fieldset>
              </div>
            ))}
            <div className="form-actions" style={{ marginTop: 24 }}>
              <SubmitButton pendingLabel="Checking…">Submit answers</SubmitButton>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
