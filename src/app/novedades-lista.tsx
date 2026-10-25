import { type EntradaRoadmap, type Novedad, bloquesTexto, estadoLabel, fechaLarga, type Trozo } from "@/lib/confianza";

// Changelog / roadmap entries (from the admin: Panel → Marketing → Portada). Simple text format: paragraphs,
// "- " lists, **bold** and [links](https://…), rendered as plain React (never raw HTML).

function Linea({ trozos }: { trozos: Trozo[] }) {
  return (
    <>
      {trozos.map((t, i) =>
        t.href ? <a key={i} href={t.href} className="font-semibold underline underline-offset-2" {...(t.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{t.t}</a>
        : t.b ? <b key={i}>{t.t}</b> : <span key={i}>{t.t}</span>,
      )}
    </>
  );
}

export function TextoSimple({ texto, className = "" }: { texto: string; className?: string }) {
  const bs = bloquesTexto(texto);
  if (!bs.length) return null;
  return (
    <div className={`flex flex-col gap-2 text-[15px] leading-relaxed ${className}`}>
      {bs.map((b, i) => b.tipo === "p"
        ? <p key={i}><Linea trozos={b.trozos} /></p>
        : <ul key={i} className="flex list-disc flex-col gap-1 pl-5">{b.items.map((it, j) => <li key={j}><Linea trozos={it} /></li>)}</ul>)}
    </div>
  );
}

const ESTADO_CLS: Record<string, string> = { "en-curso": "bg-accent/15 text-accent-text", planeado: "bg-surface-2 text-muted", listo: "bg-good/15 text-good" };

/**
 * A list of entries. `compacta` = only date + title + first paragraph (for a «Novedades» box on the home,
 * with data from `novedadesRecientes(3)`). Empty list → nothing.
 */
export default function NovedadesLista({ entradas, compacta = false, className = "" }: { entradas: (Novedad | EntradaRoadmap)[]; compacta?: boolean; className?: string }) {
  if (!entradas.length) return null;
  return (
    <ol className={`flex flex-col ${compacta ? "gap-3" : "gap-8"} ${className}`}>
      {entradas.map((e) => {
        const estado = "estado" in e ? e.estado : null;
        const primero = compacta ? bloquesTexto(e.texto).find((b) => b.tipo === "p") : null;
        return (
          // list-none!/ml-0!: the legal-page layout styles every <li> as a bullet
          <li key={e.id} className="ml-0! flex list-none! flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <time dateTime={e.fecha}>{fechaLarga(e.fecha)}</time>
              {estado && <span className={`rounded-full px-2 py-0.5 font-semibold ${ESTADO_CLS[estado] ?? ""}`}>{estadoLabel(estado)}</span>}
            </div>
            <h3 className={`font-display font-semibold ${compacta ? "text-base" : "text-xl"}`}>{e.titulo}</h3>
            {compacta ? primero && primero.tipo === "p" && <p className="text-sm text-muted"><Linea trozos={primero.trozos} /></p> : <TextoSimple texto={e.texto} />}
          </li>
        );
      })}
    </ol>
  );
}
