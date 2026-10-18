import { readPrivateJSON, sbRest, writePrivateJSON } from "./supabase";
import { overview } from "./balances";
import { alarm, recentErrors } from "./errlog";
import { refundJob } from "./credits";
import { videoProviders } from "./providers";
import { pauseModel, pausedModels } from "./model-pause";
import { sendWhatsApp, whatsappMode } from "./whatsapp";
import { once } from "./marketing";
import { SITE } from "./emails";
import type { AreaId } from "./areas";

// The Guardián: Creads' eyes everywhere. Every few minutes (an external monitor calls /api/guardian, and the
// daily office round too) it checks that the public site, the studio, the database, the AI providers, the
// generations and the payments work, against the owner's thresholds. It acts by itself where it's safe:
//   - a video model failing a lot → paused for a while (customers stop spending credits on it);
//   - a generation stuck for too long → marked failed and its credits given back to the customer.
// Every problem becomes an incident for the area in charge (shown in that area of the Panel and read by its
// agents and the CEO General). Critical ones also go out by email and WhatsApp, and are re-sent when solved.
// It never touches code, payments or settings beyond pausing a model.

export interface GuardConfig {
  lentoMs: number; caidoMs: number; dbLentoMs: number;
  fallasPct: number; fallasMin: number; pausaHoras: number; autoPausa: boolean;
  trabadoMin: number; autoTrabados: boolean;
  erroresMax: number; whatsapp: boolean;
}
export const DEFAULT_CONFIG: GuardConfig = {
  lentoMs: 3000, caidoMs: 10000, dbLentoMs: 1500,
  fallasPct: 50, fallasMin: 4, pausaHoras: 2, autoPausa: true,
  trabadoMin: 60, autoTrabados: true,
  erroresMax: 25, whatsapp: true,
};

export type Estado = "ok" | "lento" | "falla";
export interface Check { id: string; nombre: string; area: AreaId; estado: Estado; valor: string; detalle: string }
export type Severidad = "aviso" | "critico";
export interface Incident {
  key: string; area: AreaId; severidad: Severidad; titulo: string; detalle: string;
  first: string; last: string; count: number; abierto: boolean; resueltoAt?: string; acciones: string[];
}
export interface GuardState {
  config: GuardConfig;
  lastRun: string | null; lastMs: number;
  checks: Check[];
  incidents: Incident[];
  runs: { at: string; ok: number; problemas: number; ms: number }[];
}
interface Problem { key: string; area: AreaId; severidad: Severidad; titulo: string; detalle: string; accion?: string; oneOff?: boolean }

const FILE = "guardian/estado.json";
const DEFAULT_STATE = (): GuardState => ({ config: { ...DEFAULT_CONFIG }, lastRun: null, lastMs: 0, checks: [], incidents: [], runs: [] });

export async function loadGuard(): Promise<GuardState> {
  const s = await readPrivateJSON<Partial<GuardState>>(FILE);
  const d = DEFAULT_STATE();
  return { ...d, ...(s ?? {}), config: { ...d.config, ...(s?.config ?? {}) }, incidents: s?.incidents ?? [], checks: s?.checks ?? [], runs: s?.runs ?? [] };
}
export async function commitGuard(mutate: (s: GuardState) => void) {
  const s = await loadGuard();
  mutate(s);
  await writePrivateJSON(FILE, s);
  return s;
}

/** Keeps a config the owner typed within sane limits. */
export function cleanConfig(b: Partial<Record<keyof GuardConfig, unknown>>, base: GuardConfig): GuardConfig {
  const n = (k: keyof GuardConfig, min: number, max: number) => {
    const v = Number(b[k]);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : (base[k] as number);
  };
  const bool = (k: keyof GuardConfig) => (typeof b[k] === "boolean" ? (b[k] as boolean) : (base[k] as boolean));
  const c: GuardConfig = {
    lentoMs: n("lentoMs", 500, 20000), caidoMs: n("caidoMs", 2000, 30000), dbLentoMs: n("dbLentoMs", 200, 10000),
    fallasPct: n("fallasPct", 10, 100), fallasMin: n("fallasMin", 2, 50), pausaHoras: n("pausaHoras", 1, 24), autoPausa: bool("autoPausa"),
    trabadoMin: n("trabadoMin", 20, 360), autoTrabados: bool("autoTrabados"),
    erroresMax: n("erroresMax", 5, 500), whatsapp: bool("whatsapp"),
  };
  if (c.caidoMs <= c.lentoMs) c.caidoMs = c.lentoMs + 1000;
  return c;
}

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const timed = async <T,>(fn: () => Promise<T>, ms: number) => {
  const t = Date.now();
  const v = await Promise.race([fn(), new Promise<never>((_, no) => setTimeout(() => no(new Error("tiempo agotado")), ms))]);
  return { v, ms: Date.now() - t };
};

// ---------------------------------------------------------------- what is checked (pure: easy to test)

/** A page's state from its time and HTTP status. */
export function pageState(ms: number, status: number, c: GuardConfig): Estado {
  if (!status || status >= 500 || ms >= c.caidoMs) return "falla";
  return ms >= c.lentoMs ? "lento" : "ok";
}

/** Video models failing too much in the last hour: [model, failed, total]. */
export function failingModels(rows: { model: string | null; status: string }[], c: GuardConfig): [string, number, number][] {
  const m = new Map<string, [number, number]>();
  for (const r of rows) {
    if (!r.model || !["done", "failed"].includes(r.status)) continue;
    const x = m.get(r.model) ?? [0, 0];
    x[1]++; if (r.status === "failed") x[0]++;
    m.set(r.model, x);
  }
  return [...m.entries()].filter(([, [f, t]]) => t >= c.fallasMin && (f / t) * 100 >= c.fallasPct).map(([k, [f, t]]) => [k, f, t]);
}

/** Merges this run's problems into the incident list: new ones open, repeated ones count, gone ones close. */
export function mergeIncidents(list: Incident[], problems: Problem[], now: string): { list: Incident[]; nuevos: Incident[]; resueltos: Incident[]; peores: Incident[] } {
  const out = list.map((i) => ({ ...i }));
  const nuevos: Incident[] = [], peores: Incident[] = [], resueltos: Incident[] = [];
  const seen = new Set<string>();
  for (const p of problems) {
    seen.add(p.key);
    const open = out.find((i) => i.key === p.key && i.abierto);
    if (open) {
      open.last = now; open.count++; open.detalle = p.detalle; open.titulo = p.titulo;
      if (p.accion) open.acciones = [...open.acciones, p.accion].slice(-10);
      if (p.severidad === "critico" && open.severidad !== "critico") { open.severidad = "critico"; peores.push(open); }
      if (p.oneOff) { open.abierto = false; open.resueltoAt = now; }
      continue;
    }
    const inc: Incident = { key: p.key, area: p.area, severidad: p.severidad, titulo: p.titulo, detalle: p.detalle, first: now, last: now, count: 1, abierto: !p.oneOff, acciones: p.accion ? [p.accion] : [], ...(p.oneOff ? { resueltoAt: now } : {}) };
    out.unshift(inc);
    nuevos.push(inc);
  }
  for (const i of out) if (i.abierto && !seen.has(i.key)) { i.abierto = false; i.resueltoAt = now; resueltos.push(i); }
  // open ones first, then the most recent; a few weeks of history
  const sorted = [...out.filter((i) => i.abierto), ...out.filter((i) => !i.abierto).sort((a, b) => b.last.localeCompare(a.last))].slice(0, 150);
  return { list: sorted, nuevos, resueltos, peores };
}

// ---------------------------------------------------------------- the round

const PAGES: [string, string, AreaId][] = [["/", "Página de inicio", "marketing"], ["/app", "Estudio (entrada)", "plataforma"], ["/en", "Página en inglés", "marketing"]];

export async function runGuardian(o: { force?: boolean } = {}): Promise<GuardState & { skipped?: boolean }> {
  // only one round at a time (the monitor and the panel can call at once)
  if (!o.force && !(await once("guardian:run", 45))) return { ...(await loadGuard()), skipped: true };
  const start = Date.now();
  const st = await loadGuard();
  const c = st.config;
  const checks: Check[] = [];
  const problems: Problem[] = [];

  // 1) the public site and the studio, as a customer sees them
  await Promise.all(PAGES.map(async ([path, nombre, area]) => {
    let status = 0, ms = c.caidoMs;
    try {
      const r = await timed(() => fetch(`${SITE}${path}`, { cache: "no-store", redirect: "follow", headers: { "user-agent": "CreadsGuardian/1.0 (monitor)" } }), c.caidoMs + 2000);
      status = r.v.status; ms = r.ms;
    } catch { status = 0; }
    const estado = pageState(ms, status, c);
    checks.push({ id: `pagina:${path}`, nombre, area, estado, valor: status ? `${(ms / 1000).toFixed(1)} s` : "sin respuesta", detalle: status ? `Respondió ${status} en ${ms} ms` : "No respondió" });
    if (estado === "falla") problems.push({ key: `pagina:${path}`, area, severidad: "critico", titulo: `${nombre} no carga`, detalle: status ? `Respondió ${status} en ${(ms / 1000).toFixed(1)} s.` : "No respondió." });
    else if (estado === "lento") problems.push({ key: `lenta:${path}`, area, severidad: "aviso", titulo: `${nombre} está lenta`, detalle: `Tardó ${(ms / 1000).toFixed(1)} s (el límite es ${(c.lentoMs / 1000).toFixed(1)} s).` });
  }));

  // 2) the database
  try {
    const r = await timed(() => sbRest("users?select=id&limit=1"), c.caidoMs);
    const estado: Estado = r.ms >= c.dbLentoMs ? "lento" : "ok";
    checks.push({ id: "db", nombre: "Base de datos", area: "plataforma", estado, valor: `${r.ms} ms`, detalle: "Supabase" });
    if (estado === "lento") problems.push({ key: "db:lenta", area: "plataforma", severidad: "aviso", titulo: "La base de datos está lenta", detalle: `Respondió en ${r.ms} ms (el límite es ${c.dbLentoMs} ms).` });
  } catch (e) {
    checks.push({ id: "db", nombre: "Base de datos", area: "plataforma", estado: "falla", valor: "sin respuesta", detalle: e instanceof Error ? e.message.slice(0, 120) : "" });
    problems.push({ key: "db:caida", area: "plataforma", severidad: "critico", titulo: "La base de datos no responde", detalle: "Los clientes no pueden entrar ni generar. Revisa Supabase (status.supabase.com) y el plan." });
  }

  // 3) the AI providers: balances and recent outages
  try {
    const ov = await overview(false);
    for (const s of ov.services) {
      const recent = s.lastFailure && Date.now() - Date.parse(s.lastFailure.at) < 30 * 60_000;
      const estado: Estado = s.level === "agotado" || recent ? "falla" : s.level === "bajo" ? "lento" : "ok";
      checks.push({ id: `prov:${s.id}`, nombre: s.name, area: "plataforma", estado, valor: s.usd !== null ? `US$${s.usd.toFixed(0)}` : "—", detalle: s.headline });
      if (recent) problems.push({ key: `prov:${s.id}:falla`, area: "plataforma", severidad: "critico", titulo: `${s.name} está fallando`, detalle: s.lastFailure!.msg.slice(0, 200) });
      else if (s.level === "agotado") problems.push({ key: `prov:${s.id}:saldo`, area: "plataforma", severidad: "critico", titulo: `${s.name}: se está quedando sin saldo`, detalle: `${s.headline} Recarga: ${s.recharge}` });
      else if (s.level === "bajo") problems.push({ key: `prov:${s.id}:saldo`, area: "plataforma", severidad: "aviso", titulo: `${s.name}: saldo bajo`, detalle: s.headline });
    }
  } catch { checks.push({ id: "prov", nombre: "Proveedores de IA", area: "plataforma", estado: "lento", valor: "—", detalle: "No se pudieron leer los saldos" }); }

  // 4) generations of the last hour: models failing a lot are paused (customers stop losing credits)
  try {
    const rows = await sbRest<{ model: string | null; status: string }[]>(`clips?created_at=gte.${ago(60)}&select=model,status&limit=2000`);
    const bad = failingModels(rows, c);
    const finished = rows.filter((r) => r.status === "done" || r.status === "failed");
    const failed = finished.filter((r) => r.status === "failed").length;
    checks.push({ id: "gen", nombre: "Generaciones (última hora)", area: "plataforma", estado: bad.length ? "falla" : "ok", valor: `${failed}/${finished.length} fallidas`, detalle: bad.length ? bad.map(([m, f, t]) => `${m}: ${f}/${t}`).join(", ") : "Normal" });
    const paused = await pausedModels(true);
    const available = videoProviders.filter((p) => p.configured() && !paused[p.id]).map((p) => p.id);
    for (const [model, f, t] of bad) {
      const label = videoProviders.find((p) => p.id === model)?.label ?? model;
      let accion: string | undefined;
      // never pause the last model left: customers must always have one
      if (c.autoPausa && !paused[model] && available.includes(model) && available.length > 1) {
        await pauseModel(model, c.pausaHoras, `Falló ${f} de ${t} veces en la última hora`, "guardian");
        available.splice(available.indexOf(model), 1);
        accion = `Pausé ${label} por ${c.pausaHoras} h para que los clientes no pierdan créditos.`;
      }
      problems.push({ key: `modelo:${model}`, area: "plataforma", severidad: "critico", titulo: `${label} está fallando mucho`, detalle: `Falló ${f} de ${t} veces en la última hora.`, accion });
    }
  } catch { checks.push({ id: "gen", nombre: "Generaciones (última hora)", area: "plataforma", estado: "lento", valor: "—", detalle: "No se pudieron leer" }); }

  // 5) generations stuck for too long: failed and credits back, so the customer can redo them
  try {
    const stuck = await sbRest<{ id: string; owner: string; model: string | null }[]>(`clips?status=in.(generating,starting)&updated_at=lt.${ago(c.trabadoMin)}&created_at=gte.${ago(3 * 24 * 60)}&select=id,owner,model&limit=50`);
    checks.push({ id: "trabados", nombre: "Generaciones trabadas", area: "clientes", estado: stuck.length ? "lento" : "ok", valor: String(stuck.length), detalle: `Más de ${c.trabadoMin} min sin terminar` });
    if (stuck.length && c.autoTrabados) {
      let fixed = 0;
      for (const s of stuck) {
        try {
          await sbRest(`clips?id=eq.${s.id}&status=in.(generating,starting)`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", error: "El proveedor no respondió a tiempo. Se devolvieron los créditos: puedes volver a generarlo.", updated_at: new Date().toISOString() }) });
          await refundJob(s.owner, s.id, "Devuelto: la generación se quedó trabada");
          fixed++;
        } catch { /* the next round tries again */ }
      }
      if (fixed) problems.push({ key: `trabados:${new Date().toISOString().slice(0, 13)}`, area: "clientes", severidad: "aviso", titulo: `${fixed} generacion${fixed > 1 ? "es trabadas" : " trabada"}`, detalle: `Llevaban más de ${c.trabadoMin} min sin terminar.`, accion: `Las marqué como fallidas y devolví los créditos a los clientes (${fixed}).`, oneOff: true });
    } else if (stuck.length) problems.push({ key: "trabados", area: "clientes", severidad: "aviso", titulo: `${stuck.length} generaciones trabadas`, detalle: `Llevan más de ${c.trabadoMin} min sin terminar (la acción automática está apagada).` });
  } catch { /* table missing: nothing to watch */ }

  // 6) errors: a spike in the last 15 minutes, and payment problems
  try {
    const errs = (await recentErrors(1)).filter((e) => e.at >= ago(15));
    const total = errs.reduce((a, e) => a + (e.n ?? 1), 0);
    const pagos = errs.filter((e) => e.area === "pagos");
    checks.push({ id: "errores", nombre: "Errores (15 min)", area: "plataforma", estado: total > c.erroresMax ? "falla" : total > c.erroresMax / 2 ? "lento" : "ok", valor: String(total), detalle: `Límite ${c.erroresMax}` });
    if (total > c.erroresMax) problems.push({ key: "errores:ola", area: "plataforma", severidad: "critico", titulo: "Muchos errores de golpe", detalle: `${total} errores en 15 min. Los más repetidos: ${[...new Set(errs.map((e) => e.message.slice(0, 60)))].slice(0, 3).join(" | ")}` });
    checks.push({ id: "pagos", nombre: "Pagos (15 min)", area: "numeros", estado: pagos.length ? "falla" : "ok", valor: String(pagos.length), detalle: "Errores de cobro o avisos de pago" });
    if (pagos.length) problems.push({ key: "pagos:error", area: "numeros", severidad: "critico", titulo: "Hay errores en los pagos", detalle: pagos.map((e) => e.message.slice(0, 80)).slice(0, 2).join(" | ") });
  } catch { /* nothing to read */ }

  const now = new Date().toISOString();
  const merged = mergeIncidents(st.incidents, problems, now);
  const ms = Date.now() - start;
  const saved = await commitGuard((s) => {
    s.checks = checks.sort((a, b) => a.area.localeCompare(b.area));
    s.incidents = merged.list;
    s.lastRun = now; s.lastMs = ms;
    s.runs = [{ at: now, ok: checks.filter((x) => x.estado === "ok").length, problemas: problems.length, ms }, ...s.runs].slice(0, 300);
  });
  await notify(merged, c);
  return saved;
}

// ---------------------------------------------------------------- telling people

/** Critical problems: email (alarm) and WhatsApp, at most once every 6 h per problem and 12 WhatsApps a day. */
async function notify(m: ReturnType<typeof mergeIncidents>, c: GuardConfig) {
  const urgent = [...m.nuevos, ...m.peores].filter((i) => i.severidad === "critico");
  for (const i of urgent) {
    await alarm(`guardian:${i.key}`, { title: `Guardián: ${i.titulo}`, detail: `${i.detalle}${i.acciones.length ? ` Lo que hice: ${i.acciones.join(" ")}` : ""}` }).catch(() => {});
    if (c.whatsapp && whatsappMode() && (await once(`wa:${i.key}`, 6 * 3600)) && (await once("wa:dia", 86400, 12))) {
      await sendWhatsApp(`🔴 Creads · ${i.titulo}. ${i.detalle}${i.acciones.length ? ` Hice: ${i.acciones.join(" ")}` : " Necesita tu atención."} Panel: ${SITE}/admin`);
    }
  }
  for (const i of m.resueltos.filter((x) => x.severidad === "critico")) {
    if (c.whatsapp && whatsappMode() && (await once(`wa:ok:${i.key}`, 6 * 3600)) && (await once("wa:dia", 86400, 12))) {
      await sendWhatsApp(`🟢 Creads · Resuelto: ${i.titulo}.`);
    }
  }
}

/** What the office agents read: open incidents per area and today's actions. */
export async function guardianSummary(area?: AreaId) {
  const st = await loadGuard();
  const open = st.incidents.filter((i) => i.abierto && (!area || i.area === area));
  const recent = st.incidents.filter((i) => !i.abierto && i.resueltoAt && i.resueltoAt >= ago(24 * 60) && (!area || i.area === area)).slice(0, 10);
  return `Última revisión: ${st.lastRun ?? "nunca"} (${st.checks.filter((c) => c.estado === "ok").length}/${st.checks.length} controles bien).
Problemas abiertos (${open.length}):\n${open.map((i) => `- [${i.severidad}] (área ${i.area}) ${i.titulo}: ${i.detalle}${i.acciones.length ? ` · Hecho: ${i.acciones.join(" ")}` : ""} · desde ${i.first.slice(0, 16)} (${i.count} veces)`).join("\n") || "- ninguno"}
Resueltos en 24 h:\n${recent.map((i) => `- ${i.titulo}${i.acciones.length ? ` · Hecho: ${i.acciones.join(" ")}` : ""}`).join("\n") || "- ninguno"}
Controles: ${st.checks.map((c) => `${c.nombre} ${c.estado} (${c.valor})`).join(" · ")}`;
}
