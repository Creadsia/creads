"use client";

import { useEffect, useRef, useState } from "react";

// Real requests people make; the hero types them out so a visitor sees what to ask for.
const IDEAS = [
  "Un reel de 30 segundos para mi cafetería en Providencia, con una barista hablando a cámara",
  "3 anuncios UGC para seguros de auto en EE. UU., formato drive-thru, en inglés",
  "Fotos de producto para mi sérum, estilo lujo, para el feed de Instagram",
  "Un podcast corto entre dos expertas explicando cómo ahorrar al remodelar el baño",
  "Mi propia cara y mi voz presentando la nueva colección, en 9:16 para TikTok",
];

const KINDS = ["Anuncio UGC", "Reel", "Podcast", "Foto de producto", "Avatar con tu cara", "Voz clonada"];

export default function Composer() {
  const [text, setText] = useState("");
  const [kind, setKind] = useState(KINDS[0]);
  const [typed, setTyped] = useState(true); // false once the visitor writes their own idea
  const [sent, setSent] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  // Typewriter for example ideas until the visitor focuses the box.
  useEffect(() => {
    if (!typed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(IDEAS[0]);
      return;
    }
    let idea = 0;
    let pos = 0;
    let hold = 0;
    const t = setInterval(() => {
      const full = IDEAS[idea];
      if (pos < full.length) {
        pos += 1;
        setText(full.slice(0, pos));
      } else if (hold < 40) {
        hold += 1;
      } else {
        idea = (idea + 1) % IDEAS.length;
        pos = 0;
        hold = 0;
      }
    }, 38);
    return () => clearInterval(t);
  }, [typed]);

  function takeOver() {
    if (typed) {
      setTyped(false);
      setText("");
    }
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
    document.getElementById("fundadores")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <form
      onSubmit={create}
      className="relative w-full overflow-hidden rounded-[1.4rem] border border-line bg-surface/90 p-3 shadow-[0_40px_120px_-40px_rgba(139,124,255,0.45)] backdrop-blur"
    >
      <label htmlFor="idea" className="sr-only">
        Describe lo que quieres crear
      </label>
      <textarea
        id="idea"
        ref={area}
        rows={3}
        value={text}
        onFocus={takeOver}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe lo que quieres crear…"
        className="w-full resize-none bg-transparent px-3 pt-2 text-[17px] leading-relaxed outline-none placeholder:text-muted"
      />
      <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
        {KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
              kind === k ? "border-transparent bg-ink text-bg" : "border-line text-muted hover:text-ink"
            }`}
          >
            {k}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2 text-sm text-muted">
          <span className="hidden rounded-md bg-surface-2 px-2 py-1 sm:inline">9:16</span>
          <span className="hidden rounded-md bg-surface-2 px-2 py-1 sm:inline">Español</span>
          <button
            type="submit"
            className="rounded-xl bg-[image:var(--grad)] px-5 py-2.5 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(255,90,78,0.6)] transition-transform hover:-translate-y-px"
          >
            Crear
          </button>
        </span>
      </div>
      {sent && (
        <p role="status" className="border-t border-line px-3 pt-3 pb-1 text-sm">
          Creads está en beta privada. Deja tu correo abajo y te avisamos cuando abra tu cupo de fundador.
        </p>
      )}
    </form>
  );
}
