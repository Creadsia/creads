"use client";

import { useState } from "react";
import { FORMATS } from "@/lib/formats";
import { DeleteButton, Empty, Field, PageHead, type Row, SetupNotice, btnCls, cardCls, inputCls, useTable } from "../_parts/ui";

interface Rule extends Row { rule_en: string; rule_es: string | null; formats: string[] | null; hits: number; active: boolean }

export default function Aprendizajes() {
  const t = useTable<Rule>("rules");
  const [es, setEs] = useState("");
  const [en, setEn] = useState("");
  const [fmt, setFmt] = useState("all");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try { await t.add({ rule_es: es.trim(), rule_en: (en.trim() || es.trim()), formats: [fmt], hits: 0, active: true }); setEs(""); setEn(""); }
    catch (err) { setMsg(err instanceof Error ? err.message : "No se pudo guardar."); }
    finally { setBusy(false); }
  }

  return (
    <>
      <PageHead title="Aprendizajes" lead="Las reglas que Creads aprendió de errores anteriores. Se agregan solas a cada escena para que el mismo error no se repita." />
      {t.missing && <SetupNotice />}
      <form onSubmit={add} className={cardCls}>
        <h2 className="font-display text-lg font-bold">Agregar una regla a mano</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="La regla, en español"><input required value={es} onChange={(e) => setEs(e.target.value)} placeholder="Ej: que no muestre el celular en la mano en el reportaje" className={inputCls} /></Field>
          <Field label="En inglés (opcional)" hint="Es lo que lee el modelo de video. Si lo dejas vacío se usa el texto en español."><input value={en} onChange={(e) => setEn(e.target.value)} placeholder="Ex: never show a phone in the reporter's hand" className={inputCls} /></Field>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Vale para">
            <select value={fmt} onChange={(e) => setFmt(e.target.value)} className={inputCls}>
              <option value="all">Todos los formatos</option>
              {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <button type="submit" disabled={busy || !es.trim()} className={btnCls}>{busy ? "Guardando…" : "Agregar regla"}</button>
          {msg && <span className="text-sm text-bad">{msg}</span>}
        </div>
      </form>
      {t.rows === null ? <p className="text-muted">Cargando…</p> : t.rows.length === 0 && !t.missing ? (
        <Empty title="Todavía no hay aprendizajes" text="Cuando la revisión automática encuentre un error grave en un corte, la regla para evitarlo aparece aquí." />
      ) : (
        <ul className="flex flex-col gap-2">
          {t.rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-surface p-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold">{r.rule_es || r.rule_en}</span>
                {r.rule_es && r.rule_en !== r.rule_es && <span className="text-xs text-muted">{r.rule_en}</span>}
                <span className="text-xs text-muted">{(r.formats ?? ["all"]).map((f) => (f === "all" ? "Todos los formatos" : FORMATS.find((x) => x.id === f)?.name ?? f)).join(", ")} · usada {r.hits} {r.hits === 1 ? "vez" : "veces"}</span>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={r.active} onChange={(e) => t.update(r.id, { active: e.target.checked })} /> Activa
                </label>
                <DeleteButton onDelete={() => t.remove(r.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
