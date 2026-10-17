// Transactional email through Resend (resend.com). Server-only.
// Sending never breaks the action that triggered it: without a key, or if Resend fails, the email is
// skipped and logged, and the sign-up / payment / reminder goes on as usual.

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Short label for Resend's dashboard (e.g. "bienvenida"). */
  tag?: string;
  /** Opt-out link for tips (adds the List-Unsubscribe header mail apps show as a button). */
  unsub?: string;
}

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY);

export async function sendEmail(e: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("email skipped (no RESEND_API_KEY)", e.tag ?? e.subject);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "Creads IA <hola@creadsia.com>",
        reply_to: "hola@creadsia.com",
        to: [e.to],
        subject: e.subject,
        html: e.html,
        text: e.text,
        ...(e.tag ? { tags: [{ name: "tipo", value: e.tag }] } : {}),
        ...(e.unsub ? { headers: { "List-Unsubscribe": `<${e.unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("email failed", e.tag ?? "", res.status, (await res.text().catch(() => "")).slice(0, 300));
      return false;
    }
    return true;
  } catch (err) {
    console.error("email failed", e.tag ?? "", err instanceof Error ? err.message : err);
    return false;
  }
}
