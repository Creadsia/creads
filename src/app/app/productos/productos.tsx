"use client";

import { useState } from "react";
import { DeleteButton, Empty, Field, NextStep, PageHead, type Row, SetupNotice, Stepper, btnCls, cardCls, ghostCls, inputCls, uploadFile, useTable } from "../_parts/ui";

interface Product extends Row { name: string; description: string | null; image_url: string | null }
const blank = { name: "", description: "", image_url: "" };

export default function Productos() {
  const t = useTable<Product>("products");
  const [form, setForm] = useState<typeof blank | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  function open(p?: Product) {
    setMsg(""); setEditing(p?.id ?? null);
    setForm(p ? { name: p.name, description: p.description ?? "", image_url: p.image_url ?? "" } : { ...blank });
  }
  async function onPhoto(file?: File) {
    if (!file || !form) return;
    setBusy(true); setMsg("Subiendo foto…");
    try { setForm({ ...form, image_url: await uploadFile(file) }); setMsg(""); }
    catch (e) { setMsg(e instanceof Error ? e.message : "No se pudo subir."); }
    finally { setBusy(false); }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!form) return;
    setBusy(true); setMsg("");
    try { if (editing) await t.update(editing, form); else await t.add(form); setForm(null); setEditing(null); }
    catch (err) { setMsg(err instanceof Error ? err.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Stepper flow="marca" current={2} />
      <PageHead title="Productos" lead="Opcional. Lo que tus avatares muestran en cámara: un frasco, un espejo, una app. La foto sirve para que se vea igual en cada escena.">
        {!form && <button type="button" onClick={() => open()} className={btnCls}>+ Nuevo producto</button>}
      </PageHead>
      {t.missing && <SetupNotice />}

      {form && (
        <form onSubmit={save} className={cardCls}>
          <h2 className="font-display text-lg font-bold">{editing ? "Editar producto" : "Nuevo producto"}</h2>
          <div className="grid gap-4 md:grid-cols-[200px_1fr]">
            <div className="flex flex-col gap-2">
              <div className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2">
                {form.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.image_url} alt="Foto del producto" className="h-full w-full object-contain" />
                ) : <span className="px-4 text-center text-xs text-muted">Foto clara del producto, idealmente con fondo limpio</span>}
              </div>
              <label className={`${ghostCls} cursor-pointer text-center`}>
                {form.image_url ? "Cambiar foto" : "Subir foto"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
              </label>
            </div>
            <div className="flex flex-col gap-3">
              <Field label="Nombre"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Espejo orgánico de madera" className={inputCls} /></Field>
              <Field label="Cómo es" hint="Mejor en inglés: material, color, tamaño. Ayuda a que el modelo lo dibuje igual.">
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ej: large organic-shaped wall mirror with a thick natural oak frame" className={inputCls} />
              </Field>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy || !form.name.trim()} className={btnCls}>{busy ? "Guardando…" : "Guardar producto"}</button>
            <button type="button" onClick={() => setForm(null)} className={ghostCls}>Cancelar</button>
            {msg && <span className="text-sm text-bad">{msg}</span>}
          </div>
        </form>
      )}

      {t.rows === null ? <p className="text-muted">Cargando…</p> : t.rows.length === 0 && !t.missing ? (
        !form && <Empty title="Todavía no tienes productos" text="Agrega los productos que quieres que aparezcan en tus anuncios."><button type="button" onClick={() => open()} className={btnCls}>Agregar el primero</button></Empty>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
          {t.rows.map((p) => (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              <div className="aspect-square overflow-hidden bg-surface-2">
                {p.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.name} className="h-full w-full object-contain" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <strong>{p.name}</strong>
                {p.description && <p className="line-clamp-2 text-xs text-muted">{p.description}</p>}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <button type="button" onClick={() => open(p)} className="text-xs font-semibold text-accent-text">Editar</button>
                  <DeleteButton onDelete={() => t.remove(p.id)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!form && <NextStep href="/app/guiones" title="Crea tu guion" text="Tu marca está lista. Ahora, cada anuncio parte por el guion." />}
    </>
  );
}
