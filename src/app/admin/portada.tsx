"use client";

import { useCallback, useEffect, useState } from "react";
import {
  type Contador,
  type ContadoresCrudos,
  type EntradaRoadmap,
  ESTADOS_ROADMAP,
  FORMATOS_GALERIA,
  type GaleriaPublicaItem,
  type Lista,
  type MetodoPago,
  NICHOS_GALERIA,
  type Novedad,
  TIPOS_GALERIA,
  estadoLabel,
  formatoContador,
  ordenarEntradas,
} from "@/lib/confianza";

// Marketing → Portada: the home page «confianza» blocks. Every block on the home hides itself while it has
// no real data; here the owner loads the gallery, the changelog and the roadmap, and sees which counters
// already pass their threshold.

interface Data {
  galeria: (GaleriaPublicaItem & { creado: string })[];
  novedades: Novedad[];
  roadmap: EntradaRoadmap[];
  contadores: { crudo: ContadoresCrudos | null; umbrales: { anuncios: number; marcas: number }; visibles: Contador[] };
  pagos: MetodoPago[];
  soporte: string;
  error?: string;
}

const card = "flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const input = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm";
const btn = "rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:bg-surface-2 disabled:opacity-50";
const main = "rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg disabled:opacity-50";
const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted">{label}{children}</label>;
}

export default function PortadaAdmin() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const load = useCallback(() => {
    fetch("/api/admin/portada").then((r) => r.json()).then((j: Data) => { if (j.error) setErr(j.error); else { setErr(""); setD(j); } }).catch(() => setErr("No se pudo cargar. Revisa tu conexión."));
  }, []);
  useEffect(load, [load]);

  async function post(body: Record<string, unknown>, key: string): Promise<boolean> {
    setBusy(key); setErr("");
    const r = await fetch("/api/admin/portada", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy("");
    if (!r?.ok) { setErr(j.error || "No se pudo guardar."); return false; }
    setD(j as Data);
    return true;
  }

  if (err && !d) return <section className={card}><p role="alert" className="text-sm text-bad">{err}</p></section>;
  if (!d) return <section className={card}><p className="text-muted">Cargando portada…</p></section>;

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div>
          <h2 className="font-display text-xl font-bold">Bloques de confianza de la portada</h2>
          <p className="max-w-3xl text-sm text-muted">Regla de oro: nada inventado. Cada bloque se esconde solo mientras no tenga datos reales. Los cambios se ven en la portada en unos minutos.</p>
        </div>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        <Contadores d={d} busy={busy} post={post} />
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p className="rounded-xl bg-surface-2 p-3"><b>Medios de pago que se muestran:</b> {d.pagos.length ? d.pagos.map((m) => (m === "mercadopago" ? "Mercado Pago" : "Stripe")).join(" y ") : "ninguno (faltan las claves en Vercel)"}.</p>
          <p className="rounded-xl bg-surface-2 p-3"><b>Promesa de soporte:</b> {d.soporte ? `«${d.soporte}»` : "escondida"}. <span className="text-muted">Se cambia con SOPORTE_PROMESA en Vercel («-» la esconde).</span></p>
        </div>
      </section>
      <Galeria d={d} busy={busy} post={post} setErr={setErr} setBusy={setBusy} />
      <Entradas lista="novedades" titulo="Novedades (creadsia.com/novedades)" d={d} busy={busy} post={post} />
      <Entradas lista="roadmap" titulo="Hoja de ruta (creadsia.com/roadmap)" d={d} busy={busy} post={post} />
    </div>
  );
}

type Post = (body: Record<string, unknown>, key: string) => Promise<boolean>;

function Contadores({ d, busy, post }: { d: Data; busy: string; post: Post }) {
  const c = d.contadores;
  const row = (label: string, n: number | undefined, min: number) => {
    const on = n !== undefined && n > 0 && n >= min;
    return (
      <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-surface-2 p-3">
        <span className="text-xs font-semibold text-muted">{label}</span>
        <b className="font-mono text-lg tabular-nums">{n === undefined ? "—" : n.toLocaleString("es-CL")}</b>
        <span className={`text-xs ${on ? "text-good" : "text-muted"}`}>{on ? `Se muestra como «${formatoContador(n!)}»` : `Escondido hasta llegar a ${min.toLocaleString("es-CL")}`}</span>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {row("Anuncios hechos (imágenes + videos terminados)", c.crudo?.anuncios, c.umbrales.anuncios)}
        {row("Marcas activas (últimos 30 días)", c.crudo?.marcas, c.umbrales.marcas)}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{c.crudo ? `Contado ahora. La portada usa una copia de hasta 1 hora.` : "No se pudieron contar (la portada los esconde)."} Mínimos: CONTADOR_MIN_ANUNCIOS y CONTADOR_MIN_MARCAS en Vercel. Las cuentas de prueba no cuentan.</span>
        <button type="button" className={btn} disabled={busy === "cont"} onClick={() => post({ accion: "contadores-recalcular" }, "cont")}>Actualizar en la portada ya</button>
      </div>
    </div>
  );
}

async function subir(file: File): Promise<string> {
  const r = await fetch("/api/admin/portada", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: "subir", type: file.type, size: file.size }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "No se pudo preparar la subida.");
  const fd = new FormData();
  fd.append("cacheControl", "3600");
  fd.append("", file);
  const up = await fetch(j.uploadUrl, { method: "PUT", body: fd, headers: { "x-upsert": "false" } });
  if (!up.ok) throw new Error("No se pudo subir el archivo. Revisa tu conexión e intenta de nuevo.");
  return j.publicUrl as string;
}

function Galeria({ d, busy, post, setErr, setBusy }: { d: Data; busy: string; post: Post; setErr: (s: string) => void; setBusy: (s: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [poster, setPoster] = useState<File | null>(null);
  const [nicho, setNicho] = useState<string>(NICHOS_GALERIA[0][0]);
  const [tipo, setTipo] = useState<string>(TIPOS_GALERIA[0][0]);
  const [formato, setFormato] = useState<string>("4:5");
  const [caption, setCaption] = useState("");
  const [formKey, setFormKey] = useState(0);
  const esVideo = Boolean(file?.type.startsWith("video/"));

  async function agregar() {
    if (!file) { setErr("Elige el archivo."); return; }
    setBusy("subir"); setErr("");
    try {
      const ref = await subir(file);
      const posterRef = esVideo && poster ? await subir(poster) : undefined;
      if (await post({ accion: "galeria-agregar", ref, poster: posterRef, nicho, tipo, formato, caption }, "subir")) {
        setFile(null); setPoster(null); setCaption(""); setFormKey((k) => k + 1);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo subir.");
      setBusy("");
    }
  }

  return (
    <section className={card}>
      <div>
        <h2 className="font-display text-xl font-bold">Galería «Hecho con Creads»</h2>
        <p className="max-w-3xl text-sm text-muted">Solo anuncios reales hechos con Creads. Los filtros por nicho aparecen solos cuando hay elementos de más de un nicho. Videos: se reproducen sin sonido en la portada.</p>
      </div>
      <div key={formKey} className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Archivo (imagen o video, hasta 50 MB)">
          <input type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm" className={input}
            onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f) setFormato(f.type.startsWith("video/") ? "9:16" : "4:5"); }} />
        </Field>
        {esVideo && (
          <Field label="Imagen de portada del video (opcional)">
            <input type="file" accept="image/png,image/jpeg,image/webp" className={input} onChange={(e) => setPoster(e.target.files?.[0] ?? null)} />
          </Field>
        )}
        <Field label="Nicho">
          <select value={nicho} onChange={(e) => setNicho(e.target.value)} className={input}>{NICHOS_GALERIA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={input}>{TIPOS_GALERIA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </Field>
        <Field label="Formato">
          <select value={formato} onChange={(e) => setFormato(e.target.value)} className={input}>{FORMATOS_GALERIA.map((f) => <option key={f} value={f}>{f === "4:5" ? "4:5 (feed)" : "9:16 (historias, reels)"}</option>)}</select>
        </Field>
        <Field label="Texto corto (opcional)">
          <input value={caption} maxLength={140} onChange={(e) => setCaption(e.target.value)} placeholder="Ej.: Sérum facial, 3 variantes en 10 minutos" className={input} />
        </Field>
        <div className="flex items-end">
          <button type="button" className={main} disabled={!file || busy === "subir"} onClick={agregar}>{busy === "subir" ? "Subiendo…" : "Agregar a la galería"}</button>
        </div>
      </div>
      {!d.galeria.length ? <p className="text-sm text-muted">La galería está vacía, así que la portada no la muestra.</p> : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {d.galeria.map((i, n) => <GaleriaFila key={i.id} i={i} first={n === 0} last={n === d.galeria.length - 1} busy={busy} post={post} />)}
        </ul>
      )}
    </section>
  );
}

function GaleriaFila({ i, first, last, busy, post }: { i: GaleriaPublicaItem; first: boolean; last: boolean; busy: string; post: Post }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState({ nicho: i.nicho as string, tipo: i.tipo as string, formato: i.formato as string, caption: i.caption });
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-xl border border-line p-2">
      <div className={`relative overflow-hidden rounded-lg bg-surface-2 ${i.formato === "9:16" ? "aspect-[9/16]" : "aspect-[4/5]"}`}>
        {i.media === "video"
          ? <video src={i.src} poster={i.poster} muted loop playsInline controls preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
          // eslint-disable-next-line @next/next/no-img-element -- short-lived storage link behind a redirect
          : <img src={i.src} alt={i.caption} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
      </div>
      {edit ? (
        <div className="flex flex-col gap-1.5">
          <select value={v.nicho} onChange={(e) => setV({ ...v, nicho: e.target.value })} className={input}>{NICHOS_GALERIA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })} className={input}>{TIPOS_GALERIA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select value={v.formato} onChange={(e) => setV({ ...v, formato: e.target.value })} className={input}>{FORMATOS_GALERIA.map((f) => <option key={f} value={f}>{f}</option>)}</select>
          <input value={v.caption} maxLength={140} onChange={(e) => setV({ ...v, caption: e.target.value })} placeholder="Texto corto" className={input} />
          <div className="flex gap-1.5">
            <button type="button" className={btn} disabled={busy === i.id} onClick={async () => { if (await post({ accion: "galeria-editar", id: i.id, ...v }, i.id)) setEdit(false); }}>Guardar</button>
            <button type="button" className={btn} onClick={() => setEdit(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs"><b>{i.tipoLabel}</b> · {i.nichoLabel} · {i.formato}{i.caption && <><br /><span className="text-muted">{i.caption}</span></>}</p>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={btn} disabled={first || busy === i.id} onClick={() => post({ accion: "galeria-mover", id: i.id, dir: -1 }, i.id)} aria-label="Mover antes">←</button>
            <button type="button" className={btn} disabled={last || busy === i.id} onClick={() => post({ accion: "galeria-mover", id: i.id, dir: 1 }, i.id)} aria-label="Mover después">→</button>
            <button type="button" className={btn} onClick={() => setEdit(true)}>Editar</button>
            <button type="button" className={`${btn} ${armed ? "text-bad" : ""}`} disabled={busy === i.id} onClick={() => (armed ? post({ accion: "galeria-borrar", id: i.id }, i.id) : setArmed(true))}>{armed ? "¿Seguro?" : "Quitar"}</button>
          </div>
        </>
      )}
    </li>
  );
}

type Form = { id?: string; fecha: string; titulo: string; texto: string; estado: string };

function Entradas({ lista, titulo, d, busy, post }: { lista: Lista; titulo: string; d: Data; busy: string; post: Post }) {
  const vacio = (): Form => ({ fecha: hoy(), titulo: "", texto: "", estado: "planeado" });
  const [f, setF] = useState<Form>(vacio);
  const [armed, setArmed] = useState("");
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(""), 3000); return () => clearTimeout(t); }, [armed]);
  const xs = ordenarEntradas<Novedad | EntradaRoadmap>(d[lista]);
  const roadmap = lista === "roadmap";
  async function guardar() {
    const entrada: Record<string, unknown> = { id: f.id, fecha: f.fecha, titulo: f.titulo, texto: f.texto, ...(roadmap ? { estado: f.estado } : {}) };
    if (await post({ accion: "entrada-guardar", lista, entrada }, lista)) setF(vacio());
  }
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">{titulo}</h2>
          <p className="max-w-3xl text-sm text-muted">{roadmap ? "Lo que estamos haciendo, lo que viene y lo que ya está listo." : "Lo que se lanzó, con su fecha."} Sin entradas, la página no existe (no se muestra vacía). Texto: deja una línea en blanco entre párrafos, «- » al inicio para una lista, **negrita** y [texto](https://enlace).</p>
        </div>
        {xs.length > 0 && <a href={`/${lista}`} target="_blank" className={btn}>Ver página</a>}
      </div>
      <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field label="Fecha"><input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} className={input} /></Field>
        <Field label="Título"><input value={f.titulo} maxLength={90} onChange={(e) => setF({ ...f, titulo: e.target.value })} className={input} /></Field>
        {roadmap && (
          <Field label="Estado">
            <select value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })} className={input}>{ESTADOS_ROADMAP.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
        )}
        <div className={roadmap ? "" : "sm:col-span-2"}>
          <Field label="Texto corto"><textarea value={f.texto} maxLength={1200} rows={3} onChange={(e) => setF({ ...f, texto: e.target.value })} className={input} /></Field>
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <button type="button" className={main} disabled={busy === lista || f.titulo.trim().length < 3} onClick={guardar}>{f.id ? "Guardar cambios" : "Agregar"}</button>
          {f.id && <button type="button" className={btn} onClick={() => setF(vacio())}>Cancelar</button>}
        </div>
      </div>
      {!xs.length ? <p className="text-sm text-muted">Todavía no hay entradas.</p> : (
        <ul className="flex flex-col divide-y divide-line">
          {xs.map((e) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="text-xs text-muted">{e.fecha}{"estado" in e && <> · {estadoLabel(e.estado)}</>}</p>
                <p className="font-semibold">{e.titulo}</p>
                {e.texto && <p className="line-clamp-2 text-sm text-muted">{e.texto}</p>}
              </div>
              <div className="flex gap-1.5">
                <button type="button" className={btn} onClick={() => setF({ id: e.id, fecha: e.fecha, titulo: e.titulo, texto: e.texto, estado: "estado" in e ? e.estado : "planeado" })}>Editar</button>
                <button type="button" className={`${btn} ${armed === e.id ? "text-bad" : ""}`} disabled={busy === lista}
                  onClick={() => (armed === e.id ? post({ accion: "entrada-borrar", lista, id: e.id }, lista) : setArmed(e.id))}>{armed === e.id ? "¿Seguro?" : "Borrar"}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
