"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ToolRun from "../_parts/tool-run";
import { btnCls, cardCls, Field, ghostCls, inputCls, uploadFile } from "../_parts/ui";

// "Recrear": start from a video that works (an example from the gallery, or one of your own) and make
// it yours, two ways: change who or what appears (Editar video) or have your character copy its moves
// (Copiar movimiento). Picking an example copies it into the customer's folder for free; the price
// shows before anything is generated, as in every tool.

type Mode = "editar-video" | "copiar-movimiento" | "personaje-en-video" | "personaje-genjutsu";
interface Example { id: string; title: string; tag: string; prompt: string; mode: Mode; secs: number; play: string }

const ALL_MODES: { id: Mode; title: string; text: string; model: string; max: number }[] = [
  { id: "personaje-genjutsu", title: "Mi personaje · Máxima calidad", text: "Tu personaje reemplaza a la persona del video y todo lo demás queda igual: lugar, cámara, otras personas y sonido. Aguanta manos ocupadas y momentos tapados.", model: "Genjutsu", max: 30 },
  { id: "personaje-en-video", title: "Mi personaje · Estándar", text: "Tu personaje toma el lugar de la persona principal y repite sus mismos movimientos. Más barato; necesita que se le vea bien de la cintura para arriba.", model: "Nano Banana + Kling 3.0", max: 30 },
  { id: "editar-video", title: "Cambiar personaje u objetos", text: "Mismo video, mismo movimiento y audio: cambia la persona, el producto, la ropa o el lugar con tus fotos.", model: "Kling O1", max: 30 },
  { id: "copiar-movimiento", title: "Copiar movimiento", text: "Tu personaje (una foto) hace exactamente los mismos gestos, poses y movimientos de cámara.", model: "Kling 3.0", max: 30 },
];

/** The modes on offer (Máxima calidad only when its service is connected). */
let MODES = ALL_MODES.filter((m) => m.id !== "personaje-genjutsu");
const charMode = (): Mode => (MODES.some((m) => m.id === "personaje-genjutsu") ? "personaje-genjutsu" : "personaje-en-video");

function useLength(url?: string) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!url) return;
    const el = document.createElement("video");
    el.preload = "metadata";
    el.onloadedmetadata = () => setSecs(Number.isFinite(el.duration) ? el.duration : 0);
    el.src = url;
  }, [url]);
  return secs;
}

type Personaje = { sheet: string; nombre?: string };

/** The instruction that swaps the person in the video for the saved character (its sheet is photo 1). */
const swapPrompt = (nombre?: string) =>
  `Replace ONLY the main person of the video (the one the camera follows) with ${nombre ? `${nombre}, ` : ""}the character in foto 1: same face, nose, hair, glasses, body and clothes as in foto 1. foto 1 is a reference sheet of ONE single character seen from several angles: there must be only ONE of him in the video. Every other person stays exactly as in the original video. Do not add objects that are not in the original video. Keep exactly the same movements, timing and camera motion, and the same place and light. Photorealistic, natural phone-video look.`;

/** Keeps the chosen character (and the sound choice) while moving between the gallery and the tool. */
function carry(p?: Personaje, sound?: boolean) {
  const q = new URLSearchParams();
  if (p) { q.set("personaje", p.sheet); if (p.nombre) q.set("nombre", p.nombre); }
  if (sound === false) q.set("audio", "0");
  return q;
}

export default function Recrear({ video, mode, prompt, personaje, sound, maxima }: { video?: string; mode?: Mode; prompt?: string; personaje?: Personaje; sound?: boolean; maxima?: boolean }) {
  MODES = maxima ? ALL_MODES : ALL_MODES.filter((m) => m.id !== "personaje-genjutsu");
  const router = useRouter();
  const back = () => { const q = carry(personaje, sound).toString(); router.push(`/app/recrear${q ? `?${q}` : ""}`); };
  const secs = useLength(video);
  const tooLongToEdit = secs > 30.5;
  const [picked, setPicked] = useState<Mode | null>(mode ?? (personaje && video ? charMode() : null));
  // a long video can only be recreated by copying its motion
  const current: Mode | null = picked === "editar-video" && tooLongToEdit ? "copiar-movimiento" : picked ?? (video ? (tooLongToEdit ? "copiar-movimiento" : "editar-video") : null);

  if (!current) return <Gallery onOwn={(m) => setPicked(m)} personaje={personaje} sound={sound} />;

  // the character goes in as photo 1 (Cambiar personaje) or as the photo (Copiar movimiento)
  const startPrompt = personaje && current === "editar-video" ? swapPrompt(personaje.nombre) : current === (mode ?? current) ? prompt : undefined;

  return (
    <div className="flex flex-col gap-5">
      {personaje && <Banner personaje={personaje} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => { setPicked(null); back(); }} className="text-sm text-muted hover:text-ink">← Elegir otro video</button>
        {secs > 0 && <span className="text-xs text-muted">Tu video base dura {Math.round(secs)} s</span>}
      </div>
      <div role="radiogroup" aria-label="Cómo quieres recrearlo" className="grid gap-3 sm:grid-cols-2">
        {MODES.map((m) => {
          const off = m.id === "editar-video" && tooLongToEdit;
          const on = current === m.id;
          return (
            <button key={m.id} type="button" role="radio" aria-checked={on} disabled={off} onClick={() => setPicked(m.id)}
              className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition-colors ${on ? "border-accent bg-accent/10" : "border-line bg-surface hover:border-muted/60"} ${off ? "cursor-not-allowed opacity-50" : ""}`}>
              <span className="flex items-center justify-between gap-2">
                <b>{m.title}</b>
                <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted">{m.model}</span>
              </span>
              <span className="text-sm text-muted">{m.text}</span>
              <span className="text-xs text-muted">{off ? `Tu video dura ${Math.round(secs)} s: para esto debe durar ${m.max} s o menos.` : `Videos de hasta ${m.max} s.`}</span>
            </button>
          );
        })}
      </div>
      <ToolRun key={current} toolId={current} initial={{ video, prompt: startPrompt, image: personaje?.sheet, sound }} />
      <p className="text-xs text-muted">
        {current === "editar-video" && secs > 10.5 ? "Como dura más de 10 s, lo hacemos en partes y te entregamos un solo video unido. " : ""}¿Tu video dura más de 30 s? Recréalo por partes y júntalas en «Crear anuncio». <button type="button" onClick={() => { setPicked(null); back(); }} className="underline">Ver ejemplos</button>
      </p>
    </div>
  );
}

// ---------- the gallery ----------

function Banner({ personaje }: { personaje: Personaje }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-accent/40 bg-accent/5 p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={personaje.sheet} alt="" className="h-12 w-20 rounded-lg object-cover" />
      <p className="text-sm"><b>Recreando con {personaje.nombre || "tu personaje"}.</b> <span className="text-muted">Elige un video (de la galería o el tuyo) y {personaje.nombre || "tu personaje"} toma el lugar de la persona que aparece.</span></p>
    </div>
  );
}

function Gallery({ onOwn, personaje, sound }: { onOwn: (m: Mode) => void; personaje?: Personaje; sound?: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<Example[] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const load = () =>
    fetch("/api/inspiracion")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (!ok) throw new Error(d.error); setRows(d.rows ?? []); setCanEdit(Boolean(d.canEdit)); })
      .catch((e) => { setRows([]); setErr(e instanceof Error && e.message ? e.message : "No se pudieron cargar los ejemplos."); });
  useEffect(() => { load(); }, []);

  async function recreate(e: Example) {
    setBusy(e.id); setErr("");
    try {
      const res = await fetch("/api/inspiracion/usar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: e.id }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo preparar el video.");
      // with a character, every example opens as the swap (the example's own instruction is for its own use)
      const q = carry(personaje, sound);
      q.set("video", d.video);
      if (personaje) q.set("modo", charMode());
      else { q.set("modo", d.mode); if (d.prompt) q.set("prompt", d.prompt); }
      router.push(`/app/recrear?${q}`);
    } catch (x) {
      setErr(x instanceof Error ? x.message : "No se pudo preparar el video.");
      setBusy("");
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Quitar este ejemplo de la galería? Los clientes ya no lo verán.")) return;
    await fetch(`/api/inspiracion?id=${id}`, { method: "DELETE" }).catch(() => null);
    load();
  }

  return (
    <div className="flex flex-col gap-6">
      {personaje && <Banner personaje={personaje} />}
      <section className="grid gap-3 sm:grid-cols-2" aria-label="Recrear tu propio video" data-tour="recrear-modos">
        {MODES.map((m) => (
          <button key={m.id} type="button" onClick={() => onOwn(m.id)} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-muted/60">
            <span className="flex items-center justify-between gap-2"><b>{m.title}</b><span className="rounded-full border border-line px-2 py-0.5 font-mono text-[11px] text-muted">{m.model}</span></span>
            <span className="text-sm text-muted">{m.text}</span>
            <span className="text-xs font-semibold text-accent">Subir mi video</span>
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="insp" data-tour="recrear-galeria">
        <div className="flex flex-col gap-0.5">
          <h2 id="insp" className="font-display text-lg font-bold">Inspiración</h2>
          <p className="text-sm text-muted">Anuncios que funcionan. Toca «Recrear» y cámbiales la persona, el producto o el lugar por los tuyos.</p>
        </div>
        {err && <p className="text-sm text-bad">{err}</p>}
        {rows === null ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Muy pronto vas a ver aquí anuncios ganadores listos para recrear. Mientras, sube tu propio video arriba.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {rows.map((e) => (
              <article key={e.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
                <video src={e.play} muted loop playsInline preload="metadata" className="aspect-[9/16] w-full bg-black object-cover"
                  onMouseEnter={(v) => v.currentTarget.play().catch(() => {})} onMouseLeave={(v) => v.currentTarget.pause()} onFocus={(v) => v.currentTarget.play().catch(() => {})} tabIndex={-1} />
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div className="flex flex-col">
                    <b className="text-sm leading-tight">{e.title}</b>
                    <span className="text-xs text-muted">{[e.tag, `${Math.round(e.secs)} s`].filter(Boolean).join(" · ")}</span>
                  </div>
                  <button type="button" onClick={() => recreate(e)} disabled={Boolean(busy)} className={`${btnCls} mt-auto`}>
                    {busy === e.id ? "Preparando…" : "↻ Recrear"}
                  </button>
                  {canEdit && <button type="button" onClick={() => remove(e.id)} className="text-xs text-muted hover:text-bad">Quitar de la galería</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {canEdit && <AddExample onAdded={load} />}
    </div>
  );
}

/** Owner only: publish a video to the gallery. */
function AddExample({ onAdded }: { onAdded: () => void }) {
  const [video, setVideo] = useState("");
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<Mode>("editar-video");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function up(f?: File) {
    if (!f) return;
    setBusy(true); setMsg("");
    try { setVideo(await uploadFile(f)); } catch (e) { setMsg(e instanceof Error ? e.message : "No se pudo subir."); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/inspiracion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ video, title, tag, prompt, mode }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo guardar.");
      setVideo(""); setTitle(""); setTag(""); setPrompt("");
      setMsg("Listo: ya está en la galería para todos tus clientes.");
      onAdded();
    } catch (e) { setMsg(e instanceof Error ? e.message : "No se pudo guardar."); } finally { setBusy(false); }
  }

  return (
    <section className={cardCls} aria-labelledby="add-ex">
      <div className="flex flex-col gap-0.5">
        <h2 id="add-ex" className="font-semibold">Agregar ejemplo a la galería</h2>
        <p className="text-sm text-muted">Solo tú ves esto. Sube un anuncio (hasta 30 s) con permiso para usarlo; tus clientes lo verán con el botón «Recrear».</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${ghostCls} cursor-pointer`}>
          {busy && !video ? "Subiendo…" : video ? "Cambiar video" : "Subir video"}
          <input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => up(e.target.files?.[0])} />
        </label>
        {video && <video src={video} muted playsInline controls className="max-h-40 rounded-lg bg-black" />}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Testimonio en la cocina" /></Field>
        <Field label="Etiqueta (opcional)"><input value={tag} onChange={(e) => setTag(e.target.value)} className={inputCls} placeholder="Seguros · UGC" /></Field>
      </div>
      <Field label="Se abre en">
        <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className={inputCls}>
          {MODES.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
      </Field>
      <Field label="Instrucción sugerida (opcional)" hint="Se llena sola cuando el cliente toca «Recrear». Ej: «Cambia a la mujer por la persona de la foto 1».">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2} className={inputCls} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy || !video || title.trim().length < 2} className={btnCls}>{busy && video ? "Guardando…" : "Publicar en la galería"}</button>
        {msg && <p className="text-sm text-muted">{msg}</p>}
      </div>
    </section>
  );
}
