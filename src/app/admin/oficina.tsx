"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AREAS, type AreaId } from "@/lib/areas";
import type { Incident } from "@/lib/guardian";
import { IncidentRow } from "./guardian";
import type { Action, Agent, AgentConfig, ChatMsg, Encargo, OfficeState, Proposal, Report, Source } from "@/lib/oficina";

// Panel → Oficina: the owner's Grok agents. Each one reads its area once a day (8:00), writes a report and
// proposes what to do; the area directors read their teams, and the CEO General reads everything, writes the
// one official brief and proposes moves that only happen when the owner approves them. The owner can chat with any of
// them, edit their instructions, create new ones and edit the «Memoria de Creads» they all read.

type AgentView = Agent & { cap: number };
interface View {
  ready: boolean; model: string; modelCeo: string; maxCustom: number;
  state: Pick<OfficeState, "on" | "budgetUsd" | "spend" | "last" | "tasks" | "pending" | "encargos">;
  bridge: boolean;
  agents: AgentView[];
  sources: Record<Source, { name: string; text: string; internal: boolean }>;
  memory: { text: string; updated: string | null };
}

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const btn = "rounded-lg border border-line px-3 py-1.5 text-sm font-semibold disabled:opacity-50";
const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";
const usd = (n: number) => `US$${n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString("es-CL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "nunca");
const safeUrl = (u: string) => (/^https?:\/\//.test(u) ? u : null);
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, ...(body !== undefined ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const x = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(x.error || "No se pudo completar. Prueba de nuevo.");
  return x as T;
}

function Badge({ r }: { r?: Report }) {
  if (!r) return <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">Sin informe</span>;
  if (r.error) return <span className="rounded-full bg-warn/15 px-2.5 py-1 text-xs font-semibold text-warn">⚠ No pudo trabajar</span>;
  const m = { ok: ["bg-good/15 text-good", "✓ Todo normal"], atencion: ["bg-warn/15 text-warn", "● Revisar"], urgente: ["bg-bad/15 text-bad", "▲ Urgente"] }[r.estado];
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${m[0]}`}>{m[1]}</span>;
}

function Links({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
      <b className="text-muted">Fuentes:</b>
      {urls.map((u) => { const s = safeUrl(u); return s ? <a key={u} href={s} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-text underline">{host(u)}</a> : null; })}
    </div>
  );
}

function Body({ r }: { r: Report }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      {r.informe && <p className="whitespace-pre-wrap leading-relaxed">{r.informe}</p>}
      {r.propuestas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <b className="text-xs text-muted">Propone</b>
          <ul className="flex flex-col gap-1.5">{r.propuestas.map((p, i) => <li key={i} className="rounded-lg bg-surface-2 px-3 py-2">{p}</li>)}</ul>
        </div>
      )}
      <Links urls={r.fuentes} />
      <span className="text-xs text-muted">{when(r.at)} · costó {usd(r.usd)}</span>
    </div>
  );
}

// ---------------------------------------------------------------- chat

function Chat({ v, agent, setAgent, onSpent, ids, title = "Habla con tu oficina" }: { v: View; agent: string; setAgent: (id: string) => void; onSpent: () => void; ids?: string[]; title?: string }) {
  const list = ids ? v.agents.filter((x) => ids.includes(x.id)) : v.agents;
  const [msgs, setMsgs] = useState<ChatMsg[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const a = list.find((x) => x.id === agent) ?? list[0] ?? v.agents[0];

  useEffect(() => {
    setMsgs(null); setErr("");
    api<{ msgs: ChatMsg[] }>(`/api/admin/oficina/chat?agent=${encodeURIComponent(a.id)}`, "GET").then((x) => setMsgs(x.msgs)).catch((e) => { setMsgs([]); setErr(e.message); });
  }, [a.id]);
  // scroll the conversation itself (never the page) to the newest message
  useEffect(() => { const b = box.current; if (b) b.scrollTop = b.scrollHeight; }, [msgs, busy]);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true); setErr("");
    setMsgs((m) => [...(m ?? []), { role: "user", text: t, at: new Date().toISOString() }]);
    setText("");
    try { setMsgs((await api<{ msgs: ChatMsg[] }>("/api/admin/oficina/chat", "POST", { agent: a.id, text: t })).msgs); onSpent(); }
    catch (e) { setErr(e instanceof Error ? e.message : "No se pudo enviar."); setText(t); setMsgs((m) => (m ?? []).slice(0, -1)); }
    setBusy(false);
  };
  const clear = async () => {
    if (!confirm(`¿Borrar la conversación con ${a.name}? No se puede deshacer.`)) return;
    try { setMsgs((await api<{ msgs: ChatMsg[] }>("/api/admin/oficina/chat", "DELETE", { agent: a.id })).msgs); } catch (e) { setErr(e instanceof Error ? e.message : ""); }
  };

  return (
    <section className={card} aria-labelledby="h-chat">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="h-chat" className="text-lg font-bold">{title}</h3>
        {!!msgs?.length && <button type="button" onClick={clear} className="text-xs font-semibold text-muted hover:text-ink">Borrar conversación</button>}
      </div>
      <div role="tablist" aria-label="Con quién hablar" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {list.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={x.id === a.id} disabled={busy && x.id !== a.id} onClick={() => setAgent(x.id)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold disabled:opacity-40 ${x.id === a.id ? "border-transparent bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}>
            {x.name}
          </button>
        ))}
      </div>
      <div ref={box} className="flex max-h-[60vh] min-h-[220px] flex-col gap-3 overflow-y-auto rounded-xl bg-surface-2/50 p-3" aria-live="polite">
        {msgs === null ? <p className="text-sm text-muted">Cargando…</p> : !msgs.length && !busy ? (
          <p className="m-auto max-w-md text-center text-sm text-muted">Escríbele a <b>{a.name}</b> como me escribes a mí. Responde con los datos reales de Creads{a.search ? " y puede buscar en la web y en X" : ""}. Por ejemplo: {a.id === "ceo" ? "«¿qué es lo más importante esta semana?»" : a.id === "novedades" ? "«¿qué lanzó Higgsfield este mes?»" : a.id === "produccion" ? "«¿qué modelo está fallando más y por qué?»" : "«¿qué me recomiendas hacer hoy?»"}</p>
        ) : msgs.map((m, i) => (
          <div key={i} className={`flex max-w-[92%] flex-col gap-1.5 rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "self-end bg-ink text-bg" : m.error ? "self-start border border-warn/40 bg-warn/10" : "self-start border border-line bg-surface"}`}>
            <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
            {m.role === "agent" && <Links urls={m.fuentes} />}
            {m.role === "agent" && !!m.usd && <span className="text-[11px] text-muted">{when(m.at)} · {usd(m.usd)}</span>}
          </div>
        ))}
        {busy && <p className="self-start rounded-2xl border border-line bg-surface px-3.5 py-2.5 text-sm text-muted">{a.name} está pensando… {a.search ? "(si busca en la web, hasta 1–2 minutos)" : "(unos segundos)"}</p>}
      </div>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label htmlFor="of-msg" className="sr-only">Mensaje para {a.name}</label>
        <textarea id="of-msg" rows={2} value={text} maxLength={4000} disabled={!v.ready} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          placeholder={v.ready ? `Escríbele a ${a.name}… (Enter envía, Shift+Enter baja de línea)` : "Falta la clave de Grok en Vercel"} className={`${input} min-h-[3rem] resize-y`} />
        <button disabled={busy || !text.trim() || !v.ready} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-bg disabled:opacity-50">Enviar</button>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------- agent form

function AgentForm({ v, a, onDone }: { v: View; a?: AgentView; onDone: (view?: View) => void }) {
  const builtin = a?.builtin;
  const [f, setF] = useState<AgentConfig>(() => a ? { name: a.name, area: a.area, mission: a.mission, search: a.search, sharePct: a.sharePct, sources: a.sources, equipo: a.equipo } : { name: "", area: "", mission: "", search: false, sharePct: 10, sources: ["negocio"] });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<AgentConfig>) => setF((x) => ({ ...x, ...p }));
  const id = a?.id ?? "nuevo";
  const save = async (reset = false) => {
    setBusy(true); setErr("");
    try {
      const view = builtin ? await api<View>("/api/admin/oficina", "PATCH", { agent: a!.id, mission: reset ? null : f.mission })
        : a ? await api<View>("/api/admin/oficina/agentes", "PUT", { id: a.id, ...f }) : await api<View>("/api/admin/oficina/agentes", "POST", f);
      onDone(view);
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo guardar."); }
    setBusy(false);
  };
  return (
    <form className="flex flex-col gap-3 rounded-xl border border-line bg-surface-2/40 p-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
      {!builtin && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">Nombre<input value={f.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} placeholder="Ej: Marketing" className={input} /></label>
          <label className="flex flex-col gap-1 text-sm font-semibold">De qué se encarga (corto)<input value={f.area} maxLength={80} onChange={(e) => set({ area: e.target.value })} placeholder="Ej: Ideas de anuncios para Creads" className={input} /></label>
        </div>
      )}
      <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor={`m-${id}`}>Instrucciones</label>
      <textarea id={`m-${id}`} rows={6} value={f.mission} maxLength={4000} onChange={(e) => set({ mission: e.target.value })} className={`${input} -mt-2 resize-y`}
        placeholder="Explícale como a una persona nueva: qué rol tiene, qué tiene que mirar, qué esperas que te entregue y qué no debe hacer. Ej: «Eres el encargado de marketing de Creads. Cada día revisa las visitas y ventas por canal, propón 3 ideas de anuncios…»" />
      {!builtin && (
        <>
          <label className="flex flex-col gap-1 text-sm font-semibold">Área donde trabaja
            <select value={f.equipo ?? "direccion"} onChange={(e) => set({ equipo: e.target.value as AreaId })} className={input}>
              {AREAS.filter((x) => x.id !== "lanzamiento").map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <span className="text-xs font-normal text-muted">Le reporta al encargado de esa área (o directo al CEO General).</span>
          </label>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-sm font-semibold">Qué datos de Creads puede leer</legend>
            {(Object.keys(v.sources) as Source[]).map((s) => (
              <label key={s} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={f.sources.includes(s)} onChange={(e) => set({ sources: e.target.checked ? [...f.sources, s] : f.sources.filter((x) => x !== s) })} />
                <span><b>{v.sources[s].name}</b> <span className="text-muted">· {v.sources[s].text}</span></span>
              </label>
            ))}
          </fieldset>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={f.search} onChange={(e) => set({ search: e.target.checked })} />
            <span><b>Puede buscar en internet y en X</b> <span className="text-muted">· cuesta un poco más. Por seguridad busca primero sin ver tus datos y después los analiza.</span></span>
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">Su parte del presupuesto
            <input type="number" min={1} max={60} value={f.sharePct} onChange={(e) => set({ sharePct: Number(e.target.value) })} className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 font-mono" />%
            <span className="font-normal text-muted">= {usd((v.state.budgetUsd * (f.sharePct || 0)) / 100)} al mes</span>
          </label>
        </>
      )}
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} className="rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-bg disabled:opacity-50">{busy ? "Guardando…" : a ? "Guardar cambios" : "Crear agente"}</button>
        <button type="button" onClick={() => onDone()} className={btn}>Cancelar</button>
        {builtin && <button type="button" disabled={busy} onClick={() => save(true)} className={btn}>Volver a las instrucciones originales</button>}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- moves and assignments

function actionText(a: Action) {
  if (a.tipo === "encargo") return { title: `Encargo para Claude: ${a.titulo}`, body: `Problema: ${a.problema || "—"}\nQué hacer: ${a.que}\nPara quién: ${a.para || "Gastón"}\nCómo se sabe que quedó bien: ${a.listo || "—"}` };
  if (a.tipo === "memoria") return { title: "Agregar a la Memoria de Creads", body: a.texto };
  if (a.tipo === "agente") return { title: `${a.on ? "Prender" : "Apagar"} el agente «${a.id}»`, body: a.motivo };
  if (a.tipo === "anuncio") return { title: `Pedir anuncio a Creads: ${a.titulo}`, body: `Formato: ${a.formato} · ${a.idioma === "en" ? "inglés" : "español"}\nIdea: ${a.idea || "—"}\n\nGuion:\n${a.guion}` };
  if (a.tipo === "campana") {
    const c = a.spec;
    return { title: `Subir campaña EN PAUSA: ${c.nombre}`, body: `Objetivo: ${c.objetivo} · Países: ${c.paises.join(", ")} · Edad ${c.edadMin}–${c.edadMax}\nPresupuesto: US$${c.presupuestoUsd}/día (no gasta hasta que la actives)\nTexto: ${c.texto}\nTítulo: ${c.titulo} · Botón: ${c.cta}\nLink: ${c.link}\nAnuncio de Creads: ${c.adId.slice(0, 8)}…\n\nPor qué: ${a.motivo || "—"}` };
  }
  if (a.tipo === "campana_estado") return { title: `${a.on ? "ACTIVAR (empieza a gastar)" : "Pausar"} la campaña ${a.nombre || a.campaignId}`, body: a.motivo };
  if (a.tipo === "presupuesto") return { title: `Cambiar presupuesto de ${a.nombre || a.campaignId} a US$${a.usd}/día`, body: a.motivo };
  return { title: `Publicar en Instagram (${a.cuenta})`, body: `Video de Creads: ${a.adId.slice(0, 8)}…\nTexto:\n${a.texto}\n\nPor qué: ${a.motivo || "—"}` };
}

const AGENT_NAMES: Record<string, string> = { general: "el CEO General", guardian: "el Guardián", ceo: "el Director de Plataforma", marketing: "el Director de Marketing", creativos: "Creativos", trafico: "el Trafficker", organico: "Contenido orgánico" };

function Approvals({ list, onDecide, busy }: { list: Proposal[]; onDecide: (id: string, ok: boolean) => void; busy: string | null }) {
  const pending = list.filter((p) => p.estado === "pendiente");
  const done = list.filter((p) => p.estado !== "pendiente").slice(0, 5);
  if (!list.length) return null;
  return (
    <section className={card} aria-labelledby="h-aprobar">
      <h3 id="h-aprobar" className="text-lg font-bold">Por aprobar {pending.length > 0 && <span className="ml-1 rounded-full bg-warn/15 px-2 py-0.5 text-sm text-warn">{pending.length}</span>}</h3>
      {pending.length ? (
        <ul className="flex flex-col gap-2">
          {pending.map((p) => { const t = actionText(p.action); return (
            <li key={p.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
              <b className="text-sm">{t.title}</b>
              <p className="whitespace-pre-wrap text-sm text-muted">{t.body}</p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={!!busy} onClick={() => onDecide(p.id, true)} className="rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-bg disabled:opacity-50">{busy === p.id ? "Haciendo…" : "Aprobar"}</button>
                <button type="button" disabled={!!busy} onClick={() => onDecide(p.id, false)} className={btn}>Rechazar</button>
                <span className="text-xs text-muted">Propuesto por {AGENT_NAMES[p.by] ?? p.by} · {when(p.at)}</span>
              </div>
            </li>
          ); })}
        </ul>
      ) : <p className="text-sm text-muted">Nada pendiente.</p>}
      {done.length > 0 && (
        <details><summary className="cursor-pointer text-xs font-semibold text-muted">Últimas decisiones</summary>
          <ul className="flex flex-col gap-1 pt-2 text-xs text-muted">{done.map((p) => <li key={p.id}>{p.estado === "aprobada" ? "✓" : p.estado === "rechazada" ? "✕" : p.estado === "aprobando" ? "…" : "⚠"} {actionText(p.action).title} — {p.resultado}</li>)}</ul>
        </details>
      )}
    </section>
  );
}

function Encargos({ list, bridge, onMark }: { list: Encargo[]; bridge: boolean; onMark: (id: string, estado: Encargo["estado"]) => void }) {
  const [copied, setCopied] = useState("");
  if (!list.length) return null;
  const copy = async (e: Encargo) => { try { await navigator.clipboard.writeText(`Encargo del CEO General: ${e.titulo}\n\n${e.texto.replace(/\*\*/g, "")}`); setCopied(e.id); } catch {} };
  const tone: Record<Encargo["estado"], string> = { "por enviar": "bg-warn/15 text-warn", enviado: "bg-surface-2 text-muted", "en curso": "bg-accent/15 text-accent-text", listo: "bg-good/15 text-good" };
  return (
    <section className={card} aria-labelledby="h-encargos">
      <div className="flex flex-col gap-0.5">
        <h3 id="h-encargos" className="text-lg font-bold">Encargos para Claude</h3>
        <span className="text-xs text-muted">{bridge ? "Se envían solos a Claude (tareas en GitHub). Dile a Claude «revisa los encargos» para que los haga." : "Todavía sin conexión automática: copia el encargo y pégaselo a Claude. Después márcalo como enviado."}</span>
      </div>
      <ul className="flex flex-col divide-y divide-line">
        {list.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span className="flex min-w-0 flex-col"><b className="text-sm">{e.titulo}</b><span className="text-xs text-muted">{when(e.at)}{e.url && safeUrl(e.url) ? <> · <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-accent-text underline">tarea #{e.issue}</a></> : null}</span></span>
            <span className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone[e.estado]}`}>{e.estado}</span>
              {!e.issue && <button type="button" onClick={() => copy(e)} className={`${btn} text-xs`}>{copied === e.id ? "¡Copiado!" : "Copiar"}</button>}
              {!e.issue && e.estado === "por enviar" && <button type="button" onClick={() => onMark(e.id, "enviado")} className={`${btn} text-xs`}>Marcar enviado</button>}
              {!e.issue && e.estado !== "listo" && e.estado !== "por enviar" && <button type="button" onClick={() => onMark(e.id, "listo")} className={`${btn} text-xs`}>Marcar listo</button>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The area's head first, then its team in order, then agents the owner created. */
const rank = (order: string[], id: string) => { const i = order.indexOf(id); return i < 0 ? 99 : i; };

// ---------------------------------------------------------------- an area's team (shown on top of each area of the panel)

/** The agents in charge of one area: their last report and a chat with them, right where their pages are. */
export function AreaTeam({ area }: { area: AreaId }) {
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [talk, setTalk] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [inc, setInc] = useState<Incident[]>([]);
  const load = useCallback(() => { api<View>("/api/admin/oficina", "GET").then(setV).catch((e) => setErr(e instanceof Error ? e.message : "")); }, []);
  useEffect(() => {
    load();
    // what the Guardián found in this area
    api<{ incidents: Incident[] }>("/api/admin/guardian", "GET").then((g) => setInc(g.incidents.filter((i) => i.abierto && i.area === area))).catch(() => {});
  }, [load, area]);
  if (err) return null; // the area's pages still work without the office
  if (!v) return <div className="h-14 animate-pulse rounded-2xl bg-surface-2" aria-hidden="true" />;
  const order = AREAS.find((x) => x.id === area)?.agents ?? [];
  const team = v.agents.filter((a) => a.equipo === area).sort((x, y) => rank(order, x.id) - rank(order, y.id));
  if (!team.length) return null;
  const run = async (id: string) => {
    setBusy(id);
    try { setV(await api<View>("/api/admin/oficina", "POST", { agent: id })); } catch (e) { setErr(e instanceof Error ? e.message : ""); }
    setBusy(null);
  };
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3" aria-label="Encargados del área">
      {inc.length > 0 && (
        <div className="flex flex-col gap-2">
          <b className="text-xs text-muted">El Guardián vio en esta área:</b>
          <ul className="flex flex-col gap-2">{inc.slice(0, 3).map((i) => <IncidentRow key={i.key} i={i} />)}</ul>
        </div>
      )}
      <ul className="flex flex-col divide-y divide-line">
        {team.map((a, i) => {
          const r = v.state.last[a.id];
          return (
            <li key={a.id} className="flex flex-col gap-2 py-2 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex min-w-0 flex-col">
                  <b className="text-sm">{a.name}{i === 0 && team.length > 1 ? <span className="ml-1.5 text-xs font-normal text-muted">· encargado del área</span> : null}{!a.on && <span className="ml-1.5 text-xs font-normal text-muted">· apagado</span>}</b>
                  <span className={`text-xs ${r?.error ? "text-warn" : "text-muted"}`}>{r ? r.resumen : a.area}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Badge r={r} />
                  {r && !r.error && <button type="button" onClick={() => setOpen(open === a.id ? null : a.id)} aria-expanded={open === a.id} className={`${btn} text-xs`}>{open === a.id ? "Ocultar" : "Informe"}</button>}
                  <button type="button" onClick={() => setTalk(talk === a.id ? null : a.id)} aria-expanded={talk === a.id} className={`${btn} text-xs`}>{talk === a.id ? "Cerrar chat" : "Hablar"}</button>
                  <button type="button" disabled={!!busy || !v.ready || !a.on} onClick={() => run(a.id)} className={`${btn} text-xs`}>{busy === a.id ? "Trabajando…" : "Trabajar ahora"}</button>
                </span>
              </div>
              {open === a.id && r && <div className="rounded-xl bg-surface-2/50 p-3"><Body r={r} /></div>}
            </li>
          );
        })}
      </ul>
      {talk && <Chat v={v} agent={talk} setAgent={setTalk} ids={team.map((a) => a.id)} title="Habla con el equipo del área" onSpent={load} />}
      {v.state.pending.some((p) => p.estado === "pendiente") && <p className="text-xs text-muted">Hay movimientos esperando tu aprobación en <b>Dirección</b>.</p>}
    </section>
  );
}

// ---------------------------------------------------------------- the page

export default function Oficina() {
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<string | null>(null);
  const [talk, setTalk] = useState("general");
  const [note, setNote] = useState("");
  const [budget, setBudget] = useState("");
  const [memory, setMemory] = useState("");
  const [memMsg, setMemMsg] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  // the budget and memory boxes are only refilled on the first load and when they themselves are saved,
  // so a long run or a checkbox never wipes what the owner is typing
  const apply = useCallback((x: View, fill = false) => { setV(x); if (fill) { setBudget(String(x.state.budgetUsd)); setMemory(x.memory.text); } }, []);
  const call = useCallback(async (method: "GET" | "POST" | "PATCH", body?: unknown, fill = false): Promise<boolean> => {
    setErr("");
    try { apply(await api<View>("/api/admin/oficina", method, body), fill); return true; } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo cargar la oficina."); return false; }
  }, [apply]);
  useEffect(() => { call("GET", undefined, true); }, [call]);
  const refresh = useCallback(() => { api<View>("/api/admin/oficina", "GET").then((x) => setV((old) => ({ ...x, memory: old?.memory ?? x.memory }))).catch(() => {}); }, []);

  const run = async (agent: string) => {
    setBusy(agent);
    // the whole office in three steps (each well inside the server's time limit): the team, the Director, the CEO General
    if (agent === "todos") {
      if (await call("POST", { agent: "equipo" })) { setBusy("ceo"); if (await call("POST", { agent: "directores" })) { setBusy("general"); await call("POST", { agent: "general" }); } }
    }
    else await call("POST", { agent });
    setBusy(null);
  };
  const remove = async (a: AgentView) => {
    if (!confirm(`¿Eliminar a ${a.name}? Se borran sus informes y su conversación.`)) return;
    try { apply(await api<View>("/api/admin/oficina/agentes", "DELETE", { id: a.id })); if (talk === a.id) setTalk("general"); } catch (e) { setErr(e instanceof Error ? e.message : ""); }
  };
  const decideMove = async (id: string, aprobar: boolean) => {
    setBusy(id); setNote("");
    try { const x = await api<View & { mensaje?: string }>("/api/admin/oficina", "PATCH", { decide: id, aprobar }); apply(x, true); setNote(x.mensaje ?? ""); } catch (e) { setErr(e instanceof Error ? e.message : ""); }
    setBusy(null);
  };
  const talkTo = (id: string) => { setTalk(id); chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  if (!v) return <div className={card}>{err ? <p role="alert" className="text-bad">{err}</p> : <p className="text-muted">Cargando la oficina…</p>}</div>;
  const st = v.state;
  const ceo = st.last.general; // the official brief comes from the CEO General
  const workers = v.agents.filter((a) => !["general", "ceo", "marketing"].includes(a.id));
  const customs = workers.filter((a) => !a.builtin).length;
  const pct = st.budgetUsd ? Math.min(100, (st.spend.usd / st.budgetUsd) * 100) : 100;

  return (
    <div className="flex flex-col gap-4">
      {!v.ready && <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">Falta la clave de Grok: Vercel → Environment Variables → <b>XAI_API_KEY</b> y después Redeploy.</p>}
      {err && <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{err}</p>}

      <section className={`${card} border-accent/40`} aria-labelledby="h-ceo">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 id="h-ceo" className="text-lg font-bold">CEO General · resumen oficial del día</h3>
            <span className="text-xs text-muted">Tu mano derecha: lee a todas las áreas y los números reales, y decide qué es lo primero. Es el único resumen que te llega por correo a las 8:00.</span>
          </div>
          <span className="flex flex-wrap items-center gap-2"><Badge r={ceo} />
            <button type="button" disabled={!!busy || !v.ready || !st.on} onClick={() => run("todos")} className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg disabled:opacity-50">
              {busy === "todos" ? "1/3 · El equipo está trabajando…" : busy === "ceo" ? "2/3 · Los directores están escribiendo…" : busy === "general" ? "3/3 · El CEO General está escribiendo…" : "Hacer trabajar a todos ahora"}
            </button>
          </span>
        </div>
        {ceo && !ceo.error ? (
          <>
            <p className="text-base font-semibold">{ceo.resumen}</p>
            {!!ceo.prioridades?.length && (
              <ol className="flex flex-col gap-2">
                {ceo.prioridades.map((p, i) => <li key={i} className="flex gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-sm"><b className="text-accent-text">{i + 1}</b><span>{p}</span></li>)}
              </ol>
            )}
            <details><summary className="cursor-pointer text-sm font-semibold text-accent-text">Ver el resumen completo</summary><div className="pt-3"><Body r={ceo} /></div></details>
          </>
        ) : ceo?.error ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-warn">{ceo.resumen}</p>
            <button type="button" disabled={!!busy || !v.ready} onClick={() => run("general")} className={`${btn} text-ink`}>{busy === "general" ? "Trabajando…" : "Que el CEO General lo intente de nuevo"}</button>
            <button type="button" onClick={() => call("PATCH", { dismiss: "general" })} className={`${btn} text-ink`}>Quitar aviso</button>
          </div>
        ) : (
          <p className="text-sm text-muted">Todavía no hay resumen. Toca «Hacer trabajar a todos ahora» para la primera ronda (cuesta unos centavos) o espera a mañana a las 8:00.</p>
        )}
      </section>

      {note && <p role="status" className="rounded-xl border border-good/40 bg-good/10 px-4 py-2 text-sm">{note}</p>}
      <Approvals list={st.pending} onDecide={decideMove} busy={busy} />
      <Encargos list={st.encargos} bridge={v.bridge} onMark={(id, estado) => call("PATCH", { encargo: id, estado })} />

      <div ref={chatRef} className="scroll-mt-4"><Chat v={v} agent={talk} setAgent={setTalk} onSpent={refresh} /></div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Tus agentes</h3>
        <button type="button" disabled={customs >= v.maxCustom} onClick={() => setEdit("nuevo")} className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg disabled:opacity-50">+ Nuevo agente</button>
      </div>
      {edit === "nuevo" && <section className={card} aria-label="Nuevo agente"><h4 className="font-bold">Nuevo agente</h4><AgentForm v={v} onDone={(x) => { if (x) apply(x); setEdit(null); }} /></section>}

      {AREAS.filter((ar) => ar.id !== "lanzamiento").map((ar) => {
        const team = v.agents.filter((a) => (a.equipo ?? "direccion") === ar.id).sort((x, y) => rank(ar.agents, x.id) - rank(ar.agents, y.id));
        if (!team.length) return null;
        return (
      <section key={ar.id} className="flex flex-col gap-2" aria-label={`Área ${ar.name}`}>
        <div className="flex items-baseline gap-2"><h4 className="font-bold">{ar.name}</h4><span className="text-xs text-muted">{ar.what}</span></div>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        {team.map((a) => {
          const r = st.last[a.id];
          const task = st.tasks[a.id];
          return (
            <section key={a.id} className={`${card} ${a.on ? "" : "opacity-60"}`} aria-labelledby={`h-${a.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 flex-col">
                  <h3 id={`h-${a.id}`} className="font-bold">{a.name}{!a.builtin && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold text-muted">creado por ti</span>}</h3>
                  <span className="text-xs text-muted">{a.area}{a.search ? " · busca en la web y en X" : ""}</span>
                </div>
                <Badge r={r} />
              </div>
              {a.id !== "general" && (r ? <p className={`text-sm ${r.error ? "text-warn" : ""}`}>{r.resumen}</p> : <p className="text-sm text-muted">Todavía no ha trabajado.</p>)}
              {task && <p className="rounded-lg border border-line px-3 py-2 text-xs"><b>{a.id === "ceo" || a.id === "marketing" ? "El CEO General sugiere mirar:" : "Su director sugiere mirar:"}</b> {task}</p>}
              {a.id !== "general" && r && !r.error && (
                <>
                  <button type="button" onClick={() => setOpen((o) => ({ ...o, [a.id]: !o[a.id] }))} aria-expanded={!!open[a.id]} className="self-start text-sm font-semibold text-accent-text">
                    {open[a.id] ? "Ocultar informe" : `Ver informe${r.propuestas.length ? ` y ${r.propuestas.length} propuesta${r.propuestas.length > 1 ? "s" : ""}` : ""}`}
                  </button>
                  {open[a.id] && <Body r={r} />}
                </>
              )}
              {edit === a.id && <AgentForm v={v} a={a} onDone={(x) => { if (x) apply(x); setEdit(null); }} />}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
                <span>Último: {when(r?.at)} · mes: {usd(st.spend.byAgent[a.id] ?? 0)} de {usd(a.cap)}</span>
                <span className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={a.on} onChange={(e) => call("PATCH", { agent: a.id, agentOn: e.target.checked })} className="accent-[var(--accent)]" />Activo</label>
                  <button type="button" onClick={() => talkTo(a.id)} className={`${btn} text-xs text-ink`}>Hablar</button>
                  <button type="button" onClick={() => setEdit(edit === a.id ? null : a.id)} className={`${btn} text-xs text-ink`}>Editar</button>
                  {!a.builtin && <button type="button" onClick={() => remove(a)} className={`${btn} text-xs text-bad`}>Eliminar</button>}
                  {r?.error && <button type="button" onClick={() => call("PATCH", { dismiss: a.id })} className={`${btn} text-xs text-ink`}>Quitar aviso</button>}
                  {<button type="button" disabled={!!busy || !v.ready || !a.on} onClick={() => run(a.id)} className={`${btn} text-xs text-ink`}>{busy === a.id ? "Trabajando…" : "Trabajar ahora"}</button>}
                </span>
              </div>
            </section>
          );
        })}
      </div>
      </section>
        );
      })}

      <section className={card} aria-labelledby="h-budget">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="h-budget" className="text-sm font-semibold text-muted">Gasto de la oficina este mes</h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={st.on} onChange={(e) => call("PATCH", { on: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
            Oficina encendida (trabaja sola cada día a las 8:00)
          </label>
        </div>
        <div className="flex items-baseline gap-2"><b className="font-mono text-2xl">{usd(st.spend.usd)}</b><span className="text-sm text-muted">de {usd(st.budgetUsd)} de tope</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Gasto del mes">
          <i className={`block h-full rounded-full ${pct >= 90 ? "bg-bad" : pct >= 70 ? "bg-warn" : "bg-[var(--viz-1)]"}`} style={{ width: `${Math.max(1, pct)}%` }} />
        </div>
        <form className="flex flex-wrap items-center gap-2 text-sm" onSubmit={(e) => { e.preventDefault(); call("PATCH", { budgetUsd: Number(budget.replace(",", ".")) }, true); }}>
          <label htmlFor="of-tope">Tope al mes (US$)</label>
          <input id="of-tope" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 font-mono" />
          <button className={btn}>Guardar</button>
          <span className="text-xs text-muted">Cada agente usa su % del tope (el chat también cuenta); si lo gasta, para hasta el mes siguiente. Se paga con el saldo de console.x.ai.</span>
        </form>
      </section>

      <section className={card} aria-labelledby="h-mem">
        <details>
          <summary className="cursor-pointer">
            <span id="h-mem" className="font-bold">Memoria de Creads</span>
            <span className="ml-2 text-xs text-muted">Lo que saben todos los agentes antes de trabajar · {v.memory.updated ? `editada ${when(v.memory.updated)}` : "versión inicial"}</span>
          </summary>
          <form className="flex flex-col gap-2 pt-3" onSubmit={async (e) => { e.preventDefault(); setMemMsg(""); if (await call("PATCH", { memoria: memory }, true)) setMemMsg("Guardada. Los agentes la usan desde su próximo trabajo."); }}>
            <label htmlFor="of-mem" className="text-xs text-muted">Escribe aquí decisiones, precios, metas, clientes clave o lo que quieras que tengan presente. No pongas claves ni contraseñas.</label>
            <textarea id="of-mem" rows={16} value={memory} maxLength={20000} onChange={(e) => setMemory(e.target.value)} className={`${input} font-mono text-xs leading-relaxed`} />
            <div className="flex flex-wrap items-center gap-3">
              <button className="rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-bg">Guardar memoria</button>
              <span className="text-xs text-muted">{memory.length.toLocaleString("es-CL")} / 20.000</span>
              {memMsg && <span className="text-xs text-good" role="status">{memMsg}</span>}
            </div>
          </form>
        </details>
      </section>

      <p className="text-xs text-muted">Los agentes solo leen y proponen: no pueden cambiar nada en Creads, gastar plata de clientes ni escribirles. Usan Grok ({v.model}; el CEO {v.modelCeo}). Antes de enviarles preguntas de clientes se quitan correos, teléfonos y números.</p>
    </div>
  );
}
