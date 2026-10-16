"use client";

import { useState } from "react";
import { Logo } from "../../brand";
import ThemeToggle from "../../theme-toggle";

export default function Gate() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
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
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-extrabold">Entrar a Creads</h1>
          <p className="text-sm text-muted">La plataforma está en beta privada. Escribe tu código de acceso.</p>
        </div>
        <label htmlFor="access-code" className="flex flex-col gap-1 text-sm font-semibold text-muted">
          Código de acceso
          <input id="access-code" type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)}
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-normal text-ink" />
        </label>
        <button type="submit" disabled={busy || !code} className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-50">
          {busy ? "Entrando…" : "Entrar"}
        </button>
        {error && <p className="text-sm text-bad">{error}</p>}
        <p className="text-xs text-muted">¿No tienes código? Reserva tu plan en <a href="/es#pricing" className="underline">creadsia.com</a>.</p>
      </form>
    </main>
  );
}
