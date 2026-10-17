"use client";

import { useEffect, useRef, useState } from "react";
import { ImageInput, type Img } from "./tool-run";
import { useTable } from "./ui";
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
const IMAGE_FALLBACK: ImageModel[] = [{ id: "nano-banana-pro", label: "Nano Banana Pro", configured: true, usd: 0.134 }];

type VideoState =
  | { s: "idle" }
  | { s: "running"; since: number }
  | { s: "done"; url: string }
  | { s: "error"; msg: string };

export default function ModelLab({ code }: { code: string }) {
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<"9:16" | "16:9" | "1:1" | "4:5">("9:16");

  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState("");
  const [image, setImage] = useState<string | null>(null);
  // optional reference photos for the image: a face and/or a product (uploaded or from the library)
  const [refFace, setRefFace] = useState("");
  const [refProduct, setRefProduct] = useState("");

  const [models, setModels] = useState<VideoModel[]>(FALLBACK);
  const [imageModels, setImageModels] = useState<ImageModel[]>(IMAGE_FALLBACK);
  const [imgModel, setImgModel] = useState("nano-banana-pro");
  const [model, setModel] = useState("veo-3.1-lite");
  const [seconds, setSeconds] = useState(4);
  const [frame, setFrame] = useState(""); // starting image for the video (generated, uploaded or from the library)
  const library = useTable<Img>("images");
  const [video, setVideo] = useState<VideoState>({ s: "idle" });
  const [tick, setTick] = useState(0);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (poll.current && clearTimeout(poll.current)), []);
  useEffect(() => {
    if (!code) return;
    fetch("/api/models", { headers: { "x-creads-code": code } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.video?.length) setModels(d.video);
        if (d?.image?.length) setImageModels(d.image);
      })
      .catch(() => {});
  }, [code]);
  useEffect(() => {
    if (video.s !== "running") return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [video.s]);

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

  async function check(id: string, job: string, tries: number) {
    try {
      const res = await fetch(`/api/generate/video?model=${id}&job=${encodeURIComponent(job)}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo revisar el video.");
      if (data.state === "done") return setVideo({ s: "done", url: data.url });
      if (data.state === "failed") throw new Error(data.error || "El video falló.");
      if (tries > 60) throw new Error("Está tardando más de lo normal. Cuando termine aparece en «Tus creaciones»; si falla, los créditos vuelven solos.");
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
  const elapsed = video.s === "running" ? Math.floor((Date.now() - video.since) / 1000) : 0;
  void tick;

  const pill = "rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm";

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Generar</h2>
        <p className="text-sm text-muted">
          Cada botón genera de verdad y usa créditos. El precio aparece en el botón antes de apretarlo.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-muted">Qué quieres ver (mejor en inglés)</span>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder="Selfie video of a 40-year-old woman in her kitchen holding a phone, natural light, talking to camera, realistic UGC style"
          className="rounded-lg border border-line bg-surface-2 px-3 py-2 leading-relaxed"
        />
      </label>

      {!ready && (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">Escribe qué quieres ver (al menos una frase) para activar los botones.</p>
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

      <div className="grid gap-4 md:grid-cols-2">
        {/* Image */}
        <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
          <h3 className="font-semibold">1 · Imagen</h3>
          <select value={im.id} onChange={(e) => setImgModel(e.target.value)} className={pill} aria-label="Modelo de imagen">
            {imageModels.map((m) => (
              <option key={m.id} value={m.id} disabled={!m.configured}>
                {m.label} · {m.configured ? price(m.usd) : "No disponible por ahora"}
              </option>
            ))}
          </select>
          <details className="rounded-lg border border-line px-3 py-2 text-sm" open={Boolean(refFace || refProduct)}>
            <summary className="cursor-pointer font-semibold text-muted">Fotos de referencia (opcional)</summary>
            <p className="mt-1 text-xs text-muted">Sube una foto para que la imagen mantenga esa cara o ese producto. Describe en el texto qué quieres que haga o dónde aparece.</p>
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex flex-col gap-1"><span className="text-xs font-semibold text-muted">Cara de la persona</span><ImageInput value={refFace} onChange={setRefFace} library={library.rows ?? []} /></div>
              <div className="flex flex-col gap-1"><span className="text-xs font-semibold text-muted">Producto u objeto</span><ImageInput value={refProduct} onChange={setRefProduct} library={library.rows ?? []} /></div>
            </div>
          </details>
          <button
            type="button"
            onClick={makeImage}
            disabled={!ready || imgBusy || !covers(im.usd)}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
          >
            {imgBusy ? "Generando… (≈ 30 s)" : `Generar imagen · ${price(im.usd)}`}
          </button>
          {imgErr && <p className="text-sm text-bad">{imgErr}</p>}
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Imagen generada" className="max-h-[420px] w-full rounded-lg object-contain" />
          )}
        </div>

        {/* Video */}
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
              ? `Generando… ${elapsed} s (suele tardar 1 a 3 min)`
              : `Generar video · ${price(videoUsd)}`}
          </button>
          {video.s === "error" && <p className="text-sm text-bad">{video.msg}</p>}
          {video.s === "done" && (
            <video src={video.url} controls playsInline className="max-h-[480px] w-full rounded-lg bg-black" />
          )}
        </div>
      </div>
    </section>
  );
}
