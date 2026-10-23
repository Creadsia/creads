"use client";

import { useCallback, useEffect, useState } from "react";
import type { AutoProd, CampaignView, Idea, MarketingState, Pedido, ProdJob } from "@/lib/marketing";
import { TO_CREAR_KEY } from "@/lib/guiones";
import type { PausaAuto } from "@/lib/piloto";
import Piloto from "./piloto";

// Panel → Marketing: the marketing studio's controls. Connection with Meta, the daily cap, the campaigns
// (live from Meta), the ad requests from Creativos, the brand's Instagram accounts and the automatic reply.
// The agents (Oficina) propose; the owner approves in Oficina → «Por aprobar».

interface Data {
  conexion: { anuncios: boolean; token: boolean; instagramAnuncios: boolean; webhook: boolean; pixel: boolean; capi: boolean; error: string };
  autoProd: AutoProd; modelosVideo: { id: string; label: string; usdPorSeg: number }[];
  conexiones: Record<ConnKey, { value: string; from: string | null }> & { updatedAt: string | null; by: string | null };
  estado: MarketingState; respuestasHoy: number; campanasMeta: CampaignView[]; moneda: string | null;
  anuncios: { id: string; title: string | null; format: string | null; final_url: string; created_at: string }[];
  avatares: { id: string; nombre: string }[]; pausaAuto: PausaAuto;
}

type ConnKey = "pixelId" | "adAccountId" | "pageId" | "igUserId" | "testEventCode" | "capiToken" | "adsToken" | "appSecret" | "webhookToken";
const CONN_FIELDS: { k: ConnKey; label: string; secret?: boolean; hint: string }[] = [
  { k: "pixelId", label: "ID del píxel", hint: "Administrador de eventos → Orígenes de datos → tu píxel: el número debajo del nombre." },
  { k: "capiToken", label: "Token de la API de conversiones", secret: true, hint: "Administrador de eventos → tu píxel → Configuración → API de conversiones → «Generar token de acceso»." },
  { k: "adsToken", label: "Token del usuario del sistema", secret: true, hint: "Configuración del negocio → Usuarios → Usuarios del sistema → tu usuario → «Generar nuevo token» (permisos ads_management, ads_read, pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish, business_management; caducidad: nunca)." },
  { k: "adAccountId", label: "ID de la cuenta publicitaria", hint: "Configuración del negocio → Cuentas → Cuentas publicitarias: el número de la cuenta (sin act_)." },
  { k: "pageId", label: "ID de la página de Facebook", hint: "Configuración del negocio → Cuentas → Páginas: el identificador de la página." },
  { k: "igUserId", label: "ID de Instagram (opcional)", hint: "Configuración del negocio → Cuentas → Cuentas de Instagram: el identificador de la cuenta con la que salen los anuncios." },
  { k: "testEventCode", label: "Código de eventos de prueba (opcional)", hint: "Solo para probar: Administrador de eventos → Probar eventos. Bórralo cuando termines." },
];

// same list as EVENTOS in lib/marketing (that module is server-only)
const EVENTO_OPTS: [string, string, string][] = [
  ["registro", "Cuenta creada (CompleteRegistration)", "Se envía cada vez que alguien crea su cuenta: mucho volumen, Meta aprende rápido."],
  ["inicio_pago", "Inicio de pago (InitiateCheckout)", "Se envía cuando alguien va a pagar un plan."],
  ["compra", "Compra (Purchase)", "Se envía cuando se aprueba un pago: lo más valioso, pero Meta necesita ~50 a la semana para aprender bien."],
  ["lead", "Lead", "Ojo: hoy casi no se envía (solo la lista de espera, que no está en la página)."],
];

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const btn = "rounded-lg border border-line px-3 py-1.5 text-sm font-semibold disabled:opacity-50";
const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";
const usd = (n: number | null) => (n === null ? "—" : `US$${n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const day = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });

export default function Marketing() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [cap, setCap] = useState("");
  const [ar, setAr] = useState<{ palabras: string; mensaje: string; publico: string; maxPorHora: string } | null>(null);
  const [nueva, setNueva] = useState({ nombre: "", igUserId: "", pageId: "" });

  const apply = (x: Data, fill = false) => {
    setD(x);
    if (fill) {
      setCap(String(x.estado.capUsd));
      setAr({ palabras: x.estado.autoReply.palabras.join(", "), mensaje: x.estado.autoReply.mensaje, publico: x.estado.autoReply.publico, maxPorHora: String(x.estado.autoReply.maxPorHora) });
    }
  };
  const call = useCallback(async (method: "GET" | "PATCH", body?: unknown, fill = false) => {
    setErr("");
    try {
      const r = await fetch("/api/admin/marketing", { method, ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(x.error || "No se pudo cargar.");
      apply(x, fill);
      return true;
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo cargar."); return false; }
  }, []);
  useEffect(() => { call("GET", undefined, true); }, [call]);

  const openInCrear = (p: Pedido) => {
    try {
      sessionStorage.setItem(TO_CREAR_KEY, JSON.stringify({ text: p.guion, lang: p.idioma, title: p.titulo }));
      localStorage.setItem("creads-fmt", p.formato);
    } catch {}
    if (p.estado === "pendiente") call("PATCH", { pedido: p.id, estado: "en producción" });
    // same-origin tab without noopener: the browser copies sessionStorage, so Crear anuncio finds the script
    window.open("/app/crear", "_blank");
  };

  if (!d) return <div className={card}>{err ? <p role="alert" className="text-bad">{err}</p> : <p className="text-muted">Cargando marketing…</p>}</div>;
  const s = d.estado, c = d.conexion;

  return (
    <div className="flex flex-col gap-4">
      {err && <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{err}</p>}
      {!c.anuncios && (
        <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm"><b>Modo ensayo:</b> Meta todavía no está conectado. Los agentes ya pueden proponer campañas, anuncios y publicaciones; al aprobarlas quedan guardadas aquí y se suben a Meta cuando conectes la cuenta.</p>
      )}

      <Conexiones d={d} reload={(x) => apply(x)} />

      <Ideas ideas={s.ideas ?? []} reload={(x) => apply(x)} patch={(body) => call("PATCH", body)} />

      <section className={card} aria-labelledby="h-tope">
        <h3 id="h-tope" className="text-lg font-bold">Tope de gasto en campañas</h3>
        <form className="flex flex-wrap items-center gap-2 text-sm" onSubmit={(e) => { e.preventDefault(); call("PATCH", { capUsd: Number(cap.replace(",", ".")) }, true); }}>
          <label htmlFor="mk-cap">Máximo por día, sumando todas las campañas activas (US$)</label>
          <input id="mk-cap" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 font-mono" />
          <button className={btn}>Guardar</button>
        </form>
        <label className="mt-1 flex flex-wrap items-center gap-2 text-sm" htmlFor="mk-evento">
          <span>Evento que buscan las campañas de conversión</span>
          <select id="mk-evento" value={s.evento ?? "registro"} onChange={(e) => call("PATCH", { evento: e.target.value })} className="rounded-lg border border-line bg-surface px-2 py-1.5">
            {EVENTO_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted">{EVENTO_OPTS.find(([k]) => k === (s.evento ?? "registro"))?.[2]} Una campaña puede pedir otro evento; si no dice nada, usa este.</p>
        <p className="text-xs text-muted">Ningún agente puede activar una campaña ni subir un presupuesto si la suma de presupuestos diarios pasa este tope. Las campañas nuevas siempre se suben en pausa. Ojo: Meta puede gastar hasta ~1,75 veces el presupuesto un día puntual, pero en la semana respeta el promedio.</p>
      </section>

      <section className={card} aria-labelledby="h-camp">
        <h3 id="h-camp" className="text-lg font-bold">Campañas en Meta (últimos 7 días)</h3>
        {d.campanasMeta.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-line text-left text-xs text-muted">{["Campaña", "Estado", "Presupuesto/día", "Gasto", "CTR", "Frecuencia", "Leads", "Costo por lead"].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-line">
                {d.campanasMeta.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-2"><b>{r.nombre}</b><span className="block font-mono text-[11px] text-muted">{r.id}</span></td>
                    <td className="px-2 py-2 text-xs">{r.estado === "ACTIVE" ? "Activa" : r.estado === "PAUSED" ? "En pausa" : r.estado}</td>
                    <td className="px-2 py-2 font-mono">{usd(r.presupuestoUsd)}</td>
                    <td className="px-2 py-2 font-mono">{usd(r.gasto7d)}</td>
                    <td className="px-2 py-2 font-mono">{r.ctr.toFixed(2)}%</td>
                    <td className="px-2 py-2 font-mono">{r.frecuencia.toFixed(1)}</td>
                    <td className="px-2 py-2 font-mono">{r.leads}</td>
                    <td className="px-2 py-2 font-mono">{usd(r.costoPorLead)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted">{c.anuncios ? "Todavía no hay campañas en la cuenta." : "Se verán aquí cuando conectes Meta."}</p>}
        {!!s.campanas.length && (
          <details><summary className="cursor-pointer text-sm font-semibold text-accent-text">Campañas propuestas por el estudio ({s.campanas.length})</summary>
            <ul className="flex flex-col divide-y divide-line pt-2 text-sm">
              {s.campanas.map((x) => <li key={x.id} className="flex flex-wrap justify-between gap-2 py-2"><span><b>{x.spec.nombre}</b> · {x.spec.objetivo} · US${x.spec.presupuestoUsd}/día · {x.spec.paises.join(", ")}</span><span className="text-xs text-muted">{day(x.at)} · {x.estado}{x.metaId ? ` · ${x.metaId}` : ""}</span></li>)}
            </ul>
          </details>
        )}
      </section>

      <Produccion d={d} patch={(body) => call("PATCH", body)} />

      <section className={card} aria-labelledby="h-ped">
        <h3 id="h-ped" className="text-lg font-bold">Pedidos de anuncios (de Creativos)</h3>
        {s.pedidos.length ? (
          <ul className="flex flex-col gap-2">
            {s.pedidos.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 rounded-xl border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="text-sm">{p.titulo} <span className="font-normal text-muted">· {p.formato} · {p.idioma === "en" ? "inglés" : "español"}</span></b>
                  <select aria-label={`Estado de ${p.titulo}`} value={p.estado} onChange={(e) => call("PATCH", { pedido: p.id, estado: e.target.value })} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs">
                    {["pendiente", "en producción", "listo"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </div>
                {p.idea && <p className="text-xs text-muted">{p.idea}</p>}
                <details><summary className="cursor-pointer text-xs font-semibold text-accent-text">Ver guion</summary><p className="whitespace-pre-wrap pt-2 text-sm">{p.guion}</p></details>
                <span className="flex flex-wrap gap-2">
                  {p.estado === "pendiente" && d.autoProd.on && !(s.produccion ?? []).some((j) => j.pedidoId === p.id) && <button type="button" onClick={() => call("PATCH", { producir: p.id })} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink">Producir automáticamente</button>}
                  <button type="button" onClick={() => openInCrear(p)} className={`${btn} self-start`}>Abrir en Crear anuncio</button>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Cuando apruebes un pedido de Creativos aparece aquí. «Abrir en Crear anuncio» lo carga con el guion y el formato; ahí eliges el modelo y ves el precio antes de generarlo.</p>}
      </section>

      <section className={card} aria-labelledby="h-ig">
        <h3 id="h-ig" className="text-lg font-bold">Cuentas de Instagram de la marca</h3>
        {s.cuentas.length ? (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {s.cuentas.map((x) => <li key={x.id} className="flex items-center justify-between gap-2 py-2"><span><b>{x.nombre}</b> <span className="font-mono text-xs text-muted">{x.igUserId}</span></span><button type="button" onClick={() => confirm(`¿Quitar ${x.nombre}?`) && call("PATCH", { quitarCuenta: x.id })} className={`${btn} text-xs text-bad`}>Quitar</button></li>)}
          </ul>
        ) : <p className="text-sm text-muted">Agrega cada cuenta profesional de Instagram (conectada a una página de Facebook de tu Business Manager).</p>}
        <form className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" onSubmit={async (e) => { e.preventDefault(); if (await call("PATCH", { cuenta: nueva })) setNueva({ nombre: "", igUserId: "", pageId: "" }); }}>
          <input aria-label="Nombre de la cuenta" placeholder="Nombre (ej: creads.videos)" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} className={input} />
          <input aria-label="Número de la cuenta de Instagram" placeholder="Número de Instagram (ID)" inputMode="numeric" value={nueva.igUserId} onChange={(e) => setNueva({ ...nueva, igUserId: e.target.value.trim() })} className={`${input} font-mono`} />
          <input aria-label="Número de la página de Facebook conectada" placeholder="Página de Facebook (para mensajes)" inputMode="numeric" value={nueva.pageId} onChange={(e) => setNueva({ ...nueva, pageId: e.target.value.trim() })} className={`${input} font-mono`} />
          <button className={btn}>Agregar</button>
        </form>
        <p className="text-xs text-muted">Cada cuenta debe decir en su bio que el contenido está hecho con Creads IA. Así el tráfico orgánico es transparente y Meta no la marca como no auténtica.</p>
      </section>

      <Piloto s={s} avatares={d.avatares ?? []} pausa={d.pausaAuto} patch={(body) => call("PATCH", body)} />

      {ar && (
        <section className={card} aria-labelledby="h-ar">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="h-ar" className="text-lg font-bold">Respuesta automática a comentarios</h3>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.autoReply.on} onChange={(e) => call("PATCH", { autoReply: { on: e.target.checked } })} className="h-4 w-4 accent-[var(--accent)]" />Encendida</label>
          </div>
          <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); call("PATCH", { autoReply: { palabras: ar.palabras.split(","), mensaje: ar.mensaje, publico: ar.publico, maxPorHora: ar.maxPorHora } }, true); }}>
            <label className="flex flex-col gap-1 text-sm font-semibold">Si el comentario dice (separadas por coma)<input value={ar.palabras} onChange={(e) => setAr({ ...ar, palabras: e.target.value })} className={input} /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold">Mensaje privado que le llega a esa persona<textarea rows={3} value={ar.mensaje} maxLength={900} onChange={(e) => setAr({ ...ar, mensaje: e.target.value })} className={input} /></label>
            <label className="flex flex-col gap-1 text-sm font-semibold">Respuesta pública bajo su comentario (vacío = no responder en público)<input value={ar.publico} maxLength={300} onChange={(e) => setAr({ ...ar, publico: e.target.value })} className={input} /></label>
            <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">Máximo de respuestas por hora<input inputMode="numeric" value={ar.maxPorHora} onChange={(e) => setAr({ ...ar, maxPorHora: e.target.value })} className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 font-mono" /></label>
            <button className={`${btn} self-start`}>Guardar respuesta</button>
          </form>
          <p className="text-xs text-muted">Responde la cuenta, como la cuenta, una sola vez por comentario. Hoy: {d.respuestasHoy} respuestas. El mensaje privado necesita la página de Facebook de la cuenta. Necesita el webhook conectado (ver Conexión).</p>
        </section>
      )}

      <section className={card} aria-labelledby="h-pub">
        <h3 id="h-pub" className="text-lg font-bold">Publicaciones del estudio</h3>
        {s.publicaciones.length ? (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {s.publicaciones.map((p) => <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2"><span><b>{p.cuenta}</b> · {p.texto.slice(0, 80)}{p.texto.length > 80 ? "…" : ""}</span><span className="text-xs text-muted">{day(p.at)} · {p.estado}</span></li>)}
          </ul>
        ) : <p className="text-sm text-muted">Cuando apruebes una publicación de Community manager aparece aquí.</p>}
      </section>

      <section className={card} aria-labelledby="h-mat">
        <h3 id="h-mat" className="text-lg font-bold">Anuncios terminados que el estudio puede usar</h3>
        {d.anuncios.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {d.anuncios.map((a) => <li key={a.id} className="rounded-xl border border-line p-3 text-sm"><b>{a.title || "Sin título"}</b><span className="block text-xs text-muted">{a.format ?? ""} · {day(a.created_at)} · <span className="font-mono">{a.id.slice(0, 8)}</span></span></li>)}
          </ul>
        ) : <p className="text-sm text-muted">Los anuncios que termines en Creads (con tu cuenta) aparecen aquí y los agentes los pueden usar.</p>}
      </section>
    </div>
  );
}

/** Panel → Marketing → Conexiones: the pixel, the Conversions API and the ad account, set from here by the
 * owner or a partner (no Vercel). Tokens are never shown back: only their last 4 characters. */
function Conexiones({ d, reload }: { d: Data; reload: (x: Data) => void }) {
  const v = d.conexiones;
  const [form, setForm] = useState<Partial<Record<ConnKey, string>>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [prueba, setPrueba] = useState<{ item: string; ok: boolean; detalle: string }[] | null>(null);
  const [diag, setDiag] = useState<{ resumen: Record<string, unknown>; pasos: { paso: string; ok: boolean; http?: number; datos?: unknown; error?: Record<string, unknown> }[]; causa: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [guia, setGuia] = useState(false);
  const dirty = Object.values(form).some((x) => x !== undefined);

  async function save(patch: Partial<Record<ConnKey, string>>) {
    setBusy("save"); setMsg(null);
    try {
      const r = await fetch("/api/admin/marketing", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ conexiones: patch }) });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(x.error || "No se pudo guardar.");
      reload(x); setForm({}); setMsg({ ok: true, text: "Guardado. Aprieta «Probar conexión» para revisar que Meta lo acepte." });
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo guardar." }); }
    setBusy("");
  }
  async function probar() {
    setBusy("probar"); setMsg(null); setPrueba(null);
    try {
      const r = await fetch("/api/admin/marketing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ probar: true }) });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(x.error || "No se pudo probar.");
      setPrueba(x.prueba);
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo probar." }); }
    setBusy("");
  }

  async function diagnosticar() {
    setBusy("diag"); setMsg(null); setDiag(null); setCopied(false);
    try {
      const r = await fetch("/api/admin/marketing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ diagnostico: true }) });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(x.error || "No se pudo diagnosticar.");
      setDiag(x.diagnostico);
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "No se pudo diagnosticar." }); }
    setBusy("");
  }

  return (
    <section className={card} aria-labelledby="h-con">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 id="h-con" className="text-lg font-bold">Conexiones con Meta</h3>
          <p className="text-xs text-muted">Píxel, API de conversiones, cuenta publicitaria, página e Instagram. Las puede configurar el dueño o un socio, sin tocar Vercel. Los tokens se guardan cifrados y nunca se vuelven a mostrar.</p>
        </div>
        <span className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setGuia(!guia)} className={btn}>{guia ? "Ocultar guía" : "Guía paso a paso"}</button>
          <button type="button" disabled={!!busy} onClick={probar} className="rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-bg disabled:opacity-50">{busy === "probar" ? "Probando…" : "Probar conexión"}</button>
          <button type="button" disabled={!!busy} onClick={diagnosticar} className={btn}>{busy === "diag" ? "Revisando…" : "Diagnóstico técnico"}</button>
        </span>
      </div>

      {guia && (
        <ol className="flex list-decimal flex-col gap-1.5 rounded-xl border border-line bg-surface-2 p-4 pl-8 text-sm">
          <li>Entra a <a className="text-accent-text underline" href="https://business.facebook.com/settings" target="_blank" rel="noopener noreferrer">Configuración del negocio de Meta</a> con la cuenta que administra el Business Manager de Creads.</li>
          <li><b>Píxel:</b> en <a className="text-accent-text underline" href="https://business.facebook.com/events_manager2" target="_blank" rel="noopener noreferrer">Administrador de eventos</a> copia el ID de tu píxel y pégalo abajo. Ahí mismo, en Configuración → API de conversiones, aprieta «Generar token de acceso» y pégalo en «Token de la API de conversiones».</li>
          <li><b>Usuario del sistema:</b> Configuración del negocio → Usuarios → Usuarios del sistema → «Agregar» (rol administrador). Luego «Asignar activos»: la cuenta publicitaria, la página y la cuenta de Instagram, todas con control total.</li>
          <li>Si todavía no hay una app de Creads: en <a className="text-accent-text underline" href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer">Meta for Developers</a> → «Crear app» → tipo «Empresa» (o «Otro» → «Empresa») → elige el Business Manager de Creads. Después, en Configuración del negocio → Apps, asígnale la app al usuario del sistema.</li>
          <li>Con ese usuario aprieta «Generar nuevo token», elige la app de Creads, caducidad «Nunca» y marca los permisos que dice la ayuda del campo. Copia el token y pégalo en «Token del usuario del sistema».</li>
          <li>Copia los ID de la cuenta publicitaria, la página y la cuenta de Instagram (Configuración del negocio → Cuentas) y pégalos abajo.</li>
          <li>Aprieta <b>Guardar</b> y después <b>Probar conexión</b>: cada parte debe salir con ✓. Si algo sale mal, el mensaje dice qué revisar. También le puedes preguntar al Director de Marketing (botón «Hablar»).</li>
        </ol>
      )}

      <form autoComplete="off" className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(form); }}>
        {CONN_FIELDS.map((f) => {
          const cur = v[f.k];
          return (
            <label key={f.k} className="flex flex-col gap-1 text-sm">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <b>{f.label}</b>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cur.value ? "bg-good/15 text-good" : "bg-surface-2 text-muted"}`}>
                  {cur.value ? `✓ ${f.secret ? `guardado ${cur.value}` : cur.from === "inicial" ? "el de siempre" : "listo"}${cur.from === "vercel" ? " (desde Vercel)" : ""}` : "Falta"}
                </span>
              </span>
              <input type={f.secret ? "password" : "text"} name={`creads-${f.k}`} autoComplete={f.secret ? "new-password" : "off"} data-1p-ignore data-lpignore="true" inputMode={f.secret || f.k === "testEventCode" ? undefined : "numeric"} spellCheck={false} value={form[f.k] ?? ""} placeholder={f.secret ? (cur.value ? "Pega uno nuevo para cambiarlo" : "Pega el token") : cur.value || "Pega el número"}
                onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} className={`${input} font-mono`} />
              <span className="text-xs text-muted">{f.hint}</span>
              {cur.from === "panel" && f.k !== "pixelId" && <button type="button" disabled={!!busy} onClick={() => window.confirm(`¿Quitar «${f.label}»?`) && save({ [f.k]: "" })} className="self-start text-xs text-muted hover:text-bad">Quitar</button>}
            </label>
          );
        })}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={!dirty || !!busy} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">{busy === "save" ? "Guardando…" : "Guardar"}</button>
          {v.updatedAt && <span className="text-xs text-muted">Último cambio: {new Date(v.updatedAt).toLocaleString("es-CL")}{v.by ? ` · ${v.by}` : ""}</span>}
        </div>
      </form>

      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
      {prueba && (
        <ul className="flex flex-col gap-2 rounded-xl border border-line p-3 text-sm">
          {prueba.map((p) => <li key={p.item} className="flex gap-2"><span aria-hidden>{p.ok ? "✅" : "⚠️"}</span><span><b>{p.item}:</b> {p.detalle}</span></li>)}
        </ul>
      )}
      {d.conexion.error && <p className="text-sm text-bad">Meta respondió: {d.conexion.error}</p>}
      {diag && (
        <div className="flex flex-col gap-3 rounded-xl border border-line p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b>Diagnóstico técnico (solo lectura, sin tokens)</b>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(JSON.stringify(diag, null, 2)).then(() => setCopied(true)).catch(() => {}); }} className={btn}>{copied ? "Copiado ✓" : "Copiar para Claude"}</button>
          </div>
          <ul className="flex flex-col gap-1">{diag.causa.map((c, i) => <li key={i} className="flex gap-2"><span aria-hidden>👉</span><span>{c}</span></li>)}</ul>
          <ol className="flex flex-col gap-2">
            {diag.pasos.map((p) => (
              <li key={p.paso} className="rounded-lg bg-surface-2 p-2">
                <span className="font-semibold">{p.ok ? "✅" : "⚠️"} {p.paso}</span>{p.http ? <span className="text-xs text-muted"> · HTTP {p.http}</span> : null}
                <pre className="mt-1 max-h-48 overflow-auto text-xs whitespace-pre-wrap">{JSON.stringify(p.error ?? p.datos, null, 2)}</pre>
              </li>
            ))}
          </ol>
        </div>
      )}

      <details className="rounded-xl border border-line p-4" open={!d.conexion.webhook && !!v.adsToken.value}>
        <summary className="cursor-pointer text-sm font-bold">Respuestas automáticas a comentarios (webhook de Instagram) {d.conexion.webhook ? "· ✓ listo" : "· falta"}</summary>
        <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm">
          <li>En <a className="text-accent-text underline" href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer">Meta for Developers</a> abre la app de Creads → Configuración de la app → Básica → «Clave secreta de la app» → Mostrar. Pégala aquí:
            <form className="mt-2 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (form.appSecret) save({ appSecret: form.appSecret }); }}>
              <input type="password" name="creads-appSecret" autoComplete="new-password" data-1p-ignore data-lpignore="true" spellCheck={false} value={form.appSecret ?? ""} onChange={(e) => setForm({ ...form, appSecret: e.target.value })} placeholder={v.appSecret.value ? `Guardada ${v.appSecret.value} · pega otra para cambiarla` : "Clave secreta de la app"} className={`${input} max-w-sm font-mono`} />
              <button type="submit" disabled={!form.appSecret || !!busy} className={btn}>Guardar</button>
            </form>
          </li>
          <li>Clave de verificación del webhook:{" "}
            {v.webhookToken.value
              ? <><code className="rounded bg-surface-2 px-2 py-0.5 text-xs">{v.webhookToken.value}</code> <button type="button" onClick={() => navigator.clipboard.writeText(v.webhookToken.value).then(() => setMsg({ ok: true, text: "Clave copiada." })).catch(() => {})} className={`${btn} text-xs`}>Copiar</button></>
              : <button type="button" disabled={!!busy} onClick={() => { const a = new Uint8Array(18); crypto.getRandomValues(a); save({ webhookToken: Array.from(a, (x) => x.toString(16).padStart(2, "0")).join("") }); }} className={`${btn} text-xs`}>Crear clave</button>}
          </li>
          <li>En la app → Webhooks (o Casos de uso → Instagram → Webhooks) elige <b>Instagram</b>, aprieta «Suscribirse a este objeto» y pega:
            <span className="mt-1 flex flex-wrap items-center gap-2"><span className="text-xs text-muted">URL de devolución de llamada:</span><code className="rounded bg-surface-2 px-2 py-0.5 text-xs">https://www.creadsia.com/api/meta/webhook</code><button type="button" onClick={() => navigator.clipboard.writeText("https://www.creadsia.com/api/meta/webhook").then(() => setMsg({ ok: true, text: "URL copiada." })).catch(() => {})} className={`${btn} text-xs`}>Copiar</button></span>
            <span className="block text-xs text-muted">Token de verificación: la clave del paso 2. Después activa el campo <b>comments</b>.</span>
          </li>
          <li>Más abajo, en «Respuesta automática», escribe las palabras y el mensaje, y enciéndela.</li>
        </ol>
      </details>
    </section>
  );
}

/** A picture made smaller in the browser (max 1600 px, JPEG) so it uploads fast. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally { URL.revokeObjectURL(url); }
}

/** Marketing → Ideas y referencias: what the team wants to see; the Community manager and Creativos use these first. */
function Ideas({ ideas, reload, patch }: { ideas: Idea[]; reload: (x: Data) => void; patch: (body: unknown) => Promise<boolean> }) {
  const [texto, setTexto] = useState("");
  const [link, setLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [fileKey, setFileKey] = useState(0);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const imagen = file ? await shrink(file) : undefined;
      const r = await fetch("/api/admin/marketing", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nuevaIdea: { texto, link, imagen } }) });
      const x = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(x.error || "No se pudo guardar.");
      reload(x); setTexto(""); setLink(""); setFile(null); setFileKey((k) => k + 1);
      setMsg({ ok: true, text: "Idea guardada. El Community manager y Creativos la van a usar primero." });
    } catch (err) { setMsg({ ok: false, text: err instanceof Error ? err.message : "No se pudo guardar." }); }
    setBusy(false);
  }
  return (
    <section className={card} aria-labelledby="h-ideas">
      <div className="flex flex-col gap-1">
        <h3 id="h-ideas" className="text-lg font-bold">Ideas y referencias del equipo</h3>
        <p className="text-xs text-muted">Deja aquí lo que tienes en mente: una idea, el link de un video viral o una imagen de referencia. El Community manager, Creativos y el Director de Marketing las usan antes que sus propias ideas.</p>
      </div>
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2"><b>La idea</b>
          <textarea rows={2} value={texto} maxLength={1500} onChange={(e) => setTexto(e.target.value)} placeholder="Ej: un video tipo «antes y después» mostrando cómo un guion se vuelve video en 60 segundos, con música en tendencia" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm"><b>Link de referencia (opcional)</b>
          <input type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://www.instagram.com/reel/…" className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm"><b>Imagen de referencia (opcional)</b>
          <input key={fileKey} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={busy || (!texto.trim() && !link.trim() && !file)} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">{busy ? "Guardando…" : "Guardar idea"}</button>
          {msg && <span role="status" className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</span>}
        </div>
      </form>
      {ideas.length > 0 && (
        <ul className="flex flex-col divide-y divide-line">
          {ideas.slice(0, 30).map((i) => (
            <li key={i.id} className={`flex gap-3 py-3 ${i.estado === "nueva" ? "" : "opacity-60"}`}>
              {i.imagenUrl && <a href={i.imagenUrl} target="_blank" rel="noopener noreferrer" className="shrink-0"><img src={i.imagenUrl} alt="Referencia" className="h-16 w-16 rounded-lg border border-line object-cover" /></a>}
              <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                {i.texto && <p className="whitespace-pre-wrap">{i.texto}</p>}
                {i.link && <a href={i.link} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-accent-text underline">{i.link}</a>}
                <span className="text-xs text-muted">{new Date(i.at).toLocaleDateString("es-CL")} · {i.by} · {i.estado === "nueva" ? "por usar" : i.estado}</span>
              </div>
              <span className="flex shrink-0 flex-col gap-1 text-xs">
                {i.estado === "nueva"
                  ? <button type="button" onClick={() => patch({ idea: i.id, estado: "usada" })} className="text-muted hover:text-ink">Marcar usada</button>
                  : <button type="button" onClick={() => patch({ idea: i.id, estado: "nueva" })} className="text-muted hover:text-ink">Volver a usar</button>}
                <button type="button" onClick={() => window.confirm("¿Borrar esta idea?") && patch({ borrarIdea: i.id })} className="text-muted hover:text-bad">Borrar</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const PROD_LABEL: Record<ProdJob["estado"], string> = { cola: "En cola", cortes: "Dividiendo el guion", escenas: "Dirigiendo escenas", generando: "Generando video", revisando: "Revisión de calidad", armando: "Armando con subtítulos y sello", listo: "✓ Listo", error: "⚠ Se detuvo" };

/** Marketing → Producción automática: approved requests become finished videos without anyone in the studio. */
function Produccion({ d, patch }: { d: Data; patch: (body: unknown) => Promise<boolean> }) {
  const a = d.autoProd;
  const jobs = d.estado.produccion ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const hoy = jobs.filter((j) => j.estado !== "cola" && j.at.slice(0, 10) === today).length;
  return (
    <section className={card} aria-labelledby="h-prod">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 id="h-prod" className="text-lg font-bold">Producción automática de videos</h3>
          <p className="text-xs text-muted">Cuando apruebas un pedido de video (de Creativos o del Community manager), Creads lo hace solo: divide el guion, dirige las escenas, genera, revisa la calidad, lo arma con subtítulos {a.sello ? "y el sello «Hecho con Creads IA»" : ""} y lo deja en el banco de contenido. Avanza cada 5 minutos; un video toma unos 15–30 minutos.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={a.on} onChange={(e) => patch({ autoProd: { on: e.target.checked } })} className="h-4 w-4 accent-[var(--accent)]" />Encendida</label>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">Máximo de videos nuevos al día
          <select value={a.maxPorDia} onChange={(e) => patch({ autoProd: { maxPorDia: Number(e.target.value) } })} className="rounded-lg border border-line bg-surface px-2 py-1">
            {[1, 2, 3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">Modelo
          <select value={a.modelo} onChange={(e) => patch({ autoProd: { modelo: e.target.value } })} className="rounded-lg border border-line bg-surface px-2 py-1">
            <option value="">El más económico disponible</option>
            {d.modelosVideo.map((m) => <option key={m.id} value={m.id}>{m.label} (~US${(m.usdPorSeg * 30).toFixed(2)} por video de 30 s)</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={a.sello} onChange={(e) => patch({ autoProd: { sello: e.target.checked } })} className="accent-[var(--accent)]" />Sello «Hecho con Creads IA»</label>
        <span className="text-xs text-muted">Hoy: {hoy} de {a.maxPorDia}</span>
      </div>
      {jobs.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {jobs.slice(0, 15).map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="flex min-w-0 flex-col">
                <b className="truncate">{j.titulo}</b>
                <span className={`text-xs ${j.estado === "error" ? "text-bad" : "text-muted"}`}>{PROD_LABEL[j.estado]}{j.estado === "error" ? `: ${j.error ?? ""}` : j.paso ? ` · ${j.paso}` : ""}</span>
              </span>
              <span className="flex gap-2">
                {j.videoUrl && <a href={j.videoUrl} target="_blank" rel="noopener noreferrer" className={btn}>Ver video</a>}
                {j.estado === "error" && <button type="button" onClick={() => patch({ reintentar: j.pedidoId })} className={btn}>Reintentar</button>}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">Todavía no hay videos en producción. Aprueba un pedido de video y aparece aquí.</p>}
    </section>
  );
}
