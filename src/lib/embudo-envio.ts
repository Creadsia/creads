import { type Embudo, SITE, embudoEmail } from "./emails";
import { once } from "./marketing";
import { emailConfigured, sendEmail } from "./providers/email";
import { optedOut, unsubLink } from "./unsub";

// Sends one behaviour email (lib/emails.ts EMBUDO) at most once per key, never to people who opted out of
// tips, always with the opt-out line. Server-only. Callers check CORREOS_COMPORTAMIENTO=1 first.

export const correosComportamiento = () => process.env.CORREOS_COMPORTAMIENTO === "1";

export async function enviarEmbudo(u: { email: string; name: string | null }, tipo: Embudo, key: string, o: { vars?: Record<string, string>; bajas?: Set<string> } = {}): Promise<boolean> {
  if (!emailConfigured()) return false; // without Resend nothing is marked as sent
  const bajas = o.bajas ?? (await optedOut());
  if (bajas.has(u.email.toLowerCase())) return false;
  if (!(await once(`embudo:${tipo}:${key}`, 400 * 86400))) return false; // already sent
  return sendEmail(embudoEmail(u.email, u.name, tipo, unsubLink(SITE, u.email), o.vars));
}
