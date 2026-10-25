import type { Metadata } from "next";
import { HerramientaShell, gutter, h2, wrap } from "../herramientas-ui";
import { PASOS_PLANTILLA } from "@/lib/plantilla-meta";
import PlantillaForm from "./plantilla-form";

export const metadata: Metadata = {
  title: "Plantilla gratis para subir anuncios en bloque a Meta Ads | Creads IA",
  description: "Descarga la plantilla para importar anuncios en bloque en el Administrador de anuncios de Meta (Facebook e Instagram), con filas de ejemplo e instrucciones en español.",
  alternates: { canonical: "/plantilla-meta" },
};

const INCLUYE = [
  ["El archivo CSV", "Con las columnas que usa el Administrador de anuncios para importar en bloque: campaña, conjunto, anuncio, texto, título, link, botón e imagen."],
  ["Filas de ejemplo", "Un producto de ejemplo con 3 anuncios en Feed 4:5 y los mismos 3 en Stories y Reels 9:16, para que veas cómo se llena cada fila."],
  ["Instrucciones", "Un LEEME en español con los pasos y qué va en cada columna importante."],
] as const;

export default function Page() {
  return (
    <HerramientaShell>
      <section className={gutter}>
        <div className={`${wrap} grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]`}>
          <div className="flex flex-col gap-6">
            <span className="self-start rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">Herramienta gratis</span>
            <h1 className="max-w-[20ch] font-display text-[2.1rem] leading-[1.05] font-semibold sm:text-[3.1rem]">
              Plantilla para subir anuncios <span className="bg-[image:var(--grad)] bg-clip-text text-transparent">en bloque</span> a Meta
            </h1>
            <p className="max-w-[58ch] text-lg text-muted">
              El Administrador de anuncios de Meta puede crear muchos anuncios de una vez desde una planilla, en vez de armarlos uno por uno. Esta plantilla trae las columnas, filas de ejemplo e instrucciones en español.
            </p>
          </div>
          <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-lg font-bold">Descárgala gratis</h2>
            <p className="text-sm text-muted">Déjanos tu correo y se descarga al instante (un ZIP con el CSV y el LEEME).</p>
            <PlantillaForm />
          </div>
        </div>
      </section>

      <section className={gutter} aria-labelledby="pasos">
        <div className={`${wrap} flex flex-col gap-6`}>
          <h2 id="pasos" className={h2}>Cómo se usa, en 4 pasos</h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PASOS_PLANTILLA.map(([t, d], i) => (
              <li key={t} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
                <span className="font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="text-lg font-bold">{t}</h3>
                <p className="text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={gutter} aria-labelledby="incluye">
        <div className={`${wrap} flex flex-col gap-6`}>
          <h2 id="incluye" className={h2}>Qué trae</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {INCLUYE.map(([t, d]) => (
              <article key={t} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
                <h3 className="text-lg font-bold">{t}</h3>
                <p className="text-sm text-muted">{d}</p>
              </article>
            ))}
          </div>
          <p className="max-w-3xl rounded-2xl bg-surface-2 p-4 text-sm text-muted">
            Meta cambia sus columnas de vez en cuando. Si al importar te marca un error, descarga su plantilla oficial (Exportar e importar → Descargar plantilla) y copia ahí tus filas.
          </p>
        </div>
      </section>

      <section className={gutter}>
        <div className={`${wrap} flex flex-col items-start gap-4 rounded-3xl border border-line bg-surface p-6 sm:p-8`}>
          <h2 className={h2}>¿Y si la planilla viene llena?</h2>
          <p className="max-w-2xl text-muted">
            En Creads pegas el link de tu producto, eliges los ángulos y te armamos una tanda de anuncios en imagen (4:5 y 9:16) con este mismo archivo ya lleno, listo para importar.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="/registro" className="rounded-xl bg-ink px-6 py-3 font-semibold text-bg">Crear mi cuenta</a>
            <a href="/generador-de-hooks" className="rounded-xl border border-line px-6 py-3 font-semibold">Probar el generador de hooks</a>
          </div>
        </div>
      </section>
    </HerramientaShell>
  );
}
