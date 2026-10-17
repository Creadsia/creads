"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "../brand";
import ThemeToggle from "../theme-toggle";

const input = "rounded-lg border border-line bg-surface-2 px-3 py-2 font-normal text-ink";

// The page an emailed "forgot my password" link opens: choose a new password, then sign in.
export default function NewPassword() {
  const fromUrl = useSearchParams()?.get("t") ?? "";
  const [token] = useState(fromUrl);
  // the link's secret leaves the address bar right away (no history, no analytics, no screenshots)
  useEffect(() => { if (fromUrl) window.history.replaceState(null, "", "/clave"); }, [fromUrl]);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== password2) return setError("Las dos claves no coinciden.");
    setBusy(true);
    const res = await fetch("/api/auth/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (res?.ok) return setDone(true);
    setError(d.error || "No se pudo cambiar la clave. Revisa tu conexión e intenta de nuevo.");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="flex w-full max-w-sm items-center justify-between">
        <Logo size={28} href="/" />
        <ThemeToggle lang="es" />
      </div>
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
        {done ? (
          <>
            <h1 className="font-display text-2xl font-extrabold">Clave cambiada</h1>
            <p className="text-sm text-muted">Listo. Por seguridad cerramos tus sesiones abiertas: entra de nuevo con tu clave nueva.</p>
            <Link href="/app" className="rounded-lg bg-accent px-4 py-2.5 text-center font-semibold text-accent-ink">Entrar a Creads</Link>
          </>
        ) : !token ? (
          <>
            <h1 className="font-display text-2xl font-extrabold">Falta el enlace</h1>
            <p className="text-sm text-muted">Abre esta página desde el botón del correo que te enviamos. Si no lo encuentras, pide uno nuevo en «¿Olvidaste tu clave?».</p>
            <Link href="/app" className="rounded-lg bg-accent px-4 py-2.5 text-center font-semibold text-accent-ink">Ir a entrar</Link>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="font-display text-2xl font-extrabold">Elige tu clave nueva</h1>
              <p className="text-sm text-muted">El enlace sirve una sola vez y vence 1 hora después de pedirlo.</p>
            </div>
            <label htmlFor="password" className="flex flex-col gap-1 text-sm font-semibold text-muted">
              Clave nueva
              <input id="password" type="password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className={input} />
              <span className="text-xs font-normal">Mínimo 10 caracteres.</span>
            </label>
            <label htmlFor="password2" className="flex flex-col gap-1 text-sm font-semibold text-muted">
              Repite la clave
              <input id="password2" type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" className={input} />
            </label>
            <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-50">{busy ? "Guardando…" : "Guardar clave nueva"}</button>
            {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
