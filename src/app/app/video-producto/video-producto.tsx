"use client";

import { useEffect, useState } from "react";
import { PageHead, Spinner, btnCls, cardCls, ghostCls, inputCls, uploadFile, dl } from "../_parts/ui";
import { refreshCredits } from "../_parts/use-credits";
import { ESTILOS_VIDEO, type EstiloVideo } from "@/lib/video-producto";

// «Video de producto» (owner, 25 Oct 2026): a 6 s premium clip of the real product (not UGC) with a headline.
// The same flow the Creads connector uses: a clean photo → a styled scene → the animation → the headline on top.

interface Video { id: string; estado: "creando" | "listo" | "error"; url?: string; escena?: string; error?: string; estilo: string }
const H = { "content-type": "application/json" };
const CONSEJO: Record<EstiloVideo, string> = {
  giro: "Ideal para productos con buen diseño: frascos, cosmética, gadgets.",
  macro: "Para mostrar textura, material o la etiqueta de cerca.",
  salpicadura: "Bebidas, comida, skincare, todo lo que se asocia a frescura.",
  flotando: "Llama la atención en el feed: suplementos, accesorios, tecnología.",
  unboxing: "Regalos, packs y productos con buena caja.",
  lifestyle: "Muestra el producto donde se usa: cocina, baño, escritorio.",
};

export default function VideoProducto() {
  const [foto, setFoto] = useState("");
  const [estilo, setEstilo] = useState<EstiloVideo>("giro");
  const [titular, setTitular] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [biblio, setBiblio] = useState<{ id: string; url: string }[] | null>(null);

  // settings can come in the link (from the gallery, the batch or the connector): ?foto=…&estilo=…&titular=…
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const f = q.get("foto"), e = q.get("estilo"), t = q.get("titular"), d = q.get("descripcion");
    if (f && f.startsWith("/api/media/")) setFoto(f.slice(0, 600));
    if (e && ESTILOS_VIDEO.some((x) => x.id === e)) setEstilo(e as EstiloVideo);
    if (t) setTitular(t.slice(0, 60));
    if (d) setDescripcion(d.slice(0, 300));
  }, []);
  async function abrirBiblioteca() {
    const d = await fetch("/api/data/images").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    setBiblio(((d?.rows ?? []) as { id: string; url: string }[]).filter((x) => x.url).slice(0, 48));
  }

  async function subir(file?: File) {
    if (!file) return;
    setBusy("Subiendo foto…"); setErr("");
    try { setFoto(await uploadFile(file)); } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo subir."); } finally { setBusy(""); }
  }
  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setBusy("Preparando la escena de tu producto…"); setErr("");
    try {
      const r = await fetch("/api/video-producto", { method: "POST", headers: H, body: JSON.stringify({ producto: foto, estilo, titular, descripcion }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo empezar el video.");
      setVideos((v) => [d.video, ...v]);
      refreshCredits();
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo empezar el video."); } finally { setBusy(""); }
  }
  // check the videos in progress every 8 s
  useEffect(() => {
    const pend = videos.filter((v) => v.estado === "creando");
    if (!pend.length) return;
    const t = setTimeout(async () => {
      for (const p of pend) {
        const d = await fetch(`/api/video-producto?id=${p.id}`).then((r) => r.json()).catch(() => null);
        if (d?.video) setVideos((v) => v.map((x) => (x.id === p.id ? d.video : x)));
        if (d?.video?.estado === "error") refreshCredits();
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [videos]);

  return (
    <>
      <PageHead title="Video de producto" lead="Un video de 6 segundos de tu producto, sin personas: girando, de cerca, con salpicadura, flotando, en su caja o en su lugar. Con tu titular encima, en 9:16 para stories y reels." />
      <form onSubmit={crear} className={cardCls}>
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <div className="flex flex-col gap-2">
            <div className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt="Tu producto" className="h-full w-full object-contain" />
              ) : <span className="px-3 text-center text-xs text-muted">Foto clara de tu producto, ojalá con fondo limpio</span>}
            </div>
            <label className={`${ghostCls} cursor-pointer text-center`}>{foto ? "Cambiar foto" : "Subir foto"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => subir(e.target.files?.[0])} />
            </label>
            <button type="button" onClick={abrirBiblioteca} className="text-xs font-semibold text-muted underline hover:text-ink">Elegir de mis imágenes</button>
          </div>
          <div className="flex flex-col gap-3">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-semibold">Cómo se mueve</legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ESTILOS_VIDEO.map((e) => (
                  <label key={e.id} className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-3 text-sm ${estilo === e.id ? "border-accent bg-accent/10" : "border-line hover:border-muted"}`}>
                    <span className="flex items-center gap-2 font-semibold"><input type="radio" name="estilo" checked={estilo === e.id} onChange={() => setEstilo(e.id)} />{e.label}</span>
                    <span className="text-xs text-muted">{CONSEJO[e.id]}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">Titular encima (opcional, máximo 7 palabras)
              <input value={titular} onChange={(e) => setTitular(e.target.value.slice(0, 60))} placeholder="Ej: Tu café, listo en 30 segundos" className={inputCls} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">Qué es (opcional)
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value.slice(0, 300))} placeholder="Ej: sérum de vitamina C en frasco ámbar" className={inputCls} />
            </label>
          </div>
        </div>
        {biblio && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">Tus imágenes</span>
            {biblio.length ? (
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                {biblio.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => { setFoto(b.url); setBiblio(null); }} className="block aspect-square w-full overflow-hidden rounded-lg border border-line hover:border-accent">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : <span className="text-xs text-muted">Todavía no tienes imágenes creadas.</span>}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!foto || Boolean(busy)} className={btnCls}>Crear video de producto</button>
          {busy ? <span className="flex items-center gap-2 text-sm text-muted"><Spinner /> {busy}</span> : <span className="text-xs text-muted">Usa ≈ 3 imágenes de tu saldo. Si falla, vuelve solo.</span>}
        </div>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      </form>

      {videos.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {videos.map((v) => (
            <li key={v.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
              {v.estado === "listo" && v.url ? (
                <>
                  <video src={v.url} controls playsInline muted loop autoPlay className="aspect-[9/16] w-full rounded-lg bg-black object-cover" />
                  <a href={dl(v.url)} className="text-sm font-semibold underline">Descargar</a>
                </>
              ) : v.estado === "error" ? (
                <p className="text-sm text-bad">{v.error || "El video falló."} El saldo volvió a tu cuenta.</p>
              ) : (
                <div className="relative grid aspect-[9/16] place-items-center overflow-hidden rounded-lg bg-surface-2">
                  {v.escena && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.escena} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
                  )}
                  <span className="relative flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white"><Spinner /> Animando (1 a 3 min)…</span>
                </div>
              )}
              <span className="text-xs text-muted">{ESTILOS_VIDEO.find((e) => e.id === v.estilo)?.label}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
