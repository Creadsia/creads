// «Garantía de calidad», visible where people pay (owner, 23 Oct 2026, launch audit): the first video is
// redone or its credits returned if they don't like it, and an unused purchase is refunded within 10 days.
// The same promise as the Terms.
export default function Garantia({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border border-good/40 bg-good/10 ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
      <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-good" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" /><path d="M9 12l2 2 4-4" />
      </svg>
      <p className="text-sm leading-snug">
        <b>Garantía de calidad.</b> Si tu primer anuncio no te gusta, lo rehacemos gratis o te devolvemos los créditos. Y si no usaste nada, te devolvemos el pago completo dentro de 10 días. Solo escríbenos a hola@creadsia.com.
      </p>
    </div>
  );
}
