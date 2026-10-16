"use client";

import { useState } from "react";

export default function AdminLogin({ configured }: { configured: boolean }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      window.location.reload();
      return;
    }
    setError(data.error || "No se pudo entrar.");
    setBusy(false);
  }

  return (
    <section className="mx-auto mt-10 flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
      <h1 className="font-display text-2xl font-extrabold">Entrar al panel</h1>
      {!configured ? (
        <p className="text-sm text-muted">
          Falta crear la clave de administrador. En Vercel → creads → Settings → Environment Variables agrega
          <code className="mx-1 rounded bg-surface-2 px-1">ADMIN_ACCESS_CODE</code> con una clave larga que solo tú sepas.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="admin-code" className="flex flex-col gap-1 text-sm font-semibold text-muted">
            Clave de administrador
            <input
              id="admin-code"
              type="password"
              autoComplete="current-password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-normal text-ink"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !code}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
          >
            {busy ? "Entrando…" : "Entrar"}
          </button>
          {error && <p className="text-sm text-bad">{error}</p>}
          <p className="text-xs text-muted">Este navegador queda con acceso por 30 días.</p>
        </form>
      )}
    </section>
  );
}
