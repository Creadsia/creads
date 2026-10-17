import type { Email } from "./providers/email";

// The emails Creads sends, in Chilean Spanish. Plain table layout so they look right in Gmail,
// Outlook and phones; every email also has a plain-text version.

export const SITE = (process.env.SITE_URL || "https://www.creadsia.com").replace(/\/$/, "");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const first = (name: string | null | undefined) => (name || "").trim().split(/\s+/)[0] || "";
const hello = (name: string | null | undefined) => (first(name) ? `Hola ${first(name)},` : "Hola,");
const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

function layout(o: { preview: string; title: string; paragraphs: string[]; cta?: { label: string; href: string }; after?: string[]; rows?: [string, string][] }) {
  const p = (t: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#3b3754">${t}</p>`;
  const rows = o.rows?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 18px;border:1px solid #e7e4f2;border-radius:12px;border-collapse:separate">${o.rows
        .map(([k, v], i) => `<tr><td style="padding:10px 14px;font-size:14px;color:#6b6785;${i ? "border-top:1px solid #e7e4f2;" : ""}">${esc(k)}</td><td align="right" style="padding:10px 14px;font-size:14px;font-weight:700;color:#1d1a2e;${i ? "border-top:1px solid #e7e4f2;" : ""}">${esc(v)}</td></tr>`)
        .join("")}</table>`
    : "";
  const cta = o.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 20px"><tr><td style="border-radius:10px;background:#7c3aed;background-image:linear-gradient(90deg,#d946ef,#7c3aed)"><a href="${esc(o.cta.href)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${esc(o.cta.label)}</a></td></tr></table>`
    : "";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f3f8">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(o.preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f8;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
<tr><td style="padding:0 4px 16px;font-size:20px;font-weight:800;color:#1d1a2e;letter-spacing:-0.3px">creads <span style="font-size:12px;color:#ffffff;background:#7c3aed;border-radius:5px;padding:2px 5px;vertical-align:3px">IA</span></td></tr>
<tr><td style="background:#ffffff;border-radius:16px;padding:28px 24px;border:1px solid #e7e4f2">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#1d1a2e">${esc(o.title)}</h1>
${o.paragraphs.map(p).join("")}${rows}${cta}${(o.after ?? []).map(p).join("")}
</td></tr>
<tr><td style="padding:16px 4px;font-size:12px;line-height:1.5;color:#8a86a3">Creads IA · creadsia.com · ¿Dudas? Responde este correo o escríbenos a hola@creadsia.com.</td></tr>
</table></td></tr></table></body></html>`;
}

const plain = (lines: (string | false | undefined)[]) => [...lines.filter(Boolean), "", "Creads IA · creadsia.com · hola@creadsia.com"].join("\n");

export function welcomeEmail(to: string, name: string | null): Email {
  const link = `${SITE}/app`;
  return {
    to, tag: "bienvenida",
    subject: "Bienvenido a Creads IA",
    html: layout({
      preview: "Tu cuenta está lista. Así haces tu primer anuncio.",
      title: "Tu cuenta está lista",
      paragraphs: [
        esc(hello(name)),
        "Gracias por crear tu cuenta en Creads IA. Desde ahora puedes convertir un guion ganador en anuncios de video terminados: cortes, video con IA, voz, subtítulos y revisión de calidad automática.",
        "<b>Tu primer anuncio en 3 pasos:</b><br>1. Entra a <b>Crear anuncio</b> y pega tu guion.<br>2. Elige el formato y el avatar.<br>3. Revisa los cortes y presiona <b>Generar</b>.",
      ],
      cta: { label: "Entrar a Creads", href: link },
      after: ["Para generar necesitas un plan activo. Si tienes cualquier duda, responde este correo y te ayudamos."],
    }),
    text: plain([hello(name), "", "Tu cuenta en Creads IA está lista.", "", "Tu primer anuncio en 3 pasos:", "1. Entra a Crear anuncio y pega tu guion.", "2. Elige el formato y el avatar.", "3. Revisa los cortes y presiona Generar.", "", `Entrar: ${link}`]),
  };
}

export function receiptEmail(to: string, o: { label: string; credits: number; amount: number; currency: string; orderId: string; paymentId: string }): Email {
  const link = `${SITE}/app`;
  const amount = o.currency === "CLP" ? clp(o.amount) : `US$${o.amount.toFixed(2)}`;
  const rows: [string, string][] = [["Compra", o.label], ["Créditos agregados", o.credits.toLocaleString("es-CL")], ["Total pagado", amount], ["N° de pedido", o.orderId]];
  return {
    to, tag: "pago",
    subject: `Pago recibido · ${o.credits.toLocaleString("es-CL")} créditos en tu cuenta`,
    html: layout({
      preview: `Recibimos tu pago de ${amount}. Tus créditos ya están disponibles.`,
      title: "Recibimos tu pago",
      paragraphs: ["Hola,", "Tu pago se confirmó y los créditos ya están en tu cuenta. Puedes empezar a crear al tiro."],
      rows,
      cta: { label: "Crear un anuncio", href: `${link}/crear` },
      after: [`Este correo confirma tu pago (pago ${esc(o.paymentId)} en Mercado Pago); no reemplaza la boleta. Si necesitas ayuda con un cobro, responde este correo con el número de pedido.`],
    }),
    text: plain(["Hola,", "", "Recibimos tu pago y los créditos ya están en tu cuenta.", "", ...rows.map(([k, v]) => `${k}: ${v}`), `Pago en Mercado Pago: ${o.paymentId}`, "", `Crear un anuncio: ${link}/crear`]),
  };
}

export function resetEmail(to: string, name: string | null, link: string): Email {
  return {
    to, tag: "clave",
    subject: "Cambia tu clave de Creads IA",
    html: layout({
      preview: "Usa este enlace para elegir una clave nueva. Vence en 1 hora.",
      title: "Cambia tu clave",
      paragraphs: [esc(hello(name)), "Alguien (ojalá tú) pidió cambiar la clave de tu cuenta de Creads IA. Presiona el botón para elegir una nueva."],
      cta: { label: "Elegir clave nueva", href: link },
      after: ["El enlace vence en 1 hora y sirve una sola vez.", "<b>¿No fuiste tú?</b> Ignora este correo: tu clave sigue igual y nadie puede entrar sin ella."],
    }),
    text: plain([hello(name), "", "Pediste cambiar la clave de tu cuenta de Creads IA. Abre este enlace para elegir una nueva (vence en 1 hora y sirve una sola vez):", link, "", "¿No fuiste tú? Ignora este correo: tu clave sigue igual."]),
  };
}

export function planEndingEmail(to: string, name: string | null, o: { plan: string | null; until: string; daysLeft: number; credits: number | null }): Email {
  const link = `${SITE}/app/planes`;
  const when = o.daysLeft <= 0 ? "hoy" : o.daysLeft === 1 ? "mañana" : `en ${o.daysLeft} días`;
  const plan = o.plan ? `Tu plan ${o.plan}` : "Tu plan";
  const left = o.credits && o.credits > 0 ? `Te quedan ${o.credits.toLocaleString("es-CL")} créditos: renueva para seguir usándolos sin pausa.` : "Renueva para seguir generando sin pausa.";
  return {
    to, tag: o.daysLeft <= 0 ? "plan-vence-hoy" : "plan-por-vencer",
    subject: o.daysLeft <= 0 ? `${plan} vence hoy` : `${plan} vence ${when}`,
    html: layout({
      preview: `${plan} vence el ${longDate(o.until)}.`,
      title: o.daysLeft <= 0 ? `${plan} vence hoy` : `${plan} vence ${when}`,
      paragraphs: [esc(hello(name)), `${esc(plan)} está vigente hasta el <b>${esc(longDate(o.until))}</b>. ${esc(left)}`, "Tus anuncios, avatares y voces quedan guardados aunque el plan venza."],
      cta: { label: "Renovar mi plan", href: link },
    }),
    text: plain([hello(name), "", `${plan} está vigente hasta el ${longDate(o.until)}. ${left}`, "Tus anuncios, avatares y voces quedan guardados aunque el plan venza.", "", `Renovar: ${link}`]),
  };
}
