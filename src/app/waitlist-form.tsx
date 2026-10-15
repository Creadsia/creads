"use client";

import { useState } from "react";

type State = "idle" | "sending" | "done" | "error";

const NICHES = [
  "Seguros de auto",
  "Remodelación de baños",
  "Reparación de fundaciones",
  "Otro servicio para el hogar",
  "Otro",
];

export default function WaitlistForm({ id, compact = false }: { id: string; compact?: boolean }) {
  const [state, setState] = useState<State>("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          niche: form.get("niche"),
          ads_per_month: form.get("ads_per_month"),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo guardar. Intenta de nuevo.");
      setState("done");
      setMsg("Quedaste en la lista. Te escribimos apenas abra la beta de fundadores.");
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error ? err.message : "No se pudo guardar. Intenta de nuevo.");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="rounded-xl border border-line bg-surface px-4 py-3 font-medium text-good">
        {msg}
      </p>
    );
  }

  const field = "min-w-0 rounded-lg border border-line bg-surface px-3 py-2.5 text-[15px]";

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-xl flex-col gap-2.5">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          Tu correo
        </label>
        <input id={`${id}-email`} name="email" type="email" required placeholder="tu@correo.com" className={`${field} flex-1`} />
        <button
          type="submit"
          disabled={state === "sending"}
          className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {state === "sending" ? "Guardando…" : "Quiero ser fundador"}
        </button>
      </div>
      {!compact && (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label htmlFor={`${id}-niche`} className="sr-only">
            Tu nicho principal
          </label>
          <select id={`${id}-niche`} name="niche" defaultValue="" className={field}>
            <option value="" disabled>
              Tu nicho principal
            </option>
            {NICHES.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <label htmlFor={`${id}-ads`} className="sr-only">
            Anuncios que haces al mes
          </label>
          <select id={`${id}-ads`} name="ads_per_month" defaultValue="" className={field}>
            <option value="" disabled>
              Anuncios que haces al mes
            </option>
            <option>1–5</option>
            <option>6–15</option>
            <option>16–40</option>
            <option>Más de 40</option>
          </select>
        </div>
      )}
      {state === "error" && (
        <p role="alert" className="text-sm text-bad">
          {msg}
        </p>
      )}
    </form>
  );
}
