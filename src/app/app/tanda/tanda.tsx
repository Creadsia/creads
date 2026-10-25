"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHead, Spinner, btnCls, cardCls, ghostCls, inputCls, dl } from "../_parts/ui";
import { refreshCredits, useCredits } from "../_parts/use-credits";
import { capture } from "../../posthog";
import { IDEAS, type Idea } from "@/lib/ideas";
import { TIPO_LABEL, type Angulo, type Pieza, type Producto, type Tanda, type TipoAngulo } from "@/lib/tanda-tipos";
import { RUBRO_INFO, type Rubro, esRubro } from "@/lib/hooks-biblioteca";
import CasoFundadorCheck from "../_parts/caso-fundador";

// «Primera tanda»: link of the product → 6 selling angles → 10 ad images, each in 4:5 and 9:16, ZIP by placement.

const MODEL = "nano-banana-2";
const MODEL_USD = 0.08;
const H = { "content-type": "application/json" };

const TIPO_HINT: Record<TipoAngulo, string> = {
  dolor: "El problema que le quitas",
  deseo: "Lo que tu cliente quiere lograr",
  mecanismo: "Por qué funciona distinto",
  prueba_social: "Lo que hacen o dicen otros compradores",
  creencia: "La idea equivocada que frena la compra",
  oferta: "Precio, regalo, envío o garantía",
};

type Paso = "link" | "angulos" | "tanda";

async function post<T>(body: unknown): Promise<T> {
  const r = await fetch("/api/tanda", { method: "POST", headers: H, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Algo falló. Intenta de nuevo.");
  return d as T;
}

export default function PrimeraTanda() {
  const [paso, setPaso] = useState<Paso>("link");
  const [url, setUrl] = useState("");
  const [sinLink, setSinLink] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [idioma, setIdioma] = useState<"es" | "en">("es");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [producto, setProducto] = useState<Producto | null>(null);
  const [angulos, setAngulos] = useState<Angulo[]>([]);
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [tanda, setTanda] = useState<Tanda | null>(null);
  const [estado, setEstado] = useState<Record<string, "esperando" | "creando" | "listo" | "error">>({});
  const [anteriores, setAnteriores] = useState<Tanda[]>([]);
  const [rubro, setRubro] = useState<Rubro | null>(null);
  const [idea, setIdea] = useState<Idea | null>(null);
  const { price, covers, info } = useCredits();
  const [pagando, setPagando] = useState(false);
  const [casoFundador, setCasoFundador] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("id");
    // back from paying the Pack Prueba: confirm the payment, then the batch can be made
    const pedido = q.get("pedido");
    if (q.get("pago") === "volver" && pedido) {
      fetch("/api/pagos/confirmar", { method: "POST", headers: H, body: JSON.stringify({ pedido, payment_id: q.get("payment_id") ?? q.get("collection_id") }) })
        .then(() => refreshCredits()).catch(() => {});
      window.history.replaceState(null, "", id ? `/app/tanda?id=${id}` : "/app/tanda");
    }
    const u = q.get("url");
    const ideaId = q.get("idea");
    if (ideaId) setIdea(IDEAS.find((i) => i.id === ideaId) ?? null);
    if (u && /^https?:\/\//i.test(u)) setUrl(u.slice(0, 600));
    const r = q.get("rubro"); // from «Hooks por rubro»: hints the angles and the example description
    if (esRubro(r)) setRubro(r);
    fetch(`/api/tanda${id ? `?id=${encodeURIComponent(id)}` : ""}`).then((r) => r.json()).then((d) => {
      if (d?.tanda) { setTanda(d.tanda); setPaso("tanda"); }
      if (Array.isArray(d?.tandas)) setAnteriores(d.tandas);
    }).catch(() => {});
  }, []);

  async function leer(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(""); setBusy("Leyendo tu página y pensando ángulos de venta…");
    try {
      const d = await post<{ producto: Producto; angulos: Angulo[] }>({ accion: "leer", ...(sinLink ? { descripcion } : { url }), idioma, ...(rubro ? { rubro } : {}) });
      capture("tanda_angulos_propuestos", { con_link: !sinLink, idioma });
      setProducto(d.producto); setAngulos(d.angulos); setElegidos(new Set(d.angulos.map((_, i) => i))); setPaso("angulos");
    } catch (e) { setErr(e instanceof Error ? e.message : "No pudimos leer tu producto."); }
    finally { setBusy(""); }
  }

  const key = (n: number, f: "4:5" | "9:16") => `${n}-${f}`;

  async function generar(t: Tanda, solo?: { n: number; f: "4:5" | "9:16" }[]) {
    const jobs = solo ?? t.piezas.flatMap((p) => (["4:5", "9:16"] as const).filter((f) => !(f === "4:5" ? p.f45 : p.f916)).map((f) => ({ n: p.n, f })));
    setEstado((s) => ({ ...s, ...Object.fromEntries(jobs.map((j) => [key(j.n, j.f), "esperando" as const])) }));
    let next = 0;
    let sinSaldo = false;
    const worker = async () => {
      while (next < jobs.length && !sinSaldo) {
        const j = jobs[next++];
        const p = t.piezas.find((x) => x.n === j.n)!;
        setEstado((s) => ({ ...s, [key(j.n, j.f)]: "creando" }));
        try {
          const r = await fetch("/api/generate/image", { method: "POST", headers: H, body: JSON.stringify({ prompt: p.prompt, aspect: j.f, model: MODEL, refs: t.producto.foto ? [{ url: t.producto.foto, role: "product" }] : [] }) });
          const d = await r.json().catch(() => ({}));
          if (r.status === 402) sinSaldo = true;
          if (!r.ok) throw new Error(d.error || "No se pudo crear esta imagen. No se usó tu saldo.");
          refreshCredits();
          const saved = await post<{ url: string; tanda: Tanda | null }>({ accion: "pieza", id: t.id, n: j.n, formato: j.f, url: d.url });
          if (saved.tanda) setTanda(saved.tanda);
          setEstado((s) => ({ ...s, [key(j.n, j.f)]: "listo" }));
          // quick quality look (text spelled right, no glitches): only a note, the customer decides
          fetch("/api/imagenes", { method: "POST", headers: H, body: JSON.stringify({ accion: "revisar", url: saved.url ?? d.url, prompt: p.prompt }) })
            .then((x) => x.json()).then((q) => { if (q?.ok === false && q.nota) post<{ tanda: Tanda | null }>({ accion: "pieza", id: t.id, n: j.n, formato: j.f, nota: q.nota }).then((o) => o.tanda && setTanda(o.tanda)); }).catch(() => {});
        } catch (e) {
          setEstado((s) => ({ ...s, [key(j.n, j.f)]: "error" }));
          const msg = e instanceof Error ? e.message : "No se pudo crear.";
          post<{ tanda: Tanda | null }>({ accion: "pieza", id: t.id, n: j.n, formato: j.f, error: msg }).then((o) => o.tanda && setTanda(o.tanda)).catch(() => {});
          if (sinSaldo) setErr(msg);
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
  }

  /** No balance yet: the batch is saved first (free), then the Pack Prueba is paid and the customer comes back to it. */
  async function comprarPack(t: Tanda) {
    setPagando(true); setErr("");
    try {
      const r = await fetch("/api/pagos", { method: "POST", headers: H, body: JSON.stringify({ item: "pack-prueba", method: "mercadopago", volver: `/app/tanda?id=${t.id}`, casoFundador }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo preparar el pago.");
      capture("pack_checkout", { desde: "tanda" });
      if (d.redirect) { window.location.href = d.redirect; return; }
      setErr("El pago en línea no está activo todavía. Escríbenos a hola@creadsia.com y te activamos el pack.");
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo preparar el pago."); }
    setPagando(false);
  }
  const alcanza = covers(MODEL_USD * 20);

  async function crear() {
    if (!producto) return;
    setErr(""); setBusy("Escribiendo tus 10 anuncios…");
    try {
      const d = await post<{ tanda: Tanda }>({ accion: "crear", producto, angulos: angulos.filter((_, i) => elegidos.has(i)), idioma, n: 10, ...(idea ? { idea: idea.id } : {}) });
      capture("tanda_creada", { angulos: elegidos.size, alcanza });
      setTanda(d.tanda); setPaso("tanda"); setBusy("");
      window.history.replaceState(null, "", `/app/tanda?id=${d.tanda.id}`);
      if (!alcanza) return comprarPack(d.tanda);
      await generar(d.tanda);
    } catch (e) { setErr(e instanceof Error ? e.message : "No pudimos crear la tanda."); setBusy(""); }
  }

  /** «Haz 10 variaciones de este»: a new batch around a winner (writing them is free; the images use balance). */
  async function variar(t: Tanda, n: number) {
    setErr(""); setBusy("Escribiendo 10 variaciones del ganador…");
    try {
      const d = await post<{ tanda: Tanda }>({ accion: "variar", id: t.id, n, cuantas: 10 });
      capture("tanda_variaciones", { desde: t.id });
      setTanda(d.tanda); setEstado({}); setBusy("");
      window.history.replaceState(null, "", `/app/tanda?id=${d.tanda.id}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (!covers(MODEL_USD * 2)) return comprarPack(d.tanda);
      await generar(d.tanda);
    } catch (e) { setErr(e instanceof Error ? e.message : "No pudimos crear las variaciones."); setBusy(""); }
  }

  /** «Video de producto»: a 6 s premium clip of the product with the headline, from this piece. */
  async function video(t: Tanda, n: number) {
    setErr("");
    try {
      const r = await fetch("/api/tanda/video", { method: "POST", headers: H, body: JSON.stringify({ id: t.id, n }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo empezar el video.");
      capture("tanda_video", { n });
      refreshCredits();
      if (d.tanda) setTanda(d.tanda);
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo empezar el video."); }
  }
  // videos in progress: check every 8 s until they're ready
  useEffect(() => {
    if (!tanda) return;
    const pend = tanda.piezas.filter((p) => p.video?.estado === "creando");
    if (!pend.length) return;
    const id = tanda.id;
    const timer = setTimeout(async () => {
      for (const p of pend) {
        const d = await fetch(`/api/tanda/video?id=${id}&n=${p.n}`).then((r) => r.json()).catch(() => null);
        if (d?.tanda) setTanda(d.tanda);
        if (d?.video?.estado === "error") refreshCredits();
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [tanda]);

  const listos = tanda ? tanda.piezas.reduce((a, p) => a + (p.f45 ? 1 : 0) + (p.f916 ? 1 : 0), 0) : 0;
  const total = tanda ? tanda.piezas.length * 2 : 0;
  const corriendo = Object.values(estado).some((v) => v === "creando" || v === "esperando");

  return (
    <>
      <PageHead title="Tu primera tanda" lead="Pega el link de tu producto. Creads lee tu página, te propone 6 ángulos de venta y crea 10 anuncios listos para Meta: cada uno en 4:5 para el feed y 9:16 para stories y reels." />

      <ol className="flex flex-wrap gap-2 text-xs font-semibold" aria-label="Pasos">
        {(["link", "angulos", "tanda"] as const).map((p, i) => (
          <li key={p} className={`rounded-full border px-3 py-1 ${paso === p ? "border-accent text-ink" : "border-line text-muted"}`}>{i + 1}. {p === "link" ? "Tu producto" : p === "angulos" ? "Ángulos" : "Tus 10 anuncios"}</li>
        ))}
      </ol>

      {err && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>}

      {idea && paso !== "tanda" && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm">
          Formato elegido: <b>{idea.tipo}</b>. Tu tanda lo va a usar en la mayoría de los anuncios.
          <button type="button" onClick={() => setIdea(null)} className="text-xs text-muted underline">Quitar</button>
        </p>
      )}
      {paso === "link" && (
        <form onSubmit={leer} className={cardCls}>
          {!sinLink ? (
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Link de tu producto o tu tienda
              <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://tutienda.com/producto" className={`${inputCls} text-base`} autoFocus />
            </label>
          ) : (
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              ¿Qué vendes y a quién?
              <textarea required minLength={15} rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder={rubro ? RUBRO_INFO[rubro].ejemplo : "Ej: Faja postparto de algodón para mamás que quieren volver a su ropa sin dolor. Cuesta $24.990 con envío gratis."} className={inputCls} />
            </label>
          )}
          {rubro && (
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-full border border-line px-2.5 py-1 font-semibold text-ink">Rubro: {RUBRO_INFO[rubro].label.es}</span>
              Los ángulos se van a pensar para este rubro.
              <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => setRubro(null)}>Quitar</button>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button type="button" className="text-muted underline underline-offset-2 hover:text-ink" onClick={() => setSinLink(!sinLink)}>{sinLink ? "Tengo un link" : "No tengo página: lo describo"}</button>
            <span className="text-muted">·</span>
            <label className="flex items-center gap-2 text-muted">Idioma de los anuncios
              <select value={idioma} onChange={(e) => setIdioma(e.target.value === "en" ? "en" : "es")} className={inputCls}>
                <option value="es">Español</option><option value="en">Inglés (EE.UU.)</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={Boolean(busy)} className={btnCls}>{busy ? "Leyendo…" : "Proponer ángulos"}</button>
            {busy && <span className="flex items-center gap-2 text-sm text-muted"><Spinner /> {busy}</span>}
          </div>
          <p className="text-xs text-muted">Leer tu página y proponer ángulos no usa tu saldo. ¿Quieres tu logo y colores en los anuncios? <Link href="/app/marca" className="underline">Carga tu kit de marca</Link>.</p>
        </form>
      )}

      {paso === "angulos" && producto && (
        <div className="flex flex-col gap-4">
          <div className={`${cardCls} md:flex-row md:items-center`}>
            {producto.foto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={producto.foto} alt={producto.nombre} className="h-24 w-24 shrink-0 rounded-xl border border-line object-contain" />
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <input value={producto.nombre} onChange={(e) => setProducto({ ...producto, nombre: e.target.value })} className="bg-transparent font-display text-lg font-bold outline-none" aria-label="Nombre del producto" />
              <textarea value={producto.descripcion} onChange={(e) => setProducto({ ...producto, descripcion: e.target.value })} rows={2} className="resize-none bg-transparent text-sm text-muted outline-none" aria-label="Descripción" />
              {producto.precio && <span className="text-sm font-semibold">{producto.precio}</span>}
              {!producto.foto && <span className="text-xs text-muted">No encontramos una foto del producto: los anuncios lo van a dibujar según la descripción. Puedes subir la foto en <Link href="/app/marca" className="underline">tu kit de marca</Link>.</span>}
            </div>
          </div>

          <p className="text-sm text-muted">Elige los ángulos que quieres testear. Los 10 anuncios se reparten entre los que marques.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {angulos.map((a, i) => {
              const on = elegidos.has(i);
              return (
                <button key={i} type="button" aria-pressed={on} onClick={() => setElegidos((s) => { const x = new Set(s); if (x.has(i)) x.delete(i); else x.add(i); return x; })}
                  className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition-colors ${on ? "border-accent bg-surface-2" : "border-line bg-surface opacity-70 hover:opacity-100"}`}>
                  <span className="flex items-center justify-between gap-2 text-xs font-semibold text-muted">{TIPO_LABEL[a.tipo]} <span aria-hidden>{on ? "✓" : ""}</span></span>
                  <span className="font-display font-bold leading-snug">«{a.gancho}»</span>
                  <span className="text-sm text-muted">{a.titulo}. {a.por_que}</span>
                  <span className="text-xs text-muted">{TIPO_HINT[a.tipo]}</span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={crear} disabled={!elegidos.size || Boolean(busy) || pagando} className={btnCls}>{alcanza ? "Crear mis 10 anuncios" : "Crear mis 10 anuncios por US$9"}</button>
            <button type="button" onClick={() => setPaso("link")} className={ghostCls}>Volver</button>
            {busy ? <span className="flex items-center gap-2 text-sm text-muted"><Spinner /> {busy}</span>
              : alcanza ? <span className="text-xs text-muted">Usa {price(MODEL_USD * 20, "imagen")} de tu saldo (10 anuncios en 2 formatos). Si una imagen falla, no se cobra.</span>
              : <span className="text-xs text-muted">Pack Prueba: pago único de US$9, hasta 12 imágenes o 1 video. Si te suscribes dentro de 7 días, se descuenta de tu primer mes.</span>}
          </div>
          {!alcanza && <CasoFundadorCheck checked={casoFundador} onChange={setCasoFundador} className="max-w-xl" />}
        </div>
      )}

      {paso === "tanda" && tanda && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{tanda.producto.nombre}{tanda.origen ? ` · variaciones del anuncio #${tanda.origen.n}` : ""} · {listos} de {total} imágenes listas{corriendo ? " · creando…" : ""}{busy ? ` · ${busy}` : ""}</p>
            <div className="flex flex-wrap gap-2">
              {!corriendo && listos < total && (info && !covers(MODEL_USD * 2)
                ? <button type="button" onClick={() => comprarPack(tanda)} disabled={pagando} className={btnCls}>{pagando ? "Abriendo pago…" : "Crear por US$9 (Pack Prueba)"}</button>
                : <button type="button" onClick={() => generar(tanda)} className={ghostCls}>Crear las que faltan</button>)}
              <a href={`/api/tanda/zip?id=${tanda.id}`} onClick={() => capture("tanda_zip", { imagenes: listos })} className={`${btnCls} ${listos ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!listos}>Descargar ZIP (feed 4:5 + stories 9:16)</a>
              <a href={`/api/tanda/meta?id=${tanda.id}`} className={`${ghostCls} ${listos ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!listos} title="Para importar en el Administrador de anuncios de Meta: todo parte en pausa">Descargar archivo para Meta (CSV)</a>
            </div>
          </div>
          {!corriendo && listos < total && info && !covers(MODEL_USD * 2) && <CasoFundadorCheck checked={casoFundador} onChange={setCasoFundador} className="max-w-xl" />}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tanda.piezas.map((p) => <PiezaCard key={p.n} p={p} estado={estado} onRetry={(f) => generar(tanda, [{ n: p.n, f }])}
              onGanador={() => post<{ tanda: Tanda | null }>({ accion: "pieza", id: tanda.id, n: p.n, formato: "4:5", ganador: !p.ganador }).then((o) => o.tanda && setTanda(o.tanda)).catch(() => {})}
              onVariar={() => variar(tanda, p.n)} busy={Boolean(busy)} onVideo={() => video(tanda, p.n)} />)}
          </div>
          <p className="text-xs text-muted">Siguiente paso: sube la carpeta feed-4x5 a los anuncios de feed y stories-reels-9x16 a los de stories y reels. Testea todos con el mismo presupuesto y quédate con los 2 o 3 que mejor venden. ¿Quieres ahorrarte armar los anuncios uno por uno? Sube las imágenes a la biblioteca de tu cuenta publicitaria e importa el archivo para Meta (Exportar e importar → Importar anuncios en bloque): se crean en pausa, con el mismo nombre de cada imagen. El ZIP trae un LEEME con los pasos.</p>
          <button type="button" onClick={() => { setTanda(null); setPaso("link"); window.history.replaceState(null, "", "/app/tanda"); }} className={`${ghostCls} self-start`}>Hacer otra tanda</button>
        </div>
      )}

      {paso === "link" && anteriores.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">Tus tandas</h2>
          <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
            {anteriores.map((t) => (
              <li key={t.id}>
                <a href={`/app/tanda?id=${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                  <span className="truncate">{t.producto.nombre}</span>
                  <span className="shrink-0 text-xs text-muted">{new Date(t.createdAt).toLocaleDateString("es-CL")} · {t.piezas.reduce((a, p) => a + (p.f45 ? 1 : 0) + (p.f916 ? 1 : 0), 0)} imágenes</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function PiezaCard({ p, estado, onRetry, onGanador, onVariar, busy, onVideo }: { p: Pieza; estado: Record<string, string>; onRetry: (f: "4:5" | "9:16") => void; onGanador: () => void; onVariar: () => void; busy: boolean; onVideo: () => void }) {
  const lista = Boolean(p.f45 || p.f916);
  return (
    <article className={`flex flex-col gap-3 rounded-2xl border bg-surface p-3 ${p.ganador ? "border-good" : "border-line"}`}>
      <header className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted">#{p.n} · {TIPO_LABEL[p.tipo]}</span>
        {lista && <button type="button" onClick={onGanador} aria-pressed={Boolean(p.ganador)} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.ganador ? "bg-good/15 text-good" : "border border-line text-muted hover:text-ink"}`}>{p.ganador ? "★ Ganador" : "☆ Marcar ganador"}</button>}
      </header>
      <p className="font-display text-sm font-bold leading-snug">«{p.titular}»</p>
      <div className="grid grid-cols-[4fr_9fr] items-end gap-2">
        {(["4:5", "9:16"] as const).map((f) => {
          const url = f === "4:5" ? p.f45 : p.f916;
          const st = estado[`${p.n}-${f}`];
          return (
            <figure key={f} className="flex flex-col gap-1">
              <div className={`relative overflow-hidden rounded-lg border border-line bg-surface-2 ${f === "4:5" ? "aspect-[4/5]" : "aspect-[9/16]"}`}>
                {url ? (
                  <a href={dl(url)} title="Descargar">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`${p.titular} (${f})`} className="absolute inset-0 h-full w-full object-cover" />
                  </a>
                ) : st === "creando" || st === "esperando" ? (
                  <span className="absolute inset-0 grid place-items-center text-xs text-muted"><Spinner /></span>
                ) : (
                  <button type="button" onClick={() => onRetry(f)} className="absolute inset-0 grid place-items-center px-2 text-center text-xs text-muted hover:text-ink">{st === "error" || p.error ? "Falló · reintentar" : "Crear"}</button>
                )}
              </div>
              <figcaption className="text-[11px] text-muted">{f === "4:5" ? "Feed 4:5" : "Stories 9:16"}</figcaption>
            </figure>
          );
        })}
      </div>
      {p.nota && <p className="rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-300">Revisión: {p.nota}</p>}
      {lista && (
        p.video?.estado === "listo" && p.video.url ? (
          <div className="flex flex-col gap-1">
            <video src={p.video.url} controls playsInline muted loop className="aspect-[9/16] w-full rounded-lg bg-black object-cover" />
            <a href={dl(p.video.url)} className="text-xs font-semibold text-muted underline">Descargar video</a>
          </div>
        ) : p.video?.estado === "creando" ? (
          <span className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted"><Spinner /> Creando el video de producto (1 a 3 minutos)…</span>
        ) : (
          <button type="button" onClick={onVideo} className="rounded-lg border border-line px-3 py-2 text-left text-xs font-semibold hover:border-accent">
            🎬 Video de producto de 6 s · usa ≈ 3 imágenes de saldo{p.video?.estado === "error" ? " · falló, reintentar" : ""}
          </button>
        )
      )}
      {p.ganador && <button type="button" onClick={onVariar} disabled={busy} className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg disabled:opacity-50">Haz 10 variaciones de este</button>}
    </article>
  );
}
