// The languages a video ad can be made in (owner, 25 Oct 2026):
// - "es-CL": Chilean Spanish; the script and texts may use Chilean expressions, the place looks like Chile.
// - "es": «español neutro», neutral Latin American Spanish with no regional slang; the accent comes from the
//   chosen voice (Mexican, Argentine, Colombian, Venezuelan, Chilean…).
// - "en": American English (affiliates selling in the US).
// Old jobs only have "es-CL" or "en", which keep meaning the same.

export type AdLang = "es-CL" | "es" | "en";
export const AD_LANGS: readonly AdLang[] = ["es-CL", "es", "en"];

/**
 * Reads a language sent by a caller. Other Spanish locales («es-MX», «es-419»…) are neutral Spanish (their
 * accent is the voice's job); «en-US» is English. Anything else gets the fallback.
 */
export function readLang(x: unknown, fallback: AdLang): AdLang {
  if (typeof x !== "string") return fallback;
  const v = x.trim();
  if (v === "es-CL" || v === "es-cl") return "es-CL";
  if (/^es([-_][A-Za-z0-9]{2,3})?$/i.test(v)) return "es";
  if (/^en([-_][A-Za-z]{2})?$/i.test(v)) return "en";
  return fallback;
}

export const isSpanish = (l: string) => l === "es" || l.startsWith("es-");

/** The language code the transcription (Whisper / ElevenLabs) and the word check (QA) use. */
export const sttLang = (l: string | undefined | null): "es" | "en" => (l && isSpanish(l) ? "es" : "en");

/** How the spoken text must sound, for prompts written in Spanish (cuts, scripts). */
export function spokenEs(l: AdLang): string {
  if (l === "es-CL") return "español de Chile, natural y hablado (chileno, sin exagerar modismos)";
  if (l === "es") return "español latino neutro, natural y hablado, tuteando, SIN modismos regionales (nada de chilenismos, argentinismos, mexicanismos ni de España: ni «po», «cachai», «al tiro», «bacán», «vos», «che», «güey», «chido», «vale», «tío»). Que lo entienda cualquier latinoamericano; el acento lo pone la voz";
  return "inglés hablado natural de EE. UU. (American English)";
}

/** The same, for prompts written in English (video and image models, the editor). */
export function spokenEn(l: AdLang): string {
  if (l === "es-CL") return "Chilean Spanish (español de Chile, natural Chilean accent and intonation)";
  if (l === "es") return "neutral Latin American Spanish (español neutro: clear, natural, no regional slang)";
  return "American English";
}

/** Where the video happens, for image and video prompts ("" = no hint). */
export function placeHint(l: AdLang): string {
  if (l === "es-CL") return "The place looks like Chile.";
  if (l === "es") return "The place looks Latin American (no country-specific flags, signs or landmarks).";
  return "";
}

/** The on-screen «dramatization» label in the ad's language. */
export const avisoText = (l: AdLang) => (l === "en" ? "Dramatization · AI actor" : "Dramatización · actor IA");

/** The ad's language in plain Spanish, for the customer. */
export const langLabel = (l: AdLang) => (l === "es-CL" ? "Español de Chile" : l === "es" ? "Español neutro" : "Inglés (EE. UU.)");
