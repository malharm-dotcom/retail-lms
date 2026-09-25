import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="login-page">
      <section className="login-intro">
        <p className="eyebrow">Snitch Retail</p>
        <h1>Learning, without the noise.</h1>
        <p>Mandatory training, operating policies, and progress records in one place.</p>
      </section>
      <section className="login-panel" aria-labelledby="login-heading">
        <p className="section-number">01 / ACCESS</p>
        <h2 id="login-heading">Employee sign in</h2>
        <p>Use the employee code issued by HR.</p>
        <LoginForm />
      </section>
    </main>
  );
}
