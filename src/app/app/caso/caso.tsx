"use client";

import { useEffect, useState } from "react";
import { Field, PageHead, btnCls, cardCls, ghostCls, inputCls, uploadFile } from "../_parts/ui";
import type { EstadoCaso, Testimonio } from "@/lib/caso-fundador";

// «Caso fundador»: the testimonial form the day-14 email links to. Text, an optional screenshot of Meta Ads
// Manager and an explicit permission (stored with date and text). Nothing is shown until the owner approves it.

interface Data { caso: { estado: EstadoCaso; testimonio: Testimonio | null } | null; nombre?: string; permisoTexto: string; error?: string }

const LEAD = "Tu experiencia ayuda a otros negocios a decidirse. Te toma unos 3 minutos.";

export default function Caso() {
  const [d, setD] = useState<Data | null>(null);
  const [nombre, setNombre] = useState("");
  const [rubro, setRubro] = useState("");
  const [texto, setTexto] = useState("");
  const [imagen, setImagen] = useState("");
  const [permiso, setPermiso] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    fetch("/api/caso").then((r) => r.json()).then((j: Data) => {
      setD(j);
      const t = j.caso?.testimonio;
      setNombre(t?.nombre ?? j.nombre ?? "");
      setRubro(t?.rubro ?? ""); setTexto(t?.texto ?? ""); setImagen(t?.imagen ?? "");
    }).catch(() => setD({ caso: null, permisoTexto: "", error: "No pudimos cargar el formulario. Revisa tu conexión y recarga." }));
  }, []);

  async function subir(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setErr("Sube la captura en JPG, PNG o WEBP.");
    setErr(""); setBusy("subiendo");
    try { setImagen(await uploadFile(f)); } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo subir la imagen."); }
    setBusy("");
  }

  async function post(body: Record<string, unknown>) {
    setBusy("guardando"); setErr(""); setOk("");
    const r = await fetch("/api/caso", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBusy("");
    if (!r?.ok) { setErr(j.error || "No se pudo guardar. Intenta de nuevo."); return false; }
    setD((cur) => (cur ? { ...cur, caso: j.caso } : cur));
    return true;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (await post({ accion: "enviar", nombre, rubro, texto, imagen: imagen || undefined, permiso })) { setPermiso(false); setOk("¡Gracias! Lo recibimos. Lo revisamos antes de mostrarlo."); }
  }

  if (!d) return <><PageHead title="Cuéntanos cómo te fue" lead={LEAD} /><p className="text-muted">Cargando…</p></>;
  if (d.error) return <><PageHead title="Cuéntanos cómo te fue" lead={LEAD} /><p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm">{d.error}</p></>;
  if (!d.caso) {
    return (
      <>
        <PageHead title="Cuéntanos cómo te fue" lead={LEAD} />
        <section className={cardCls}>
          <p className="text-sm">Este formulario es para quienes se sumaron a los casos fundadores al comprar el Pack Prueba.</p>
          <p className="text-sm text-muted">¿Quieres contarnos tu experiencia igual? Escríbenos a <span className="select-all text-ink">hola@creadsia.com</span>.</p>
        </section>
      </>
    );
  }
  const t = d.caso.testimonio;
  const conPermiso = Boolean(t?.permiso);

  return (
    <>
      <PageHead title="Cuéntanos cómo te fue" lead={LEAD} />
      {t && (
        <p className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">
          {d.caso.estado === "publicado" ? "Tu testimonio está publicado. ¡Gracias!" : conPermiso ? "Ya recibimos tu testimonio. Si cambias algo y lo vuelves a enviar, lo revisamos de nuevo antes de mostrarlo." : "Retiraste tu permiso: tu testimonio no se muestra en ninguna parte."}
          {conPermiso && <> <button type="button" onClick={() => { if (confirm("¿Retirar tu permiso? Dejamos de mostrar tu testimonio.")) post({ accion: "retirar" }).then((x) => x && setOk("Listo: retiraste tu permiso.")); }} disabled={Boolean(busy)} className="font-semibold underline">Retirar mi permiso</button></>}
        </p>
      )}
      <form onSubmit={enviar} className={`${cardCls} max-w-2xl`}>
        <Field label="Tu nombre" hint="Como quieres que aparezca (puede ser solo tu nombre de pila).">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required minLength={2} maxLength={80} className={inputCls} />
        </Field>
        <Field label="Tu rubro o tienda" hint="Por ejemplo: «Tienda de cosmética natural en Valparaíso».">
          <input value={rubro} onChange={(e) => setRubro(e.target.value)} maxLength={120} className={inputCls} />
        </Field>
        <Field label="¿Cómo te fue?" hint="Qué anuncios usaste, qué resultados viste y qué te ahorró Creads.">
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} required minLength={20} maxLength={2000} rows={6} className={inputCls} />
        </Field>
        <Field label="Captura del Administrador de anuncios de Meta (opcional)" hint="Si quieres, tapa los datos que no quieras mostrar antes de subirla.">
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => subir(e.target.files?.[0])} disabled={Boolean(busy)} className="text-sm" />
        </Field>
        {imagen && (
          <div className="flex flex-wrap items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagen} alt="Tu captura" className="max-h-48 rounded-lg border border-line" />
            <button type="button" onClick={() => setImagen("")} className={ghostCls}>Quitar imagen</button>
          </div>
        )}
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" checked={permiso} onChange={(e) => setPermiso(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#8A5CFF]" />
          <span>{d.permisoTexto}</span>
        </label>
        {err && <p role="alert" className="text-sm text-bad">{err}</p>}
        {ok && <p role="status" className="text-sm text-good">{ok}</p>}
        <button type="submit" disabled={Boolean(busy) || !permiso} className={`${btnCls} self-start`}>{busy === "guardando" ? "Enviando…" : busy === "subiendo" ? "Subiendo imagen…" : t ? "Enviar de nuevo" : "Enviar mi testimonio"}</button>
      </form>
    </>
  );
}
