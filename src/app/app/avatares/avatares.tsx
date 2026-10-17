"use client";

import { useEffect, useState } from "react";
import { DeleteButton, Empty, Field, NextStep, PageHead, type Row, SetupNotice, Stepper, btnCls, cardCls, ghostCls, inputCls, uploadFile, useTable } from "../_parts/ui";

interface Avatar extends Row {
  name: string;
  description: string | null;
  image_url: string | null;
  voice_id: string | null;
  voice_name: string | null;
  lang: string | null;
  consent: boolean;
}
interface Voice { id: string; name: string; category: string }

const blank = { name: "", description: "", image_url: "", voice_id: "", voice_name: "", lang: "en", consent: false };

export default function Avatares() {
  const t = useTable<Avatar>("avatars");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [form, setForm] = useState<typeof blank | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/voices").then((r) => r.json()).then((d) => setVoices(d.voices ?? [])).catch(() => {});
  }, []);

  function open(a?: Avatar) {
    setMsg("");
    setEditing(a?.id ?? null);
    setForm(a ? { name: a.name, description: a.description ?? "", image_url: a.image_url ?? "", voice_id: a.voice_id ?? "", voice_name: a.voice_name ?? "", lang: a.lang ?? "en", consent: a.consent } : { ...blank });
  }

  async function onPhoto(file: File | undefined) {
    if (!file || !form) return;
    setBusy(true); setMsg("Subiendo foto…");
    try { const url = await uploadFile(file); setForm({ ...form, image_url: url }); setMsg(""); }
    catch (e) { setMsg(e instanceof Error ? e.message : "No se pudo subir."); }
    finally { setBusy(false); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true); setMsg("");
    try {
      const v = voices.find((x) => x.id === form.voice_id);
      const data = { ...form, voice_name: v?.name ?? form.voice_name };
      if (editing) await t.update(editing, data); else await t.add(data);
      setForm(null); setEditing(null);
    } catch (err) { setMsg(err instanceof Error ? err.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }

  const own = voices.filter((v) => v.category === "cloned");
  const lib = voices.filter((v) => v.category !== "cloned");

  return (
    <>
      <Stepper flow="marca" current={1} />
      <PageHead title="Avatares" lead="Tus presentadores fijos: la cara y la voz de quien habla. Los cargas una vez y sirven para todos tus anuncios.">
        {!form && <button type="button" data-tour="avatar-nuevo" onClick={() => open()} className={btnCls}>+ Nuevo avatar</button>}
      </PageHead>
      {t.missing && <SetupNotice />}
      {voices.length > 0 && own.length === 0 && (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm">¿Quieres que el avatar hable con <b>tu voz</b>? Créala primero en <a href="/app/voces" className="font-semibold text-accent-text underline">Voces</a> (paso 1). Si no, puedes elegir una voz de la biblioteca al crear el avatar.</p>
      )}

      {form && (
        <form onSubmit={save} className={cardCls}>
          <h2 className="font-display text-lg font-bold">{editing ? "Editar avatar" : "Nuevo avatar"}</h2>
          <div className="grid gap-4 md:grid-cols-[200px_1fr]">
            <div className="flex flex-col gap-2" data-tour="avatar-foto">
              <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-xl border border-dashed border-line bg-surface-2">
                {form.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.image_url} alt="Cara del avatar" className="h-full w-full object-cover object-[50%_20%]" />
                ) : (
                  <span className="px-4 text-center text-xs text-muted">Foto de frente, buena luz, sin lentes de sol</span>
                )}
              </div>
              <label className={`${ghostCls} cursor-pointer text-center`}>
                {form.image_url ? "Cambiar foto" : "Subir foto"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onPhoto(e.target.files?.[0])} />
              </label>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold">Cara</h3>
              <Field label="Nombre"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Papá (Chile)" className={inputCls} /></Field>
              <div data-tour="avatar-como"><Field label="Cómo es" hint="Mejor en inglés. Se usa en cada escena para que siempre sea la misma persona.">
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ej: 62-year-old Chilean man, short gray hair, light stubble, navy polo shirt" className={inputCls} />
              </Field></div>
              <div className="mt-2 flex flex-col gap-1 border-t border-line pt-4">
                <h3 className="text-sm font-bold">Voz</h3>
                <p className="text-xs text-muted">La voz es aparte de la cara: puedes dejar la del modelo de video o usar una voz clonada de <a href="/app/voces" className="underline">Voces</a>.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2" data-tour="avatar-voz">
                <Field label="Voz que usa">
                  <select value={form.voice_id} onChange={(e) => setForm({ ...form, voice_id: e.target.value })} className={inputCls}>
                    <option value="">La voz del modelo de video</option>
                    {own.length > 0 && <optgroup label="Tus voces">{own.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</optgroup>}
                    {lib.length > 0 && <optgroup label="Biblioteca">{lib.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</optgroup>}
                  </select>
                </Field>
                <Field label="Idioma en que habla">
                  <select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })} className={inputCls}>
                    <option value="en">Inglés (EE. UU.)</option>
                    <option value="es-CL">Español (Chile)</option>
                    <option value="es">Español (neutro)</option>
                  </select>
                </Field>
              </div>
              <label className="flex items-start gap-2 text-sm" data-tour="avatar-permiso">
                <input type="checkbox" checked={form.consent} onChange={(e) => setForm({ ...form, consent: e.target.checked })} className="mt-1" required />
                <span>Tengo el permiso de esta persona para usar su cara y su voz en anuncios.</span>
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy || !form.name.trim() || !form.consent} className={btnCls}>{busy ? "Guardando…" : "Guardar avatar"}</button>
            <button type="button" onClick={() => setForm(null)} className={ghostCls}>Cancelar</button>
            {msg && <span className="text-sm text-bad">{msg}</span>}
          </div>
        </form>
      )}

      {t.rows === null ? (
        <p className="text-muted">Cargando…</p>
      ) : t.rows.length === 0 && !t.missing ? (
        !form && <Empty title="Todavía no tienes avatares" text="Un avatar es la persona que habla en tus anuncios: una foto de su cara y su voz."><button type="button" onClick={() => open()} className={btnCls}>Crear el primero</button></Empty>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
          {t.rows.map((a) => (
            <li key={a.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              {/* overflow-hidden keeps tall photos (full body) from stretching the card; the crop favors the face */}
              <div className="aspect-[4/5] overflow-hidden bg-surface-2">
                {a.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.image_url} alt={a.name} className="h-full w-full object-cover object-[50%_20%]" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <strong>{a.name}</strong>
                <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                  <dt className="font-semibold text-muted">Cara</dt>
                  <dd className={a.image_url ? "" : "text-warn"}>{a.image_url ? "Con foto" : "Falta la foto"}</dd>
                  <dt className="font-semibold text-muted">Voz</dt>
                  <dd>{a.voice_name || "La del modelo de video"} · {a.lang === "es-CL" ? "Español (Chile)" : a.lang === "es" ? "Español" : "Inglés"}</dd>
                </dl>
                {a.description && <p className="line-clamp-2 text-xs text-muted">{a.description}</p>}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <button type="button" onClick={() => open(a)} className="text-xs font-semibold text-accent-text">Editar</button>
                  <DeleteButton onDelete={() => t.remove(a.id)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(t.rows?.length ?? 0) > 0 && !form && <NextStep href="/app/productos" title="Agrega tu producto (opcional)" text="Si vendes algo físico, súbelo para que aparezca en los videos. Si no, ve directo a crear tu guion." />}
    </>
  );
}
