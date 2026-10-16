import { db } from "./db";
import { textAI } from "./providers";
import { parseJSON } from "./providers/claude";

// Turns problems found by the review into short rules that every future prompt carries (prototype: learnFrom).
export async function learnFrom(issues: string[], format: string): Promise<number> {
  if (!issues.length || !textAI.configured()) return 0;
  const current = (await db.list("rules", "order=hits.desc&limit=60").catch(() => [])) as { id: string; rule_en: string; formats: string[] | null; hits: number }[];
  const r = parseJSON<{ nuevas?: { rule_en: string; es: string; formats: string[] }[]; repetidas?: number[] }>(
    await textAI.complete({
      json: true,
      prompt: `Eres el director técnico de un sistema que genera anuncios en video con IA (Veo, Kling, Seedance). En el último video (formato: ${format}) se encontraron estos problemas:
${issues.slice(0, 20).map((x) => `- ${x}`).join("\n")}
REGLAS QUE YA EXISTEN:
${current.map((x, i) => `${i + 1}. [${(x.formats ?? ["all"]).join(",")}] ${x.rule_en} (veces: ${x.hits})`).join("\n") || "(ninguna)"}
Convierte los problemas que sean VISUALES o de ACTUACIÓN y que se puedan PREVENIR con el prompt del video en reglas generales y cortas, en inglés imperativo, para agregar a todos los prompts futuros (ej: "Hands must have five normal fingers; avoid close-ups of hands holding small objects."). Ignora los problemas que son solo de transcripción o de un dato puntual.
Si un problema ya está cubierto por una regla existente, NO la dupliques: pon su número en "repetidas".
Responde SOLO JSON: {"nuevas":[{"rule_en":"","es":"en español, corta","formats":["all"] o ["ugc","ronda",...]}],"repetidas":[números]}`,
    }),
  );
  for (const n of r.repetidas ?? []) {
    const x = current[n - 1];
    if (x) await db.update("rules", x.id, { hits: (x.hits ?? 0) + 1 }).catch(() => {});
  }
  let added = 0;
  for (const x of (r.nuevas ?? []).filter((y) => y?.rule_en).slice(0, 5)) {
    await db.insert("rules", { rule_en: x.rule_en, rule_es: x.es, formats: x.formats?.length ? x.formats : ["all"], hits: 1, active: true }).catch(() => {});
    added++;
  }
  return added;
}
