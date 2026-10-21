import { videoProviders } from "./providers";
import { DEFAULT_STYLE } from "./caption-style";

// The ad pipeline as a person runs it in «Crear anuncio», one step per call:
// cola → escenas → generando → revisando → armando → listo (or error), calling the studio's own endpoints
// through `studio` (the marketing robot's session, or a customer's API key). Every studio rule applies:
// quality review with free redos of severe errors, learned rules, retries, refunds.

export type AdEstado = "cola" | "escenas" | "generando" | "revisando" | "armando" | "listo" | "error";
export interface AdJob {
  estado: AdEstado; paso?: string; updatedAt: string;
  titulo: string; formato: string; idioma: "es-CL" | "en"; guion: string; modelo?: string;
  /** An avatar of the account: the same person (face) in every cut. */
  avatarId?: string;
  cortes?: { tipo: string; texto: string }[]; adId?: string; clipIds?: string[]; reintentos?: Record<string, number>; revisado?: boolean;
  videoUrl?: string; error?: string;
  /** «pro» (default): headlines, zooms, flashes, sounds and a closing card. «simple»: cuts + subtitles only. */
  edicion?: "pro" | "simple";
}
export type Studio = <T>(path: string, body?: unknown, timeoutMs?: number) => Promise<T>;

const frame = (dir: { setting?: string; framing?: string } | undefined, lang: string, avatar = false) =>
  `Photorealistic 9:16 still frame, the first frame of a real phone video clip (not a staged photo).${avatar ? " The person from the first reference image (same face, hair and look)." : ""} Setting: ${dir?.setting || "a real place, natural light"}. Shot: ${dir?.framing || "handheld selfie, chest-up"}. A natural relaxed expression, mouth closed, the instant before speaking.${lang === "es-CL" ? " The place looks like Chile." : ""} Natural light, real skin texture, no text, no logos, no watermark.`;

/** Runs one step and returns what changed (never throws: an error stops the job with a plain message). */
export async function runStep(j: AdJob, studio: Studio, pickModel: () => Promise<string>, sello: boolean): Promise<Partial<AdJob>> {
  try {
    if (j.estado === "cola") {
      const d = await studio<{ titulo?: string; cortes: { tipo: string; texto: string }[] }>("/api/cuts", { script: j.guion, format: j.formato, lang: j.idioma, maxSec: 8 });
      if (!d.cortes?.length) throw new Error("El guion no se pudo dividir en cortes.");
      return { estado: "escenas", paso: `${d.cortes.length} cortes listos`, cortes: d.cortes.map((c) => ({ tipo: c.tipo, texto: c.texto })), titulo: d.titulo || j.titulo };
    }
    if (j.estado === "escenas") {
      const cortes = j.cortes ?? [];
      const sc = await studio<{ scenes: { prompt: string; dir?: { setting?: string; framing?: string } }[] }>("/api/scenes", { format: j.formato, lang: j.idioma, aspect: "9:16", cuts: cortes, script: cortes.map((c) => c.texto).join(" "), ...(j.avatarId ? { avatarId: j.avatarId } : {}) });
      if (sc.scenes?.length !== cortes.length) throw new Error("No se pudieron dirigir las escenas.");
      const modelo = j.modelo || (await pickModel());
      const ad = await studio<{ ad: { id: string }; clips: { id: string }[] }>("/api/ads/start", {
        title: j.titulo, format: j.formato, lang: j.idioma, aspect: "9:16", model: modelo, ...(j.avatarId ? { avatarId: j.avatarId } : {}),
        clips: cortes.map((c, i) => ({ tipo: c.tipo, texto: c.texto, prompt: sc.scenes[i].prompt, framePrompt: frame(sc.scenes[i].dir, j.idioma, Boolean(j.avatarId)) })),
      });
      const ids = ad.clips.map((c) => c.id);
      for (let i = 0; i < ids.length; i += 2) await Promise.all(ids.slice(i, i + 2).map((id) => studio("/api/clips/run", { id }).catch(() => null)));
      return { estado: "generando", paso: `Generando ${ids.length} cortes con ${videoProviders.find((p) => p.id === modelo)?.label ?? modelo}`, modelo, adId: ad.ad.id, clipIds: ids };
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
      if (done === ids.length) return { estado: j.revisado ? "armando" : "revisando", paso: "Cortes listos", reintentos };
      if (Date.now() - Date.parse(j.updatedAt) > 3 * 3600_000 && !failed.length) throw new Error("La generación lleva más de 3 horas sin terminar.");
      const paso = `${done} de ${ids.length} cortes listos`;
      return failed.length || paso !== j.paso ? { paso, reintentos } : {}; // progress resets the 3-hour clock
    }
    if (j.estado === "revisando") {
      const r = await studio<{ results: { clipId: string; severe?: boolean; freeRedo?: boolean; issues: string[] }[] }>("/api/review", { adId: j.adId }, 290_000);
      const todo = (r.results ?? []).filter((x) => x.severe && x.freeRedo);
      for (const x of todo) {
        await studio("/api/clips/fix", { id: x.clipId, problem: x.issues.join(". ") }).catch(() => null);
        await studio("/api/clips/run", { id: x.clipId, free: true }).catch(() => null);
      }
      return todo.length ? { estado: "generando", revisado: true, paso: `Rehaciendo ${todo.length} corte(s) que la revisión encontró con errores` } : { estado: "armando", revisado: true, paso: "Revisión de calidad aprobada" };
    }
    if (j.estado === "armando") {
      const d = await studio<{ url: string }>("/api/montage", { adId: j.adId, captions: true, style: { ...DEFAULT_STYLE, sello }, pro: j.edicion !== "simple" }, 290_000);
      return { estado: "listo", paso: "Video terminado", videoUrl: d.url };
    }
    return {};
  } catch (e) {
    return { estado: "error", error: (e instanceof Error ? e.message : "No se pudo seguir.").slice(0, 300) };
  }
}
