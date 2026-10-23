// «Casos reales» on the sales page (launch audit, 23 Oct 2026): ready to fill with real customers' ads and
// their own words, ONLY with their written permission. Empty = the section doesn't show. Never invent one.
// To add a case: put the video in /public/casos/ and a line here.

export interface Caso {
  negocio: string; // «Cafetería Lumbre, Ñuñoa»
  persona: string; // who said it (name and role), as they approved
  cita: string; // their own words, unedited
  video: string; // /casos/lumbre.mp4
  poster: string; // /casos/lumbre.jpg
  resultado?: string; // only if they gave the number themselves
}

export const CASOS: Caso[] = [];

export default function Casos() {
  if (!CASOS.length) return null;
  return (
    <section className="px-[max(16px,env(safe-area-inset-left,0px))]" aria-labelledby="casos-title">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <h2 id="casos-title" className="font-display text-[1.7rem] leading-[1.1] font-semibold sm:text-[2.3rem]">Negocios que ya lo usan</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {CASOS.map((c) => (
            <figure key={c.negocio} className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4">
              <video src={c.video} poster={c.poster} controls playsInline preload="none" className="aspect-[9/16] w-full rounded-2xl bg-black object-cover" />
              <blockquote className="text-[15px]">«{c.cita}»</blockquote>
              <figcaption className="text-sm text-muted"><b className="text-ink">{c.persona}</b> · {c.negocio}{c.resultado ? ` · ${c.resultado}` : ""}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
