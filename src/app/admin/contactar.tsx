"use client";

import { useCallback, useEffect, useState } from "react";
import type { Caso } from "@/lib/cuidado";

// Clientes → Clientes a contactar: who had a problem (a failed generation, or asked for a person in the help
// chat). Creads already wrote to them; here you follow up personally and mark it done.

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const when = (iso: string) => new Date(iso).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Contactar() {
  const [list, setList] = useState<Caso[] | null>(null);
  const [err, setErr] = useState("");
  const [ver, setVer] = useState<"pendiente" | "contactado">("pendiente");
  const load = useCallback(() => {
    fetch("/api/admin/contactar").then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setList(j.casos); }).catch((e) => setErr(e.message || "No se pudo cargar."));
  }, []);
  useEffect(() => { load(); }, [load]);
  async function marcar(c: Caso, estado: Caso["estado"]) {
    await fetch("/api/admin/contactar", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: c.id, estado }) }).catch(() => null);
    load();
  }
  if (err) return <div className={card}><p className="text-bad">{err}</p></div>;
  if (!list) return <div className={card}><p className="text-muted">Cargando…</p></div>;
  const shown = list.filter((c) => c.estado === ver);
  const pend = list.filter((c) => c.estado === "pendiente").length;

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex max-w-2xl flex-col gap-1">
            <h2 className="font-display text-xl font-bold">Clientes a contactar</h2>
            <p className="text-sm text-muted">Cuando a un cliente le falla algo, Creads le escribe al tiro (los créditos ya volvieron) y el caso queda aquí. También llegan quienes piden hablar con una persona en el chat de ayuda. Escríbeles tú y márcalo como contactado.</p>
          </div>
          <div role="group" aria-label="Ver" className="flex gap-1 rounded-xl border border-line p-1 text-sm">
            <button type="button" aria-pressed={ver === "pendiente"} onClick={() => setVer("pendiente")} className={`rounded-lg px-3 py-1.5 ${ver === "pendiente" ? "bg-ink text-bg" : "text-muted"}`}>Pendientes{pend ? ` (${pend})` : ""}</button>
            <button type="button" aria-pressed={ver === "contactado"} onClick={() => setVer("contactado")} className={`rounded-lg px-3 py-1.5 ${ver === "contactado" ? "bg-ink text-bg" : "text-muted"}`}>Contactados</button>
          </div>
        </div>
      </section>
      {shown.length === 0 ? (
        <div className={card}><p className="text-muted">{ver === "pendiente" ? "Nadie esperando: ningún cliente tuvo problemas sin atender." : "Todavía no marcas casos como contactados."}</p></div>
      ) : shown.map((c) => {
        const asunto = c.motivo === "ayuda" ? "Tu consulta en Creads" : "Sobre tu generación en Creads";
        const saludo = `Hola${c.name ? ` ${c.name.split(" ")[0]}` : ""}, te escribo de Creads.`;
        return (
          <article key={c.id} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <b className="truncate">{c.name || c.email}</b>
                <span className="truncate text-sm text-muted">{c.email} · {when(c.at)}</span>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${c.motivo === "ayuda" ? "bg-accent/15 text-accent-text" : "bg-bad/12 text-bad"}`}>{c.motivo === "ayuda" ? "Pidió una persona" : "Le falló una generación"}</span>
            </div>
            <ul className="text-sm text-muted">{c.items.map((x, i) => <li key={i}>• {x.what}</li>)}</ul>
            {c.nota && <p className="rounded-lg bg-surface-2 p-3 text-sm">{c.nota}</p>}
            <p className="text-xs text-muted">{c.motivo === "falla" ? (c.mailed ? "Creads ya le mandó un correo con los créditos devueltos." : "Esta vez no se le mandó correo (ya había recibido uno hace poco).") : "En el chat le dijimos que le responderíamos por correo."}</p>
            <div className="flex flex-wrap gap-2">
              <a href={`mailto:${c.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(`${saludo}\n\n`)}`} className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg">Escribir correo</a>
              {c.estado === "pendiente"
                ? <button type="button" onClick={() => marcar(c, "contactado")} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold">Marcar contactado</button>
                : <button type="button" onClick={() => marcar(c, "pendiente")} className="rounded-lg border border-line px-3 py-2 text-sm text-muted">Volver a pendiente</button>}
            </div>
          </article>
        );
      })}
    </div>
  );
}
