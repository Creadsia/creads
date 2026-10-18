"use client";

import { useCallback, useEffect, useState } from "react";
import { DeleteButton, Field, PageHead, btnCls, cardCls, inputCls } from "../_parts/ui";

interface U { id: string; email: string; name: string | null; role: "owner" | "admin" | "member"; active: boolean; created_at: string; last_login: string | null }
const ROLE = { owner: "Dueño", admin: "Completo + Panel interno", member: "Estudio completo" } as const;

export default function Equipo() {
  const [users, setUsers] = useState<U[] | null>(null);
  const [me, setMe] = useState("");
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/team");
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(d.error || "No se pudo cargar el equipo."); setUsers([]); return; }
    setUsers(d.users); setMe(d.me);
  }, []);
  useEffect(() => { load(); }, [load]);
  const meUser = users?.find((u) => u.id === me);
  const isOwner = meUser?.role === "owner";

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const res = await fetch("/api/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, name, role }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setErr(d.error || "No se pudo crear la cuenta.");
    setSecret({ email: d.user.email, password: d.password });
    setEmail(""); setName(""); load();
  }

  async function patch(id: string, body: object) {
    setErr("");
    const res = await fetch(`/api/team/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(d.error || "No se pudo guardar.");
    if (d.password) setSecret({ email: d.user.email, password: d.password });
    load();
  }
  async function remove(id: string) {
    const res = await fetch(`/api/team/${id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(d.error || "No se pudo borrar.");
    load();
  }

  return (
    <>
      <PageHead title="Equipo" lead="Personas que trabajan contigo en TU cuenta: ven tus avatares, tus anuncios y usan tus créditos. «Estudio completo» usa todo el estudio; «Completo + Panel interno» además entra al Panel (con verificación en dos pasos). Solo tú, el dueño, puedes quitarle el acceso a alguien con Panel interno." />
      <p className="rounded-xl border border-warn/50 bg-warn/10 px-4 py-3 text-sm">
        <b>¿Es un cliente o un lead?</b> No lo agregues aquí: créalo en <a href="/admin" className="font-semibold underline">Panel interno → Clientes</a> o mándale el link <b>creadsia.com/empezar</b>. Así tiene su propia cuenta, vacía, con sus propios créditos. Si ya agregaste a alguien por error, usa «Pasar a cuenta de cliente».
      </p>

      <form onSubmit={invite} className={cardCls}>
        <h2 className="font-display text-lg font-bold">Dar acceso a alguien</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_1fr_200px]">
          <Field label="Correo"><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></Field>
          <Field label="Nombre (opcional)"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></Field>
          <Field label="Rol">
            <select value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")} className={inputCls}>
              <option value="member">Estudio completo (sin Panel interno)</option>
              {isOwner && <option value="admin">Completo + Panel interno (socio): igual que tú</option>}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !email} className={btnCls}>{busy ? "Creando…" : "Crear cuenta"}</button>
          <span className="text-xs text-muted">Se crea con una clave temporal que le pasas a esa persona. Puede cambiarla en «Mi cuenta».</span>
        </div>
      </form>

      {secret && (
        <div className="flex flex-col gap-2 rounded-2xl border border-good/50 bg-good/10 p-4 text-sm">
          <p className="font-semibold">Clave temporal para {secret.email}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg bg-surface px-3 py-2 font-mono text-base">{secret.password}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(`Entra a https://www.creadsia.com/app con ${secret.email} y la clave ${secret.password}`).catch(() => {})} className="rounded-lg border border-line px-3 py-2 text-sm">Copiar mensaje</button>
          </div>
          <p className="text-muted">Se muestra solo esta vez. Mándasela por WhatsApp o correo; al entrar puede cambiarla.</p>
          <button type="button" onClick={() => setSecret(null)} className="self-start text-xs text-muted underline">Ya la copié</button>
        </div>
      )}
      {err && <p className="text-sm text-bad">{err}</p>}

      <section className={cardCls}>
        <h2 className="font-display text-lg font-bold">Cuentas</h2>
        {!users ? <p className="text-muted">Cargando…</p> : (
          <ul className="flex flex-col divide-y divide-line">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="font-semibold">{u.name || u.email}{u.id === me ? " (tú)" : ""}</span>
                  <span className="text-xs text-muted">{u.email} · {u.last_login ? `última entrada ${new Date(u.last_login).toLocaleDateString("es-CL")}` : "todavía no entra"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {u.role === "owner" || !isOwner ? (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold">{ROLE[u.role]}</span>
                  ) : (
                    <select aria-label={`Rol de ${u.email}`} value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })} className={inputCls}>
                      <option value="member">Estudio completo</option>
                      <option value="admin">Completo + Panel interno</option>
                    </select>
                  )}
                  {u.role !== "owner" && u.id !== me && (isOwner || u.role === "member") && (
                    <>
                      <label className="flex items-center gap-1.5 text-xs text-muted">
                        <input type="checkbox" checked={u.active} onChange={(e) => patch(u.id, { active: e.target.checked })} /> Puede entrar
                      </label>
                      <button type="button" onClick={() => patch(u.id, { resetPassword: true })} className="text-xs font-semibold text-accent-text">Nueva clave</button>
                      {isOwner && (
                        <button type="button" onClick={() => { if (window.confirm(`¿Pasar a ${u.email} a su propia cuenta de cliente? Dejará de ver tus avatares y anuncios, y no usará tus créditos. Sigue entrando con la misma clave.`)) patch(u.id, { toClient: true }); }}
                          className="rounded-lg border border-warn/60 px-2.5 py-1 text-xs font-semibold text-warn">Pasar a cuenta de cliente</button>
                      )}
                      <DeleteButton onDelete={() => remove(u.id)} />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
