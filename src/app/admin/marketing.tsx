"use client";

import { useCallback, useEffect, useState } from "react";
import type { CampaignView, MarketingState, Pedido } from "@/lib/marketing";
import { TO_CREAR_KEY } from "@/lib/guiones";

// Panel → Marketing: the marketing studio's controls. Connection with Meta, the daily cap, the campaigns
// (live from Meta), the ad requests from Creativos, the brand's Instagram accounts and the automatic reply.
// The agents (Oficina) propose; the owner approves in Oficina → «Por aprobar».

interface Data {
  conexion: { anuncios: boolean; token: boolean; instagramAnuncios: boolean; webhook: boolean; pixel: boolean; error: string };
  estado: MarketingState; campanasMeta: CampaignView[]; moneda: string | null;
  anuncios: { id: string; title: string | null; format: string | null; final_url: string; created_at: string }[];
}

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const btn = "rounded-lg border border-line px-3 py-1.5 text-sm font-semibold disabled:opacity-50";
const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm";
const usd = (n: number | null) => (n === null ? "—" : `US$${n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const day = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short" });

function Check({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${ok ? "bg-good/15 text-good" : "bg-surface-2 text-muted"}`}>{ok ? "✓ Listo" : "Falta"}</span>
      <span className="flex flex-col"><b className="text-sm">{label}</b><span className="text-xs text-muted">{hint}</span></span>
    </li>
  );
}

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

      <section className={card} aria-labelledby="h-con">
        <h3 id="h-con" className="text-lg font-bold">Conexión con Meta</h3>
        <ul className="flex flex-col gap-3">
          <Check ok={c.anuncios} label="Cuenta publicitaria y página" hint="Vercel: META_ADS_TOKEN (token del usuario del sistema), META_AD_ACCOUNT_ID (empieza con act_) y META_PAGE_ID." />
          <Check ok={c.pixel} label="Píxel" hint="Ya instalado en la web. Lo usan las campañas de leads o ventas para optimizar." />
          <Check ok={c.instagramAnuncios} label="Instagram en los anuncios (opcional)" hint="META_IG_USER_ID: la cuenta de Instagram con la que salen los anuncios." />
          <Check ok={c.webhook} label="Respuestas automáticas a comentarios" hint="META_APP_SECRET y META_WEBHOOK_VERIFY_TOKEN, y en la app de Meta el webhook de Instagram (comments) apuntando a https://www.creadsia.com/api/meta/webhook." />
        </ul>
        {c.error && <p className="text-sm text-bad">Meta respondió: {c.error}</p>}
        <p className="text-xs text-muted">Cuando quieras conectar, pídele a Claude la guía paso a paso (unos 30–40 minutos). Nada de esto muestra tus claves.</p>
      </section>

      <section className={card} aria-labelledby="h-tope">
        <h3 id="h-tope" className="text-lg font-bold">Tope de gasto en campañas</h3>
        <form className="flex flex-wrap items-center gap-2 text-sm" onSubmit={(e) => { e.preventDefault(); call("PATCH", { capUsd: Number(cap.replace(",", ".")) }, true); }}>
          <label htmlFor="mk-cap">Máximo por día, sumando todas las campañas activas (US$)</label>
          <input id="mk-cap" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} className="w-24 rounded-lg border border-line bg-surface px-2 py-1.5 font-mono" />
          <button className={btn}>Guardar</button>
        </form>
        <p className="text-xs text-muted">Ningún agente puede activar una campaña ni subir un presupuesto si eso pasa este tope. Las campañas nuevas siempre se suben en pausa.</p>
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
                <button type="button" onClick={() => openInCrear(p)} className={`${btn} self-start`}>Abrir en Crear anuncio</button>
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
          <input aria-label="Número de la página de Facebook (opcional)" placeholder="Página de Facebook (opcional)" inputMode="numeric" value={nueva.pageId} onChange={(e) => setNueva({ ...nueva, pageId: e.target.value.trim() })} className={`${input} font-mono`} />
          <button className={btn}>Agregar</button>
        </form>
        <p className="text-xs text-muted">Cada cuenta debe decir en su bio que el contenido está hecho con Creads IA. Así el tráfico orgánico es transparente y Meta no la marca como no auténtica.</p>
      </section>

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
          <p className="text-xs text-muted">Responde la cuenta, como la cuenta, una sola vez por comentario. Hoy: {s.respuestas.day === new Date().toISOString().slice(0, 10) ? s.respuestas.count : 0} respuestas. Necesita el webhook conectado (ver Conexión).</p>
        </section>
      )}

      <section className={card} aria-labelledby="h-pub">
        <h3 id="h-pub" className="text-lg font-bold">Publicaciones del estudio</h3>
        {s.publicaciones.length ? (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {s.publicaciones.map((p) => <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2"><span><b>{p.cuenta}</b> · {p.texto.slice(0, 80)}{p.texto.length > 80 ? "…" : ""}</span><span className="text-xs text-muted">{day(p.at)} · {p.estado}</span></li>)}
          </ul>
        ) : <p className="text-sm text-muted">Cuando apruebes una publicación de Contenido orgánico aparece aquí.</p>}
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
