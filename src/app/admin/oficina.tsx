"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Agent, AgentConfig, ChatMsg, OfficeState, Report, Source } from "@/lib/oficina";

// Panel → Oficina: the owner's Grok agents. Each one reads its area once a day (8:00), writes a report and
// proposes what to do; the CEO reads them all and writes the day's brief. The owner can chat with any of
// them, edit their instructions, create new ones and edit the «Memoria de Creads» they all read.

type AgentView = Agent & { cap: number };
interface View {
  ready: boolean; model: string; modelCeo: string; maxCustom: number;
  state: Pick<OfficeState, "on" | "budgetUsd" | "spend" | "last" | "tasks">;
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

function Chat({ v, agent, setAgent, onSpent }: { v: View; agent: string; setAgent: (id: string) => void; onSpent: () => void }) {
  const [msgs, setMsgs] = useState<ChatMsg[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const a = v.agents.find((x) => x.id === agent) ?? v.agents[0];

  useEffect(() => {
    setMsgs(null); setErr("");
    api<{ msgs: ChatMsg[] }>(`/api/admin/oficina/chat?agent=${encodeURIComponent(agent)}`, "GET").then((x) => setMsgs(x.msgs)).catch((e) => { setMsgs([]); setErr(e.message); });
  }, [agent]);
  // scroll the conversation itself (never the page) to the newest message
  useEffect(() => { const b = box.current; if (b) b.scrollTop = b.scrollHeight; }, [msgs, busy]);

  const send = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true); setErr("");
    setMsgs((m) => [...(m ?? []), { role: "user", text: t, at: new Date().toISOString() }]);
    setText("");
    try { setMsgs((await api<{ msgs: ChatMsg[] }>("/api/admin/oficina/chat", "POST", { agent, text: t })).msgs); onSpent(); }
    catch (e) { setErr(e instanceof Error ? e.message : "No se pudo enviar."); setText(t); setMsgs((m) => (m ?? []).slice(0, -1)); }
    setBusy(false);
  };
  const clear = async () => {
    if (!confirm(`¿Borrar la conversación con ${a.name}? No se puede deshacer.`)) return;
    try { setMsgs((await api<{ msgs: ChatMsg[] }>("/api/admin/oficina/chat", "DELETE", { agent })).msgs); } catch (e) { setErr(e instanceof Error ? e.message : ""); }
  };

  return (
    <section className={card} aria-labelledby="h-chat">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="h-chat" className="text-lg font-bold">Habla con tu oficina</h3>
        {!!msgs?.length && <button type="button" onClick={clear} className="text-xs font-semibold text-muted hover:text-ink">Borrar conversación</button>}
      </div>
      <div role="tablist" aria-label="Con quién hablar" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {v.agents.map((x) => (
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
  const [f, setF] = useState<AgentConfig>(() => a ? { name: a.name, area: a.area, mission: a.mission, search: a.search, sharePct: a.sharePct, sources: a.sources } : { name: "", area: "", mission: "", search: false, sharePct: 10, sources: ["negocio"] });
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

// ---------------------------------------------------------------- the page

export default function Oficina() {
  const [v, setV] = useState<View | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [edit, setEdit] = useState<string | null>(null);
  const [talk, setTalk] = useState("ceo");
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

  const run = async (agent: string) => { setBusy(agent); await call("POST", { agent }); setBusy(null); };
  const remove = async (a: AgentView) => {
    if (!confirm(`¿Eliminar a ${a.name}? Se borran sus informes y su conversación.`)) return;
    try { apply(await api<View>("/api/admin/oficina/agentes", "DELETE", { id: a.id })); if (talk === a.id) setTalk("ceo"); } catch (e) { setErr(e instanceof Error ? e.message : ""); }
  };
  const talkTo = (id: string) => { setTalk(id); chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  if (!v) return <div className={card}>{err ? <p role="alert" className="text-bad">{err}</p> : <p className="text-muted">Cargando la oficina…</p>}</div>;
  const st = v.state;
  const ceo = st.last.ceo;
  const workers = v.agents.filter((a) => a.id !== "ceo");
  const customs = workers.filter((a) => !a.builtin).length;
  const pct = st.budgetUsd ? Math.min(100, (st.spend.usd / st.budgetUsd) * 100) : 100;

  return (
    <div className="flex flex-col gap-4">
      {!v.ready && <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">Falta la clave de Grok: Vercel → Environment Variables → <b>XAI_API_KEY</b> y después Redeploy.</p>}
      {err && <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{err}</p>}

      <section className={`${card} border-accent/40`} aria-labelledby="h-ceo">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 id="h-ceo" className="text-lg font-bold">CEO · resumen del día</h3>
            <span className="text-xs text-muted">Lee los informes de todos, decide qué es lo primero y le sugiere a cada agente qué mirar después. Te llega también por correo a las 8:00.</span>
          </div>
          <span className="flex flex-wrap items-center gap-2"><Badge r={ceo} />
            <button type="button" disabled={!!busy || !v.ready || !st.on} onClick={() => run("todos")} className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg disabled:opacity-50">
              {busy === "todos" ? "Trabajando… (2 a 4 min)" : "Hacer trabajar a todos ahora"}
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
        ) : ceo?.error ? <p className="text-sm text-warn">{ceo.resumen}</p> : (
          <p className="text-sm text-muted">Todavía no hay resumen. Toca «Hacer trabajar a todos ahora» para la primera ronda (cuesta unos centavos) o espera a mañana a las 8:00.</p>
        )}
      </section>

      <div ref={chatRef} className="scroll-mt-4"><Chat v={v} agent={talk} setAgent={setTalk} onSpent={refresh} /></div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Tus agentes</h3>
        <button type="button" disabled={customs >= v.maxCustom} onClick={() => setEdit("nuevo")} className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg disabled:opacity-50">+ Nuevo agente</button>
      </div>
      {edit === "nuevo" && <section className={card} aria-label="Nuevo agente"><h4 className="font-bold">Nuevo agente</h4><AgentForm v={v} onDone={(x) => { if (x) apply(x); setEdit(null); }} /></section>}

      <div className="grid items-start gap-3 lg:grid-cols-2">
        {[v.agents.find((a) => a.id === "ceo")!, ...workers].map((a) => {
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
              {a.id !== "ceo" && (r ? <p className={`text-sm ${r.error ? "text-warn" : ""}`}>{r.resumen}</p> : <p className="text-sm text-muted">Todavía no ha trabajado.</p>)}
              {task && <p className="rounded-lg border border-line px-3 py-2 text-xs"><b>El CEO sugiere mirar:</b> {task}</p>}
              {a.id !== "ceo" && r && !r.error && (
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
                  {a.id !== "ceo" && <button type="button" disabled={!!busy || !v.ready || !a.on} onClick={() => run(a.id)} className={`${btn} text-xs text-ink`}>{busy === a.id ? "Trabajando…" : "Trabajar ahora"}</button>}
                </span>
              </div>
            </section>
          );
        })}
        <section className={`${card} border-dashed opacity-60`}>
          <div className="flex items-start justify-between gap-2"><h3 className="font-bold">Campañas</h3><span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">Etapa 2</span></div>
          <p className="text-sm text-muted">Preparará campañas de Meta completas que tú lanzas con un botón «Aprobar». Necesita conectar tu cuenta publicitaria.</p>
        </section>
      </div>

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
