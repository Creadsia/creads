"use client";

import { useEffect } from "react";
import { reportClientError } from "../error-catcher";

// A studio page crashed: the menu stays (this renders inside the studio layout), the message is plain,
// and the owner gets the report. Work in «Crear anuncio» is kept in the browser and comes back.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientError(error.message || "Error en la página", error.digest ? `ref ${error.digest}` : ""); }, [error]);
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-display text-2xl font-bold">Algo no cargó bien</h1>
      <p className="text-muted">Ya nos llegó el aviso. Prueba de nuevo; si se repite, escríbenos a hola@creadsia.com{error.digest ? ` con el código ${error.digest.slice(0, 10)}` : ""}.</p>
      <div className="flex gap-2">
        <button type="button" onClick={reset} className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink">Intentar de nuevo</button>
        <a href="/app" className="rounded-lg border border-line px-4 py-2 font-semibold">Ir al estudio</a>
      </div>
    </div>
  );
}
