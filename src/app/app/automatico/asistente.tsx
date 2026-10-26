"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cardCls, ghostCls, inputCls, uploadFile, dl } from "../_parts/ui";
import { refreshCredits, useCredits } from "../_parts/use-credits";
import { buyNow, openUpgrade } from "../_parts/buy";
import { MoneyText } from "../../money";
import { SHOWN_PLANS } from "@/lib/catalog";

// «Automático»: the customer talks with the Creads assistant (Claude + the Creads tools + the RECETA). The
// page keeps the conversation (in this browser), shows the pictures it makes, follows each ad until it's
// ready, then tells the assistant so it reviews it and hands it over.

type Block = { type: string; text?: string; name?: string; content?: unknown; is_error?: boolean; id?: string; tool_use_id?: string; input?: unknown };
type Msg = { role: "user" | "assistant"; content: string | Block[] };
interface Ad { id: string; estado: string; paso?: string | null; video_url?: string | null; error?: string | null; told?: boolean; estudio_id?: string | null }

const KEY = "creads-automatico";
const REF = /\/api\/media\/ws\/[\w-]+\/[\w./-]+\.(?:png|jpe?g|webp|mp4|mov|webm)/gi;
const START = "Hola, quiero hacer un anuncio.";
const TOOL_LABEL: Record<string, string> = {
  creads_crear_imagen: "Creando la foto de la persona",
  creads_crear_avatar: "Guardando a la persona",
  creads_crear_anuncio: "Haciendo el anuncio",
  creads_revisar_anuncio: "Revisando el video: escucho cada palabra y miro cada escena",
  creads_montar_demo: "Armando el video final con todos los clips",
  creads_corregir_subtitulos: "Corrigiendo los subtítulos y armando el video de nuevo",
  creads_saldo: "Mirando tu saldo",
  creads_avatares: "Mirando tus avatares",
  creads_voces: "Mirando las voces",
  creads_ver_imagen: "Mirando la imagen",
};
const notice = (t: string) => t.startsWith("[");

export default function Asistente() {
  const [history, setHistory] = useState<Msg[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  // the conversation survives a reload (this browser only)
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s?.history?.length) { setHistory(s.history); setAds(s.ads ?? []); }
    } catch {}
    // a request written in the «Generador de prompts» arrives already typed (the customer still sends it)
    try { const p = sessionStorage.getItem("creads-prompt"); if (p) { setText(p); sessionStorage.removeItem("creads-prompt"); } } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(KEY, JSON.stringify({ history: history.slice(-60), ads })); } catch {}
  }, [history, ads]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [history.length, busy, ads]);
  // back from Mercado Pago with the trial on: the conversation picks up where it stopped (the chosen script)
  const [seguir, setSeguir] = useState(false);
  useEffect(() => {
    const on = () => setSeguir(true);
    window.addEventListener("creads:prueba-ok", on);
    return () => window.removeEventListener("creads:prueba-ok", on);
  }, []);
  useEffect(() => {
    if (!seguir || busy || !history.length) return;
    setSeguir(false);
    send("Listo, ya activé mi prueba gratis. Sigamos con mi anuncio.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seguir, busy, history.length]);

  async function send(content: string, base = history) {
    if (!content.trim() || busy) return;
    const next: Msg[] = [...base, { role: "user", content: content.trim() }];
    setHistory(next); setText(""); setBusy(true); setErr("");
    const res = await fetch("/api/asistente-anuncios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    refreshCredits(); // images and ads made in this turn spent credits: the balance (and the credits pop-up) follow
    if (Array.isArray(d.messages) && d.messages.length) setHistory([...next, ...d.messages]);
    if (d.ui?.tarjeta) window.dispatchEvent(new Event("creads:prueba"));
    if (Array.isArray(d.ui?.ads) && d.ui.ads.length) setAds((a) => [...a, ...d.ui.ads.filter((id: string) => !a.some((x) => x.id === id)).map((id: string) => ({ id, estado: "cola" }))]);
    if (!res || !res.ok) setErr(d.error || "No pude responder. Revisa tu conexión e intenta de nuevo.");
  }

  // each ad in production moves forward while it's asked about; when it's ready, the assistant reviews it
  useEffect(() => {
    const open = ads.filter((a) => a.estado !== "listo" && a.estado !== "error");
    if (!open.length) return;
    const t = setInterval(async () => {
      for (const a of open) {
        const r = await fetch(`/api/v1/anuncios/${a.id}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
        if (r?.anuncio) setAds((all) => all.map((x) => (x.id === a.id ? { ...x, ...r.anuncio } : x)));
      }
    }, 10_000);
    return () => clearInterval(t);
  }, [ads]);
  useEffect(() => {
    const ready = ads.find((a) => (a.estado === "listo" || a.estado === "error") && !a.told);
    if (!ready || busy) return;
    setAds((all) => all.map((x) => (x.id === ready.id ? { ...x, told: true } : x)));
    send(ready.estado === "listo" ? `[El anuncio ${ready.id} está listo. Revísalo con creads_revisar_anuncio antes de mostrármelo.]` : `[El anuncio ${ready.id} no se pudo terminar: ${ready.error ?? "error"}.]`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ads, busy]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setUploading(true); setErr("");
    try {
      const url = await uploadFile(f);
      await send(f.type.startsWith("video/") ? `Te subo un video de la persona hablando a cámara (tengo su permiso): ${url}` : `Te subo una foto: ${url}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo subir."); }
    finally { setUploading(false); }
  }

  function restart() {
    if (busy) return;
    setHistory([]); setAds([]); setErr("");
    try { localStorage.removeItem(KEY); } catch {}
  }

  // what the customer sees: their words, the assistant's words, the pictures and what it's doing
  const rows: React.ReactNode[] = [];
  history.forEach((m, i) => {
    if (typeof m.content === "string") {
      if (m.role === "user" && !notice(m.content)) {
        const refs = m.content.match(REF) ?? [];
        const words = m.content.replace(REF, "").replace(/:\s*$/, "").trim();
        rows.push(
          <div key={i} className="ml-auto flex max-w-[85%] flex-col items-end gap-2">
            {words && <p className="rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] text-bg">{words}</p>}
            {refs.map((r) => (/\.(mp4|mov|webm)$/i.test(r)
              ? <video key={r} src={r} controls playsInline className="max-h-64 rounded-xl" />
              // eslint-disable-next-line @next/next/no-img-element
              : <img key={r} src={r} alt="Lo que subiste" className="max-h-64 rounded-xl object-cover" />))}
          </div>,
        );
      }
      return;
    }
    for (const [k, b] of m.content.entries()) {
      const key = `${i}-${k}`;
      if (b.type === "text" && b.text?.trim()) {
        rows.push(<p key={key} className="max-w-[90%] whitespace-pre-wrap rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] leading-relaxed">{b.text.trim()}</p>);
      } else if (b.type === "tool_use") {
        rows.push(<span key={key} className="flex w-fit items-center gap-2 rounded-full border border-line px-3 py-1 text-xs text-muted"><span aria-hidden="true">⚙︎</span>{TOOL_LABEL[b.name ?? ""] ?? "Trabajando"}</span>);
      } else if (b.type === "tool_result" && typeof b.content === "string") {
        const imgs = (b.content.match(REF) ?? []).filter((r) => /\.(png|jpe?g|webp)$/i.test(r));
        if (imgs.length) rows.push(
          <div key={key} className="flex flex-wrap gap-2">
            {imgs.map((r) => (
              <figure key={r} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r} alt="Imagen de Creads" className="max-h-80 rounded-xl border border-line object-cover" />
                <a href={dl(r)} download target="_blank" rel="noopener noreferrer" className="w-fit text-xs font-semibold text-muted underline hover:text-ink">Descargar</a>
              </figure>
            ))}
          </div>,
        );
      }
    }
  });

  const empty = history.length === 0;
  return (
    <div className="flex flex-col gap-4">
      <section className={`${cardCls} min-h-[38vh] sm:min-h-[60vh]`} aria-label="Conversación">
        {empty ? (
          <div className="flex flex-1 flex-col items-start justify-start gap-3 py-2 sm:justify-center sm:gap-4 sm:py-6">
            <span className="flex items-center gap-2 text-xs font-semibold text-muted">
              <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-[image:var(--grad)] text-sm text-white">✦</span>
              Creads · Automático
            </span>
            <h2 className="font-display text-xl leading-tight font-semibold sm:text-2xl">Cuéntame de tu negocio y yo hago el anuncio.</h2>
            <p className="max-w-[56ch] text-[15px] leading-snug text-muted sm:text-base">Te pregunto lo justo, te propongo el guion, creo a la persona, hago el video, lo reviso y te lo entrego listo. Tú solo apruebas.</p>
            <div data-tour="auto-ideas" className="scroll-row -mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0">
              {[START, "Quiero un anuncio con mi propia cara", "Tengo una clínica y quiero que agenden horas", "Vendo productos y quiero más ventas"].map((x) => (
                <button key={x} type="button" onClick={() => send(x)} className="shrink-0 rounded-full border border-line px-3.5 py-2 text-sm hover:border-accent-text">{x}</button>
              ))}
            </div>
            <Link href="/app/crear" className="text-xs font-semibold text-muted underline sm:hidden">Prefiero hacerlo paso a paso (Manual)</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">{rows}</div>
        )}

        {ads.map((a) => (
          <div key={a.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
            <span className="text-sm font-semibold">{a.estado === "listo" ? "✓ Tu anuncio" : a.estado === "error" ? "No se pudo terminar" : "Haciendo tu anuncio…"}</span>
            {a.estado === "listo" && a.video_url ? (
              <>
                <video key={a.video_url} src={a.video_url} controls playsInline className="max-h-[70vh] w-full max-w-xs rounded-xl bg-black" />
                <div className="flex flex-wrap gap-2"><a href={dl(a.video_url)} download target="_blank" rel="noopener noreferrer" className={`${ghostCls} w-fit`}>Descargar</a>{a.estudio_id && <a href={`/app/editor/${a.estudio_id}`} className={`${ghostCls} w-fit`}>🎬 Editar video</a>}</div>
                <FixSubtitles id={a.id} onDone={(url) => setAds((all) => all.map((x) => (x.id === a.id ? { ...x, video_url: url } : x)))} />
                <AfterFirstAd />
              </>
            ) : a.estado !== "error" ? (
              <Progreso estado={a.estado} paso={a.paso} />
            ) : <span className="text-xs text-bad">{a.error}</span>}
          </div>
        ))}

        {busy && <span className="w-fit rounded-full bg-surface-2 px-3 py-1.5 text-sm text-muted">Pensando…</span>}
        {err && <p className="text-sm text-bad">{err}</p>}
        <div ref={end} />
      </section>

      <form data-tour="auto-chat" onSubmit={(e) => { e.preventDefault(); send(text); }} className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] z-20 flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-lg lg:bottom-3">
        <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-line text-lg sm:h-10 sm:w-10" title="Subir una foto o un video" aria-label="Subir una foto o un video">
          {uploading ? "Subiendo…" : "📎"}
          <input type="file" accept="image/png,image/jpeg,image/webp,video/*" className="sr-only" disabled={uploading || busy} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder={empty ? "Ej: Tengo una cafetería" : "Escribe tu respuesta…"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
          className={`${inputCls} max-h-40 min-h-11 flex-1 resize-none py-2.5 text-[15px] sm:min-h-10`} aria-label="Tu mensaje" />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Enviar" className="grid h-11 shrink-0 place-items-center rounded-xl bg-[image:var(--grad)] px-4 text-sm font-semibold text-white disabled:opacity-50 sm:h-10">Enviar</button>
      </form>
      {!empty && <button type="button" onClick={restart} disabled={busy} className="w-fit text-xs text-muted underline">Empezar un anuncio nuevo</button>}
    </div>
  );
}

/** «¿Una palabra mal escrita en los subtítulos?»: fix it on a finished ad (free; the video is built again in 1–3 min). */
function FixSubtitles({ id, onDone }: { id: string; onDone: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const [de, setDe] = useState("");
  const [a, setA] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!de.trim() || busy) return;
    setBusy(true); setMsg("");
    const r = await fetch(`/api/v1/anuncios/${id}/subtitulos`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cambios: [{ de: de.trim(), a: a.trim() }] }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (r?.ok && d.anuncio?.video_url) { onDone(d.anuncio.video_url); setMsg("Listo: el video ya tiene los subtítulos corregidos."); setDe(""); setA(""); }
    else setMsg(d.error || "No se pudo corregir. Intenta de nuevo.");
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="w-fit text-xs text-muted underline hover:text-ink">¿Una palabra mal escrita en los subtítulos?</button>;
  return (
    <form onSubmit={go} className="flex max-w-xs flex-col gap-2 rounded-xl border border-line p-2.5 text-sm">
      <span className="text-xs text-muted">Escribe la palabra como aparece y cómo debería decir. Es gratis: se arma de nuevo el mismo video en 1 a 3 minutos.</span>
      <input value={de} onChange={(e) => setDe(e.target.value)} placeholder="Dice: CREATZIA.COM" className={inputCls} aria-label="Cómo aparece" />
      <input value={a} onChange={(e) => setA(e.target.value)} placeholder="Debe decir: creadsia.com" className={inputCls} aria-label="Cómo debería decir" />
      <button type="submit" disabled={busy || !de.trim()} className="rounded-lg bg-ink px-3 py-1.5 font-semibold text-bg disabled:opacity-50">{busy ? "Corrigiendo… (1 a 3 min)" : "Corregir subtítulos"}</button>
      {msg && <span className="text-xs text-muted">{msg}</span>}
    </form>
  );
}

/** Under a finished ad, for accounts without a plan: the moment they like it, one tap to keep going. */
function AfterFirstAd() {
  const { info } = useCredits();
  const [going, setGoing] = useState("");
  if (!info || info.unlimited || info.owner || (info.paidUntil && !info.expired)) return null;
  const go = async (item: string) => { setGoing(item); await buyNow(item); };
  // the plans on sale (Testea and the highlighted Escala), never the retired Básico/Emprende
  const top = SHOWN_PLANS.find((p) => p.featured) ?? SHOWN_PLANS[0];
  const base = [...SHOWN_PLANS].sort((a, b) => a.monthly - b.monthly)[0];
  return (
    <div className="relative mt-1 flex flex-col gap-3 overflow-hidden rounded-2xl border-2 border-transparent p-4 [background:linear-gradient(var(--color-surface),var(--color-surface))_padding-box,var(--grad)_border-box]">
      <div className="flex flex-col gap-0.5">
        <b className="font-display text-lg leading-tight">¿Te gustó? Haz uno así cada semana.</b>
        <span className="text-sm text-muted">Con {top.name} tienes hasta {top.videos} videos con avatar o {top.imagenes} imágenes al mes, sin agencia y sin grabar. Cancelas cuando quieras.</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" onClick={() => go(top.id)} disabled={Boolean(going)} className="rounded-xl bg-[image:var(--grad)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{going === top.id ? "Abriendo el pago…" : <MoneyText text={`Quiero ${top.name} · US$${top.monthly}/mes`} />}</button>
        {base.id !== top.id && <button type="button" onClick={() => go(base.id)} disabled={Boolean(going)} className="rounded-xl border border-line px-4 py-3 text-sm font-semibold disabled:opacity-60">{going === base.id ? "Abriendo el pago…" : <MoneyText text={`${base.name} · US$${base.monthly}/mes`} />}</button>}
      </div>
      <button type="button" onClick={openUpgrade} className="w-fit text-xs font-semibold text-muted underline">Ver todas las opciones</button>
    </div>
  );
}

// the ad being made, step by step (owner, 25 Oct 2026: the customer sees it move and knows it's not stuck)
const PASOS: [string, string[]][] = [
  ["Guion y escenas", ["cola", "escenas"]],
  ["Grabando a tu persona", ["generando"]],
  ["Revisión de calidad", ["revisando"]],
  ["Edición y subtítulos", ["armando"]],
];
function Progreso({ estado, paso }: { estado: string; paso?: string | null }) {
  const at = Math.max(0, PASOS.findIndex(([, e]) => e.includes(estado)));
  const pct = Math.round(((at + 0.5) / (PASOS.length + 0.5)) * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance del anuncio">
        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: "var(--grad)" }} />
      </div>
      <ol className="flex flex-col gap-1 text-xs">
        {PASOS.map(([label], i) => (
          <li key={label} className={`flex items-center gap-2 ${i < at ? "text-good" : i === at ? "font-semibold text-ink" : "text-muted"}`}>
            <span aria-hidden="true" className="w-4 text-center">{i < at ? "✓" : i === at ? "●" : "○"}</span>
            {label}{i === at && paso && !/^En cola$/.test(paso) ? <span className="font-normal text-muted"> · {paso}</span> : null}
          </li>
        ))}
      </ol>
      <span className="text-xs text-muted">Tarda unos 6 a 8 minutos. Puedes cerrar esta página: te avisamos por correo cuando esté listo, ya revisado.</span>
    </div>
  );
}
