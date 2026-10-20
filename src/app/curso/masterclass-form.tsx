"use client";

import { useState } from "react";
import { newEventId, track } from "@/lib/track";

// Sign-up for the free masterclass: email + WhatsApp (where the link is sent).
export default function MasterclassForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("sending");
    setErr("");
    const eventId = newEventId();
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: f.get("email"), whatsapp: f.get("whatsapp"), plan: "masterclass", lang: "es", eventId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No pudimos guardar tus datos. Revisa el correo e intenta de nuevo.");
      setState("done");
      track("Lead", { content_name: "Masterclass" }, eventId);
    } catch (e2) {
      setState("error");
      setErr(e2 instanceof Error && !/Invalid email/i.test(e2.message) ? e2.message : "Revisa que el correo esté bien escrito.");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="rounded-2xl border border-good/40 bg-good/10 px-4 py-3 font-medium">
        Listo, quedaste inscrito. Te escribimos por WhatsApp y por correo con el link de la masterclass.
      </p>
    );
  }

  const field = "min-w-0 rounded-xl border border-line bg-bg/70 px-3.5 py-3 text-[15px]";
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2.5">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Tu correo
          <input name="email" type="email" required autoComplete="email" placeholder="tu@correo.com" className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          Tu WhatsApp
          <input name="whatsapp" type="tel" required autoComplete="tel" inputMode="tel" placeholder="+56 9 1234 5678" className={field} />
        </label>
      </div>
      <button type="submit" disabled={state === "sending"} className="rounded-xl bg-[image:var(--grad)] px-5 py-3.5 font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)] disabled:opacity-60">
        {state === "sending" ? "Guardando…" : "Quiero la masterclass gratis"}
      </button>
      {state === "error" && <p role="alert" className="text-sm text-bad">{err}</p>}
      <p className="text-xs text-muted">Te escribimos solo por la masterclass y el curso. Puedes salirte cuando quieras.</p>
    </form>
  );
}
