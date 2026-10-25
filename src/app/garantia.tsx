import { GARANTIA } from "@/lib/garantia-textos";

// «Garantía», visible where people pay (owner's plan, 25 Oct 2026): 7 days for the Pack and for a plan's first
// payment, and lip-sync redos always free. The same words as the FAQ and the Terms (src/lib/garantia-textos.ts).
// «que» picks the text: the Pack, a plan, or both (the plans page shows both).
export default function Garantia({ compact = false, que = "ambos" }: { compact?: boolean; que?: "pack" | "plan" | "ambos" }) {
  const lineas = que === "pack" ? [GARANTIA.pack] : que === "plan" ? [GARANTIA.planes] : [GARANTIA.planes, GARANTIA.pack];
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-good/40 bg-good/10 ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
      <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-good" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" />
      </svg>
      <div className="flex flex-col gap-1 text-sm leading-snug">
        {lineas.map((l) => <p key={l}><b>{l.split(":")[0]}:</b>{l.slice(l.indexOf(":") + 1)}</p>)}
        <p className="text-muted">{GARANTIA.labios} {GARANTIA.contacto}</p>
      </div>
    </div>
  );
}
