import { claude } from "./providers/claude";

// Some video models only take short prompts (Kling: 2,500 characters). Our scene prompts carry the
// format rules, the product, learned lessons and reminders, so they can run longer. This shortens a
// prompt to fit while keeping every spoken word exactly as written.

/** Every quoted line (the dialogue): these must survive any shortening untouched. */
const quotes = (p: string) => [...p.matchAll(/"([^"]{3,})"/g)].map((m) => m[1]);
const keepsDialogue = (orig: string, short: string) => quotes(orig).every((q) => short.includes(q));

/** Cheap, predictable cuts first: repeated reminders, extra lessons, blank lines, filler. */
export function trimPrompt(p: string, max: number): string {
  const steps: ((s: string) => string)[] = [
    (s) => s.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(),
    // the closing reminder repeats the dialogue that's already at the top
    (s) => s.replace(/\n(Reminder|REMINDER):[^\n]*/g, ""),
    // keep only the first 4 learned lessons
    (s) => s.replace(/(LESSONS FROM PAST VIDEOS[^\n]*\n(?:- [^\n]*\n?){0,4})(?:- [^\n]*\n?)*/, "$1"),
    (s) => s.replace(/\n\n/g, "\n"),
    // drop the learned lessons altogether
    (s) => s.replace(/\nLESSONS FROM PAST VIDEOS[^\n]*(\n- [^\n]*)*/, ""),
  ];
  let s = p;
  for (const step of steps) {
    if (s.length <= max) break;
    s = step(s);
  }
  return s;
}

/**
 * Returns a prompt of at most `max` characters with the same dialogue. Uses Claude only when the
 * cheap cuts aren't enough; as a last resort keeps the start (where the dialogue is) and cuts the end.
 */
export async function fitPrompt(p: string, max: number): Promise<string> {
  if (p.length <= max) return p;
  const trimmed = trimPrompt(p, max);
  if (trimmed.length <= max) return trimmed;
  const target = Math.floor(max * 0.9);
  if (claude.configured()) {
    try {
      const short = (await claude.complete({
        system: "You shorten prompts for AI video models. Output only the shortened prompt, nothing else.",
        prompt: `Shorten this video prompt to at most ${target} characters. Rules:
- Keep every quoted line (the words people say) EXACTLY as written, every word, same order.
- Keep who speaks, the setting, the shot, the language and accent, the product description, and "no subtitles / no on-screen text / no music".
- Remove repetition and filler first. Keep it as plain instructions in English.

PROMPT:
${trimmed}`,
      })).trim();
      if (short.length <= max && keepsDialogue(p, short)) return short;
    } catch {
      // fall through to the plain cut
    }
  }
  const cut = trimmed.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf("\n"), Math.floor(max * 0.8)));
}

/** The character limit in an "at most N characters" refusal, if that's what it is. */
export function promptLimitFrom(msg: string): number | null {
  const m = /at most (\d+) characters/i.exec(msg);
  return m ? Number(m[1]) : null;
}
