"use client";

import { useState } from "react";
import type { Content } from "@/content/en";
import { newEventId, track } from "@/lib/track";

type State = "idle" | "sending" | "done" | "error";

export default function WaitlistForm({
  id,
  t,
  lang,
  plan,
}: {
  id: string;
  t: Content["form"];
  lang: string;
  plan?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const [msg, setMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setState("sending");
    const eventId = newEventId();
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          niche: form.get("niche"),
          ads_per_month: form.get("ads_per_month"),
          plan: plan ?? "",
          lang,
          eventId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t.error);
      setState("done");
      setMsg(t.done);
      track("Lead", { content_name: plan ? `Reserva ${plan}` : "Lista de espera" }, eventId);
    } catch {
      setState("error");
      setMsg(t.error);
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="rounded-xl border border-line bg-surface px-4 py-3 font-medium text-good">
        {msg}
      </p>
    );
  }

  const field = "min-w-0 rounded-lg border border-line bg-bg/60 px-3 py-2.5 text-[15px]";

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-2.5">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          {t.email}
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          placeholder={t.emailPlaceholder}
          className={`${field} flex-1`}
        />
        <button
          type="submit"
          disabled={state === "sending"}
          className="rounded-lg bg-ink px-5 py-2.5 font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {state === "sending" ? t.sending : t.submit}
        </button>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label htmlFor={`${id}-niche`} className="sr-only">
          {t.role}
        </label>
        <select id={`${id}-niche`} name="niche" defaultValue="" className={field}>
          <option value="" disabled>
            {t.role}
          </option>
          {t.roles.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
        <label htmlFor={`${id}-ads`} className="sr-only">
          {t.volume}
        </label>
        <select id={`${id}-ads`} name="ads_per_month" defaultValue="" className={field}>
          <option value="" disabled>
            {t.volume}
          </option>
          {t.volumes.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      {state === "error" && (
        <p role="alert" className="text-sm text-bad">
          {msg}
        </p>
      )}
    </form>
  );
}
