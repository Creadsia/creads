import { SITE } from "./emails";
import { claude } from "./providers/claude";
import { sendEmail } from "./providers/email";
import { sbRest } from "./supabase";
import { bibleText, type Traits } from "./influencer/traits";
import { addPedido, campaigns, commitMarketing, loadMarketing, once, publishReel, setCampaignStatus, type Cuenta, type MarketingState, type Publicacion } from "./marketing";

// The organic autopilot of the brand's own Instagram accounts (Panel → Marketing; internal, never for
// customers). Each account can have a character (a Creads avatar) and an angle. Every round (the Guardián's
// 5-minute ping) it:
//   1. keeps about 3 days of reels planned per account (Claude writes the script and the caption);
//   2. sends approved reels to the automatic producer, with the account's character on camera;
//   3. schedules finished reels in the account's next free hour (Chile time);
//   4. publishes what is due (in «modo ensayo» while Meta isn't connected).
// With «revisar» on, nothing is produced until someone approves it in the panel (the default).
// Also here: the daily rule that pauses paid campaigns that spend badly (it only ever lowers spending).

export interface Piloto { on: boolean; porDia: number; horas: number[]; revisar: boolean; planAt?: string }
export const DEFAULT_PILOTO: Piloto = { on: false, porDia: 1, horas: [12, 19], revisar: true };
export type Rol = "profesor" | "personaje" | "marca";
export type ReelEstado = "propuesta" | "aprobada" | "produciendo" | "programada" | "publicada" | "descartada" | "error";
export interface Reel {
  id: string; cuentaId: string; at: string; updatedAt: string; titulo: string; guion: string; caption: string; estado: ReelEstado;
  pedidoId?: string; adId?: string; videoUrl?: string; publicarEn?: string; mediaId?: string; ensayo?: boolean; error?: string;
}
export interface PausaAuto { on: boolean; cpaMax: number; gastoSinResultado: number }
export const DEFAULT_PAUSA: PausaAuto = { on: true, cpaMax: 25, gastoSinResultado: 30 };

const ACTIVE: ReelEstado[] = ["propuesta", "aprobada", "produciendo", "programada"];
const uid = () => `reel-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const nowIso = () => new Date().toISOString();
export const pilotoOf = (c: Cuenta): Piloto => ({ ...DEFAULT_PILOTO, ...(c.piloto ?? {}) });

// ---------------------------------------------------------------- Chile time

const TZ = "America/Santiago";
/** Minutes to add to UTC to get Chile time at that moment (−180 or −240). */
export function chileOffset(d: Date) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" }).formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT-3";
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return -180;
  const v = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -v : v;
}
export const chileDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** The next free publishing hour for an account: its hours in Chile time, at most `porDia` a day, 15+ min ahead. */
export function nextSlot(now: Date, horas: number[], porDia: number, taken: string[]): string | null {
  const hours = [...new Set(horas.filter((h) => h >= 0 && h <= 23))].sort((a, b) => a - b);
  if (!hours.length || porDia < 1) return null;
  const takenAt = taken.map((t) => new Date(t));
  for (let off = 0; off < 14; off++) {
    const day = chileDay(new Date(now.getTime() + off * 864e5));
    const sameDay = takenAt.filter((t) => chileDay(t) === day).length;
    if (sameDay >= porDia) continue;
    const [y, mo, d] = day.split("-").map(Number);
    for (const h of hours) {
      const guess = Date.UTC(y, mo - 1, d, h);
      const at = guess - chileOffset(new Date(guess)) * 60_000;
      if (at < now.getTime() + 15 * 60_000) continue;
      if (takenAt.some((t) => Math.abs(t.getTime() - at) < 50 * 60_000)) continue;
      return new Date(at).toISOString();
    }
  }
  return null;
}

// ---------------------------------------------------------------- planning (Claude writes the reels)

async function characterOf(avatarId?: string) {
  if (!avatarId || !/^[0-9a-f-]{36}$/i.test(avatarId)) return "";
  const r = await sbRest<{ name: string; description: string | null; notes: string | null }[]>(`avatars?id=eq.${avatarId}&owner=eq.main&select=name,description,notes&limit=1`).catch(() => []);
  if (!r[0]) return "";
  let biblia = "";
  try { const n = JSON.parse(r[0].notes ?? "{}") as { kind?: string; traits?: Traits }; if (n.kind === "personaje") biblia = bibleText(n.traits?.bible); } catch { /* an avatar made by hand */ }
  return [r[0].name, r[0].description, biblia].filter(Boolean).join(". ").slice(0, 900);
}

const ROL_GUIDE: Record<Rol, string> = {
  profesor: "Es un PROFESOR de anuncios con IA. Cada reel enseña UNA cosa útil y concreta (un truco, un error común, una novedad de IA, un antes y después) y cierra invitando a la masterclass gratis: «link en el perfil». Tono cercano, seguro y con estilo; nada de promesas de ingresos.",
  personaje: "Es un PERSONAJE de entretenimiento (estilo humor, situaciones raras, tendencias). NO vende ni explica nada: solo entretiene y engancha. Sin llamados a comprar; a lo más el caption termina con «Hecho con Creads IA».",
  marca: "Es la cuenta de la MARCA Creads IA: muestra lo que se puede crear con la plataforma (demos, antes y después, novedades), con un llamado suave a probar Creads en creadsia.com.",
};

export function planPrompt(c: Cuenta, personaje: string, recientes: string[], n: number) {
  const rol: Rol = c.rol ?? "marca";
  return `Escribe ${n} reels para la cuenta de Instagram «${c.nombre}».
${ROL_GUIDE[rol]}
${c.angulo ? `Ángulo de la cuenta: ${c.angulo}` : ""}
${personaje ? `Quién habla a cámara (personaje creado con IA, original): ${personaje}` : "Habla a cámara una persona creada con IA."}
${recientes.length ? `Ya se publicaron o están en cola (no repitas temas):\n${recientes.map((t) => `- ${t}`).join("\n")}` : ""}

Reglas:
- Español de Chile natural (sin exagerar modismos), en segunda persona.
- Cada guion es lo que dice la persona, palabra por palabra: 15 a 30 segundos (45 a 80 palabras). Los primeros 2 segundos son el hook.
- Nada de personas reales ni famosos, marcas ajenas, promesas de ingresos o resultados garantizados, ni datos inventados.
- Caption de máximo 300 caracteres con 3 a 5 hashtags.${rol === "profesor" ? " Menciona la masterclass gratis en creadsia.com/curso." : ""}

Responde SOLO JSON: {"reels":[{"titulo":"…","guion":"…","caption":"…"}]}`;
}

export function parseReels(text: string): { titulo: string; guion: string; caption: string }[] {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const o = JSON.parse(m[0]) as { reels?: unknown[] };
    return (o.reels ?? []).flatMap((x) => {
      const r = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      const titulo = String(r.titulo ?? "").trim().slice(0, 100), guion = String(r.guion ?? "").trim().slice(0, 1200), caption = String(r.caption ?? "").trim().slice(0, 2200);
      return titulo.length >= 3 && guion.split(/\s+/).length >= 15 && caption.length >= 5 ? [{ titulo, guion, caption }] : [];
    }).slice(0, 9);
  } catch { return []; }
}

async function plan(c: Cuenta, m: MarketingState, n: number): Promise<Reel[]> {
  const recientes = (m.reels ?? []).filter((r) => r.cuentaId === c.id && r.estado !== "descartada").slice(0, 20).map((r) => r.titulo);
  const text = await claude.complete({ system: "Eres el guionista de contenido orgánico de Creads IA. Escribes reels cortos, útiles y con gancho. Respondes solo JSON.", prompt: planPrompt(c, await characterOf(c.avatarId), recientes, n), json: true, maxTokens: 3000 });
  const p = pilotoOf(c);
  return parseReels(text).slice(0, n).map((r) => ({ ...r, id: uid(), cuentaId: c.id, at: nowIso(), updatedAt: nowIso(), estado: p.revisar ? "propuesta" : "aprobada" }));
}

// ---------------------------------------------------------------- the round

const patchReel = (id: string, patch: Partial<Reel>) => commitMarketing((s) => {
  const r = (s.reels ?? []).find((x) => x.id === id);
  if (r) Object.assign(r, patch, { updatedAt: nowIso() });
});

async function notifyApprovals(n: number) {
  if (!n || !(await once("piloto:aviso", 3 * 3600))) return;
  const owners = await sbRest<{ email: string }[]>("users?workspace=eq.main&role=eq.owner&active=eq.true&select=email&limit=1").catch(() => []);
  if (!owners[0]?.email) return;
  const link = "https://www.creadsia.com/admin";
  await sendEmail({
    to: owners[0].email, tag: "piloto-aprobar",
    subject: `${n} reel${n === 1 ? "" : "s"} esperando tu aprobación`,
    text: `El piloto orgánico preparó ${n} reel${n === 1 ? "" : "s"} nuevo${n === 1 ? "" : "s"}. Apruébalos en Panel → Marketing: ${link}`,
    html: `<p>El piloto orgánico preparó <b>${n} reel${n === 1 ? "" : "s"}</b> nuevo${n === 1 ? "" : "s"}.</p><p><a href="${link}">Aprobar en Panel → Marketing</a></p>`,
  });
}

/** One round of the organic autopilot. Returns what it did (for logs and tests). */
export async function avanzarPiloto(now = new Date()) {
  const done = { planeados: 0, producir: 0, programados: 0, publicados: 0 };
  if (!(await once("piloto:tick", 240))) return done;
  let m = await loadMarketing();
  const cuentas = m.cuentas.filter((c) => pilotoOf(c).on);
  if (!cuentas.length && !(m.reels ?? []).some((r) => ACTIVE.includes(r.estado))) return done;

  // 1. plan: about 3 days of reels per account, at most once every 20 hours
  let nuevasPropuestas = 0;
  for (const c of cuentas) {
    const p = pilotoOf(c);
    const cola = (m.reels ?? []).filter((r) => r.cuentaId === c.id && ACTIVE.includes(r.estado)).length;
    const falta = Math.min(6, p.porDia * 3 - cola);
    const recent = p.planAt && now.getTime() - Date.parse(p.planAt) < 20 * 3600_000;
    if (falta <= 0 || recent) continue;
    const reels = await plan(c, m, falta).catch((e) => { console.error("piloto plan", c.nombre, e instanceof Error ? e.message : e); return [] as Reel[]; });
    m = await commitMarketing((s) => {
      s.reels = [...reels, ...(s.reels ?? [])].slice(0, 200);
      const cc = s.cuentas.find((x) => x.id === c.id);
      if (cc) cc.piloto = { ...pilotoOf(cc), planAt: now.toISOString() };
    });
    done.planeados += reels.length;
    nuevasPropuestas += reels.filter((r) => r.estado === "propuesta").length;
  }
  await notifyApprovals(nuevasPropuestas).catch(() => {});

  // 2. approved → the automatic producer, with the account's character
  const { enqueue, kickProduction } = await import("./autoprod");
  for (const r of (m.reels ?? []).filter((x) => x.estado === "aprobada")) {
    const c = m.cuentas.find((x) => x.id === r.cuentaId);
    if (!c) { await patchReel(r.id, { estado: "error", error: "La cuenta ya no existe." }); continue; }
    const ped = await addPedido({ titulo: `${c.nombre}: ${r.titulo}`.slice(0, 100), formato: "ugc", idioma: "es-CL", guion: r.guion, idea: `Reel orgánico de ${c.nombre}`, ...(c.avatarId ? { avatarId: c.avatarId } : {}) });
    if (await enqueue(ped)) { await patchReel(r.id, { estado: "produciendo", pedidoId: ped.id, error: undefined }); done.producir++; }
    else await patchReel(r.id, { pedidoId: ped.id, error: "La producción automática está apagada (Marketing → Producción automática)." });
  }
  if (done.producir) await kickProduction();

  // 3. finished → the account's next free hour
  m = await loadMarketing();
  for (const r of (m.reels ?? []).filter((x) => x.estado === "produciendo" && x.pedidoId)) {
    const job = (m.produccion ?? []).find((j) => j.pedidoId === r.pedidoId);
    if (!job) continue;
    if (job.estado === "error") { await patchReel(r.id, { estado: "error", error: job.error ?? "La producción falló." }); continue; }
    if (job.estado !== "listo" || !job.adId) continue;
    const c = m.cuentas.find((x) => x.id === r.cuentaId);
    if (!c) continue;
    const p = pilotoOf(c);
    const taken = (m.reels ?? []).filter((x) => x.cuentaId === c.id && (x.estado === "programada" || x.estado === "publicada") && x.publicarEn).map((x) => x.publicarEn!);
    const slot = nextSlot(now, p.horas, p.porDia, taken);
    if (!slot) continue;
    await patchReel(r.id, { estado: "programada", adId: job.adId, videoUrl: job.videoUrl, publicarEn: slot });
    m = await loadMarketing();
    done.programados++;
  }

  // 4. publish what is due (one per account per round)
  m = await loadMarketing();
  const due = (m.reels ?? []).filter((x) => x.estado === "programada" && x.publicarEn && Date.parse(x.publicarEn) <= now.getTime());
  const seen = new Set<string>();
  for (const r of due) {
    if (seen.has(r.cuentaId)) continue;
    seen.add(r.cuentaId);
    const c = m.cuentas.find((x) => x.id === r.cuentaId);
    if (!c || !r.adId) continue;
    if (!(await once(`piloto:pub:${r.id}`, 3600))) continue; // never twice
    try {
      const mediaId = await publishReel(c, r.adId, r.caption);
      await patchReel(r.id, { estado: "publicada", mediaId: mediaId ?? undefined, ensayo: mediaId === null, error: undefined });
      const pub: Publicacion = { id: `pub-${r.id}`, at: nowIso(), cuenta: c.nombre, adId: r.adId, texto: r.caption, estado: mediaId ? "publicada" : "ensayo", destino: "instagram", mediaId: mediaId ?? undefined };
      await commitMarketing((s) => { s.publicaciones = [pub, ...s.publicaciones].slice(0, 100); });
      done.publicados++;
    } catch (e) {
      await patchReel(r.id, { estado: "error", error: e instanceof Error ? e.message : "No se pudo publicar." });
    }
  }
  return done;
}

/** Approve / discard from the panel. «aprobar-todo» approves every proposal of one account. */
export async function decidirReel(id: string, accion: "aprobar" | "descartar" | "editar", cambios?: { guion?: string; caption?: string }) {
  await commitMarketing((s) => {
    const r = (s.reels ?? []).find((x) => x.id === id);
    if (!r) return;
    if (accion === "editar" && r.estado === "propuesta") {
      if (cambios?.guion && cambios.guion.trim().split(/\s+/).length >= 15) r.guion = cambios.guion.trim().slice(0, 1200);
      if (cambios?.caption && cambios.caption.trim().length >= 5) r.caption = cambios.caption.trim().slice(0, 2200);
    }
    if (accion === "aprobar" && r.estado === "propuesta") r.estado = "aprobada";
    if (accion === "descartar" && ["propuesta", "aprobada", "programada", "error"].includes(r.estado)) r.estado = "descartada";
    r.updatedAt = nowIso();
  });
}

// ---------------------------------------------------------------- paid: pause what spends badly

/**
 * Daily: pauses active campaigns whose cost per sale is over the limit, or that spent a lot with no result
 * at all. It only ever lowers spending, so it runs without approval; each pause is written to the log.
 */
export async function pausarMalas(): Promise<string[]> {
  const m = await loadMarketing();
  const cfg = { ...DEFAULT_PAUSA, ...(m.pausaAuto ?? {}) };
  if (!cfg.on) return [];
  const camp = await campaigns().catch(() => null);
  if (!camp?.connected) return [];
  const out: string[] = [];
  for (const c of camp.rows) {
    if (c.estado !== "ACTIVE") continue;
    const resultados = c.compras || c.leads;
    const cpa = resultados ? c.gasto7d / resultados : null;
    const motivo = !resultados && c.gasto7d >= cfg.gastoSinResultado
      ? `gastó US$${c.gasto7d.toFixed(2)} en 7 días sin ningún resultado`
      : cpa !== null && cpa > cfg.cpaMax && c.gasto7d >= cfg.cpaMax * 2
        ? `cada resultado costó US$${cpa.toFixed(2)} (límite US$${cfg.cpaMax})`
        : "";
    if (!motivo) continue;
    try {
      await setCampaignStatus(c.id, false, m.capUsd);
      out.push(`Pausé «${c.nombre}»: ${motivo}.`);
    } catch (e) {
      out.push(`No pude pausar «${c.nombre}»: ${e instanceof Error ? e.message : "error"}.`);
    }
  }
  if (out.length) await commitMarketing((s) => { s.bitacora = [...out.map((texto) => ({ at: nowIso(), texto })), ...(s.bitacora ?? [])].slice(0, 100); });
  return out;
}

/** Starts an autopilot round in its own request (its own time), without waiting for it. */
export async function kickPiloto() {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (secret.length < 16) { await avanzarPiloto().catch(() => null); return; }
  await fetch(`${SITE}/api/piloto`, { method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(4000) }).catch(() => {});
}
