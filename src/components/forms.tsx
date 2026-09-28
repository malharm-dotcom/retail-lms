"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/action-result";

type ActionFormProps = {
  action: (previous: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
};

/** Form bound to a server action that returns `{ ok }` or `{ error }`, shown inline. */
export function ActionForm({ action, children, className, resetOnSuccess, confirm }: ActionFormProps) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
      {state?.error ? (
        <p className="form-message is-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="form-message is-ok" role="status">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button className={`btn btn-${variant}`} type="submit" disabled={pending} name={name} value={value}>
      {pending ? (pendingLabel ?? "Saving…") : children}
    </button>
  );
}

/** Submit button that asks for confirmation first; use inside a plain `<form action={serverAction}>`. */
export function ConfirmButton({ children, message, variant = "danger", small = true }: { children: React.ReactNode; message: string; variant?: "danger" | "ghost" | "secondary"; small?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className={`btn btn-${variant}${small ? " btn-small" : ""}`}
      type="submit"
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? "Working…" : children}
    </button>
  );
}
