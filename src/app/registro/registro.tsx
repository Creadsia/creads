"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { Logo } from "../brand";
import ThemeToggle from "../theme-toggle";
import GoogleButton from "../google-button";
import TarjetaMP, { PUBLIC_KEY } from "../tarjeta-mp";
import { MoneyText } from "../money";

// The free sign-up form: name, email, password. Then straight into Automático; the welcome email has the
// button that confirms the email and loads the gift ad.

const input = "w-full rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[16px] text-ink outline-none transition-colors focus:border-accent-text";

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden="true">
      <path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Registro({ google, tarjeta = false, refCode = "" }: { google: boolean; /** card trial on (REGALO_CON_TARJETA) */ tarjeta?: boolean; /** affiliate code from the 60-day cookie */ refCode?: string }) {
  const [ref, setRef] = useState(refCode);
  const [showRef, setShowRef] = useState(Boolean(refCode));
  // straight to /registro?ref=CODE: the cookie is set on this same response, so read the code from the address
  useEffect(() => {
    if (refCode) return;
    const q = (new URLSearchParams(window.location.search).get("ref") || "").trim().toUpperCase();
    if (/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(q)) { setRef(q); setShowRef(true); }
  }, [refCode]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; field?: string; exists?: boolean } | null>(null);
  const next = tarjeta ? "/app/automatico?bienvenida=1" : "/app/tanda";
  const [paso, setPaso] = useState<"cuenta" | "tarjeta">("cuenta");
  const [monto, setMonto] = useState(0);
  useEffect(() => { if (tarjeta) fetch("/api/prueba/resumen").then((r) => r.json()).then((d) => setMonto(d.clp ?? 0)).catch(() => null); }, [tarjeta]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, password, company, ref: ref.trim() }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) {
      setBusy(false);
      setErr({ text: d.error || "No se pudo crear tu cuenta. Revisa tu conexión e intenta de nuevo.", field: d.field, exists: d.exists });
      return;
    }
    if (d.eventId) track("CompleteRegistration", { content_name: "Cuenta gratis" }, d.eventId);
    await new Promise((res) => setTimeout(res, 400)); // let the pixel send it before leaving
    // card trial: the card form right here (Mercado Pago's secure fields); without the public key, Mercado Pago's page
    if (tarjeta && PUBLIC_KEY) { setBusy(false); setPaso("tarjeta"); return; }
    if (tarjeta) {
      const p = await fetch("/api/prueba", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).then((r) => r.json()).catch(() => null);
      if (p?.redirect) { window.location.href = p.redirect; return; }
    }
    window.location.href = next;
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-line/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo href="/" />
          <div className="flex items-center gap-3">
            <a href="/app" className="text-sm font-semibold text-muted hover:text-ink">Ya tengo cuenta</a>
            <ThemeToggle lang="es" />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_minmax(0,420px)] lg:gap-x-12 lg:gap-y-6 lg:py-14">
        <section className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1">
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{tarjeta ? "Prueba Creads 7 días gratis" : "Crea tu cuenta y haz tu primera tanda"}</h1>
          <p className="text-lg text-muted">{tarjeta ? "Crea tu cuenta y mira con tus propios ojos cómo queda un anuncio de tu negocio antes de pagar nada." : "Pega el link de tu producto y Creads te propone 6 ángulos de venta. Después creas 10 anuncios para testear en Meta."}</p>
        </section>

        {paso === "tarjeta" ? (
          <section className="flex flex-col gap-4 self-start rounded-2xl lg:col-start-2 lg:row-span-2 lg:row-start-1 border border-line bg-surface p-5 sm:p-6" aria-labelledby="paso-tarjeta">
            <span className="text-xs font-semibold text-muted">Paso 2 de 2</span>
            <h2 id="paso-tarjeta" className="font-display text-xl font-semibold">Agrega tu tarjeta para empezar gratis</h2>
            <Resumen />
            <TarjetaMP monto={monto || 1} onListo={() => { window.location.href = next; }} fallback={<a href={next} className="rounded-xl bg-ink px-4 py-3.5 text-center text-base font-semibold text-bg">Continuar</a>} />
            <p className="text-xs text-muted">Tus datos van directo a Mercado Pago: Creads nunca ve tu tarjeta. Hoy no se cobra nada.</p>
          </section>
        ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 self-start rounded-2xl lg:col-start-2 lg:row-span-2 lg:row-start-1 border border-line bg-surface p-5 sm:p-6" aria-labelledby="crear-cuenta">
          <h2 id="crear-cuenta" className="font-display text-xl font-semibold">Crea tu cuenta</h2>
          {google && (
            <>
              <GoogleButton next={next} label="Registrarme con Google" />
              <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />o con tu correo<span className="h-px flex-1 bg-line" /></div>
            </>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Tu nombre
            <input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" className={input} aria-invalid={err?.field === "name"} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" className={input} aria-invalid={err?.field === "email"} />
            <span className="text-xs font-normal text-muted">Ahí te llegan tus anuncios y avisos.</span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Clave
            <span className="relative">
              <input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={10} autoComplete="new-password" className={`${input} pr-20`} aria-invalid={err?.field === "password"} />
              <button type="button" onClick={() => setShow(!show)} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:text-ink">{show ? "Ocultar" : "Mostrar"}</button>
            </span>
            <span className={`text-xs font-normal ${password && password.length < 10 ? "text-warn" : "text-muted"}`}>Mínimo 10 caracteres.</span>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            <span>Tu negocio <span className="font-normal text-muted">(opcional)</span></span>
            <input value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" className={input} />
          </label>
          {showRef ? (
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              <span>Código de quien te invitó <span className="font-normal text-muted">(opcional)</span></span>
              <input value={ref} onChange={(e) => setRef(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20))} autoComplete="off" autoCapitalize="characters" className={input} />
            </label>
          ) : (
            <button type="button" onClick={() => setShowRef(true)} className="self-start text-sm font-semibold text-muted underline hover:text-ink">¿Te invitó alguien? Escribe su código</button>
          )}
          {err && (
            <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm">
              {err.text} {err.exists && <a href="/app" className="font-semibold underline">Entrar</a>}
            </p>
          )}
          {tarjeta && <Resumen />}
          <button type="submit" disabled={busy} className="rounded-xl bg-ink px-4 py-3.5 text-base font-semibold text-bg disabled:opacity-50">
            {busy ? (tarjeta ? "Abriendo el pago seguro…" : "Creando tu cuenta…") : tarjeta ? "Continuar · agregar tarjeta (hoy $0)" : "Crear mi cuenta"}
          </button>
          <p className="text-xs text-muted">{tarjeta ? "En el siguiente paso agregas tu tarjeta (Mercado Pago): hoy no se cobra nada." : "Crear la cuenta no pide tarjeta."} Al crear tu cuenta aceptas los <a href="/terminos" className="underline">Términos</a> y la <a href="/privacidad" className="underline">Privacidad</a>.</p>
        </form>
        )}
          <ul className="flex min-w-0 flex-col gap-3 text-[15px] lg:col-start-1 lg:row-start-2">
            {tarjeta ? (
              <>
                <li className="flex gap-2"><Check /><span><b>200 créditos de regalo</b>: alcanzan para tu primer anuncio en video (unos 12 segundos), listo para publicar. Se cargan al agregar tu tarjeta (hoy no se cobra nada).</span></li>
                <li className="flex gap-2"><Check /><span><MoneyText text="Si te gusta, a los 7 días sigues con el plan Básico (US$25 al mes). Si no, cancelas antes con un clic y no pagas nada." /></span></li>
              </>
            ) : (
              <>
                <li className="flex gap-2"><Check /><span><b>6 ángulos de venta para tu producto</b>, sin costo: dolor, deseo, mecanismo, prueba social, creencia y oferta.</span></li>
                <li className="flex gap-2"><Check /><span><MoneyText text="Tu primera tanda de 10 anuncios por US$9 (Pack Prueba, pago único): en 4:5 y 9:16, con tu marca, listos para Meta." /></span></li>
                <li className="flex gap-2"><Check /><span><b>Garantía:</b> si tu primera tanda no te sirve, la rehacemos o te devolvemos el pago.</span></li>
                <li className="flex gap-2"><Check /><span><MoneyText text="Si te suscribes dentro de 7 días, los US$9 se descuentan de tu primer mes. Planes desde US$29 al mes, sin permanencia." /></span></li>
              </>
            )}
          </ul>
      </main>
    </div>
  );
}

// the checkout summary next to the form (owner, 25 Oct 2026: «que aparezca al lado el checkout»)
function Resumen() {
  const [info, setInfo] = useState<{ dias: number; plan: string; clp: number } | null>(null);
  useEffect(() => {
    fetch("/api/prueba/resumen").then((r) => r.json()).then(setInfo).catch(() => null);
  }, []);
  const dias = info?.dias ?? 7;
  const fecha = new Date(Date.now() + dias * 86400_000).toLocaleDateString("es-CL", { day: "numeric", month: "long" });
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-2 p-3.5 text-sm">
      <b>Tu prueba gratis de {dias} días</b>
      <div className="flex justify-between gap-3"><span>Hoy</span><b>$0</b></div>
      <div className="flex justify-between gap-3"><span>Créditos de regalo</span><b>200</b></div>
      <div className="flex justify-between gap-3"><span>Desde el {fecha} · Plan {info?.plan ?? "Básico"}</span><b>{info ? `$${info.clp.toLocaleString("es-CL")}/mes` : "…"}</b></div>
      <span className="text-xs text-muted">Cancelas cuando quieras antes del cobro, con un clic. Pagas seguro con Mercado Pago.</span>
    </div>
  );
}
