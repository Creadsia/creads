"use client";

import { useEffect, useMemo, useState } from "react";
import { type ItemId, LAUNCH_PCT, PACKS, hasLaunch, PLANS, type Period, clpFor, quote, usd } from "@/lib/catalog";
import { newEventId, track } from "@/lib/track";
import { Logo } from "../brand";
import ThemeToggle from "../theme-toggle";
import PayBadges from "../pay-badges";

// One page from "I want this plan" to Mercado Pago: pick the plan, create the account, pay.
// New accounts always get the launch offer on Starter (first purchase), so the price shown here is the price charged.

const pesos = (n: number) => `$${n.toLocaleString("es-CL")}`;
const ADS = (credits: number) => Math.max(1, Math.round(credits / 144)); // a finished 30 s ad with Veo Lite ≈ 144 credits
const input = "w-full rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[16px] text-ink outline-none transition-colors focus:border-accent-text";

function Check({ className = "text-good" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`mt-0.5 h-4 w-4 shrink-0 ${className}`} aria-hidden="true">
      <path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Checkout({ item: first, period: firstPeriod, rate, renews = true }: { item: ItemId; period: Period; rate: number; renews?: boolean }) {
  const [item, setItem] = useState<ItemId>(first);
  const [period, setPeriod] = useState<Period>(firstPeriod);
  const isPack = item.startsWith("pack-");
  const q = useMemo(() => quote(item, period, { firstPurchase: true })!, [item, period]);
  const plan = PLANS.find((p) => p.id === item);
  const pack = PACKS.find((p) => p.id === item);
  const totalClp = clpFor(q.total, rate);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"" | "cuenta" | "pago">("");
  const [err, setErr] = useState<{ text: string; field?: string; exists?: boolean } | null>(null);

  useEffect(() => {
    track("ViewContent", { content_name: "Checkout", value: q.total, currency: "USD" });
    track("AddToCart", { content_name: q.label, value: q.total, currency: "USD" }); // one per visit, whichever button brought them
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loginHref = `/app/planes?plan=${item}&periodo=${period}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy("cuenta");
    const r = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, password, company }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) {
      setBusy("");
      setErr({ text: d.error || "No se pudo crear tu cuenta. Revisa tu conexión e intenta de nuevo.", field: d.field, exists: d.exists });
      return;
    }
    if (d.eventId) track("CompleteRegistration", { content_name: q.label }, d.eventId);
    setBusy("pago");
    const eventId = newEventId();
    const p = await fetch("/api/pagos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item, period, method: "mercadopago", eventId }) }).catch(() => null);
    const pd = p ? await p.json().catch(() => ({})) : {};
    if (p?.ok) track("InitiateCheckout", { value: pd.order?.total ?? q.total, currency: "USD", content_name: q.label }, eventId);
    // give the pixel a moment to send its events before leaving the page
    await new Promise((r) => setTimeout(r, 400));
    if (p?.ok && pd.redirect) { window.location.href = pd.redirect; return; } // Mercado Pago's page
    // the account exists; the payment couldn't open here: their plans page explains what happens next
    window.location.href = p?.ok ? `/app/planes?recibido=${encodeURIComponent(pd.order?.id ?? "")}` : `${loginHref}&aviso=pago`;
  }

  const fieldErr = (f: string) => (err?.field === f ? err.text : "");

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo href="/" />
          <div className="flex items-center gap-3">
            <a href={loginHref} className="text-sm font-semibold text-muted hover:text-ink">Ya tengo cuenta</a>
            <ThemeToggle lang="es" />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.05fr_minmax(0,440px)] lg:gap-10 lg:py-10">
        {/* progress: a real sequence */}
        <ol className="flex items-center gap-2 text-sm lg:col-span-2" aria-label="Pasos">
          {["Elige tu plan", "Crea tu cuenta", "Paga con Mercado Pago"].map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-good text-black" : i === 1 ? "bg-ink text-bg" : "border border-line text-muted"}`}>{i === 0 ? "✓" : i + 1}</span>
              <span className={i === 1 ? "font-semibold" : "text-muted"}>{s}</span>
              {i < 2 && <span aria-hidden="true" className="mx-1 hidden h-px w-8 bg-line sm:block" />}
            </li>
          ))}
        </ol>

        {/* LEFT: the plan and what it gets you */}
        <section className="order-2 flex min-w-0 flex-col gap-5 lg:order-1" aria-labelledby="tu-plan">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 id="tu-plan" className="font-display text-2xl font-semibold sm:text-3xl">{isPack ? "Tus créditos" : "Tu plan"}</h1>
          </div>

          {!isPack && (
            <div role="radiogroup" aria-label="Forma de pago" className="grid grid-cols-2 gap-2">
              {(["mensual", "anual"] as const).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}
                  className={`flex flex-col items-start gap-0.5 rounded-xl border px-4 py-3 text-left ${period === p ? "border-accent-text bg-surface" : "border-line text-muted"}`}>
                  <b className="text-sm text-ink">{p === "mensual" ? "Mensual" : "Anual"}</b>
                  <span className="text-xs">{p === "mensual" ? `Starter −${LAUNCH_PCT}% el primer mes` : "2 meses gratis"}</span>
                </button>
              ))}
            </div>
          )}

          <div role="radiogroup" aria-label={isPack ? "Recarga" : "Plan"} className="flex flex-col gap-2">
            {(isPack ? PACKS : PLANS).map((x) => {
              const on = x.id === item;
              const xq = quote(x.id, period, { firstPurchase: true })!;
              const isPlan = "monthly" in x;
              const best = x.id === "plus";
              return (
                <button key={x.id} type="button" role="radio" aria-checked={on} onClick={() => setItem(x.id)}
                  className={`relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${on ? "border-transparent bg-surface [background:linear-gradient(var(--surface),var(--surface))_padding-box,var(--grad)_border-box] border-2" : "border-line bg-surface/60 hover:bg-surface"}`}>
                  <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-ink" : "border-line"}`}>{on && <span className="h-2.5 w-2.5 rounded-full bg-ink" />}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="text-lg">{isPlan ? (x as (typeof PLANS)[number]).name : `${x.credits.toLocaleString("es-CL")} créditos`}</b>
                      {best && <span className="rounded-full bg-[image:var(--grad)] px-2 py-0.5 text-[11px] font-bold text-white">El más elegido</span>}
                    </span>
                    <span className="text-sm text-muted">
                      {isPlan ? `${x.credits.toLocaleString("es-CL")} créditos al mes · ≈ ${ADS(x.credits)} anuncios de 30 s` : `≈ ${ADS(x.credits)} anuncios de 30 s · se suman a tu plan`}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    {xq.launch > 0 && <s className="text-xs text-muted">{usd(xq.subtotal)}</s>}
                    <b className="font-display text-lg font-semibold">{usd(xq.total)}</b>
                    <span className="text-[11px] text-muted">{xq.period === "anual" ? "por 12 meses" : xq.period === "mensual" ? "primer mes" : "una vez"}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
            <b>{plan ? `Lo que incluye ${plan.name}` : "Lo que incluye"}</b>
            <ul className="grid gap-2 text-sm sm:grid-cols-2">
              {(plan ? plan.features : ["Se suman a tu saldo al instante", "Vencen junto con tu plan", "Sirven para todos los modelos", "Puedes sumar un plan cuando quieras"]).map((f) => (
                <li key={f} className="flex gap-2"><Check />{f}</li>
              ))}
              <li className="flex gap-2"><Check />Revisión de calidad automática en cada anuncio</li>
              <li className="flex gap-2"><Check />Si un modelo falla, tus créditos vuelven solos</li>
            </ul>
          </div>

          <dl className="grid gap-3 sm:grid-cols-3">
            {[
              ["Créditos al instante", "Apenas Mercado Pago aprueba, tu saldo se carga solo."],
              ["Cancelas con un clic", "Desde tu cuenta, sin llamar ni escribir a nadie."],
              ["Pago protegido", "Pagas en Mercado Pago. Creads nunca ve tu tarjeta."],
            ].map(([t, d]) => (
              <div key={t} className="flex flex-col gap-1 rounded-2xl border border-line p-4">
                <dt className="text-sm font-semibold">{t}</dt>
                <dd className="text-sm text-muted">{d}</dd>
              </div>
            ))}
          </dl>

          <details className="rounded-2xl border border-line p-4 text-sm">
            <summary className="cursor-pointer font-semibold">¿Cómo funciona el cobro?</summary>
            <div className="mt-3 flex flex-col gap-2 text-muted">
              {renews ? (
                <p>Los planes mensuales son una suscripción de Mercado Pago: el primer mes pagas {plan ? usd(quote(item, "mensual", { firstPurchase: true })!.total) : "el precio del plan"}{plan && hasLaunch(plan.id) ? " (con la oferta de lanzamiento)" : ""} y desde el segundo mes {plan ? usd(plan.monthly) : "el precio normal"}. Puedes cancelar la renovación cuando quieras desde «Planes y créditos».</p>
              ) : (
                <p>Por ahora el plan mensual se paga mes a mes, sin cobro automático: pagas {plan ? usd(quote(item, "mensual", { firstPurchase: true })!.total) : "el precio con descuento"} por el primer mes y, si quieres seguir, renuevas desde «Planes y créditos» ({plan ? usd(plan.monthly) : "precio normal"}/mes).</p>
              )}
              <p>El plan anual se paga una sola vez y sus créditos duran el año. Las recargas se compran después, desde «Planes y créditos», y se suman a tu plan. Los precios están en dólares; Mercado Pago cobra el equivalente en pesos chilenos al cambio del día y te envía el comprobante.</p>
              <p>¿Dudas? Escríbenos a <span className="select-all text-ink">hola@creadsia.com</span>.</p>
            </div>
          </details>
        </section>

        {/* RIGHT: the account form, sticky next to the plan */}
        <section className="order-1 lg:order-2" aria-labelledby="cuenta">
          <form onSubmit={submit} className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-[0_40px_120px_-50px_rgba(138,92,255,0.55)] sm:p-6 lg:sticky lg:top-6">
            {/* order summary, always visible next to the button */}
            <div className="flex flex-col gap-1 rounded-2xl bg-surface-2 p-4">
              <span className="flex items-center justify-between gap-2 text-sm text-muted">{q.label}<a href="#tu-plan" className="font-semibold text-accent-text underline lg:hidden">Cambiar</a></span>
              <span className="flex flex-wrap items-baseline gap-x-2">
                <b className="font-display text-3xl font-semibold">{usd(q.total)}</b>
                {q.launch > 0 && <s className="text-muted">{usd(q.subtotal)}</s>}
                <span className="text-sm text-muted">hoy</span>
              </span>
              {q.launch > 0 && <span className="w-fit rounded-full bg-good/15 px-2.5 py-0.5 text-xs font-bold text-good">Oferta de lanzamiento: −{LAUNCH_PCT}% el primer mes</span>}
              <span className="text-xs text-muted">
                {q.period === "mensual" ? (renews ? `Luego ${usd(plan?.monthly ?? 0)}/mes. Cancela cuando quieras.` : `Pago de un mes, sin cobro automático. Luego ${usd(plan?.monthly ?? 0)}/mes si renuevas.`) : q.period === "anual" ? `${q.credits.toLocaleString("es-CL")} créditos para todo el año.` : `${pack?.credits.toLocaleString("es-CL")} créditos que se suman a tu plan y vencen con él.`}
              </span>
              <span className="text-xs text-muted">Se cobra en pesos chilenos: {pesos(totalClp)} (Mercado Pago, al cambio del día).
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <h2 id="cuenta" className="font-display text-xl font-semibold">Crea tu cuenta</h2>
              <p className="text-sm text-muted">Toma 30 segundos. Después pagas y entras directo al estudio.</p>
            </div>

            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Tu nombre
              <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" className={input} aria-invalid={Boolean(fieldErr("name"))} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Correo
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" className={input} aria-invalid={Boolean(fieldErr("email"))} />
              <span className="text-xs font-normal text-muted">Usa el mismo correo de tu cuenta de Mercado Pago.</span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Clave
              <span className="relative">
                <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} autoComplete="new-password" className={`${input} pr-20`} aria-invalid={Boolean(fieldErr("password"))} />
                <button type="button" onClick={() => setShow(!show)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:text-ink">{show ? "Ocultar" : "Mostrar"}</button>
              </span>
              <span className={`text-xs font-normal ${password && password.length < 10 ? "text-warn" : "text-muted"}`}>Mínimo 10 caracteres.</span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              <span>Empresa o marca <span className="font-normal text-muted">(opcional)</span></span>
              <input value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" className={input} />
            </label>

            {err && (
              <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm">
                {err.text} {err.exists && <a href={loginHref} className="font-semibold underline">Entrar y pagar</a>}
              </p>
            )}

            <button type="submit" disabled={Boolean(busy)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[image:var(--grad)] px-5 py-4 text-base font-bold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)] transition-transform hover:-translate-y-px disabled:opacity-70">
              {busy === "cuenta" ? "Creando tu cuenta…" : busy === "pago" ? "Abriendo Mercado Pago…" : `Crear cuenta y pagar ${usd(q.total)}`}
            </button>
            <p className="text-center text-xs text-muted">
              Al crear tu cuenta aceptas los <a href="/terminos" target="_blank" className="underline">Términos</a> y la <a href="/privacidad" target="_blank" className="underline">Política de privacidad</a>. Los créditos quedan disponibles al instante, por eso no aplica el derecho a retracto (Ley 19.496, art. 3 bis). Aun así, si no has usado ningún crédito de esa compra y nos escribes dentro de 10 días, te devolvemos el pago.
            </p>

            <div className="flex flex-col items-center gap-2 text-center">
              <PayBadges compact />
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 1 1 8 0v3" /></svg>
                Pago cifrado en Mercado Pago.{q.period === "mensual" && renews ? " Cancela cuando quieras." : ""}
              </p>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
