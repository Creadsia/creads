"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Field, PageHead, Spinner, btnCls, cardCls, ghostCls, inputCls, uploadFile } from "../_parts/ui";
import { MARCA_VACIA, TONOS, type Marca } from "@/lib/marca-tipos";

// «Kit de marca»: logo, colours, tone and product, loaded once and used by every batch.

const POS: { id: Marca["logoPos"]; label: string }[] = [
  { id: "arriba-der", label: "Arriba a la derecha" }, { id: "arriba-izq", label: "Arriba a la izquierda" },
  { id: "abajo-der", label: "Abajo a la derecha" }, { id: "abajo-izq", label: "Abajo a la izquierda" }, { id: "no", label: "Sin logo en las imágenes" },
];
const TONO_LABEL: Record<(typeof TONOS)[number], string> = { cercano: "Cercano", profesional: "Profesional", divertido: "Divertido", premium: "Premium", directo: "Directo" };

export default function KitMarca() {
  const [m, setM] = useState<Marca | null>(null);
  const [lista, setLista] = useState<{ activa: number; marcas: { n: number; nombre: string }[]; max: number }>({ activa: 1, marcas: [], max: 1 });
  const tomar = (d: { marca?: Marca; activa?: number; marcas?: { n: number; nombre: string }[]; max?: number }) => {
    setM(d?.marca ?? { ...MARCA_VACIA });
    setLista({ activa: d?.activa ?? 1, marcas: d?.marcas ?? [], max: d?.max ?? 1 });
  };
  async function cambiar(body: unknown) {
    setBusy("Cambiando…"); setMsg("");
    try {
      const r = await fetch("/api/marca", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo cambiar de marca.");
      tomar(d);
    } catch (e) { setMsg(e instanceof Error ? e.message : "No se pudo cambiar de marca."); } finally { setBusy(""); }
  }
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/marca").then((r) => r.json()).then(tomar).catch(() => setM({ ...MARCA_VACIA }));
  }, []);
  if (!m) return <p className="flex items-center gap-2 text-sm text-muted"><Spinner /> Cargando tu kit…</p>;
  const p = m.producto;
  const setP = (patch: Partial<Marca["producto"]>) => setM({ ...m, producto: { ...p, ...patch } });

  async function subir(file: File | undefined, done: (url: string) => void) {
    if (!file) return;
    setBusy("Subiendo…"); setMsg("");
    try { done(await uploadFile(file)); } catch (e) { setMsg(e instanceof Error ? e.message : "No se pudo subir."); } finally { setBusy(""); }
  }
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setBusy("Guardando…"); setMsg("");
    try {
      const r = await fetch("/api/marca", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ marca: m }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo guardar.");
      tomar(d); setMsg("Guardado. Tus próximas tandas usan este kit.");
    } catch (err) { setMsg(err instanceof Error ? err.message : "No se pudo guardar."); } finally { setBusy(""); }
  }

  return (
    <>
      <PageHead title="Kit de marca" lead="Cárgalo una vez: tu logo, colores, tono y producto se aplican a todos tus anuncios." />
      <div className="flex flex-wrap items-center gap-2" aria-label="Tus marcas">
        {lista.marcas.map((x) => (
          <button key={x.n} type="button" onClick={() => x.n !== lista.activa && cambiar({ accion: "activar", n: x.n })} aria-pressed={x.n === lista.activa}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${x.n === lista.activa ? "border-accent bg-accent/10" : "border-line text-muted hover:text-ink"}`}>{x.nombre}</button>
        ))}
        {lista.marcas.length < lista.max
          ? <button type="button" onClick={() => cambiar({ accion: "nueva" })} className="rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-muted hover:text-ink">+ Agregar marca</button>
          : lista.max === 1 && <span className="text-xs text-muted">Con el plan Agencia puedes tener hasta 3 marcas, cada una con su kit.</span>}
      </div>
      <form onSubmit={guardar} className="flex flex-col gap-4">
        <section className={cardCls}>
          <h2 className="font-display text-lg font-bold">Tu marca</h2>
          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            <div className="flex flex-col gap-2">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2 p-3">
                {m.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                ) : <span className="text-center text-xs text-muted">Logo en PNG con fondo transparente</span>}
              </div>
              <label className={`${ghostCls} cursor-pointer text-center`}>{m.logo ? "Cambiar logo" : "Subir logo"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => subir(e.target.files?.[0], (url) => setM({ ...m, logo: url }))} />
              </label>
              {m.logo && <button type="button" onClick={() => setM({ ...m, logo: "" })} className="text-xs text-muted underline">Quitar logo</button>}
            </div>
            <div className="flex flex-col gap-3">
              <Field label="Nombre de la marca"><input value={m.nombre} onChange={(e) => setM({ ...m, nombre: e.target.value })} placeholder="Ej: Casa Nativa" className={inputCls} /></Field>
              <Field label="Dónde va el logo en las imágenes">
                <select value={m.logoPos} onChange={(e) => setM({ ...m, logoPos: e.target.value as Marca["logoPos"] })} className={inputCls}>
                  {POS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                </select>
              </Field>
              <div className="flex flex-wrap gap-4">
                <Field label="Color principal"><input type="color" value={m.c1} onChange={(e) => setM({ ...m, c1: e.target.value })} className="h-10 w-20 cursor-pointer rounded-lg border border-line bg-surface-2" /></Field>
                <Field label="Color secundario"><input type="color" value={m.c2} onChange={(e) => setM({ ...m, c2: e.target.value })} className="h-10 w-20 cursor-pointer rounded-lg border border-line bg-surface-2" /></Field>
                <Field label="Tono">
                  <select value={m.tono} onChange={(e) => setM({ ...m, tono: e.target.value as Marca["tono"] })} className={inputCls}>
                    {TONOS.map((t) => <option key={t} value={t}>{TONO_LABEL[t]}</option>)}
                  </select>
                </Field>
                <Field label="Idioma">
                  <select value={m.idioma} onChange={(e) => setM({ ...m, idioma: e.target.value === "en" ? "en" : "es" })} className={inputCls}>
                    <option value="es">Español</option><option value="en">Inglés</option>
                  </select>
                </Field>
              </div>
              <Field label="Notas de tu marca" hint="Palabras que usas o evitas, cómo le hablas a tu cliente."><textarea rows={2} value={m.notas} onChange={(e) => setM({ ...m, notas: e.target.value })} placeholder="Ej: Tratamos de tú. Nunca decimos «barato», decimos «a buen precio»." className={inputCls} /></Field>
            </div>
          </div>
        </section>

        <section className={cardCls}>
          <h2 className="font-display text-lg font-bold">Tu producto principal</h2>
          <div className="grid gap-4 md:grid-cols-[180px_1fr]">
            <div className="flex flex-col gap-2">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2">
                {p.foto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.foto} alt="Producto" className="h-full w-full object-contain" />
                ) : <span className="px-3 text-center text-xs text-muted">Foto clara del producto</span>}
              </div>
              <label className={`${ghostCls} cursor-pointer text-center`}>{p.foto ? "Cambiar foto" : "Subir foto"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => subir(e.target.files?.[0], (url) => setP({ foto: url }))} />
              </label>
            </div>
            <div className="flex flex-col gap-3">
              <Field label="Nombre"><input value={p.nombre} onChange={(e) => setP({ nombre: e.target.value })} className={inputCls} /></Field>
              <Field label="Qué es"><textarea rows={2} value={p.descripcion} onChange={(e) => setP({ descripcion: e.target.value })} className={inputCls} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Precio"><input value={p.precio} onChange={(e) => setP({ precio: e.target.value })} placeholder="$24.990" className={inputCls} /></Field>
                <Field label="Link"><input type="url" value={p.url} onChange={(e) => setP({ url: e.target.value })} placeholder="https://" className={inputCls} /></Field>
              </div>
              <Field label="Quién lo compra"><input value={p.publico} onChange={(e) => setP({ publico: e.target.value })} placeholder="Ej: mamás de 25 a 40 que…" className={inputCls} /></Field>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={Boolean(busy)} className={btnCls}>{busy === "Guardando…" ? "Guardando…" : "Guardar kit"}</button>
          <Link href="/app/tanda" className={ghostCls}>Crear una tanda</Link>
          {(busy || msg) && <span className="text-sm text-muted" role="status">{busy || msg}</span>}
        </div>
      </form>
    </>
  );
}
