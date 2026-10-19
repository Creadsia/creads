"use client";

import { useEffect, useState } from "react";

// «Avatares de Creads»: ready-made presenters (invented people). One tap copies it into the account and
// selects it, so a first ad needs no setup at all.

export interface CreadsAvatar { id: string; name: string; que: string; lang: string; img: string }

export function useCreadsAvatars() {
  const [list, setList] = useState<CreadsAvatar[] | null>(null);
  useEffect(() => { fetch("/api/avatares-creads").then((r) => (r.ok ? r.json() : { avatares: [] })).then((d) => setList(d.avatares ?? [])).catch(() => setList([])); }, []);
  return list;
}

/** Copies a Creads avatar into the account (once) and returns the avatar's row id. */
export async function adoptCreadsAvatar(id: string): Promise<string> {
  const r = await fetch("/api/avatares-creads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
  const d = r ? await r.json().catch(() => ({})) : {};
  if (!r?.ok || !d.row?.id) throw new Error(d.error || "No pudimos agregar ese avatar. Intenta de nuevo.");
  return d.row.id as string;
}

export default function CreadsAvatars({ onPick, compact = false, taken = [] }: { onPick: (rowId: string) => void; compact?: boolean; taken?: string[] }) {
  const list = useCreadsAvatars();
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  if (!list?.length) return null;
  async function pick(a: CreadsAvatar) {
    setBusy(a.id); setErr("");
    try { onPick(await adoptCreadsAvatar(a.id)); } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo."); }
    setBusy("");
  }
  const shown = list.filter((a) => !taken.includes(a.name));
  if (!shown.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {err && <p role="alert" className="text-xs text-bad">{err}</p>}
      <ul className={compact ? "flex flex-wrap gap-2" : "grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3"}>
        {shown.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => pick(a)} disabled={Boolean(busy)} title={a.que}
              className={compact
                ? "flex items-center gap-2 rounded-xl border border-line p-1.5 pr-3 text-sm hover:border-accent disabled:opacity-60"
                : "flex w-full flex-col overflow-hidden rounded-xl border border-line text-left hover:border-accent disabled:opacity-60"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.img} alt="" loading="lazy" className={compact ? "h-9 w-9 rounded-lg object-cover object-[50%_20%]" : "aspect-[4/5] w-full object-cover object-[50%_20%]"} />
              {compact ? (
                <span className="font-semibold">{busy === a.id ? "Agregando…" : a.name}</span>
              ) : (
                <span className="flex flex-col gap-0.5 p-2.5">
                  <b className="text-sm">{busy === a.id ? "Agregando…" : a.name}</b>
                  <span className="text-xs leading-snug text-muted">{a.que}</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
