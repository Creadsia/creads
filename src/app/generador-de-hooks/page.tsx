import type { Metadata } from "next";
import { HerramientaShell, gutter, h2, wrap } from "../herramientas-ui";
import { USOS_DIA } from "@/lib/generador-hooks";
import Generador from "./generador";

export const metadata: Metadata = {
  title: "Generador de hooks gratis para anuncios | Creads IA",
  description: "Pega el link de tu producto o descríbelo y recibe 3 ángulos de venta y 10 hooks para tus anuncios de Meta y TikTok. Gratis y sin registrarte.",
  alternates: { canonical: "/generador-de-hooks" },
};

const QUE_ES = [
  ["Hook", "La primera frase del anuncio: el texto en pantalla o lo primero que se dice. Decide si la persona sigue mirando o pasa de largo."],
  ["Ángulo de venta", "Desde dónde le hablas al comprador: el problema que le quitas, lo que quiere lograr, por qué funciona, la oferta…"],
  ["Para qué sirve", "Para probar varios anuncios distintos a la vez y quedarte con el que mejor funciona, en vez de apostar todo a una sola idea."],
] as const;

export default function Page() {
  return (
    <HerramientaShell>
      <section className={gutter}>
        <div className={`${wrap} flex flex-col gap-6`}>
          <span className="self-start rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">Herramienta gratis</span>
          <h1 className="max-w-[22ch] font-display text-[2.1rem] leading-[1.05] font-semibold sm:text-[3.3rem]">
            Generador de <span className="bg-[image:var(--grad)] bg-clip-text text-transparent">hooks</span> para tus anuncios
          </h1>
          <p className="max-w-[60ch] text-lg text-muted">
            Pega el link de tu producto o cuéntanos qué vendes. Te damos 3 ángulos de venta, por qué podría funcionar cada uno y 10 hooks listos para probar. Sin registrarte, {USOS_DIA} veces al día.
          </p>
          <Generador />
        </div>
      </section>

      <section className={gutter} aria-labelledby="que-es">
        <div className={`${wrap} flex flex-col gap-6`}>
          <h2 id="que-es" className={h2}>Qué vas a recibir</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {QUE_ES.map(([t, d]) => (
              <article key={t} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
                <h3 className="text-lg font-bold">{t}</h3>
                <p className="text-sm text-muted">{d}</p>
              </article>
            ))}
          </div>
          <p className="max-w-3xl rounded-2xl bg-surface-2 p-4 text-sm text-muted">
            Los hooks se escriben con lo que dice tu página o tu descripción. No inventamos reseñas, cifras ni testimonios: si tu página no los tiene, no aparecen. Revísalos antes de publicarlos.
          </p>
        </div>
      </section>
    </HerramientaShell>
  );
}
