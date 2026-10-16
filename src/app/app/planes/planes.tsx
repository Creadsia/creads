"use client";

import { useEffect, useMemo, useState } from "react";
import { type ItemId, LAUNCH_PCT, METHODS, type MethodId, PACKS, PLANS, type Period, quote } from "@/lib/catalog";
import { PageHead, btnCls, cardCls, ghostCls } from "../_parts/ui";
import { useCredits } from "../_parts/use-credits";

// Plans and credits: choose a plan or a top-up, see exactly what you'll pay, pick how to pay.
// Online payment isn't connected yet: the order is saved and Creadsia finishes it with the customer.

interface OrderRow { id: string; label: string; total: number; status: string; created: string }
interface PayInfo { online: boolean; owner: boolean; firstPurchase: boolean; discount: number; orders: OrderRow[] }

const usd = (n: number) => `US$${n.toLocaleString("es-CL", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const clp = (n: number) => `≈ $${(Math.round((n * 950) / 100) * 100).toLocaleString("es-CL")} CLP`;
const STATUS: Record<string, [string, string]> = {
  pendiente: ["Esperando pago", "bg-warn/15 text-warn"],
  pagado: ["Pagado", "bg-good/15 text-good"],
  cancelado: ["Cancelado", "bg-surface-2 text-muted"],
};

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden="true">
      <path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Planes() {
  const { info } = useCredits();
  const [pay, setPay] = useState<PayInfo | null>(null);
  const [tab, setTab] = useState<"planes" | "creditos">("planes");
  const [period, setPeriod] = useState<Period>("mensual");
  const [item, setItem] = useState<ItemId | null>(null);
  const [method, setMethod] = useState<MethodId>("tarjeta");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ id: string; label: string; total: number; method: MethodId } | null>(null);

  const load = () => fetch("/api/pagos").then((r) => (r.ok ? r.json() : null)).then(setPay).catch(() => {});
  useEffect(() => { load(); }, []);

  const opts = { discountPct: pay?.discount ?? 0, firstPurchase: pay?.firstPurchase ?? true };
  const q = useMemo(() => (item ? quote(item, period, opts) : null), [item, period, opts.discountPct, opts.firstPurchase]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentPlan = info?.plan ?? null;

  function choose(id: ItemId) {
    setItem(id); setDone(null); setErr("");
    requestAnimationFrame(() => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setBusy(true); setErr("");
    const r = await fetch("/api/pagos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item, period, method }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error || "No se pudo crear el pedido.");
    setDone(d.order); setItem(null); load();
    requestAnimationFrame(() => document.getElementById("pedido-ok")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  return (
    <>
      <PageHead title="Planes y créditos" lead="Elige un plan o suma créditos. Ves el precio exacto antes de pagar y puedes cancelar cuando quieras." />

      {pay?.owner && (
        <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <b>Vista de cliente.</b> Así ven esta página tus clientes. Los pagos en línea (tarjeta y Mercado Pago) todavía no están conectados: por ahora cada pedido te llega al Panel interno y lo marcas como pagado.
        </p>
      )}

      {/* where the account stands */}
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Tu cuenta">
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
          <span className="text-xs font-semibold text-muted">Créditos disponibles</span>
          <span className="font-mono text-3xl font-bold tabular-nums">{!info ? "…" : info.unlimited ? "∞" : (info.balance ?? 0).toLocaleString("es-CL")}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
          <span className="text-xs font-semibold text-muted">Tu plan</span>
          <span className="text-xl font-bold">{info?.unlimited ? "Dueño" : currentPlan ?? "Sin plan todavía"}</span>
          {info?.paidUntil && <span className={`text-sm ${info.expired ? "text-bad" : "text-muted"}`}>{info.expired ? "Venció" : "Se renueva"} el {new Date(`${info.paidUntil}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}</span>}
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
          <span className="text-xs font-semibold text-muted">Cómo se usan</span>
          <span className="text-sm text-muted">Cada video, imagen o voz descuenta créditos según el modelo. Si algo falla, vuelven solos.</span>
        </div>
      </section>

      {done && (
        <section id="pedido-ok" className={`${cardCls} scroll-mt-20 border-good/50`} aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold">Pedido <span className="whitespace-nowrap">{done.id}</span> recibido</h2>
              <p className="text-sm text-muted">{done.label} · {usd(done.total)}</p>
            </div>
            <span className="rounded-full bg-warn/15 px-3 py-1 text-sm font-semibold text-warn">Esperando pago</span>
          </div>
          <p className="text-sm">
            {pay?.online
              ? "Te llevamos a la ventana de pago."
              : done.method === "transferencia"
                ? "Te enviaremos los datos para transferir a tu correo. Apenas llegue el pago, tus créditos aparecen aquí."
                : "El pago en línea se activa muy pronto. Te escribimos a tu correo con un link de pago seguro; apenas pagues, tus créditos aparecen aquí."}
          </p>
          <p className="text-xs text-muted">¿Dudas? Escríbenos a hola@creadsia.com con tu número de pedido.</p>
        </section>
      )}

      {/* what to buy */}
      <div role="tablist" aria-label="Qué quieres comprar" className="flex gap-1 border-b border-line">
        {([["planes", "Planes mensuales"], ["creditos", "Solo créditos"]] as const).map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === k ? "border-accent-text text-ink" : "border-transparent text-muted hover:text-ink"}`}>{l}</button>
        ))}
      </div>

      {tab === "planes" ? (
        <section className="flex flex-col gap-4" aria-label="Planes">
          <div className="flex flex-wrap items-center gap-3">
            <div role="radiogroup" aria-label="Forma de pago del plan" className="inline-flex rounded-xl border border-line bg-surface p-1">
              {(["mensual", "anual"] as const).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${period === p ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>{p === "mensual" ? "Mensual" : "Anual"}</button>
              ))}
            </div>
            <span className="rounded-full bg-good/15 px-3 py-1 text-sm font-semibold text-good">{period === "anual" ? "2 meses gratis" : pay?.firstPurchase ? `−${LAUNCH_PCT}% el primer mes` : "Cancela cuando quieras"}</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {PLANS.map((p) => {
              const featured = p.id === "plus";
              const mine = currentPlan === p.name;
              const perMonth = period === "anual" ? p.yearlyPerMonth : p.monthly;
              const first = period === "mensual" && pay?.firstPurchase ? p.monthly * (1 - LAUNCH_PCT / 100) : null;
              return (
                <article key={p.id} className={`relative flex flex-col gap-4 rounded-2xl p-5 ${featured ? "border-2 border-transparent bg-surface [background:linear-gradient(var(--surface),var(--surface))_padding-box,var(--grad)_border-box]" : "border border-line bg-surface"} ${item === p.id ? "ring-2 ring-accent-text/60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xl font-extrabold">{p.name}</h3>
                    {mine ? <span className="rounded-full bg-good/15 px-2.5 py-0.5 text-xs font-bold text-good">Tu plan</span> : featured ? <span className="rounded-full bg-[image:var(--grad)] px-2.5 py-0.5 text-xs font-bold text-white">El más elegido</span> : null}
                  </div>
                  <p className="text-sm text-muted">{p.for}</p>
                  <div className="flex flex-col">
                    <span className="flex items-baseline gap-1"><b className="font-display text-4xl font-semibold">{usd(perMonth)}</b><span className="text-sm text-muted">/mes</span></span>
                    <span className="text-xs text-muted">{period === "anual" ? `${usd(p.yearlyPerMonth * 12)} al año` : first !== null ? `Primer mes ${usd(first)}` : "Facturado cada mes"}</span>
                  </div>
                  <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm"><b className="font-mono">{p.credits.toLocaleString("es-CL")}</b> créditos cada mes</p>
                  <ul className="flex flex-col gap-2 text-sm">
                    {p.features.map((f) => <li key={f} className="flex gap-2"><Check />{f}</li>)}
                  </ul>
                  <button type="button" onClick={() => choose(p.id)} disabled={info?.unlimited && !pay?.owner}
                    className={`mt-auto ${featured ? btnCls : ghostCls} w-full py-2.5`}>{mine ? "Renovar" : currentPlan ? `Cambiar a ${p.name}` : `Elegir ${p.name}`}</button>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-4" aria-label="Recargas de créditos">
          <p className="text-sm text-muted">Se suman a tu saldo al instante, encima de los créditos de tu plan.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {PACKS.map((k) => (
              <article key={k.id} className={`flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 ${item === k.id ? "ring-2 ring-accent-text/60" : ""}`}>
                <span className="text-xs font-semibold text-muted">{k.note}</span>
                <b className="font-mono text-3xl">+{k.credits.toLocaleString("es-CL")}</b>
                <span className="text-sm text-muted">créditos</span>
                <span className="font-display text-2xl font-semibold">{usd(k.usd)}</span>
                <button type="button" onClick={() => choose(k.id)} className={`${ghostCls} mt-auto w-full py-2.5`}>Comprar</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* checkout */}
      {q && (
        <form id="checkout" onSubmit={checkout} className="grid scroll-mt-20 gap-4 lg:grid-cols-[1fr_minmax(0,380px)]">
          <section className={`${cardCls} lg:self-start`} aria-labelledby="pm">
            <h2 id="pm" className="font-display text-lg font-bold">¿Cómo quieres pagar?</h2>
            <div role="radiogroup" aria-labelledby="pm" className="flex flex-col gap-2">
              {METHODS.map((m) => (
                <label key={m.id} className={`flex cursor-pointer gap-3 rounded-xl border p-3.5 ${method === m.id ? "border-accent-text/70 bg-accent/10" : "border-line"}`}>
                  <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="mt-1" />
                  <span className="flex flex-col gap-0.5">
                    <b className="text-sm">{m.name}</b>
                    <span className="text-xs text-muted">{m.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="flex items-center gap-2 text-xs text-muted">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 1 1 8 0v3" /></svg>
              Pago cifrado. Creads nunca ve ni guarda los datos de tu tarjeta.
            </p>
          </section>

          <aside className={`${cardCls} lg:sticky lg:top-20 lg:self-start`} aria-labelledby="sum">
            <h2 id="sum" className="font-display text-lg font-bold">Tu pedido</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3"><dt>{q.label}</dt><dd className="font-mono">{usd(q.subtotal)}</dd></div>
              {q.launch > 0 && <div className="flex justify-between gap-3 text-good"><dt>Oferta de lanzamiento (−{LAUNCH_PCT}% primer mes)</dt><dd className="font-mono">−{usd(q.launch)}</dd></div>}
              {q.discount > 0 && <div className="flex justify-between gap-3 text-good"><dt>Tu descuento ({pay?.discount}%)</dt><dd className="font-mono">−{usd(q.discount)}</dd></div>}
              <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold"><dt>Total hoy</dt><dd className="font-mono">{usd(q.total)}</dd></div>
              <div className="flex justify-between gap-3 text-xs text-muted"><dt>En pesos chilenos</dt><dd>{clp(q.total)}</dd></div>
            </dl>
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">Recibes <b className="font-mono">{q.credits.toLocaleString("es-CL")}</b> créditos{q.period === "anual" ? " (1 año)" : q.period === "mensual" ? " este mes" : ""}.</p>
            {q.period === "mensual" && <p className="text-xs text-muted">Desde el segundo mes: {usd(PLANS.find((p) => p.id === q.item)!.monthly * (1 - (pay?.discount ?? 0) / 100))}/mes. Cancela cuando quieras.</p>}
            <button type="submit" disabled={busy || Boolean(pay?.owner)} className={`${btnCls} w-full py-3 text-base`}>{busy ? "Preparando…" : `Ir a pagar ${usd(q.total)}`}</button>
            {pay?.owner && <p className="text-xs text-muted">Vista de cliente: desde tu cuenta no se crean pedidos.</p>}
            {!pay?.online && !pay?.owner && <p className="text-xs text-muted">Estamos activando el pago en línea: al confirmar, guardamos tu pedido y te escribimos para completarlo.</p>}
            <button type="button" onClick={() => setItem(null)} className="text-xs text-muted underline">Cancelar</button>
            {err && <p className="text-sm text-bad" role="alert">{err}</p>}
          </aside>
        </form>
      )}

      {pay && pay.orders.length > 0 && (
        <section className={cardCls} aria-labelledby="ord">
          <h2 id="ord" className="font-display text-lg font-bold">Tus pedidos</h2>
          <ul className="flex flex-col divide-y divide-line">
            {pay.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span><b className="font-mono">{o.id}</b> · {o.label} · {usd(o.total)} <span className="text-muted">· {new Date(o.created).toLocaleDateString("es-CL")}</span></span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${(STATUS[o.status] ?? STATUS.pendiente)[1]}`}>{(STATUS[o.status] ?? STATUS.pendiente)[0]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
