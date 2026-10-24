"use client";

import { useState } from "react";
import { track } from "@/lib/track";
import { Logo } from "../brand";
import ThemeToggle from "../theme-toggle";
import GoogleButton from "../google-button";

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

export default function Registro({ google }: { google: boolean }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ text: string; field?: string; exists?: boolean } | null>(null);
  const next = "/app/automatico?bienvenida=1";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const r = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, email, password, company }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) {
      setBusy(false);
      setErr({ text: d.error || "No se pudo crear tu cuenta. Revisa tu conexión e intenta de nuevo.", field: d.field, exists: d.exists });
      return;
    }
    if (d.eventId) track("CompleteRegistration", { content_name: "Cuenta gratis" }, d.eventId);
    await new Promise((res) => setTimeout(res, 400)); // let the pixel send it before leaving
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
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">Prueba Creads gratis, sin tarjeta</h1>
          <p className="text-lg text-muted">Crea tu cuenta y mira con tus propios ojos cómo queda un anuncio de tu negocio antes de pagar nada.</p>
        </section>

        <form onSubmit={submit} className="flex flex-col gap-4 self-start rounded-2xl lg:col-start-2 lg:row-span-2 lg:row-start-1 border border-line bg-surface p-5 sm:p-6" aria-labelledby="crear-cuenta">
          <h2 id="crear-cuenta" className="font-display text-xl font-semibold">Crea tu cuenta gratis</h2>
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
          {err && (
            <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-3 py-2 text-sm">
              {err.text} {err.exists && <a href="/app" className="font-semibold underline">Entrar</a>}
            </p>
          )}
          <button type="submit" disabled={busy} className="rounded-xl bg-ink px-4 py-3.5 text-base font-semibold text-bg disabled:opacity-50">
            {busy ? "Creando tu cuenta…" : "Crear mi cuenta gratis"}
          </button>
          <p className="text-xs text-muted">Sin tarjeta. Al crear tu cuenta aceptas los <a href="/terminos" className="underline">Términos</a> y la <a href="/privacidad" className="underline">Privacidad</a>.</p>
        </form>
          <ul className="flex min-w-0 flex-col gap-3 text-[15px] lg:col-start-1 lg:row-start-2">
            <li className="flex gap-2"><Check /><span><b>200 créditos de regalo</b>: alcanzan para tu primer anuncio en video (unos 12 segundos), listo para publicar.</span></li>
            <li className="flex gap-2"><Check /><span><b>Espía anuncios</b> de tu competencia: 5 búsquedas gratis al día.</span></li>
            <li className="flex gap-2"><Check /><span><b>Guiones con 10 ganchos</b> para tu negocio: 5 gratis al día.</span></li>
            <li className="flex gap-2"><Check /><span>Cuando te guste, eliges un plan desde US$25 al mes. Sin permanencia.</span></li>
          </ul>
      </main>
    </div>
  );
}
