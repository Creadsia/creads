"use client";

import { useEffect, useState } from "react";
import { Field, PageHead, btnCls, cardCls, ghostCls, inputCls } from "../_parts/ui";

export default function Cuenta() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (next !== again) return setMsg({ ok: false, text: "Las dos claves nuevas no coinciden." });
    setBusy(true); setMsg(null);
    const res = await fetch("/api/auth/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ current, next }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "No se pudo cambiar la clave." });
    setCurrent(""); setNext(""); setAgain("");
    setMsg({ ok: true, text: "Clave cambiada. Se cerraron tus otras sesiones." });
  }

  return (
    <>
      <PageHead title="Mi cuenta" />
      <Credits />
      <div className="grid items-start gap-4 lg:grid-cols-2">
      <form onSubmit={save} className={cardCls}>
        <h2 className="font-display text-lg font-bold">Cambiar clave</h2>
        <Field label="Clave actual"><input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} /></Field>
        <Field label="Clave nueva" hint="Mínimo 10 caracteres."><input type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} /></Field>
        <Field label="Repite la clave nueva"><input type="password" required autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={inputCls} /></Field>
        <button type="submit" disabled={busy} className={btnCls}>{busy ? "Guardando…" : "Cambiar clave"}</button>
        {msg && <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
      </form>
      <TwoFactor />
      </div>
      <section className={`${cardCls} sm:flex-row sm:items-center sm:justify-between`} aria-labelledby="ses">
        <div className="flex flex-col gap-1">
          <h2 id="ses" className="font-display text-lg font-bold">Sesión</h2>
          <p className="text-sm text-muted">Si usaste un computador que no es tuyo, cierra la sesión al terminar. Para cerrar todas tus sesiones a la vez, cambia la clave.</p>
        </div>
        <button type="button" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }).catch(() => {}); window.location.href = "/app"; }} className={`${ghostCls} shrink-0 self-start text-bad sm:self-center`}>Cerrar sesión</button>
      </section>
    </>
  );
}

interface Move { id: number; delta: number; kind: string; note: string | null; created_at: string }
interface CreditsData { unlimited: boolean; balance: number | null; paidUntil: string | null; expired: boolean; plan: string | null; history: Move[] }

const KIND: Record<string, string> = { plan: "Plan", topup: "Créditos agregados", charge: "Usado", refund: "Devuelto", adjust: "Ajuste" };

function Credits() {
  const [d, setD] = useState<CreditsData | null>(null);
  useEffect(() => { fetch("/api/credits?history=1").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {}); }, []);
  if (!d) return null;
  if (d.unlimited) return <section className={cardCls}><h2 className="font-display text-lg font-bold">Créditos</h2><p className="text-sm text-muted">Cuenta del dueño: sin límite. Lo que gastas lo ves en Panel interno → Saldos y alertas.</p></section>;
  const until = d.paidUntil ? new Date(`${d.paidUntil}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" }) : null;
  return (
    <section className={cardCls} aria-labelledby="cr">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="cr" className="font-display text-lg font-bold">Créditos</h2>
          <p className="text-sm text-muted">{d.plan ? `Plan ${d.plan}. ` : ""}{until ? (d.expired ? `Tu plan venció el ${until}.` : `Pagado hasta el ${until}.`) : ""} Si algo falla, sus créditos vuelven solos.</p>
        </div>
        <p className="font-mono text-3xl font-bold tabular-nums">{(d.balance ?? 0).toLocaleString("es-CL")}</p>
      </div>
      {d.history.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-xs text-muted"><th className="py-2 pr-3 font-semibold">Fecha</th><th className="py-2 pr-3 font-semibold">Qué</th><th className="py-2 text-right font-semibold">Créditos</th></tr></thead>
            <tbody>
              {d.history.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap text-muted">{new Date(m.created_at).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="py-2 pr-3">{KIND[m.kind] ?? m.kind}{m.note ? ` · ${m.note}` : ""}</td>
                  <td className={`py-2 text-right font-mono tabular-nums ${m.delta > 0 ? "text-good" : m.delta < 0 ? "" : "text-muted"}`}>{m.delta > 0 ? "+" : ""}{m.delta.toLocaleString("es-CL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TwoFactor() {
  const [st, setSt] = useState<{ ready: boolean; on: boolean } | null>(null);
  const [step, setStep] = useState<"idle" | "password" | "scan" | "off">("idle");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<{ secret: string; qr: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/auth/2fa").then((r) => (r.ok ? r.json() : null)).then(setSt).catch(() => {}); }, []);

  async function call(body: object) {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/auth/2fa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error || "No se pudo." }); return null; }
    return d;
  }

  if (!st) return null;
  return (
    <section className={cardCls} aria-labelledby="tf">
      <div className="flex items-start justify-between gap-2">
        <h2 id="tf" className="font-display text-lg font-bold">Verificación en dos pasos</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.on ? "bg-good/15 text-good" : "bg-surface-2 text-muted"}`}>{st.on ? "Activada" : "Apagada"}</span>
      </div>
      <p className="text-sm text-muted">Además de tu clave, al entrar se pide un código de 6 números de una app en tu teléfono (Google Authenticator, Authy o 1Password). Así, aunque alguien sepa tu clave, no puede entrar.</p>
      {!st.ready && <p className="text-sm text-warn">Falta un paso en Supabase para activarla (billing.sql).</p>}

      {st.ready && !st.on && step === "idle" && <button type="button" onClick={() => setStep("password")} className={`${btnCls} self-start`}>Activar</button>}
      {step === "password" && (
        <form onSubmit={async (e) => { e.preventDefault(); const d = await call({ action: "start", password }); if (d) { setQr(d); setStep("scan"); setPassword(""); } }} className="flex flex-col gap-3">
          <Field label="Tu clave, para confirmar que eres tú"><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} /></Field>
          <button type="submit" disabled={busy} className={`${btnCls} self-start`}>{busy ? "Un momento…" : "Seguir"}</button>
        </form>
      )}
      {step === "scan" && qr && (
        <form onSubmit={async (e) => { e.preventDefault(); const d = await call({ action: "confirm", code }); if (d) { setSt({ ready: true, on: true }); setStep("idle"); setCode(""); setQr(null); setMsg({ ok: true, text: "Listo: desde ahora se pide el código al entrar." }); } }} className="flex flex-col gap-3">
          <p className="text-sm">1. Abre tu app de verificación y escanea este código:</p>
          {/* the SVG is made by our own server from the secret */}
          <div className="w-fit rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: qr.qr }} />
          <p className="text-xs text-muted">¿No puedes escanear? Escribe esta clave en la app: <span className="font-mono select-all text-ink">{qr.secret.replace(/(.{4})/g, "$1 ").trim()}</span></p>
          <Field label="2. Escribe el código de 6 números que aparece"><input inputMode="numeric" maxLength={7} required value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" className={`${inputCls} w-40 font-mono tracking-widest`} /></Field>
          <div className="flex gap-2"><button type="submit" disabled={busy} className={btnCls}>{busy ? "Revisando…" : "Activar"}</button><button type="button" onClick={() => { setStep("idle"); setQr(null); }} className={ghostCls}>Cancelar</button></div>
        </form>
      )}
      {st.on && step === "idle" && <button type="button" onClick={() => setStep("off")} className={`${ghostCls} self-start`}>Apagar</button>}
      {step === "off" && (
        <form onSubmit={async (e) => { e.preventDefault(); const d = await call({ action: "off", password, code }); if (d) { setSt({ ready: true, on: false }); setStep("idle"); setPassword(""); setCode(""); setMsg({ ok: true, text: "Verificación en dos pasos apagada." }); } }} className="flex flex-col gap-3">
          <Field label="Tu clave"><input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} /></Field>
          <Field label="Código de la app"><input inputMode="numeric" maxLength={7} required value={code} onChange={(e) => setCode(e.target.value)} className={`${inputCls} w-40 font-mono tracking-widest`} /></Field>
          <div className="flex gap-2"><button type="submit" disabled={busy} className={btnCls}>Apagar</button><button type="button" onClick={() => setStep("idle")} className={ghostCls}>Cancelar</button></div>
        </form>
      )}
      {msg && <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
    </section>
  );
}
