"use client";

import { useEffect, useRef, useState } from "react";
import { uploadFile } from "./ui";

// "Crear una voz con tus audios": drop or pick up to 5 recordings (audio or video, any common format),
// or record straight from the microphone, then clone the voice from all of them together.

const MAX_FILES = 5;
const MAX_MB = 50;
const IDEAL = [60, 180]; // seconds
const READ_ME =
  "Hola, soy parte del equipo y hoy te quiero contar algo que nos cambió la forma de trabajar. Antes demorábamos días en tener un video listo; ahora lo hacemos en minutos y con la misma calidad. ¿Lo mejor? No necesitas saber de edición ni de tecnología. Solo cuentas lo que quieres decir, eliges cómo quieres que se vea y listo. Si te interesa, escríbenos y te mostramos cómo funciona.";

interface Item { id: string; file: File; secs: number | null; url: string }

// The formats our storage accepts; phones label the same files in different ways (WhatsApp notes are .opus).
const ALIAS: Record<string, string> = { "audio/opus": "audio/ogg", "audio/mp3": "audio/mpeg", "audio/x-mp3": "audio/mpeg", "audio/wave": "audio/wav", "audio/vnd.wave": "audio/wav", "audio/m4a": "audio/mp4", "audio/x-m4a": "audio/mp4", "audio/x-aac": "audio/aac" };
const BY_EXT: Record<string, string> = { opus: "audio/ogg", ogg: "audio/ogg", oga: "audio/ogg", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", webm: "audio/webm", mp4: "video/mp4", mov: "video/quicktime" };
const baseType = (t: string) => t.split(";")[0].trim().toLowerCase();
function typeOf(f: File) {
  const t = baseType(f.type);
  return ALIAS[t] ?? (t || BY_EXT[f.name.split(".").pop()?.toLowerCase() ?? ""] || "");
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

function lengthOf(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : null);
    a.onerror = () => resolve(null);
    a.src = url;
  });
}

export default function VoiceFromAudios({ code, onCreated }: { code: string; onCreated: (voiceId: string) => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [consent, setConsent] = useState(false);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // microphone
  const [rec, setRec] = useState<MediaRecorder | null>(null);
  const [recSecs, setRecSecs] = useState(0);
  const recStart = useRef(0);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setRecSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [rec]);
  useEffect(() => () => items.forEach((i) => URL.revokeObjectURL(i.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(files: File[], secsHint?: number) {
    setErr(""); setDone("");
    const room = MAX_FILES - items.length;
    if (room <= 0) return setErr(`Máximo ${MAX_FILES} audios por voz.`);
    const ok: Item[] = [];
    for (const f of files.slice(0, room)) {
      const t = typeOf(f);
      if (!t.startsWith("audio/") && !t.startsWith("video/")) { setErr(`«${f.name}» no es audio ni video.`); continue; }
      if (f.size > MAX_MB * 1024 * 1024) { setErr(`«${f.name}» pesa más de ${MAX_MB} MB.`); continue; }
      const url = URL.createObjectURL(f);
      // browsers can't tell the length of a fresh recording (webm says "infinite"): use the recording timer
      ok.push({ id: `${Date.now()}-${Math.random()}`, file: f, secs: (await lengthOf(url)) ?? secsHint ?? null, url });
    }
    if (files.length > room) setErr(`Solo caben ${MAX_FILES} audios; agregué los primeros ${room}.`);
    setItems((x) => [...x, ...ok]);
  }

  function removeItem(id: string) {
    setItems((x) => {
      const it = x.find((i) => i.id === id);
      if (it) URL.revokeObjectURL(it.url);
      return x.filter((i) => i.id !== id);
    });
  }

  async function startRec() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      chunks.current = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const t = baseType(r.mimeType || type || "audio/webm");
        const ext = t.includes("mp4") ? "m4a" : t.includes("ogg") ? "ogg" : "webm";
        const file = new File(chunks.current, `grabacion-${new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).replace(/:/g, "")}.${ext}`, { type: t });
        add([file], Math.round((Date.now() - recStart.current) / 1000));
        setRec(null);
      };
      r.start(1000);
      recStart.current = Date.now();
      setRecSecs(0);
      setRec(r);
    } catch {
      setErr("No pudimos usar el micrófono. Revisa que el navegador tenga permiso para usarlo.");
    }
  }

  async function create() {
    setErr(""); setDone("");
    try {
      const refs: string[] = [];
      for (const [i, it] of items.entries()) {
        setBusy(`Subiendo audio ${i + 1} de ${items.length}…`);
        const t = typeOf(it.file);
        const f = t === it.file.type ? it.file : new File([it.file], it.file.name, { type: t });
        refs.push(await uploadFile(f));
      }
      setBusy("Creando la voz… (≈ 30 segundos)");
      const res = await fetch("/api/voices/clone", { method: "POST", headers: { "content-type": "application/json", "x-creads-code": code }, body: JSON.stringify({ name, consent, files: refs }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo crear la voz.");
      setDone(`Voz «${name}» lista. Ya quedó elegida abajo: escríbele una frase para escucharla.`);
      items.forEach((i) => URL.revokeObjectURL(i.url));
      setItems([]); setName(""); setConsent(false);
      await onCreated(d.voiceId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo crear la voz.");
    } finally {
      setBusy("");
    }
  }

  const total = items.reduce((a, i) => a + (i.secs ?? 0), 0);
  const known = items.every((i) => i.secs !== null);
  const pct = Math.min(100, (total / IDEAL[1]) * 100);
  const hint = !items.length ? "" : total < 30 ? "Muy poco audio: suma al menos 30 segundos." : total < IDEAL[0] ? "Sirve, pero queda mejor con 1 minuto o más." : total <= IDEAL[1] + 30 ? "Perfecto para una voz natural." : "Más de 3 minutos: usaremos los primeros 3 de cada audio.";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">Crear una voz con tus audios</h3>
        <p className="text-sm text-muted">Sube grabaciones de la persona hablando (audios de WhatsApp, notas de voz, videos o mp3), o graba aquí mismo. Lo ideal: 1 a 3 minutos en total, una sola persona, sin música ni ruido.</p>
      </div>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        Nombre de la voz
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Camila (Chile)" maxLength={60}
          className="rounded-lg border border-line bg-surface-2 px-3 py-2 font-normal" />
      </label>

      {/* drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(Array.from(e.dataTransfer.files)); }}
        className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${over ? "border-accent-text bg-accent/10" : "border-line"}`}
      >
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-muted" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        <p className="text-sm"><b>Arrastra tus audios aquí</b> <span className="text-muted">o</span></p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => input.current?.click()} disabled={Boolean(busy) || items.length >= MAX_FILES}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50">Elegir archivos</button>
          {rec ? (
            <button type="button" onClick={() => rec.stop()} className="flex items-center gap-2 rounded-lg bg-rec px-4 py-2 text-sm font-semibold text-white">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" aria-hidden="true" /> Detener · {fmt(recSecs)}
            </button>
          ) : (
            <button type="button" onClick={startRec} disabled={Boolean(busy) || items.length >= MAX_FILES}
              className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Grabar con el micrófono</button>
          )}
        </div>
        <p className="text-xs text-muted">Hasta {MAX_FILES} archivos de {MAX_MB} MB · mp3, m4a, wav, ogg, opus, mp4, mov</p>
        <input ref={input} type="file" multiple accept="audio/*,video/*,.opus,.ogg,.m4a" className="hidden" onChange={(e) => { add(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      </div>

      {rec && (
        <div className="rounded-xl bg-surface-2 p-4 text-sm">
          <b className="mb-1 block">Lee esto en voz alta, con tu tono natural:</b>
          <p className="leading-relaxed text-muted">{READ_ME}</p>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {items.map((it) => (
              <li key={it.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{it.file.name}</span>
                <span className="font-mono text-xs text-muted">{it.secs !== null ? fmt(it.secs) : "—"} · {(it.file.size / 1024 / 1024).toFixed(1)} MB</span>
                <audio src={it.url} controls className="h-8 w-full sm:w-56" aria-label={`Escuchar ${it.file.name}`} />
                <button type="button" onClick={() => removeItem(it.id)} disabled={Boolean(busy)} className="text-xs text-muted hover:text-bad">Quitar</button>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1">
            <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={IDEAL[1]} aria-valuenow={Math.round(total)} aria-label="Audio total">
              <div className={`h-full rounded-full ${total < 30 ? "bg-warn" : "bg-good"}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted">{known ? `Total ${fmt(total)}. ` : ""}{hint}</span>
          </div>
        </div>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        <span>Tengo el permiso de esta persona para crear su voz y usarla en anuncios.</span>
      </label>

      <button type="button" onClick={create} disabled={!code || !name.trim() || !items.length || !consent || Boolean(busy) || Boolean(rec)}
        className="rounded-lg bg-[image:var(--grad)] px-4 py-3 font-semibold text-white disabled:opacity-50">
        {busy || `Crear voz${items.length ? ` con ${items.length} audio${items.length > 1 ? "s" : ""}` : ""}`}
      </button>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      {done && <p role="status" className="text-sm font-semibold text-good">{done}</p>}
    </div>
  );
}
