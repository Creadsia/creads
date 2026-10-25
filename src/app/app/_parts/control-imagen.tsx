"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ImageInput, type Img } from "./tool-run";
import { Working, dl, useTable, inputCls, btnCls, ghostCls, cardCls } from "./ui";
import { refreshCredits, useCredits } from "./use-credits";
import { IMAGEN_CR, fmtCredits } from "@/lib/credit-math";
import {
  type ClavePieza, type Diseno, type EstiloPieza, ESTILOS_PIEZA, FORMATOS_PIEZA, IDIOMAS_PIEZA, type IdiomaPieza, LOGO_POS, type LogoPos,
  MAX_REHACER_GRATIS, MOTIVOS_REHACER, type MotivoRehacer, type ModeloPrecio, type Trabajo, disenoInicial, faltantes, idiomaDe, nombrePieza,
} from "@/lib/control-imagen";

// «Control» (owner, 25 Oct 2026): nobody wants to spend balance and get something random. The customer sets
// the exact headline, style, scene, colours, logo and language; sees a cheap preview first; approves it to get
// the 3 formats drawn from it; edits with one instruction (text edits are free); and can redo for free with a
// reason. Every step says what it uses from the balance before it runs.

interface Cfg {
  modelos: ModeloPrecio[];
  borrador: ModeloPrecio | null;
  final: ModeloPrecio | null;
  costos: { vistaPrevia: number; aprobar: number; editarImagen: number };
  marca: { nombre: string; c1: string; c2: string; logo: string; logoPos: string; idioma: string; producto: { nombre: string; descripcion: string; foto: string } } | null;
}
type Job = Omit<Trabajo, "ws">;
const H = { "content-type": "application/json", "x-creads-code": "session" };
const aspectCls: Record<ClavePieza, string> = { borrador: "aspect-[4/5]", "4:5": "aspect-[4/5]", "9:16": "aspect-[9/16]", "1:1": "aspect-square" };

export default function ControlImagen() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const library = useTable<Img>("images");
  const { credits, covers } = useCredits();
  // the picture
  const [prodNombre, setProdNombre] = useState("");
  const [prodDesc, setProdDesc] = useState("");
  const [foto, setFoto] = useState("");
  const [estilo, setEstilo] = useState<EstiloPieza>("ugc");
  const [escena, setEscena] = useState("");
  const [idioma, setIdioma] = useState<IdiomaPieza>("es-CL");
  const [modeloFinal, setModeloFinal] = useState("");
  // what goes on top (free to change)
  const [titular, setTitular] = useState("");
  const [cta, setCta] = useState(idiomaDe("es-CL").cta);
  const [posicion, setPosicion] = useState<"arriba" | "abajo">("arriba");
  const [c1, setC1] = useState("#8A5CFF");
  const [c2, setC2] = useState("#FFD400");
  const [logoPos, setLogoPos] = useState<LogoPos>("no");

  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [aviso, setAviso] = useState("");
  // «Editar con una instrucción» and «Rehacer gratis»
  const [pieza, setPieza] = useState<ClavePieza>("borrador");
  const [instr, setInstr] = useState("");
  const [confirmar, setConfirmar] = useState<{ imagen: string; costoUsd: number; pieza: ClavePieza } | null>(null);
  const [motivo, setMotivo] = useState<MotivoRehacer>("producto");
  const [detalle, setDetalle] = useState("");

  useEffect(() => {
    fetch("/api/imagenes/control", { headers: H }).then((r) => (r.ok ? r.json() : null)).then((d: Cfg | null) => {
      if (!d) return;
      setCfg(d);
      setModeloFinal(d.final?.id ?? "");
      const m = d.marca;
      if (m) {
        if (m.producto.nombre) setProdNombre(m.producto.nombre);
        if (m.producto.descripcion) setProdDesc(m.producto.descripcion);
        if (m.producto.foto) setFoto(m.producto.foto);
        if (/^#[0-9a-f]{6}$/i.test(m.c1)) setC1(m.c1);
        if (/^#[0-9a-f]{6}$/i.test(m.c2)) setC2(m.c2);
        if (m.logo) setLogoPos(m.logoPos === "arriba-izq" ? "arriba-izq" : m.logoPos?.startsWith("abajo") ? "abajo" : m.logoPos === "no" ? "no" : "arriba-der");
        if (m.idioma === "en") { setIdioma("en-US"); setCta(idiomaDe("en-US").cta); }
      }
    }).catch(() => {});
  }, []);

  const logo = cfg?.marca?.logo ?? "";
  /** The overlay as the form shows it now. */
  const diseno: Diseno = useMemo(() => ({
    ...disenoInicial(estilo, { c1, c2, logo, logoPos }, idioma),
    titular, cta, posicion, logoPos: logo ? logoPos : "no",
  }), [estilo, c1, c2, logo, logoPos, idioma, titular, cta, posicion]);

  const fin = cfg?.modelos.find((m) => m.id === modeloFinal) ?? cfg?.final ?? null;
  const usdPrev = cfg?.borrador?.usd ?? 0;
  const usdAprobar = (fin?.usd ?? 0) * (job ? Math.max(1, faltantes(job).length) : FORMATOS_PIEZA.length);
  /** What a step uses from the balance, honestly (a cheap draft is a fraction of an image). */
  const cuanto = (usd: number) => {
    if (!(usd > 0)) return "gratis";
    const cr = credits(usd);
    const im = Math.max(0.1, Math.round((cr / IMAGEN_CR) * 10) / 10);
    return `${im.toLocaleString("es-CL")} imagen${im === 1 ? "" : "es"} de tu saldo (${fmtCredits(cr)})`;
  };
  const gastado = job?.historial.reduce((s, h) => s + h.creditos, 0) ?? 0;

  const textoCambio = Boolean(job && (job.diseno.titular !== titular || job.diseno.cta !== cta || job.diseno.posicion !== posicion || job.diseno.logoPos !== diseno.logoPos || job.diseno.colorBoton !== diseno.colorBoton || job.diseno.resaltar !== diseno.resaltar));
  const fotoCambio = Boolean(job && (job.pedido.estilo !== estilo || job.pedido.escena !== escena.trim() || job.pedido.idioma !== idioma || job.pedido.producto.foto !== foto || job.pedido.producto.nombre !== prodNombre.trim()));

  async function call(body: Record<string, unknown>, label: string) {
    setBusy(label); setErr(""); setAviso("");
    try {
      const r = await fetch("/api/imagenes/control", { method: "POST", headers: H, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo completar. Intenta de nuevo.");
      if (d.trabajo) setJob(d.trabajo);
      refreshCredits();
      return d;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo completar.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function vistaPrevia() {
    const nuevo = !job || job.etapa === "final";
    const d = await call({
      accion: "vista-previa", ...(nuevo ? {} : { id: job!.id }), modeloFinal,
      pedido: { estilo, escena, idioma, producto: { nombre: prodNombre, descripcion: prodDesc, foto } }, diseno,
    }, "Haciendo la vista previa…");
    if (d) { setPieza("borrador"); setConfirmar(null); setAviso(`Vista previa lista. Usó ${cuantoCr(d.creditos)}.`); }
  }
  async function aprobar() {
    const d = await call({ accion: "aprobar", id: job!.id, diseno }, "Haciendo los 3 formatos…");
    if (d) {
      setPieza("4:5");
      setAviso(`${d.fallaron?.length ? `No salieron: ${d.fallaron.join(", ")} (no se cobraron; vuelve a aprobar para hacerlos). ` : "Listas las 3 piezas. "}Usó ${cuantoCr(d.creditos)}.`);
    }
  }
  async function aplicarTexto() {
    const d = await call({ accion: "diseno", id: job!.id, diseno }, "Poniendo el texto…");
    if (d) setAviso("Texto actualizado en todas las piezas. Gratis.");
  }
  async function editar(conf?: { imagen: string; pieza: ClavePieza }) {
    const d = await call({ accion: "editar", id: job!.id, pieza: conf?.pieza ?? pieza, instruccion: instr, ...(conf ? { confirmar: true, imagen: conf.imagen } : {}) }, conf ? "Editando la imagen…" : "Entendiendo el cambio…");
    if (!d) return;
    if (d.confirmar) { setConfirmar({ imagen: d.imagen, costoUsd: d.costoUsd, pieza: d.pieza }); return; }
    setConfirmar(null);
    if (d.tipo === "diseno") {
      // the overlay changed on the server: bring the form in line
      const n = d.trabajo.diseno as Diseno;
      setTitular(n.titular); setCta(n.cta); setPosicion(n.posicion); setLogoPos(n.logoPos);
      setAviso("Listo, era un cambio de texto o diseño: gratis.");
    } else setAviso(`Imagen editada. Usó ${cuantoCr(d.creditos)}.`);
    setInstr("");
  }
  async function rehacer() {
    const d = await call({ accion: "rehacer", id: job!.id, pieza, motivo, detalle }, "Rehaciendo gratis…");
    if (d) { setDetalle(""); setAviso("Rehecha sin costo."); }
  }
  const cuantoCr = (cr: number) => (cr > 0 ? `${Math.max(0.1, Math.round((cr / IMAGEN_CR) * 10) / 10).toLocaleString("es-CL")} imagen(es) de tu saldo (${fmtCredits(cr)})` : "nada de tu saldo");

  const listo = titular.trim().length > 0 && (prodNombre.trim() || escena.trim() || foto);
  const piezas = job ? (job.etapa === "final" ? FORMATOS_PIEZA.filter((f) => job.piezas[f]) : (["borrador"] as ClavePieza[])) : [];
  const actual = job?.piezas[pieza];
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-semibold ${on ? "border-ink bg-ink text-bg" : "border-line text-muted"}`;

  if (!cfg) return <section className={cardCls}><p className="text-sm text-muted">Cargando…</p></section>;
  if (!cfg.borrador) return <section className={cardCls}><p className="text-sm text-muted">Las imágenes no están disponibles por ahora. Intenta en un rato.</p></section>;

  return (
    <section className={cardCls}>
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Imagen con control</h2>
        <p className="text-sm text-muted">Primero ves una vista previa barata. Si te gusta, la apruebas y Creads hace los 3 formatos (feed 4:5, historias 9:16 y cuadrada 1:1) a partir de ella. El texto lo pone Creads encima, así que sale escrito exactamente como lo escribes.</p>
      </div>

      {/* 1 · the controls */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-semibold text-muted">Titular exacto</span>
          <input value={titular} onChange={(e) => setTitular(e.target.value)} maxLength={140} placeholder="Ej: Envío *gratis* a todo Chile" className={inputCls} />
          <span className="text-xs text-muted">Sale tal cual. Para destacar palabras con otro color, ponlas entre asteriscos: Envío *gratis*.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-muted">Botón (déjalo vacío si no quieres botón)</span>
          <input value={cta} onChange={(e) => setCta(e.target.value)} maxLength={32} className={inputCls} />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-muted">Texto</span>
          <div className="flex gap-1.5">{(["arriba", "abajo"] as const).map((p) => <button key={p} type="button" onClick={() => setPosicion(p)} aria-pressed={posicion === p} className={chip(posicion === p)}>{p === "arriba" ? "Arriba" : "Abajo"}</button>)}</div>
        </div>
        <div className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-semibold text-muted">Estilo</span>
          <div className="flex flex-wrap gap-1.5">{ESTILOS_PIEZA.map((e) => <button key={e.id} type="button" onClick={() => setEstilo(e.id)} aria-pressed={estilo === e.id} className={chip(estilo === e.id)}>{e.label}</button>)}</div>
        </div>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-semibold text-muted">Fondo o escena</span>
          <textarea value={escena} onChange={(e) => setEscena(e.target.value)} rows={2} maxLength={600} placeholder="Ej: cocina luminosa de departamento, mañana, mujer de 35 tomando el producto" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-muted">Producto</span>
          <input value={prodNombre} onChange={(e) => setProdNombre(e.target.value)} maxLength={120} placeholder="Ej: Sérum de vitamina C 30 ml" className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-muted">Idioma</span>
          <select value={idioma} onChange={(e) => { const v = e.target.value as IdiomaPieza; if (cta === idiomaDe(idioma).cta) setCta(idiomaDe(v).cta); setIdioma(v); }} className={inputCls}>
            {IDIOMAS_PIEZA.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-semibold text-muted">Foto real del producto</span>
          <ImageInput value={foto} onChange={setFoto} library={library.rows ?? []} />
          <span className="text-xs text-muted">Siempre se usa como referencia: se mantiene su forma, colores, etiqueta y logo. {cfg.marca?.producto.foto ? "Viene de tu kit de marca." : ""}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm sm:col-span-2">
          <span className="font-semibold text-muted">Colores</span>
          <label className="flex items-center gap-1.5"><input type="color" value={c1} onChange={(e) => setC1(e.target.value.toUpperCase())} aria-label="Color principal (botón y recuadros)" /> <span className="text-xs text-muted">botón y recuadros</span></label>
          <label className="flex items-center gap-1.5"><input type="color" value={c2} onChange={(e) => setC2(e.target.value.toUpperCase())} aria-label="Color para destacar" /> <span className="text-xs text-muted">palabras destacadas</span></label>
          {cfg.marca && <button type="button" onClick={() => { setC1(cfg.marca!.c1); setC2(cfg.marca!.c2); }} className="text-xs font-semibold text-accent-text">Usar los de mi marca</button>}
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-muted">Logo</span>
          <select value={logo ? logoPos : "no"} onChange={(e) => setLogoPos(e.target.value as LogoPos)} disabled={!logo} className={inputCls}>
            {LOGO_POS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          {!logo && <span className="text-xs text-muted">Sube tu logo en <Link href="/app/marca" className="font-semibold text-accent-text underline">Kit de marca</Link>.</span>}
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-semibold text-muted">Calidad de las piezas finales</span>
          <select value={modeloFinal} onChange={(e) => setModeloFinal(e.target.value)} disabled={job?.etapa === "final"} className={inputCls}>
            {cfg.modelos.filter((m) => m.id !== cfg.borrador?.id || cfg.modelos.length === 1).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3 text-sm">
        <p><b>1 · Vista previa:</b> {cuanto(usdPrev)} <span className="text-muted">(modelo económico {cfg.borrador.label}).</span></p>
        <p><b>2 · Aprobar (3 formatos):</b> {cuanto((fin?.usd ?? 0) * FORMATOS_PIEZA.length)} <span className="text-muted">({fin?.label}).</span></p>
        <p className="text-muted">Cambiar el texto: gratis. Rehacer por un error: gratis (hasta {MAX_REHACER_GRATIS} por pieza). Cada imagen se revisa sola antes de entregarla; si sale con un error grave se rehace sin costo.</p>
        {job && <p><b>Usado en esta imagen:</b> {cuantoCr(gastado)}.</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={vistaPrevia} disabled={!listo || Boolean(busy) || !covers(usdPrev)} className={btnCls}>
          {busy.startsWith("Haciendo la vista") ? <Working label={busy} /> : job && job.etapa === "borrador" ? `Otra vista previa · ${cuanto(usdPrev)}` : job ? `Nueva imagen · vista previa · ${cuanto(usdPrev)}` : `Ver vista previa · ${cuanto(usdPrev)}`}
        </button>
        {job && textoCambio && !fotoCambio && (
          <button type="button" onClick={aplicarTexto} disabled={Boolean(busy) || !titular.trim()} className={ghostCls}>{busy === "Poniendo el texto…" ? <Working label={busy} /> : "Aplicar cambios de texto · gratis"}</button>
        )}
      </div>
      {!listo && <p className="text-xs text-muted">Escribe el titular y cuenta qué producto es (o la escena) para ver la vista previa.</p>}
      {job && fotoCambio && job.etapa === "borrador" && <p className="text-xs text-warn">Cambiaste el estilo, la escena, el idioma o el producto: eso se ve con otra vista previa.</p>}
      {err && <p className="text-sm text-bad">{err}</p>}
      {aviso && <p className="text-sm text-good">{aviso}</p>}
      {busy && !busy.startsWith("Haciendo la vista") && <Working label={busy} className="text-sm" />}

      {/* 2 · the result */}
      {job && (
        <div className="flex flex-col gap-3">
          <ul className={`grid gap-3 ${piezas.length > 1 ? "sm:grid-cols-3" : "sm:max-w-sm"}`}>
            {piezas.map((k) => {
              const p = job.piezas[k]!;
              return (
                <li key={k} className="flex min-w-0 flex-col gap-1.5">
                  <button type="button" onClick={() => setPieza(k)} aria-pressed={pieza === k} className={`relative ${aspectCls[k]} overflow-hidden rounded-lg border-2 ${pieza === k ? "border-accent-text" : "border-line"} bg-surface-2`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.final} alt={nombrePieza(k)} className="absolute inset-0 h-full w-full object-cover" />
                  </button>
                  <span className="text-xs font-semibold">{nombrePieza(k)}{p.auto ? " · revisada y rehecha sola" : ""}</span>
                  {p.nota && <span className="text-xs text-warn">⚠ {p.nota}</span>}
                  <a href={dl(p.final)} download target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent-text">Descargar</a>
                </li>
              );
            })}
          </ul>

          {job.etapa === "borrador" && (
            <button type="button" onClick={aprobar} disabled={Boolean(busy) || !covers(usdAprobar) || fotoCambio} className={`${btnCls} w-fit`}>
              {busy.startsWith("Haciendo los 3") ? <Working label={busy} /> : `Aprobar y hacer los 3 formatos · ${cuanto(usdAprobar)}`}
            </button>
          )}
          {job.etapa === "final" && faltantes(job).length > 0 && (
            <button type="button" onClick={aprobar} disabled={Boolean(busy) || !covers(usdAprobar)} className={`${ghostCls} w-fit`}>Hacer los que faltan ({faltantes(job).join(", ")}) · {cuanto(usdAprobar)}</button>
          )}

          {actual && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-xl border border-line p-3 text-sm">
                <b>Editar con una instrucción · {nombrePieza(pieza)}</b>
                <input value={instr} onChange={(e) => { setInstr(e.target.value); setConfirmar(null); }} maxLength={500} placeholder="Ej: texto más grande · cambia el fondo a cocina · quita a la persona" className={inputCls} />
                <span className="text-xs text-muted">Si es un cambio de texto o diseño es gratis. Si hay que cambiar la imagen, te mostramos lo que cuesta antes.</span>
                {confirmar ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Esto cambia la imagen: usa {cuanto(confirmar.costoUsd)}.</span>
                    <button type="button" onClick={() => editar({ imagen: confirmar.imagen, pieza: confirmar.pieza })} disabled={Boolean(busy) || !covers(confirmar.costoUsd)} className={btnCls}>Confirmar</button>
                    <button type="button" onClick={() => setConfirmar(null)} className={ghostCls}>Cancelar</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => editar()} disabled={Boolean(busy) || instr.trim().length < 3} className={`${ghostCls} w-fit`}>Aplicar</button>
                )}
              </div>
              <div className="flex flex-col gap-2 rounded-xl border border-line p-3 text-sm">
                <b>Rehacer gratis · {nombrePieza(pieza)}</b>
                <div className="flex flex-wrap gap-1.5">{MOTIVOS_REHACER.map((m) => <button key={m.id} type="button" onClick={() => setMotivo(m.id)} aria-pressed={motivo === m.id} className={chip(motivo === m.id)}>{m.label}</button>)}</div>
                <input value={detalle} onChange={(e) => setDetalle(e.target.value)} maxLength={300} placeholder={motivo === "otro" ? "Cuéntanos qué salió mal" : "Detalle (opcional)"} className={inputCls} />
                <span className="text-xs text-muted">Te quedan {Math.max(0, MAX_REHACER_GRATIS - actual.rehechos)} de {MAX_REHACER_GRATIS} rehechos gratis en esta pieza.</span>
                <button type="button" onClick={rehacer} disabled={Boolean(busy) || actual.rehechos >= MAX_REHACER_GRATIS || (motivo === "otro" && !detalle.trim())} className={`${ghostCls} w-fit`}>Rehacer sin costo</button>
              </div>
            </div>
          )}

          {job.historial.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-muted">Saldo usado en cada paso</summary>
              <ul className="mt-2 flex flex-col gap-1">
                {job.historial.map((h, i) => <li key={i} className="flex justify-between gap-3"><span className="min-w-0">{h.que}</span><span className="shrink-0 text-muted">{h.creditos ? fmtCredits(h.creditos) : "gratis"}</span></li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
