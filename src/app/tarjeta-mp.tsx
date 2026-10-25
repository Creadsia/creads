"use client";

import { useEffect, useId, useRef, useState } from "react";

// The card form inside Creads (owner, 25 Oct 2026: «que no salga de la plataforma»): Mercado Pago's own secure
// card fields (Card Payment Brick). The card goes from the customer straight to Mercado Pago, which gives back a
// one-time token; Creads never sees the card. Needs NEXT_PUBLIC_MP_PUBLIC_KEY (Mercado Pago → Credenciales →
// Public key). Without it, `fallback` is shown (the button to Mercado Pago's page).

declare global {
  interface Window { MercadoPago?: new (key: string, o: { locale: string }) => { bricks: () => { create: (kind: string, id: string, settings: unknown) => Promise<{ unmount: () => void }> } } }
}
export const PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "";

let sdk: Promise<void> | null = null;
function loadSdk() {
  sdk ??= new Promise<void>((ok, bad) => {
    if (window.MercadoPago) return ok();
    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.onload = () => ok();
    s.onerror = () => { sdk = null; bad(new Error("No cargó Mercado Pago.")); };
    document.head.appendChild(s);
  });
  return sdk;
}

export default function TarjetaMP({ monto, onListo, fallback }: { monto: number; onListo: () => void; fallback: React.ReactNode }) {
  const id = `mp-card-${useId().replace(/[^\w-]/g, "")}`;
  const [err, setErr] = useState("");
  const [roto, setRoto] = useState(!PUBLIC_KEY);
  const [cargado, setCargado] = useState(false);
  const done = useRef(onListo);
  done.current = onListo;

  useEffect(() => {
    if (!PUBLIC_KEY) return;
    let brick: { unmount: () => void } | null = null;
    let alive = true;
    loadSdk().then(async () => {
      if (!alive || !window.MercadoPago) return;
      const mp = new window.MercadoPago(PUBLIC_KEY, { locale: "es-CL" });
      const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
      brick = await mp.bricks().create("cardPayment", id, {
        initialization: { amount: Math.max(1, Math.round(monto)) },
        customization: {
          paymentMethods: { maxInstallments: 1, types: { excluded: ["ticket", "bank_transfer", "atm"] } },
          visual: { hideFormTitle: true, style: { theme: dark ? "dark" : "default" }, texts: { formSubmit: "Activar prueba gratis · hoy $0" } },
        },
        callbacks: {
          onReady: () => alive && setCargado(true),
          onError: (e: unknown) => { console.error("mp brick", e); },
          onSubmit: async (data: { token?: string }) => {
            setErr("");
            const r = await fetch("/api/prueba", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ card_token: data.token }) }).catch(() => null);
            const d = r ? await r.json().catch(() => ({})) : {};
            if (r?.ok && d.estado === "ok") { done.current(); return; }
            setErr(d.error || "No se pudo activar. Revisa los datos de tu tarjeta e intenta de nuevo.");
            throw new Error("rechazada"); // lets the customer correct the card in the same form
          },
        },
      });
    }).catch(() => alive && setRoto(true));
    return () => { alive = false; brick?.unmount(); };
  }, [id, monto]);

  if (roto) return <>{fallback}</>;
  return (
    <div className="flex flex-col gap-2">
      {!cargado && <p className="text-sm text-muted">Cargando el formulario seguro de Mercado Pago…</p>}
      <div id={id} />
      {err && <p className="text-sm text-bad" role="alert">{err}</p>}
    </div>
  );
}
