// WhatsApp alerts to the owner (the Guardián and the CEO General use it for what can't wait). Two ways,
// whichever is configured in Vercel:
// - WhatsApp Cloud API (Meta, official): WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_TO and an approved
//   template (WHATSAPP_TEMPLATE, default «alerta_creads», one text variable {{1}}, language WHATSAPP_LANG).
// - CallMeBot (free, for personal alerts): CALLMEBOT_PHONE (with country code) and CALLMEBOT_KEY.
// - Telegram (free, instant): TELEGRAM_BOT_TOKEN from @BotFather. The owner sends /start to the bot and
//   presses «Mandarme uno de prueba» in the Guardián: that links his chat (or TELEGRAM_CHAT_ID if set).
// Alerts never carry customer data, keys or links other than the panel's.
import { readPrivateJSON, writePrivateJSON } from "./supabase";

const env = (k: string) => (process.env[k] ?? "").trim();

export type AlertMode = "meta" | "callmebot" | "telegram";
export function whatsappMode(): AlertMode | null {
  if (env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_ID") && env("WHATSAPP_TO")) return "meta";
  if (env("TELEGRAM_BOT_TOKEN")) return "telegram";
  if (env("CALLMEBOT_PHONE") && env("CALLMEBOT_KEY")) return "callmebot";
  return null;
}
export const ALERT_APP: Record<AlertMode, string> = { meta: "WhatsApp", callmebot: "WhatsApp", telegram: "Telegram" };

// ---------------------------------------------------------------- Telegram

const TG_FILE = "guardian/telegram.json";
interface TgLink { chatId: string; name: string; at: string }
const tg = async <T>(method: string, body?: unknown): Promise<T> => {
  const res = await fetch(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/${method}`, {
    method: body ? "POST" : "GET", headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15_000),
  });
  const d = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
  if (!d.ok) throw new Error(res.status === 401 || res.status === 404 ? "Telegram rechazó la clave del bot: revisa TELEGRAM_BOT_TOKEN en Vercel." : `Telegram respondió ${res.status}${d.description ? `: ${d.description.slice(0, 120)}` : ""}`);
  return d.result as T;
};
async function telegramChat(): Promise<string | null> {
  if (env("TELEGRAM_CHAT_ID")) return env("TELEGRAM_CHAT_ID");
  return (await readPrivateJSON<TgLink>(TG_FILE).catch(() => null))?.chatId ?? null;
}
/** Links the owner's chat: the latest private «/start» sent to the bot. Only called from the owner's panel. */
export async function linkTelegram(): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (whatsappMode() !== "telegram") return { ok: false, error: "Telegram no está conectado." };
  if (env("TELEGRAM_CHAT_ID")) return { ok: true };
  try {
    const ups = await tg<{ message?: { text?: string; date: number; chat: { id: number; type: string; first_name?: string; username?: string } } }[]>("getUpdates");
    const m = ups.map((u) => u.message).filter((x) => x && x.chat.type === "private" && /^\/start\b/.test(x.text ?? "")).sort((a, b) => b!.date - a!.date)[0];
    if (!m) {
      if (await telegramChat()) return { ok: true };
      return { ok: false, error: "Primero abre tu bot en Telegram y apriétale «Iniciar» (o escríbele /start). Después vuelve a probar." };
    }
    const name = m.chat.username ? `@${m.chat.username}` : (m.chat.first_name ?? "tu Telegram");
    await writePrivateJSON(TG_FILE, { chatId: String(m.chat.id), name, at: new Date().toISOString() } satisfies TgLink);
    return { ok: true, name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "No se pudo leer Telegram." };
  }
}

/** A template variable can't have line breaks, tabs or long runs of spaces, and has a length limit. */
export const oneLine = (t: string, max = 900) => t.replace(/[\r\n\t]+/g, " · ").replace(/ {2,}/g, " ").trim().slice(0, max);

/** Sends one WhatsApp to the owner. Never throws: returns whether it went out (and why not). */
export async function sendWhatsApp(text: string): Promise<{ ok: boolean; error?: string }> {
  const mode = whatsappMode();
  if (!mode) return { ok: false, error: "WhatsApp no está conectado." };
  try {
    if (mode === "telegram") {
      const chat = await telegramChat();
      if (!chat) return { ok: false, error: "Falta enlazar tu Telegram: escríbele /start a tu bot y aprieta «Mandarme uno de prueba» en el Guardián." };
      await tg("sendMessage", { chat_id: chat, text: text.slice(0, 3500), disable_web_page_preview: true });
      return { ok: true };
    }
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
    if (mode === "telegram" && e instanceof Error && e.name !== "TimeoutError") return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error && e.name === "TimeoutError" ? `${ALERT_APP[mode]} no respondió a tiempo.` : `No se pudo enviar el ${ALERT_APP[mode]}.` };
  }
}
