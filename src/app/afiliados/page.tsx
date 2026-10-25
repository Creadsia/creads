import type { Metadata } from "next";
import { Logo } from "../brand";
import ThemeToggle from "../theme-toggle";
import { PROGRAMA } from "@/lib/afiliados-calc";

// Public page of the affiliate program (owner, 25 Oct 2026): what it pays, how it works, and the button to
// apply (from the affiliate's own Creads account, /app/afiliados). No income promises (see the terms).

export const metadata: Metadata = {
  title: "Programa de afiliados de Creads IA",
  description: `Recomienda Creads IA y gana ${PROGRAMA.pctTramo1}% de lo que paga cada cliente sus primeros ${PROGRAMA.mesesTramo1} meses y ${PROGRAMA.pctTramo2}% hasta el mes ${PROGRAMA.maxMeses}. Cookie de ${PROGRAMA.cookieDias} días, pago mensual.`,
  alternates: { canonical: "/afiliados" },
};

const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";
const wrap = "mx-auto w-full max-w-6xl";
const h2 = "font-display text-[1.7rem] leading-[1.1] font-semibold sm:text-[2.3rem]";
const P = PROGRAMA;

const NUMEROS = [
  [`${P.pctTramo1}%`, `de lo que paga cada cliente en sus meses 1 a ${P.mesesTramo1}`],
  [`${P.pctTramo2}%`, `de lo que paga en sus meses ${P.mesesTramo1 + 1} a ${P.maxMeses}`],
  [`${P.cookieDias} días`, "dura tu enlace en el navegador (gana el último clic)"],
  [`US$${P.minimoUsd}`, "pago mínimo, una vez al mes, por PayPal, Wise o transferencia"],
] as const;

const PASOS = [
  ["Postula", "Entra con tu cuenta de Creads (o créala gratis) y cuéntanos dónde vas a recomendarnos. Revisamos cada postulación a mano."],
  ["Comparte tu enlace o tu código", "Cuando te aprobemos, tendrás un enlace propio y un código. Quien entra por tu enlace o escribe tu código al registrarse queda asociado a ti."],
  ["Gana mientras tu cliente paga", `Cada pago de ese cliente te deja comisión: ${P.pctTramo1}% sus primeros ${P.mesesTramo1} meses y ${P.pctTramo2}% hasta su mes ${P.maxMeses}. Lo ves todo en tu panel.`],
  ["Cobra cada mes", `Las comisiones quedan disponibles ${P.retencionDias} días después del pago del cliente. Pagamos una vez al mes cuando tu saldo disponible llega a US$${P.minimoUsd}.`],
] as const;

const FAQ = [
  ["¿Quién puede ser afiliado?", "Creadores, agencias, media buyers, profesores de marketing y cualquiera con una audiencia a la que le sirva Creads. Necesitas una cuenta de Creads (es gratis) y que aprobemos tu postulación."],
  ["¿Cómo sé que un cliente es mío?", `Si entra por tu enlace, guardamos tu código ${P.cookieDias} días en su navegador; si en ese tiempo entra por el enlace de otro afiliado, cuenta el último. También puede escribir tu código al crear su cuenta. El cliente queda asociado a ti al registrarse.`],
  ["¿Sobre qué monto se calcula?", "Sobre lo que el cliente paga de verdad por planes y recargas, convertido a dólares el día del pago. Un plan anual se reparte en sus 12 meses, cada uno con su porcentaje."],
  ["¿Qué pasa si un cliente pide reembolso?", "La comisión de ese pago se anula. Si ya te la habíamos pagado, se descuenta de tu siguiente pago."],
  ["¿Puedo usar mi propio enlace?", "No. Las compras de tu propia cuenta o con tu mismo correo no generan comisión."],
  ["¿Puedo hacer anuncios en Google con la marca Creads?", "No puedes pujar por «Creads» ni sus variantes en buscadores. Sí puedes hacer anuncios con tu propio contenido (reseñas, tutoriales, comparativas). El detalle está en los términos."],
] as const;

const ejemplo = 50;
const ejemploTotal = ejemplo * (P.pctTramo1 / 100) * P.mesesTramo1 + ejemplo * (P.pctTramo2 / 100) * (P.maxMeses - P.mesesTramo1);

export default function Afiliados() {
  return (
    <div lang="es" className="overflow-x-clip bg-bg">
      <header className="border-b border-line/60">
        <div className={`${wrap} flex items-center justify-between gap-3 py-3 ${gutter}`}>
          <Logo href="/" />
          <div className="flex items-center gap-2">
            <ThemeToggle lang="es" />
            <a href="/app/afiliados" className="px-2 text-sm font-semibold text-muted hover:text-ink">Mi panel</a>
            <a href="/app/afiliados" className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-bg">Postular</a>
          </div>
        </div>
      </header>
      <main className="flex flex-col gap-16 py-10 sm:gap-24 sm:py-16">
        <section className={gutter}>
          <div className={`${wrap} flex flex-col gap-6`}>
            <span className="self-start rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted">Programa de afiliados</span>
            <h1 className="max-w-[20ch] font-display text-[2.3rem] leading-[1.03] font-semibold sm:text-[3.6rem]">
              Recomienda Creads y gana hasta <span className="bg-[image:var(--grad)] bg-clip-text text-transparent">{P.pctTramo1}%</span> de cada pago
            </h1>
            <p className="max-w-[56ch] text-lg text-muted">
              Si tu audiencia hace anuncios, Creads les ahorra días de trabajo. Tú ganas una comisión por cada cliente que llegue por ti, durante sus primeros {P.maxMeses} meses.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="/app/afiliados" className="rounded-xl bg-[image:var(--grad)] px-6 py-3 font-semibold text-white">Postular al programa</a>
              <a href="/afiliados/terminos" className="rounded-xl border border-line px-6 py-3 font-semibold">Leer los términos</a>
            </div>
            <p className="text-sm text-muted">¿No tienes cuenta? <a href="/registro" className="font-semibold underline">Créala gratis</a> y después postula desde tu panel.</p>
          </div>
        </section>

        <section className={gutter} aria-labelledby="cuanto">
          <div className={`${wrap} flex flex-col gap-6`}>
            <h2 id="cuanto" className={h2}>Cuánto pagamos</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {NUMEROS.map(([n, t]) => (
                <article key={n} className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-5">
                  <b className="font-display text-3xl font-semibold">{n}</b>
                  <p className="text-sm text-muted">{t}</p>
                </article>
              ))}
            </div>
            <p className="max-w-3xl rounded-2xl bg-surface-2 p-4 text-sm text-muted">
              Ejemplo de cómo se calcula (no es una promesa de ingresos): un cliente que paga US${ejemplo} al mes durante un año te deja {P.mesesTramo1} × US${(ejemplo * P.pctTramo1) / 100} + {P.maxMeses - P.mesesTramo1} × US${(ejemplo * P.pctTramo2) / 100} = <b className="text-ink">US${ejemploTotal}</b>. Lo que ganes depende de cuántos clientes traigas y de cuánto tiempo sigan pagando.
            </p>
          </div>
        </section>

        <section className={gutter} aria-labelledby="como">
          <div className={`${wrap} flex flex-col gap-6`}>
            <h2 id="como" className={h2}>Cómo funciona</h2>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PASOS.map(([t, d], i) => (
                <li key={t} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
                  <span className="font-mono text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="text-lg font-bold">{t}</h3>
                  <p className="text-sm text-muted">{d}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={gutter} aria-labelledby="preguntas">
          <div className={`${wrap} flex flex-col gap-6`}>
            <h2 id="preguntas" className={h2}>Preguntas frecuentes</h2>
            <div className="flex max-w-3xl flex-col gap-2">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group rounded-2xl border border-line bg-surface p-4">
                  <summary className="cursor-pointer font-semibold">{q}</summary>
                  <p className="mt-2 text-sm text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className={gutter}>
          <div className={`${wrap} flex flex-col items-start gap-4 rounded-3xl border border-line bg-surface p-6 sm:p-8`}>
            <h2 className={h2}>¿Te sumas?</h2>
            <p className="max-w-2xl text-muted">Postula en dos minutos. Te avisamos por correo cuando revisemos tu postulación.</p>
            <div className="flex flex-wrap gap-3">
              <a href="/app/afiliados" className="rounded-xl bg-ink px-6 py-3 font-semibold text-bg">Postular al programa</a>
              <a href="mailto:hola@creadsia.com?subject=Programa%20de%20afiliados" className="rounded-xl border border-line px-6 py-3 font-semibold">Escribir a hola@creadsia.com</a>
            </div>
          </div>
        </section>
      </main>
      <footer className={`border-t border-line ${gutter}`}>
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-3 py-6 text-sm text-muted`}>
          <span>© {new Date().getFullYear()} Creads IA</span>
          <nav aria-label="Legal" className="flex flex-wrap gap-4">
            <a href="/afiliados/terminos" className="hover:text-ink">Términos del programa</a>
            <a href="/terminos" className="hover:text-ink">Términos y condiciones</a>
            <a href="/privacidad" className="hover:text-ink">Privacidad</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
