"use client";

import { useCallback, useEffect, useState } from "react";

// Small building blocks shared by the platform pages.

export const inputCls = "min-w-0 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink";
export const btnCls = "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50";
export const ghostCls = "rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted hover:text-ink";
export const cardCls = "flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5";

export function PageHead({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex max-w-2xl flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
        {lead && <p className="text-muted">{lead}</p>}
      </div>
      {children}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold text-muted">
      {label}
      {children}
      {hint && <span className="text-xs font-normal">{hint}</span>}
    </label>
  );
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {text && <p className="max-w-md text-sm text-muted">{text}</p>}
      {children}
    </div>
  );
}

/** Shown when the platform tables don't exist yet in Supabase. */
export function SetupNotice() {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-warn/50 bg-warn/10 p-4 text-sm">
      <p className="font-semibold">Falta un paso: crear las tablas de la plataforma en Supabase.</p>
      <p className="text-muted">Abre Supabase → SQL Editor, pega el bloque «Platform tables» del archivo schema.sql que te mandé y aprieta Run. Después recarga esta página.</p>
    </div>
  );
}

export type Row = Record<string, unknown> & { id: string; created_at: string };

/** Loads one platform table and gives add / update / remove helpers that keep the list in sync. */
export function useTable<T extends Row>(table: string) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/data/${table}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMissing(Boolean(d.missingTable));
      setError(d.error || "No se pudo cargar.");
      setRows([]);
      return;
    }
    setError("");
    setMissing(false);
    setRows(d.rows);
  }, [table]);
  useEffect(() => { load(); }, [load]);

  async function add(data: Partial<T>) {
    const res = await fetch(`/api/data/${table}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "No se pudo guardar.");
    setRows((r) => [d.row as T, ...(r ?? [])]);
    return d.row as T;
  }
  async function update(id: string, data: Partial<T>) {
    const res = await fetch(`/api/data/${table}/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "No se pudo guardar.");
    setRows((r) => (r ?? []).map((x) => (x.id === id ? (d.row as T) : x)));
    return d.row as T;
  }
  async function remove(id: string) {
    const res = await fetch(`/api/data/${table}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("No se pudo borrar.");
    setRows((r) => (r ?? []).filter((x) => x.id !== id));
  }

  return { rows, error, missing, reload: load, add, update, remove };
}

/** Uploads a file to our storage and returns its public link. Big files (videos) go straight to storage. */
export async function uploadFile(file: File): Promise<string> {
  if (file.size > 3.5 * 1024 * 1024) {
    const res = await fetch("/api/upload/sign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: file.type, size: file.size }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "No se pudo preparar la subida.");
    const fd = new FormData();
    fd.append("cacheControl", "3600");
    fd.append("", file);
    const up = await fetch(d.uploadUrl, { method: "PUT", body: fd, headers: { "x-upsert": "false" } });
    if (!up.ok) throw new Error(`No se pudo subir el archivo (${up.status}).`);
    return d.publicUrl as string;
  }
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "No se pudo subir el archivo.");
  return d.url as string;
}

/** A delete button that asks once more before acting. */
export function DeleteButton({ onDelete, label = "Borrar" }: { onDelete: () => void; label?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return (
    <button type="button" onClick={() => (armed ? onDelete() : setArmed(true))} className={`text-xs ${armed ? "font-semibold text-bad" : "text-muted hover:text-bad"}`}>
      {armed ? "¿Seguro?" : label}
    </button>
  );
}
