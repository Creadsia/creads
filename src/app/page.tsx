import Image from "next/image";
import WaitlistForm from "./waitlist-form";

const steps = [
  { n: "1", t: "Pega tu guion ganador", d: "O elige uno de la biblioteca por nicho: seguros, remodelación, fundaciones y más." },
  { n: "2", t: "Elige formato y avatar", d: "UGC, podcast, ronda de testimonios, drive-thru o noticiero, con tu propia cara y voz si quieres." },
  { n: "3", t: "Recibe 3 anuncios terminados", d: "Con cortes, voz, subtítulos y una revisión automática que corrige errores antes de entregarte." },
];

const formats = ["UGC selfie", "Podcast", "Ronda de testimonios", "Drive-thru", "Noticiero", "Comentario"];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-20 px-4 py-10 sm:px-6">
      <header className="flex items-center gap-3">
        <Image src="/logo.svg" alt="" width={32} height={32} priority />
        <span className="text-lg font-semibold tracking-tight">
          Cre<span className="grad-text">ads</span>
        </span>
      </header>

      <section className="flex flex-col gap-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Para afiliados y lead-gen en Meta</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Pega tu guion. Recibe <span className="grad-text">anuncios de video terminados</span>.
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Creads escribe los cortes, genera el video con IA, revisa que diga exactamente tu guion y lo arma con
          subtítulos. Tú solo eliges el que vas a probar.
        </p>
        <WaitlistForm />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="rounded-2xl border border-line bg-surface p-5">
            <span className="font-mono text-xs text-muted">{s.n}</span>
            <h2 className="mt-2 font-semibold">{s.t}</h2>
            <p className="mt-1 text-sm text-muted">{s.d}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">Formatos probados en campañas reales</h2>
        <div className="flex flex-wrap gap-2">
          {formats.map((f) => (
            <span key={f} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm">
              {f}
            </span>
          ))}
        </div>
      </section>

      <footer className="mt-auto border-t border-line pt-6 text-sm text-muted">
        © {new Date().getFullYear()} Creads · <a className="underline" href="mailto:hola@creadsia.com">hola@creadsia.com</a>
      </footer>
    </main>
  );
}
