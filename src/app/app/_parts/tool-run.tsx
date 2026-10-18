"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { DUB_LANGS, findTool, TOOLS, type ToolId } from "@/lib/tools";
import { btnCls, cardCls, Field, ghostCls, inputCls, Spinner, uploadFile, useTable, Working, type Row } from "./ui";
import { refreshCredits, useCredits } from "./use-credits";

// One "Crear" tool: pick the inputs, see the price, run it, and get the result (kept in "Tus creaciones").

interface Job extends Row { kind: string; status: string; url: string | null; image_url: string | null; prompt: string | null; error: string | null; usd: number | null; text: string | null }
export interface Img extends Row { url: string; prompt: string | null }
interface Voice { id: string; name: string; category: string }

/** Length of a local video/audio file, read by the browser before uploading. */
function mediaLength(file: File): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith("audio/") ? "audio" : "video");
    el.preload = "metadata";
    el.onloadedmetadata = () => { resolve(Number.isFinite(el.duration) ? el.duration : 0); URL.revokeObjectURL(el.src); };
    el.onerror = () => resolve(0);
    el.src = URL.createObjectURL(file);
  });
}
function urlLength(url: string, kind: "video" | "audio"): Promise<number> {
  return new Promise((resolve) => {
    const el = document.createElement(kind);
    el.preload = "metadata";
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : 0);
    el.onerror = () => resolve(0);
    el.src = url;
  });
}

// ---------- inputs ----------

/** A labelled block for inputs that hold buttons (a <label> around buttons confuses screen readers). */
function Group({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const id = `g-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div role="group" aria-labelledby={id} className="flex min-w-0 flex-col gap-1 text-sm">
      <span id={id} className="font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function ImageInput({ value, onChange, library }: { value: string; onChange: (u: string) => void; library: Img[] }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pick, setPick] = useState(false);
  async function up(f: File | undefined) {
    if (!f) return;
    setBusy(true); setErr("");
    try { onChange(await uploadFile(f)); } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo subir."); } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${ghostCls} cursor-pointer`}>
          {busy ? "Subiendo…" : value ? "Cambiar foto" : "Subir foto"}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => up(e.target.files?.[0])} />
        </label>
        {library.length > 0 && (
          <button type="button" onClick={() => setPick((p) => !p)} className={ghostCls} aria-expanded={pick}>
            {pick ? "Cerrar biblioteca" : "Elegir de mis imágenes"}
          </button>
        )}
        {value && <button type="button" onClick={() => onChange("")} className="text-xs text-muted hover:text-bad">Quitar</button>}
      </div>
      {err && <p className="text-sm text-bad">{err}</p>}
      {pick && (
        <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-6">
          {library.slice(0, 48).map((im) => (
            <button key={im.id} type="button" onClick={() => { onChange(im.url); setPick(false); }} className="overflow-hidden rounded-lg border border-line hover:border-ink" title={im.prompt ?? ""}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt={im.prompt ?? "Imagen"} className="aspect-square w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Foto elegida" className="max-h-56 w-fit rounded-lg border border-line object-contain" />
      )}
    </div>
  );
}

function MediaInput({ kind, value, onChange, limits }: { kind: "video" | "audio"; value: { url: string; secs: number } | null; onChange: (v: { url: string; secs: number } | null) => void; limits: { min: number; max: number } }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function up(f: File | undefined) {
    if (!f) return;
    setErr("");
    const tooLong = (n: number) => n && (n < limits.min - 0.3 || n > limits.max + 0.5) ? `Debe durar entre ${limits.min} y ${limits.max} segundos (este dura ${Math.round(n)} s).` : "";
    let secs = await mediaLength(f);
    if (tooLong(secs)) return setErr(tooLong(secs));
    setBusy(true);
    try {
      const url = await uploadFile(f);
      // the browser couldn't read the length (some .mov files): ask the server
      if (!secs) secs = Number((await fetch(`/api/tools/length?url=${encodeURIComponent(url)}`).then((r) => r.json()).catch(() => ({})))?.seconds) || 0;
      if (tooLong(secs)) return setErr(tooLong(secs));
      onChange({ url, secs });
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo subir."); } finally { setBusy(false); }
  }
  const accept = kind === "video" ? "video/mp4,video/quicktime,video/webm" : "audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${ghostCls} cursor-pointer`}>
          {busy ? "Subiendo…" : value ? `Cambiar ${kind === "video" ? "video" : "audio"}` : `Subir ${kind === "video" ? "video" : "audio"}`}
          <input type="file" accept={accept} className="sr-only" onChange={(e) => up(e.target.files?.[0])} />
        </label>
        <span className="text-xs text-muted">De {limits.min} a {limits.max} s · hasta 50 MB</span>
        {value && <button type="button" onClick={() => onChange(null)} className="text-xs text-muted hover:text-bad">Quitar</button>}
      </div>
      {err && <p className="text-sm text-bad">{err}</p>}
      {value && (kind === "video"
        ? <video src={value.url} controls playsInline className="max-h-64 w-fit rounded-lg bg-black" />
        : <audio src={value.url} controls className="w-full max-w-md" />)}
    </div>
  );
}

/** Audio for the avatar / lip-sync: upload one, or write the line and have a voice read it. */
function AudioInput({ value, onChange, limits }: { value: { url: string; secs: number } | null; onChange: (v: { url: string; secs: number } | null) => void; limits: { min: number; max: number } }) {
  const [mode, setMode] = useState<"write" | "upload">("write");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [voicesErr, setVoicesErr] = useState("");
  const { price } = useCredits();
  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok || !Array.isArray(d.voices)) throw new Error();
        setVoices(d.voices);
        setVoiceId((v) => v || d.voices[0]?.id || "");
        if (!d.voices.length) setVoicesErr("No hay voces disponibles por ahora. Sube un audio en su lugar.");
      })
      .catch(() => setVoicesErr("No se pudieron cargar las voces. Recarga la página."));
  }, []);
  // same price as the server: per character read
  const voiceUsd = text.trim().length * 0.00022;
  async function speak() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/voices/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ voiceId, text, model: "eleven_multilingual_v2" }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo generar la voz.");
      const secs = await urlLength(d.url, "audio");
      refreshCredits();
      if (secs && (secs < limits.min - 0.3 || secs > limits.max + 0.5)) throw new Error(`El audio quedó de ${Math.round(secs)} s y debe durar entre ${limits.min} y ${limits.max} s. ${secs > limits.max ? "Acorta" : "Alarga"} el texto y genera de nuevo (esta voz ya usó ${price(voiceUsd)}).`);
      onChange({ url: d.url, secs });
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo generar la voz."); } finally { setBusy(false); }
  }
  // ~2.6 words per second when spoken
  const est = Math.round(text.trim().split(/\s+/).filter(Boolean).length / 2.6);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-lg bg-surface-2 p-1 text-sm" role="tablist">
        {([["write", "Escribir y elegir voz"], ["upload", "Subir audio"]] as const).map(([m, l]) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={`flex-1 rounded-md px-3 py-1.5 font-semibold ${mode === m ? "bg-surface text-ink shadow-sm" : "text-muted"}`}>{l}</button>
        ))}
      </div>
      {mode === "upload" ? (
        <MediaInput kind="audio" value={value} onChange={onChange} limits={limits} />
      ) : (
        <div className="flex flex-col gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} className={inputCls} placeholder="Lo que dice la persona, tal cual (en español o inglés)." />
          <div className="flex flex-wrap items-center gap-2">
            <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className={inputCls} aria-label="Voz">
              {voices.length === 0 && <option value="">{voicesErr ? "Sin voces" : "Cargando voces…"}</option>}
              {voices.map((v) => <option key={v.id} value={v.id}>{v.name}{v.category === "cloned" ? " (tu voz)" : ""}</option>)}
            </select>
            <button type="button" onClick={speak} disabled={busy || !voiceId || text.trim().length < 2} className={ghostCls}>
              {busy ? "Generando voz…" : text.trim().length >= 2 ? `Generar voz · ${price(voiceUsd)}` : "Generar voz"}
            </button>
            {text.trim() && <span className="text-xs text-muted">≈ {est} s de audio</span>}
          </div>
          {voicesErr && <p className="text-sm text-warn">{voicesErr}</p>}
          {err && <p className="text-sm text-bad">{err}</p>}
          {value && <audio src={value.url} controls className="w-full max-w-md" />}
        </div>
      )}
    </div>
  );
}

// ---------- results ----------

function Result({ job, output, extra }: { job: Job; output: "image" | "video" | "audio"; extra?: (url: string) => React.ReactNode }) {
  if (job.status === "failed") return <p className="text-sm text-bad">{job.error || "No se pudo crear. Si se usaron créditos, ya volvieron a tu saldo."}</p>;
  if (job.status === "stuck") return <p className="text-sm text-warn">{job.error}</p>;
  if (job.status !== "done" || !job.url) return (
    <div className="flex flex-col gap-1 text-sm">
      <Working key={job.id} since={job.created_at} label={output === "image" ? "Creando tu imagen…" : output === "audio" ? "Creando tu audio…" : "Creando tu video…"} className="font-semibold" />
      <p className="text-muted">Puedes cerrar esta página: queda guardado en «Tus creaciones».</p>
    </div>
  );
  const next = output === "audio" ? [] : TOOLS.filter((x) => (output === "image" ? (x.inputs.image || x.inputs.images) && !x.inputs.video : x.inputs.video) && `tool:${x.id}` !== job.kind);
  return (
    <div className="flex flex-col gap-3">
      {output === "image" ? (
        <a href={job.url} target="_blank" rel="noreferrer" className="w-fit rounded-xl border border-line bg-[repeating-conic-gradient(var(--surface-2)_0_25%,var(--surface)_0_50%)] bg-[length:20px_20px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={job.url} alt="Resultado" className="max-h-[480px] w-auto rounded-xl object-contain" />
        </a>
      ) : output === "audio" ? (
        <audio src={job.url} controls className="w-full" />
      ) : (
        <video src={job.url} controls playsInline className="max-h-[520px] w-fit rounded-xl bg-black" />
      )}
      {extra?.(job.url)}
      <div className="flex flex-wrap items-center gap-2">
        <a href={job.url} download className={btnCls}>Descargar</a>
        {output === "video" && (
          <Link href={`/app/recrear?video=${encodeURIComponent(job.url)}`} className={ghostCls} title="Usa este video como base: cambia la persona, el producto o el lugar, o copia su movimiento con otro personaje">
            ↻ Recrear
          </Link>
        )}
        {next.filter((x) => output !== "video" || (x.id !== "editar-video" && x.id !== "copiar-movimiento")).map((x) => (
          <Link key={x.id} href={`/app/herramientas/${x.id}?${output === "image" ? "image" : "video"}=${encodeURIComponent(job.url!)}`} className={ghostCls}>
            {x.name}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ---------- the tool page ----------

/** Saved characters (Influencer IA), to pick as the photo in «Copiar movimiento». */
function Characters({ onPick, selected }: { onPick: (u: string) => void; selected: string }) {
  const [list, setList] = useState<{ id: string; name: string; sheet: string | null }[] | null>(null);
  useEffect(() => { fetch("/api/personajes").then((r) => r.json()).then((d) => setList(d.personajes ?? [])).catch(() => setList([])); }, []);
  if (!list?.length) return <p className="text-xs text-muted">¿Quieres usar un personaje propio? Créalo en <Link href="/app/influencer/nuevo" className="font-semibold underline">Influencer IA</Link> y aparece aquí.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {list.filter((p) => p.sheet).map((p) => (
        <button key={p.id} type="button" onClick={() => onPick(p.sheet!)} aria-pressed={selected === p.sheet} title={p.name}
          className={`flex w-24 flex-col gap-1 overflow-hidden rounded-lg border p-1 text-left text-xs ${selected === p.sheet ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-muted"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.sheet!} alt={p.name} className="aspect-video w-full rounded object-cover" loading="lazy" />
          <span className="truncate font-semibold">{p.name}</span>
        </button>
      ))}
    </div>
  );
}

export default function ToolRun({ toolId, initial, promptValue, resultExtra, imagesLabel }: {
  toolId: ToolId; initial: { image?: string; video?: string; prompt?: string; sound?: boolean };
  /** When the page builds the instruction (Crear personaje), it stays in sync and editable here. */
  promptValue?: string;
  /** An extra action under a finished result (e.g. «Guardar personaje»). */
  resultExtra?: (url: string) => React.ReactNode;
  imagesLabel?: string;
}) {
  const t = findTool(toolId)!;
  const library = useTable<Img>("images");
  const [image, setImage] = useState(initial.image ?? "");
  const [images, setImages] = useState<string[]>(initial.image ? [initial.image] : []);
  const [video, setVideo] = useState<{ url: string; secs: number } | null>(null);
  const [audio, setAudio] = useState<{ url: string; secs: number } | null>(null);
  const [prompt, setPrompt] = useState(promptValue ?? initial.prompt ?? "");
  useEffect(() => { if (promptValue !== undefined) setPrompt(promptValue); }, [promptValue]);
  const [target, setTarget] = useState<string>("es");
  const [length, setLength] = useState<number>(findTool(toolId)?.inputs.length?.[1] ?? 0);
  const [instrumental, setInstrumental] = useState(true);
  const [sound, setSound] = useState(initial.sound ?? true);
  const recreates = t.id === "editar-video" || t.id === "copiar-movimiento" || t.id === "personaje-en-video";
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const fails = useRef(new Map<string, number>());

  // a video passed from another tool: read its length
  useEffect(() => {
    if (!initial.video) return;
    urlLength(initial.video, "video").then((secs) => setVideo({ url: initial.video!, secs }));
  }, [initial.video]);

  const poll = useCallback(function check(id: string) {
    fetch(`/api/tools/${t.id}?id=${id}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || "No se pudo revisar.");
        if (d.state === "done" || d.state === "failed") {
          setJobs((js) => js.map((j) => (j.id === id ? { ...j, status: d.state, url: d.url ?? null, error: d.error ?? null } : j)));
          return;
        }
        timers.current.set(id, setTimeout(() => check(id), t.output === "video" ? 10000 : 4000));
      })
      .catch(() => {
        // keep trying for about 10 minutes of errors, then stop and say so (reloading checks again)
        const n = (fails.current.get(id) ?? 0) + 1;
        fails.current.set(id, n);
        if (n < 40) timers.current.set(id, setTimeout(() => check(id), 15000));
        else setJobs((js) => js.map((j) => (j.id === id ? { ...j, status: "stuck", error: "No pudimos revisar este trabajo. Recarga la página para volver a intentarlo; si falló, los créditos vuelven solos." } : j)));
      });
  }, [t.id, t.output]);

  // this tool's earlier jobs; keep watching the ones still running
  useEffect(() => {
    const map = timers.current;
    fetch("/api/tools").then((r) => r.json()).then((d) => {
      const mine: Job[] = (d.rows ?? []).filter((j: Job) => j.kind === `tool:${t.id}`).slice(0, 12);
      setJobs(mine);
      mine.filter((j) => j.status === "running").forEach((j) => poll(j.id));
    }).catch(() => {});
    return () => map.forEach((x) => clearTimeout(x));
  }, [t.id, poll]);

  const n = t.inputs;
  const seconds = n.length ? length : t.id === "avatar-habla" ? audio?.secs ?? 0 : video?.secs ?? 0;
  const usd = t.estimate(seconds);
  const { price: money, covers, info } = useCredits();
  const missing =
    (n.image && !image) ? "Sube o elige una foto." :
    (n.images && !n.imagesOptional && images.length === 0) ? "Sube o elige al menos una foto." :
    (n.video && !video) ? "Sube un video." :
    (n.audio && !audio) ? "Agrega el audio: súbelo o escríbelo y genera la voz." :
    (n.prompt === "required" && prompt.trim().length < 4) ? "Escribe qué quieres que haga." :
    ((t.consent || (t.id === "crear-personaje" && images.length > 0)) && !consent) ? "Confirma el permiso de la persona." : "";

  async function run() {
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/api/tools/${t.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image, images, video: video?.url, audio: audio?.url, seconds, prompt, target, consent, length, instrumental, ...(recreates ? { sound } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo iniciar.");
      const job: Job = { id: d.id, created_at: new Date().toISOString(), kind: `tool:${t.id}`, status: "running", url: null, image_url: image || images[0] || video?.url || null, prompt, error: null, usd: d.usd, text: null };
      setJobs((js) => [job, ...js]);
      refreshCredits();
      timers.current.set(d.id, setTimeout(() => poll(d.id), t.output === "video" ? 12000 : 2000));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo iniciar.");
    } finally {
      setBusy(false);
    }
  }

  const imgs = library.rows ?? [];
  const latest = jobs[0];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className={cardCls} aria-label="Lo que necesitas">
        {n.image && (t.id === "copiar-movimiento" || t.id === "personaje-en-video") && <Group label="Tus personajes" hint={t.id === "personaje-en-video" ? "Toca uno: toma el lugar de la persona principal del video." : "Toca uno para usarlo como la foto: sale con la misma cara de su ficha."}><Characters selected={image} onPick={setImage} /></Group>}
        {n.image && <Group label={t.id === "personaje-en-video" ? "Personaje (su ficha o una foto)" : "Foto"}><ImageInput value={image} onChange={setImage} library={imgs} /></Group>}
        {n.images && t.id === "editar-video" && <Group label="Tus personajes" hint="Toca uno para ponerlo en lugar de la persona del video (queda como foto 1)."><Characters selected={images[0] ?? ""} onPick={(u) => setImages((l) => [u, ...l.filter((x) => x !== u)].slice(0, n.images || 4))} /></Group>}
        {n.images && (
          <Group label={imagesLabel ?? (n.imagesOptional ? `Fotos de referencia (opcional, hasta ${n.images})` : `Fotos (hasta ${n.images})`)} hint={t.id === "crear-personaje" ? "La primera puede ser una cara de guía (no se copia exacta: mandan los rasgos que elegiste); las otras, imágenes de estilo." : n.imagesOptional ? "Una cara nueva, un producto o un lugar. Nómbralas en tu instrucción como «foto 1», «foto 2»." : "La primera es la principal."}>
            <div className="flex flex-col gap-3">
              {images.map((u, i) => (
                <ImageInput key={i} value={u} library={imgs} onChange={(v) => setImages((l) => (v ? l.map((x, j) => (j === i ? v : x)) : l.filter((_, j) => j !== i)))} />
              ))}
              {images.length < n.images && <ImageInput value="" library={imgs} onChange={(v) => v && setImages((l) => [...l, v])} />}
            </div>
          </Group>
        )}
        {n.video && <Group label="Video"><MediaInput kind="video" value={video} onChange={setVideo} limits={n.video} /></Group>}
        {n.audio && <Group label="Audio"><AudioInput value={audio} onChange={setAudio} limits={n.audio} /></Group>}
        {n.prompt && (
          <Field label={t.id === "crear-personaje" ? "Instrucción para la IA (se arma sola con tus opciones; puedes editarla)" : n.prompt === "required" ? "Qué quieres" : "Instrucción (opcional)"} hint={t.id === "crear-personaje" ? undefined : n.promptHint}>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={t.id === "crear-personaje" ? 6 : 3} className={inputCls} />
          </Field>
        )}
        {n.prompt && t.ideas && (
          <Group label="Ideas para empezar" hint="Tócala para usarla y después ajústala a tu caso.">
            <div className="flex flex-wrap gap-1.5">
              {t.ideas.map((x) => (
                <button key={x} type="button" onClick={() => setPrompt(x)} aria-pressed={prompt === x}
                  className={`rounded-full border px-3 py-1 text-left text-xs font-medium transition-colors ${prompt === x ? "border-accent bg-accent/10 text-ink" : "border-line text-muted hover:border-muted hover:text-ink"}`}>
                  {x}
                </button>
              ))}
            </div>
          </Group>
        )}
        {n.target && (
          <Field label="Doblar al">
            <select value={target} onChange={(e) => setTarget(e.target.value)} className={inputCls}>
              {DUB_LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </Field>
        )}
        {n.length && (
          <Field label="Largo">
            <select value={length} onChange={(e) => setLength(Number(e.target.value))} className={inputCls}>
              {n.length.map((l) => <option key={l} value={l}>{l < 60 ? `${l} segundos` : `${l / 60} minuto${l > 60 ? "s" : ""}`}</option>)}
            </select>
          </Field>
        )}
        {n.instrumental && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} />
            <span>Solo instrumental (sin voz cantada)</span>
          </label>
        )}
        {recreates && (
          <div role="radiogroup" aria-label="Audio del resultado" className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-muted">Audio</span>
            <div className="flex flex-wrap gap-2">
              {([[true, "Con el audio del video original"], [false, "Sin audio"]] as const).map(([v, l]) => (
                <button key={l} type="button" role="radio" aria-checked={sound === v} onClick={() => setSound(v)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${sound === v ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:border-muted hover:text-ink"}`}>{l}</button>
              ))}
            </div>
            {!sound && <span className="text-xs text-muted">El video sale mudo: ideal para ponerle música o una voz después en «Crear anuncio».</span>}
          </div>
        )}
        {(t.consent || (t.id === "crear-personaje" && images.length > 0)) && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
            <span>{t.id === "crear-personaje" ? "Las fotos son mías o tengo permiso para usarlas. No es una persona famosa ni alguien que no lo autorizó." : "Tengo permiso de la persona que aparece o habla para usar su cara y su voz en este contenido."}</span>
          </label>
        )}

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <p className="text-sm text-muted">
            Precio: <b className="text-ink">{(n.video || n.audio) && !seconds ? "desde " : ""}{money(usd)}</b>{t.approx ? " aprox." : ""}{info?.unlimited ? ` · ${t.priceNote}` : ""}
            {(n.video || n.audio) && !seconds ? ". El precio exacto aparece al subir el archivo." : ""}
          </p>
          <button type="button" onClick={run} disabled={busy || Boolean(missing) || !covers(usd)} className={btnCls}>
            {busy ? <span className="inline-flex items-center gap-2"><Spinner />Iniciando…</span> : `${t.name} · ${money(usd)}`}
          </button>
          {missing && <p className="text-xs text-muted">{missing}</p>}
          {!covers(usd) && <p className="text-xs text-warn">Te faltan créditos para esto. <a href="/app/planes" className="font-semibold underline">Suma créditos</a>.</p>}
          {err && <p className="text-sm text-bad">{err}</p>}
        </div>
      </section>

      <section className={cardCls} aria-label="Resultado">
        <h2 className="font-semibold">Resultado</h2>
        {latest ? <Result job={latest} output={t.output} extra={resultExtra} /> : <p className="text-sm text-muted">Aquí aparece lo que crees. Lo que hagas queda guardado en «Tus creaciones».</p>}
        {jobs.length > 1 && (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-muted">Antes con esta herramienta</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {jobs.slice(1).map((j) => (
                <a key={j.id} href={j.url ?? undefined} target="_blank" rel="noreferrer" className="relative aspect-square overflow-hidden rounded-lg border border-line bg-surface-2" title={j.prompt ?? ""}>
                  {j.url && t.output === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={j.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : j.url && t.output === "audio" ? (
                    <span className="grid h-full place-items-center text-xs text-muted">♪ Audio</span>
                  ) : j.url ? (
                    <video src={j.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                  ) : (
                    <span className={`grid h-full place-items-center p-1 text-center text-xs ${j.status === "failed" ? "text-bad" : "text-muted"}`}>{j.status === "failed" ? "Falló" : <Spinner className="h-5 w-5" />}</span>
                  )}
                </a>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
