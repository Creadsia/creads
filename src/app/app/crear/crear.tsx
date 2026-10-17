"use client";

import { useEffect, useMemo, useState } from "react";
import { FORMATS, type FormatId, formatById } from "@/lib/formats";
import { Field, PageHead, type Row, SetupNotice, btnCls, cardCls, ghostCls, inputCls, useTable } from "../_parts/ui";
import { NICHES } from "@/lib/niches";
import { TO_CREAR_KEY } from "@/lib/guiones";
import Escenas from "./escenas";

// "Crear anuncio": the prototype's Taller (script → cuts → scenes → videos), step by step.

export interface Cut {
  tipo: string;
  texto: string;
  traduccion: string;
  mostrar: string;
  speaker?: string;
  persona?: string;
}
interface Script extends Row { title: string | null; lang: string; format: string; text: string; cuts: Cut[] | null; favorite: boolean }

const PACE = 2.7; // words per second when speaking naturally
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const secs = (t: string) => Math.max(2, Math.round(words(t) / PACE));
const SPEAKER: Record<string, string> = { host: "Conductor", guest: "Invitado", reporter: "Reportero", homeowner: "Dueño de casa", voice: "Quien graba", person: "Persona", dialogo: "Diálogo" };

const STEPS = ["Guion", "Cortes", "Escenas", "Videos"];

export default function Crear() {
  const scripts = useTable<Script>("scripts");
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<"en" | "es-CL">("en");
  const [format, setFormat] = useState<FormatId>("ugc");
  const [text, setText] = useState("");
  const [cap, setCap] = useState(8);
  const [maxSec, setMaxSec] = useState(8);
  const [comment, setComment] = useState({ question: "", user: "" });
  const [ronda, setRonda] = useState({ place: "", who: "" });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [title, setTitle] = useState("");
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [scriptId, setScriptId] = useState<string | null>(null);
  const [saved, setSaved] = useState("");
  const [niche, setNiche] = useState("");
  useEffect(() => { try { const v = localStorage.getItem("creads-niche"); if (v) setNiche(v); } catch {} }, []);
  const pickNiche = (v: string) => { setNiche(v); try { localStorage.setItem("creads-niche", v); } catch {} };

  // a script sent from the Generador de guiones
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TO_CREAR_KEY);
      if (!raw) return;
      sessionStorage.removeItem(TO_CREAR_KEY);
      const d = JSON.parse(raw) as { text?: string; lang?: string; title?: string };
      if (d.text) { setText(d.text); setLang(d.lang === "en" ? "en" : "es-CL"); setTitle(d.title ?? ""); setScriptId(null); setCuts([]); setStep(0); }
    } catch {}
  }, []);

  const f = formatById(format);
  useEffect(() => { try { const v = localStorage.getItem("creads-fmt"); if (v && FORMATS.some((x) => x.id === v)) setFormat(v as FormatId); } catch {} }, []);
  const pickFormat = (id: FormatId) => { setFormat(id); try { localStorage.setItem("creads-fmt", id); } catch {} };

  function openScript(id: string) {
    const s = scripts.rows?.find((x) => x.id === id);
    if (!s) return;
    setText(s.text); setLang(s.lang === "es-CL" ? "es-CL" : "en"); pickFormat((s.format as FormatId) || "ugc");
    setTitle(s.title ?? ""); setScriptId(s.id); setSaved("");
    if (s.cuts?.length) { setCuts(s.cuts); setStep(1); } else { setCuts([]); setStep(0); }
  }

  async function split(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setErr(""); setSaved("");
    try {
      const res = await fetch("/api/cuts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ script: text, format, lang, cap, maxSec, comment: format === "comentario" ? comment : undefined, ronda: format === "ronda" ? ronda : undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo dividir el guion.");
      setTitle(d.titulo || "Anuncio"); setCuts(d.cortes); setScriptId(null); setStep(1);
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "No se pudo dividir el guion."); }
    finally { setBusy(false); }
  }

  async function saveScript() {
    setSaved("Guardando…");
    try {
      const data = { title, lang, format, text, cuts };
      if (scriptId) await scripts.update(scriptId, data);
      else setScriptId((await scripts.add(data)).id);
      setSaved("Guion guardado ✓");
    } catch (e) { setSaved(e instanceof Error ? e.message : "No se pudo guardar."); }
  }

  const editCut = (i: number, patch: Partial<Cut>) => setCuts((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const total = useMemo(() => cuts.reduce((a, c) => a + secs(c.texto), 0), [cuts]);
  const ready = text.trim().length >= 40 && (format !== "ronda" || ronda.place.trim()) && (format !== "comentario" || comment.question.trim());

  return (
    <>
      <PageHead title="Crear anuncio" lead="Pega tu guion, revisa los cortes, elige quién habla y genera los videos.">
        {scripts.rows && scripts.rows.length > 0 && (
          <select aria-label="Abrir un guion guardado" value="" onChange={(e) => openScript(e.target.value)} className={inputCls}>
            <option value="">Abrir un guion guardado…</option>
            {scripts.rows.map((s) => <option key={s.id} value={s.id}>{s.favorite ? "★ " : ""}{s.title || s.text.slice(0, 40)}</option>)}
          </select>
        )}
      </PageHead>
      {scripts.missing && <SetupNotice />}

      <ol className="flex flex-wrap gap-2" aria-label="Pasos">
        {STEPS.map((s, i) => {
          const can = i === 0 || (i <= 2 && cuts.length > 0) || (i === 3 && cuts.length > 0 && step >= 3);
          return (
            <li key={s}>
              <button type="button" disabled={!can} onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold disabled:opacity-40 ${step === i ? "border-ink bg-ink text-bg" : "border-line text-muted"}`}>
                <span className="font-mono text-xs">{i + 1}</span>{s}
              </button>
            </li>
          );
        })}
      </ol>

      {step === 0 && (
        <form onSubmit={split} className={cardCls}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-xl font-bold">1 · Guion</h2>
            <div className="flex flex-wrap items-end gap-3">
            <Field label="Nicho (para ordenar tus anuncios)">
              <input value={niche} onChange={(e) => pickNiche(e.target.value)} list="niches" placeholder="Ej: Reparación de cimientos" className={`${inputCls} w-64`} />
              <datalist id="niches">{NICHES.map((n) => <option key={n} value={n} />)}</datalist>
            </Field>
            <Field label="Idioma del video">
              <select value={lang} onChange={(e) => setLang(e.target.value as "en" | "es-CL")} className={inputCls}>
                <option value="en">Inglés (EE. UU.)</option>
                <option value="es-CL">Español (Chile)</option>
              </select>
            </Field>
            </div>
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} aria-label="Guion"
            placeholder="Pega aquí el guion tal cual lo dice la persona del video (en inglés o en español)…" className={`${inputCls} leading-relaxed`} />
          <p className="-mt-2 text-xs text-muted">¿Quieres mejorarlo antes? Desármalo, pide 3 ángulos o 10 hooks en el <a href="/app/guiones" className="font-semibold text-accent-text underline">Generador de guiones</a>.</p>

          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-muted">¿Qué tipo de video quieres hacer?</span>
            <div role="radiogroup" aria-label="Formato del video" className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
              {FORMATS.map((x) => (
                <button key={x.id} type="button" role="radio" aria-checked={x.id === format} onClick={() => pickFormat(x.id)}
                  className={`flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-colors ${x.id === format ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}>
                  <span className="text-xl" aria-hidden="true">{x.icon}</span>
                  <b className="text-sm">{x.name}</b>
                  <span className="text-xs text-accent-text">{x.tag}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-3 rounded-xl bg-surface-2 p-4 text-sm md:grid-cols-2">
              <div>
                <p className="font-semibold">{f.icon} {f.name}: cómo funciona</p>
                <ol className="mt-1 list-decimal pl-5 text-muted">{f.how.map((h) => <li key={h}>{h}</li>)}</ol>
              </div>
              <div>
                <p className="font-semibold">Cuándo usarlo</p>
                <p className="mt-1 text-muted">{f.when}</p>
                {f.adapt && <p className="mt-2 text-xs text-muted">✦ Al dividir, la IA adapta tu guion a este formato.</p>}
              </div>
            </div>
            {format === "comentario" && (
              <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                <Field label="Pregunta del comentario (en inglés)"><input value={comment.question} onChange={(e) => setComment({ ...comment, question: e.target.value })} maxLength={140} placeholder="Ej: How much does foundation repair actually cost??" className={inputCls} /></Field>
                <Field label="Nombre de quien comenta"><input value={comment.user} onChange={(e) => setComment({ ...comment, user: e.target.value })} maxLength={24} placeholder="Ej: Brenda K." className={inputCls} /></Field>
              </div>
            )}
            {format === "ronda" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="¿Dónde es la ronda?"><input value={ronda.place} onChange={(e) => setRonda({ ...ronda, place: e.target.value })} maxLength={160} placeholder="Ej: car meet de noche en un estacionamiento" className={inputCls} /></Field>
                <Field label="¿Qué tipo de personas? (opcional)"><input value={ronda.who} onChange={(e) => setRonda({ ...ronda, who: e.target.value })} maxLength={200} placeholder="Ej: dueños de autos: JDM, Jeep, camioneta" className={inputCls} /></Field>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Field label="Cortes máximos">
              <select value={cap} onChange={(e) => setCap(Number(e.target.value))} className={inputCls}>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Largo de cada corte">
              <select value={maxSec} onChange={(e) => setMaxSec(Number(e.target.value))} className={inputCls}>
                <option value={8}>Hasta 8 s (Veo)</option>
                <option value={10}>Hasta 10 s</option>
                <option value={15}>Hasta 15 s (Kling, Seedance)</option>
              </select>
            </Field>
            <button type="submit" disabled={!ready || busy} className={btnCls}>{busy ? "Dividiendo… (≈ 20 s)" : "Dividir en cortes →"}</button>
            {err && <span className="text-sm text-bad">{err}</span>}
          </div>
        </form>
      )}

      {step === 1 && (
        <section className={cardCls}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-xl font-bold">2 · Cortes</h2>
              <input aria-label="Título" value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} font-semibold`} />
            </div>
            <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold text-muted">{f.icon} {f.name} · {cuts.length} cortes · ≈ {total} s</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            {cuts.map((c, i) => <i key={i} className={`block border-r-2 border-surface ${secs(c.texto) > maxSec ? "bg-warn" : "bg-accent"}`} style={{ width: `${(secs(c.texto) / Math.max(total, 1)) * 100}%` }} />)}
          </div>
          <ol className="flex flex-col gap-3">
            {cuts.map((c, i) => {
              const s = secs(c.texto);
              return (
                <li key={i} className="grid gap-3 rounded-xl border border-line p-3 md:grid-cols-[110px_1fr]">
                  <div className="flex items-center gap-2 md:flex-col md:items-start">
                    <span className="font-mono text-xs text-muted">Corte {i + 1}</span>
                    <span className="rounded-full bg-accent/12 px-2 py-0.5 text-xs font-semibold text-accent-text">{c.tipo}</span>
                    {c.speaker && <span className="text-xs text-muted">{SPEAKER[c.speaker] ?? c.speaker}</span>}
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <textarea aria-label={`Texto del corte ${i + 1}`} value={c.texto} rows={2} onChange={(e) => editCut(i, { texto: e.target.value })} className={`${inputCls} font-medium leading-relaxed`} />
                    <p className="text-sm text-muted">{c.traduccion}</p>
                    <p className="text-sm"><span className="text-muted">Se ve: </span>{c.mostrar}</p>
                    {c.persona && <p className="text-xs text-muted">Persona: {c.persona}</p>}
                    <p className={`font-mono text-xs ${s > maxSec ? "text-warn" : "text-muted"}`}>{words(c.texto)} palabras · ≈ {s} s{s > maxSec ? ` · se pasa de ${maxSec} s, acórtalo` : ""}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={saveScript} className={ghostCls}>☆ Guardar guion</button>
            <button type="button" onClick={() => setStep(0)} className={ghostCls}>← Cambiar guion o formato</button>
            <button type="button" onClick={() => setStep(2)} className={btnCls}>Siguiente: escenas →</button>
            {saved && <span className="text-sm text-muted">{saved}</span>}
          </div>
        </section>
      )}

      {step >= 2 && (
        <Escenas step={step} setStep={setStep} format={format} lang={lang} title={title} cuts={cuts} scriptId={scriptId} niche={niche} />
      )}
    </>
  );
}
