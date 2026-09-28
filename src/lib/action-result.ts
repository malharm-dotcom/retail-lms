export type ActionResult = { ok?: string; error?: string } | null;

/** Run a server action body and turn thrown errors into an inline message. */
export async function attempt(run: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const ok = await run();
    return { ok: ok ?? "Saved." };
  } catch (error) {
    if (error instanceof Error && (error.message === "NEXT_REDIRECT" || "digest" in error)) throw error;
    return { error: error instanceof Error ? error.message : "Something went wrong." };
  }
}

export function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export function requiredText(formData: FormData, key: string, label: string): string {
  const value = text(formData, key);
  if (!value) throw new Error(`${label} is required.`);
  return value;
}
