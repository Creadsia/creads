"use client";

import { useEffect, useState } from "react";
import { type FormatId, formatById, takesOwnVoice } from "@/lib/formats";
import { refreshCredits } from "../_parts/use-credits";
import { type Row, btnCls, cardCls, ghostCls, inputCls, useTable } from "../_parts/ui";
import type { Cut } from "./crear";

// Step 3 of «Crear anuncio»: the voice comes before the video. The customer picks who talks and with
// which voice, records every cut (ElevenLabs), Creads listens to each take and checks it says exactly the
// text, and only then the video is paid for — lip-synced to these same approved takes.

interface Avatar extends Row { name: string; image_url: string | null; voice_id?: string | null; voice_name?: string | null }
interface Voice { id: string; name: string; category: string; preview?: string }
interface Accent { locale: string; label: string; voices: { ref: string; name: string; gender: string; age: string; preview?: string }[] }
export interface Take { key: string; url: string; ok?: boolean; heard?: string; checking?: boolean }
export interface VoiceChoice { avatarId: string; voice: string; natural: boolean; takes: Take[] }

const GENDER: Record<string, string> = { male: "hombre", female: "mujer" };
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

export const takeKey = (voice: string, text: string) => `${voice}|${text}`;
/** The approved recording of a cut (only if it was made with this voice and this exact text). */
export const takeOf = (v: VoiceChoice, cuts: Cut[], i: number) => (v.takes[i]?.key === takeKey(v.voice, cuts[i]?.texto ?? "") ? v.takes[i] : null);
export const voiceReady = (v: VoiceChoice, cuts: Cut[], format: FormatId) => !takesOwnVoice(format) || !v.voice || cuts.every((_, i) => takeOf(v, cuts, i)?.url);
/** Too long to fit one lip-synced clip (10 s; Veo makes 8 s). */
/** Longest cut that fits one lip-synced take, even on Veo (8 s). */
const MAX_WORDS = 14;

/** Splits every cut that is too long for one take, at the sentence end (or comma) closest to its middle. */
export function splitLong(cuts: Cut[]): Cut[] {
  const out: Cut[] = [];
  const split = (c: Cut) => {
    const w = c.texto.trim().split(/\s+/).filter(Boolean);
    if (w.length <= MAX_WORDS) { out.push(c); return; }
    const mid = w.length / 2;
    const at = (re: RegExp) => w.map((x, i) => (i < w.length - 1 && i >= 2 && re.test(x) ? i : -1)).filter((i) => i >= 0).sort((a, b) => Math.abs(a + 1 - mid) - Math.abs(b + 1 - mid))[0];
    const cut = at(/[.?!…]$/) ?? at(/[,;:]$/) ?? Math.floor(mid) - 1;
    split({ ...c, texto: w.slice(0, cut + 1).join(" "), traduccion: "" });
    split({ ...c, texto: w.slice(cut + 1).join(" "), traduccion: "" });
  };
  cuts.forEach(split);
  return out;
}

export const tooLongCut = (cuts: Cut[], veo = false) => cuts.findIndex((c) => words(c.texto) / 2.2 + 1.5 > (veo ? 8 : 10));

export default function Voz({ format, lang, cuts, value, onChange, onBack, onNext, onCuts }: {
  format: FormatId; lang: "en" | "es-CL"; cuts: Cut[]; value: VoiceChoice; onChange: (v: VoiceChoice) => void; onBack: () => void; onNext: () => void;
  onCuts: (c: Cut[]) => void;
}) {
  const f = formatById(format);
  const avatars = useTable<Avatar>("avatars");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [accents, setAccents] = useState<Accent[]>([]);
  const [busy, setBusy] = useState<number | "all" | null>(null);
  const [err, setErr] = useState("");
  const [splitNote, setSplitNote] = useState("");
  // a cut too long for one voiced take is split in two automatically (nobody has to count words)
  useEffect(() => {
    if (!takesOwnVoice(format) || !cuts.length) return;
    const next = splitLong(cuts);
    if (next.length !== cuts.length) {
      onCuts(next.slice(0, 12));
      setSplitNote(`Dividimos los cortes largos para que la voz calce perfecto: ahora son ${Math.min(12, next.length)} cortes, con las mismas palabras.`);
    }
  }, [cuts, format]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/voices").then((r) => r.json()).then((d) => setVoices(d.voices ?? [])).catch(() => {});
    fetch("/api/voices/acentos").then((r) => r.json()).then((d) => setAccents(d.accents ?? [])).catch(() => {});
  }, []);

  if (!cuts.length) {
    return (
      <section className={cardCls}>
        <h2 className="font-display text-xl font-bold">3 · Voz</h2>
        <p className="text-sm">La voz se graba sobre tu guion, corte por corte. Primero pega o abre tu guion en el paso 1 y sepáralo en cortes; después vuelves aquí a grabarla y escucharla.</p>
        <div><button type="button" onClick={onBack} className={btnCls}>Ir a mi guion →</button></div>
      </section>
    );
  }

  if (!takesOwnVoice(format)) {
    return (
      <section className={cardCls}>
        <h2 className="font-display text-xl font-bold">3 · Voz</h2>
        <p className="text-sm text-muted">{f.narr ? "Este formato usa una voz en off que eliges al armar el video." : "En este formato hablan dos o más personas: las voces las crea el modelo de video en cada corte."}</p>
        <div className="flex gap-3"><button type="button" onClick={onBack} className={ghostCls}>← Volver a los cortes</button><button type="button" onClick={onNext} className={btnCls}>Siguiente: escenas →</button></div>
      </section>
    );
  }

  const set = (p: Partial<VoiceChoice>) => onChange({ ...value, ...p });
  const lib = accents.flatMap((a) => a.voices.map((v) => ({ ...v, accent: a.label })));
  const libVoice = lib.find((v) => v.ref === value.voice);
  const preview = libVoice?.preview ?? voices.find((v) => v.id === value.voice)?.preview;
  const long = tooLongCut(cuts);
  const ready = voiceReady(value, cuts, format);
  const recorded = cuts.filter((_, i) => takeOf(value, cuts, i)?.url).length;

  function pickAvatar(a: Avatar | null) {
    const own = a?.voice_id && voices.some((v) => v.id === a.voice_id) ? a.voice_id : "";
    set({ avatarId: a?.id ?? "", ...(own ? { voice: own } : {}) });
  }

  async function check(i: number, url: string, text: string, current: Take[]) {
    const res = await fetch("/api/voices/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, text, lang: lang === "en" ? "en" : "es" }) }).catch(() => null);
    const d = res?.ok ? await res.json().catch(() => null) : null;
    current[i] = { ...current[i], checking: false, ok: d ? Boolean(d.ok) : undefined, heard: d?.heard };
  }

  async function record(only?: number) {
    if (!value.voice) return;
    setErr(""); setBusy(only ?? "all");
    const takes = [...value.takes];
    try {
      for (let i = 0; i < cuts.length; i++) {
        if (only !== undefined ? i !== only : takeOf(value, cuts, i)?.url) continue;
        const text = cuts[i].texto;
        const res = await fetch("/api/voices/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ voiceId: value.voice, text, model: "eleven_multilingual_v2" }) }).catch(() => null);
        const d = res ? await res.json().catch(() => ({})) : {};
        if (!res?.ok || !d.url) throw new Error(d.error || "No se pudo grabar la voz.");
        takes[i] = { key: takeKey(value.voice, text), url: d.url, checking: true };
        onChange({ ...value, takes: [...takes] });
        await check(i, d.url, text, takes);
        onChange({ ...value, takes: [...takes] });
      }
      refreshCredits();
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo grabar la voz."); }
    finally { setBusy(null); }
  }

  return (
    <section className={cardCls} data-tour="crear-voz">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-xl font-bold">3 · Voz</h2>
        <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold text-muted">Primero la voz, después el video</span>
      </div>
      <p className="text-sm text-muted">Elige quién habla y con qué voz, y grábala. Creads escucha cada corte y revisa que diga exactamente tu texto. Recién cuando te guste, se hace el video y se le sincroniza la boca a esta misma voz. Grabar cuesta centavos.</p>

      {splitNote && <p className="rounded-lg bg-good/10 p-3 text-sm text-good">✓ {splitNote}</p>}
      {f.av !== "none" && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-muted">{f.avLabel ?? "¿Quién habla?"}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => pickAvatar(null)} aria-pressed={!value.avatarId} className={`rounded-xl border px-3 py-2 text-sm ${!value.avatarId ? "border-accent bg-accent/10" : "border-line"}`}>Lo elijo en Escenas</button>
            {avatars.rows?.map((a) => (
              <button key={a.id} type="button" onClick={() => pickAvatar(a)} aria-pressed={a.id === value.avatarId}
                className={`flex items-center gap-2 rounded-xl border p-1.5 pr-3 text-sm ${a.id === value.avatarId ? "border-accent bg-accent/10" : "border-line"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.image_url ? <img src={a.image_url} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2">👤</span>}
                <span className="flex flex-col items-start leading-tight"><b>{a.name}</b>{a.voice_name && <span className="text-[11px] text-muted">voz: {a.voice_name}</span>}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="flex flex-col gap-1 text-sm font-semibold">
        🗣 Voz
        <select value={value.voice} onChange={(e) => set({ voice: e.target.value })} className={`${inputCls} font-normal`}>
          <option value="">Voz automática (la crea el modelo de video, puede equivocarse en español)</option>
          {voices.some((v) => v.category === "cloned") && <optgroup label="Tus voces">{voices.filter((v) => v.category === "cloned").map((v) => <option key={v.id} value={v.id}>★ {v.name}</option>)}</optgroup>}
          {accents.filter((a) => a.voices.length).map((a) => (
            <optgroup key={a.locale} label={`Acento ${a.label.toLowerCase()} (voces reales)`}>
              {a.voices.map((v) => <option key={v.ref} value={v.ref}>{v.name}{GENDER[v.gender] ? ` · ${GENDER[v.gender]}` : ""}{v.age ? ` · ${v.age.replace("_", " ")}` : ""}</option>)}
            </optgroup>
          ))}
          <optgroup label="Otras voces">{voices.filter((v) => v.category !== "cloned").map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</optgroup>
        </select>
      </label>
      {preview && <audio key={preview} src={preview} controls preload="none" className="h-9 w-full max-w-sm" aria-label="Escuchar la voz" />}

      {value.voice && (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={value.natural} onChange={(e) => set({ natural: e.target.checked })} className="mt-1" />
            <span><b>👄 Boca 100% natural</b> <span className="text-muted">— la sincronización de labios más realista (se nota en primeros planos). Cuesta un poco más en el video.</span></span>
          </label>
          {long >= 0 ? (
            <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">Ajustando los cortes para la voz…</p>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
              {cuts.map((c, i) => {
                const t = takeOf(value, cuts, i);
                return (
                  <div key={i} className="flex flex-col gap-1 border-b border-line/60 pb-2 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="w-16 shrink-0 font-mono text-xs text-muted">Corte {i + 1}</span>
                      <span className="min-w-0 flex-1">“{c.texto}”</span>
                      {t?.url ? <audio src={t.url} controls preload="none" className="h-8 w-56" aria-label={`Voz del corte ${i + 1}`} /> : <span className="text-xs text-muted">sin grabar</span>}
                      {t?.url && <button type="button" disabled={busy !== null} onClick={() => record(i)} className="text-xs font-semibold text-accent-text underline">{busy === i ? "Grabando…" : "Regrabar"}</button>}
                    </div>
                    {t?.checking && <span className="pl-16 text-xs text-muted">Revisando que diga exactamente el texto…</span>}
                    {t && !t.checking && t.ok === true && <span className="pl-16 text-xs text-good">✓ Dice exactamente el texto</span>}
                    {t && !t.checking && t.ok === false && <span className="pl-16 text-xs text-warn">⚠ Se escuchó: “{t.heard}”. Regrábalo, o escribe la palabra como se pronuncia en el paso 2.</span>}
                  </div>
                );
              })}
              {!ready && <button type="button" disabled={busy !== null} onClick={() => record()} className={btnCls}>{busy === "all" ? `Grabando… (${recorded}/${cuts.length})` : `🎙 Grabar la voz (${cuts.length} cortes)`}</button>}
            </div>
          )}
        </>
      )}
      {err && <p className="text-sm text-bad">{err}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className={ghostCls}>← Volver a los cortes</button>
        <button type="button" onClick={onNext} disabled={!ready || busy !== null || (Boolean(value.voice) && long >= 0)} className={btnCls}>{value.voice ? "Me gusta la voz: siguiente, escenas →" : "Siguiente: escenas →"}</button>
        {value.voice && !ready && <span className="text-sm text-muted">Graba y escucha la voz para seguir.</span>}
      </div>
    </section>
  );
}
