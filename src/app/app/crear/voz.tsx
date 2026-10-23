"use client";

import { useEffect, useState } from "react";
import { type FormatId, formatById, takesOwnVoice } from "@/lib/formats";
import { refreshCredits } from "../_parts/use-credits";
import { type Row, btnCls, cardCls, ghostCls, inputCls, useTable } from "../_parts/ui";
import type { Cut } from "./crear";

// Step 3 of «Crear anuncio»: the voice comes before the video. The customer picks who talks and with
// which voice, records every cut (ElevenLabs), Creads listens to each take and checks it says exactly the
// text, and only then the video is paid for — lip-synced to these same approved takes.

interface Avatar extends Row { name: string; image_url: string | null; description?: string | null; voice_id?: string | null; voice_name?: string | null }
interface Voice { id: string; name: string; category: string; preview?: string }
interface AccentVoice { ref: string; name: string; gender: string; age: string; preview?: string; mine?: boolean; tono?: string }
interface Accent { locale: string; label: string; voices: AccentVoice[] }
const TONO: Record<string, string> = { casual: "casual", confident: "segura", upbeat: "alegre", warm: "cálida", friendly: "amable", pleasant: "agradable", energetic: "con energía", natural: "natural", professional: "profesional", crisp: "clara", calm: "tranquila", deep: "grave", soft: "suave", formal: "formal", serious: "seria" };
export interface Take { key: string; url: string; ok?: boolean; heard?: string; checking?: boolean; dur?: number }
export interface VoiceChoice { avatarId: string; voice: string; natural: boolean; takes: Take[]; say?: string; accent?: string; gender?: "male" | "female"; age?: string; manual?: boolean }

/** A presenter's gender from their description, so the voice matches the face. */
const genderOf = (t: string): "male" | "female" | undefined =>
  /\b(woman|female|girl|lady|mujer|señora|chica)\b/i.test(t) ? "female" : /\b(man|male|guy|boy|hombre|señor|chico)\b/i.test(t) ? "male" : undefined;

/** «Creads = Cri ads» lines: what the voice reads instead of each hard word (captions keep the real spelling). */
export function sayable(text: string, say = "") {
  let out = text;
  for (const line of say.split(/\n|;/)) {
    const [w, p] = line.split("=").map((x) => x?.trim());
    if (w && p) out = out.replace(new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "giu"), p);
  }
  return out;
}

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

export const takeKey = (voice: string, text: string, say = "") => `${voice}|${say}|${text}`;
/** The approved recording of a cut (only if it was made with this voice and this exact text). */
export const takeOf = (v: VoiceChoice, cuts: Cut[], i: number) => (v.takes[i]?.key === takeKey(v.voice, cuts[i]?.texto ?? "", v.say) ? v.takes[i] : null);
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
    split({ ...c, texto: w.slice(0, cut + 1).join(" "), traduccion: "", segundos: undefined });
    split({ ...c, texto: w.slice(cut + 1).join(" "), traduccion: "", segundos: undefined });
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
    fetch("/api/voices/acentos").then((r) => r.json()).then((d) => { setAccents(d.accents ?? []); setCurar(Boolean(d.curar)); }).catch(() => {});
  }, []);
  // owner only: hide a library voice that sounds bad, for every account
  const [curar, setCurar] = useState(false);
  async function hide(ref: string) {
    const r = await fetch("/api/voices/acentos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref, ocultar: true }) }).catch(() => null);
    if (!r?.ok) return setErr("No se pudo ocultar la voz.");
    setAccents((list) => list.map((a) => ({ ...a, voices: a.voices.filter((v) => v.ref !== ref) })));
    if (value.voice === ref) set({ voice: "", manual: false });
  }

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
  const avatar = avatars.rows?.find((a) => a.id === value.avatarId);
  const gender = value.gender ?? genderOf(`${avatar?.description ?? ""} ${avatar?.name ?? ""}`) ?? "male";
  const accent = value.accent ?? "es-CL";
  const mineList: AccentVoice[] = voices.filter((v) => v.category === "cloned").map((v) => ({ ref: v.id, name: v.name, gender: "", age: "", preview: v.preview, mine: true }));
  // the presenter's age from their description, to offer (and pick) a voice that fits: young, adult or older
  const look = `${avatar?.description ?? ""} ${avatar?.name ?? ""}`.toLowerCase();
  const ageGuess = /\b(old|older|elderly|senior|grandm|grandf|mayor|abuel|anciano|6\d|7\d)\b/.test(look) ? "old" : /\b(young|teen|20s|twenties|joven|chica|chico|universitari)\b/.test(look) ? "young" : /\b(30s|40s|50s|middle|adult|adulto|adulta)\b/.test(look) ? "middle_aged" : "";
  const ageSel = value.age ?? "";
  const byGender = accent === "mine" ? mineList : (accents.find((a) => a.locale === accent)?.voices ?? []).filter((v) => !v.gender || v.gender === gender);
  const shown: AccentVoice[] = ageSel && accent !== "mine" ? byGender.filter((v) => v.age === ageSel) : byGender;
  // until the customer picks, the voice follows the presenter: their own voice, else one of their age, and a
  // different one for each presenter (not always the first of the list)
  const fit = byGender.filter((v) => !ageGuess || v.age === ageGuess);
  const pool = fit.length ? fit : byGender;
  let h = 0;
  for (const ch of String(avatar?.id ?? avatar?.name ?? "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const autoPick = !value.manual ? (avatar?.voice_id && voices.some((v) => v.id === avatar.voice_id) ? avatar.voice_id : pool[h % Math.max(1, pool.length)]?.ref ?? "") : value.voice;
  if (!value.manual && autoPick && autoPick !== value.voice) queueMicrotask(() => set({ voice: autoPick }));
  const long = tooLongCut(cuts);
  const ready = voiceReady(value, cuts, format);
  const recorded = cuts.filter((_, i) => takeOf(value, cuts, i)?.url).length;

  function pickAvatar(a: Avatar | null) {
    const own = a?.voice_id && voices.some((v) => v.id === a.voice_id) ? a.voice_id : "";
    const g = genderOf(`${a?.description ?? ""} ${a?.name ?? ""}`);
    set({ avatarId: a?.id ?? "", ...(own ? { voice: own, accent: "mine" } : {}), ...(g ? { gender: g } : {}) });
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
        const spoken = sayable(text, value.say);
        const res = await fetch("/api/voices/speak", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ voiceId: value.voice, text: spoken, model: "eleven_multilingual_v2" }) }).catch(() => null);
        const d = res ? await res.json().catch(() => ({})) : {};
        if (!res?.ok || !d.url) throw new Error(d.error || "No se pudo grabar la voz.");
        // how long the take lasts: the video of this cut is made just that long (no filler the AI makes up)
        const dur = await new Promise<number | undefined>((ok) => {
          const a = new Audio(d.url);
          a.preload = "metadata";
          a.onloadedmetadata = () => ok(Number.isFinite(a.duration) ? a.duration : undefined);
          a.onerror = () => ok(undefined);
          setTimeout(() => ok(undefined), 8000);
        });
        takes[i] = { key: takeKey(value.voice, text, value.say), url: d.url, checking: true, dur };
        onChange({ ...value, takes: [...takes] });
        await check(i, d.url, spoken, takes);
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

      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">🗣 Acento</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Acento">
          {[...accents.map((a) => ({ id: a.locale, label: a.label })), ...(mineList.length ? [{ id: "mine", label: "★ Tus voces" }] : [])].map((a) => (
            <button key={a.id} type="button" role="radio" aria-checked={accent === a.id} onClick={() => set({ accent: a.id, manual: false })}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${accent === a.id ? "border-transparent bg-[image:var(--grad)] text-white" : "border-line text-muted hover:text-ink"}`}>{a.label}</button>
          ))}
        </div>
        {accent !== "mine" && (
          <div className="flex gap-1.5" role="radiogroup" aria-label="Voz de hombre o mujer">
            {([["male", "Hombre"], ["female", "Mujer"]] as const).map(([g, l]) => (
              <button key={g} type="button" role="radio" aria-checked={gender === g} onClick={() => set({ gender: g, manual: false })}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${gender === g ? "border-ink bg-ink text-bg" : "border-line text-muted"}`}>{l}</button>
            ))}
            {avatar && genderOf(`${avatar.description ?? ""} ${avatar.name}`) && genderOf(`${avatar.description ?? ""} ${avatar.name}`) !== gender && <span className="text-xs text-warn">Ojo: {avatar.name} es {gender === "male" ? "mujer" : "hombre"}.</span>}
          </div>
        )}
        {accent !== "mine" && (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Edad de la voz">
            {([["", "Todas las edades"], ["young", "Joven"], ["middle_aged", "Adulta"], ["old", "Mayor"]] as const).map(([a, l]) => (
              <button key={a || "all"} type="button" role="radio" aria-checked={ageSel === a} onClick={() => set({ age: a || undefined })}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${ageSel === a ? "border-ink bg-ink text-bg" : "border-line text-muted"}`}>{l}</button>
            ))}
          </div>
        )}
        {accents.length === 0 ? <p className="text-sm text-muted">Cargando voces…</p> : shown.length === 0 ? <p className="text-sm text-muted">No hay voces de este tipo todavía: prueba otro acento.</p> : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {shown.map((v) => (
              <li key={v.ref} className={`flex flex-col gap-1.5 rounded-xl border p-2.5 ${value.voice === v.ref ? "border-accent bg-accent/10" : "border-line"}`}>
                <button type="button" onClick={() => set({ voice: v.ref, manual: true })} aria-pressed={value.voice === v.ref} className="flex items-center justify-between gap-2 text-left text-sm">
                  <span><b>{v.mine ? "★ " : ""}{v.name}</b>{v.age ? <span className="text-xs text-muted"> · {v.age.replace("_", " ")}</span> : null}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${value.voice === v.ref ? "bg-accent text-accent-ink" : "bg-surface-2 text-muted"}`}>{value.voice === v.ref ? "Elegida" : "Elegir"}</span>
                </button>
                {v.tono && <span className="text-[11px] text-muted">{TONO[v.tono] ?? v.tono.replace("_", " ")}</span>}
                {v.preview && <audio src={v.preview} controls preload="none" className="h-8 w-full" aria-label={`Escuchar ${v.name}`} />}
                {curar && !v.mine && <button type="button" onClick={() => hide(v.ref)} className="self-start text-[11px] text-muted hover:text-bad">Ocultar para todos (suena mal)</button>}
              </li>
            ))}
          </ul>
        )}
        <button type="button" onClick={() => set({ voice: "", manual: true })} className={`self-start text-xs underline ${value.voice ? "text-muted" : "font-semibold text-warn"}`}>
          {value.voice ? "Prefiero la voz automática del modelo de video" : "Estás usando la voz automática (puede equivocarse en español): elige una voz de arriba"}
        </button>
      </div>
      {value.voice && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Cómo se pronuncian tus marcas o palabras difíciles (opcional)
          <textarea rows={2} value={value.say ?? ""} onChange={(e) => set({ say: e.target.value })} placeholder={"Una por línea. Ej:\nCreads = Cri ads\ncreadsia.com = creads ia punto com"} className={`${inputCls} text-sm font-normal`} />
          <span className="text-xs font-normal text-muted">La voz lo dice así; los subtítulos siguen escritos como en tu guion. Si cambias esto, vuelve a grabar.</span>
        </label>
      )}

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
