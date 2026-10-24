"use client";

import { useEffect, useRef, useState } from "react";
import { ImageInput, type Img } from "./tool-run";
import { IMAGE_STYLES, type ImageStyle } from "@/lib/image-batch";
import { useTable, Working, dl } from "./ui";
import { refreshCredits, useCredits } from "./use-credits";

// Test bench for the connected models. Every button here spends real money, so the price is always shown first.

interface VideoModel {
  id: string;
  label: string;
  configured: boolean;
  usdPerSecond: number;
  live: boolean;
  aspects: string[];
  seconds: number[];
  needsImage?: boolean;
  silent?: boolean;
}

// Shown until /api/models answers.
const FALLBACK: VideoModel[] = [
  { id: "veo-3.1-lite", label: "Veo 3.1 Lite", usdPerSecond: 0.05 },
  { id: "veo-3.1-fast", label: "Veo 3.1 Fast", usdPerSecond: 0.1 },
  { id: "veo-3.1", label: "Veo 3.1", usdPerSecond: 0.4 },
].map((m) => ({ ...m, configured: true, live: false, aspects: ["9:16", "16:9"], seconds: [4, 6, 8] }));

interface ImageModel { id: string; label: string; configured: boolean; usd: number }
const IMAGE_FALLBACK: ImageModel[] = [{ id: "nano-banana-2", label: "Nano Banana 2", configured: true, usd: 0.08 }, { id: "nano-banana-pro", label: "Nano Banana Pro", configured: true, usd: 0.134 }];

type VideoState =
  | { s: "idle" }
  | { s: "running"; since: number }
  | { s: "done"; url: string }
  | { s: "error"; msg: string };

export default function ModelLab({ code, imagesOnly = false }: { code: string; imagesOnly?: boolean }) {
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<"9:16" | "16:9" | "1:1" | "4:5">("9:16");

  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState("");
  const [image, setImage] = useState<string | null>(null);
  // optional reference photos for the image: a face and/or a product (uploaded or from the library)
  const [refFace, setRefFace] = useState("");
  const [refProduct, setRefProduct] = useState("");
  // several images at once (back from the prototype): Creads writes a different idea for each one
  const [count, setCount] = useState(1);
  const [style, setStyle] = useState<ImageStyle>("libre");
  type Shot = { prompt: string; url?: string; err?: string; nota?: string; state: "waiting" | "running" | "done" | "error" };
  const [batch, setBatch] = useState<Shot[]>([]);
  // «Analizar una ganadora»: a winning ad → why it works + new angles to create with one click
  const [refWin, setRefWin] = useState("");
  const [winBusy, setWinBusy] = useState(false);
  const [win, setWin] = useState<{ analisis: { tipo: string; que_se_ve: string; por_que_funciona: string[]; angulo: string; conciencia: string; riesgos: string; testear: string }; enfoques: { angulo: string; idea: string; titular: string; hipotesis: string; prompt: string }[] } | null>(null);

  const [models, setModels] = useState<VideoModel[]>(FALLBACK);
  const [imageModels, setImageModels] = useState<ImageModel[]>(IMAGE_FALLBACK);
  const [imgModel, setImgModel] = useState("nano-banana-2");
  const [model, setModel] = useState("veo-3.1-lite");
  const [seconds, setSeconds] = useState(4);
  const [frame, setFrame] = useState(""); // starting image for the video (generated, uploaded or from the library)
  const library = useTable<Img>("images");
  const [video, setVideo] = useState<VideoState>({ s: "idle" });
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (poll.current && clearTimeout(poll.current)), []);
  // «Crear algo similar» from the site's /ia pages: settings come in the link (nothing runs by itself)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get("p"), m = q.get("m"), a = q.get("a"), s = Number(q.get("s"));
    if (p) setPrompt(p.slice(0, 3000));
    if (m) { setModel(m); setImgModel((cur) => (IMAGE_FALLBACK.some((x) => x.id === m) ? m : cur)); }
    if (a === "9:16" || a === "16:9" || a === "1:1" || a === "4:5") setAspect(a);
    if (s > 0) setSeconds(s);
  }, []);
  useEffect(() => {
    if (!code) return;
    fetch("/api/models", { headers: { "x-creads-code": code } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // talking avatar and «Persona real» need a recorded voice: they live in Crear anuncio
        if (d?.video?.length) setModels(d.video.filter((m: { talking?: boolean; actor?: boolean }) => !m.talking && !m.actor));
        if (d?.image?.length) setImageModels(d.image);
      })
      .catch(() => {});
  }, [code]);

  const headers = { "content-type": "application/json", "x-creads-code": code };
  const im = imageModels.find((m) => m.id === imgModel) ?? imageModels[0];
  const vm = models.find((m) => m.id === model) ?? models[0];
  const secs = vm.seconds.includes(seconds) ? seconds : vm.seconds[0];
  const videoUsd = +(vm.usdPerSecond * secs).toFixed(2);
  const { price, covers } = useCredits();
  const videoAspect = vm.aspects.includes(aspect) ? aspect : aspect === "16:9" ? "16:9" : "9:16";

  async function makeImage() {
    setImgBusy(true);
    setImgErr("");
    try {
      const res = await fetch("/api/generate/image", { method: "POST", headers, body: JSON.stringify({ prompt, aspect, model: im.id, refs: [...(refFace ? [{ url: refFace, role: "face" }] : []), ...(refProduct ? [{ url: refProduct, role: "product" }] : [])] }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo generar la imagen.");
      setImage(data.url);
      setFrame(data.url);
      refreshCredits();
    } catch (e) {
      setImgErr(e instanceof Error ? e.message : "No se pudo generar la imagen.");
    } finally {
      setImgBusy(false);
    }
  }

  /** N images: Creads writes N different prompts, then each image is generated (and charged) on its own,
   *  three at a time, and checked; a failed one gives its credits back. */
  async function makeBatch() {
    setImgBusy(true);
    setImgErr("");
    setBatch([]);
    try {
      const res = await fetch("/api/imagenes", { method: "POST", headers, body: JSON.stringify({ accion: "ideas", idea: prompt, estilo: style, n: count, aspect }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudieron preparar las ideas.");
      await runPrompts(data.prompts as string[]);
    } catch (e) {
      setImgErr(e instanceof Error ? e.message : "No se pudieron generar las imágenes.");
    } finally {
      setImgBusy(false);
    }
  }

  /** Generates (and checks) one image per prompt, three at a time; each is charged on its own. */
  async function runPrompts(prompts: string[], withRefs = true) {
    {
      setBatch(prompts.map((p) => ({ prompt: p, state: "waiting" })));
      const refs = withRefs ? [...(refFace ? [{ url: refFace, role: "face" }] : []), ...(refProduct ? [{ url: refProduct, role: "product" }] : [])] : [];
      const set = (i: number, patch: Partial<Shot>) => setBatch((b) => b.map((x, k) => (k === i ? { ...x, ...patch } : x)));
      let next = 0;
      const worker = async () => {
        while (next < prompts.length) {
          const i = next++;
          set(i, { state: "running" });
          try {
            const r = await fetch("/api/generate/image", { method: "POST", headers, body: JSON.stringify({ prompt: prompts[i], aspect, model: im.id, refs }) });
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || "No se pudo generar.");
            set(i, { state: "done", url: d.url });
            refreshCredits();
            fetch("/api/imagenes", { method: "POST", headers, body: JSON.stringify({ accion: "revisar", url: d.url, prompt: prompts[i] }) })
              .then((x) => x.json()).then((q) => { if (q?.ok === false && q.nota) set(i, { nota: q.nota }); }).catch(() => {});
          } catch (e) {
            set(i, { state: "error", err: e instanceof Error ? e.message : "No se pudo generar." });
          }
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    }
  }

  async function analyzeWinner() {
    if (!refWin || winBusy) return;
    setWinBusy(true); setImgErr(""); setWin(null);
    try {
      const res = await fetch("/api/imagenes", { method: "POST", headers, body: JSON.stringify({ accion: "analizar", url: refWin, nota: prompt, n: 4, aspect: aspect === "9:16" ? "4:5" : aspect }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo analizar la imagen.");
      setWin(data);
      // ad images with text come out best with GPT Image Pro (if it's on)
      const pro = imageModels.find((m) => m.id === "gpt-image-2.5-pro" && m.configured);
      if (pro) setImgModel(pro.id);
      if (aspect === "9:16") setAspect("4:5");
    } catch (e) {
      setImgErr(e instanceof Error ? e.message : "No se pudo analizar la imagen.");
    } finally {
      setWinBusy(false);
    }
  }

  async function createFrom(prompts: string[]) {
    setImgBusy(true); setImgErr("");
    try { await runPrompts(prompts, false); } finally { setImgBusy(false); }
  }

  async function check(id: string, job: string, tries: number) {
    try {
      const res = await fetch(`/api/generate/video?model=${id}&job=${encodeURIComponent(job)}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo revisar el video.");
      if (data.state === "done") return setVideo({ s: "done", url: data.url });
      if (data.state === "failed") throw new Error(data.error || "El video falló.");
      if (tries > 60) throw new Error("Está tardando más de lo normal. Cuando termine aparece en «Tus creaciones»; si falla, los segundos vuelven solos.");
      poll.current = setTimeout(() => check(id, job, tries + 1), 10000);
    } catch (e) {
      setVideo({ s: "error", msg: e instanceof Error ? e.message : "El video falló." });
    }
  }

  async function makeVideo() {
    setVideo({ s: "running", since: Date.now() });
    try {
      const res = await fetch("/api/generate/video", {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt, aspect: videoAspect, seconds: secs, model: vm.id, firstFrame: frame }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar el video.");
      refreshCredits();
      const id = vm.id;
      poll.current = setTimeout(() => check(id, data.job.jobId, 0), 15000);
    } catch (e) {
      setVideo({ s: "error", msg: e instanceof Error ? e.message : "No se pudo iniciar el video." });
    }
  }

  const ready = Boolean(code) && prompt.trim().length >= 10;

  const pill = "rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm";

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-2xl sm:border sm:border-line sm:bg-surface sm:p-4">
      <div className={`flex flex-col gap-1 ${imagesOnly ? "hidden sm:flex" : ""}`}>
        <h2 className="text-xl font-semibold">{imagesOnly ? "Crear imágenes" : "Generar"}</h2>
        <p className="text-sm text-muted">
          Cada botón genera de verdad y descuenta créditos. El precio aparece en el botón antes de apretarlo.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-muted">Qué quieres ver (mejor en inglés)</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={imagesOnly ? "Ej: mujer de 35 años en su cocina mostrando el producto, luz natural, foto real de celular" : "Selfie video of a 40-year-old woman in her kitchen holding a phone, natural light, talking to camera, realistic UGC style"}
          className="rounded-lg border border-line bg-surface-2 px-3 py-2 leading-relaxed"
        />
      </label>

      {!ready && (
        <p className="hidden rounded-lg bg-surface-2 px-3 py-2 text-sm sm:block">Escribe qué quieres ver (al menos una frase) para activar los botones.</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-muted">Formato</span>
        {(["9:16", "4:5", "1:1", "16:9"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAspect(a)}
            aria-pressed={aspect === a}
            className={`rounded-full border px-3 py-1 ${aspect === a ? "border-ink bg-ink text-bg" : "border-line text-muted"}`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className={`grid min-w-0 gap-4 ${imagesOnly ? "" : "md:grid-cols-2"}`}>
        {/* Image */}
        <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-line p-3">
          <h3 className="font-semibold">1 · Imagen</h3>
          <select value={im.id} onChange={(e) => setImgModel(e.target.value)} className={`${pill} w-full min-w-0`} aria-label="Modelo de imagen">
            {imageModels.map((m) => (
              <option key={m.id} value={m.id} disabled={!m.configured}>
                {m.label} · {m.configured ? price(m.usd) : "No disponible por ahora"}
              </option>
            ))}
          </select>
          <details className="rounded-lg border border-line px-3 py-2 text-sm" open={Boolean(refWin || win)}>
            <summary className="cursor-pointer font-semibold">¿Tienes un anuncio que ya funciona? Analízalo y prueba enfoques nuevos</summary>
            <p className="mt-1 text-xs text-muted">Sube la imagen ganadora. Creads te dice por qué funciona y te propone 4 enfoques distintos para el mismo nicho, cada uno listo para crear. Analizar es gratis; arriba puedes escribir qué buscas (opcional).</p>
            <div className="mt-2 flex flex-col gap-2">
              <ImageInput value={refWin} onChange={(v) => { setRefWin(v); setWin(null); }} library={library.rows ?? []} />
              <button type="button" onClick={analyzeWinner} disabled={!refWin || winBusy} className="w-fit rounded-lg bg-ink px-3 py-2 font-semibold text-bg disabled:opacity-50">
                {winBusy ? <Working label="Analizando…" /> : "Analizar y proponer enfoques"}
              </button>
              {win && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg bg-surface-2 p-3">
                    <p className="font-semibold">Por qué funciona · {win.analisis.angulo}</p>
                    {win.analisis.tipo && <p className="mt-1 text-xs font-semibold text-muted">{win.analisis.tipo}</p>}
                    {win.analisis.que_se_ve && <p className="mt-1 text-muted">{win.analisis.que_se_ve}</p>}
                    <ul className="mt-1 list-disc pl-5 text-muted">{win.analisis.por_que_funciona.map((x) => <li key={x}>{x}</li>)}</ul>
                    {win.analisis.conciencia && <p className="mt-2"><b>Nivel de conciencia:</b> <span className="text-muted">{win.analisis.conciencia}</span></p>}
                    {win.analisis.riesgos && <p className="mt-1"><b>Ojo con Meta:</b> <span className="text-muted">{win.analisis.riesgos}</span></p>}
                    {win.analisis.testear && <p className="mt-1"><b>Cómo testear:</b> <span className="text-muted">{win.analisis.testear}</span></p>}
                  </div>
                  <ul className="flex flex-col gap-2">
                    {win.enfoques.map((e) => (
                      <li key={e.prompt} className="flex flex-col gap-1 rounded-lg border border-line p-3">
                        <b>{e.angulo}</b>
                        <span className="text-muted">{e.idea}</span>
                        <span>Titular: <b>«{e.titular}»</b></span>
                        {e.hipotesis && <span className="text-xs text-muted">Por qué podría ganarle: {e.hipotesis}</span>}
                        <button type="button" onClick={() => createFrom([e.prompt])} disabled={imgBusy || !covers(im.usd)} className="mt-1 w-fit rounded-lg border border-line px-3 py-1.5 font-semibold hover:bg-surface-2 disabled:opacity-50">Crear esta · {price(im.usd)}</button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => createFrom(win.enfoques.map((e) => e.prompt))} disabled={imgBusy || !covers(im.usd * win.enfoques.length)} className="w-fit rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50">
                    {imgBusy ? <Working label="Generando…" /> : `Crear las ${win.enfoques.length} · ${price(im.usd * win.enfoques.length)}`}
                  </button>
                  <p className="text-xs text-muted">Modelo: {im.label}. Para imágenes con texto, GPT Image 2.5 Pro escribe el titular mejor.</p>
                </div>
              )}
            </div>
          </details>
          <details className="rounded-lg border border-line px-3 py-2 text-sm" open={Boolean(refFace || refProduct)}>
            <summary className="cursor-pointer font-semibold text-muted">Fotos de referencia (opcional)</summary>
            <p className="mt-1 text-xs text-muted">Sube una foto para que la imagen mantenga esa cara o ese producto. Describe en el texto qué quieres que haga o dónde aparece.</p>
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex flex-col gap-1"><span className="text-xs font-semibold text-muted">Cara de la persona</span><ImageInput value={refFace} onChange={setRefFace} library={library.rows ?? []} /></div>
              <div className="flex flex-col gap-1"><span className="text-xs font-semibold text-muted">Producto u objeto</span><ImageInput value={refProduct} onChange={setRefProduct} library={library.rows ?? []} /></div>
            </div>
          </details>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-muted">Cantidad</span>
            {[1, 2, 4, 8, 12].map((n) => (
              <button key={n} type="button" onClick={() => setCount(n)} aria-pressed={count === n}
                className={`rounded-full border px-3 py-1 ${count === n ? "border-ink bg-ink text-bg" : "border-line text-muted"}`}>{n}</button>
            ))}
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-muted">Estilo</span>
            <select value={style} onChange={(e) => setStyle(e.target.value as ImageStyle)} className={pill}>
              {IMAGE_STYLES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
          {(count > 1 || style !== "libre") && <p className="text-xs text-muted">Creads escribe una idea distinta para cada imagen (otro gancho, otra escena, otra persona), para que pruebes cuál funciona mejor. Cada imagen se revisa al salir.</p>}
          <button
            type="button"
            onClick={count > 1 || style !== "libre" ? makeBatch : makeImage}
            disabled={!ready || imgBusy || !covers(im.usd * count)}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
          >
            {imgBusy ? <Working label="Generando…" /> : count > 1 ? `Generar ${count} imágenes · ${price(im.usd * count)}` : `Generar imagen · ${price(im.usd)}`}
          </button>
          {imgErr && <p className="text-sm text-bad">{imgErr}</p>}
          {image && !batch.length && (
            <div className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="Imagen generada" className="max-h-[420px] w-full rounded-lg object-contain" />
              <a href={dl(image)} download target="_blank" rel="noopener noreferrer" className="w-fit rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">Descargar imagen</a>
            </div>
          )}
          {batch.length > 0 && (
            <ul className="grid grid-cols-2 gap-2">
              {batch.map((b, i) => (
                <li key={i} className="flex flex-col gap-1">
                  <div className={`relative ${aspect === "9:16" ? "aspect-[9/16]" : aspect === "4:5" ? "aspect-[4/5]" : aspect === "16:9" ? "aspect-video" : "aspect-square"} overflow-hidden rounded-lg border ${frame && frame === b.url ? "border-accent-text" : "border-line"} bg-surface-2`}>
                    {b.url
                      ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.url} alt={`Imagen ${i + 1}`} className="absolute inset-0 h-full w-full object-cover" />
                      )
                      : <span className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-muted">{b.state === "error" ? b.err : b.state === "running" ? "Generando…" : "En cola"}</span>}
                  </div>
                  {b.nota && <span className="text-xs text-warn">⚠ {b.nota}</span>}
                  {b.url && <a href={dl(b.url)} download target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent-text">Descargar</a>}
                  {b.url && !imagesOnly && <button type="button" onClick={() => setFrame(b.url!)} className="text-left text-xs font-semibold text-accent-text">{frame === b.url ? "✓ Imagen de partida del video" : "Usar para el video"}</button>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Video (hidden in «Imágenes para anuncios»: Creads sells UGC ads, made in Crear anuncio) */}
        {!imagesOnly && (
        <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
          <h3 className="font-semibold">2 · Video</h3>
          <div className="flex flex-wrap gap-2">
            <select value={vm.id} onChange={(e) => setModel(e.target.value)} className={pill} aria-label="Modelo">
              {models.map((m) => (
                <option key={m.id} value={m.id} disabled={!m.configured}>
                  {m.label} · {m.configured ? `${price(m.usdPerSecond * 8)} por 8 s` : "No disponible por ahora"}
                </option>
              ))}
            </select>
            <select value={secs} onChange={(e) => setSeconds(Number(e.target.value))} className={pill} aria-label="Duración">
              {vm.seconds.map((s) => (
                <option key={s} value={s}>
                  {s} segundos
                </option>
              ))}
            </select>
          </div>
          <div role="group" aria-labelledby="frame-l" className="flex flex-col gap-1 text-sm">
            <span id="frame-l" className="font-semibold text-muted">Imagen de partida {vm.needsImage ? "(obligatoria para este modelo)" : "(opcional)"}</span>
            <ImageInput value={frame} onChange={setFrame} library={library.rows ?? []} />
          </div>
          <p className="text-xs text-muted">
            {vm.needsImage && <b className="block text-warn">Este modelo solo anima una imagen: genera una, súbela o elígela de tus imágenes.</b>}
            Se genera en {videoAspect} a 720p{vm.silent ? ", sin audio" : ", con audio"}{vm.live ? "" : " (precio aproximado)"}. Si el texto incluye lo que dice la persona entre comillas, lo habla.
          </p>
          <button
            type="button"
            onClick={makeVideo}
            disabled={!ready || video.s === "running" || (vm.needsImage && !frame) || !covers(videoUsd)}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
          >
            {video.s === "running"
              ? <Working since={video.since} label="Generando…" />
              : `Generar video · ${price(videoUsd)}`}
          </button>
          {video.s === "error" && <p className="text-sm text-bad">{video.msg}</p>}
          {video.s === "done" && (
            <video src={video.url} controls playsInline className="max-h-[480px] w-full rounded-lg bg-black" />
          )}
        </div>
        )}
      </div>
    </section>
  );
}
