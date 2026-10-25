"use client";

import { useEffect, useMemo, useState } from "react";
import { ANNUAL, ANNUAL_PCT, FUNDADOR, type ItemId, LAUNCH_PCT, LAUNCH_PRICE, hasLaunch, type MethodId, PACKS, PLANS, PRUEBA, type Period, clpFor, quote } from "@/lib/catalog";
import { PageHead, btnCls, cardCls, ghostCls } from "../_parts/ui";
import { refreshCredits, useCredits } from "../_parts/use-credits";
import { fmtSaldo } from "@/lib/credit-math";
import { newEventId, track } from "@/lib/track";
import { capture } from "../../posthog";
import Garantia from "../../garantia";
import PayBadges from "../../pay-badges";
import { Money } from "../../money";

// Plans and credits: choose a plan or a top-up, see exactly what you'll pay, pick how to pay.
// Online payment isn't connected yet: the order is saved and Creadsia finishes it with the customer.

interface OrderRow { id: string; label: string; total: number; status: string; created: string }
interface PayInfo { online: boolean; renews?: boolean; owner: boolean; firstPurchase: boolean; discount: number; usdClp: number; orders: OrderRow[]; subscription: { id: string; label: string; trial?: string; clp?: number } | null; fundador?: { quedan: number }; packDescuento?: number | null; packComprado?: boolean }

const pesos = (n: number) => `$${n.toLocaleString("es-CL")}`;
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
  // everything the customer reads is in images or videos (credits stay underneath)
  const hasPlan = Boolean(info?.unlimited || (info?.paidUntil && !info.expired)); // top-ups need an active plan
  const [pay, setPay] = useState<PayInfo | null>(null);
  const [tab, setTab] = useState<"planes" | "creditos">("planes");
  const [period, setPeriod] = useState<Period>("mensual");
  const [item, setItem] = useState<ItemId | null>(null);
  const method: MethodId = "mercadopago";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ id: string; label: string; total: number; method: MethodId } | null>(null);

  const [back, setBack] = useState<{ state: string; id: string } | null>(null);
  const [received, setReceived] = useState<string | null>(null);
  useEffect(() => {
    if (!received || !pay) return;
    const o = pay.orders.find((x) => x.id === received);
    if (o) setDone({ id: o.id, label: o.label, total: o.total, method: "mercadopago" });
    setReceived(null);
    window.history.replaceState(null, "", "/app/planes");
  }, [received, pay]);
  const load = () => fetch("/api/pagos").then((r) => (r.ok ? r.json() : null)).then(setPay).catch(() => {});
  useEffect(() => {
    load();
    // back from Mercado Pago: check the payment right away
    const sp = new URLSearchParams(window.location.search);
    // Mercado Pago appends «?preapproval_id=…» to a back_url that already has a query, so it can land inside «pedido»
    let pedido = sp.get("pedido");
    let preapproval = sp.get("preapproval_id");
    if (pedido?.includes("?")) {
      const [id, extra] = pedido.split("?");
      pedido = id;
      preapproval = preapproval ?? new URLSearchParams(extra).get("preapproval_id");
    }
    // arriving from the website's checkout: the order was saved but online payment didn't open
    const got = sp.get("recibido");
    if (got) setReceived(got);
    if (sp.get("aviso") === "pago") setErr("Tu cuenta quedó creada, pero no pudimos abrir el pago. Elige tu plan aquí abajo e inténtalo de nuevo.");
    // arriving from the website with a plan already chosen (/app/planes?plan=plus&periodo=anual)
    const want = sp.get("plan") as ItemId | null;
    if (want === PRUEBA.id) { setItem(PRUEBA.id); window.history.replaceState(null, "", "/app/planes"); }
    if (want && [...PLANS, ...PACKS].some((x) => x.id === want)) {
      if (PACKS.some((x) => x.id === want)) setTab("creditos");
      if (ANNUAL && sp.get("periodo") === "anual") setPeriod("anual");
      if (PLANS.some((x) => x.id === want && !x.hidden)) setItem(want); // a top-up is picked on the tab (it needs an active plan)
      requestAnimationFrame(() => setTimeout(() => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300));
      window.history.replaceState(null, "", "/app/planes");
    }
    if (sp.get("pago") === "volver" && pedido) {
      setBack({ state: "revisando", id: pedido });
      fetch("/api/pagos/confirmar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pedido, payment_id: sp.get("payment_id") ?? sp.get("collection_id"), preapproval_id: preapproval }) })
        .then((r) => r.json()).then((d) => {
          setBack({ state: d.state ?? "procesando", id: pedido }); load(); refreshCredits();
          // the browser Purchase, once per order, with the server's id (Meta deduplicates them)
          const p = d.purchase as { eventId: string; value: number; currency: string; label: string } | undefined;
          if (d.state === "pagado" && p?.eventId) {
            let seen = false;
            try { seen = localStorage.getItem(`creads-buy-${p.eventId}`) === "1"; localStorage.setItem(`creads-buy-${p.eventId}`, "1"); } catch {}
            if (!seen) track("Purchase", { value: p.value, currency: p.currency, content_name: p.label }, p.eventId);
          }
        })
        .catch(() => setBack({ state: "procesando", id: pedido }));
      window.history.replaceState(null, "", "/app/planes");
    }
  }, []);
  const rate = pay?.usdClp ?? 950;
  // prices are always in US$; Mercado Pago charges the equivalent in Chilean pesos (same rounding as the server)
  const clp = (n: number) => clpFor(n, rate);
  // pesos for customers in Chile, US$ for the rest (../../money); the pesos match what Mercado Pago charges
  const money = (n: number) => <Money usd={n} rate={pay?.usdClp} />;
  const [leaving, setLeaving] = useState(false);
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelled, setCancelled] = useState("");
  async function cancelSub() {
    if (cancelBusy) return;
    setErr(""); setCancelBusy(true);
    const r = await fetch("/api/pagos/cancelar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason, detail }) }).catch(() => null);
    setCancelBusy(false);
    if (!r) return setErr("No pudimos conectarnos. Revisa tu conexión e intenta de nuevo.");
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error || "No se pudo cancelar la renovación. Intenta de nuevo o escríbenos a hola@creadsia.com.");
    setLeaving(false);
    setCancelled(d.prueba ? "Listo, cancelamos tu prueba: no se te cobrará nada y tus créditos de regalo siguen en tu cuenta." : info?.paidUntil ? `Listo, cancelamos la renovación. Tu plan sigue activo hasta el ${new Date(`${info.paidUntil}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}.` : "Listo, cancelamos la renovación.");
    load();
  }

  const fundadorOn = Boolean(pay?.firstPurchase && (pay?.fundador?.quedan ?? 0) > 0);
  const opts = { discountPct: pay?.discount ?? 0, firstPurchase: pay?.firstPurchase ?? true, fundador: fundadorOn, pack: pay?.packDescuento ? { order: "", usd: pay.packDescuento } : null };
  const q = useMemo(() => (item ? quote(item, period, opts) : null), [item, period, opts.discountPct, opts.firstPurchase, opts.fundador, pay?.packDescuento]); // eslint-disable-line react-hooks/exhaustive-deps
  const currentPlan = info?.plan ?? null;

  function choose(id: ItemId) {
    setLeaving(false);
    setItem(id); setDone(null); setErr("");
    requestAnimationFrame(() => document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function checkout(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setBusy(true); setErr("");
    const eventId = newEventId();
    const r = await fetch("/api/pagos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item, period, method, eventId }) }).catch(() => null);
    if (!r) { setBusy(false); return setErr("No pudimos conectarnos. Revisa tu conexión e intenta de nuevo."); }
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error || "No se pudo crear el pedido.");
    track("InitiateCheckout", { value: d.order.total, currency: "USD", content_name: d.order.label }, eventId);
    capture("checkout", { item, period, total: d.order.total });
    if (d.redirect) { window.location.href = d.redirect; return; } // pay on Mercado Pago's page
    setDone(d.order); setItem(null); load();
    requestAnimationFrame(() => document.getElementById("pedido-ok")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  return (
    <>
      <PageHead title="Planes" lead="Un solo saldo al mes: lo gastas en imágenes o videos, como quieras. Ves el precio exacto antes de pagar y cancelas cuando quieras." />

      {pay?.owner && (
        <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
          <b>Vista de cliente.</b> Así ven esta página tus clientes. {pay.online ? "Mercado Pago está conectado: los pagos con tarjeta se activan solos." : "Mercado Pago todavía no está conectado: por ahora cada pedido te llega al Panel interno y lo marcas como pagado."}
        </p>
      )}

      {/* where the account stands */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Tu cuenta">
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
          <span className="text-xs font-semibold text-muted">Te quedan</span>
          <span className="text-xl font-bold tabular-nums sm:text-2xl">{!info ? "…" : info.unlimited ? "Sin límite" : fmtSaldo(info.balance ?? 0)}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
          <span className="text-xs font-semibold text-muted">Tu plan</span>
          <span className="text-lg font-bold sm:text-xl">{info?.unlimited ? "Dueño" : currentPlan ?? "Sin plan todavía"}</span>
          {info?.paidUntil && <span className={`text-sm ${info.expired ? "text-bad" : "text-muted"}`}>{info.expired ? "Venció" : pay?.subscription ? "Se renueva" : "Vigente hasta"} el {new Date(`${info.paidUntil}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}</span>}
        </div>
        <div className="hidden flex-col gap-1 rounded-2xl border border-line bg-surface p-4 sm:flex">
          <span className="text-xs font-semibold text-muted">Cómo se usan</span>
          <span className="text-sm text-muted">Cada anuncio de una tanda (en 4:5 y 9:16) usa 1 imagen. Un video de 10 s con avatar que habla usa 1 video. Nano Banana Pro cuenta como 2 imágenes. Editar y revisar no usan saldo. Si algo falla, vuelve solo.</span>
        </div>
      </section>

      {back && (
        <section className={`${cardCls} ${back.state === "pagado" ? "border-good/50" : back.state === "rechazado" ? "border-bad/50" : ""}`} aria-live="polite">
          <h2 className="font-display text-xl font-bold">
            {back.state === "pagado" ? "¡Pago recibido! Tus créditos ya están cargados." : back.state === "rechazado" ? "El pago fue rechazado" : back.state === "revisando" ? "Revisando tu pago…" : "Estamos confirmando tu pago"}
          </h2>
          <p className="text-sm text-muted">
            {back.state === "pagado" ? `Pedido ${back.id}. Te llega el comprobante de Mercado Pago a tu correo.` : back.state === "rechazado" ? "No se cobró nada. Puedes intentar con otra tarjeta o medio de pago." : "Mercado Pago avisa en unos minutos. Tus créditos aparecen solos en esta página; no necesitas pagar de nuevo."}
          </p>
        </section>
      )}

      {pay?.subscription && (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          {pay.subscription.trial
            ? <span>Estás en tu <b>prueba gratis</b>. El <b>{new Date(`${pay.subscription.trial}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}</b> Mercado Pago cobra el <b>{pay.subscription.label}</b>{pay.subscription.clp ? ` ($${pay.subscription.clp.toLocaleString("es-CL")})` : ""} y se renueva cada mes, salvo que canceles antes.</span>
            : <span>Renovación automática activa: <b>{pay.subscription.label}</b>, con Mercado Pago.</span>}
          {!leaving && <button type="button" onClick={() => setLeaving(true)} className="text-sm font-semibold text-muted underline hover:text-ink">{pay.subscription.trial ? "Cancelar prueba" : "Cancelar renovación"}</button>}
        </p>
      )}
      {cancelled && <p role="status" className="rounded-xl border border-good/40 bg-good/10 px-4 py-3 text-sm">{cancelled}</p>}
      {!leaving && !item && err && <p className="text-sm text-bad" role="alert">{err}</p>}
      {pay?.subscription && leaving && (
        <section className={cardCls} aria-labelledby="leave">
          <h2 id="leave" className="font-display text-lg font-bold">Antes de cancelar, ¿nos cuentas por qué? (opcional)</h2>
          <p className="text-sm text-muted">Tu plan sigue activo hasta la fecha pagada y tus anuncios quedan guardados. Tu respuesta nos ayuda a mejorar.</p>
          <div role="radiogroup" aria-label="Motivo" className="grid gap-2 sm:grid-cols-2">
            {["Precio demasiado elevado", "No uso suficientes créditos", "Los resultados de la IA no me convencieron", "Problemas técnicos", "Ya no necesito la herramienta", "Me cambiaré a otra plataforma", "Otro motivo"].map((m) => (
              <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${reason === m ? "border-accent bg-accent/10" : "border-line"}`}>
                <input type="radio" name="leave" value={m} checked={reason === m} onChange={() => setReason(m)} />{m}
              </label>
            ))}
          </div>
          {reason === "Precio demasiado elevado" && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">¿Probaste el plan <b>Testea</b>? Es el más económico y trae saldo para hasta 47 imágenes o 3 videos al mes.</p>}
          {(reason === "Los resultados de la IA no me convencieron" || reason === "Problemas técnicos") && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">Escríbenos a <b>hola@creadsia.com</b> con el anuncio que no te gustó: lo revisamos contigo y, si fue un error nuestro, te devolvemos esos créditos.</p>}
          {reason === "No uso suficientes créditos" && <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">Si te falta tiempo, prueba <b>Crear guion</b>: pegas un anuncio que funciona y en minutos tienes 3 versiones listas para crear.</p>}
          <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} aria-label="Cuéntanos más (opcional)" placeholder="Cuéntanos más (opcional)" className="min-w-0 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink" />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setLeaving(false)} className={btnCls}>Mantener mi plan</button>
            <button type="button" onClick={cancelSub} disabled={cancelBusy} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted hover:text-ink disabled:opacity-50">{cancelBusy ? "Cancelando…" : pay.subscription.trial ? "Cancelar la prueba" : "Cancelar la renovación"}</button>
          </div>
          {err && <p className="text-sm text-bad" role="alert">{err}</p>}
        </section>
      )}

      {done && (
        <section id="pedido-ok" className={`${cardCls} scroll-mt-20 border-good/50`} aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold">Pedido <span className="whitespace-nowrap">{done.id}</span> recibido</h2>
              <p className="text-sm text-muted">{done.label} · {money(done.total)}</p>
            </div>
            <span className="rounded-full bg-warn/15 px-3 py-1 text-sm font-semibold text-warn">Esperando pago</span>
          </div>
          <p className="text-sm">
            {pay?.online
              ? "Te llevamos a la ventana de pago."
              : "El pago en línea se activa muy pronto. Te escribimos a tu correo con un link de pago seguro; apenas pagues, tus créditos aparecen aquí."}
          </p>
          <p className="text-xs text-muted">¿Dudas? Escríbenos a hola@creadsia.com con tu número de pedido.</p>
        </section>
      )}

      {/* Pack Prueba (25 Oct 2026): the way in, once per account */}
      {pay && !pay.owner && !pay.packComprado && !hasPlan && (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between" aria-label="Pack Prueba">
          <div className="flex flex-col gap-1">
            <b className="font-display text-xl font-semibold">Pack Prueba · {money(PRUEBA.usd)} pago único</b>
            <span className="text-sm text-muted">Hasta 12 imágenes o 1 video con avatar. Si te suscribes dentro de 7 días, se descuenta de tu primer mes.</span>
          </div>
          <button type="button" onClick={() => choose(PRUEBA.id)} className={`${btnCls} shrink-0`}>Haz tu primera tanda por {money(PRUEBA.usd)}</button>
        </section>
      )}

      {/* what to buy */}
      <div role="tablist" aria-label="Qué quieres comprar" className="flex gap-1 border-b border-line">
        {([["planes", "Planes"], ["creditos", "Recargas"]] as const).map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold ${tab === k ? "border-accent-text text-ink" : "border-transparent text-muted hover:text-ink"}`}>{l}</button>
        ))}
      </div>

      {tab === "planes" ? (
        <section className="flex flex-col gap-4" aria-label="Planes">
          <div className="flex flex-wrap items-center gap-3">
            {ANNUAL && <div role="radiogroup" aria-label="Forma de pago del plan" className="inline-flex rounded-xl border border-line bg-surface p-1">
              {(["mensual", "anual"] as const).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${period === p ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>{p === "mensual" ? "Mensual" : "Anual"}</button>
              ))}
            </div>}
            <span className="rounded-full bg-good/15 px-3 py-1 text-sm font-semibold text-good">{period === "anual" ? `${ANNUAL_PCT}% menos pagando el año` : pay?.firstPurchase && LAUNCH_PCT > 0 ? `Emprende −${LAUNCH_PCT}% el primer mes` : pay?.renews === false ? "Pagas mes a mes" : "Cancela cuando quieras"}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {PLANS.filter((p) => !p.hidden || currentPlan === p.name).map((p) => {
              const featured = p.featured;
              const founder = fundadorOn && period === "mensual" && p.id === FUNDADOR.plan;
              const mine = currentPlan === p.name;
              const perMonth = period === "anual" ? p.yearlyPerMonth : p.monthly;
              const first = period === "mensual" && pay?.firstPurchase && hasLaunch(p.id) ? LAUNCH_PRICE : null;
              return (
                <article key={p.id} className={`relative flex flex-col gap-4 rounded-2xl p-5 ${featured ? "border-2 border-transparent bg-surface [background:linear-gradient(var(--surface),var(--surface))_padding-box,var(--grad)_border-box]" : "border border-line bg-surface"} ${item === p.id ? "ring-2 ring-accent-text/60" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xl font-extrabold">{p.name}</h3>
                    {mine ? <span className="rounded-full bg-good/15 px-2.5 py-0.5 text-xs font-bold text-good">Tu plan</span> : featured ? <span className="rounded-full bg-[image:var(--grad)] px-2.5 py-0.5 text-xs font-bold text-white">Plan estrella</span> : null}
                  </div>
                  <p className="text-sm text-muted">{p.for}</p>
                  <div className="flex flex-col">
                    <span className="flex items-baseline gap-1"><b className="font-display text-4xl font-semibold">{money(founder ? FUNDADOR.usd : perMonth)}</b><span className="text-sm text-muted">/mes</span>{founder && <s className="text-sm text-muted">{money(p.monthly)}</s>}</span>
                    <span className="text-xs text-muted">{founder ? <>Precio fundador los primeros {FUNDADOR.months} meses · quedan {pay?.fundador?.quedan} de {FUNDADOR.cupos} cupos</> : period === "anual" ? <>{money(p.yearlyPerMonth * 12)} al año</> : first !== null ? <>Primer mes {money(first)}</> : "Facturado cada mes"}</span>
                  </div>
                  <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">Hasta <b>{p.imagenes} imágenes</b> o <b>{p.videos} videos</b> con avatar de 10 s al mes, o la mezcla que quieras{period === "anual" ? " (12 meses)" : ""}.</p>
                  <ul className="flex flex-col gap-2 text-sm">
                    {p.features.map((f) => <li key={f} className="flex gap-2"><Check />{f}</li>)}
                  </ul>
                  {pay?.subscription ? (
                    <p className="mt-auto rounded-lg bg-surface-2 px-3 py-2.5 text-center text-sm text-muted">{mine ? `Se renueva solo${info?.paidUntil ? ` el ${new Date(`${info.paidUntil}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}` : ""}` : "Para cambiar de plan, primero cancela tu renovación automática (arriba)."}</p>
                  ) : (
                    <button type="button" onClick={() => choose(p.id)} disabled={info?.unlimited && !pay?.owner}
                      className={`mt-auto ${featured ? btnCls : ghostCls} w-full py-2.5`}>{mine ? "Renovar" : currentPlan ? `Cambiar a ${p.name}` : `Elegir ${p.name}`}</button>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-4" aria-label="Recargas de créditos">
          <p className="text-sm text-muted">{hasPlan ? "Se suman a tu saldo apenas se aprueba el pago, encima de los créditos de tu plan, y vencen cuando termina tu período." : "Las recargas se suman a un plan activo. Elige primero un plan (o renueva el tuyo) y después suma créditos cuando los necesites."}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            {PACKS.map((k) => (
              <article key={k.id} className={`flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 ${item === k.id ? "ring-2 ring-accent-text/60" : ""}`}>
                <span className="text-xs font-semibold text-muted">{k.note}</span>
                <b className="font-mono text-3xl">+{Math.floor(k.credits / 10)} imágenes</b>
                <span className="text-sm text-muted">{fmtSaldo(k.credits)}</span>
                <span className="font-display text-2xl font-semibold">{money(k.usd)}</span>
                <button type="button" onClick={() => choose(k.id)} disabled={!hasPlan} className={`${ghostCls} mt-auto w-full py-2.5 disabled:opacity-50`}>Comprar</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* checkout */}
      {q && (
        <form id="checkout" onSubmit={checkout} className="grid scroll-mt-20 gap-4 lg:grid-cols-[1fr_minmax(0,380px)]">
          <section className={`${cardCls} lg:self-start`} aria-labelledby="pm">
            <h2 id="pm" className="font-display text-lg font-bold">Pagas con Mercado Pago</h2>
            <div className="flex flex-col gap-2 rounded-xl border border-accent-text/50 bg-accent/10 p-4">
              <b className="text-sm">Tarjeta de crédito, débito o saldo Mercado Pago</b>
              <span className="text-sm text-muted">Pagas en pesos chilenos en la ventana segura de Mercado Pago y vuelves aquí con tus créditos ya cargados.</span>
              <ul className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold">
                {["Visa", "Mastercard", "American Express", "Redcompra", "Saldo Mercado Pago"].map((x) => <li key={x} className="rounded-md border border-line bg-surface px-2 py-1">{x}</li>)}
              </ul>
            </div>
            <ul className="flex flex-col gap-1.5 text-sm">
              <li className="flex gap-2"><Check />Saldo cargado apenas se aprueba el pago.</li>
              <li className="flex gap-2"><Check />Cancelas la renovación con un clic, sin llamar a nadie.</li>
              <li className="flex gap-2"><Check />Comprobante de Mercado Pago a tu correo.</li>
            </ul>
            <p className="flex items-center gap-2 text-xs text-muted">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 1 1 8 0v3" /></svg>
              Pago cifrado. Creads nunca ve ni guarda los datos de tu tarjeta.
            </p>
          </section>

          <aside className={`${cardCls} lg:sticky lg:top-20 lg:self-start`} aria-labelledby="sum">
            <h2 id="sum" className="font-display text-lg font-bold">Tu pedido</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3"><dt>{q.label}</dt><dd className="font-mono">{money(q.subtotal)}</dd></div>
              {q.launch > 0 && <div className="flex justify-between gap-3 text-good"><dt>Oferta de lanzamiento (−{LAUNCH_PCT}% primer mes)</dt><dd className="font-mono">−{money(q.launch)}</dd></div>}
              {q.discount > 0 && <div className="flex justify-between gap-3 text-good"><dt>Tu descuento ({pay?.discount}%)</dt><dd className="font-mono">−{money(q.discount)}</dd></div>}
              {(q.fundador ?? 0) > 0 && <div className="flex justify-between gap-3 text-good"><dt>Precio fundador (primeros {FUNDADOR.months} meses)</dt><dd className="font-mono">−{money(q.fundador!)}</dd></div>}
              {(q.pack ?? 0) > 0 && <div className="flex justify-between gap-3 text-good"><dt>Tu Pack Prueba, descontado</dt><dd className="font-mono">−{money(q.pack!)}</dd></div>}
              <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold"><dt>Total hoy</dt><dd className="font-mono">{money(q.total)}</dd></div>
              <div className="p-usd flex justify-between gap-3 text-xs text-muted"><dt>Mercado Pago cobra en pesos chilenos</dt><dd className="font-mono">{pesos(clp(q.total))}</dd></div>
            </dl>
            <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">Recibes saldo para <b>{fmtSaldo(q.period === "anual" ? q.credits / 12 : q.credits)}</b>{q.period === "anual" ? " cada mes, por 12 meses" : q.period === "mensual" ? " este mes" : ""}.</p>
            {q.period === "mensual" && (() => { const m = PLANS.find((p) => p.id === q.item)!.monthly * (1 - (pay?.discount ?? 0) / 100); return <p className="text-xs text-muted">{pay?.renews === false ? <>Pago de un mes, sin renovación automática. Desde el segundo mes: {money(m)}.</> : (q.fundador ?? 0) > 0 ? <>Meses 2 y 3: {money(FUNDADOR.usd)}. Desde el mes 4: {money(m)}. Cancela cuando quieras.</> : <>Se renueva solo cada mes: {money(m)}. Cancela cuando quieras.</>}</p>; })()}
            <Garantia compact />
            <button type="submit" disabled={busy || Boolean(pay?.owner)} className={`${btnCls} w-full py-3 text-base`}>{busy ? "Preparando…" : pay?.online ? <>Pagar {money(q.total)} con Mercado Pago</> : <>Ir a pagar {money(q.total)}</>}</button>
            <p className="text-xs text-muted">Al pagar aceptas los <a href="/terminos" target="_blank" className="underline">Términos</a>. Los créditos quedan disponibles al instante, por eso no aplica el derecho a retracto (Ley 19.496, art. 3 bis). Aun así, si no has usado nada de esa compra y nos escribes dentro de 10 días, te devolvemos el pago.</p>
            {pay?.online && pay.renews !== false && q.period === "mensual" && <p className="text-xs text-muted">Para la suscripción, entra a Mercado Pago con el mismo correo de tu cuenta Creads.</p>}
            <div className="flex flex-col items-center gap-1.5"><PayBadges compact /><span className="flex items-center gap-1.5 text-xs text-muted"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 1 1 8 0v3" /></svg>Pago cifrado. Creads nunca ve tu tarjeta.</span></div>
            {pay?.owner && <p className="text-xs text-muted">Vista de cliente: desde tu cuenta no se crean pedidos.</p>}
            {!pay?.online && !pay?.owner && <p className="text-xs text-muted">Estamos activando el pago en línea: al confirmar, guardamos tu pedido y te escribimos para completarlo.</p>}
            <button type="button" onClick={() => { setItem(null); setErr(""); }} className="text-xs text-muted underline">Cancelar</button>
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
                <span><b className="font-mono">{o.id}</b> · {o.label} · {money(o.total)} <span className="text-muted">· {new Date(o.created).toLocaleDateString("es-CL")}</span></span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${(STATUS[o.status] ?? STATUS.pendiente)[1]}`}>{(STATUS[o.status] ?? STATUS.pendiente)[0]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
