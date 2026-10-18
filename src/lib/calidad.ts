import { sbRest } from "./supabase";
import { sharedRules } from "./db";
import { findTool } from "./tools";

// Panel → Plataforma → Calidad: how character videos really turn out (the reviews keep their notes in the
// job), why generations fail (grouped), and the learned rules waiting for the owner's approval.

interface ClipRow { status: string; kind: string | null; model: string | null; error: string | null; provider_job: string | null; created_at: string }
interface SwapNote { s?: number; r1?: number; r2?: number; q1?: string[]; q2?: string[]; qa?: string }

export interface Quality {
  days: number;
  personaje: {
    total: number; listos: number; fallidos: number; enCurso: number;
    /** finished without any redo and without warnings */
    limpios: number;
    rehechosEscena: number; rehechosVideo: number; conAviso: number;
    problemas: { texto: string; veces: number }[];
  };
  motivos: { herramienta: string; texto: string; veces: number }[];
  reglasPendientes: { id: string; es: string; en: string }[];
}

const SWAP = "swap:";
const note = (job: string | null): SwapNote | null => {
  if (!job?.startsWith(SWAP)) return null;
  try { return JSON.parse(job.slice(SWAP.length)) as SwapNote; } catch { return null; }
};

/** The same failure written with different numbers or ids counts once. */
export const errorKey = (e: string) => e.replace(/https?:\/\/\S+/g, "").replace(/\d+([.,]\d+)?/g, "#").replace(/\s+/g, " ").trim().slice(0, 140);

export function summarize(rows: ClipRow[], days: number): Omit<Quality, "reglasPendientes"> {
  const sw = rows.filter((r) => r.kind === "tool:personaje-en-video");
  const probs = new Map<string, number>();
  let limpios = 0, r1 = 0, r2 = 0, aviso = 0;
  for (const r of sw) {
    const n = note(r.provider_job);
    if (!n) continue;
    if (n.r1) r1++;
    if (n.r2) r2++;
    if (n.qa === "aviso") aviso++;
    if (r.status === "done" && !n.r1 && !n.r2 && n.qa !== "aviso") limpios++;
    for (const p of [...(n.q1 ?? []), ...(n.q2 ?? [])]) { const k = p.trim().toLowerCase().slice(0, 120); if (k) probs.set(k, (probs.get(k) ?? 0) + 1); }
  }
  const motivos = new Map<string, { herramienta: string; texto: string; veces: number }>();
  for (const r of rows) {
    if (r.status !== "failed" || !r.error) continue;
    const k = r.kind ?? "";
    const herramienta = k.startsWith("tool:") ? findTool(k.slice(5))?.name ?? k.slice(5) : r.model ?? "Video";
    const key = `${herramienta}|${errorKey(r.error)}`;
    const m = motivos.get(key) ?? { herramienta, texto: r.error.slice(0, 220), veces: 0 };
    m.veces++;
    motivos.set(key, m);
  }
  return {
    days,
    personaje: {
      total: sw.length,
      listos: sw.filter((r) => r.status === "done").length,
      fallidos: sw.filter((r) => r.status === "failed").length,
      enCurso: sw.filter((r) => r.status !== "done" && r.status !== "failed").length,
      limpios, rehechosEscena: r1, rehechosVideo: r2, conAviso: aviso,
      problemas: [...probs].map(([texto, veces]) => ({ texto, veces })).sort((a, b) => b.veces - a.veces).slice(0, 12),
    },
    motivos: [...motivos.values()].sort((a, b) => b.veces - a.veces).slice(0, 15),
  };
}

export async function qualityStats(days = 30): Promise<Quality> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows: ClipRow[] = [];
  for (let p = 0; p < 20; p++) {
    const page = await sbRest<ClipRow[]>(`clips?created_at=gte.${since}&select=status,kind,model,error,provider_job,created_at&order=created_at.desc&limit=1000&offset=${p * 1000}`).catch(() => [] as ClipRow[]);
    rows.push(...page);
    if (page.length < 1000) break;
  }
  const pend = (await sharedRules.list("active=eq.false&order=created_at.desc&limit=100").catch(() => [])) as { id: string; rule_en: string; rule_es: string | null; formats: string[] | null }[];
  return {
    ...summarize(rows, days),
    reglasPendientes: pend.filter((r) => (r.formats ?? []).includes("personaje")).slice(0, 20).map((r) => ({ id: r.id, es: r.rule_es ?? r.rule_en, en: r.rule_en })),
  };
}
