import { randomBytes } from "node:crypto";
import { readPrivateJSON, writePrivateJSON } from "./supabase";
import { createSession, createUser, findUserByEmail } from "./auth";
import { open, seal } from "./meta-conexiones";
import { DEFAULT_AUTOPROD, type AutoProd, type Pedido, type ProdJob, commitMarketing, loadMarketing, once } from "./marketing";
import { videoProviders } from "./providers";
import { pausedModels } from "./model-pause";
import { DEFAULT_STYLE } from "./caption-style";
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
async function pickModel(cfg: AutoProd): Promise<string> {
  const paused = await pausedModels().catch(() => ({} as Record<string, unknown>));
  const ok = videoProviders.filter((p) => p.configured() && !p.silent && !p.needsImage && !paused[p.id]);
  const chosen = ok.find((p) => p.id === cfg.modelo);
  if (chosen) return chosen.id;
  const best = [...ok].sort((a, b) => a.usdPerSecond - b.usdPerSecond)[0];
  if (!best) throw new Error("No hay ningún modelo de video con voz disponible ahora.");
  return best.id;
}

const frame = (dir: { setting?: string; framing?: string } | undefined, lang: string) =>
  `Photorealistic 9:16 still frame, the first frame of a real phone video clip (not a staged photo). Setting: ${dir?.setting || "a real place, natural light"}. Shot: ${dir?.framing || "handheld selfie, chest-up"}. A natural relaxed expression, mouth closed, the instant before speaking.${lang === "es-CL" ? " The place looks like Chile." : ""} Natural light, real skin texture, no text, no logos, no watermark.`;

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
  try {
    if (j.estado === "cola") {
      const d = await studio<{ titulo?: string; cortes: { tipo: string; texto: string }[] }>("/api/cuts", { script: j.guion, format: j.formato, lang: j.idioma, maxSec: 8 });
      if (!d.cortes?.length) throw new Error("El guion no se pudo dividir en cortes.");
      await save(j.id, { estado: "escenas", paso: `${d.cortes.length} cortes listos`, cortes: d.cortes.map((c) => ({ tipo: c.tipo, texto: c.texto })), titulo: d.titulo || j.titulo });
      return;
    }
    if (j.estado === "escenas") {
      const cortes = j.cortes ?? [];
      const sc = await studio<{ scenes: { prompt: string; dir?: { setting?: string; framing?: string } }[] }>("/api/scenes", { format: j.formato, lang: j.idioma, aspect: "9:16", cuts: cortes, script: cortes.map((c) => c.texto).join(" ") });
      if (sc.scenes?.length !== cortes.length) throw new Error("No se pudieron dirigir las escenas.");
      const modelo = await pickModel(cfg);
      const ad = await studio<{ ad: { id: string }; clips: { id: string }[] }>("/api/ads/start", {
        title: j.titulo, format: j.formato, lang: j.idioma, aspect: "9:16", model: modelo,
        clips: cortes.map((c, i) => ({ tipo: c.tipo, texto: c.texto, prompt: sc.scenes[i].prompt, framePrompt: frame(sc.scenes[i].dir, j.idioma) })),
      });
      const ids = ad.clips.map((c) => c.id);
      for (let i = 0; i < ids.length; i += 2) await Promise.all(ids.slice(i, i + 2).map((id) => studio("/api/clips/run", { id }).catch(() => null)));
      await save(j.id, { estado: "generando", paso: `Generando ${ids.length} cortes con ${videoProviders.find((p) => p.id === modelo)?.label ?? modelo}`, modelo, adId: ad.ad.id, clipIds: ids });
      return;
    }
    if (j.estado === "generando") {
      const ids = j.clipIds ?? [];
      const st = await Promise.all(ids.map((id) => studio<{ clip?: { status: string } }>(`/api/clips/status?id=${id}`).then((d) => d.clip?.status ?? "unknown").catch(() => "unknown")));
      const failed = ids.filter((_, i) => st[i] === "failed");
      const reintentos = { ...(j.reintentos ?? {}) };
      for (const id of failed) {
        if ((reintentos[id] ?? 0) >= 1) throw new Error("Un corte falló dos veces. Revísalo en el estudio (Biblioteca) o pide el video de nuevo.");
        reintentos[id] = (reintentos[id] ?? 0) + 1;
        await studio("/api/clips/run", { id }).catch(() => null);
      }
      const done = st.filter((x) => x === "done").length;
      if (done === ids.length) { await save(j.id, { estado: j.revisado ? "armando" : "revisando", paso: "Cortes listos", reintentos }); return; }
      if (Date.now() - Date.parse(j.updatedAt) > 3 * 3600_000 && !failed.length) throw new Error("La generación lleva más de 3 horas sin terminar.");
      const paso = `${done} de ${ids.length} cortes listos`;
      if (failed.length || paso !== j.paso) await save(j.id, { paso, reintentos }); // progress resets the 3-hour clock
      return;
    }
    if (j.estado === "revisando") {
      const r = await studio<{ results: { clipId: string; severe?: boolean; freeRedo?: boolean; issues: string[] }[] }>("/api/review", { adId: j.adId }, 290_000);
      const todo = (r.results ?? []).filter((x) => x.severe && x.freeRedo);
      for (const x of todo) {
        await studio("/api/clips/fix", { id: x.clipId, problem: x.issues.join(". ") }).catch(() => null);
        await studio("/api/clips/run", { id: x.clipId, free: true }).catch(() => null);
      }
      await save(j.id, todo.length ? { estado: "generando", revisado: true, paso: `Rehaciendo ${todo.length} corte(s) que la revisión encontró con errores` } : { estado: "armando", revisado: true, paso: "Revisión de calidad aprobada" });
      return;
    }
    if (j.estado === "armando") {
      const d = await studio<{ url: string }>("/api/montage", { adId: j.adId, captions: true, style: { ...DEFAULT_STYLE, sello: cfg.sello } }, 290_000);
      await save(j.id, { estado: "listo", paso: "Video terminado: ya está en el banco de contenido", videoUrl: d.url });
    }
  } catch (e) {
    await save(j.id, { estado: "error", error: (e instanceof Error ? e.message : "No se pudo seguir.").slice(0, 300) });
  }
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
