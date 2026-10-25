"use client";

import { useState } from "react";
import type { Content } from "@/content/en";
import { newEventId, track } from "@/lib/track";

// Interest in the affiliate program from the home page (saved in the waitlist with plan "afiliado"). The real
// application is at /app/afiliados (explained at /afiliados).
export default function AffiliateForm({ t, form, lang }: { t: Content["affiliates"]; form: Content["form"]; lang: "en" | "es" }) {
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState(t.channels[0]);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const eventId = newEventId();
    const res = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, niche: `afiliado: ${channel}`, plan: "afiliado", lang, eventId }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
    if (res?.ok) track("Lead", { content_name: "Afiliado" }, eventId);
  }

  if (state === "done") return <p className="rounded-xl bg-good/12 p-4 font-semibold text-good" role="status">{t.done}</p>;

  return (
    <form onSubmit={send} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
        {form.email}
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={form.emailPlaceholder} autoComplete="email"
          className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-base font-normal text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
        {t.channel}
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-base font-normal text-ink">
          {t.channels.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <button type="submit" disabled={state === "sending"} className="rounded-xl bg-ink px-5 py-3 font-semibold text-bg disabled:opacity-60">
        {state === "sending" ? form.sending : t.submit}
      </button>
      {state === "error" && <p className="text-sm text-bad" role="alert">{form.error}</p>}
      <a href="/afiliados" className="text-sm font-semibold text-muted underline hover:text-ink">{lang === "es" ? "Ver cómo funciona el programa y postular" : "How the program works (Spanish)"}</a>
    </form>
  );
}
