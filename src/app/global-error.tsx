"use client";

import { useEffect } from "react";

// The whole site crashed (even the layout): a bare page that still lets the visitor retry.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      navigator.sendBeacon?.("/api/errores", new Blob([JSON.stringify({ message: `Página caída: ${error.message}`, path: location.pathname })], { type: "application/json" }));
    } catch {}
  }, [error]);
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0b0b10", color: "#f4f4f6", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>Algo no cargó bien</h1>
          <p style={{ color: "#a1a1b5" }}>Ya nos llegó el aviso. Prueba de nuevo en un momento.</p>
          <button type="button" onClick={reset} style={{ marginTop: 12, padding: "10px 18px", borderRadius: 10, border: 0, background: "#7c3aed", color: "#fff", fontWeight: 700 }}>Intentar de nuevo</button>
        </div>
      </body>
    </html>
  );
}
