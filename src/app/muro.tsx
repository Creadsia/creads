import Image from "next/image";
import DemoPhone from "./demo-phone";
import { IDEAS } from "@/lib/ideas";

// «El muro» (owner, 25 Oct 2026: «todos los videos están muy ordenados de la misma manera, dale movimiento»):
// two endless rows of real Creads outputs drifting in opposite directions — image ads on top, videos below —
// with mixed sizes and slight tilts so it reads like a feed, not a grid. Each row is rendered twice for the
// seamless loop; the copy is hidden from screen readers.

export type Clip = { src: string; poster: string; label: string };

const TILT = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "rotate-0"];
const ANCHO = ["w-40 sm:w-48", "w-36 sm:w-44", "w-44 sm:w-56", "w-36 sm:w-44"];

function Fila({ children, dur, rev = false, label }: { children: (copy: boolean) => React.ReactNode; dur: string; rev?: boolean; label: string }) {
  return (
    <div className={`marquee ${rev ? "marquee-rev" : ""}`} style={{ ["--dur" as string]: dur }} role="region" aria-label={label} tabIndex={0}>
      <div className="marquee-track">
        <div className="flex shrink-0 items-center gap-4 pr-4 sm:gap-6 sm:pr-6">{children(false)}</div>
        <div className="flex shrink-0 items-center gap-4 pr-4 sm:gap-6 sm:pr-6" aria-hidden="true">{children(true)}</div>
      </div>
    </div>
  );
}

export default function Muro({ videos }: { videos: Clip[] }) {
  const imgs = IDEAS.filter((i) => i.formato === "4:5");
  return (
    <div className="flex flex-col gap-6 py-4 sm:gap-8">
      <Fila dur="90s" label="Anuncios de imagen hechos con Creads">
        {(copy) => imgs.map((i, n) => (
          <div key={`${i.id}${copy ? "-c" : ""}`} className={`glow-ring shrink-0 rounded-2xl ${ANCHO[n % ANCHO.length]} ${TILT[n % TILT.length]}`}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-[#17191e] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
              <Image src={i.src} alt={copy ? "" : `Anuncio de ${i.tipo.toLowerCase()} hecho con Creads`} fill sizes="224px" className="object-cover" />
            </div>
          </div>
        ))}
      </Fila>
      <Fila dur="70s" rev label="Videos hechos con Creads">
        {(copy) => videos.map((v, n) => (
          <div key={`${v.src}${copy ? "-c" : ""}`} className={`glow-ring shrink-0 rounded-[1.4rem] ${n % 3 === 1 ? "w-32 sm:w-40" : "w-36 sm:w-48"} ${TILT[(n + 2) % TILT.length]}`}>
            <DemoPhone {...v} label={copy ? "" : v.label} />
          </div>
        ))}
      </Fila>
    </div>
  );
}
