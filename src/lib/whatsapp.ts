// WhatsApp alerts to the owner (the Guardián and the CEO General use it for what can't wait). Two ways,
// whichever is configured in Vercel:
// - WhatsApp Cloud API (Meta, official): WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TO and an approved
//   template (WHATSAPP_TEMPLATE, default «alerta_creads», one text variable {{1}}, language WHATSAPP_LANG).
// - CallMeBot (free, for personal alerts): CALLMEBOT_PHONE (with country code) and CALLMEBOT_KEY.
// Alerts never carry customer data, keys or links other than the panel's.

const env = (k: string) => (process.env[k] ?? "").trim();

export function whatsappMode(): "meta" | "callmebot" | null {
  if (env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_ID") && env("WHATSAPP_TO")) return "meta";
  if (env("CALLMEBOT_PHONE") && env("CALLMEBOT_KEY")) return "callmebot";
  return null;
}

/** A template variable can't have line breaks, tabs or long runs of spaces, and has a length limit. */
export const oneLine = (t: string, max = 900) => t.replace(/[\r\n\t]+/g, " · ").replace(/ {2,}/g, " ").trim().slice(0, max);

/** Sends one WhatsApp to the owner. Never throws: returns whether it went out (and why not). */
export async function sendWhatsApp(text: string): Promise<{ ok: boolean; error?: string }> {
  const mode = whatsappMode();
  if (!mode) return { ok: false, error: "WhatsApp no está conectado." };
  try {
    if (mode === "meta") {
      const v = env("META_GRAPH_VERSION") || "v25.0";
      const res = await fetch(`https://graph.facebook.com/${v}/${env("WHATSAPP_PHONE_ID")}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "content-type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp", to: env("WHATSAPP_TO").replace(/\D/g, ""), type: "template",
          template: { name: env("WHATSAPP_TEMPLATE") || "alerta_creads", language: { code: env("WHATSAPP_LANG") || "es" }, components: [{ type: "body", parameters: [{ type: "text", text: oneLine(text) }] }] },
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        return { ok: false, error: `WhatsApp (Meta) respondió ${res.status}${d.error?.message ? `: ${d.error.message.slice(0, 160)}` : ""}` };
      }
      return { ok: true };
    }
    const url = new URL("https://api.callmebot.com/whatsapp.php");
    url.searchParams.set("phone", env("CALLMEBOT_PHONE"));
    url.searchParams.set("text", text.slice(0, 1000));
    url.searchParams.set("apikey", env("CALLMEBOT_KEY"));
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const body = await res.text().catch(() => "");
    if (!res.ok || /error|invalid|not/i.test(body.slice(0, 300)) && !/queued|sent/i.test(body)) return { ok: false, error: `CallMeBot no lo envió (${res.status}).` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? "WhatsApp no respondió a tiempo." : "No se pudo enviar el WhatsApp." };
  }
}
