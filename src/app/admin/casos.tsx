"use client";

import { useCallback, useEffect, useState } from "react";
import { type AccionAdmin, type Caso, type EstadoCaso, DIA_TESTIMONIO, ESTADO_LABEL, transicion } from "@/lib/caso-fundador";

// Clientes → Casos fundador: who ticked the box at the Pack Prueba checkout (they asked for help with their
// first campaign), the testimonials received on day 14, and approve / publish / unpublish. «Beneficio» is what
// they got in exchange, if anything: it's shown next to the testimonial.

type Fila = Caso & { imagenUrl: string | null };

const card = "flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const btn = "rounded-lg border border-line px-2.5 py-1 text-xs font-semibold hover:bg-surface-2 disabled:opacity-50";
const fecha = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "2-digit" }) : "—");
const TONO: Record<EstadoCaso, string> = {
  inscrito: "bg-surface-2 text-muted", pedido: "bg-warn/15 text-warn", recibido: "bg-accent/15 text-accent-text",
  aprobado: "bg-good/15 text-good", publicado: "bg-good/25 text-good",
};
const ACCION_LABEL: Record<AccionAdmin, string> = { aprobar: "Aprobar", publicar: "Publicar", despublicar: "Despublicar" };

export default function CasosAdmin() {
  const [casos, setCasos] = useState<Fila[] | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [beneficio, setBeneficio] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    fetch("/api/admin/casos").then((r) => r.json()).then((j) => { if (j.error) setErr(j.error); else { setErr(""); setCasos(j.casos); } }).catch(() => setErr("No se pudo cargar. Revisa tu conexión."));
  }, []);
  useEffect(load, [load]);

  async function post(body: Record<string, unknown>, key: string) {
    setBusy(key); setErr("");
    const r = await fetch("/api/admin/casos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy("");
    if (!r?.ok) return setErr(j.error || "No se pudo guardar.");
    load();
  }

  if (err && !casos) return <section className={card}><p role="alert" className="text-sm text-bad">{err}</p></section>;
  if (!casos) return <section className={card}><p className="text-muted">Cargando casos…</p></section>;
  const cuenta = (e: EstadoCaso) => casos.filter((c) => c.estado === e).length;

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div>
          <h2 className="font-display text-xl font-bold">Casos fundador</h2>
          <p className="max-w-3xl text-sm text-muted">
            Clientes que marcaron la casilla opcional al comprar el Pack Prueba: pidieron ayuda para armar su primera campaña y dieron permiso para mostrar sus anuncios y resultados.
            {` El día ${DIA_TESTIMONIO} después del pago les llega un correo pidiendo su testimonio (solo con los correos de comportamiento encendidos). Nada se muestra en el sitio hasta que lo apruebas y lo publicas.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {(Object.keys(ESTADO_LABEL) as EstadoCaso[]).map((e) => <span key={e} className={`rounded-full px-2.5 py-1 font-semibold ${TONO[e]}`}>{ESTADO_LABEL[e]}: {cuenta(e)}</span>)}
        </div>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      </section>

      {!casos.length ? <section className={card}><p className="text-sm text-muted">Todavía nadie marcó la casilla. Aparece en el pago del Pack Prueba (Primera tanda y Planes).</p></section> : casos.map((c) => {
        const t = c.testimonio;
        const b = beneficio[c.userId] ?? c.beneficio ?? "";
        return (
          <section key={c.userId} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <b>{c.name || c.email}</b> <span className="text-xs text-muted">· {c.email} · cuenta {c.ws}</span>
                <p className="text-xs text-muted">Marcó la casilla el {fecha(c.ayuda.fecha)} (pedido {c.pedido}){c.pedidoEn ? ` · correo del día ${DIA_TESTIMONIO}: ${fecha(c.pedidoEn)}` : ""}{t ? ` · testimonio: ${fecha(t.enviado)}` : ""}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONO[c.estado]}`}>{ESTADO_LABEL[c.estado]}</span>
            </div>
            {c.estado === "inscrito" && <p className="text-sm">Pidió ayuda con su primera campaña: vale la pena escribirle.</p>}
            {t && (
              <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3 text-sm">
                <p className="whitespace-pre-wrap">«{t.texto}»</p>
                <p className="text-xs text-muted">— {t.nombre}{t.rubro ? `, ${t.rubro}` : ""}</p>
                {c.imagenUrl && (
                  <a href={c.imagenUrl} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.imagenUrl} alt="Captura de Meta" className="max-h-56 rounded-lg border border-line" />
                  </a>
                )}
                <p className="text-xs text-muted">{t.permiso ? `Permiso para mostrarlo: ${fecha(t.permiso.fecha)} · «${t.permiso.texto}»` : "Sin permiso para mostrarlo (lo retiró)."}</p>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {(["aprobar", "publicar", "despublicar"] as AccionAdmin[]).filter((a) => transicion(c, a)).map((a) => (
                <button key={a} type="button" className={btn} disabled={Boolean(busy)} onClick={() => post({ accion: a, userId: c.userId }, `${c.userId}:${a}`)}>{busy === `${c.userId}:${a}` ? "Guardando…" : ACCION_LABEL[a]}</button>
              ))}
              <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted">
                Beneficio
                <input value={b} onChange={(e) => setBeneficio((x) => ({ ...x, [c.userId]: e.target.value }))} placeholder="Ej.: 1 mes de Escala gratis (vacío si no recibió nada)" maxLength={200} className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 py-1 text-sm text-ink" />
              </label>
              <button type="button" className={btn} disabled={Boolean(busy) || b === (c.beneficio ?? "")} onClick={() => post({ accion: "beneficio", userId: c.userId, beneficio: b }, `${c.userId}:beneficio`)}>Guardar beneficio</button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
