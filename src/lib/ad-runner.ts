import { videoProviders } from "./providers";
import { DEFAULT_STYLE } from "./caption-style";
import type { AdLang } from "./ad-lang";
import { adFramePrompt, autoPersona, personaWanted } from "./ad-continuity";

// The ad pipeline as a person runs it in «Crear anuncio», one step per call:
// cola → escenas → generando → revisando → armando → listo (or error), calling the studio's own endpoints
// through `studio` (the marketing robot's session, or a customer's API key). Every studio rule applies:
// quality review with free redos of severe errors, learned rules, retries, refunds.

export type AdEstado = "cola" | "escenas" | "generando" | "revisando" | "armando" | "listo" | "error";
export interface AdJob {
  estado: AdEstado; paso?: string; updatedAt: string;
  titulo: string; formato: string;
  /** «es-CL» Chilean Spanish, «es» español neutro (accent from the voice), «en» American English. */
  idioma: AdLang;
  guion: string; modelo?: string;
  /** An avatar of the account: the same person (face) in every cut. */
  avatarId?: string;
  /** The customer's product photo (media link): every scene shows exactly that product. */
  producto?: string;
  /** Without an avatar: the automatic person of this ad (who they are and what they wear, in English). */
  persona?: string;
  /** The caller named the ad: the cut step keeps that name. */
  tituloPropio?: boolean;
  /** The voice chosen for this ad (account voice id or «lib:owner:voice»); otherwise the avatar's or a matching accent voice. */
  voz?: string;
  cortes?: { tipo: string; texto: string }[]; adId?: string; clipIds?: string[]; reintentos?: Record<string, number>; revisado?: boolean;
  videoUrl?: string; error?: string;
  /** «pro» (default): headlines, zooms, flashes, sounds and a closing card. «simple»: cuts + subtitles only. */
  edicion?: "pro" | "simple";
  /** Notes for the Pro editor (brand, product, audience, what to highlight or avoid). */
  indicaciones?: string;
  /** The Pro edit's look: template and brand colours. */
  look?: { plantilla?: string; c1?: string; c2?: string };
  /** false = no subtitles at all (the cuts only, or the Pro edit without captions). */
  subtitulos?: boolean;
  /** Different places across the cuts (the person moves through them, same face and clothes); empty = one place. */
  lugares?: string;
  /** Faster voice (1.0–1.2), when the customer asks for a quicker delivery. */
  velocidad?: number;
  /** A label on screen for the whole ad («Dramatización · actor IA»): a first-person story told by an AI person. */
  aviso?: string;
  /** The customer's corrections to the subtitles («CREATZIA.COM» → «creadsia.com»). */
  correcciones?: { de: string; a: string }[];
}

/** What the montage gets for an API ad (also used to build it again with subtitle corrections). */
export const montageBody = (j: AdJob, sello: boolean) => ({
  adId: j.adId, captions: j.subtitulos !== false, style: { ...DEFAULT_STYLE, sello, ...(j.look?.c1 ? { accent: j.look.c1 } : {}) }, pro: j.edicion !== "simple",
  ...(j.indicaciones ? { indicaciones: j.indicaciones } : {}), ...(j.look ? { look: j.look } : {}), ...(j.correcciones?.length ? { correcciones: j.correcciones } : {}),
  ...(j.aviso ? { aviso: j.aviso } : {}),
});
export type Studio = <T>(path: string, body?: unknown, timeoutMs?: number) => Promise<T>;

/**
 * The first-frame prompt of each cut. With an avatar, its photo is the first reference; with the automatic
 * person, the first cut is drawn from the description and every later cut copies that first frame.
 */
export function framePrompts(j: Pick<AdJob, "idioma" | "avatarId" | "producto" | "persona">, dirs: ({ setting?: string; framing?: string } | undefined)[]): string[] {
  return dirs.map((d, i) => adFramePrompt(d, j.idioma, {
    personRef: Boolean(j.avatarId) || (Boolean(j.persona) && i > 0),
    ...(j.persona && !j.avatarId ? { person: j.persona } : {}),
    product: Boolean(j.producto),
  }));
}

/** Runs one step and returns what changed (never throws: an error stops the job with a plain message). */
export async function runStep(j: AdJob, studio: Studio, pickModel: () => Promise<string>, sello: boolean): Promise<Partial<AdJob>> {
  try {
    if (j.estado === "cola") {
      const d = await studio<{ titulo?: string; cortes: { tipo: string; texto: string }[] }>("/api/cuts", { script: j.guion, format: j.formato, lang: j.idioma, maxSec: 8 });
      if (!d.cortes?.length) throw new Error("El guion no se pudo dividir en cortes.");
      return { estado: "escenas", paso: `${d.cortes.length} cortes listos`, cortes: d.cortes.map((c) => ({ tipo: c.tipo, texto: c.texto })), titulo: j.tituloPropio ? j.titulo : d.titulo || j.titulo };
    }
    if (j.estado === "escenas") {
      const cortes = j.cortes ?? [];
      // no avatar: one automatic person and outfit for the whole ad (owner's test, 25 Oct 2026: the t-shirt
      // changed colour between cuts), kept on the job so a retry of this step picks the same one
      const persona = j.avatarId || !personaWanted(j.formato) ? undefined : j.persona || autoPersona((j as { id?: string }).id ?? j.guion, j.idioma, j.guion);
      const job = { ...j, persona };
      const sc = await studio<{ scenes: { prompt: string; dir?: { setting?: string; framing?: string } }[] }>("/api/scenes", { format: j.formato, lang: j.idioma, aspect: "9:16", cuts: cortes, script: cortes.map((c) => c.texto).join(" "), ...(j.avatarId ? { avatarId: j.avatarId } : {}),
        ...(persona ? { avatarText: persona } : {}), ...(j.producto ? { productImage: j.producto } : {}),
        // «varios lugares» (owner, 23 Oct 2026): the director moves the person through these places, same clothes
        ...(j.lugares ? { direction: `Distintos lugares: la persona cambia de lugar entre cortes siguiendo la historia, con la MISMA cara y la MISMA ropa en todos. Lugares: ${j.lugares}` } : {}) });
      if (sc.scenes?.length !== cortes.length) throw new Error("No se pudieron dirigir las escenas.");
      const modelo = j.modelo || (await pickModel());
      const frames = framePrompts(job, sc.scenes.map((x) => x.dir));
      const ad = await studio<{ ad: { id: string }; clips: { id: string }[] }>("/api/ads/start", {
        title: j.titulo, format: j.formato, lang: j.idioma, aspect: "9:16", model: modelo, ...(j.avatarId ? { avatarId: j.avatarId } : {}), ...(j.voz ? { voiceId: j.voz } : {}), ...(j.velocidad ? { voiceSpeed: j.velocidad } : {}),
        ...(persona ? { persona } : {}), ...(j.producto ? { productImage: j.producto } : {}),
        lipsync: "pro", // the most natural mouth (sync-3) on the voice Creads records, like the studio
        clips: cortes.map((c, i) => ({ tipo: c.tipo, texto: c.texto, prompt: sc.scenes[i].prompt, framePrompt: frames[i] })),
      });
      const ids = ad.clips.map((c) => c.id);
      // a cut that can't start (e.g. not enough credits) used to be swallowed and the ad stayed «generando»
      // forever (owner, 24 Oct 2026: a gift ad stuck after its first cut). Now the reason shows in the step,
      // and the next check starts it again (it goes on by itself once there are credits).
      let blocked = "";
      for (let i = 0; i < ids.length; i += 2) await Promise.all(ids.slice(i, i + 2).map((id) => studio("/api/clips/run", { id }).catch((e: unknown) => { blocked ||= e instanceof Error ? e.message : "un corte no pudo empezar"; })));
      return { estado: "generando", paso: blocked ? `En espera: ${blocked}` : `Generando ${ids.length} cortes`, modelo, adId: ad.ad.id, clipIds: ids, ...(persona ? { persona } : {}) };
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
      // cuts that never started (their start failed, e.g. credits ran out): try again; say why if it still can't
      let blocked = "";
      for (const [i, id] of ids.entries()) {
        if (st[i] !== "pending" && st[i] !== "draft" && st[i] !== "idle") continue;
        await studio("/api/clips/run", { id }).catch((e: unknown) => { blocked ||= e instanceof Error ? e.message : "un corte no pudo empezar"; });
      }
      const done = st.filter((x) => x === "done").length;
      if (blocked) {
        if (Date.now() - Date.parse(j.updatedAt) > 24 * 3600_000) throw new Error(`El anuncio quedó a medias: ${blocked}`);
        const paso = `En espera: ${blocked}`;
        return paso !== j.paso || failed.length ? { paso, reintentos } : {};
      }
      if (done === ids.length) return { estado: j.revisado ? "armando" : "revisando", paso: "Cortes listos", reintentos };
      if (Date.now() - Date.parse(j.updatedAt) > 3 * 3600_000 && !failed.length) throw new Error("La generación lleva más de 3 horas sin terminar.");
      const paso = `${done} de ${ids.length} cortes listos`;
      return failed.length || paso !== j.paso ? { paso, reintentos } : {}; // progress resets the 3-hour clock
    }
    if (j.estado === "revisando") {
      const r = await studio<{ results: { clipId: string; severe?: boolean; freeRedo?: boolean; redraw?: boolean; issues: string[] }[] }>("/api/review", { adId: j.adId }, 290_000);
      const todo = (r.results ?? []).filter((x) => x.severe && x.freeRedo);
      for (const x of todo) {
        // another product or other clothes: the opening frame had it, so the redo draws a new one
        await studio("/api/clips/fix", { id: x.clipId, problem: x.issues.join(". "), ...(x.redraw ? { redraw: true } : {}) }).catch(() => null);
        await studio("/api/clips/run", { id: x.clipId, free: true }).catch(() => null);
      }
      return todo.length ? { estado: "generando", revisado: true, paso: `Rehaciendo ${todo.length} corte(s) que la revisión encontró con errores` } : { estado: "armando", revisado: true, paso: "Revisión de calidad aprobada" };
    }
    if (j.estado === "armando") {
      const d = await studio<{ url: string }>("/api/montage", montageBody(j, sello), 290_000);
      return { estado: "listo", paso: "Video terminado", videoUrl: d.url };
    }
    return {};
  } catch (e) {
    return { estado: "error", error: (e instanceof Error ? e.message : "No se pudo seguir.").slice(0, 300) };
  }
}
