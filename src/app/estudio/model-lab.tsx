"use client";

import { useEffect, useRef, useState } from "react";

// Test bench for the connected models. Every button here spends real money, so the price is always shown first.

const VIDEO_MODELS = [
  { id: "veo-3.1-lite", label: "Veo 3.1 Lite", usd: 0.05 },
  { id: "veo-3.1-fast", label: "Veo 3.1 Fast", usd: 0.1 },
  { id: "veo-3.1", label: "Veo 3.1", usd: 0.4 },
] as const;

const IMAGE_USD = 0.134;
const clp = (usd: number) => Math.round((usd * 950) / 10) * 10; // rough CLP, for orientation only

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

  const [model, setModel] = useState<(typeof VIDEO_MODELS)[number]["id"]>("veo-3.1-lite");
  const [seconds, setSeconds] = useState(4);
  const [useImage, setUseImage] = useState(true);
  const [video, setVideo] = useState<VideoState>({ s: "idle" });
  const [tick, setTick] = useState(0);
  const poll = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (poll.current && clearTimeout(poll.current)), []);
  useEffect(() => {
    if (video.s !== "running") return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [video.s]);

  const headers = { "content-type": "application/json", "x-creads-code": code };
  const vm = VIDEO_MODELS.find((m) => m.id === model)!;
  const videoUsd = +(vm.usd * seconds).toFixed(2);
  const videoAspect = aspect === "16:9" ? "16:9" : "9:16";

  async function makeImage() {
    setImgBusy(true);
    setImgErr("");
    try {
      const res = await fetch("/api/generate/image", { method: "POST", headers, body: JSON.stringify({ prompt, aspect }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo generar la imagen.");
      setImage(data.url);
    } catch (e) {
      setImgErr(e instanceof Error ? e.message : "No se pudo generar la imagen.");
    } finally {
      setImgBusy(false);
    }
  }

  async function check(job: string, tries: number) {
    try {
      const res = await fetch(`/api/generate/video?model=${model}&job=${encodeURIComponent(job)}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo revisar el video.");
      if (data.state === "done") return setVideo({ s: "done", url: data.url });
      if (data.state === "failed") throw new Error(data.error || "El video falló.");
      if (tries > 60) throw new Error("Se demoró demasiado (más de 10 minutos).");
      poll.current = setTimeout(() => check(job, tries + 1), 10000);
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
        body: JSON.stringify({ prompt, aspect: videoAspect, seconds, model, firstFrame: useImage && image ? image : "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar el video.");
      poll.current = setTimeout(() => check(data.job.jobId, 0), 15000);
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
        <h2 className="text-xl font-semibold">Probar modelos</h2>
        <p className="text-sm text-muted">
          Cada botón genera de verdad y se cobra en tu cuenta de Google. El precio aparece en el botón antes de apretarlo.
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
          <h3 className="font-semibold">1 · Imagen con Nano Banana Pro</h3>
          <button
            type="button"
            onClick={makeImage}
            disabled={!ready || imgBusy}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
          >
            {imgBusy ? "Generando… (≈ 30 s)" : `Generar imagen · US$${IMAGE_USD.toFixed(2)} (≈ $${clp(IMAGE_USD)})`}
          </button>
          {imgErr && <p className="text-sm text-bad">{imgErr}</p>}
          {image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Imagen generada" className="max-h-[420px] w-full rounded-lg object-contain" />
          )}
        </div>

        {/* Video */}
        <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
          <h3 className="font-semibold">2 · Video con Veo</h3>
          <div className="flex flex-wrap gap-2">
            <select value={model} onChange={(e) => setModel(e.target.value as typeof model)} className={pill} aria-label="Modelo">
              {VIDEO_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} · US${m.usd.toFixed(2)}/s
                </option>
              ))}
            </select>
            <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className={pill} aria-label="Duración">
              {[4, 6, 8].map((s) => (
                <option key={s} value={s}>
                  {s} segundos
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useImage} onChange={(e) => setUseImage(e.target.checked)} disabled={!image} />
            <span className={image ? "" : "text-muted"}>Partir desde la imagen generada</span>
          </label>
          <p className="text-xs text-muted">
            Veo hace videos {videoAspect} a 720p, con audio. Si el texto incluye lo que dice la persona entre comillas, lo habla.
          </p>
          <button
            type="button"
            onClick={makeVideo}
            disabled={!ready || video.s === "running"}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink disabled:opacity-50"
          >
            {video.s === "running"
              ? `Generando… ${elapsed} s (suele tardar 1 a 3 min)`
              : `Generar video · US$${videoUsd.toFixed(2)} (≈ $${clp(videoUsd)})`}
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
