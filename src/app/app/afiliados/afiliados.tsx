"use client";

import { useCallback, useEffect, useState } from "react";
import { Field, PageHead, btnCls, cardCls, ghostCls, inputCls } from "../_parts/ui";
import { type DatosPago, type EstadoAfiliado, METODO_LABEL, type MetodoPago, PROGRAMA } from "@/lib/afiliados-calc";

// The affiliate's own page: apply, then their link and code, what they brought and earned, and where to pay them.

const SITE = "https://www.creadsia.com";
const usd = (n: number) => `US$${(Math.round(n * 100) / 100).toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

interface Numeros { clics: number; registros: number; pagaron: number; pagando: number; mrr: number; pendiente: number; pagable: number; pagado: number; revertido: number; listo: boolean }
interface Data {
  afiliado: null | { code: string; estado: EstadoAfiliado; name: string; canal?: string; web?: string; creado: string; aprobado?: string; pago: DatosPago | null };
  user?: { name: string; email: string };
  numeros?: Numeros;
  referidos?: { email: string; at: string; via: "link" | "codigo"; meses: number }[];
  comisiones?: { id: string; at: string; label?: string; meses: number[]; baseUsd: number; pct: number; usd: number; estado: "activa" | "revertida"; pagadoEn: string | null }[];
  error?: string;
}

export default function Afiliados() {
  const [d, setD] = useState<Data | null>(null);
  const load = useCallback(() => {
    fetch("/api/afiliados").then((r) => r.json()).then(setD).catch(() => setD({ afiliado: null, error: "No pudimos cargar tu cuenta de afiliado. Revisa tu conexión y recarga." }));
  }, []);
  useEffect(load, [load]);

  const lead = `Gana ${PROGRAMA.pctTramo1}% de lo que paga cada cliente que traigas en sus meses 1 a ${PROGRAMA.mesesTramo1}, y ${PROGRAMA.pctTramo2}% hasta su mes ${PROGRAMA.maxMeses}.`;
  if (!d) return <><PageHead title="Programa de afiliados" lead={lead} /><p className="text-muted">Cargando…</p></>;
  if (d.error) return <><PageHead title="Programa de afiliados" lead={lead} /><p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm">{d.error}</p></>;
  const a = d.afiliado;

  return (
    <>
      <PageHead title="Programa de afiliados" lead={lead}>
        <a href="/afiliados" className={ghostCls}>Cómo funciona</a>
      </PageHead>
      {!a ? (
        <Postular user={d.user} onDone={load} />
      ) : a.estado === "rechazado" ? (
        <section className={cardCls}><p>Revisamos tu postulación y por ahora no podemos sumarte al programa. Si crees que es un error, escríbenos a hola@creadsia.com.</p></section>
      ) : (
        <>
          {a.estado === "pendiente" && (
            <section className={`${cardCls} border-warn/50`} role="status">
              <h2 className="font-display text-lg font-bold">Tu postulación está en revisión</h2>
              <p className="text-sm text-muted">Te avisamos por correo cuando la aprobemos. Mientras, puedes dejar listos tus datos de pago. Tu código será <b className="font-mono text-ink">{a.code}</b>.</p>
            </section>
          )}
          {a.estado === "pausado" && (
            <section className={`${cardCls} border-warn/50`} role="status">
              <p className="text-sm">Tu cuenta de afiliado está <b>pausada</b>: por ahora tu enlace no asocia clientes nuevos ni genera comisiones. Escríbenos a hola@creadsia.com si tienes dudas.</p>
            </section>
          )}
          {a.estado !== "pendiente" && <TuEnlace code={a.code} />}
          {d.numeros && a.estado !== "pendiente" && <Resumen n={d.numeros} />}
          <DatosDePago key={a.pago?.actualizado ?? "nuevo"} actual={a.pago} onSaved={load} />
          {a.estado !== "pendiente" && <Detalle d={d} />}
        </>
      )}
      <p className="text-xs text-muted">Al participar aceptas los <a href="/afiliados/terminos" className="underline">términos del programa de afiliados</a>.</p>
    </>
  );
}

function Copiar({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-surface-2 p-1.5 pl-3">
      <code className="min-w-0 flex-1 truncate font-mono text-sm">{text}</code>
      <button type="button" aria-label={`Copiar ${label}`} onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1800); }).catch(() => {})}
        className="shrink-0 rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-bg">{done ? "Copiado" : "Copiar"}</button>
    </div>
  );
}

function TuEnlace({ code }: { code: string }) {
  return (
    <section className={cardCls} aria-labelledby="enlace">
      <h2 id="enlace" className="font-display text-lg font-bold">Tu enlace y tu código</h2>
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <Field label="Enlace (funciona en cualquier página de Creads)"><Copiar text={`${SITE}/?ref=${code}`} label="enlace" /></Field>
        <Field label="Código para escribir al registrarse"><Copiar text={code} label="código" /></Field>
      </div>
      <p className="text-sm text-muted">Tu enlace queda guardado {PROGRAMA.cookieDias} días en el navegador de quien hace clic (gana el último clic). También puedes enviar directo a <span className="font-mono">{SITE}/registro?ref={code}</span>.</p>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl bg-surface-2 p-3">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <b className="font-mono text-xl tabular-nums">{value}</b>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

function Resumen({ n }: { n: Numeros }) {
  const falta = Math.max(0, PROGRAMA.minimoUsd - n.pagable);
  return (
    <section className={cardCls} aria-labelledby="numeros">
      <h2 id="numeros" className="font-display text-lg font-bold">Lo que traes</h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Clics en tu enlace" value={n.clics.toLocaleString("es-CL")} />
        <Stat label="Cuentas creadas" value={n.registros.toLocaleString("es-CL")} />
        <Stat label="Clientes pagando hoy" value={n.pagando.toLocaleString("es-CL")} sub={`${n.pagaron} pagaron alguna vez`} />
        <Stat label="Ingreso mensual que traes" value={usd(n.mrr)} sub="lo que pagan al mes tus clientes activos" />
      </div>
      <h3 className="font-semibold">Tus comisiones</h3>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Stat label="Pendiente" value={usd(n.pendiente)} sub={`queda disponible ${PROGRAMA.retencionDias} días después de cada pago`} />
        <Stat label="Disponible para pago" value={usd(n.pagable)} sub={n.listo ? "entra en el próximo pago mensual" : `faltan ${usd(falta)} para el mínimo de US$${PROGRAMA.minimoUsd}`} />
        <Stat label="Pagado" value={usd(n.pagado)} sub={n.revertido ? `${usd(Math.abs(n.revertido))} anulado por reembolsos` : undefined} />
      </div>
    </section>
  );
}

function DatosDePago({ actual, onSaved }: { actual: DatosPago | null; onSaved: () => void }) {
  const [p, setP] = useState<DatosPago>(actual ?? { metodo: "paypal", titular: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof DatosPago) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setP({ ...p, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await fetch("/api/afiliados", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: "pago", ...p }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setMsg({ ok: false, text: j.error || "No se pudo guardar. Revisa tu conexión." });
    setMsg({ ok: true, text: "Datos de pago guardados." });
    onSaved();
  }

  return (
    <form onSubmit={save} className={cardCls} aria-labelledby="pago">
      <div>
        <h2 id="pago" className="font-display text-lg font-bold">Dónde te pagamos</h2>
        <p className="text-sm text-muted">Pagamos una vez al mes cuando tu saldo disponible llega a US${PROGRAMA.minimoUsd}. Solo el equipo de Creads ve estos datos.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Método">
          <select value={p.metodo} onChange={(e) => setP({ ...p, metodo: e.target.value as MetodoPago })} className={inputCls}>
            {PROGRAMA.metodos.map((m) => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
          </select>
        </Field>
        <Field label="Nombre del titular"><input required value={p.titular} onChange={set("titular")} autoComplete="name" className={inputCls} /></Field>
        {p.metodo !== "banco" ? (
          <Field label={`Correo de tu cuenta ${METODO_LABEL[p.metodo]}`}><input type="email" required value={p.correo ?? ""} onChange={set("correo")} className={inputCls} /></Field>
        ) : (
          <>
            <Field label="País"><input value={p.pais ?? ""} onChange={set("pais")} autoComplete="country-name" className={inputCls} /></Field>
            <Field label="Banco"><input required value={p.banco ?? ""} onChange={set("banco")} className={inputCls} /></Field>
            <Field label="Tipo de cuenta" hint="Por ejemplo: corriente, vista, ahorro."><input value={p.tipoCuenta ?? ""} onChange={set("tipoCuenta")} className={inputCls} /></Field>
            <Field label="Número de cuenta (o IBAN)"><input required value={p.cuenta ?? ""} onChange={set("cuenta")} className={inputCls} /></Field>
            <Field label="RUT o identificación del titular"><input value={p.idFiscal ?? ""} onChange={set("idFiscal")} className={inputCls} /></Field>
            <Field label="SWIFT / BIC" hint="Solo si tu banco está fuera de Chile."><input value={p.swift ?? ""} onChange={set("swift")} className={inputCls} /></Field>
          </>
        )}
        <Field label="Notas (opcional)"><input value={p.notas ?? ""} onChange={set("notas")} className={inputCls} /></Field>
      </div>
      <button type="submit" disabled={busy} className={`${btnCls} self-start`}>{busy ? "Guardando…" : "Guardar datos de pago"}</button>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </form>
  );
}

function Detalle({ d }: { d: Data }) {
  const cs = d.comisiones ?? [];
  const rs = d.referidos ?? [];
  const th = "px-2 py-1.5 text-left text-xs font-semibold text-muted";
  const td = "px-2 py-1.5 border-t border-line";
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
      <section className={cardCls} aria-labelledby="mov">
        <h2 id="mov" className="font-display text-lg font-bold">Comisiones</h2>
        {!cs.length ? <p className="text-sm text-muted">Todavía no hay pagos de tus clientes.</p> : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr><th className={th}>Fecha</th><th className={th}>Pago</th><th className={`${th} text-right`}>Mes</th><th className={`${th} text-right`}>Pagó</th><th className={`${th} text-right`}>Comisión</th><th className={th}>Estado</th></tr></thead>
              <tbody>
                {cs.map((c) => (
                  <tr key={c.id + c.at}>
                    <td className={`${td} whitespace-nowrap`}>{fecha(c.at)}</td>
                    <td className={td}>{c.label ?? "Pago"}</td>
                    <td className={`${td} text-right font-mono`}>{c.meses.length > 1 ? `${c.meses[0]}–${c.meses[c.meses.length - 1]}` : c.meses[0] ?? ""}</td>
                    <td className={`${td} text-right font-mono`}>{usd(c.baseUsd)}</td>
                    <td className={`${td} text-right font-mono`}>{usd(c.usd)}<br /><span className="text-xs text-muted">{c.pct}%</span></td>
                    <td className={td}>{c.estado === "revertida" ? <span className="text-bad">Anulada (reembolso)</span> : c.pagadoEn ? <span className="text-good">Pagada {fecha(c.pagadoEn)}</span> : c.usd < 0 ? "Se descuenta del próximo pago" : Date.parse(c.at) + PROGRAMA.retencionDias * 86_400_000 > Date.now() ? "Pendiente" : "Disponible"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className={cardCls} aria-labelledby="refs">
        <h2 id="refs" className="font-display text-lg font-bold">Cuentas que llegaron por ti</h2>
        {!rs.length ? <p className="text-sm text-muted">Todavía nadie creó su cuenta con tu enlace o tu código.</p> : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {rs.map((r, i) => (
              <li key={r.email + r.at + i} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate font-mono">{r.email}</span>
                <span className="shrink-0 text-xs text-muted">{fecha(r.at)} · {r.via === "codigo" ? "código" : "enlace"} · {r.meses ? `${r.meses} ${r.meses === 1 ? "mes pagado" : "meses pagados"}` : "aún no paga"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const CANALES = ["YouTube", "Instagram o TikTok", "Blog o web", "Newsletter o comunidad", "Agencia o consultoría", "Cursos de marketing", "Otro"];

function Postular({ user, onDone }: { user?: { name: string; email: string }; onDone: () => void }) {
  const [f, setF] = useState({ name: user?.name ?? "", canal: CANALES[0], web: "", code: "", mensaje: "", acepta: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const r = await fetch("/api/afiliados", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accion: "postular", ...f }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setErr(j.error || "No se pudo enviar. Revisa tu conexión.");
    onDone();
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[2fr_3fr]">
      <section className={cardCls}>
        <h2 className="font-display text-lg font-bold">Así funciona</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted">
          <li><b className="text-ink">{PROGRAMA.pctTramo1}%</b> de lo que paga cada cliente en sus meses 1 a {PROGRAMA.mesesTramo1}.</li>
          <li><b className="text-ink">{PROGRAMA.pctTramo2}%</b> en sus meses {PROGRAMA.mesesTramo1 + 1} a {PROGRAMA.maxMeses}.</li>
          <li>Tu enlace dura {PROGRAMA.cookieDias} días (gana el último clic). También sirve tu código.</li>
          <li>Pago mensual desde US${PROGRAMA.minimoUsd}, por PayPal, Wise o transferencia.</li>
          <li>Sin pujar por la marca Creads, sin spam, sin autorreferidos y sin prometer ingresos.</li>
        </ul>
      </section>
      <form onSubmit={send} className={cardCls} aria-labelledby="postular">
        <h2 id="postular" className="font-display text-lg font-bold">Postula al programa</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Tu nombre o el de tu marca"><input required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} /></Field>
          <Field label="Dónde vas a recomendar Creads">
            <select value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })} className={inputCls}>{CANALES.map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label="Tu web o redes" hint="Un enlace para conocer tu canal."><input required value={f.web} onChange={(e) => setF({ ...f, web: e.target.value })} placeholder="https://" className={inputCls} /></Field>
          <Field label="Código que te gustaría (opcional)" hint="De 3 a 20 letras o números. Si lo dejas vacío, te damos uno.">
            <input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20) })} className={inputCls} />
          </Field>
        </div>
        <Field label="Cuéntanos cómo lo vas a promocionar (opcional)"><textarea rows={3} value={f.mensaje} onChange={(e) => setF({ ...f, mensaje: e.target.value })} className={inputCls} /></Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" required checked={f.acepta} onChange={(e) => setF({ ...f, acepta: e.target.checked })} className="mt-1" />
          <span>Leí y acepto los <a href="/afiliados/terminos" target="_blank" className="underline">términos del programa de afiliados</a>.</span>
        </label>
        <button type="submit" disabled={busy} className={`${btnCls} self-start`}>{busy ? "Enviando…" : "Enviar postulación"}</button>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
      </form>
    </div>
  );
}
