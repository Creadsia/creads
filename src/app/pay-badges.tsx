// How customers can pay (Mercado Pago, in Chilean pesos). Shown wherever there is a price.
export default function PayBadges({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`flex flex-wrap items-center gap-1.5 ${compact ? "text-[11px]" : "text-xs"} font-semibold`} aria-label="Medios de pago">
      <li className="rounded-md bg-[#00b1ea] px-2 py-1 text-white">Mercado Pago</li>
      {["Visa", "Mastercard", "Amex", "Redcompra"].map((x) => (
        <li key={x} className="rounded-md border border-line bg-surface px-2 py-1 text-ink">{x}</li>
      ))}
    </ul>
  );
}
