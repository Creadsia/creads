import { randomBytes } from "node:crypto";
import { logLater } from "./errlog";

// What a customer may read when something fails. Customers see Creads, never the services behind it:
// no provider names, keys, balances, status codes or English error text. Our own Spanish messages pass
// through; anything technical becomes a calm Spanish message with a short reference that matches the
// full error in the server logs (so the owner can find it).

const OUT_OF_FUNDS = /exhausted balance|user is locked|insufficient[_ ]?(balance|credits|funds)|top up|quota_exceeded|exceeds your quota|credit balance is too low|billing|prepa(id|yment)|sin saldo|se quedó sin saldo|rechazó un trabajo por falta de saldo/i;
const SAFETY = /safety|moderation|content[_ ]?policy|policy violation|nsfw|flagged|prohibited|not allowed to generate|sensitive content|celebrity|public figure|no aceptó (este|el) contenido/i;
const TIMEOUT = /time(d)? ?out|timeout|deadline exceeded|ETIMEDOUT|aborted/i;
const TECHNICAL = new RegExp(
  [
    String.raw`fal\.ai|\bfal\b|vercel|supabase|anthropic|\bclaude\b|elevenlabs|eleven ?labs|gemini|\bgoogle\b|bytedance|openai|resend|amazon|aws`,
    String.raw`\b[A-Z][A-Z0-9]{2,}_[A-Z0-9_]{2,}\b`, // env var names (FAL_KEY…)
    String.raw`\b(status|http)\s*\d{3}\b|\b(401|403|404|408|422|429|500|502|503|504)\b(?!\s*(créditos|segundos|caracteres|s\b))`,
    String.raw`\b(error|failed|failure|invalid|unauthori[sz]ed|forbidden|not found|internal|exception|undefined|null|request|response|fetch|socket|ECONN\w*|ENOTFOUND|rate.?limit|bad gateway|service unavailable|unexpected|cannot|could not|unable)\b`,
    String.raw`[{}<>]|https?://`,
  ].join("|"),
  "i",
);

export const UNAVAILABLE = "Este modelo no está disponible en este momento. Prueba con otro modelo o vuelve a intentar en un rato.";
export const FEATURE_UNAVAILABLE = "Esta función no está disponible en este momento. Vuelve a intentar en unos minutos.";
export const REFUSED = "El modelo no aceptó este contenido (por ejemplo, un rostro real, una marca o un tema sensible). Ajusta el texto o la imagen, o prueba con otro modelo.";
export const SLOW = "El modelo tardó demasiado en responder. Vuelve a intentarlo en un momento.";

/** The customer-safe version of an error text (`fallback` is what was being done, in Spanish). */
export function customerText(raw: string, fallback = "No se pudo completar."): string {
  const msg = String(raw ?? "").trim();
  if (!msg) return fallback;
  if (OUT_OF_FUNDS.test(msg)) return UNAVAILABLE;
  if (SAFETY.test(msg)) return REFUSED;
  if (!TECHNICAL.test(msg)) return msg.slice(0, 400);
  if (TIMEOUT.test(msg)) return SLOW;
  const ref = randomBytes(3).toString("hex").toUpperCase();
  console.error(`[ref ${ref}]`, msg.slice(0, 1000));
  logLater({ area: "servidor", message: msg, ref });
  return `${fallback.replace(/\.?$/, ".")} Vuelve a intentarlo en un momento; si se repite, escríbenos a hola@creadsia.com con el código ${ref}.`;
}

/** customerText for a caught error. */
export const publicError = (err: unknown, fallback: string) => customerText(err instanceof Error ? err.message : typeof err === "string" ? err : "", fallback);

/**
 * Like customerText but silent (no log line, no reference): for showing a customer's past errors again,
 * e.g. to the in-app assistant. Technical text becomes a short generic sentence.
 */
export function quietCustomerText(raw: string | null | undefined): string {
  const msg = String(raw ?? "").trim();
  if (!msg) return "";
  if (OUT_OF_FUNDS.test(msg)) return UNAVAILABLE;
  if (SAFETY.test(msg)) return REFUSED;
  if (TIMEOUT.test(msg)) return SLOW;
  // our own Spanish messages may carry our email and a reference code: those are fine
  return TECHNICAL.test(msg.replace(/hola@creadsia\.com|c[oó]digo [A-F0-9]{6}/gi, "")) ? "Falló por un problema técnico pasajero." : msg.slice(0, 300);
}

/** Words a customer must never read in our own texts (services behind Creads). */
export const VENDOR_WORDS = /\b(fal\.ai|fal|anthropic|claude|openai|chatgpt|gpt-?\d*|elevenlabs|eleven ?labs|vercel|supabase|resend|bytedance|google|gemini|mindicador)\b/gi;
