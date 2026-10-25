"use client";

import { CASO_TEXTO } from "@/lib/caso-fundador";

/** The optional «Caso fundador» box at the Pack Prueba checkout: unchecked by default, never needed to pay. */
export default function CasoFundadorCheck({ checked, onChange, className = "" }: { checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2 text-xs text-muted ${className}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#8A5CFF]" />
      <span>{CASO_TEXTO} <span className="opacity-80">(Opcional, no cambia tu compra.)</span></span>
    </label>
  );
}
