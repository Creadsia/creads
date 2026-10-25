// «Garantía», visible where people pay (owner's plan, 25 Oct 2026): if the first batch doesn't work for the
// customer, it is redone or the payment refunded. The same promise as the Terms.
export default function Garantia({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-good/40 bg-good/10 ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
      <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-good" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" />
      </svg>
      <p className="text-sm leading-snug">
        <b>Garantía.</b> Si tu primera tanda no te sirve, la rehacemos o te devolvemos el pago. Solo escríbenos a hola@creadsia.com.
      </p>
    </div>
  );
}
