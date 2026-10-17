"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LANGS, LENGTHS, MUSIC_MODES, SOUND_PRESETS, STORY_TEMPLATES, STYLES, type SoundSetup, type StoryLang, type StoryPlan, type StorySettings, type StyleId, billedSeconds, estimateStory, musicModeOf, needsNewTrack, presetOf, savedTrack, shotsFor, storyScript, storyShotUsd } from "@/lib/historias";
import { NICHES } from "@/lib/niches";
import { Field, PageHead, btnCls, cardCls, ghostCls, inputCls, uploadFile } from "../_parts/ui";
import { refreshCredits, useCredits } from "../_parts/use-credits";

// "Historias animadas": idea → story and shots → characters → shot images → animation → film.

interface VideoModel { id: string; label: string; configured: boolean; usdPerSecond: number; seconds: number[]; durations?: number[] | null; silent?: boolean }
interface Voice { id: string; name: string; category: string }
interface Ad { id: string; title: string; aspect: string; model: string; status: string; final_url: string | null; settings: StorySettings; created_at: string }
interface Avatar { id: string; name: string; image_url: string | null }
interface Clip { id: string; idx: number; status: string; url: string | null; image_url: string | null; error: string | null }

const post = async (url: string, body: unknown, method = "POST") => {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "No se pudo completar.");
  return d;
};
const shotSecs = (s: number) => Math.min(10, Math.max(4, Math.ceil(s + 0.6)));

export default function Historias() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("id");
    if (q) setId(q);
  }, []);
  const open = (x: string | null) => {
    setId(x);
    window.history.replaceState(null, "", x ? `/app/historias?id=${x}` : "/app/historias");
    window.scrollTo({ top: 0 });
  };
  return (
    <>
      <PageHead title="Historias animadas" lead="Cuenta una idea y recibe una mini película animada: los mismos personajes de principio a fin, diálogos con labios sincronizados, narrador, música o canción, como tú quieras. Ideal para Reels y TikTok." />
      {id ? <Story id={id} onBack={() => open(null)} /> : <NewStory onOpen={open} />}
    </>
  );
}

// ---------------------------------------------------------------- new story + list

function NewStory({ onOpen }: { onOpen: (id: string) => void }) {
  const [idea, setIdea] = useState("");
  const [context, setContext] = useState("");
  const [picked, setPicked] = useState("");
  const [style, setStyle] = useState<StyleId>("cine3d");
  const [seconds, setSeconds] = useState(30);
  const [aspect, setAspect] = useState("9:16");
  const [lang, setLang] = useState<StoryLang>("es-CL");
  const [sound, setSound] = useState<SoundSetup>({ dialogue: true, narrator: false, music: "ia", ambient: true });
  const [voiceId, setVoiceId] = useState("");
  const [own, setOwn] = useState<{ url: string; name: string } | null>(null);
  const [upBusy, setUpBusy] = useState(false);
  const [niche, setNiche] = useState("");
  const [model, setModel] = useState("");
  const [models, setModels] = useState<VideoModel[]>([]);
  const [imgUsd, setImgUsd] = useState(0.134);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [list, setList] = useState<Ad[] | null>(null);
  const { price } = useCredits();

  useEffect(() => {
    fetch("/api/models").then((r) => r.json()).then((d) => {
      const v = (d.video ?? []).filter((m: VideoModel) => m.configured);
      setModels(v);
      setModel((x) => x || v.find((m: VideoModel) => m.id === "kling-3.0")?.id || v[0]?.id || "");
      const nb = (d.image ?? []).find((m: { id: string }) => m.id === "nano-banana-pro");
      if (nb?.usd) setImgUsd(nb.usd);
    }).catch(() => {});
    fetch("/api/voices").then((r) => r.json()).then((d) => setVoices(d.voices ?? [])).catch(() => {});
    fetch("/api/data/ads").then((r) => r.json()).then((d) => setList((d.rows ?? []).filter((a: Ad) => a.settings?.kind === "historia"))).catch(() => setList([]));
  }, []);

  // characters that talk need a model that makes voices
  const usable = models.filter((x) => !sound.dialogue || !x.silent);
  useEffect(() => { if (model && usable.length && !usable.some((x) => x.id === model)) setModel(usable[0].id); }, [sound.dialogue, models]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = models.find((x) => x.id === model);
  const n = shotsFor(seconds);
  const est = m ? estimateStory({ characters: 3, shots: n, videoSecondsPerShot: billedSeconds(shotSecs(seconds / n), m.durations ?? undefined, m.id.startsWith("veo")), usdPerSecond: m.usdPerSecond, usdPerImage: imgUsd, seconds }) : null;
  const musicUsd = sound.music === "ia" || sound.music === "cancion" ? est?.music ?? 0 : 0;
  const preset = presetOf(sound);

  function applyTemplate(id: string) {
    const t = STORY_TEMPLATES.find((x) => x.id === id);
    const p = SOUND_PRESETS.find((x) => x.id === t?.preset);
    if (!t) return;
    setPicked(id); setIdea(t.idea); setContext(t.context); setStyle(t.style);
    if (p) setSound({ dialogue: p.dialogue, narrator: p.narrator, music: p.music, ambient: p.ambient });
  }
  async function upload(f?: File) {
    if (!f) return;
    setUpBusy(true); setErr("");
    try { setOwn({ url: await uploadFile(f), name: f.name }); } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo subir la música."); } finally { setUpBusy(false); }
  }
  const missing = idea.trim().length < 15 ? "Cuenta tu historia (al menos una o dos frases)." : sound.narrator && !voiceId ? "Elige la voz del narrador." : sound.music === "propia" && !own ? "Sube tu música o elige otra opción." : "";

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (missing) return setErr(missing);
    setBusy(true); setErr("");
    try {
      const d = await post("/api/historias", {
        idea, context, style, seconds, aspect, lang, niche, model,
        narrator: sound.narrator, dialogue: sound.dialogue, voiceId: sound.narrator ? voiceId : null,
        music: sound.music, ambient: sound.ambient, musicUrl: sound.music === "propia" ? own?.url : undefined,
      });
      onOpen(d.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo escribir la historia.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={create} className="flex flex-col gap-6">
        <section className={cardCls} aria-labelledby="h-idea">
          <div className="flex flex-col gap-1">
            <h2 id="h-idea" className="font-display text-lg font-bold">1. Tu historia</h2>
            <p className="text-sm text-muted">Parte de cero o toca una idea para verla armada y cámbiala a tu gusto.</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Ideas para empezar" data-tour="hist-ideas">
            {STORY_TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => applyTemplate(t.id)} aria-pressed={picked === t.id}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${picked === t.id ? "border-accent-text bg-accent/10 text-ink" : "border-line text-muted hover:text-ink"}`}>
                {t.name}
              </button>
            ))}
          </div>
          <Field label="¿De qué se trata?" hint="Quién es el protagonista, qué le pasa, qué cambia y cómo termina. Mientras más concreto, mejor queda.">
            <textarea value={idea} onChange={(e) => { setIdea(e.target.value); setPicked(""); }} rows={5} className={inputCls}
              placeholder="Un niño de 12 años siente que el colegio no le enseña lo que necesita. Conoce a Pancho, un emprendedor que le enseña a vender… Al final, le agradece frente a todos." />
          </Field>
          <Field label="Cómo hablan los personajes y frases que no pueden faltar (opcional)" hint="Con esto los diálogos suenan como tú quieres.">
            <textarea value={context} onChange={(e) => setContext(e.target.value)} rows={3} className={inputCls}
              placeholder="Pancho habla relajado y seguro, como mentor. Frase final: «Gracias por creer en mí antes que yo»." />
          </Field>
        </section>

        <section className={cardCls} aria-labelledby="h-style">
          <h2 id="h-style" className="font-display text-lg font-bold">2. Estilo</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {STYLES.map((s) => (
              <button key={s.id} type="button" onClick={() => setStyle(s.id)} aria-pressed={style === s.id}
                className={`flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left ${style === s.id ? "border-accent-text bg-accent/10" : "border-line hover:bg-surface-2"}`}>
                <b className="text-sm">{s.name}</b>
                <span className="text-xs text-muted">{s.hint}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={cardCls} aria-labelledby="h-sound" data-tour="hist-sound">
          <div className="flex flex-col gap-1">
            <h2 id="h-sound" className="font-display text-lg font-bold">3. ¿Cómo suena?</h2>
            <p className="text-sm text-muted">Elige una forma rápida o arma la tuya abajo. Todo se puede cambiar después, antes de armar la película.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SOUND_PRESETS.map((p) => (
              <button key={p.id} type="button" aria-pressed={preset === p.id}
                onClick={() => setSound({ dialogue: p.dialogue, narrator: p.narrator, music: p.music, ambient: p.ambient })}
                className={`flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left ${preset === p.id ? "border-accent-text bg-accent/10" : "border-line hover:bg-surface-2"}`}>
                <b className="text-sm">{p.name}</b>
                <span className="text-xs text-muted">{p.hint}</span>
              </button>
            ))}
          </div>
          <SoundControls sound={sound} onChange={setSound} voices={voices} voiceId={voiceId} onVoice={setVoiceId}
            ownName={own?.name ?? ""} upBusy={upBusy} onUpload={upload} />
        </section>

        <section className={cardCls} aria-labelledby="h-more">
          <h2 id="h-more" className="font-display text-lg font-bold">4. Detalles</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Duración">
              <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className={inputCls}>
                {LENGTHS.map((l) => <option key={l} value={l}>{l} segundos (≈ {shotsFor(l)} tomas)</option>)}
              </select>
            </Field>
            <Field label="Formato">
              <select value={aspect} onChange={(e) => setAspect(e.target.value)} className={inputCls}>
                <option value="9:16">Vertical 9:16 (Reels, TikTok)</option>
                <option value="16:9">Horizontal 16:9 (YouTube)</option>
                <option value="1:1">Cuadrado 1:1</option>
              </select>
            </Field>
            <Field label="Cómo hablan">
              <select value={lang} onChange={(e) => setLang(e.target.value as StoryLang)} className={inputCls}>
                {LANGS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <Field label="Modelo de animación" hint={sound.dialogue ? "Solo modelos que hacen voz y labios." : "Puedes cambiarlo antes de animar."}>
              <select value={model} onChange={(e) => setModel(e.target.value)} className={inputCls}>
                {usable.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </select>
            </Field>
            <Field label="Nicho (para ordenar)">
              <select value={niche} onChange={(e) => setNiche(e.target.value)} className={inputCls}>
                <option value="">Sin nicho</option>
                {NICHES.map((x) => <option key={x} value={x}>{x}</option>)}
              </select>
            </Field>
          </div>
          {est && (
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
              Escribir el guion es gratis. La película completa cuesta aprox. <b>{price(est.images + est.video + musicUsd)}</b>: personajes e imágenes {price(est.images)}, animación {price(est.video)}{musicUsd ? `, ${sound.music === "cancion" ? "canción" : "música"} ${price(musicUsd)}` : ""}. Pagas cada paso cuando lo apruebas.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy} data-tour="hist-crear" className={`${btnCls} py-2.5`}>{busy ? "Escribiendo el guion… (≈ 30 s)" : "Escribir el guion"}</button>
            {missing && !busy && <span className="text-sm text-muted">{missing}</span>}
          </div>
          {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        </section>
      </form>

      <section className={cardCls}>
        <h2 className="font-display text-lg font-bold">Tus historias</h2>
        {!list ? <p className="text-sm text-muted">Cargando…</p> : !list.length ? <p className="text-sm text-muted">Todavía no tienes historias. Escribe tu primera idea arriba.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onOpen(a.id)} className="flex w-full flex-col gap-1 rounded-xl border border-line p-3 text-left hover:bg-surface-2">
                  <b className="truncate">{a.title || "Historia"}</b>
                  <span className="line-clamp-2 text-xs text-muted">{a.settings?.plan?.logline}</span>
                  <span className="text-xs text-muted">{a.final_url ? "Película lista" : "En preparación"} · {new Date(a.created_at).toLocaleDateString("es-CL")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Voices, music and ambient sound: the same controls when creating and when finishing a story. */
function SoundControls({ sound, onChange, voices, voiceId, onVoice, ownName, upBusy, onUpload, disabled, dialogueLabel }: {
  sound: SoundSetup; onChange: (s: SoundSetup) => void;
  voices: Voice[]; voiceId: string; onVoice: (id: string) => void;
  ownName: string; upBusy: boolean; onUpload: (f?: File) => void; disabled?: boolean; dialogueLabel?: string;
}) {
  const set = (p: Partial<SoundSetup>) => onChange({ ...sound, ...p });
  const toggle = "flex items-start gap-2.5 rounded-xl border border-line p-3 text-sm";
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-muted">Voces</span>
        <label className={toggle}>
          <input type="checkbox" checked={sound.dialogue} disabled={disabled} onChange={(e) => set({ dialogue: e.target.checked })} className="mt-1" />
          <span><b>{dialogueLabel ?? "Los personajes hablan"}</b><span className="block text-xs text-muted">Dicen lo del guion con los labios sincronizados. Funciona con o sin música.</span></span>
        </label>
        <label className={toggle}>
          <input type="checkbox" checked={sound.narrator} disabled={disabled} onChange={(e) => set({ narrator: e.target.checked })} className="mt-1" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5"><span><b>Narrador</b><span className="block text-xs text-muted">Una voz en off cuenta la historia entre escenas.</span></span>
            {sound.narrator && (
              <select value={voiceId} disabled={disabled} onChange={(e) => onVoice(e.target.value)} className={inputCls} aria-label="Voz del narrador">
                <option value="">Elige la voz del narrador</option>
                {voices.map((v) => <option key={v.id} value={v.id}>{v.category === "cloned" ? "★ " : ""}{v.name}</option>)}
              </select>
            )}
          </span>
        </label>
        <label className={toggle}>
          <input type="checkbox" checked={sound.ambient} disabled={disabled} onChange={(e) => set({ ambient: e.target.checked })} className="mt-1" />
          <span><b>Sonido ambiente</b><span className="block text-xs text-muted">Calle, viento, cocina, pasos: el sonido real de cada escena, suave.</span></span>
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-muted">Música</span>
        <div role="radiogroup" aria-label="Música" className="grid grid-cols-2 gap-2">
          {MUSIC_MODES.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={sound.music === x.id} disabled={disabled} onClick={() => set({ music: x.id })}
              className={`flex flex-col items-start gap-0.5 rounded-xl border p-3 text-left ${sound.music === x.id ? "border-accent-text bg-accent/10" : "border-line hover:bg-surface-2"}`}>
              <b className="text-sm">{x.name}</b>
              <span className="text-xs text-muted">{x.hint}</span>
            </button>
          ))}
        </div>
        {sound.music === "propia" && (
          <label className={`${ghostCls} cursor-pointer self-start`}>
            {upBusy ? "Subiendo…" : ownName ? `✓ ${ownName} · cambiar` : "Subir mi música"}
            <input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/aac,audio/ogg" className="sr-only" disabled={disabled || upBusy} onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        )}
        {sound.music === "propia" && <p className="text-xs text-muted">Usa música que tengas derecho a usar. Se ajusta al largo de la película.</p>}
        {sound.music === "cancion" && <p className="text-xs text-muted">La IA escribe la letra sobre tu historia; la puedes leer y cambiar antes de crear la canción.</p>}
        {sound.music === "ninguna" && !sound.dialogue && !sound.narrator && !sound.ambient && <p className="text-xs text-warn">Así la película queda en silencio total. Suma voces, ambiente o música.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- one story

function Story({ id, onBack }: { id: string; onBack: () => void }) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [plan, setPlan] = useState<StoryPlan | null>(null);
  const [dirty, setDirty] = useState(false);
  const [models, setModels] = useState<VideoModel[]>([]);
  const [imgUsd, setImgUsd] = useState(0.134);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState("");
  const [tech, setTech] = useState(false);
  const [music, setMusic] = useState("");
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [subtitles, setSubtitles] = useState(true);
  const [context, setContext] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<string | null>(null);
  const [upBusy, setUpBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [wantNarrator, setWantNarrator] = useState(false);
  const [dlgMsg, setDlgMsg] = useState("");
  const [dlgAll, setDlgAll] = useState(true);
  const [voices, setVoices] = useState<Voice[]>([]);
  const { price, covers } = useCredits();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadErr, setLoadErr] = useState("");
  // paid batch actions ask first, inline (e.g. "reanim")
  const [ask, setAsk] = useState("");

  const load = useCallback(async () => {
    try {
      const [ar, cr] = await Promise.all([fetch(`/api/data/ads/${id}`), fetch(`/api/data/clips?ad_id=${id}`)]);
      const [a, c] = await Promise.all([ar.json().catch(() => ({})), cr.json().catch(() => ({}))]);
      if (!a.row?.settings?.plan) {
        setLoadErr(ar.status === 404 || ar.ok ? "No encontramos esta historia. Puede que se haya borrado." : a.error || "No se pudo cargar la historia. Recarga la página.");
        return;
      }
      setLoadErr("");
      setAd(a.row);
      setPlan((p) => (dirty && p ? p : a.row.settings.plan));
      setMusic((m) => m || a.row.settings.plan.music || "");
      if (cr.ok) setClips((c.rows ?? []).sort((x: Clip, y: Clip) => x.idx - y.idx));
    } catch {
      setLoadErr("No se pudo cargar la historia. Revisa tu conexión y recarga la página.");
    }
  }, [id, dirty]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/models").then((r) => r.json()).then((d) => {
      setModels((d.video ?? []).filter((m: VideoModel) => m.configured));
      const nb = (d.image ?? []).find((m: { id: string }) => m.id === "nano-banana-pro");
      if (nb?.usd) setImgUsd(nb.usd);
    }).catch(() => {});
    fetch("/api/data/avatars").then((r) => r.json()).then((d) => setAvatars((d.rows ?? []).filter((a: Avatar) => a.image_url))).catch(() => {});
    fetch("/api/voices").then((r) => r.json()).then((d) => setVoices(d.voices ?? [])).catch(() => {});
  }, []);

  // keep animating shots up to date
  const generating = clips.filter((c) => c.status === "generating" || c.status === "starting" || c.status === "syncing");
  useEffect(() => {
    if (!generating.length) return;
    timer.current = setTimeout(async () => {
      await Promise.all(generating.map((c) => fetch(`/api/clips/status?id=${c.id}`).catch(() => null)));
      load();
    }, 8000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [generating.map((c) => c.id).join(","), load]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ad || !plan) {
    if (!loadErr) return <p className="text-muted">Cargando la historia…</p>;
    return (
      <div className={cardCls}>
        <p className="text-sm">{loadErr}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => load()} className={btnCls}>Intentar de nuevo</button>
          <button type="button" onClick={onBack} className={ghostCls}>Volver a mis historias</button>
        </div>
      </div>
    );
  }
  const st = ad.settings;
  const m = models.find((x) => x.id === ad.model);
  // same price the server charges: real model length, plus voice + lip-sync for a character with their own voice
  const shotUsd = (idx: number) => {
    const sh = plan.shots[idx];
    const own = Boolean(sh?.dialogue?.line && plan.characters.find((c) => c.key === sh.dialogue!.speaker)?.voiceId);
    return m ? storyShotUsd(sh, m, own) : 0;
  };
  const sheetsReady = plan.characters.every((c) => c.image_url);
  const allDone = clips.length > 0 && clips.every((c) => c.status === "done" && c.url);
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy((b) => ({ ...b, [key]: true })); setErr("");
    try { await fn(); refreshCredits(); } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo completar."); }
    finally { setBusy((b) => ({ ...b, [key]: false })); load(); }
  };
  const edit = (fn: (p: StoryPlan) => StoryPlan) => { setPlan((p) => (p ? fn(structuredClone(p)) : p)); setDirty(true); };
  const save = () => run("save", async () => { await post("/api/historias", { adId: id, plan }, "PATCH"); setDirty(false); });
  // anything that uses the story saves the customer's edits first (descriptions, lines, lengths)
  const saved = async () => { if (dirty) { await post("/api/historias", { adId: id, plan }, "PATCH"); setDirty(false); } };
  const changeModel = (model: string) => run("model", () => post("/api/historias", { adId: id, model }, "PATCH"));

  const sheet = (key: string, extra?: string) => run(`c:${key}`, async () => { await saved(); return post("/api/historias/personaje", { adId: id, key, extra }); });
  const fromAvatar = (key: string, avatarId: string) => run(`c:${key}`, async () => { await saved(); return post("/api/historias/personaje", { adId: id, key, avatarId }); });
  const ownSheet = (key: string, f: File) => run(`c:${key}`, async () => { await saved(); return post("/api/historias/personaje", { adId: id, key, image: await uploadFile(f) }); });
  const frame = (idx: number, extra?: string) => run(`f:${idx}`, async () => { await saved(); return post("/api/historias/toma", { adId: id, idx, extra }); });
  const animate = (clipId: string, idx: number) => run(`v:${idx}`, () => post("/api/clips/run", { id: clipId }));
  async function many(keys: number[], fn: (i: number) => Promise<unknown>, tag: string) {
    setBusy((b) => ({ ...b, [tag]: true })); setErr("");
    try { await saved(); } catch (e) { setErr(e instanceof Error ? e.message : "No se pudieron guardar los cambios."); setBusy((b) => ({ ...b, [tag]: false })); return; }
    for (let i = 0; i < keys.length; i += 2) {
      const r = await Promise.allSettled(keys.slice(i, i + 2).map(fn));
      const bad = r.find((x) => x.status === "rejected") as PromiseRejectedResult | undefined;
      if (bad) { setErr(bad.reason instanceof Error ? bad.reason.message : "No se pudo completar."); break; }
      await load();
    }
    refreshCredits();
    setBusy((b) => ({ ...b, [tag]: false }));
    load();
  }
  const missingSheets = plan.characters.filter((c) => !c.image_url);
  const missingFrames = clips.filter((c) => !c.image_url);
  const talkingDone = clips.filter((c) => c.status === "done" && Boolean(plan.shots[c.idx]?.dialogue?.line?.trim()));
  const toAnimate = clips.filter((c) => c.image_url && (c.status === "pending" || c.status === "failed"));
  // what building the film charges (same rules as the server): music when there's none yet, it's too
  // short or new music is asked for; narrator lines not recorded yet. The video shots are already paid.
  const filmUsd = (newMusic: boolean, partial: boolean) => {
    const idxs = (partial ? clips.filter((c) => c.status === "done" && c.url) : clips).map((c) => c.idx);
    const total = idxs.reduce((a, i) => a + (Number(plan.shots[i]?.seconds) || 2.5), 0);
    const st0 = ad.settings;
    const m0 = musicModeOf(st0);
    const music = (m0 === "ia" || m0 === "cancion") && needsNewTrack(st0, m0, total, lyrics ?? plan.lyrics ?? "", newMusic) ? (0.15 * Math.max(total, 15)) / 60 : 0;
    const cache = st0.narration_cache ?? {};
    const chars = st0.narrator && st0.voiceId
      ? idxs.map((i) => plan.shots[i]?.narration?.trim() ?? "").filter((t) => t && !cache[`${st0.voiceId}|${t}`]).reduce((a, t) => a + t.length, 0)
      : 0;
    return music + chars * 0.00022;
  };
  const filmCost = (newMusic: boolean, partial = false) => { const u = filmUsd(newMusic, partial); return u > 0 ? ` · ≈ ${price(u)}` : ""; };
  // sound options are saved right away (they don't change the shots already animated)
  const mode = musicModeOf(st);
  // stories made without dialogue (or before the option) open with it off
  const hasLines = plan.shots.some((x) => x.dialogue?.line?.trim());
  const sound: SoundSetup = { dialogue: !st.mute_dialogue && (st.dialogue ?? hasLines), narrator: Boolean(st.narrator) || wantNarrator, music: mode, ambient: Boolean(st.ambient) };
  const setSound = (next: SoundSetup, extra: Record<string, unknown> = {}) => run("sound", async () => {
    // turning the narrator on first asks for its voice (shown right there); nothing is saved until then
    if (next.narrator && !st.voiceId && !extra.voiceId) { setWantNarrator(true); return; }
    if (!next.narrator) setWantNarrator(false);
    await saved();
    await post("/api/historias", { adId: id, voiceId: extra.voiceId, sound: { music: next.music, ambient: next.ambient, narrator: next.narrator, mute: !next.dialogue, ...extra } }, "PATCH");
  });
  const uploadMusic = async (f?: File) => {
    if (!f) return;
    setUpBusy(true); setErr("");
    try { const url = await uploadFile(f); await post("/api/historias", { adId: id, sound: { music: "propia", musicUrl: url } }, "PATCH"); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "No se pudo subir la música."); }
    finally { setUpBusy(false); }
  };
  const copyScript = async () => {
    try { await navigator.clipboard.writeText(storyScript(plan, { narrator: st.narrator, music_mode: mode })); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setErr("No se pudo copiar. Intenta de nuevo."); }
  };
  const montar = (newMusic = false, partial = false) => run("film", async () => {
    const d = await post("/api/historias/montar", { adId: id, newMusic, music, subtitles, partial, ...(lyrics !== null ? { lyrics } : {}) });
    if (d.note) setTimeout(() => setErr(d.note), 0); // e.g. the music couldn't be made this time
  });
  const est = m ? (() => {
    const video = plan.shots.reduce((a, _, i) => a + shotUsd(i), 0);
    const images = (plan.characters.length + plan.shots.length) * imgUsd;
    const music = mode === "ia" || mode === "cancion" ? (0.15 * Math.max(st.seconds, 15)) / 60 : 0;
    return { total: +(video + images + music).toFixed(2) };
  })() : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="text-sm text-muted underline">← Todas las historias</button>
        {est && <span className="text-sm text-muted">Costo total aprox.: <b className="text-ink">{price(est.total)}</b></span>}
      </div>

      {/* 1. story */}
      <section className={cardCls}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold text-muted">1. Guion · {STYLES.find((x) => x.id === st.style)?.name} · {st.seconds} s · {plan.shots.length} tomas</span>
            <input value={plan.title} onChange={(e) => edit((p) => ({ ...p, title: e.target.value }))} className="bg-transparent font-display text-2xl font-bold outline-none" aria-label="Título" />
            <textarea value={plan.logline} onChange={(e) => edit((p) => ({ ...p, logline: e.target.value }))} rows={2} className="resize-none bg-transparent text-muted outline-none" aria-label="Resumen" />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={copyScript} className={ghostCls}>{copied ? "Guion copiado ✓" : "Copiar guion"}</button>
            <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={tech} onChange={(e) => setTech(e.target.checked)} /> Ver instrucciones técnicas</label>
            {dirty && <button type="button" onClick={save} disabled={busy.save} className={btnCls}>{busy.save ? "Guardando…" : "Guardar cambios"}</button>}
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-accent-text/40 bg-accent/5 p-3">
          <b className="text-sm">Diálogos con IA</b>
          <p className="text-xs text-muted">Creads lee tu idea, mira las imágenes de las tomas que ya creaste y escribe qué dice cada personaje en los momentos clave. Dale contexto si quieres: cómo habla Pancho, qué le enseña, frases que no pueden faltar.</p>
          <textarea value={context ?? st.context ?? ""} onChange={(e) => setContext(e.target.value)} rows={2} className={`${inputCls} text-sm`}
            placeholder="Ej: Pancho habla relajado y seguro, como mentor. Le dice que el colegio no le enseña a ganar plata. Al final el niño le agradece frente a todos." />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dlgAll} onChange={(e) => setDlgAll(e.target.checked)} /> Como película: diálogo en todas las tomas donde aparece alguien</label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy.dlg} className={btnCls}
              onClick={() => run("dlg", async () => {
                await saved();
                const d = await post("/api/historias/dialogos", { adId: id, context: context ?? st.context ?? "", all: dlgAll });
                setPlan(d.plan); setDirty(false);
                const animated = new Set(clips.filter((c) => c.status === "done").map((c) => c.idx));
                const redo = (d.changed as number[]).filter((i) => animated.has(i)).length;
                setDlgMsg(`Listo: ${d.plan.shots.filter((x: { dialogue?: unknown }) => x.dialogue).length} tomas con diálogo.${redo ? ` ${redo} de ellas ya estaban animadas: aprieta "Re-animar" en las que tienen 🗣 para que hablen.` : ""}`);
              })}>
              {busy.dlg ? "Escribiendo diálogos… (≈ 30 s)" : plan.shots.some((x) => x.dialogue) ? "Reescribir diálogos con IA (gratis)" : "Escribir diálogos con IA (gratis)"}
            </button>
            {dlgMsg && <span className="text-sm text-good">{dlgMsg}</span>}
          </div>
        </div>
        <ol className="flex flex-col divide-y divide-line">
          {plan.shots.map((sh, i) => (
            <li key={i} className="grid gap-2 py-2.5 sm:grid-cols-[3rem_1fr_6rem]">
              <span className="font-mono text-xs text-muted">#{i + 1}</span>
              <div className="flex min-w-0 flex-col gap-1">
                <input value={sh.es} onChange={(e) => edit((p) => { p.shots[i].es = e.target.value; return p; })} className="bg-transparent text-sm outline-none" aria-label={`Toma ${i + 1}`} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <select value={sh.dialogue?.speaker ?? ""} aria-label={`Quién habla en la toma ${i + 1}`}
                    onChange={(e) => edit((p) => { const k = e.target.value; p.shots[i].dialogue = k ? { speaker: k, line: p.shots[i].dialogue?.line ?? "" } : null; return p; })}
                    className="rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-xs">
                    <option value="">Nadie habla</option>
                    {plan.characters.map((c) => <option key={c.key} value={c.key}>Habla {c.name}</option>)}
                  </select>
                  {sh.dialogue && (
                    <input value={sh.dialogue.line} onChange={(e) => edit((p) => { p.shots[i].dialogue = { speaker: p.shots[i].dialogue!.speaker, line: e.target.value }; return p; })}
                      placeholder="Qué dice (máx. 12 palabras)" className={`${inputCls} min-w-0 flex-1 py-1 text-sm font-semibold`} aria-label={`Diálogo toma ${i + 1}`} />
                  )}
                </div>
                {st.narrator && <input value={sh.narration ?? ""} onChange={(e) => edit((p) => { p.shots[i].narration = e.target.value; return p; })} placeholder="(sin narración)" className="bg-transparent text-sm italic text-accent-text outline-none" aria-label={`Narración toma ${i + 1}`} />}
                {tech && (
                  <>
                    <textarea value={sh.image} onChange={(e) => edit((p) => { p.shots[i].image = e.target.value; return p; })} rows={2} className={`${inputCls} text-xs`} aria-label="Imagen (inglés)" />
                    <textarea value={sh.motion} onChange={(e) => edit((p) => { p.shots[i].motion = e.target.value; return p; })} rows={1} className={`${inputCls} text-xs`} aria-label="Movimiento (inglés)" />
                  </>
                )}
              </div>
              <label className="flex items-center gap-1 text-xs text-muted">
                <input type="number" step="0.5" min="1.5" max="5" value={sh.seconds} onChange={(e) => edit((p) => { p.shots[i].seconds = Number(e.target.value); return p; })} className={`${inputCls} w-16`} /> s
              </label>
            </li>
          ))}
        </ol>
      </section>

      {/* 2. characters */}
      <section className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">2. Personajes</h2>
            <p className="text-sm text-muted">Cada personaje tiene una ficha fija. Todas las tomas se dibujan desde estas fichas, así se ven iguales en toda la película.</p>
          </div>
          {missingSheets.length > 0 && (
            <button type="button" disabled={busy.sheets} onClick={() => many(missingSheets.map((_, i) => i), (i) => post("/api/historias/personaje", { adId: id, key: missingSheets[i].key }), "sheets")} className={btnCls}>
              {busy.sheets ? "Creando…" : `Crear ${missingSheets.length > 1 ? `los ${missingSheets.length} personajes` : "el personaje"} · ${price(imgUsd * missingSheets.length)}`}
            </button>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {plan.characters.map((c, i) => (
            <CharacterCard key={c.key} name={c.name} look={c.look} image={c.image_url ?? null} busy={Boolean(busy[`c:${c.key}`])} priceLabel={price(imgUsd)}
              avatars={avatars} avatarId={c.avatar ?? ""} onAvatar={(a) => fromAvatar(c.key, a)}
              voices={voices} voiceId={c.voiceId ?? ""} onVoice={(v) => run(`c:${c.key}`, async () => {
                const next = structuredClone(plan); next.characters[i].voiceId = v || null;
                await post("/api/historias", { adId: id, plan: next }, "PATCH"); setDirty(false);
              })}
              onLook={(v) => edit((p) => { p.characters[i].look = v; return p; })}
              onMake={(extra) => sheet(c.key, extra)} onUpload={(f) => ownSheet(c.key, f)} />
          ))}
        </div>
      </section>

      {/* 3. shots */}
      <section className={cardCls}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">3. Tomas</h2>
            <p className="text-sm text-muted">Primero la imagen de cada toma; cuando te gusten, se animan. Puedes rehacer cualquiera por separado.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            Animar con
            <select value={ad.model} onChange={(e) => changeModel(e.target.value)} disabled={busy.model || generating.length > 0} className={inputCls}>
              {models.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {missingFrames.length > 0 && (
            <button type="button" disabled={!sheetsReady || busy.frames} onClick={() => many(missingFrames.map((c) => c.idx), (i) => post("/api/historias/toma", { adId: id, idx: i }), "frames")} className={btnCls}>
              {busy.frames ? "Creando imágenes…" : `Crear ${missingFrames.length} imágenes · ${price(imgUsd * missingFrames.length)}`}
            </button>
          )}
          {toAnimate.length > 0 && (
            <button type="button" disabled={busy.anim || !covers(toAnimate.reduce((a, c) => a + shotUsd(c.idx), 0))}
              onClick={() => many(toAnimate.map((c) => c.idx), (i) => post("/api/clips/run", { id: clips.find((c) => c.idx === i)!.id }), "anim")} className={btnCls}>
              {busy.anim ? "Enviando…" : `Animar ${toAnimate.length} tomas · ${price(toAnimate.reduce((a, c) => a + shotUsd(c.idx), 0))}`}
            </button>
          )}
          {talkingDone.length > 0 && (
            <button type="button" disabled={busy.reanim || busy.anim}
              onClick={() => setAsk("reanim")} aria-expanded={ask === "reanim"}
              className={ghostCls}>
              {busy.reanim ? "Enviando…" : `Re-animar las ${talkingDone.length} tomas con diálogo · ${price(talkingDone.reduce((a, c) => a + shotUsd(c.idx), 0))}`}
            </button>
          )}
          {ask === "reanim" && talkingDone.length > 0 && (
            <div className="flex basis-full flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3 text-sm">
              <span>Se vuelven a animar {talkingDone.length} tomas con diálogo (con las mismas imágenes) para que hablen. Usa ≈ {price(talkingDone.reduce((a, c) => a + shotUsd(c.idx), 0))}; si alguna falla, sus créditos vuelven solos.</span>
              <button type="button" className={btnCls} onClick={() => { setAsk(""); many(talkingDone.map((c) => c.idx), (i) => post("/api/clips/run", { id: clips.find((c) => c.idx === i)!.id }), "reanim"); }}>Sí, re-animar</button>
              <button type="button" className={ghostCls} onClick={() => setAsk("")}>Cancelar</button>
            </div>
          )}
          {!sheetsReady && <span className="self-center text-sm text-muted">Primero crea los personajes.</span>}
          {generating.length > 0 && <span className="self-center text-sm text-muted">Animando {generating.length} tomas… (2 a 5 min)</span>}
          {m?.silent && plan.shots.some((x) => x.dialogue?.line) && <span className="self-center text-sm text-warn">{m.label} no genera voz: para las tomas con diálogo cambia a Kling 3.0, Seedance o Veo.</span>}
        </div>
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {clips.map((c) => (
            <ShotCard key={c.id} n={c.idx + 1} aspect={ad.aspect} text={plan.shots[c.idx]?.es ?? ""} line={plan.shots[c.idx]?.dialogue?.line ?? ""} secs={plan.shots[c.idx]?.seconds ?? 0} clip={c}
              busy={Boolean(busy[`f:${c.idx}`] || busy[`v:${c.idx}`])} canFrame={sheetsReady}
              framePrice={price(imgUsd)} videoPrice={price(shotUsd(c.idx))}
              onFrame={(extra) => frame(c.idx, extra)} onAnimate={() => animate(c.id, c.idx)} />
          ))}
        </ol>
      </section>

      {/* 4. sound + film */}
      <section className={cardCls}>
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold">4. Sonido y película</h2>
          <p className="text-sm text-muted">Combina como quieras: personajes que hablan con sus labios, narrador, sonido ambiente y música, una canción con letra o tu propia música. Los cambios se guardan solos.</p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Formas rápidas">
          {SOUND_PRESETS.map((p) => (
            <button key={p.id} type="button" disabled={busy.sound} aria-pressed={presetOf(sound) === p.id} title={p.hint}
              onClick={() => setSound({ dialogue: p.dialogue, narrator: p.narrator, music: p.music, ambient: p.ambient })}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${presetOf(sound) === p.id ? "border-accent-text bg-accent/10 text-ink" : "border-line text-muted hover:text-ink"}`}>
              {p.name}
            </button>
          ))}
        </div>
        <SoundControls sound={sound} disabled={busy.sound} onChange={(x) => setSound(x)} voices={voices} voiceId={st.voiceId ?? ""}
          onVoice={(v) => v && setSound({ ...sound, narrator: true }, { voiceId: v })}
          ownName={st.own_music_url ? "Tu música" : ""} upBusy={upBusy} onUpload={uploadMusic} dialogueLabel="Se escuchan los diálogos" />
        {!sound.dialogue && hasLines && <p className="text-xs text-muted">Los personajes mueven los labios pero no se escucha su voz: sus frases salen como subtítulos si los activas abajo.</p>}
        {sound.dialogue && !hasLines && <p className="text-sm text-warn">Esta historia todavía no tiene diálogos: escríbelos arriba con «Diálogos con IA» y anima esas tomas.</p>}
        {sound.narrator && !plan.shots.some((x) => x.narration?.trim()) && <p className="text-sm text-warn">Escribe lo que dice el narrador en cada toma, arriba en el guion (debajo de cada toma).</p>}
        {sound.ambient && clips.some((c) => c.status === "done" && !plan.shots[c.idx]?.dialogue?.line) && <p className="text-xs text-muted">El sonido ambiente se graba al animar: las tomas que ya estaban animadas sin él siguen en silencio hasta que las re-animes.</p>}
        {(mode === "ia" || mode === "cancion") && (
          <Field label={mode === "cancion" ? "Estilo de la canción" : "Música"} hint="Descríbela en inglés o español: estilo, ánimo, cómo crece.">
            <textarea value={music} onChange={(e) => setMusic(e.target.value)} rows={2} className={inputCls} />
          </Field>
        )}
        {mode === "cancion" && (
          <div className="flex flex-col gap-2">
            <Field label="Letra de la canción" hint="Léela y cámbiala a tu gusto. Si cambias la letra después de crear la canción, al volver a armar se crea una nueva con la letra nueva.">
              <textarea value={lyrics ?? plan.lyrics ?? ""} onChange={(e) => setLyrics(e.target.value)} rows={7} className={`${inputCls} leading-relaxed`}
                onBlur={() => lyrics !== null && run("lyrics", async () => { await post("/api/historias", { adId: id, sound: { lyrics } }, "PATCH"); })}
                placeholder="Aquí va la letra. Si está vacía, toca «Escribir la letra con IA»." />
            </Field>
            <button type="button" disabled={busy.lyr} className={`${ghostCls} self-start`}
              onClick={() => run("lyr", async () => { await saved(); const d = await post("/api/historias/letra", { adId: id }); setLyrics(d.lyrics); if (d.music) setMusic(d.music); })}>
              {busy.lyr ? "Escribiendo la letra…" : plan.lyrics?.trim() ? "Reescribir la letra con IA (gratis)" : "Escribir la letra con IA (gratis)"}
            </button>
          </div>
        )}
        {st.own_music_url && mode === "propia" && <OwnMusic refUrl={st.own_music_url} />}
        {(plan.shots.some((x) => x.dialogue?.line) || st.narrator) && (
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={subtitles} onChange={(e) => setSubtitles(e.target.checked)} /> Subtítulos en pantalla con lo que dicen</label>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!allDone || busy.film} onClick={() => montar(false)} className={btnCls}>
            {busy.film ? "Armando la película… (≈ 1 min)" : `${ad.final_url ? "Volver a armar" : "Armar la película"}${filmCost(false)}`}
          </button>
          {(mode === "ia" || mode === "cancion") && savedTrack(st, mode) && <button type="button" disabled={!allDone || busy.film} onClick={() => montar(true)} className={ghostCls}>{mode === "cancion" ? "Otra versión de la canción" : "Otra música"}{filmCost(true)}</button>}
          {!allDone && clips.filter((c) => c.status === "done" && c.url).length >= 2 && (
            <button type="button" disabled={busy.film} onClick={() => montar(false, true)} className={ghostCls}>Armar solo con las {clips.filter((c) => c.status === "done" && c.url).length} tomas listas{filmCost(false, true)}</button>
          )}
        </div>
        {!allDone && (
          <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
            <b>Faltan {clips.filter((c) => !(c.status === "done" && c.url)).length} tomas para la película completa:</b>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted">
              {clips.filter((c) => !(c.status === "done" && c.url)).map((c) => (
                <li key={c.id}>#{c.idx + 1}: {!c.image_url ? "falta la imagen" : c.status === "failed" ? "error, aprieta Animar de nuevo" : c.status === "generating" || c.status === "starting" || c.status === "syncing" ? "animándose" : "falta animar"}</li>
              ))}
            </ul>
          </div>
        )}
        {ad.final_url && <FinalFilm refUrl={ad.final_url} aspect={ad.aspect} />}
      </section>

      {dirty && (
        <div className="sticky bottom-4 z-10 mr-16 flex flex-wrap items-center justify-between gap-3 rounded-xl sm:mr-40 border border-accent-text/50 bg-surface px-4 py-3 shadow-lg">
          <span className="text-sm">Tienes cambios sin guardar. Se guardan solos cuando crees algo, o guárdalos ahora.</span>
          <button type="button" onClick={save} disabled={busy.save} className={btnCls}>{busy.save ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      )}
      {err && <p role="alert" className="sticky bottom-4 mr-16 rounded-xl border border-bad/40 sm:mr-40 bg-surface px-4 py-3 text-sm text-bad shadow-lg">{err}</p>}
    </div>
  );
}

// media refs ("/api/media/ws/…") are served by our own route, only to their owner
const useMedia = (ref: string | null) => ref;

function CharacterCard({ name, look, image, busy, priceLabel, avatars, avatarId, onAvatar, voices, voiceId, onVoice, onLook, onMake, onUpload }: {
  name: string; look: string; image: string | null; busy: boolean; priceLabel: string;
  avatars: Avatar[]; avatarId: string; onAvatar: (id: string) => void;
  voices: Voice[]; voiceId: string; onVoice: (id: string) => void;
  onLook: (v: string) => void; onMake: (extra?: string) => void; onUpload: (f: File) => void;
}) {
  const src = useMedia(image);
  const [fix, setFix] = useState("");
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line p-3">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2">
        {src ? <img src={src} alt={`Ficha de ${name}`} className="h-full w-full object-contain" /> : <span className="absolute inset-0 flex items-center justify-center text-sm text-muted">{busy ? "Dibujando…" : "Sin ficha todavía"}</span>}
      </div>
      <b>{name}</b>
      <textarea value={look} onChange={(e) => onLook(e.target.value)} rows={3} className={`${inputCls} text-xs`} aria-label={`Cómo es ${name}`} />
      {image && <input value={fix} onChange={(e) => setFix(e.target.value)} placeholder="Corrección (opcional): «más joven», «pelo más corto»…" className={`${inputCls} text-xs`} />}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => { onMake(fix || undefined); setFix(""); }} className={image ? ghostCls : btnCls}>{busy ? "Dibujando…" : image ? `Rehacer · ${priceLabel}` : `Crear · ${priceLabel}`}</button>
        {avatars.length > 0 ? (
          <select value="" disabled={busy} onChange={(e) => e.target.value && onAvatar(e.target.value)} className={`${inputCls} max-w-[13rem]`} aria-label={`Usar un avatar para ${name}`}>
            <option value="">{avatarId ? `Avatar: ${avatars.find((a) => a.id === avatarId)?.name ?? "elegido"} · cambiar` : `Usar un avatar · ${priceLabel}`}</option>
            {avatars.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        ) : (
          <Link href="/app/avatares" className={ghostCls}>Usar un avatar: crea uno con foto</Link>
        )}
        <label className={`${ghostCls} cursor-pointer`}>
          Subir mi imagen
          <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-xs font-semibold">
        Voz cuando habla
        <select value={voiceId} disabled={busy} onChange={(e) => onVoice(e.target.value)} className={`${inputCls} text-sm font-normal`}>
          <option value="">Voz automática (la crea el modelo de video)</option>
          {voices.filter((v) => v.category === "cloned").length > 0 && <optgroup label="Tus voces">{voices.filter((v) => v.category === "cloned").map((v) => <option key={v.id} value={v.id}>★ {v.name}</option>)}</optgroup>}
          <optgroup label="Biblioteca">{voices.filter((v) => v.category !== "cloned").map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</optgroup>
        </select>
        {voiceId && <span className="font-normal text-muted">Sus diálogos se graban con esta voz y se le sincronizan los labios. Si ya animaste tomas donde habla, re-anímalas.</span>}
      </label>
    </article>
  );
}

function ShotCard({ n, aspect, text, line, secs, clip, busy, canFrame, framePrice, videoPrice, onFrame, onAnimate }: {
  n: number; aspect: string; text: string; line: string; secs: number; clip: Clip; busy: boolean; canFrame: boolean; framePrice: string; videoPrice: string;
  onFrame: (extra?: string) => void; onAnimate: () => void;
}) {
  const img = useMedia(clip.image_url);
  const vid = useMedia(clip.status === "done" ? clip.url : null);
  const [fix, setFix] = useState("");
  const [open, setOpen] = useState(false);
  const animating = clip.status === "generating" || clip.status === "starting" || clip.status === "syncing";
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-line p-2">
      <div className={`relative overflow-hidden rounded-lg bg-surface-2 ${aspect === "16:9" ? "aspect-video" : aspect === "1:1" ? "aspect-square" : "aspect-[9/16]"}`}>
        {vid ? <video src={vid} poster={img ?? undefined} controls loop muted playsInline className="h-full w-full object-cover" />
          : img ? <img src={img} alt={`Toma ${n}`} className="h-full w-full object-cover" />
          : <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs text-muted">{busy ? "Dibujando…" : "Sin imagen"}</span>}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">#{n} · {secs}s</span>
        {animating && <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-[11px] text-white">{clip.status === "syncing" || clip.error === null && clip.url ? "Poniendo la voz…" : "Animando…"}</span>}
      </div>
      <p className="line-clamp-2 text-xs text-muted">{text}</p>
      {line && <p className="line-clamp-2 text-xs font-semibold">🗣 «{line}»{clip.status === "done" ? <span className="block font-normal text-muted">Si agregaste o cambiaste el diálogo después de animar, aprieta Re-animar.</span> : null}</p>}
      {clip.status === "failed" && clip.error && <p className="line-clamp-3 text-[11px] text-bad">{clip.error}</p>}
      <div className="flex flex-wrap gap-1.5">
        {!clip.image_url ? (
          <button type="button" disabled={!canFrame || busy} onClick={() => onFrame()} className="rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-accent-ink disabled:opacity-50">Imagen · {framePrice}</button>
        ) : (
          <>
            {!animating && clip.status !== "done" && <button type="button" disabled={busy} onClick={onAnimate} className="rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-accent-ink disabled:opacity-50">Animar · {videoPrice}</button>}
            {clip.status === "done" && <button type="button" disabled={busy} onClick={onAnimate} className="rounded-md border border-line px-2 py-1 text-[11px] font-semibold">Re-animar · {videoPrice}</button>}
            {!animating && <button type="button" onClick={() => setOpen(!open)} className="rounded-md border border-line px-2 py-1 text-[11px] font-semibold">Rehacer imagen</button>}
          </>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-1.5">
          <input value={fix} onChange={(e) => setFix(e.target.value)} placeholder="Qué cambiar (opcional)" className={`${inputCls} text-xs`} />
          <button type="button" disabled={!canFrame || busy} onClick={() => { onFrame(fix || undefined); setFix(""); setOpen(false); }} className="rounded-md bg-accent px-2 py-1 text-[11px] font-semibold text-accent-ink disabled:opacity-50">Rehacer · {framePrice}</button>
        </div>
      )}
    </li>
  );
}

function OwnMusic({ refUrl }: { refUrl: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-2 p-3 text-sm">
      <b>Tu música</b>
      <audio src={refUrl} controls className="w-full" aria-label="Tu música" />
    </div>
  );
}

function FinalFilm({ refUrl, aspect }: { refUrl: string; aspect: string }) {
  const url = useMedia(refUrl);
  if (!url) return <p className="text-sm text-muted">Cargando la película…</p>;
  return (
    <div className="flex flex-col items-start gap-3">
      <video src={url} controls playsInline className={`max-h-[70vh] rounded-xl border border-line ${aspect === "16:9" ? "w-full" : "w-auto"}`} />
      <div className="flex flex-wrap gap-2">
        <a href={url} download className={btnCls}>Descargar</a>
        <Link href="/app/biblioteca" className={ghostCls}>Ver en Anuncios terminados</Link>
      </div>
    </div>
  );
}

