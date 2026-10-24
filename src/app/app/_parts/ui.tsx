"use client";

import { useCredits } from "./use-credits";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// Small building blocks shared by the platform pages.

/** A «Descargar» link: our own files come as a download (?descargar=1); anything else opens in a new tab. */
export const dl = (u: string) => (u.includes("/api/media/") ? `${u}${u.includes("?") ? "&" : "?"}descargar=1` : u);

export const inputCls = "min-w-0 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink";
export const btnCls = "rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50 sm:py-2";
export const ghostCls = "rounded-lg border border-line px-3 py-2.5 text-sm font-semibold text-muted hover:text-ink sm:py-2";
export const cardCls = "flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5";

export function PageHead({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex max-w-2xl flex-col gap-1">
        <h1 className="font-display text-[1.6rem] leading-tight font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {lead && <p className="text-[15px] leading-snug text-muted sm:text-base">{lead}</p>}
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

/** Shown when a section couldn't load. The owner gets the setup hint; customers a calm message. */
export function SetupNotice() {
  const { info } = useCredits();
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-warn/50 bg-warn/10 p-4 text-sm">
      <p className="font-semibold">No pudimos cargar esta sección.</p>
      <p className="text-muted">
        {info?.owner
          ? "Si es la primera vez, puede faltar crear las tablas en Supabase (SQL Editor → bloque «Platform tables» de schema.sql → Run). Si no, revisa la conexión y recarga."
          : "Revisa tu conexión y recarga la página. Si sigue igual, escríbenos a hola@creadsia.com."}
      </p>
      <button type="button" onClick={() => window.location.reload()} className="self-start font-semibold text-accent-text underline">Recargar</button>
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
    const res = await fetch(`/api/data/${table}`).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) {
      // any failure (not only a missing table): the page shows "couldn't load", never a false "empty"
      setMissing(true);
      setError(d.error || "No se pudo cargar. Revisa tu conexión.");
      setRows([]);
      return;
    }
    setError("");
    setMissing(false);
    setRows(d.rows);
  }, [table]);
  useEffect(() => { load(); }, [load]);

  async function add(data: Partial<T>) {
    const res = await fetch(`/api/data/${table}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }).catch(() => null);
    if (!res) throw new Error("No se pudo guardar. Revisa tu conexión e intenta de nuevo.");
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "No se pudo guardar.");
    setRows((r) => [d.row as T, ...(r ?? [])]);
    return d.row as T;
  }
  async function update(id: string, data: Partial<T>) {
    const res = await fetch(`/api/data/${table}/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }).catch(() => null);
    if (!res) throw new Error("No se pudo guardar. Revisa tu conexión e intenta de nuevo.");
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "No se pudo guardar.");
    setRows((r) => (r ?? []).map((x) => (x.id === id ? (d.row as T) : x)));
    return d.row as T;
  }
  async function remove(id: string) {
    const res = await fetch(`/api/data/${table}/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) throw new Error("No se pudo borrar.");
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
    if (!up.ok) throw new Error("No se pudo subir el archivo. Revisa tu conexión e intenta de nuevo.");
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

// The two paths a customer follows, always in the same order: set up the brand once, then make ads.
const FLOWS = {
  marca: { label: "Tu marca (se hace una vez)", steps: [["Voces", "/app/voces"], ["Avatares", "/app/avatares"], ["Productos (opcional)", "/app/productos"]] },
  anuncio: { label: "Haz tu anuncio", steps: [["Espiar anuncios (opcional)", "/app/spy"], ["Crear guion", "/app/guiones"], ["Grabar la voz", "/app/crear?paso=voz"], ["Escenas, video y edición", "/app/crear"]] },
} as const;

/** "Paso 2 de 3" strip at the top of a page, so the customer always knows where they are. */
export function Stepper({ flow, current }: { flow: keyof typeof FLOWS; current: number }) {
  const f = FLOWS[flow];
  return (
    <nav aria-label={f.label} className="scroll-row -mx-4 flex items-center gap-x-2 gap-y-1 overflow-x-auto px-4 text-xs whitespace-nowrap sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <span className="hidden font-semibold text-muted sm:inline">{f.label}:</span>
      {f.steps.map(([label, href], i) => (
        <span key={href} className="flex shrink-0 items-center gap-2">
          {i > 0 && <span aria-hidden="true" className="text-muted">→</span>}
          <Link href={href} aria-current={i === current ? "step" : undefined}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${i === current ? "bg-accent/12 text-accent-text" : "text-muted hover:text-ink"}`}>
            <span aria-hidden="true" className={`grid h-4 w-4 place-items-center rounded-full border text-[9px] ${i === current ? "border-current" : "border-line"}`}>{i + 1}</span>{label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

/** The next step, at the bottom of a page. */
export function NextStep({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link href={href} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line p-4 hover:border-accent-text/60">
      <span className="flex flex-col"><span className="text-xs font-semibold text-muted">Siguiente paso</span><b>{title}</b><span className="text-sm text-muted">{text}</span></span>
      <span aria-hidden="true" className="text-xl text-accent-text">→</span>
    </Link>
  );
}

// ---------- "working on it" ----------

/** A small spinning circle that shows something is happening. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** "42 s" / "1 min 05 s" */
export function fmtElapsed(s: number) {
  const n = Math.max(0, Math.floor(s));
  return n < 60 ? `${n} s` : `${Math.floor(n / 60)} min ${String(n % 60).padStart(2, "0")} s`;
}

/** Seconds since `since` (a date, ms, or when the component appeared), ticking every second. */
export function useElapsed(since?: string | number | null) {
  const [start] = useState(() => {
    const t = typeof since === "number" ? since : since ? Date.parse(since) : NaN;
    // a start in the future or unreadable: count from now
    return Number.isFinite(t) && t <= Date.now() ? t : Date.now();
  });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (now - start) / 1000;
}

/** Spinner + label + seconds so far, e.g. "Generando… 42 s". */
export function Working({ since, label = "Generando…", className = "" }: { since?: string | number | null; label?: string; className?: string }) {
  const s = useElapsed(since);
  return (
    <span role="status" className={`inline-flex items-center gap-2 ${className}`}>
      <Spinner />
      <span>{label} <span className="font-mono tabular-nums">{fmtElapsed(s)}</span></span>
    </span>
  );
}
