"use client";

import { useCallback, useEffect, useState } from "react";
import type { Check, GuardConfig, GuardState, Incident } from "@/lib/guardian";
import type { Pause } from "@/lib/model-pause";
import { AREAS } from "@/lib/areas";

// Plataforma → Guardián: the health of all of creadsia at a glance. What is checked every few minutes, the
// open problems (and what the Guardián already did about them), paused models, the thresholds, and how
// alerts reach the owner (email, WhatsApp, outside monitor).

interface View extends GuardState { paused: Record<string, Pause>; modelos: { id: string; label: string }[]; whatsapp: "meta" | "callmebot" | null; monitorUrl: string | null }

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const btn = "rounded-lg border border-line px-3 py-1.5 text-sm font-semibold disabled:opacity-50";
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("es-CL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "nunca");
const areaName = (id: string) => AREAS.find((a) => a.id === id)?.name ?? id;
const DOT: Record<Check["estado"], [string, string]> = { ok: ["bg-good", "Bien"], lento: ["bg-warn", "Lento"], falla: ["bg-bad", "Falla"] };

async function api<T>(method: string, body?: unknown): Promise<T> {
  const r = await fetch("/api/admin/guardian", { method, ...(body !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const x = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(x.error || "No se pudo completar.");
  return x as T;
}

function Sev({ i }: { i: Incident }) {
  return i.severidad === "critico"
    ? <span className="whitespace-nowrap rounded-full bg-bad/15 px-2.5 py-1 text-xs font-semibold text-bad">▲ Crítico</span>
    : <span className="whitespace-nowrap rounded-full bg-warn/15 px-2.5 py-1 text-xs font-semibold text-warn">● Aviso</span>;
}

/** One incident: what happened, where, what was already done. */
export function IncidentRow({ i, onClose }: { i: Incident; onClose?: () => void }) {
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col"><b className="text-sm">{i.titulo}</b><span className="text-xs text-muted">Área {areaName(i.area)} · desde {when(i.first)}{i.count > 1 ? ` · visto ${i.count} veces` : ""}</span></span>
        <span className="flex items-center gap-2"><Sev i={i} />{onClose && i.abierto && <button type="button" onClick={onClose} className={`${btn} text-xs`}>Cerrar</button>}</span>
      </div>
      <p className="text-sm text-muted">{i.detalle}</p>
      {i.acciones.length > 0 && <p className="rounded-lg bg-good/10 px-3 py-2 text-xs"><b>Lo que hizo el Guardián:</b> {i.acciones.join(" ")}</p>}
    </li>
  );
}

export default function Guardian() {
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  const [cfg, setCfg] = useState<GuardConfig | null>(null);
  const [pauseId, setPauseId] = useState("");

  const run = useCallback(async (method: "GET" | "POST" | "PATCH", body?: unknown, tag = "") => {
    setErr(""); setBusy(tag);
    try { const x = await api<View>(method, body); setV(x); setCfg(x.config); return true; } catch (e) { setErr(e instanceof Error ? e.message : ""); return false; } finally { setBusy(""); }
  }, []);
  useEffect(() => { run("GET"); }, [run]);

  if (!v || !cfg) return <div className={card}>{err ? <p role="alert" className="text-bad">{err}</p> : <p className="text-muted">Cargando…</p>}</div>;
  const open = v.incidents.filter((i) => i.abierto);
  const critical = open.filter((i) => i.severidad === "critico");
  const done = v.incidents.filter((i) => !i.abierto).slice(0, 15);
  const pausedList = Object.entries(v.paused);
  const set = (p: Partial<GuardConfig>) => setCfg((c) => (c ? { ...c, ...p } : c));
  const num = (k: keyof GuardConfig, label: string, unit: string, step = 1) => (
    <label className="flex flex-col gap-1 text-xs font-semibold">{label}
      <span className="flex items-center gap-1.5"><input type="number" step={step} value={cfg[k] as number} onChange={(e) => set({ [k]: Number(e.target.value) } as Partial<GuardConfig>)} className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-sm" /><span className="font-normal text-muted">{unit}</span></span>
    </label>
  );
  const tick = (k: keyof GuardConfig, label: string) => (
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg[k] as boolean} onChange={(e) => set({ [k]: e.target.checked } as Partial<GuardConfig>)} className="accent-[var(--accent)]" />{label}</label>
  );

  return (
    <div className="flex flex-col gap-4">
      {err && <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{err}</p>}
      {note && <p role="status" className="rounded-xl border border-good/40 bg-good/10 px-4 py-2 text-sm">{note}</p>}

      <section className={`${card} ${critical.length ? "border-bad/50" : open.length ? "border-warn/50" : "border-good/40"}`} aria-labelledby="h-salud">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 id="h-salud" className="text-lg font-bold">{critical.length ? `🔴 ${critical.length} problema${critical.length > 1 ? "s" : ""} crítico${critical.length > 1 ? "s" : ""}` : open.length ? `🟡 ${open.length} cosa${open.length > 1 ? "s" : ""} para revisar` : "🟢 Todo funcionando bien"}</h3>
            <span className="text-xs text-muted">Última revisión: {when(v.lastRun)}{v.lastRun ? ` (tardó ${(v.lastMs / 1000).toFixed(1)} s)` : ""}. {v.monitorUrl ? "Revisa solo cada 5 minutos cuando el monitor externo está conectado." : "Todavía revisa solo una vez al día: conecta el monitor (abajo) para que sea cada 5 minutos."}</span>
          </div>
          <button type="button" disabled={!!busy} onClick={() => run("POST", undefined, "run")} className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg disabled:opacity-50">{busy === "run" ? "Revisando…" : "Revisar ahora"}</button>
        </div>
        {v.runs.length > 1 && (
          <div className="flex items-end gap-0.5" aria-label="Últimas revisiones">
            {v.runs.slice(0, 48).reverse().map((r) => <i key={r.at} title={`${when(r.at)}: ${r.problemas} problemas`} className={`h-4 w-1.5 rounded-sm ${r.problemas ? "bg-warn" : "bg-good"}`} />)}
          </div>
        )}
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {v.checks.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2" title={c.detalle}>
              <span className="flex min-w-0 items-center gap-2"><i className={`h-2.5 w-2.5 flex-none rounded-full ${DOT[c.estado][0]}`} aria-hidden="true" /><span className="truncate text-sm">{c.nombre}</span></span>
              <span className="whitespace-nowrap font-mono text-xs text-muted">{c.valor}<span className="sr-only"> · {DOT[c.estado][1]}</span></span>
            </li>
          ))}
          {!v.checks.length && <li className="text-sm text-muted">Toca «Revisar ahora» para la primera revisión.</li>}
        </ul>
      </section>

      <section className={card} aria-labelledby="h-problemas">
        <h3 id="h-problemas" className="text-lg font-bold">Problemas abiertos</h3>
        {open.length ? <ul className="flex flex-col gap-2">{open.map((i) => <IncidentRow key={i.key} i={i} onClose={() => run("PATCH", { cerrar: i.key })} />)}</ul> : <p className="text-sm text-muted">Ninguno. 🎉</p>}
        {done.length > 0 && (
          <details><summary className="cursor-pointer text-sm font-semibold text-accent-text">Resueltos y acciones recientes ({done.length})</summary>
            <ul className="flex flex-col gap-2 pt-3">{done.map((i) => <IncidentRow key={`${i.key}-${i.first}`} i={i} />)}</ul>
          </details>
        )}
      </section>

      <section className={card} aria-labelledby="h-pausa">
        <h3 id="h-pausa" className="text-lg font-bold">Modelos en pausa</h3>
        <p className="text-xs text-muted">Cuando un modelo falla mucho, el Guardián lo saca del estudio por unas horas para que los clientes no gasten créditos en él. Vuelve solo al terminar la pausa.</p>
        {pausedList.length ? (
          <ul className="flex flex-col gap-2">
            {pausedList.map(([id, p]) => (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                <span><b>{v.modelos.find((m) => m.id === id)?.label ?? id}</b> <span className="text-muted">· hasta {when(p.until)} · {p.motivo}</span></span>
                <button type="button" onClick={() => run("PATCH", { reactivar: id })} className={`${btn} text-xs`}>Reactivar ahora</button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Ninguno: todos los modelos disponibles.</p>}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="g-pausar" className="text-muted">Pausar a mano:</label>
          <select id="g-pausar" value={pauseId} onChange={(e) => setPauseId(e.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1.5">
            <option value="">Elige un modelo</option>
            {v.modelos.filter((m) => !v.paused[m.id]).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <button type="button" disabled={!pauseId} onClick={() => { run("PATCH", { pausar: { id: pauseId, horas: cfg.pausaHoras } }); setPauseId(""); }} className={`${btn} text-xs`}>Pausar {cfg.pausaHoras} h</button>
        </div>
      </section>

      <section className={card} aria-labelledby="h-avisos">
        <h3 id="h-avisos" className="text-lg font-bold">Cómo te avisa</h3>
        <ul className="flex flex-col gap-2 text-sm">
          <li>📧 <b>Correo:</b> cada problema crítico (máximo uno cada 6 horas por problema).</li>
          <li>💬 <b>WhatsApp:</b> {v.whatsapp ? <>conectado ({v.whatsapp === "meta" ? "WhatsApp de Meta" : "CallMeBot"}). Te llegan los críticos y cuando se resuelven (máximo 12 al día). <button type="button" disabled={!!busy} onClick={async () => { if (await run("PATCH", { probarWhatsapp: true }, "wa")) setNote("Te mandé un WhatsApp de prueba."); }} className={`${btn} ml-1 text-xs`}>{busy === "wa" ? "Enviando…" : "Mandarme uno de prueba"}</button></> : <>todavía sin conectar. Está en la lista de Lanzamiento con el paso a paso.</>}</li>
          <li>👀 <b>Monitor cada 5 minutos:</b> {v.monitorUrl ? (
            <>en <a href="https://uptimerobot.com" target="_blank" rel="noopener noreferrer" className="text-accent-text underline">UptimeRobot</a> crea un monitor «Keyword», palabra <b>OK</b>, cada 5 minutos, con esta dirección:
              <span className="mt-1 flex flex-wrap items-center gap-2"><code className="max-w-full truncate rounded bg-surface-2 px-2 py-1 text-xs">{v.monitorUrl}</code><button type="button" onClick={() => navigator.clipboard.writeText(v.monitorUrl!).then(() => setNote("Dirección copiada.")).catch(() => {})} className={`${btn} text-xs`}>Copiar</button></span>
              <span className="text-xs text-muted">No la compartas: con ella cualquiera podría pedir una revisión (no ve ningún dato).</span></>
          ) : <>falta <b>GUARDIAN_TOKEN</b> en Vercel (24 caracteres o más inventados). Con eso aparece aquí la dirección para UptimeRobot.</>}</li>
          <li>🧠 <b>Agentes:</b> cuando aparece un problema crítico, el encargado de esa área lo revisa al tiro y el CEO General lo ve en su resumen.</li>
        </ul>
      </section>

      <section className={card} aria-labelledby="h-param">
        <h3 id="h-param" className="text-lg font-bold">Parámetros de «funciona bien»</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {num("lentoMs", "Página lenta desde", "ms", 100)}
          {num("caidoMs", "Página caída desde", "ms", 500)}
          {num("dbLentoMs", "Base de datos lenta desde", "ms", 100)}
          {num("fallasPct", "Modelo fallando desde", "% de fallas")}
          {num("fallasMin", "…con al menos", "intentos en 1 h")}
          {num("pausaHoras", "Pausar un modelo por", "horas")}
          {num("trabadoMin", "Generación trabada después de", "min")}
          {num("erroresMax", "Ola de errores desde", "en 15 min")}
        </div>
        <div className="flex flex-col gap-2">
          {tick("autoPausa", "Pausar solo un modelo que falla mucho (nunca deja a los clientes sin modelos)")}
          {tick("autoTrabados", "Marcar como fallidas las generaciones trabadas y devolver los créditos")}
          {tick("whatsapp", "Mandarme WhatsApp en lo crítico")}
        </div>
        <button type="button" disabled={!!busy} onClick={async () => { if (await run("PATCH", { config: cfg }, "cfg")) setNote("Parámetros guardados."); }} className="self-start rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-bg disabled:opacity-50">{busy === "cfg" ? "Guardando…" : "Guardar parámetros"}</button>
      </section>
    </div>
  );
}
