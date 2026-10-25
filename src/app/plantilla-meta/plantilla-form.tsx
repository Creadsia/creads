"use client";

import { useState } from "react";
import { newEventId, track } from "@/lib/track";
import { evento } from "../herramientas-track";

type Estado = "idle" | "enviando" | "listo" | "error";

function descargar(blob: Blob, nombre: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

export default function PlantillaForm() {
  const [estado, setEstado] = useState<Estado>("idle");
  const [msg, setMsg] = useState("");
  const [archivo, setArchivo] = useState<Blob | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    setEstado("enviando");
    setMsg("");
    const eventId = newEventId();
    try {
      const r = await fetch("/api/herramientas/plantilla-meta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, lang: "es", eventId }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setEstado("error");
        setMsg(d.error || "No pudimos guardar tu correo. Intenta de nuevo en un momento.");
        return;
      }
      const blob = await r.blob();
      setArchivo(blob);
      descargar(blob, "plantilla-meta-creads.zip");
      setEstado("listo");
      track("Lead", { content_name: "Plantilla Meta" }, eventId);
      evento("tool_template_lead");
    } catch {
      setEstado("error");
      setMsg("No hay conexión. Revisa tu internet e intenta de nuevo.");
    }
  }

  if (estado === "listo") {
    return (
      <div role="status" className="flex flex-col gap-3 rounded-xl border border-line bg-bg/60 p-4">
        <p className="font-medium text-good">Listo: tu plantilla se está descargando.</p>
        {archivo && (
          <button type="button" onClick={() => descargar(archivo, "plantilla-meta-creads.zip")} className="self-start text-sm font-semibold underline">
            ¿No se descargó? Descárgala de nuevo
          </button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-3">
      <label htmlFor="plantilla-email" className="text-sm font-semibold">Tu correo</label>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input id="plantilla-email" name="email" type="email" required autoComplete="email" inputMode="email" placeholder="tu@correo.com" className="min-w-0 flex-1 rounded-xl border border-line bg-bg/60 px-4 py-3 text-[15px]" />
        <button type="submit" disabled={estado === "enviando"} className="rounded-xl bg-[image:var(--grad)] px-5 py-3 font-semibold text-white disabled:opacity-60">
          {estado === "enviando" ? "Preparando…" : "Descargar plantilla"}
        </button>
      </div>
      <p className="text-xs text-muted">Te podemos escribir con novedades de Creads; te das de baja cuando quieras. Ver <a href="/privacidad" className="underline">privacidad</a>.</p>
      {estado === "error" && <p role="alert" className="text-sm text-bad">{msg}</p>}
    </form>
  );
}
