// WhatsApp help, shown only when NEXT_PUBLIC_WHATSAPP (number with country code, e.g. 56912345678) is set.
// The support promise (SOPORTE_PROMESA, server env) goes next to it; render these from server components.

import { promesaSoporte } from "@/lib/confianza";

export const WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP ?? "").replace(/\D/g, "");
export const whatsappLink = (text = "Hola, tengo una pregunta sobre Creads IA") => (WHATSAPP ? `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}` : "");

/** Floating "Escríbenos por WhatsApp" button (bottom right, above the phone offer bar), with the support promise. */
export default function WhatsAppButton({ text, label = "¿Dudas? Escríbenos", promesa }: { text?: string; label?: string; promesa?: string }) {
  const href = whatsappLink(text);
  if (!href) return null;
  const p = promesa ?? promesaSoporte(process.env);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Escríbenos por WhatsApp${p ? `. ${p}` : ""}`} title={p || undefined}
      className="fixed right-4 bottom-24 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5 sm:bottom-6">
      <svg viewBox="0 0 24 24" className="h-5 w-5 flex-none" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" />
      </svg>
      <span className="hidden flex-col leading-tight sm:flex">
        <span>{label}</span>
        {p && <span className="text-[11px] font-medium opacity-90">{p}</span>}
      </span>
    </a>
  );
}

/**
 * Small support line: «¿Dudas? WhatsApp · hola@creadsia.com — Respondemos en menos de 12 horas hábiles».
 * WhatsApp only when its number is set; the promise only when SOPORTE_PROMESA isn't "-".
 */
export function SoporteLinea({ className = "", promesa }: { className?: string; promesa?: string }) {
  const href = whatsappLink();
  const p = promesa ?? promesaSoporte(process.env);
  return (
    <p className={`text-sm text-muted ${className}`}>
      ¿Dudas?{" "}
      {href && <><a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline-offset-2 hover:underline">Escríbenos por WhatsApp</a>{" o a "}</>}
      {!href && "Escríbenos a "}
      <a href="mailto:hola@creadsia.com" className="font-semibold text-ink underline-offset-2 hover:underline">hola@creadsia.com</a>
      {p && <>. {p.replace(/\.$/, "")}.</>}
    </p>
  );
}
