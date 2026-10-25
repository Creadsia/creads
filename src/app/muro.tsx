import DemoPhone from "./demo-phone";

// «El muro» (owner, 25 Oct 2026): one calm, endless row of clean product videos drifting sideways — no text-heavy
// ads here (those live in «Ejemplos», sorted by niche). Every other phone sits a little lower so the row has
// rhythm without looking messy. The row is rendered twice for the seamless loop; the copy is hidden from
// screen readers and paused/scrollable with reduced motion (globals.css).

export type Clip = { src: string; poster: string; label: string };

export default function Muro({ videos }: { videos: Clip[] }) {
  const fila = (copy: boolean) => (
    <div className="flex shrink-0 items-start gap-5 pr-5 sm:gap-7 sm:pr-7" aria-hidden={copy || undefined}>
      {videos.map((v, n) => (
        <div key={`${v.src}${copy ? "-c" : ""}`} className={`glow-ring w-36 shrink-0 rounded-[1.4rem] sm:w-48 ${n % 2 ? "mt-10" : ""}`}>
          <DemoPhone {...v} label={copy ? "" : v.label} />
        </div>
      ))}
    </div>
  );
  return (
    <div className="marquee py-2" style={{ ["--dur" as string]: "80s" }} role="region" aria-label="Videos de producto hechos con Creads" tabIndex={0}>
      <div className="marquee-track">{fila(false)}{fila(true)}</div>
    </div>
  );
}
