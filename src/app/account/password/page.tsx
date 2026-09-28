import { AppShell } from "@/components/app-shell";
import { ActionForm, SubmitButton } from "@/components/forms";
import { PageHeader } from "@/components/ui";
import { requireCurrentUser } from "@/lib/session";
import { changePassword } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Change password" };

export default async function PasswordPage() {
  const user = await requireCurrentUser({ allowTemporaryPassword: true });
  const forced = user.forcePasswordChange;

  const form = (
    <ActionForm action={changePassword} className="form-stack">
      <label className="field">
        <span>{forced ? "Temporary password" : "Current password"}</span>
        <input name="current" type="password" autoComplete="current-password" required />
      </label>
      <label className="field">
        <span>New password</span>
        <input name="next" type="password" autoComplete="new-password" minLength={8} required />
        <small>At least 8 characters, with letters and numbers. Do not use your employee code.</small>
      </label>
      <label className="field">
        <span>Confirm new password</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <div className="form-actions">
        <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
      </div>
    </ActionForm>
  );

  if (forced) {
    return (
      <main className="login-page">
        <section className="login-intro">
          <p className="eyebrow">First sign-in</p>
          <h1>
            Make it <em>yours.</em>
          </h1>
          <p>You signed in with a temporary password from HR. Set your own before continuing.</p>
        </section>
        <section className="login-panel">
          <p className="eyebrow">{user.employeeCode}</p>
          <h2>Set a new password</h2>
          <p>Hi {user.name.split(" ")[0]} — this takes a few seconds.</p>
          <div style={{ marginTop: 28 }}>{form}</div>
        </section>
      </main>
    );
  }

  return (
    <AppShell active="account" user={user}>
      <PageHeader eyebrow="Account" title="Change password" lede="You will stay signed in on this device." />
      <section className="panel" style={{ maxWidth: 560 }}>
        <div className="panel-body">{form}</div>
      </section>
    </AppShell>
  );
}
