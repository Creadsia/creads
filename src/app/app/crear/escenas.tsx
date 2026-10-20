"use client";

import CreadsAvatars from "../_parts/creads-avatars";
import Link from "next/link";
import { useEffect, useState } from "react";
import { type FormatId, formatById, refusesFrame } from "@/lib/formats";
import AdWork from "../_parts/ad-work";
import { refreshCredits, useCredits } from "../_parts/use-credits";
import { Field, type Row, btnCls, cardCls, ghostCls, inputCls, useTable } from "../_parts/ui";

// Our pick for each kind of customer: the best quality for the credits is the default and goes first.
const MODEL_TAGS: Record<string, { pill: string; rank: number; note?: string }> = {
  "veo-3.1-fast": { pill: "⭐ Recomendado", rank: 0, note: "La mejor relación calidad/precio para anuncios hablados." },
  "grok-video-lite": { pill: "Más económico", rank: 1, note: "Con sonido y a muy bajo costo: ideal para probar ideas y hacer muchas versiones." },
  "veo-3.1": { pill: "Máxima calidad", rank: 2, note: "Para el anuncio final que vas a escalar." },
};
import type { Cut } from "./crear";

// Steps 3 and 4 of "Crear anuncio": direct the scenes, then generate every cut with the chosen model.

interface Avatar extends Row { name: string; description: string | null; image_url: string | null; voice_name: string | null }
interface Product extends Row { name: string; description: string | null; image_url: string | null }
interface Dir { setting?: string; framing?: string; action?: string; broll?: string; emotion?: string; movement?: string }
interface Scene { dir: Dir; prompt: string }
interface Model { id: string; label: string; configured: boolean; usdPerSecond: number; aspects: string[]; needsImage?: boolean; silent?: boolean; noFaces?: boolean }

const DIR_CHIPS = ["Más dinámico: que camine y se mueva", "Que se vea el problema de cerca", "Que se vea su casa por fuera", "Hook con mucha energía", "Tono más emocional y cercano", "Al final que muestre el celular"];
const FRAME_USD = 0.134;
const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
const clipSecs = (t: string) => Math.min(15, Math.max(4, Math.ceil(words(t) / 2.7) + 1));

export default function Escenas({ step, setStep, format, lang, title, cuts, scriptId, niche }: {
  step: number; setStep: (n: number) => void; format: FormatId; lang: "en" | "es-CL"; title: string; cuts: Cut[]; scriptId: string | null; niche: string;
}) {
  const f = formatById(format);
  const avatars = useTable<Avatar>("avatars");
  const products = useTable<Product>("products");
  const [avatarId, setAvatarId] = useState("");
  const [avatarText, setAvatarText] = useState("");
  const [productId, setProductId] = useState("");
  const [place, setPlace] = useState("");
  const [direction, setDirection] = useState("");
  const [aspect, setAspect] = useState<"9:16" | "16:9" | "1:1" | "4:5">("9:16");
  const [scenes, setScenes] = useState<Scene[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [rulesUsed, setRulesUsed] = useState(0);
  const [copied, setCopied] = useState<number | "all" | null>(null);

  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState("veo-3.1-fast");
  const [confirm, setConfirm] = useState(false);
  const [adId, setAdId] = useState<string | null>(null);
  const [starting, setStarting] = useState<string>("");
  const { price, covers, info } = useCredits();

  useEffect(() => {
    fetch("/api/models").then((r) => r.json()).then((d) => d.video && setModels(d.video)).catch(() => {});
  }, []);
  useEffect(() => { if (!avatarId && avatars.rows?.length && f.av !== "none") setAvatarId(avatars.rows[0].id); }, [avatars.rows, avatarId, f.av]);

  const avatar = avatars.rows?.find((a) => a.id === avatarId);
  const product = products.rows?.find((p) => p.id === productId);
  const m = models.find((x) => x.id === model);
  const takesRefs = model === "veo-3.1";
  const needsFrame = !takesRefs && Boolean(avatar?.image_url || product?.image_url);
  const videoSecs = cuts.reduce((a, c) => a + (model.startsWith("veo") ? (takesRefs && (avatar?.image_url || product?.image_url) ? 8 : clipSecs(c.texto) <= 4 ? 4 : clipSecs(c.texto) <= 6 ? 6 : 8) : clipSecs(c.texto)), 0);
  // Seedance refuses a real person's face as the starting image
  const faceRefused = (x: Model) => refusesFrame(x, format, { face: Boolean(f.av !== "none" && avatar?.image_url), product: Boolean(product?.image_url) });
  useEffect(() => { if (m && faceRefused(m)) setModel("veo-3.1-fast"); }); // eslint-disable-line react-hooks/exhaustive-deps
  const usd = m ? videoSecs * m.usdPerSecond + (needsFrame ? cuts.length * FRAME_USD : 0) : 0;

  async function direct(e?: React.FormEvent) {
    e?.preventDefault();
    const empty = cuts.findIndex((c) => !c.texto?.trim());
    if (empty >= 0) { setErr(`El corte ${empty + 1} está vacío. Escríbele su texto o bórralo en el paso anterior.`); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/scenes", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ format, lang, aspect, cuts, script: cuts.map((c) => c.texto).join(" "), avatarId: f.av === "none" ? null : avatarId || null, avatarText, productId: productId || null, place, direction }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudieron dirigir las escenas.");
      setScenes(d.scenes); setRulesUsed(d.rulesUsed ?? 0);
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : "No se pudieron dirigir las escenas."); }
    finally { setBusy(false); }
  }

  async function copy(text: string, which: number | "all") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch { setErr("No se pudo copiar. Selecciona el texto y cópialo a mano."); }
  }
  const allPrompts = () => (scenes ?? []).map((s) => s.prompt).join("\n\n────────────\n\n");
  const editPrompt = (i: number, prompt: string) => setScenes((ss) => ss && ss.map((x, k) => (k === i ? { ...x, prompt } : x)));

  function framePrompt(i: number) {
    const d = scenes?.[i]?.dir ?? {};
    return `Photorealistic ${aspect} still frame, the first frame of a real phone video clip (not a staged photo). ${avatar ? `The person from the first reference image (same face): ${avatar.description || avatar.name}.` : ""} Setting: ${d.setting || place || "a real home, natural light"}. Shot: ${d.framing || "handheld selfie, chest-up"}. A natural relaxed expression, mouth closed, the instant before speaking.${product ? ` The product is visible in the scene, exactly like the product reference image: ${product.description || product.name}.` : ""}${lang === "es-CL" ? " The place looks like Chile." : ""} Natural light, real skin texture, no text, no logos, no watermark.`;
  }

  async function generate() {
    if (!scenes || starting) return;
    if (scenes.length !== cuts.length || scenes.some((x) => !x?.prompt)) { setErr("Los cortes cambiaron: vuelve a dirigir las escenas antes de generar."); return; }
    setConfirm(false); setErr("");
    setStarting("Creando el anuncio…"); // also hides the button: a second click can't create a second ad
    const res = await fetch("/api/ads/start", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title, format, lang, niche, aspect: model.startsWith("veo") && aspect !== "16:9" ? "9:16" : aspect, model, scriptId,
        avatarId: f.av === "none" ? null : avatarId || null, productId: productId || null,
        clips: cuts.map((c, i) => ({ tipo: c.tipo, texto: c.texto, prompt: scenes[i].prompt, framePrompt: framePrompt(i) })),
      }),
    }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) { setStarting(""); setErr(d.error || "No se pudo crear el anuncio. Revisa tu conexión e intenta de nuevo."); return; }
    // Start them two at a time so the providers don't throttle us; failures show up on each clip.
    const ids: string[] = d.clips.map((c: { id: string }) => c.id);
    for (let i = 0; i < ids.length; i += 2) {
      setStarting(`Iniciando cortes ${i + 1}–${Math.min(i + 2, ids.length)} de ${ids.length}…`);
      await Promise.all(ids.slice(i, i + 2).map((id) => fetch("/api/clips/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null)));
    }
    setStarting("");
    refreshCredits();
    setAdId(d.ad.id);
  }

  return (
    <>
      {step === 2 && (
        <form onSubmit={direct} className={cardCls} data-tour="crear-escenas">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="font-display text-xl font-bold">3 · Escenas</h2>
            <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold text-muted">{f.icon} {f.name}</span>
          </div>
          <p className="text-sm text-muted">Creads lee todo el guion, decide dónde está la persona y qué pasa en cada corte, y escribe el prompt de cada video. Las palabras de cada corte no se tocan. Puedes copiar los prompts para usarlos en otra herramienta, o generar los videos aquí mismo en el paso 4.</p>

          {f.av !== "none" && (
            <div className="flex flex-col gap-2" data-tour="crear-quien">
              <span className="text-sm font-semibold text-muted">{f.avLabel ?? "¿Quién habla?"}{f.av === "opt" ? " (opcional)" : ""}</span>
              {avatars.rows && avatars.rows.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {f.av === "opt" && (
                    <button type="button" onClick={() => setAvatarId("")} aria-pressed={!avatarId} className={`rounded-xl border px-3 py-2 text-sm ${!avatarId ? "border-accent bg-accent/10" : "border-line"}`}>Que la IA lo invente</button>
                  )}
                  {avatars.rows.map((a) => (
                    <button key={a.id} type="button" onClick={() => setAvatarId(a.id)} aria-pressed={a.id === avatarId}
                      className={`flex items-center gap-2 rounded-xl border p-1.5 pr-3 text-sm ${a.id === avatarId ? "border-accent bg-accent/10" : "border-line"}`}>
                      {a.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.image_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                      ) : <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2">👤</span>}
                      <span className="font-semibold">{a.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <input value={avatarText} onChange={(e) => setAvatarText(e.target.value)} placeholder="Ej: woman in her 40s, brown hair, gray sweater" className={inputCls} aria-label="Cómo es la persona" />
                  <p className="text-xs text-muted">Sin avatar guardado la cara cambia entre cortes. <Link href="/app/avatares" className="underline">Crea un avatar</Link> o elige uno de Creads aquí abajo para que sea siempre la misma persona.</p>
                </div>
              )}
              <details className="group" open={!avatars.rows?.length}>
                <summary className="cursor-pointer text-sm font-semibold text-accent-text">Avatares de Creads (listos para usar)</summary>
                <div className="pt-2">
                  <CreadsAvatars compact taken={(avatars.rows ?? []).map((a) => a.name)} onPick={async (id) => { await avatars.reload(); setAvatarId(id); }} />
                </div>
              </details>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Dónde empieza (opcional)"><input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Ej: en su cocina tomando café" className={inputCls} /></Field>
            <Field label="Producto que muestra (opcional)">
              <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
                <option value="">Sin producto</option>
                {products.rows?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
          <div data-tour="crear-direccion" className="flex flex-col gap-3"><Field label="Cómo quieres los videos (opcional, vale para todos los cortes)">
            <textarea rows={2} value={direction} onChange={(e) => setDirection(e.target.value)} placeholder="Escribe en español lo que quieres ver. Ej: que camine afuera de su casa, más energía en el hook" className={inputCls} />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {DIR_CHIPS.map((c) => (
              <button key={c} type="button" onClick={() => setDirection((d) => (d ? `${d}. ${c}` : c))} className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:text-ink">+ {c}</button>
            ))}
          </div></div>
          <div className="flex flex-wrap items-end gap-3" data-tour="crear-escenas-btn">
            <Field label="Formato">
              <select value={aspect} onChange={(e) => setAspect(e.target.value as typeof aspect)} className={inputCls}>
                <option value="9:16">9:16 vertical (Reels, TikTok, Stories)</option>
                <option value="4:5">4:5 (feed)</option>
                <option value="1:1">1:1 cuadrado</option>
                <option value="16:9">16:9 horizontal</option>
              </select>
            </Field>
            <button type="submit" disabled={busy || (f.av === "req" && !avatarId && !avatarText.trim())} className={btnCls}>{busy ? "Creando los prompts… (20–60 s)" : scenes ? "Volver a crear los prompts" : `Crear los prompts (${cuts.length} cortes)`}</button>
            {scenes && <button type="button" onClick={() => copy(allPrompts(), "all")} className={ghostCls}>{copied === "all" ? "Copiados ✓" : "Copiar todos"}</button>}
            {err && <span className="text-sm text-bad">{err}</span>}
          </div>

          {scenes && (
            <>
              <ol className="flex flex-col gap-3">
                {scenes.map((s, i) => (
                  <li key={i} className="grid gap-2 rounded-xl border border-line p-3 md:grid-cols-[90px_1fr]">
                    <div className="flex items-center gap-2 md:flex-col md:items-start">
                      <span className="font-mono text-xs text-muted">Corte {i + 1}</span>
                      <span className="rounded-full bg-accent/12 px-2 py-0.5 text-xs font-semibold text-accent-text">{cuts[i].tipo}</span>
                    </div>
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="font-medium">“{cuts[i].texto}”</p>
                      <p className="text-sm"><b>{s.dir.setting}</b>{s.dir.action ? ` — ${s.dir.action}` : ""}{s.dir.broll ? ` ${s.dir.broll}` : ""}</p>
                      <p className="text-xs text-muted">{s.dir.framing}{s.dir.emotion ? ` · ${s.dir.emotion}` : ""}</p>
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-accent-text">Ver y editar el prompt</summary>
                        <textarea value={s.prompt} onChange={(e) => editPrompt(i, e.target.value)} rows={10} aria-label={`Prompt del corte ${i + 1}`}
                          className="mt-2 w-full rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs" />
                        <p className="text-xs text-muted">Lo que cambies aquí es lo que se usa al generar este corte.</p>
                      </details>
                      <div>
                        <button type="button" onClick={() => copy(s.prompt, i)} className="rounded-lg bg-accent/12 px-3 py-1.5 text-xs font-semibold text-accent-text hover:bg-accent/20">
                          {copied === i ? "Copiado ✓" : `Copiar prompt del corte ${i + 1}`}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="text-xs text-muted">{rulesUsed ? `Se aplicaron ${rulesUsed} aprendizajes de videos anteriores.` : "Todavía no hay aprendizajes guardados; se agregan solos cuando la revisión encuentra errores."}</p>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setStep(1)} className={ghostCls}>← Volver a los cortes</button>
                <button type="button" onClick={() => copy(allPrompts(), "all")} className={ghostCls}>{copied === "all" ? "Copiados ✓" : "Copiar todos los prompts"}</button>
                <button type="button" onClick={() => setStep(3)} className={btnCls}>Siguiente: generar videos →</button>
              </div>
            </>
          )}
        </form>
      )}

      {step === 3 && adId && <AdWork adId={adId} />}
      {step === 3 && !adId && (
        <section className={cardCls}>
          <h2 className="font-display text-xl font-bold">4 · Videos</h2>
          {starting ? <p className="rounded-lg bg-accent/10 p-3 text-sm">{starting} No cierres esta página.</p> : (
            <>
              {(() => {
                const usable = models.filter((x) => x.configured && !x.needsImage && !x.silent && !faceRefused(x));
                const other = models.filter((x) => !usable.includes(x));
                // recommended first, then the cheapest and the best quality, then the rest by price
                const order = (id: string) => (MODEL_TAGS[id] ? MODEL_TAGS[id].rank : 9);
                const sorted = [...usable].sort((a, b) => order(a.id) - order(b.id) || a.usdPerSecond - b.usdPerSecond);
                return (
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-muted">Modelo de video</span>
                    <div role="radiogroup" aria-label="Modelo de video" data-tour="crear-modelo" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {sorted.map((x) => {
                        const tag = MODEL_TAGS[x.id];
                        const on = x.id === model;
                        return (
                          <button key={x.id} type="button" role="radio" aria-checked={on} onClick={() => setModel(x.id)}
                            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${on ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}>
                            <span className="flex w-full flex-wrap items-center justify-between gap-2">
                              <b className="text-sm">{x.label}</b>
                              {tag && <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tag.rank === 0 ? "bg-[image:var(--grad)] text-white" : "bg-surface-2 text-muted"}`}>{tag.pill}</span>}
                            </span>
                            <span className="text-xs text-muted">{price(x.usdPerSecond * 8)} por corte de 8 s</span>
                            {tag?.note && <span className="text-xs text-muted">{tag.note}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {other.length > 0 && (
                      <details className="text-xs text-muted">
                        <summary className="cursor-pointer">No sirven para este anuncio ({other.length})</summary>
                        <ul className="mt-1 flex flex-col gap-0.5 pl-4">
                          {other.map((x) => <li key={x.id}>{x.label} · {!x.configured ? "no disponible por ahora" : x.needsImage || x.silent ? "no genera voz" : "no acepta personas reales (tu avatar o una persona con tu producto)"}</li>)}
                        </ul>
                      </details>
                    )}
                  </div>
                );
              })()}
              <p className="rounded-lg bg-surface-2 p-3 text-sm" data-tour="crear-precio">
                <b>{cuts.length} cortes</b> · ≈ {videoSecs} s de video · {model.startsWith("veo") && aspect !== "16:9" ? "9:16" : aspect} · 720p
                {avatar ? ` · Avatar: ${avatar.name}` : ""}{product ? ` · Producto: ${product.name}` : ""}<br />
                {takesRefs && (avatar?.image_url || product?.image_url) ? "Veo usa la foto del avatar y del producto directo como referencia (cortes de 8 s). " : needsFrame ? "Primero se dibuja el cuadro inicial de cada corte con la cara del avatar (Nano Banana Pro) y después se anima. " : ""}
                Precio estimado: <b>{price(usd)}</b>{info && !info.unlimited ? ` · te quedan ${(info.balance ?? 0).toLocaleString("es-CL")}` : ""}. Si un corte falla, sus créditos vuelven solos.
                {model.startsWith("veo") && aspect !== "9:16" && aspect !== "16:9" ? " Veo no hace 4:5 ni 1:1: se genera en 9:16." : ""}
              </p>
              {!confirm ? (
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => setStep(2)} className={ghostCls}>← Volver a las escenas</button>
                  <button type="button" disabled={!scenes || !m?.configured || !covers(usd)} onClick={() => setConfirm(true)} className={btnCls}>Generar los {cuts.length} videos</button>
                  {!covers(usd) && <span className="text-sm text-warn">Te faltan créditos para este anuncio. Elige un modelo más barato o <a href="/app/planes" className="font-semibold underline">suma créditos</a>.</span>}
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-xl border border-warn/50 bg-warn/10 p-4 text-sm">
                  <p>Vas a generar <b>{cuts.length} videos</b> con <b>{m?.label}</b>. Esto usa ≈ {price(usd)}.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={generate} className={btnCls}>Sí, generar</button>
                    <button type="button" onClick={() => setConfirm(false)} className={ghostCls}>Cancelar</button>
                  </div>
                </div>
              )}
              {err && <p className="text-sm text-bad">{err}</p>}
            </>
          )}
        </section>
      )}
    </>
  );
}
