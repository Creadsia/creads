"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cardCls, Field, ghostCls, inputCls } from "../_parts/ui";

// «Generador de prompts»: a short form → the request written with Creads' recipe (the same know-how as
// Automático). For Automático it hands over one text (and can open the chat with it already written);
// for Manual it hands over each piece to paste: script, person, photo, scenes and notes for the editor.

type Tipo = "ugc" | "demo" | "imagenes";
type Destino = "automatico" | "manual";
interface Res { prompt?: string; guion?: string; persona?: string; foto?: string; escenas?: string[]; indicaciones?: string; imagenes?: { titulo: string; prompt: string }[] }

export const PREFILL = "creads-prompt";

const TIPOS: { id: Tipo; name: string; text: string }[] = [
  { id: "ugc", name: "Anuncio UGC", text: "Una persona hablando a cámara por tu negocio." },
  { id: "demo", name: "Demo con presentador", text: "Un presentador y varios clips de personas mostrando tu producto." },
  { id: "imagenes", name: "Imágenes para anuncios", text: "Fotos 4:5 para el feed de Instagram y Facebook." },
];
const RUBROS = ["Clínica o dentista", "Estética y belleza", "Gimnasio o deporte", "Tienda online", "Comida o cafetería", "Inmobiliaria", "Servicios profesionales", "Otro"];
const OBJETIVOS = ["Agendar una hora", "Comprar", "Escribir por WhatsApp", "Visitar el local", "Entrar a la web"];
const ESTILOS = ["Natural", "Elegante", "Deportiva", "Ejecutiva", "Juvenil"];
const ACENTOS = ["Chileno", "Argentino", "Colombiano", "Mexicano", "Venezolano", "Inglés"];

function Chips({ list, value, onChange }: { list: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((x) => (
        <button key={x} type="button" onClick={() => onChange(value === x ? "" : x)} aria-pressed={value === x}
          className={`rounded-full border px-3 py-1.5 text-sm ${value === x ? "border-ink bg-ink text-bg" : "border-line hover:border-ink"}`}>{x}</button>
      ))}
    </div>
  );
}

function Copy({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className={ghostCls} onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }).catch(() => {}); }}>{ok ? "Copiado ✓" : label}</button>;
}

export default function Generador() {
  const router = useRouter();
  const [tipo, setTipo] = useState<Tipo>("ugc");
  const [destino, setDestino] = useState<Destino>("automatico");
  const [c, setC] = useState<Record<string, string>>({ genero: "Mujer", acento: "Chileno", edicion: "Premium", subtitulos: "Sí" });
  const set = (k: string) => (v: string) => setC((x) => ({ ...x, [k]: v }));
  const inp = (k: string) => ({ value: c[k] ?? "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k)(e.target.value) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<Res | null>(null);
  const [edit, setEdit] = useState("");
  const dest: Destino = tipo === "demo" ? "automatico" : destino;

  async function generar() {
    if (!c.negocio?.trim()) { setErr("Cuéntanos qué vendes (el primer campo)."); return; }
    setBusy(true); setErr(""); setRes(null);
    const r = await fetch("/api/prompts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tipo, destino: dest, campos: c }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) { setErr(d.error || "No se pudo generar. Revisa tu conexión."); return; }
    setRes(d.resultado);
    setEdit(d.resultado?.prompt ?? "");
  }

  function usarEnAutomatico() {
    try { sessionStorage.setItem(PREFILL, edit); } catch {}
    router.push("/app/automatico");
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={cardCls} aria-label="Qué quieres hacer">
        <h2 className="font-semibold">1. ¿Qué quieres hacer?</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {TIPOS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTipo(t.id)} aria-pressed={tipo === t.id}
              className={`flex flex-col gap-1 rounded-xl border p-3 text-left ${tipo === t.id ? "border-ink ring-1 ring-ink" : "border-line hover:border-ink"}`}>
              <b>{t.name}</b><span className="text-sm text-muted">{t.text}</span>
            </button>
          ))}
        </div>
        {tipo !== "demo" ? (
          <Field label="¿Dónde lo vas a usar?">
            <Chips list={["Automático", "Manual"]} value={destino === "automatico" ? "Automático" : "Manual"} onChange={(v) => setDestino(v === "Manual" ? "manual" : "automatico")} />
          </Field>
        ) : <p className="text-sm text-muted">La demo con presentador se hace en Automático.</p>}
      </section>

      <section className={cardCls} aria-label="Tu negocio">
        <h2 className="font-semibold">2. Tu negocio</h2>
        <Field label="¿Qué vendes y cómo se llama tu negocio?"><input {...inp("negocio")} className={inputCls} placeholder="Ej: Clínica dental Sonríe, en Providencia" /></Field>
        <Field label="Rubro"><Chips list={RUBROS} value={c.rubro ?? ""} onChange={set("rubro")} /></Field>
        <Field label="¿Qué quieres que haga la gente?"><Chips list={OBJETIVOS} value={c.objetivo ?? ""} onChange={set("objetivo")} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tu oferta real (opcional)" hint="Solo lo que de verdad ofreces."><input {...inp("oferta")} className={inputCls} placeholder="Ej: primera evaluación sin costo" /></Field>
          <Field label="¿A quién le vendes?"><input {...inp("publico")} className={inputCls} placeholder="Ej: adultos de 30 a 50 en Santiago" /></Field>
          <Field label="Cierre: web, WhatsApp o dirección (opcional)"><input {...inp("cierre")} className={inputCls} placeholder="Ej: sonrie.cl" /></Field>
          <Field label="Color de tu marca (opcional)"><input {...inp("color")} className={inputCls} placeholder="Ej: azul marino o #1A2B4C" /></Field>
        </div>
      </section>

      {tipo !== "imagenes" ? (
        <section className={cardCls} aria-label="Quién aparece">
          <h2 className="font-semibold">3. {tipo === "demo" ? "El presentador y los clips" : "Quién aparece"}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tipo === "demo" ? "Presentador: hombre o mujer" : "Hombre o mujer"}><Chips list={["Mujer", "Hombre"]} value={c.genero ?? ""} onChange={set("genero")} /></Field>
            <Field label="Edad aproximada"><input {...inp("edad")} className={inputCls} placeholder="Ej: 30" /></Field>
          </div>
          <Field label="Estilo"><Chips list={ESTILOS} value={c.estilo ?? ""} onChange={set("estilo")} /></Field>
          <Field label="Cómo se ve (opcional)"><input {...inp("aspecto")} className={inputCls} placeholder="Ej: rubia, ojos claros, simpática" /></Field>
          <Field label="¿Dónde está?"><input {...inp("lugar")} className={inputCls} placeholder={tipo === "demo" ? "Ej: su escritorio con micrófono y luces LED" : "Ej: en su consulta, entre pacientes"} /></Field>
          {tipo === "demo" && (
            <>
              <Field label="El producto que muestran los clips"><input {...inp("producto")} className={inputCls} placeholder="Ej: bebida energética, lata negra con rayo verde" /></Field>
              <Field label="Las personas de los clips"><input {...inp("clips")} className={inputCls} placeholder="Ej: 4 personas deportivas y atractivas, cada una en un lugar distinto" /></Field>
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Acento de la voz"><Chips list={ACENTOS} value={c.acento ?? ""} onChange={set("acento")} /></Field>
            <Field label="Edición"><Chips list={["Premium", "Natural"]} value={c.edicion ?? ""} onChange={set("edicion")} /></Field>
          </div>
          {tipo === "ugc" && <Field label="Subtítulos"><Chips list={["Sí", "No"]} value={c.subtitulos ?? ""} onChange={set("subtitulos")} /></Field>}
          <Field label="¿Algo más que deba decir o evitar? (opcional)"><textarea {...inp("extra")} rows={2} className={inputCls} placeholder="Ej: no mencionar precios; decir que atendemos sábados" /></Field>
        </section>
      ) : (
        <section className={cardCls} aria-label="Las imágenes">
          <h2 className="font-semibold">3. Las imágenes</h2>
          <Field label="¿Qué deben mostrar?"><input {...inp("imagenes")} className={inputCls} placeholder="Ej: mi producto en uso, personas felices, antes y después del local" /></Field>
          <Field label="Estilo"><Chips list={["Natural", "Elegante", "Llamativo", "Minimalista"]} value={c.estilo ?? ""} onChange={set("estilo")} /></Field>
          <Field label="¿Algo más? (opcional)"><textarea {...inp("extra")} rows={2} className={inputCls} placeholder="Ej: sin texto en las imágenes" /></Field>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={generar} disabled={busy} className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-bg disabled:opacity-50">{busy ? "Escribiendo tu prompt…" : res ? "Generar otra versión" : "Generar prompt"}</button>
        <span className="text-xs text-muted">No descuenta segundos de tu plan.</span>
      </div>
      {err && <p className="text-sm text-bad">{err}</p>}

      {res && (
        <section className={cardCls} aria-label="Tu prompt">
          <h2 className="font-semibold">Tu prompt</h2>
          {res.prompt !== undefined ? (
            <>
              <p className="text-sm text-muted">Puedes cambiar lo que quieras antes de usarlo.</p>
              <textarea value={edit} onChange={(e) => setEdit(e.target.value)} rows={16} className={`${inputCls} text-[15px] leading-relaxed`} aria-label="Prompt generado" />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={usarEnAutomatico} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg">Usar en Automático</button>
                <Copy text={edit} />
              </div>
            </>
          ) : res.imagenes ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">Pega cada una en <a href="/app/laboratorio" className="underline">Imágenes para anuncios</a>.</p>
              {res.imagenes.map((x, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-xl border border-line p-3">
                  <b className="text-sm">{x.titulo}</b>
                  <p className="text-sm text-muted">{x.prompt}</p>
                  <Copy text={x.prompt} />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {[
                ["1. La persona (en Avatares)", `${res.persona ?? ""}`, "/app/avatares"],
                ["2. La foto de la persona (en Imágenes para anuncios)", res.foto ?? "", "/app/laboratorio"],
                ["3. El guion (en Crear anuncio)", res.guion ?? "", "/app/crear"],
                ["4. Las escenas, corte por corte", (res.escenas ?? []).map((e, i) => `${i + 1}. ${e}`).join("\n"), "/app/crear"],
                ["5. Indicaciones para la edición", res.indicaciones ?? "", "/app/crear"],
              ].filter(([, t]) => t).map(([k, t, href]) => (
                <div key={k} className="flex flex-col gap-2 rounded-xl border border-line p-3">
                  <span className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{k}</b><a href={href} className="text-xs text-muted underline">Ir</a></span>
                  <p className="whitespace-pre-wrap text-sm">{t}</p>
                  <Copy text={t} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
