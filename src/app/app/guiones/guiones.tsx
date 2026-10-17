"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BLOCKS, DRAFT_KEY, FROM_SPY_KEY, TO_CREAR_KEY, type Analysis, type Block, type GuionAnswer, type Hook, MODES, type Mode, SCRIPT_LANGS, type ScriptLang, type ScriptOut, blockOf, scriptText, spokenSeconds } from "@/lib/guiones";
import { NICHES } from "@/lib/niches";
import { Field, PageHead, type Row, Stepper, btnCls, cardCls, ghostCls, inputCls, useTable, Working } from "../_parts/ui";

// Generador de guiones: paste a winning script, take it apart block by block, learn why it works,
// and iterate (angles, hooks, better lines, ideas, lengths) until it's ready for "Crear anuncio".

interface SavedScript extends Row { title: string | null; lang: string; text: string; favorite: boolean }
interface Version { id: string; label: string; text: string; at: number }
/** The competitor's ad the work started from (from «Espiar anuncios»): a base to learn from, not to copy. */
interface Reference { text: string; page: string; days: number | null; voice: boolean; video: boolean }
interface Draft { script: string; lang: ScriptLang; niche: string; context: string; versions: Version[]; reference?: Reference | null }

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const newId = () => Math.random().toString(36).slice(2, 10);

function Chip({ tipo }: { tipo: string }) {
  const b = blockOf(tipo);
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-bold text-ink">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: b.color }} />
      {b.id}
    </span>
  );
}

function Score({ n, label }: { n?: number; label?: string }) {
  if (!n) return null;
  const tone = n >= 8 ? "text-good" : n >= 6 ? "text-warn" : "text-bad";
  return <span className={`font-mono text-sm font-bold ${tone}`} title={label}>{n}/10</span>;
}

function BlockRow({ b, showWhy }: { b: Block; showWhy?: boolean }) {
  const def = blockOf(b.tipo);
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border-l-4 bg-surface-2 px-3 py-2.5" style={{ borderColor: def.color }}>
      <div className="flex flex-wrap items-center gap-2">
        <Chip tipo={b.tipo} />
        {b.nota ? <Score n={b.nota} label="Qué tan bien cumple su función" /> : null}
      </div>
      <p className="leading-relaxed">«{b.texto}»</p>
      {b.es && <p className="text-sm text-muted">{b.es}</p>}
      {showWhy && b.para_que && <p className="text-xs text-muted"><b>Para qué sirve:</b> {b.para_que}</p>}
      {b.mejora && <p className="text-xs text-accent-text">✦ {b.mejora}</p>}
    </li>
  );
}

export default function Guiones() {
  const router = useRouter();
  const saved = useTable<SavedScript>("scripts");
  const [script, setScript] = useState("");
  const [lang, setLang] = useState<ScriptLang>("es-CL");
  const [niche, setNiche] = useState("");
  const [context, setContext] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [mode, setMode] = useState<Mode | null>(null);
  const [idea, setIdea] = useState("");
  const [level, setLevel] = useState<"fiel" | "max">("fiel");
  const [busy, setBusy] = useState<Mode | null>(null);
  const [err, setErr] = useState("");
  const [out, setOut] = useState<{ mode: Mode; data: GuionAnswer } | null>(null);
  const [analysis, setAnalysis] = useState<{ text: string; a: Analysis } | null>(null);
  const [note, setNote] = useState("");
  const [learn, setLearn] = useState(false);
  const [reference, setReference] = useState<Reference | null>(null);
  const [needContext, setNeedContext] = useState(false);

  // the work in progress survives a reload (this browser only)
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") as Draft | null;
      if (d) { setScript(d.script || ""); setLang(d.lang === "en" ? "en" : "es-CL"); setNiche(d.niche || ""); setContext(d.context || ""); setVersions(Array.isArray(d.versions) ? d.versions.slice(0, 20) : []); setReference(d.reference?.text ? d.reference : null); }
      else { const n = localStorage.getItem("creads-niche"); if (n) setNiche(n); }
      // a winning ad brought from «Espiar anuncios»: it becomes the script to take apart (the previous one is kept as a version)
      const spy = JSON.parse(sessionStorage.getItem(FROM_SPY_KEY) || "null") as { text?: string; page?: string; voice?: boolean; video?: boolean; days?: number | null } | null;
      sessionStorage.removeItem(FROM_SPY_KEY);
      if (spy?.text?.trim()) {
        const prev = d?.script?.trim();
        if (prev) setVersions((v) => (v.some((x) => x.text === prev) ? v : [{ id: newId(), label: "Mi versión", text: prev, at: Date.now() }, ...v].slice(0, 20)));
        setScript(spy.text.trim());
        setReference({ text: spy.text.trim(), page: spy.page || "la competencia", days: typeof spy.days === "number" ? spy.days : null, voice: Boolean(spy.voice), video: Boolean(spy.video) });
        setOut(null);
        setAnalysis(null);
        setMode(null);
      }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ script, lang, niche, context, versions, reference } satisfies Draft)); } catch {}
  }, [loaded, script, lang, niche, context, versions, reference]);

  const w = words(script);
  // still the competitor's words, untouched: make your version before taking it to video
  const isReference = Boolean(reference && reference.text.trim() === script.trim());
  const current = analysis && analysis.text === script ? analysis.a : null;

  function flash(t: string) { setNote(t); setTimeout(() => setNote(""), 3500); }

  function applyScript(text: string, label: string) {
    const prev = script.trim();
    setVersions((v) => {
      const list = [...v];
      if (prev && !list.some((x) => x.text === prev)) list.unshift({ id: newId(), label: list.length ? "Mi versión" : "Original", text: prev, at: Date.now() });
      if (!list.some((x) => x.text === text.trim())) list.unshift({ id: newId(), label, text: text.trim(), at: Date.now() });
      return list.slice(0, 20);
    });
    setScript(text.trim());
    flash("Listo: ese es ahora tu guion. Puedes seguir iterando sobre él.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toCrear(text: string, title?: string) {
    try { sessionStorage.setItem(TO_CREAR_KEY, JSON.stringify({ text, lang, title: title ?? "" })); } catch {}
    router.push("/app/crear");
  }

  const [saving, setSaving] = useState(false);
  async function save(text: string, title: string) {
    if (saving) return;
    setSaving(true); setErr("");
    try {
      if (saved.rows?.some((x) => x.text.trim() === text.trim())) { flash("Ese guion ya está guardado."); return; }
      await saved.add({ title: title.slice(0, 80), lang, text, format: "ugc" } as Partial<SavedScript>);
      flash("Guion guardado. Lo encuentras en «Abrir un guion guardado».");
    } catch (e) {
      flash("");
      setErr(e instanceof Error && !/fetch/i.test(e.message) ? e.message : "No se pudo guardar. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); flash("Copiado."); } catch { setErr("No se pudo copiar. Selecciona el texto y cópialo a mano."); }
  }

  async function run(m: Mode, opts: { idea?: string } = {}) {
    setMode(m); setErr(""); setBusy(m);
    try {
      const res = await fetch("/api/guiones", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: m, script, lang, niche, context, idea: opts.idea ?? idea, level }),
      }).catch(() => null);
      const d = res ? await res.json().catch(() => ({})) : {};
      if (!res?.ok) throw new Error(d.error || "No pudimos conectarnos. Revisa tu internet e intenta de nuevo.");
      if (m === "desarmar" && d.analysis) setAnalysis({ text: script, a: d.analysis });
      setOut({ mode: m, data: d });
      setTimeout(() => document.getElementById("resultado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo trabajar el guion.");
    } finally {
      setBusy(null);
    }
  }

  function applyHook(h: Hook) {
    // replace the opening: the Hook blocks we know from "Desarmar", or else the first sentence
    let rest = script.trim();
    if (current) {
      const blocks = [...current.bloques];
      while (blocks.length && blocks[0].tipo === "Hook") blocks.shift();
      rest = scriptText(blocks);
    } else {
      const m = rest.match(/^.+?[.!?](\s|$)/);
      rest = m ? rest.slice(m[0].length).trim() : rest;
    }
    applyScript(`${h.texto}\n${rest}`, `Hook: ${h.tipo || "nuevo"}`);
  }

  const modeInfo = MODES.find((m) => m.id === mode);
  const canRun = (m: Mode) => (m === "crear" ? context.trim().length >= 20 || Boolean(niche) : w >= 12);

  /** «Hacer mi versión» needs to know what you sell (or at least the niche) to write for your business. */
  function makeMine() {
    if (context.trim().length < 10 && !niche.trim()) {
      setNeedContext(true);
      setTimeout(() => document.getElementById("guion-context")?.focus(), 50);
      return;
    }
    setNeedContext(false);
    run("adaptar");
  }

  return (
    <>
      <Stepper flow="anuncio" current={1} />
      <PageHead title="Crear guion" lead="Todo anuncio parte de un buen guion. Pega uno ganador, desármalo para entender por qué funciona y mejóralo hasta tener la mejor versión. Después llévalo a «Crear anuncio».">
        <button type="button" onClick={() => setLearn((v) => !v)} aria-expanded={learn} className={ghostCls}>{learn ? "Ocultar guía" : "📘 Cómo se arma un guion"}</button>
      </PageHead>

      {learn && <Lesson />}

      {reference && (
        <section aria-labelledby="ref-h" data-tour="guion-ref" className="flex flex-col gap-4 rounded-2xl border border-accent/40 bg-accent/[0.06] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex max-w-2xl flex-col gap-1">
              <span className="text-xs font-semibold text-accent-text">Partiste de un anuncio que está funcionando</span>
              <h2 id="ref-h" className="font-display text-lg font-bold">
                Anuncio de {reference.page}{reference.days != null ? ` · ${reference.days} días activo${reference.days >= 30 ? " 🔥" : ""}` : ""}
              </h2>
              <p className="text-sm text-muted">
                {reference.voice ? "Abajo está lo que dicen en el video." : reference.video ? "El video no tiene voz que se pueda transcribir (suele ser solo música): abajo está el texto que acompaña al anuncio." : "Abajo está el texto del anuncio."}{" "}
                Úsalo como base, no lo copies: elige qué hacer con él y quédate con la versión que más te guste.
              </p>
            </div>
            <button type="button" onClick={() => setReference(null)} className="text-xs text-muted underline hover:text-ink">Quitar referencia</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["adaptar", "✍️ Hacer mi versión", "3 guiones originales para tu negocio, con lo que hace funcionar este anuncio.", makeMine],
              ["desarmar", "🔍 Entender por qué funciona", "Hook, dolor, oferta, CTA… parte por parte y qué mejorar.", () => run("desarmar")],
              ["hooks", "🎣 10 hooks nuevos", "Otras formas de abrir, con puntaje, para cambiar solo el inicio.", () => run("hooks")],
              ["angulos", "🔀 3 ángulos nuevos", "La misma idea contada desde 3 motivos distintos.", () => run("angulos")],
            ] as [Mode, string, string, () => void][]).map(([id, title, text, go], i) => (
              <button key={id} type="button" onClick={go} data-tour={i === 0 ? "guion-ref-mia" : undefined} disabled={Boolean(busy) || w < 12}
                className={`flex flex-col gap-1 rounded-xl p-3.5 text-left transition-transform hover:-translate-y-px disabled:opacity-60 ${i === 0 ? "bg-[image:var(--grad)] text-white" : "border border-line bg-surface"}`}>
                <b className="text-sm">{busy === id ? <Working label="Trabajando…" /> : title}</b>
                <span className={`text-xs ${i === 0 ? "text-white/85" : "text-muted"}`}>{text}</span>
              </button>
            ))}
          </div>
          {needContext && <p role="alert" className="text-sm text-warn">Para escribir tu versión cuéntanos qué vendes (o elige tu nicho) en «Qué vendes», más abajo. Con eso la hacemos para tu negocio y no para el de ellos.</p>}
          {w < 12 && <p className="text-sm text-warn">El texto es muy corto para trabajarlo: complétalo abajo con lo que se dice o se ve en el anuncio.</p>}
          {busy && <p role="status" className="text-sm text-muted">La IA está trabajando. Tarda entre 15 y 40 segundos…</p>}
        </section>
      )}

      <section className={cardCls} aria-labelledby="tu-guion">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="tu-guion" className="font-display text-lg font-bold">1 · Tu guion</h2>
          {saved.rows && saved.rows.length > 0 && (
            <select aria-label="Abrir un guion guardado" value="" className={inputCls}
              onChange={(e) => { const s = saved.rows?.find((x) => x.id === e.target.value); if (s) { applyScript(s.text, s.title || "Guardado"); setLang(s.lang === "en" ? "en" : "es-CL"); } }}>
              <option value="">Abrir un guion guardado…</option>
              {saved.rows.map((s) => <option key={s.id} value={s.id}>{s.favorite ? "★ " : ""}{s.title || s.text.slice(0, 40)}</option>)}
            </select>
          )}
        </div>
        <Field label={isReference ? "Guion del anuncio de referencia (puedes editarlo)" : "Pega el guion ganador (lo que dice la persona en el video)"} hint={w ? `${w} palabras · ≈ ${spokenSeconds(script)} segundos hablado` : "Puede ser tuyo o uno de la competencia que esté funcionando. En español o en inglés."}>
          <textarea data-tour="guion-texto" value={script} onChange={(e) => setScript(e.target.value)} rows={8} placeholder="Ej: ¿Sabías que si tu casa tiene esta grieta en la pared…" className={`${inputCls} leading-relaxed`} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3" data-tour="guion-contexto">
          <Field label="Idioma de los guiones nuevos">
            <select value={lang} onChange={(e) => setLang(e.target.value as ScriptLang)} className={inputCls}>
              {SCRIPT_LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </Field>
          <Field label="Nicho">
            <input list="guion-niches" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="Ej: Remodelación de baño" className={inputCls} />
            <datalist id="guion-niches">{NICHES.map((n) => <option key={n} value={n} />)}</datalist>
          </Field>
          <Field label="Qué vendes (opcional)" hint="Oferta, público, diferencia. Mejora mucho el resultado.">
            <input id="guion-context" value={context} onChange={(e) => { setContext(e.target.value); if (needContext) setNeedContext(false); }} placeholder="Ej: inspección gratis, dueños de casa de +50 en Texas" className={`${inputCls} ${needContext ? "border-warn" : ""}`} />
          </Field>
        </div>
        {versions.length > 0 && (
          <details className="rounded-xl border border-line px-3 py-2">
            <summary className="cursor-pointer text-sm font-semibold text-muted">Versiones de este guion ({versions.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate"><b>{v.label}</b> <span className="text-muted">· {v.text.slice(0, 70)}…</span></span>
                  <span className="flex shrink-0 gap-2">
                    {v.text === script.trim() ? <span className="text-xs text-good">En uso</span> : <button type="button" onClick={() => setScript(v.text)} className="text-xs font-semibold text-accent-text underline">Volver a esta</button>}
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setVersions([])} className="mt-2 text-xs text-muted underline">Borrar historial</button>
          </details>
        )}
        {w >= 12 && !isReference && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => toCrear(script)} className={btnCls}>Llevar a Crear anuncio</button>
            <button type="button" onClick={() => save(script, current?.titulo || script.slice(0, 40))} className={ghostCls}>☆ Guardar</button>
          </div>
        )}
        {note && <p role="status" className="text-sm text-good">{note}</p>}
        {err && !busy && !mode && <p role="alert" className="text-sm text-bad">{err}</p>}
      </section>

      <section className={cardCls} aria-labelledby="que-hacer">
        <div className="flex flex-col gap-1">
          <h2 id="que-hacer" className="font-display text-lg font-bold">2 · ¿Qué quieres hacer?</h2>
          <p className="text-sm text-muted">Si recién empiezas, parte por <b>Desarmar el guion</b>: vas a ver cada parte y por qué funciona. Gratis mientras tengas créditos: no descuenta nada.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-tour="guion-modos">
          {MODES.map((m) => (
            <button key={m.id} type="button" onClick={() => { setMode(m.id); setErr(""); if (m.id === "adaptar") { if (canRun(m.id)) makeMine(); } else if (m.id !== "idea" && m.id !== "crear" && m.id !== "mejorar" && canRun(m.id)) run(m.id); }}
              aria-pressed={mode === m.id} disabled={Boolean(busy)}
              className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors disabled:opacity-60 ${mode === m.id ? "border-accent bg-accent/10" : "border-line hover:bg-surface-2"}`}>
              <b className="text-sm">{busy === m.id ? <Working label="Trabajando…" /> : m.title}</b>
              <span className="text-xs text-muted">{m.short}</span>
            </button>
          ))}
        </div>

        {mode === "idea" && (
          <form onSubmit={(e) => { e.preventDefault(); run("idea"); }} className="flex flex-col gap-2 sm:flex-row">
            <input value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="¿Y si el hook habla del vecino que vendió su casa barata?" className={`${inputCls} flex-1`} aria-label="Tu idea" />
            <button type="submit" disabled={Boolean(busy) || idea.trim().length < 5 || w < 12} className={btnCls}>{busy === "idea" ? "Probando…" : "Probar la idea"}</button>
          </form>
        )}
        {mode === "mejorar" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div role="radiogroup" aria-label="Cuánto cambiar" className="flex gap-2">
              {([["fiel", "Fiel: misma historia, mejores frases"], ["max", "Libre: puede cambiar todo"]] as const).map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={level === id} onClick={() => setLevel(id)} className={`rounded-lg border px-3 py-2 text-sm ${level === id ? "border-accent bg-accent/10 font-semibold" : "border-line"}`}>{label}</button>
              ))}
            </div>
            <button type="button" onClick={() => run("mejorar")} disabled={Boolean(busy) || w < 12} className={btnCls}>{busy === "mejorar" ? "Mejorando…" : "Mejorar el guion"}</button>
          </div>
        )}
        {mode === "crear" && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">Completa <b>Qué vendes</b> arriba (oferta, a quién le vendes, qué te diferencia) y el nicho. Mientras más detalle, mejores guiones.</p>
            <button type="button" onClick={() => run("crear")} disabled={Boolean(busy) || !canRun("crear")} className={`${btnCls} self-start`}>{busy === "crear" ? "Escribiendo…" : "Crear 3 guiones"}</button>
          </div>
        )}
        {mode && modeInfo?.needsScript && w < 12 && <p className="text-sm text-warn">Primero pega tu guion arriba (al menos un par de frases).</p>}
        {busy && <p role="status" className="text-sm text-muted">La IA está trabajando tu guion. Tarda entre 15 y 40 segundos…</p>}
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      </section>

      {out && (
        <section id="resultado" className={`${cardCls} scroll-mt-6`} aria-labelledby="res-h">
          <h2 id="res-h" className="font-display text-lg font-bold">3 · Resultado: {MODES.find((m) => m.id === out.mode)?.title}</h2>
          {out.mode === "desarmar" && out.data.analysis && (
            <AnalysisView a={out.data.analysis} onImprove={() => { setMode("mejorar"); run("mejorar"); }} onIdea={(t) => { setIdea(t); setMode("idea"); run("idea", { idea: t }); }} />
          )}
          {out.mode === "hooks" && (
            <ol className="flex flex-col gap-2">
              {(out.data.hooks ?? []).map((h, i) => (
                <li key={i} className="flex flex-col gap-1.5 rounded-xl bg-surface-2 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-muted">#{i + 1}</span>{h.tipo && <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold">{h.tipo}</span>}<Score n={h.nota} /></div>
                  <p className="leading-relaxed">«{h.texto}»</p>
                  {h.es && <p className="text-sm text-muted">{h.es}</p>}
                  {h.por_que && <p className="text-xs text-muted">{h.por_que}</p>}
                  <div className="flex gap-2"><button type="button" onClick={() => applyHook(h)} className="text-sm font-semibold text-accent-text underline">Usar este hook en mi guion</button></div>
                </li>
              ))}
            </ol>
          )}
          {out.mode !== "desarmar" && out.mode !== "hooks" && (
            <>
              {(out.data.antes || out.data.despues) && (
                <p className="flex items-center gap-2 text-sm">Puntaje <Score n={out.data.antes} /> → <Score n={out.data.despues} /></p>
              )}
              {out.data.resumen && <p className="text-sm">{out.data.resumen}</p>}
              <div className="grid gap-4 lg:grid-cols-2">
                {(out.data.scripts ?? []).map((s, i) => (
                  <ScriptCard key={i} s={s} onUse={() => applyScript(scriptText(s.bloques), s.angulo || s.titulo)} onCrear={() => toCrear(scriptText(s.bloques), s.titulo)} onSave={() => save(scriptText(s.bloques), s.titulo)} onCopy={() => copy(scriptText(s.bloques))} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {w >= 12 && isReference && !out && (
        <p className="rounded-2xl border border-dashed border-line px-5 py-4 text-sm text-muted">
          <b className="text-ink">Siguiente paso:</b> haz tu versión arriba (o mejora este guion). Cuando elijas una con «Usar este guion», aparece el botón para crearla en video.
        </p>
      )}
      {w >= 12 && !isReference && (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-[image:var(--grad)] p-[1px]" aria-labelledby="siguiente">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[15px] bg-surface p-5">
            <div className="flex max-w-xl flex-col gap-1">
              <span className="text-xs font-semibold text-muted">Siguiente paso</span>
              <h2 id="siguiente" className="font-display text-xl font-bold">¿Tu guion está listo? Créalo en video</h2>
              <p className="text-sm text-muted">Pasamos tu guion ({w} palabras, ≈ {spokenSeconds(script)} s) a «Crear anuncio», ya pegado. Ahí eliges el formato, quién habla y lo divides en cortes.</p>
            </div>
            <button type="button" onClick={() => toCrear(script, current?.titulo)} className="rounded-xl bg-accent px-5 py-3 font-semibold text-accent-ink">Pasar a crear mi anuncio →</button>
          </div>
        </section>
      )}
    </>
  );
}

function AnalysisView({ a, onImprove, onIdea }: { a: Analysis; onImprove: () => void; onIdea: (t: string) => void }) {
  const facts: [string, string][] = ([["Palanca", a.palanca], ["Ángulo", a.angulo], ["Le habla a", a.publico], ["Nivel de conciencia", a.conciencia], ["Emoción", a.emocion], ["Tipo de hook", a.tipo_hook], ["Estructura", a.estructura]] as [string, string][]).filter(([, v]) => v);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <b className="text-lg">{a.titulo}</b>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-sm">Puntaje <Score n={a.puntaje} /></span>
      </div>
      {a.resumen && <p>{a.resumen}</p>}
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-surface-2 px-3 py-2"><dt className="text-xs font-semibold text-muted">{k}</dt><dd className="text-sm">{v}</dd></div>
        ))}
      </dl>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">El guion, parte por parte</h3>
        <ul className="flex flex-col gap-2">{a.bloques.map((b, i) => <BlockRow key={i} b={b} showWhy />)}</ul>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {a.fortalezas.length > 0 && <ListBox title="✓ Lo que hace bien" items={a.fortalezas} tone="text-good" />}
        {a.mejoras.length > 0 && <ListBox title="↑ Qué mejorar" items={a.mejoras} tone="text-warn" />}
        {a.riesgos.length > 0 && <ListBox title="⚠ Riesgos" items={a.riesgos} tone="text-bad" />}
      </div>
      {a.ideas.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-bold">Ideas para testear</h3>
          <ul className="flex flex-col gap-1.5">
            {a.ideas.map((t, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">{t}</span>
                <button type="button" onClick={() => onIdea(t)} className="shrink-0 font-semibold text-accent-text underline">Probar esta idea</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" onClick={onImprove} className={`${btnCls} self-start`}>Mejorar el guion con estas sugerencias</button>
    </div>
  );
}

function ListBox({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2.5">
      <h3 className={`text-sm font-bold ${tone}`}>{title}</h3>
      <ul className="mt-1 list-disc pl-5 text-sm">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </div>
  );
}

function ScriptCard({ s, onUse, onCrear, onSave, onCopy }: { s: ScriptOut; onUse: () => void; onCrear: () => void; onSave: () => void; onCopy: () => void }) {
  const secs = s.segundos || spokenSeconds(scriptText(s.bloques));
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>{s.angulo ? `Ángulo: ${s.angulo}` : s.titulo}</b>
        <span className="flex items-center gap-2 text-xs text-muted">≈ {secs} s <Score n={s.puntaje} /></span>
      </div>
      {s.por_que && <p className="text-sm text-muted">{s.por_que}</p>}
      {s.cuando && <p className="text-xs text-muted"><b>Cuándo testearlo:</b> {s.cuando}</p>}
      <ul className="flex flex-col gap-2">{s.bloques.map((b, i) => <BlockRow key={i} b={b} />)}</ul>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onUse} className={btnCls}>Usar como mi guion</button>
        <button type="button" onClick={onCrear} className={ghostCls}>Crear anuncio con este</button>
        <button type="button" onClick={onSave} className={ghostCls}>☆ Guardar</button>
        <button type="button" onClick={onCopy} className={ghostCls}>Copiar</button>
      </div>
    </article>
  );
}

function Lesson() {
  const steps = useMemo(() => [
    ["Desarma", "Separa el guion en bloques y entiende qué hace cada uno."],
    ["Cambia una sola cosa", "Un hook nuevo o un ángulo nuevo, no todo a la vez: así sabes qué funcionó."],
    ["Testea 3 versiones", "Publica 3 variaciones con el mismo presupuesto y compara costo por lead."],
    ["Quédate con la ganadora", "Guárdala y vuelve a iterar sobre ella."],
  ], []);
  return (
    <section className={cardCls} aria-labelledby="leccion">
      <div className="flex flex-col gap-1">
        <h2 id="leccion" className="font-display text-lg font-bold">Cómo se arma un guion que vende</h2>
        <p className="text-sm text-muted">Casi todos los anuncios ganadores usan estos bloques, en este orden o parecido. Cada bloque responde una pregunta en la cabeza de quien mira.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BLOCKS.map((b) => (
          <div key={b.id} className="flex flex-col gap-1.5 rounded-xl border-l-4 bg-surface-2 px-3 py-2.5" style={{ borderColor: b.color }}>
            <Chip tipo={b.id} />
            <p className="text-sm">{b.what}</p>
            <p className="text-xs text-muted"><b>Pregúntate:</b> {b.ask}</p>
            <p className="text-xs"><span className="text-good">Bien:</span> {b.good}</p>
            <p className="text-xs"><span className="text-bad">Mal:</span> {b.bad}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">Cómo iterar hasta el guion ganador</h3>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([t, d], i) => (
            <li key={t} className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm"><b>{i + 1}. {t}</b><span className="mt-0.5 block text-xs text-muted">{d}</span></li>
          ))}
        </ol>
      </div>
    </section>
  );
}
