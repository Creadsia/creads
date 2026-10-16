"use client";

import { useState } from "react";
import { Logo } from "../../brand";
import ThemeToggle from "../../theme-toggle";

const input = "rounded-lg border border-line bg-surface-2 px-3 py-2 font-normal text-ink";

// Sign-in page. On the very first visit (no accounts yet) it creates the owner's account instead.
export default function Login({ mode }: { mode: "login" | "setup" | "missing" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "setup" && password !== password2) return setError("Las dos claves no coinciden.");
    setBusy(true);
    const res = await fetch(mode === "setup" ? "/api/auth/setup" : "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(mode === "setup" ? { email, password, name, code } : { email, password }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) return window.location.reload();
    setError(d.error || "No se pudo entrar.");
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="flex w-full max-w-sm items-center justify-between">
        <Logo size={28} href="/" />
        <ThemeToggle lang="es" />
      </div>
      {mode === "missing" ? (
        <div className="flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-warn/50 bg-warn/10 p-6 text-sm">
          <h1 className="font-display text-xl font-extrabold">Falta un paso</h1>
          <p className="text-muted">Hay que crear las tablas de cuentas en Supabase (SQL Editor → pegar el bloque «Accounts» de schema.sql → Run). Después recarga esta página.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-extrabold">{mode === "setup" ? "Crea tu cuenta de dueño" : "Entrar a Creads"}</h1>
            <p className="text-sm text-muted">
              {mode === "setup"
                ? "Es la primera vez que se abre la plataforma. Esta cuenta tendrá acceso a todo y podrá invitar a otras personas."
                : "Entra con tu correo y tu clave."}
            </p>
          </div>
          {mode === "setup" && (
            <label htmlFor="name" className="flex flex-col gap-1 text-sm font-semibold text-muted">
              Tu nombre
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={input} />
            </label>
          )}
          <label htmlFor="email" className="flex flex-col gap-1 text-sm font-semibold text-muted">
            Correo
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={input} />
          </label>
          <label htmlFor="password" className="flex flex-col gap-1 text-sm font-semibold text-muted">
            Clave
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "setup" ? "new-password" : "current-password"} className={input} />
            {mode === "setup" && <span className="text-xs font-normal">Mínimo 10 caracteres.</span>}
          </label>
          {mode === "setup" && (
            <>
              <label htmlFor="password2" className="flex flex-col gap-1 text-sm font-semibold text-muted">
                Repite la clave
                <input id="password2" type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" className={input} />
              </label>
              <label htmlFor="code" className="flex flex-col gap-1 text-sm font-semibold text-muted">
                Clave de administrador de Vercel
                <input id="code" type="password" required value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" className={input} />
                <span className="text-xs font-normal">La que guardaste como ADMIN_ACCESS_CODE. Se pide solo esta vez, para que nadie más pueda crear la cuenta del dueño.</span>
              </label>
            </>
          )}
          <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-50">
            {busy ? "Un momento…" : mode === "setup" ? "Crear mi cuenta" : "Entrar"}
          </button>
          {error && <p className="text-sm text-bad">{error}</p>}
          {mode === "login" && <p className="text-xs text-muted">¿Olvidaste tu clave? Pídele al dueño de la cuenta que te dé una nueva.</p>}
        </form>
      )}
    </main>
  );
}
