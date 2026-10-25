"use client";

import { useEffect, useState } from "react";
import { MoneyText } from "../../money";

// Above Automático: the gift ad's state for accounts that haven't paid (owner, 23 Oct 2026, launch audit).
// After the email button (?regalo=…), or while the account has no credits and no plan.

const MSG: Record<string, { tone: "good" | "warn"; text: string }> = {
  ok: { tone: "good", text: "¡Listo! Te cargamos créditos para tu primer anuncio de regalo (unos 12 segundos). Cuéntale a Creads aquí abajo qué vendes y te lo hace." },
  ya: { tone: "warn", text: "Tu anuncio de regalo ya estaba cargado en tu cuenta." },
  tope: { tone: "warn", text: "Este mes ya se entregaron todos los anuncios de regalo. Elige un plan desde US$25 al mes y empiezas al tiro." },
  correo: { tone: "warn", text: "Los correos temporales no reciben el regalo. Crea tu cuenta con tu correo de siempre." },
  tarjeta: { tone: "warn", text: "Para recibir tus créditos de regalo, activa tu prueba gratis agregando tu tarjeta aquí abajo." },
  pagado: { tone: "good", text: "Tu cuenta ya tiene créditos de un plan: úsalos aquí abajo." },
  link: { tone: "warn", text: "Ese enlace no es válido. Pide uno nuevo con el botón de abajo." },
  error: { tone: "warn", text: "No pudimos cargar tu regalo ahora. Intenta de nuevo en unos minutos." },
};

export default function RegaloAviso() {
  const [res, setRes] = useState<string | null>(null);
  const [sinSaldo, setSinSaldo] = useState(false);
  const [sent, setSent] = useState("");
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const r = sp.get("regalo");
    if (r && MSG[r]) setRes(r);
    if (r || sp.get("bienvenida")) window.history.replaceState(null, "", "/app/automatico");
    Promise.all([fetch("/api/credits").then((x) => x.json()), fetch("/api/prueba").then((x) => x.json()).catch(() => ({}))])
      .then(([d, p]) => setSinSaldo(!p?.activa && !d.unlimited && !d.plan && (d.balance ?? 0) <= 0)).catch(() => null);
  }, []);
  async function reenviar() {
    setSent("…");
    const r = await fetch("/api/regalo", { method: "POST" }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setSent(r?.ok ? "Te lo mandamos. Revisa tu correo (y la carpeta de spam)." : d.error || "No se pudo enviar. Intenta de nuevo.");
  }
  const m = res ? MSG[res] : null;
  if (!m && !sinSaldo) return null;
  return (
    <div className={`mb-4 flex flex-col gap-2 rounded-xl border p-4 text-sm ${m?.tone === "good" ? "border-good/40 bg-good/10" : "border-line bg-surface"}`}>
      {m && <p className="font-semibold"><MoneyText text={m.text} /></p>}
      {sinSaldo && res !== "ok" && (
        <>
          {!m && <p><b>Te quedaste sin créditos.</b> Si no recibiste tu anuncio de regalo, pide el correo para activarlo.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={reenviar} disabled={sent === "…"} className="rounded-lg bg-ink px-3 py-1.5 font-semibold text-bg disabled:opacity-50">Reenviarme el correo</button>
            <a href="/app/planes" className="text-muted underline">Ver planes</a>
          </div>
          {sent && sent !== "…" && <p className="text-muted">{sent}</p>}
        </>
      )}
    </div>
  );
}
