"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const WORK_KEY = "creads-crear-en-curso";
import { FORMATS, type FormatId, formatById } from "@/lib/formats";
import { Field, PageHead, type Row, SetupNotice, Stepper, btnCls, cardCls, ghostCls, inputCls, useTable } from "../_parts/ui";
import { NICHES } from "@/lib/niches";
import { DRAFT_KEY, TO_CREAR_KEY } from "@/lib/guiones";
import Escenas from "./escenas";
import Voz, { type VoiceChoice, splitLong } from "./voz";
import AdWork from "../_parts/ad-work";

// "Crear anuncio": the prototype's Taller (script → cuts → scenes → videos), step by step.

export interface Cut {
  tipo: string;
  texto: string;
  traduccion: string;
  mostrar: string;
  /** The customer rewrote «what is seen»: the director follows it exactly. */
  mostrarFijo?: boolean;
  /** Seconds of video for this cut, chosen by the customer (none: from the words, or the recorded voice). */
  segundos?: number;
  speaker?: string;
  persona?: string;
}
interface Script extends Row { title: string | null; lang: string; format: string; text: string; cuts: Cut[] | null; favorite: boolean }

const PACE = 2.7; // words per second when speaking naturally
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const secs = (t: string) => Math.max(2, Math.round(words(t) / PACE));
/** A cut's length: what the customer chose, else the estimate from its words. */
const cutSecs = (c: Cut) => (c.segundos && c.segundos > 0 ? c.segundos : secs(c.texto));
const SPEAKER: Record<string, string> = { host: "Conductor", guest: "Invitado", reporter: "Reportero", homeowner: "Dueño de casa", voice: "Quien graba", person: "Persona", dialogo: "Diálogo" };

// The order that avoids errors: the script, then the voice (heard and approved), then the scene prompts,
// the videos lip-synced to that voice, the corrections, and the final edit. «Cortes» is part of the script.
const TABS: { label: string; steps: number[] }[] = [
  { label: "Guion", steps: [0, 1] },
  { label: "Voz", steps: [2] },
  { label: "Escenas", steps: [3] },
  { label: "Videos", steps: [4] },
  { label: "Correcciones", steps: [5] },
  { label: "Edición final", steps: [6] },
];

// Another style of ad, next to the formats: it opens its own studio.
const MORE_KINDS = [
  { href: "/app/historias", icon: "🎬", name: "Historias animadas", tag: "Mini película con IA" },
];

/** The language a script is written in (null while it's too short to tell). */
export function guessLang(t: string): "en" | "es-CL" | null {
  const w = t.toLowerCase().split(/[^a-záéíóúñü¿¡']+/).filter(Boolean);
  if (w.length < 6) return null;
  const es = w.filter((x) => /[áéíóúñ¿¡]/.test(x) || ["el", "la", "los", "las", "que", "de", "y", "tu", "es", "con", "para", "un", "una", "por", "en", "mi", "no"].includes(x)).length;
  const en = w.filter((x) => ["the", "and", "you", "your", "is", "to", "of", "for", "with", "this", "that", "it", "my", "in", "on"].includes(x)).length;
  if (es >= 3 && es > en * 1.5) return "es-CL";
  if (en >= 3 && en > es * 1.5) return "en";
  return null;
}

export default function Crear({ full = true }: { full?: boolean }) {
  const scripts = useTable<Script>("scripts");
  const [step, setStep] = useState(0);
  // step 3: who talks, with which voice, recorded and approved before any video is paid for
  const [adId, setAdId] = useState<string | null>(null);
  const [voice, setVoice] = useState<VoiceChoice>({ avatarId: "", voice: "", natural: true, takes: [] });
  // «Grabar la voz» in the menu opens this page at step 3 (or explains it needs the script first)
  const [wantVoice, setWantVoice] = useState(false);
  // Spanish by default (Latin America); the script's own language wins (an English setting with a Spanish
  // script made the model speak Spanish with an American accent)
  const [lang, setLang] = useState<"en" | "es-CL">("es-CL");
  const [langNote, setLangNote] = useState("");
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
  const [fromGuion, setFromGuion] = useState(false);

  // The ad in progress survives a reload, a closed tab or an error screen: script, cuts, the recorded voice
  // and the ad being made are kept in this browser and come back where they were left.
  const [resumed, setResumed] = useState(false);
  const loadedWork = useRef(false);
  useEffect(() => {
    try {
      const w = JSON.parse(localStorage.getItem(WORK_KEY) || "null");
      if (w && Date.now() - (w.at ?? 0) < 7 * 86_400_000 && (w.cuts?.length || w.text)) {
        setText(w.text ?? ""); setLang(w.lang === "en" ? "en" : "es-CL"); if (w.format) setFormat(w.format);
        setTitle(w.title ?? ""); setCuts(w.cuts ?? []); setScriptId(w.scriptId ?? null); setAdId(w.adId ?? null);
        if (w.voice) setVoice(w.voice);
        setStep(Number.isInteger(w.step) ? w.step : 0); setResumed(true);
      }
    } catch {}
    loadedWork.current = true;
  }, []);
  useEffect(() => {
    if (!loadedWork.current) return;
    try {
      if (!text && !cuts.length) return localStorage.removeItem(WORK_KEY);
      const v = { ...voice, takes: voice.takes.map((t) => (t ? { key: t.key, url: t.url, ok: t.ok, heard: t.heard } : t)) };
      localStorage.setItem(WORK_KEY, JSON.stringify({ at: Date.now(), step, text, lang, format, title, cuts, scriptId, adId, voice: v }));
    } catch {}
  }, [step, text, lang, format, title, cuts, scriptId, adId, voice]);
  function startOver() {
    try { localStorage.removeItem(WORK_KEY); } catch {}
    setText(""); setCuts([]); setTitle(""); setScriptId(null); setAdId(null); setStep(0); setResumed(false);
    setVoice({ avatarId: "", voice: "", natural: true, takes: [] });
  }
  useEffect(() => { try { const v = localStorage.getItem("creads-niche"); if (v) setNiche(v); } catch {} }, []);
  useEffect(() => {
    const go = () => { if (new URLSearchParams(window.location.search).get("paso") === "voz") setWantVoice(true); };
    go();
    window.addEventListener("creads-paso", go);
    return () => window.removeEventListener("creads-paso", go);
  }, []);
  useEffect(() => { if (wantVoice && cuts.length) { setStep(2); setWantVoice(false); } }, [wantVoice, cuts.length]);
  const pickNiche = (v: string) => { setNiche(v); try { localStorage.setItem("creads-niche", v); } catch {} };

  // a script sent from the Generador de guiones
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TO_CREAR_KEY);
      if (!raw) {
        // arriving from the menu: bring the script being worked on in «Crear guion», if there is one
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as { script?: string; lang?: string } | null;
        if (draft?.script && draft.script.trim().split(/\s+/).length >= 12) {
          setText(draft.script.trim()); setLang(draft.lang === "en" ? "en" : "es-CL"); setFromGuion(true);
        }
        return;
      }
      sessionStorage.removeItem(TO_CREAR_KEY);
      const d = JSON.parse(raw) as { text?: string; lang?: string; title?: string };
      if (d.text) { setText(d.text); setLang(d.lang === "en" ? "en" : "es-CL"); setTitle(d.title ?? ""); setScriptId(null); setCuts([]); setAdId(null); setStep(0); setFromGuion(true); }
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
    setAdId(null);
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
      setTitle(d.titulo || "Anuncio"); setCuts(d.cortes); setScriptId(null); setAdId(null); setStep(1);
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
  const total = useMemo(() => cuts.reduce((a, c) => a + cutSecs(c), 0), [cuts]);
  const ready = text.trim().length >= 40 && (format !== "ronda" || ronda.place.trim()) && (format !== "comentario" || comment.question.trim());

  return (
    <>
      <Stepper flow="anuncio" current={step === 2 ? 2 : 3} />
      <PageHead title="Crear anuncio" lead="Pega tu guion, revisa los cortes, elige quién habla y genera los videos.">
        {scripts.rows && scripts.rows.length > 0 && (
          <select aria-label="Abrir un guion guardado" value="" onChange={(e) => openScript(e.target.value)} className={inputCls}>
            <option value="">Abrir un guion guardado…</option>
            {scripts.rows.map((s) => <option key={s.id} value={s.id}>{s.favorite ? "★ " : ""}{s.title || s.text.slice(0, 40)}</option>)}
          </select>
        )}
      </PageHead>
      {scripts.missing && <SetupNotice />}

      {resumed && (
        <p role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm">
          <span>✓ Retomamos tu anuncio donde lo dejaste{title ? `: «${title}»` : ""}.</span>
          <button type="button" onClick={startOver} className="text-xs font-semibold text-muted underline hover:text-ink">Empezar uno nuevo</button>
        </p>
      )}
      <ol className="flex flex-wrap gap-2" aria-label="Pasos" data-tour="crear-pasos">
        {TABS.map((t, i) => {
          const first = t.steps[0];
          // guion and voz always open (they explain what they need); scenes need the cuts; videos the scenes; the rest the ad
          const can = first <= 2 || (first === 3 && cuts.length > 0) || (first === 4 && cuts.length > 0 && (step >= 4 || Boolean(adId))) || (first >= 5 && Boolean(adId));
          const on = t.steps.includes(step);
          return (
            <li key={t.label}>
              <button type="button" disabled={!can} onClick={() => setStep(first === 0 && step === 1 ? 1 : first)} aria-current={on ? "step" : undefined}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold disabled:opacity-40 ${on ? "border-ink bg-ink text-bg" : "border-line text-muted"}`}>
                <span className="font-mono text-xs">{i + 2}</span>{t.label}
              </button>
            </li>
          );
        })}
      </ol>

      {wantVoice && !cuts.length && step === 0 && (
        <p className="rounded-xl border border-accent/40 bg-accent/10 p-3 text-sm">🎙 <b>Grabar la voz</b> es el paso 3: primero pega o abre tu guion aquí abajo y sepáralo en cortes. Después grabas y escuchas la voz, y recién ahí se hace el video.</p>
      )}
      {step === 0 && (
        <form onSubmit={split} className={cardCls}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-xl font-bold">2 · Guion</h2>
            <div className="flex flex-wrap items-end gap-3">
            <Field label="Nicho (para ordenar tus anuncios)">
              <input value={niche} onChange={(e) => pickNiche(e.target.value)} list="niches" placeholder="Ej: Reparación de cimientos" className={`${inputCls} w-64`} />
              <datalist id="niches">{NICHES.map((n) => <option key={n} value={n} />)}</datalist>
            </Field>
            <Field label="Idioma del video">
              <select value={lang} onChange={(e) => setLang(e.target.value as "en" | "es-CL")} className={inputCls}>
                <option value="en">Inglés (EE. UU.)</option>
                <option value="es-CL">Español (Latinoamérica)</option>
              </select>
            </Field>
            </div>
          </div>
          {fromGuion && step === 0 && (
            <p role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-good/40 bg-good/10 px-3 py-2 text-sm">
              <span>✓ Trajimos tu guion de «Crear guion». Revísalo, elige el formato y divídelo en cortes.</span>
              <button type="button" onClick={() => { setText(""); setFromGuion(false); }} className="text-xs font-semibold text-muted underline hover:text-ink">Empezar con uno en blanco</button>
            </p>
          )}
          {langNote && <p role="status" className="rounded-lg bg-accent/10 px-3 py-2 text-sm">{langNote}</p>}
          <textarea data-tour="crear-guion" value={text} onChange={(e) => { setText(e.target.value); const g = guessLang(e.target.value); if (g && g !== lang) { setLang(g); setLangNote(g === "es-CL" ? "Tu guion está en español: dejamos el video en español." : "Your script is in English: the video is set to English."); } }} rows={8} aria-label="Guion"
            placeholder="Pega aquí el guion tal cual lo dice la persona del video (en inglés o en español)…" className={`${inputCls} leading-relaxed`} />
          <p className="-mt-2 text-xs text-muted">¿Quieres mejorarlo antes? Desármalo, pide 3 ángulos o 10 hooks en <a href="/app/guiones" className="font-semibold text-accent-text underline">Crear guion</a> (paso 1).</p>

          <div className="flex flex-col gap-3" data-tour="crear-formato">
            <span className="text-sm font-semibold text-muted">¿Qué tipo de video quieres hacer?</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <div role="radiogroup" aria-label="Formato del video" className="contents">
              {FORMATS.map((x) => (
                <button key={x.id} type="button" role="radio" aria-checked={x.id === format} onClick={() => pickFormat(x.id)}
                  className={`flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left transition-colors ${x.id === format ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}>
                  <span className="text-xl" aria-hidden="true">{x.icon}</span>
                  <b className="text-sm">{x.name}</b>
                  <span className="text-xs text-accent-text">{x.tag}</span>
                </button>
              ))}
            </div>
              {full && MORE_KINDS.map((k) => (
                <a key={k.href} href={k.href} className="flex flex-col items-start gap-0.5 rounded-xl border border-dashed border-line p-3 text-left transition-colors hover:border-accent/50">
                  <span className="text-xl" aria-hidden="true">{k.icon}</span>
                  <b className="text-sm">{k.name}</b>
                  <span className="text-xs text-muted">{k.tag} ↗</span>
                </a>
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

          <div className="flex flex-wrap items-end gap-3" data-tour="crear-dividir">
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
              <h2 className="font-display text-xl font-bold">2 · Guion: revisa los cortes</h2>
              <input aria-label="Título" value={title} onChange={(e) => setTitle(e.target.value)} className={`${inputCls} font-semibold`} />
            </div>
            <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold text-muted">{f.icon} {f.name} · {cuts.length} cortes · ≈ {total} s</span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            {cuts.map((c, i) => <i key={i} className={`block border-r-2 border-surface ${cutSecs(c) > maxSec ? "bg-warn" : "bg-accent"}`} style={{ width: `${(cutSecs(c) / Math.max(total, 1)) * 100}%` }} />)}
          </div>
          <ol className="flex flex-col gap-3">
            {cuts.map((c, i) => {
              const s = cutSecs(c);
              const need = Math.max(2, Math.ceil(words(c.texto) / 2.8)); // the fastest natural reading of the line
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
                    <label className="flex flex-col gap-1 text-xs font-semibold">
                      Qué se ve en este corte <span className="font-normal text-muted">(la IA lo propuso; cámbialo como quieras)</span>
                      <textarea rows={2} value={c.mostrar} onChange={(e) => editCut(i, { mostrar: e.target.value, mostrarFijo: true })}
                        placeholder="Ej: ella en la cocina mostrando el producto a la cámara, plano medio"
                        className={`${inputCls} text-sm font-normal`} />
                    </label>
                    {c.persona && <p className="text-xs text-muted">Persona: {c.persona}</p>}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-muted">{words(c.texto)} palabras · duración del video:</span>
                      <span className="inline-flex items-center overflow-hidden rounded-lg border border-line" role="group" aria-label={`Segundos del corte ${i + 1}`}>
                        <button type="button" onClick={() => editCut(i, { segundos: Math.max(2, s - 1) })} disabled={s <= 2} className="px-2 py-1 font-bold hover:bg-surface-2 disabled:opacity-40" aria-label="Un segundo menos">−</button>
                        <b className="min-w-[3.2rem] px-1 text-center font-mono tabular-nums">{s} s</b>
                        <button type="button" onClick={() => editCut(i, { segundos: Math.min(15, s + 1) })} disabled={s >= 15} className="px-2 py-1 font-bold hover:bg-surface-2 disabled:opacity-40" aria-label="Un segundo más">+</button>
                      </span>
                      {c.segundos ? <button type="button" onClick={() => editCut(i, { segundos: undefined })} className="text-muted underline">automático</button> : <span className="text-muted">(automático)</span>}
                      {s < need && <span className="text-warn">Ojo: en {s} s puede que no alcance a decir todo ({need} s mínimo).</span>}
                      {s > maxSec && <span className="text-warn">Largo: en el paso Voz se divide solo.</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={saveScript} className={ghostCls}>☆ Guardar guion</button>
            <button type="button" onClick={() => setStep(0)} className={ghostCls}>← Cambiar guion o formato</button>
            <button type="button" onClick={() => { setCuts((cs) => splitLong(cs).slice(0, 12)); setStep(2); }} className={btnCls}>Siguiente: la voz →</button>
            {saved && <span className="text-sm text-muted">{saved}</span>}
          </div>
        </section>
      )}

      {step === 2 && <Voz format={format} lang={lang} cuts={cuts} value={voice} onChange={setVoice} onBack={() => setStep(cuts.length ? 1 : 0)} onNext={() => setStep(3)} onCuts={setCuts} />}
      {(step === 3 || (step === 4 && !adId)) && (
        // Escenas counts its own steps 2 (scenes) and 3 (videos)
        <Escenas step={step - 1} setStep={(n) => setStep(n === 1 ? 1 : n + 1)} format={format} lang={lang} title={title} cuts={cuts} scriptId={scriptId} niche={niche}
          v={voice} onVoiceStep={() => setStep(2)} adId={adId} setAdId={(id) => { setAdId(id); setStep(4); }} onNewScenes={() => setAdId(null)} />
      )}
      {step >= 4 && adId && (
        <AdWork key={`${adId}-${step}`} adId={adId} view={step === 4 ? "videos" : step === 5 ? "correcciones" : "edicion"} onNext={() => setStep(step + 1)} />
      )}
    </>
  );
}
