"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { addLesson, addQuestion } from "../actions";

type LessonType = "VIDEO" | "PDF" | "RICH_TEXT";

const TYPES: { value: LessonType; label: string }[] = [
  { value: "VIDEO", label: "YouTube video" },
  { value: "PDF", label: "PDF / slides" },
  { value: "RICH_TEXT", label: "Text" },
];

export function RichTextHelp() {
  return (
    <small>
      Plain text. Start a line with <code>## </code> for a heading, <code>- </code> for a bullet, <code>1. </code> for a numbered
      step; wrap words in <code>**</code> for bold.
    </small>
  );
}

export function AddLessonForm({ sectionId }: { sectionId: string }) {
  const [type, setType] = useState<LessonType>("VIDEO");

  return (
    <details className="add-lesson">
      <summary>+ Add a lesson</summary>
      <div className="form-stack">
        <div className="segmented" role="radiogroup" aria-label="Lesson type">
          {TYPES.map((option) => (
            <label key={option.value}>
              <input type="radio" name={`type-${sectionId}`} checked={type === option.value} onChange={() => setType(option.value)} />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
        {type === "PDF" ? (
          <PdfUploadForm sectionId={sectionId} />
        ) : (
          <ActionForm action={addLesson} className="form-grid" resetOnSuccess key={type}>
            <input type="hidden" name="sectionId" value={sectionId} />
            <input type="hidden" name="type" value={type} />
            <label className="field span-2">
              <span>Lesson title</span>
              <input name="title" required maxLength={140} />
            </label>
            {type === "VIDEO" ? (
              <>
                <label className="field">
                  <span>YouTube link</span>
                  <input name="youtubeUrl" placeholder="https://youtu.be/…" required />
                  <small>Unlisted videos work. Length is detected the first time someone plays it.</small>
                </label>
                <label className="field">
                  <span>Required watch %</span>
                  <input name="requiredWatchPercentage" type="number" min={50} max={100} defaultValue={95} />
                  <small>Share of the video that must actually be played. Skipped parts do not count.</small>
                </label>
              </>
            ) : (
              <label className="field span-2">
                <span>Lesson text</span>
                <textarea name="body" rows={8} required />
                <RichTextHelp />
              </label>
            )}
            <label className="check span-2">
              <input type="checkbox" name="required" defaultChecked />
              <span>Required to complete the module</span>
            </label>
            <div className="form-actions span-2">
              <SubmitButton pendingLabel="Adding…">Add lesson</SubmitButton>
            </div>
          </ActionForm>
        )}
      </div>
    </details>
  );
}

/** Uploads straight to /api/files (server actions cap request bodies far below 25 MB). */
export function PdfUploadForm({ sectionId, lessonId }: { sectionId?: string; lessonId?: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy?: boolean; error?: string; ok?: string }>({});

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("required", (form.elements.namedItem("required") as HTMLInputElement | null)?.checked === false ? "false" : "true");
    setState({ busy: true });
    try {
      const response = await fetch("/api/files", { method: "POST", body: data });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Upload failed.");
      form.reset();
      setState({ ok: lessonId ? "File replaced." : "PDF lesson added." });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Upload failed." });
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {sectionId ? <input type="hidden" name="sectionId" value={sectionId} /> : null}
      {lessonId ? <input type="hidden" name="lessonId" value={lessonId} /> : null}
      {lessonId ? null : (
        <label className="field span-2">
          <span>Lesson title</span>
          <input name="title" required maxLength={140} />
        </label>
      )}
      <label className="field span-2">
        <span>{lessonId ? "Replace with a new PDF" : "PDF file"}</span>
        <input name="file" type="file" accept="application/pdf,.pdf" required />
        <small>Up to 25 MB. For PowerPoint, use File → Export → PDF first.</small>
      </label>
      {lessonId ? null : (
        <label className="check span-2">
          <input type="checkbox" name="required" defaultChecked />
          <span>Required to complete the module</span>
        </label>
      )}
      <div className="form-actions span-2">
        <button className={`btn ${lessonId ? "btn-secondary" : "btn-primary"}`} type="submit" disabled={state.busy}>
          {state.busy ? "Uploading…" : lessonId ? "Upload replacement" : "Upload and add"}
        </button>
        {state.error ? <p className="form-message is-error">{state.error}</p> : null}
        {state.ok ? <p className="form-message is-ok">{state.ok}</p> : null}
      </div>
    </form>
  );
}

export function QuestionForm({ versionId }: { versionId: string }) {
  const [type, setType] = useState<"SINGLE_CHOICE" | "TRUE_FALSE">("SINGLE_CHOICE");

  return (
    <ActionForm action={addQuestion} className="form-stack" resetOnSuccess key={type}>
      <input type="hidden" name="versionId" value={versionId} />
      <input type="hidden" name="type" value={type} />
      <div className="segmented" role="radiogroup" aria-label="Question type">
        <label>
          <input type="radio" checked={type === "SINGLE_CHOICE"} onChange={() => setType("SINGLE_CHOICE")} />
          <span>Multiple choice</span>
        </label>
        <label>
          <input type="radio" checked={type === "TRUE_FALSE"} onChange={() => setType("TRUE_FALSE")} />
          <span>True / false</span>
        </label>
      </div>
      <label className="field">
        <span>Question</span>
        <textarea name="prompt" rows={2} style={{ minHeight: 64 }} required />
      </label>
      <div className="field">
        <span className="field-label">Answers — select the correct one</span>
        <div className="option-rows">
          {(type === "TRUE_FALSE" ? ["True", "False"] : ["", "", "", ""]).map((label, index) => (
            <div className="option-row" key={index}>
              <input type="radio" name="correct" value={index} required aria-label={`Answer ${index + 1} is correct`} />
              {type === "TRUE_FALSE" ? (
                <span>{label}</span>
              ) : (
                <input className="input" name={`option_${index}`} placeholder={`Answer ${index + 1}${index > 1 ? " (optional)" : ""}`} required={index < 2} />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="form-actions">
        <SubmitButton pendingLabel="Adding…">Add question</SubmitButton>
      </div>
    </ActionForm>
  );
}
