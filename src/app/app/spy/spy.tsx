"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FROM_SPY_KEY } from "@/lib/guiones";
import { NICHES } from "@/lib/niches";
import type { SpyAd } from "@/lib/providers/adspy";
import { Spinner, btnCls, cardCls, inputCls } from "../_parts/ui";

// Step 1 of a campaign: find the ads that are already selling in your niche (the ones running for
// weeks), watch them, and send any of them to «Crear guion» to take it apart.

const COUNTRIES: [string, string][] = [
  ["CL", "Chile"], ["MX", "México"], ["CO", "Colombia"], ["AR", "Argentina"], ["PE", "Perú"], ["EC", "Ecuador"],
  ["UY", "Uruguay"], ["CR", "Costa Rica"], ["DO", "Rep. Dominicana"], ["US", "Estados Unidos"], ["ES", "España"], ["BR", "Brasil"], ["ALL", "Todos los países"],
];
const KEY = "creads-espiar";

function Days({ ad }: { ad: SpyAd }) {
  if (ad.days == null) return null;
  const hot = ad.days >= 30;
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold leading-none backdrop-blur-sm ${hot ? "bg-[image:var(--grad)] text-white" : "bg-black/65 text-white/90"}`}>
      {hot ? "🔥 " : ""}{ad.days} {ad.days === 1 ? "día" : "días"} activo
    </span>
  );
}

function AdCard({ ad, onScript, busy }: { ad: SpyAd; onScript: (ad: SpyAd) => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="relative aspect-[4/5] bg-black">
        {ad.video ? (
          <video src={ad.video} poster={ad.poster ?? undefined} controls playsInline preload="none" className="h-full w-full object-contain" />
        ) : ad.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.image} alt={`Anuncio de ${ad.page}`} loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <p className="grid h-full place-items-center p-4 text-center text-sm text-white/70">Anuncio solo de texto</p>
        )}
        <span className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1.5">
          <Days ad={ad} />
          {ad.copies > 1 && <span className="rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold leading-none text-white/90 backdrop-blur-sm">{ad.copies} versiones</span>}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-center gap-2">
          {ad.pageImage
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={ad.pageImage} alt="" className="h-7 w-7 rounded-full object-cover" loading="lazy" />
            : <span className="grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-xs font-bold">{ad.page.slice(0, 1)}</span>}
          <span className="flex min-w-0 flex-col">
            <b className="truncate text-sm">{ad.page}</b>
            {ad.start && <span className="text-[11px] text-muted">Desde el {new Date(`${ad.start}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}</span>}
          </span>
        </div>
        {ad.text && (
          <p className={`whitespace-pre-line text-sm text-muted ${open ? "" : "line-clamp-4"}`}>
            {ad.text}
          </p>
        )}
        {ad.text.length > 180 && <button type="button" onClick={() => setOpen((v) => !v)} className="w-fit text-xs font-semibold text-muted hover:text-ink">{open ? "Ver menos" : "Ver texto completo"}</button>}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <button type="button" onClick={() => onScript(ad)} disabled={busy} className={`${btnCls} flex-1`}>
            {busy ? <span className="inline-flex items-center gap-2"><Spinner />Sacando el guion…</span> : "Desarmar este guion"}
          </button>
          <a href={`https://www.facebook.com/ads/library/?id=${ad.id}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted hover:text-ink" title="Abrir en la Biblioteca de anuncios de Meta">Ver en Meta ↗</a>
        </div>
      </div>
    </article>
  );
}

export default function Spy() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pais, setPais] = useState("CL");
  const [onlyVideo, setOnlyVideo] = useState(true);
  const [minDays, setMinDays] = useState(0);
  const [ads, setAds] = useState<SpyAd[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "search" | "more">("");
  const [taking, setTaking] = useState("");
  const [err, setErr] = useState("");
  const [off, setOff] = useState(false);
  const last = useRef("");

  // remember the last search in this browser
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (v?.q) setQ(v.q);
      if (v?.pais) setPais(v.pais);
      else { const n = localStorage.getItem("creads-niche"); if (n) setQ(n); }
    } catch {}
  }, []);

  async function search(more = false, term = q) {
    const text = term.trim();
    if (text.length < 3) return setErr("Escribe qué vendes o tu nicho (al menos 3 letras).");
    setBusy(more ? "more" : "search"); setErr("");
    try {
      const p = new URLSearchParams({ q: text, pais, ...(onlyVideo ? { video: "1" } : {}), ...(more && cursor ? { cursor } : {}) });
      const res = await fetch(`/api/espiar?${p}`);
      const d = await res.json().catch(() => ({}));
      if (res.status === 503) { setOff(true); return; }
      if (!res.ok) throw new Error(d.error || "No pudimos buscar ahora.");
      last.current = text;
      setAds((prev) => (more && prev ? [...prev, ...d.ads.filter((a: SpyAd) => !prev.some((x) => x.id === a.id))] : d.ads));
      setCursor(d.cursor ?? null);
      try { localStorage.setItem(KEY, JSON.stringify({ q: text, pais })); } catch {}
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No pudimos buscar ahora.");
    } finally {
      setBusy("");
    }
  }

  async function takeScript(ad: SpyAd) {
    setTaking(ad.id); setErr("");
    let text = "";
    if (ad.video) {
      const d = await fetch("/api/espiar/guion", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: ad.id, video: ad.video, lang: ["US", "CA", "GB"].includes(pais) ? "en" : "es" }) })
        .then((r) => r.json()).catch(() => ({}));
      text = String(d.transcript ?? "").trim();
    }
    // no voice in the video: the ad's own text is the script
    const script = [text, !text ? [ad.title, ad.text].filter(Boolean).join("\n\n") : ""].filter(Boolean).join("\n\n").trim();
    if (!script) { setTaking(""); return setErr("Este anuncio no tiene texto ni voz para sacar el guion. Prueba con otro."); }
    try { sessionStorage.setItem(FROM_SPY_KEY, JSON.stringify({ text: script, page: ad.page, voice: Boolean(text), video: Boolean(ad.video), days: ad.days })); } catch {}
    router.push("/app/guiones");
  }

  const shown = (ads ?? []).filter((a) => (a.days ?? 0) >= minDays);
  const hot = (ads ?? []).filter((a) => (a.days ?? 0) >= 30).length;

  if (off) {
    return (
      <section className={cardCls}>
        <h2 className="font-display text-lg font-bold">El buscador vuelve en un rato</h2>
        <p className="text-sm text-muted">Mientras, puedes buscar a mano en la Biblioteca de anuncios de Meta: escribe tu nicho, elige tu país y fíjate en los anuncios que llevan 30 días o más activos.</p>
        <a href="https://www.facebook.com/ads/library/" target="_blank" rel="noopener noreferrer" className={`${btnCls} self-start`}>Abrir la Biblioteca de anuncios ↗</a>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={(e) => { e.preventDefault(); search(); }} className={cardCls}>
        <div className="flex flex-col gap-2 lg:flex-row">
          <label className="sr-only" htmlFor="spy-q">Qué vendes o tu nicho</label>
          <input id="spy-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="¿Qué vendes? Ej: seguro de auto, remodelación de baño, paneles solares" className={`${inputCls} flex-1 py-3 text-base`} />
          <label className="sr-only" htmlFor="spy-pais">País</label>
          <select id="spy-pais" value={pais} onChange={(e) => setPais(e.target.value)} className={`${inputCls} py-3`}>
            {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
          <button type="submit" disabled={Boolean(busy)} className="rounded-lg bg-[image:var(--grad)] px-6 py-3 font-semibold text-white disabled:opacity-60">
            {busy === "search" ? <span className="inline-flex items-center gap-2"><Spinner />Espiando…</span> : "Espiar anuncios"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={onlyVideo} onChange={(e) => setOnlyVideo(e.target.checked)} />Solo videos</label>
          <span className="text-muted">Ideas:</span>
          {NICHES.slice(0, 7).map((n) => (
            <button key={n} type="button" onClick={() => { setQ(n); search(false, n); }} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted hover:border-muted hover:text-ink">{n}</button>
          ))}
        </div>
        {err && <p className="text-sm text-bad">{err}</p>}
      </form>

      {ads && (
        <section aria-labelledby="spy-res" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col">
              <h2 id="spy-res" className="font-display text-lg font-bold">{ads.length ? `${ads.length} anuncios activos para «${last.current}»` : `No encontramos anuncios activos para «${last.current}»`}</h2>
              {ads.length > 0 && <p className="text-sm text-muted">Ordenados por días activo. {hot ? `${hot} llevan 30 días o más: esos están vendiendo.` : "Ninguno lleva 30 días todavía: prueba con otra palabra o país."}</p>}
            </div>
            {ads.length > 0 && (
              <div role="group" aria-label="Filtrar por días activo" className="flex rounded-lg border border-line p-0.5 text-sm">
                {[[0, "Todos"], [14, "+14 días"], [30, "+30 días"], [60, "+60 días"]].map(([d, l]) => (
                  <button key={d} type="button" aria-pressed={minDays === d} onClick={() => setMinDays(Number(d))} className={`rounded-md px-3 py-1.5 font-semibold ${minDays === d ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>{l}</button>
                ))}
              </div>
            )}
          </div>
          {ads.length === 0 && <p className="text-sm text-muted">Prueba con palabras más simples (por ejemplo «seguro» en vez de «seguro automotriz full cobertura»), otro país o desmarca «Solo videos».</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((ad) => <AdCard key={ad.id} ad={ad} onScript={takeScript} busy={taking === ad.id} />)}
          </div>
          {ads.length > 0 && shown.length === 0 && <p className="text-sm text-muted">Ninguno pasa ese filtro. Elige «Todos» o carga más resultados.</p>}
          {cursor && (
            <button type="button" onClick={() => search(true, last.current)} disabled={Boolean(busy)} className="self-center rounded-lg border border-line px-5 py-2.5 text-sm font-semibold hover:bg-surface-2">
              {busy === "more" ? <span className="inline-flex items-center gap-2"><Spinner />Cargando…</span> : "Cargar más anuncios"}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
