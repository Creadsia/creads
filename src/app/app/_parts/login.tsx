"use client";

import { useEffect, useState } from "react";
import { Logo } from "../../brand";
import ThemeToggle from "../../theme-toggle";
import GoogleButton from "../../google-button";
import { MoneyText } from "../../money";

const input = "rounded-lg border border-line bg-surface-2 px-3 py-2 font-normal text-ink";

// Sign-in page. On the very first visit (no accounts yet) it creates the owner's account instead.
export default function Login({ mode: initial, google = false }: { mode: "login" | "setup" | "missing"; google?: boolean }) {
  const [mode, setMode] = useState<"login" | "setup" | "missing" | "recover" | "forgot">(initial);
  const [sent, setSent] = useState(false);
  // the owner's recovery (with the Vercel code) stays out of sight: creadsia.com/app?dueno
  const [ownerLink, setOwnerLink] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setOwnerLink(q.has("dueno"));
    // coming back from «Continuar con Google» without signing in
    const aviso = q.get("aviso");
    const AVISOS: Record<string, string> = {
      "google-clave": "Esta cuenta entra con su correo y clave (tiene verificación en dos pasos o es del equipo).",
      "google-cancelado": "No se completó el ingreso con Google. Intenta de nuevo.",
      "google-error": "No pudimos entrar con Google. Intenta de nuevo o usa tu correo y clave.",
      google: "El ingreso con Google no está disponible en este momento: usa tu correo y clave.",
      pausada: "Esta cuenta está pausada. Escríbenos a hola@creadsia.com.",
    };
    if (aviso && AVISOS[aviso]) setError(AVISOS[aviso]);
  }, []);
  const rescue = "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [need2fa, setNeed2fa] = useState(false);
  const [otp, setOtp] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if ((mode === "setup" || mode === "recover") && password !== password2) return setError("Las dos claves no coinciden.");
    setBusy(true);
    if (mode === "forgot") {
      const r = await fetch("/api/auth/forgot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email }) }).catch(() => null);
      const d = r ? await r.json().catch(() => ({})) : {};
      setBusy(false);
      if (r?.ok) return setSent(true);
      return setError(d.error || "No se pudo enviar el correo. Revisa tu conexión e intenta de nuevo.");
    }
    const url = mode === "setup" ? "/api/auth/setup" : mode === "recover" ? "/api/auth/recover" : "/api/auth/login";
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(mode === "setup" ? { email, password, name, code } : mode === "recover" ? { password, code } : { email, password, code: need2fa ? otp : undefined }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { window.location.reload(); return; } // same page: keeps a plan chosen on the website
    if (d.need2fa) setNeed2fa(true);
    setError(d.error || "No se pudo entrar.");
    setBusy(false);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="flex w-full max-w-sm items-center justify-between">
        <Logo size={28} href="/" />
        <ThemeToggle lang="es" />
      </div>
      {mode === "missing" ? (
        <div className="flex w-full max-w-sm flex-col gap-2 rounded-2xl border border-warn/50 bg-warn/10 p-6 text-sm">
          <h1 className="font-display text-xl font-extrabold">Falta un paso</h1>
          <p className="text-muted">Hay que crear las tablas de cuentas en Supabase (SQL Editor → pegar el bloque «Accounts» de schema.sql → Run). Después recarga esta página.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-2xl font-extrabold">{mode === "setup" ? "Crea tu cuenta de dueño" : mode === "recover" ? "Nueva clave del dueño" : mode === "forgot" ? "¿Olvidaste tu clave?" : "Entrar a Creads"}</h1>
            <p className="text-sm text-muted">
              {mode === "setup"
                ? "Es la primera vez que se abre la plataforma. Esta cuenta tendrá acceso a todo y podrá invitar a otras personas."
                : mode === "recover"
                  ? rescue ? "Elige tu clave nueva para entrar. Este enlace sirve una sola vez." : "Para cambiar la clave de la cuenta del dueño, demuestra que tienes acceso a Vercel con la clave de administrador."
                  : mode === "forgot"
                    ? sent ? "Si hay una cuenta con ese correo, te llegará un enlace para elegir una clave nueva. Revisa también la carpeta de spam. El enlace vence en 1 hora." : "Escribe el correo de tu cuenta y te enviamos un enlace para elegir una clave nueva."
                    : "Entra con tu correo y tu clave."}
            </p>
          </div>
          {mode === "login" && google && (
            <>
              <GoogleButton next="/app" />
              <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />o con tu correo<span className="h-px flex-1 bg-line" /></div>
            </>
          )}
          {mode === "setup" && (
            <label htmlFor="name" className="flex flex-col gap-1 text-sm font-semibold text-muted">
              Tu nombre
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={input} />
            </label>
          )}
          {mode !== "recover" && !(mode === "forgot" && sent) && (
            <label htmlFor="email" className="flex flex-col gap-1 text-sm font-semibold text-muted">
              Correo
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className={input} />
            </label>
          )}
          {mode !== "forgot" && <label htmlFor="password" className="flex flex-col gap-1 text-sm font-semibold text-muted">
            {mode === "recover" ? "Clave nueva" : "Clave"}
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} className={input} />
            {mode !== "login" && <span className="text-xs font-normal">Mínimo 10 caracteres.</span>}
          </label>}
          {mode === "login" && need2fa && (
            <label htmlFor="otp" className="flex flex-col gap-1 text-sm font-semibold text-muted">
              Código de verificación
              <input id="otp" inputMode="numeric" pattern="[0-9 ]*" maxLength={7} required autoFocus value={otp} onChange={(e) => setOtp(e.target.value)} autoComplete="one-time-code"
                placeholder="123 456" className={`${input} font-mono text-lg tracking-[0.3em]`} />
              <span className="text-xs font-normal">Los 6 números que muestra tu app (Google Authenticator, Authy…).</span>
            </label>
          )}
          {(mode === "setup" || mode === "recover") && (
            <>
              <label htmlFor="password2" className="flex flex-col gap-1 text-sm font-semibold text-muted">
                Repite la clave
                <input id="password2" type="password" required value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" className={input} />
              </label>
              {!rescue && (
              <label htmlFor="code" className="flex flex-col gap-1 text-sm font-semibold text-muted">
                Clave de administrador de Vercel
                <input id="code" type="password" required value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" className={input} />
                <span className="text-xs font-normal">{mode === "setup" ? "La que guardaste como ADMIN_ACCESS_CODE. Se pide solo esta vez, para que nadie más pueda crear la cuenta del dueño." : "La de ADMIN_ACCESS_CODE en Vercel (Production). Si perdiste el teléfono, esto también apaga la verificación en dos pasos."}</span>
              </label>
              )}
            </>
          )}
          {!(mode === "forgot" && sent) && <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink disabled:opacity-50">
            {busy ? "Un momento…" : mode === "setup" ? "Crear mi cuenta" : mode === "recover" ? "Guardar clave nueva y entrar" : mode === "forgot" ? "Enviarme el enlace" : "Entrar"}
          </button>}
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          {mode === "login" && (
            <p className="text-xs text-muted">
              <button type="button" onClick={() => { setMode("forgot"); setSent(false); setError(""); }} className="font-semibold text-accent-text underline">¿Olvidaste tu clave?</button>
              {ownerLink && <>{" · "}<button type="button" onClick={() => { setMode("recover"); setError(""); }} className="underline">Soy el dueño</button></>}
            </p>
          )}
          {(mode === "recover" || mode === "forgot") && <button type="button" onClick={() => { setMode("login"); setError(""); }} className="text-xs text-muted underline">Volver a entrar con mi clave</button>}
        </form>
      )}
      {mode === "login" && (
        <a href="/empezar" className="flex w-full max-w-sm items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-sm hover:border-accent-text">
          <span><b className="block">¿Todavía no tienes cuenta?</b><span className="text-muted"><MoneyText text="Planes desde US$25 al mes." /></span></span>
          <span className="shrink-0 rounded-lg bg-[image:var(--grad)] px-3 py-2 font-semibold text-white">Crear cuenta</span>
        </a>
      )}
    </main>
  );
}
