"use client";

import { useCallback, useEffect, useState } from "react";
import VoiceFromAudios from "./voice-upload";
import { useCredits } from "./use-credits";

// Voice bench: pick or clone a voice, then have it read a line. Uses ElevenLabs characters from our plan.

interface Voice { id: string; name: string; category: string; preview?: string }
interface Usage { used: number; limit: number; tier: string }
interface Model { id: string; label: string }

const input = "rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm";
const btn = "rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50";

export default function VoiceLab({ code }: { code: string }) {
  const [voices, setVoices] = useState<Voice[]>([]);
  const { price } = useCredits();
  const [models, setModels] = useState<Model[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loadErr, setLoadErr] = useState("");

  const [voiceId, setVoiceId] = useState("");
  const [model, setModel] = useState("eleven_multilingual_v2");
  const [lang, setLang] = useState<"es" | "en">("en");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [audio, setAudio] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!code) return;
    setLoadErr("");
    const res = await fetch("/api/voices", { headers: { "x-creads-code": code } });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setLoadErr(d.error || "No se pudieron cargar las voces.");
    setVoices(d.voices ?? []);
    setModels(d.models ?? []);
    setUsage(d.usage ?? null);
    setVoiceId((v) => v || d.voices?.[0]?.id || "");
  }, [code]);
  useEffect(() => { load(); }, [load]);

  async function speak() {
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/voices/speak", { method: "POST", headers: { "content-type": "application/json", "x-creads-code": code }, body: JSON.stringify({ voiceId, text, model, lang }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo generar la voz.");
      setAudio(d.url);
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo generar la voz."); }
    finally { setBusy(false); }
  }

  const own = voices.filter((v) => v.category === "cloned");
  const lib = voices.filter((v) => v.category !== "cloned");
  const selected = voices.find((v) => v.id === voiceId);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">Voces</h2>
          <p className="text-sm text-muted">Crea una voz con tus audios o elige una de la biblioteca, y escucha cómo lee tu texto. Cada lectura usa créditos según su largo.</p>
        </div>
        {usage && usage.limit > 0 && (
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">
            {usage.used.toLocaleString("es-CL")} de {usage.limit.toLocaleString("es-CL")} caracteres usados · {usage.tier}
          </span>
        )}
      </div>

            {loadErr && <p className="text-sm text-bad">{loadErr}</p>}

      <VoiceFromAudios code={code} onCreated={async (id: string) => { await load(); setVoiceId(id); }} />

      <div className="grid gap-4">
        <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
          <h3 className="font-semibold">Probar una voz: escríbele una frase</h3>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Voz" value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className={`${input} min-w-0 flex-1`}>
              {own.length > 0 && <optgroup label="Tus voces">{own.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</optgroup>}
              {lib.length > 0 && <optgroup label="Biblioteca">{lib.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</optgroup>}
            </select>
            <select aria-label="Idioma" value={lang} onChange={(e) => setLang(e.target.value as "es" | "en")} className={input}>
              <option value="en">Inglés</option><option value="es">Español</option>
            </select>
          </div>
          <select aria-label="Modelo de voz" value={model} onChange={(e) => setModel(e.target.value)} className={input}>
            {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          {selected?.preview && (
            <audio src={selected.preview} controls className="w-full" aria-label={`Muestra de ${selected.name}`} />
          )}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label="Texto a leer"
            placeholder='If you have Medicare Parts A and B, listen up.' className={`${input} leading-relaxed`} />
          <button type="button" onClick={speak} disabled={!code || !voiceId || text.trim().length < 2 || busy} className={btn}>
            {busy ? "Generando…" : `Generar voz · ${price(text.trim().length * 0.00022)}`}
          </button>
          {err && <p className="text-sm text-bad">{err}</p>}
          {audio && (
            <audio src={audio} controls autoPlay className="w-full" aria-label="Voz generada" />
          )}
        </div>

      </div>
    </section>
  );
}
