"use client";

import { useState } from "react";

type State = "idle" | "sending" | "done" | "error";

export default function WaitlistForm() {
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
      if (!res.ok) throw new Error(data.error || "No se pudo guardar.");
      setState("done");
      setMsg("¡Listo! Te avisamos apenas abra la beta de fundadores.");
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  if (state === "done") {
    return <p className="rounded-xl border border-line bg-surface p-4 text-good">{msg}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <p className="font-semibold">Únete a la lista de fundadores</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          name="email"
          type="email"
          required
          placeholder="tu@correo.com"
          className="rounded-lg border border-line bg-surface-2 px-3 py-2 sm:col-span-3"
        />
        <select name="niche" className="rounded-lg border border-line bg-surface-2 px-3 py-2 sm:col-span-2" defaultValue="">
          <option value="" disabled>
            ¿Tu nicho principal?
          </option>
          <option>Seguros de auto</option>
          <option>Remodelación de baños</option>
          <option>Reparación de fundaciones</option>
          <option>Otro servicio para el hogar</option>
          <option>Otro</option>
        </select>
        <select name="ads_per_month" className="rounded-lg border border-line bg-surface-2 px-3 py-2" defaultValue="">
          <option value="" disabled>
            Anuncios al mes
          </option>
          <option>1–5</option>
          <option>6–15</option>
          <option>16–40</option>
          <option>Más de 40</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-60"
      >
        {state === "sending" ? "Guardando…" : "Quiero entrar a la beta"}
      </button>
      {state === "error" && <p className="text-sm text-bad">{msg}</p>}
    </form>
  );
}
