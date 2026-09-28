import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-intro">
        <p className="eyebrow">Snitch Retail · Learning desk</p>
        <h1>
          Learning, <em>without</em> the noise.
        </h1>
        <p>Mandatory training, store policies and your progress record — in one place.</p>
      </section>
      <section className="login-panel" aria-labelledby="login-heading">
        <p className="eyebrow">Sign in</p>
        <h2 id="login-heading">Welcome back</h2>
        <p>Use the employee code and password issued by HR.</p>
        <LoginForm />
      </section>
    </main>
  );
}
