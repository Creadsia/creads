"use client";

import { useCallback, useEffect, useState } from "react";
import { btnCls, cardCls, ghostCls, inputCls, PageHead } from "../_parts/ui";

// «API para sistemas»: keys that let another system (your own tool, an agency's platform) use Creads with
// this account: same credits, limits and quality checks as the studio. Each key is shown once.

interface Key { id: string; name: string; created_at: string; expires_at: string }
const day = (iso: string) => new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

export default function ApiPage() {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<{ key: string; name: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mcpCopied, setMcpCopied] = useState(false);
  const site = typeof window === "undefined" ? "https://www.creadsia.com" : window.location.origin;

  const load = useCallback(() => {
    fetch("/api/api-keys").then((r) => r.json().then((d) => ({ ok: r.ok, d }))).then(({ ok, d }) => {
      if (!ok) throw new Error(d.error || "No se pudo cargar.");
      setKeys(d.claves);
    }).catch((e) => { setErr(e.message); setKeys([]); });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(""); setCopied(false);
    try {
      const r = await fetch("/api/api-keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nombre: name }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo crear.");
      setFresh({ key: d.clave, name: d.info.name }); setName(""); load();
    } catch (x) { setErr(x instanceof Error ? x.message : "No se pudo crear."); }
    setBusy(false);
  }
  async function revoke(k: Key) {
    if (!confirm(`¿Borrar la clave «${k.name}»? El sistema que la use deja de funcionar al tiro.`)) return;
    const r = await fetch(`/api/api-keys?id=${k.id}`, { method: "DELETE" });
    if (r.ok) load(); else setErr((await r.json().catch(() => ({}))).error || "No se pudo borrar.");
  }
  async function copy() {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh.key).catch(() => {});
    setCopied(true);
  }

  const curl1 = `curl -X POST ${site}/api/v1/anuncios \\
  -H "Authorization: Bearer creads_sk_TU_CLAVE" \\
  -H "Content-Type: application/json" \\
  -d '{"guion":"Mi perro tiene 9 años y la última urgencia me costó 480 mil. Por eso ahora tengo seguro.","formato":"ugc","idioma":"es-CL"}'`;
  const curl2 = `curl ${site}/api/v1/anuncios/ad_ID \\
  -H "Authorization: Bearer creads_sk_TU_CLAVE"`;

  return (
    <div className="flex flex-col gap-6">
      <PageHead title="API y conector" lead="Usa Creads desde Claude o ChatGPT, o conecta otro sistema (tu propia herramienta o la de una agencia) para pedir anuncios, imágenes y videos por código. Usa los segundos de esta cuenta y pasa por la misma revisión de calidad que el estudio." />

      <section className={cardCls} aria-labelledby="h-mcp">
        <h2 id="h-mcp" className="font-semibold">Conectar Creads a Claude o ChatGPT</h2>
        <p className="text-sm text-muted">Esta es la dirección del conector (MCP). Al conectarla, la app te manda a Creads para que entres y autorices; no tienes que copiar ninguna clave.</p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-sm">{site}/api/mcp</code>
          <button type="button" onClick={() => navigator.clipboard.writeText(`${site}/api/mcp`).then(() => setMcpCopied(true)).catch(() => {})} className={btnCls}>{mcpCopied ? "Copiada" : "Copiar"}</button>
        </div>
        <ul className="flex flex-col gap-2 text-sm text-muted">
          <li><b className="text-ink">Claude:</b> Configuración → Conectores → Agregar conector personalizado → pega la dirección → Conectar → entra con tu cuenta de Creads y aprieta Autorizar.</li>
          <li><b className="text-ink">ChatGPT:</b> Configuración → Aplicaciones y conectores → Crear (con el modo desarrollador activo) → pega la dirección → autoriza tu cuenta de Creads.</li>
          <li>Después pide en el chat: «Hazme un anuncio UGC de 20 segundos para…» o «Crea una imagen 4:5 de…». Cada conexión aparece abajo en «Tus claves» como «Claude (conector)» o «ChatGPT (conector)»; bórrala para desconectarla.</li>
        </ul>
      </section>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}

      {fresh && (
        <section className={`${cardCls} border-accent/50`} aria-labelledby="h-nueva">
          <h2 id="h-nueva" className="font-semibold">Tu clave «{fresh.name}»</h2>
          <p className="text-sm text-muted">Cópiala ahora y guárdala en el sistema que la va a usar: <b className="text-ink">no la vas a volver a ver</b>. No la pegues en chats ni correos.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-sm">{fresh.key}</code>
            <button type="button" onClick={copy} className={btnCls}>{copied ? "Copiada" : "Copiar"}</button>
          </div>
          <button type="button" onClick={() => setFresh(null)} className="self-start text-sm text-muted underline">Ya la guardé</button>
        </section>
      )}

      <section className={cardCls} aria-labelledby="h-claves">
        <h2 id="h-claves" className="font-semibold">Tus claves</h2>
        <form onSubmit={create} className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            <span className="font-semibold text-muted">Nombre (para saber dónde la usas)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Halcón" className={inputCls} />
          </label>
          <button type="submit" disabled={busy || name.trim().length < 2} className={btnCls}>{busy ? "Creando…" : "Crear clave"}</button>
        </form>
        {keys === null ? <p className="text-sm text-muted">Cargando…</p> : keys.length === 0 ? <p className="text-sm text-muted">Todavía no tienes claves.</p> : (
          <ul className="flex flex-col divide-y divide-line">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span className="flex flex-col"><b className="text-sm">{k.name}</b><span className="text-xs text-muted">Creada el {day(k.created_at)} · vence el {day(k.expires_at)}</span></span>
                <button type="button" onClick={() => revoke(k)} className={ghostCls}>Borrar</button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">Si cambias tu contraseña, todas las claves se borran por seguridad.</p>
      </section>

      <section className={cardCls} aria-labelledby="h-uso">
        <h2 id="h-uso" className="font-semibold">Cómo se usa</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Pide un anuncio con el guion. Responde al tiro con su número (<code className="font-mono">ad_…</code>).</li>
          <li>Pregunta por ese número cada 15 a 30 segundos: cada consulta lo avanza y te dice en qué va.</li>
          <li>Cuando diga <code className="font-mono">listo</code>, viene el enlace del video (se abre con la misma clave).</li>
        </ol>
        <pre className="overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed">{curl1}</pre>
        <pre className="overflow-x-auto rounded-lg border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed">{curl2}</pre>
        <p className="text-sm text-muted">Formatos: ugc, entrevista, podcast, noticiero, ronda, comentario. Idioma: <code className="font-mono">es-CL</code> o <code className="font-mono">en</code>. Opcional: <code className="font-mono">modelo</code>, <code className="font-mono">titulo</code>. Las herramientas (imágenes, mi personaje en un video, editar video) también responden con la clave en <code className="font-mono">/api/tools/…</code>.</p>
      </section>
    </div>
  );
}
