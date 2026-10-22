"use client";

import { useEffect, useRef, useState } from "react";
import { cardCls, ghostCls, inputCls, uploadFile } from "../_parts/ui";

// «Automático»: the customer talks with the Creads assistant (Claude + the Creads tools + the RECETA). The
// page keeps the conversation (in this browser), shows the pictures it makes, follows each ad until it's
// ready, then tells the assistant so it reviews it and hands it over.

type Block = { type: string; text?: string; name?: string; content?: unknown; is_error?: boolean; id?: string; tool_use_id?: string; input?: unknown };
type Msg = { role: "user" | "assistant"; content: string | Block[] };
interface Ad { id: string; estado: string; paso?: string | null; video_url?: string | null; error?: string | null; told?: boolean }

const KEY = "creads-automatico";
const REF = /\/api\/media\/ws\/[\w-]+\/[\w./-]+\.(?:png|jpe?g|webp|mp4|mov|webm)/gi;
const START = "Hola, quiero hacer un anuncio.";
const TOOL_LABEL: Record<string, string> = {
  creads_crear_imagen: "Creando la foto de la persona",
  creads_crear_avatar: "Guardando a la persona",
  creads_crear_anuncio: "Haciendo el anuncio",
  creads_revisar_anuncio: "Revisando el video: escucho cada palabra y miro cada escena",
  creads_montar_demo: "Armando el video final con todos los clips",
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
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(KEY, JSON.stringify({ history: history.slice(-60), ads })); } catch {}
  }, [history, ads]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [history.length, busy, ads]);

  async function send(content: string, base = history) {
    if (!content.trim() || busy) return;
    const next: Msg[] = [...base, { role: "user", content: content.trim() }];
    setHistory(next); setText(""); setBusy(true); setErr("");
    const res = await fetch("/api/asistente-anuncios", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (Array.isArray(d.messages) && d.messages.length) setHistory([...next, ...d.messages]);
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
    }, 20_000);
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {imgs.map((r) => <img key={r} src={r} alt="Imagen de Creads" className="max-h-80 rounded-xl border border-line object-cover" />)}
          </div>,
        );
      }
    }
  });

  const empty = history.length === 0;
  return (
    <div className="flex flex-col gap-4">
      <section className={`${cardCls} min-h-[60vh]`} aria-label="Conversación">
        {empty ? (
          <div className="flex flex-1 flex-col items-start justify-center gap-4 py-6">
            <h2 className="font-display text-2xl font-semibold">Cuéntame de tu negocio y yo hago el anuncio.</h2>
            <p className="max-w-[56ch] text-muted">Te hago unas preguntas, te propongo el guion, creo a la persona en tu negocio, hago el video, lo reviso palabra por palabra y te lo entrego listo para publicar. Tú solo apruebas.</p>
            <div className="flex flex-wrap gap-2">
              {[START, "Quiero un anuncio con mi propia cara", "Tengo una clínica y quiero que agenden horas", "Vendo productos y quiero más ventas"].map((x) => (
                <button key={x} type="button" onClick={() => send(x)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent-text">{x}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">{rows}</div>
        )}

        {ads.map((a) => (
          <div key={a.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
            <span className="text-sm font-semibold">{a.estado === "listo" ? "✓ Tu anuncio" : a.estado === "error" ? "No se pudo terminar" : "Haciendo tu anuncio…"}</span>
            {a.estado === "listo" && a.video_url ? (
              <>
                <video src={a.video_url} controls playsInline className="max-h-[70vh] w-full max-w-xs rounded-xl bg-black" />
                <a href={a.video_url} download className={`${ghostCls} w-fit`}>Descargar</a>
              </>
            ) : a.estado !== "error" ? (
              <span className="text-xs text-muted">{a.paso ?? "En cola"} · tarda unos 6 a 8 minutos. Te aviso aquí mismo cuando esté y lo reviso antes de mostrártelo.</span>
            ) : <span className="text-xs text-bad">{a.error}</span>}
          </div>
        ))}

        {busy && <span className="w-fit rounded-full bg-surface-2 px-3 py-1.5 text-sm text-muted">Pensando…</span>}
        {err && <p className="text-sm text-bad">{err}</p>}
        <div ref={end} />
      </section>

      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="sticky bottom-3 flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-lg">
        <label className={`${ghostCls} cursor-pointer`} title="Subir una foto o un video">
          {uploading ? "Subiendo…" : "📎"}
          <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime" className="sr-only" disabled={uploading || busy} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder={empty ? "Ej: Tengo una cafetería en Ñuñoa y quiero más clientes" : "Escribe tu respuesta…"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
          className={`${inputCls} max-h-40 flex-1 resize-none text-[15px]`} aria-label="Tu mensaje" />
        <button type="submit" disabled={busy || !text.trim()} className="rounded-lg bg-[image:var(--grad)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Enviar</button>
      </form>
      {!empty && <button type="button" onClick={restart} disabled={busy} className="w-fit text-xs text-muted underline">Empezar un anuncio nuevo</button>}
    </div>
  );
}
