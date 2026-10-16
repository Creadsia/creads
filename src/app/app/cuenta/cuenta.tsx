"use client";

import { useState } from "react";
import { Field, PageHead, btnCls, cardCls, inputCls } from "../_parts/ui";

export default function Cuenta() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (next !== again) return setMsg({ ok: false, text: "Las dos claves nuevas no coinciden." });
    setBusy(true); setMsg(null);
    const res = await fetch("/api/auth/password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ current, next }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: d.error || "No se pudo cambiar la clave." });
    setCurrent(""); setNext(""); setAgain("");
    setMsg({ ok: true, text: "Clave cambiada. Se cerraron tus otras sesiones." });
  }

  return (
    <>
      <PageHead title="Mi cuenta" />
      <form onSubmit={save} className={`${cardCls} max-w-md`}>
        <h2 className="font-display text-lg font-bold">Cambiar clave</h2>
        <Field label="Clave actual"><input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} /></Field>
        <Field label="Clave nueva" hint="Mínimo 10 caracteres."><input type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} /></Field>
        <Field label="Repite la clave nueva"><input type="password" required autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} className={inputCls} /></Field>
        <button type="submit" disabled={busy} className={btnCls}>{busy ? "Guardando…" : "Cambiar clave"}</button>
        {msg && <p className={`text-sm ${msg.ok ? "text-good" : "text-bad"}`}>{msg.text}</p>}
      </form>
    </>
  );
}
