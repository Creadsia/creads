import { type MetodoPago, metodosPago } from "@/lib/confianza";

// How customers can pay. Shown wherever there is a price, and ONLY with the methods that really work:
// Mercado Pago when its keys are set, Stripe only when both its keys exist (never a method we can't charge).
// Plain text marks (no imitation of official logos). Nothing active → nothing shown.

// In the browser only NEXT_PUBLIC_ values exist (and server and browser must agree when the page hydrates),
// so the default reads only those; server components get the full list from <InsigniasPago />.
const publicos = () => metodosPago({ NEXT_PUBLIC_MP_PUBLIC_KEY: process.env.NEXT_PUBLIC_MP_PUBLIC_KEY });

export default function PayBadges({ compact = false, metodos, garantias = false }: {
  compact?: boolean;
  /** Active methods (server: `metodosPago(process.env)`); by default the ones the browser can see. */
  metodos?: MetodoPago[];
  /** Adds «Pago seguro» and «Cancela cuando quieras». */
  garantias?: boolean;
}) {
  const m = metodos ?? publicos();
  if (!m.length) return null;
  const mp = m.includes("mercadopago");
  const cards = ["Visa", "Mastercard", "Amex", ...(mp ? ["Redcompra"] : [])];
  const neutral = "rounded-md border border-line bg-surface px-2 py-1 text-ink";
  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${compact ? "text-[13px]" : "text-xs"} font-semibold`} aria-label="Medios de pago">
      {mp && <li className="rounded-md bg-[#00b1ea] px-2 py-1 text-white">Mercado Pago</li>}
      {m.includes("stripe") && <li className={neutral}>Stripe</li>}
      {cards.map((x) => <li key={x} className={neutral}>{x}</li>)}
      {garantias && (
        <>
          <li className="flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-ink">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 1 1 8 0v3" /></svg>
            Pago seguro
          </li>
          <li className="rounded-md bg-surface-2 px-2 py-1 text-ink">Cancela cuando quieras</li>
        </>
      )}
    </ul>
  );
}

/** Server components only: every active method (server keys included) + «Pago seguro» / «Cancela cuando quieras». */
export function InsigniasPago({ compact = false, garantias = true }: { compact?: boolean; garantias?: boolean }) {
  return <PayBadges compact={compact} garantias={garantias} metodos={metodosPago(process.env)} />;
}
