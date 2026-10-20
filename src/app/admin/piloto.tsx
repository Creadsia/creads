"use client";

import { useState } from "react";
import type { Cuenta, MarketingState } from "@/lib/marketing";
import type { PausaAuto, Reel } from "@/lib/piloto";

// Panel → Marketing → Piloto orgánico: each brand account gets a character and a schedule; the reels the
// autopilot writes wait here for approval (unless «revisar» is off); below, the rule that pauses campaigns
// that spend badly. Internal only: this is Creads' own marketing, never a customer feature.

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const btn = "rounded-lg border border-line px-3 py-1.5 text-sm font-semibold disabled:opacity-50";
const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";
const when = (iso?: string) => (iso ? new Date(iso).toLocaleString("es-CL", { timeZone: "America/Santiago", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const DEF = { on: false, porDia: 1, horas: [12, 19], revisar: true };

type Patch = (body: unknown) => Promise<boolean>;

function CuentaPiloto({ c, avatares, patch }: { c: Cuenta; avatares: { id: string; nombre: string }[]; patch: Patch }) {
  const p = { ...DEF, ...(c.piloto ?? {}) };
  const [angulo, setAngulo] = useState(c.angulo ?? "");
  const [horas, setHoras] = useState(p.horas.join(", "));
  const set = (x: Record<string, unknown>) => patch({ piloto: { cuentaId: c.id, ...x } });
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>{c.nombre}</b>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={p.on} onChange={(e) => set({ on: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
          Piloto encendido
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Quién sale en cámara
          <select value={c.avatarId ?? ""} onChange={(e) => set({ avatarId: e.target.value })} className={input}>
            <option value="">Una persona distinta cada vez</option>
            {avatares.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Para qué es la cuenta
          <select value={c.rol ?? "marca"} onChange={(e) => set({ rol: e.target.value })} className={input}>
            <option value="profesor">Profesor: enseña y lleva a la masterclass</option>
            <option value="personaje">Personaje: entretiene, sin vender</option>
            <option value="marca">Marca: muestra Creads</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Reels al día
          <select value={p.porDia} onChange={(e) => set({ porDia: Number(e.target.value) })} className={input}>
            {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <form className="grid gap-2 sm:grid-cols-[1fr_180px_auto]" onSubmit={(e) => { e.preventDefault(); set({ angulo, horas: horas.split(/[,\s]+/).map(Number).filter((h) => !Number.isNaN(h)) }); }}>
        <input aria-label={`Ángulo de ${c.nombre}`} placeholder="Ángulo (ej: e-commerce: vende más con anuncios sin grabar)" value={angulo} onChange={(e) => setAngulo(e.target.value)} className={input} />
        <input aria-label={`Horas de publicación de ${c.nombre}`} placeholder="Horas (ej: 12, 19)" value={horas} onChange={(e) => setHoras(e.target.value)} className={`${input} font-mono`} />
        <button className={btn}>Guardar</button>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={p.revisar} onChange={(e) => set({ revisar: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
          Pedir aprobación antes de producir
        </label>
        <button type="button" onClick={() => set({ planearAhora: true })} className={btn}>Planear ahora</button>
      </div>
      {!p.revisar && <p className="text-xs text-warn">Sin aprobación: esta cuenta produce y publica sola. Úsalo solo cuando ya confíes en sus reels.</p>}
    </li>
  );
}

function ReelCard({ r, cuenta, patch }: { r: Reel; cuenta: string; patch: Patch }) {
  const [guion, setGuion] = useState(r.guion);
  const [caption, setCaption] = useState(r.caption);
  const edited = guion !== r.guion || caption !== r.caption;
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="text-sm">{r.titulo}</b><span className="text-xs text-muted">{cuenta}</span></div>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Lo que dice
        <textarea value={guion} onChange={(e) => setGuion(e.target.value)} rows={3} className={`${input} leading-relaxed`} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Texto de la publicación
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} className={`${input} leading-relaxed`} />
      </label>
      <span className="flex flex-wrap gap-2">
        <button type="button" onClick={async () => { if (edited) await patch({ reel: { id: r.id, accion: "editar", guion, caption } }); await patch({ reel: { id: r.id, accion: "aprobar" } }); }} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">{edited ? "Guardar y aprobar" : "Aprobar"}</button>
        <button type="button" onClick={() => patch({ reel: { id: r.id, accion: "descartar" } })} className={`${btn} text-bad`}>Descartar</button>
      </span>
    </li>
  );
}

const ESTADO: Record<string, string> = { aprobada: "Aprobado, entra a producción", produciendo: "Produciéndose en Creads", programada: "Programado", publicada: "Publicado", error: "Con error" };

export default function Piloto({ s, avatares, pausa, patch }: { s: MarketingState; avatares: { id: string; nombre: string }[]; pausa: PausaAuto; patch: Patch }) {
  const reels = s.reels ?? [];
  const name = (id: string) => s.cuentas.find((c) => c.id === id)?.nombre ?? "cuenta borrada";
  const porAprobar = reels.filter((r) => r.estado === "propuesta");
  const enCamino = reels.filter((r) => ["aprobada", "produciendo", "programada", "error"].includes(r.estado));
  const publicados = reels.filter((r) => r.estado === "publicada").slice(0, 10);
  const cuentasConPropuestas = [...new Set(porAprobar.map((r) => r.cuentaId))];
  const [cpa, setCpa] = useState(String(pausa.cpaMax));
  const [sin, setSin] = useState(String(pausa.gastoSinResultado));

  return (
    <>
      <section className={card} aria-labelledby="h-piloto">
        <h3 id="h-piloto" className="text-lg font-bold">Piloto orgánico</h3>
        <p className="text-sm text-muted">Cada cuenta tiene su personaje y su horario. El piloto escribe unos 3 días de reels, los produce en Creads con ese personaje y los publica en las horas que elijas (hora de Chile). Necesita la producción automática encendida, con un máximo diario que alcance para todas las cuentas.</p>
        {s.cuentas.length
          ? <ul className="flex flex-col gap-3">{s.cuentas.map((c) => <CuentaPiloto key={c.id} c={c} avatares={avatares} patch={patch} />)}</ul>
          : <p className="text-sm text-muted">Primero agrega las cuentas de Instagram (arriba).</p>}
      </section>

      <section className={card} aria-labelledby="h-reels">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="h-reels" className="text-lg font-bold">Reels por aprobar ({porAprobar.length})</h3>
          <span className="flex flex-wrap gap-2">
            {cuentasConPropuestas.map((id) => <button key={id} type="button" onClick={() => patch({ aprobarTodo: id })} className={btn}>Aprobar todos de {name(id)}</button>)}
          </span>
        </div>
        {porAprobar.length
          ? <ul className="flex flex-col gap-2">{porAprobar.map((r) => <ReelCard key={r.id} r={r} cuenta={name(r.cuentaId)} patch={patch} />)}</ul>
          : <p className="text-sm text-muted">Nada por aprobar. Cuando el piloto prepare reels nuevos te llega un correo.</p>}
        {!!enCamino.length && (
          <details open><summary className="cursor-pointer text-sm font-semibold text-accent-text">En camino ({enCamino.length})</summary>
            <ul className="flex flex-col divide-y divide-line pt-2 text-sm">
              {enCamino.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span><b>{r.titulo}</b> <span className="text-muted">· {name(r.cuentaId)}</span>{r.error && <span className="block text-xs text-bad">{r.error}</span>}</span>
                  <span className="flex items-center gap-2 text-xs text-muted">
                    {ESTADO[r.estado]}{r.estado === "programada" ? `: ${when(r.publicarEn)}` : ""}
                    {(r.estado === "programada" || r.estado === "error" || r.estado === "aprobada") && <button type="button" onClick={() => patch({ reel: { id: r.id, accion: "descartar" } })} className={`${btn} text-xs`}>Quitar</button>}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
        {!!publicados.length && (
          <details><summary className="cursor-pointer text-sm font-semibold text-accent-text">Publicados ({publicados.length})</summary>
            <ul className="flex flex-col divide-y divide-line pt-2 text-sm">
              {publicados.map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2"><span><b>{r.titulo}</b> <span className="text-muted">· {name(r.cuentaId)}</span></span><span className="text-xs text-muted">{when(r.publicarEn)}{r.ensayo ? " · modo ensayo (Meta sin conectar)" : ""}</span></li>)}
            </ul>
          </details>
        )}
      </section>

      <section className={card} aria-labelledby="h-pausa">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="h-pausa" className="text-lg font-bold">Pausa automática de campañas</h3>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={pausa.on} onChange={(e) => patch({ pausaAuto: { on: e.target.checked } })} className="h-4 w-4 accent-[var(--accent)]" />Encendida</label>
        </div>
        <p className="text-sm text-muted">Dos veces al día revisa las campañas activas y pausa sola las que gastan mal. Solo baja el gasto: nunca activa ni sube nada.</p>
        <form className="flex flex-wrap items-end gap-3 text-sm" onSubmit={(e) => { e.preventDefault(); patch({ pausaAuto: { cpaMax: Number(cpa.replace(",", ".")), gastoSinResultado: Number(sin.replace(",", ".")) } }); }}>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Pausar si cada resultado cuesta más de (US$)
            <input inputMode="decimal" value={cpa} onChange={(e) => setCpa(e.target.value)} className="w-28 rounded-lg border border-line bg-surface px-2 py-1.5 font-mono" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Pausar si gastó sin ningún resultado (US$, 7 días)
            <input inputMode="decimal" value={sin} onChange={(e) => setSin(e.target.value)} className="w-28 rounded-lg border border-line bg-surface px-2 py-1.5 font-mono" />
          </label>
          <button className={btn}>Guardar</button>
        </form>
        {!!(s.bitacora ?? []).length && (
          <ul className="flex flex-col gap-1 border-t border-line pt-2 text-xs text-muted">
            {(s.bitacora ?? []).slice(0, 8).map((b) => <li key={b.at + b.texto}>{when(b.at)} · {b.texto}</li>)}
          </ul>
        )}
      </section>
    </>
  );
}
