"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/forms";
import { MAX_VIDEO_BYTES, VIDEO_CHUNK_BYTES } from "@/lib/video";
import { addLesson, addQuestion } from "../actions";

// UPLOAD is a builder-only choice: it creates a VIDEO lesson backed by an uploaded file.
type LessonType = "VIDEO" | "UPLOAD" | "PDF" | "RICH_TEXT";

const TYPES: { value: LessonType; label: string }[] = [
  { value: "VIDEO", label: "YouTube video" },
  { value: "UPLOAD", label: "Upload video" },
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
        ) : type === "UPLOAD" ? (
          <VideoUploadForm sectionId={sectionId} />
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

async function call(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => ({}))) as { error?: string; assetId?: string };
  if (!response.ok) throw new Error(body.error ?? "Upload failed.");
  return body;
}

/** Uploads a video to /api/files/video in fixed-size chunks, so any size up to the cap gets through. */
export function VideoUploadForm({ sectionId, lessonId }: { sectionId?: string; lessonId?: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ progress?: number; error?: string; ok?: string }>({});
  const busy = state.progress !== undefined;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const field = (name: string) => form.elements.namedItem(name) as HTMLInputElement | null;
    const file = field("file")?.files?.[0];
    if (!file) return setState({ error: "Choose a video file." });
    if (file.size > MAX_VIDEO_BYTES) return setState({ error: "Videos must be 500 MB or smaller. Compress the file and try again." });
    const target = { sectionId, lessonId };
    const json = { "Content-Type": "application/json" };
    setState({ progress: 0 });
    try {
      const { assetId } = await call("/api/files/video", {
        method: "POST",
        headers: json,
        body: JSON.stringify({ ...target, fileName: file.name, sizeBytes: file.size }),
      });
      const total = Math.ceil(file.size / VIDEO_CHUNK_BYTES);
      for (let index = 0; index < total; index++) {
        const chunk = file.slice(index * VIDEO_CHUNK_BYTES, (index + 1) * VIDEO_CHUNK_BYTES);
        const url = `/api/files/video?assetId=${assetId}&index=${index}`;
        // One retry per chunk covers a brief network drop on store Wi-Fi.
        await call(url, { method: "PUT", body: chunk }).catch(() => call(url, { method: "PUT", body: chunk }));
        setState({ progress: Math.round(((index + 1) / total) * 100) });
      }
      await call("/api/files/video", {
        method: "PATCH",
        headers: json,
        body: JSON.stringify({
          ...target,
          assetId,
          title: field("title")?.value ?? "",
          required: field("required")?.checked !== false,
          requiredWatchPercentage: Number(field("requiredWatchPercentage")?.value || 95),
        }),
      });
      form.reset();
      setState({ ok: lessonId ? "Video replaced." : "Video lesson added." });
      router.refresh();
    } catch (error) {
      setState({ error: error instanceof Error ? error.message : "Upload failed." });
    }
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {lessonId ? null : (
        <label className="field span-2">
          <span>Lesson title</span>
          <input name="title" required maxLength={140} />
        </label>
      )}
      <label className={`field${lessonId ? " span-2" : ""}`}>
        <span>{lessonId ? "Replace with a new video" : "Video file"}</span>
        <input name="file" type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.mov,.webm" required />
        <small>MP4 (H.264) plays everywhere. Up to 500 MB — 720p is plenty for training.</small>
      </label>
      {lessonId ? null : (
        <>
          <label className="field">
            <span>Required watch %</span>
            <input name="requiredWatchPercentage" type="number" min={50} max={100} defaultValue={95} />
            <small>Share of the video that must actually be played. Skipped parts do not count.</small>
          </label>
          <label className="check span-2">
            <input type="checkbox" name="required" defaultChecked />
            <span>Required to complete the module</span>
          </label>
        </>
      )}
      <div className="form-actions span-2">
        <button className={`btn ${lessonId ? "btn-secondary" : "btn-primary"}`} type="submit" disabled={busy}>
          {busy ? `Uploading… ${state.progress}%` : lessonId ? "Upload replacement" : "Upload and add"}
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
