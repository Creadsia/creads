import { randomBytes } from "node:crypto";
import { readPrivateJSON, writePrivateJSON } from "./supabase";
import { createSession, createUser, findUserByEmail } from "./auth";
import { open, seal } from "./meta-conexiones";
import { DEFAULT_AUTOPROD, type AutoProd, type Pedido, type ProdJob, commitMarketing, loadMarketing, once } from "./marketing";
import { videoProviders } from "./providers";
import { pausedModels } from "./model-pause";
import { type AdJob, runStep } from "./ad-runner";
import { SITE } from "./emails";

// The automatic producer: an approved ad request (from Creativos or the Community manager) becomes a finished
// video in the content bank, with nobody in the studio. It walks the same steps a person does in «Crear
// anuncio» — cuts → scenes → start the clips → wait → quality review (free redo of severe errors) → montage
// with the «Hecho con Creads IA» badge — by calling the studio's own endpoints as a robot account of the
// owner's team, so every rule of the studio (QA, learned rules, retries, refunds) applies the same.
// It advances one step per job each time it's called (every 5 minutes from the Guardián's ping), at most
// `maxPorDia` new videos a day. Generation in the owner's workspace costs real provider money: only requests
// someone approved get produced.

const ROBOT_EMAIL = "robot@creadsia.com";
const SESSION_FILE = "marketing/robot-session.json";
const MAX_ACTIVE = 2;
const STEP_TIMEOUT = 240_000;

/** The robot's session cookie (its own member account in the owner's team; the token is stored encrypted). */
async function robotCookie(): Promise<string> {
  const saved = await readPrivateJSON<{ sealed: string; until: string }>(SESSION_FILE).catch(() => null);
  if (saved && Date.parse(saved.until) > Date.now() + 86400_000) {
    const token = open(saved.sealed);
    if (token) return `creads_session=${token}`;
  }
  let user = await findUserByEmail(ROBOT_EMAIL);
  if (!user) {
    await createUser({ email: ROBOT_EMAIL, name: "Robot de producción (automático)", password: randomBytes(24).toString("base64url"), role: "member", workspace: "main" });
    user = await findUserByEmail(ROBOT_EMAIL);
  }
  if (!user || user.workspace !== "main") throw new Error("No se pudo preparar la cuenta del robot de producción.");
  const token = await createSession(user.id, "CreadsRobot/1.0 (producción automática)");
  await writePrivateJSON(SESSION_FILE, { sealed: seal(token), until: new Date(Date.now() + 25 * 86400_000).toISOString() });
  return `creads_session=${token}`;
}

/** Calls one of the studio's endpoints as the robot. Throws the endpoint's own (customer-safe) message. */
async function studio<T>(path: string, body?: unknown, timeoutMs = STEP_TIMEOUT, retry = true): Promise<T> {
  const cookie = await robotCookie();
  const res = await fetch(`${SITE}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { cookie, "content-type": "application/json", "user-agent": "CreadsRobot/1.0" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  // the robot's session ended (account removed or session cleared): a new one, once
  if (res.status === 401 && retry) { await writePrivateJSON(SESSION_FILE, {}); return studio<T>(path, body, timeoutMs, false); }
  const d = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(d.error || `El estudio respondió ${res.status}.`);
  return d;
}

/** The model for automatic videos: the one chosen in Marketing, else the cheapest that talks and is available. */
export async function pickModel(cfg: Pick<AutoProd, "modelo">): Promise<string> {
  const paused = await pausedModels().catch(() => ({} as Record<string, unknown>));
  const ok = videoProviders.filter((p) => p.configured() && !p.silent && !p.needsImage && !paused[p.id]);
  const chosen = ok.find((p) => p.id === cfg.modelo);
  if (chosen) return chosen.id;
  const best = [...ok].sort((a, b) => a.usdPerSecond - b.usdPerSecond)[0];
  if (!best) throw new Error("No hay ningún modelo de video con voz disponible ahora.");
  return best.id;
}

const save = (id: string, patch: Partial<ProdJob>) => commitMarketing((m) => {
  const j = (m.produccion ?? []).find((x) => x.id === id);
  if (j) Object.assign(j, patch, { updatedAt: new Date().toISOString() });
  if (patch.estado === "listo" || patch.estado === "error") {
    const p = m.pedidos.find((x) => x.id === j?.pedidoId);
    if (p && patch.estado === "listo") p.estado = "listo";
  }
});

/** Puts an approved request in the production line (when automatic production is on). */
export async function enqueue(p: Pedido): Promise<boolean> {
  const m = await loadMarketing();
  const cfg = { ...DEFAULT_AUTOPROD, ...(m.autoProd ?? {}) };
  if (!cfg.on || (m.produccion ?? []).some((j) => j.pedidoId === p.id)) return false;
  const now = new Date().toISOString();
  const job: ProdJob = { id: `prod-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, pedidoId: p.id, titulo: p.titulo, at: now, updatedAt: now, estado: "cola", formato: p.formato, idioma: p.idioma, guion: p.guion };
  await commitMarketing((s) => {
    s.produccion = [job, ...(s.produccion ?? [])].slice(0, 60);
    const ped = s.pedidos.find((x) => x.id === p.id);
    if (ped) ped.estado = "en producción";
  });
  return true;
}

/** One step for one job. Errors stop that job with a plain message (the others keep going). */
async function step(j: ProdJob, cfg: AutoProd): Promise<void> {
  const patch = await runStep(j as unknown as AdJob, studio, () => pickModel(cfg), cfg.sello);
  if (patch.estado === "listo") patch.paso = "Video terminado: ya está en el banco de contenido";
  if (Object.keys(patch).length) await save(j.id, patch as Partial<ProdJob>); // no progress: the 3-hour clock keeps running
}

/** Moves the production line forward (called every 5 minutes, and right after an approval). */
export async function advanceProduction(): Promise<number> {
  if (!(await once("autoprod:tick", 150))) return 0; // one runner at a time
  const m = await loadMarketing();
  const cfg = { ...DEFAULT_AUTOPROD, ...(m.autoProd ?? {}) };
  const jobs = m.produccion ?? [];
  const active = jobs.filter((j) => !["cola", "listo", "error"].includes(j.estado));
  const today = new Date().toISOString().slice(0, 10);
  const startedToday = jobs.filter((j) => j.estado !== "cola" && j.at.slice(0, 10) === today).length;
  // new videos only while there's room (2 at a time, the daily limit) and production is on
  const room = cfg.on ? Math.max(0, Math.min(MAX_ACTIVE - active.length, cfg.maxPorDia - startedToday)) : 0;
  const start = jobs.filter((j) => j.estado === "cola").reverse().slice(0, room);
  const work = [...active, ...start];
  await Promise.all(work.map((j) => step(j, cfg)));
  return work.length;
}

/** Starts a production round in its own request (so it gets its own time), without waiting for it. */
export async function kickProduction() {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (secret.length < 16) { await advanceProduction().catch(() => 0); return; }
  await fetch(`${SITE}/api/produccion`, { method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(4000) }).catch(() => {});
}
