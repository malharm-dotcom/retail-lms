"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      employeeCode: String(form.get("employeeCode") ?? ""),
      password: String(form.get("password") ?? ""),
      redirect: false,
    });

    if (!result?.ok) {
      setSubmitting(false);
      setError("Employee code or password is incorrect.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label className="field">
        <span>Employee code</span>
        <input name="employeeCode" autoComplete="username" required autoFocus />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {error ? (
        <p className="form-message is-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
