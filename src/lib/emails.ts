import type { Email } from "./providers/email";
import { fmtCredits, fmtSeconds, secondsOf } from "./credit-math";
import { modoPack } from "./oferta";

// The emails Creads sends, in Chilean Spanish. Plain table layout so they look right in Gmail,
// Outlook and phones; every email also has a plain-text version.

export const SITE = (process.env.SITE_URL || "https://www.creadsia.com").replace(/\/$/, "");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const first = (name: string | null | undefined) => (name || "").trim().split(/\s+/)[0] || "";
const hello = (name: string | null | undefined) => (first(name) ? `Hola ${first(name)},` : "Hola,");
const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });

function layout(o: { preview: string; title: string; paragraphs: string[]; cta?: { label: string; href: string }; after?: string[]; rows?: [string, string][]; unsub?: string }) {
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
<tr><td style="padding:16px 4px;font-size:12px;line-height:1.5;color:#8a86a3">Creads IA · creadsia.com · ¿Dudas? Responde este correo o escríbenos a hola@creadsia.com.${o.unsub ? `<br><a href="${esc(o.unsub)}" style="color:#8a86a3">No quiero recibir más consejos</a>` : ""}</td></tr>
</table></td></tr></table></body></html>`;
}

/** HTML fragment → plain text (for the text version of an email). */
const unhtml = (t: string) => t.replace(/<br>/g, "\n").replace(/<[^>]+>/g, "").replace(/&(amp|lt|gt|quot|#39);/g, (m) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'" })[m]!);

const plain = (lines: (string | false | undefined)[]) => [...lines.filter(Boolean), "", "Creads IA · creadsia.com · hola@creadsia.com"].join("\n");

export function welcomeEmail(to: string, name: string | null, regalo?: string | null, cargado = false, prueba?: { dias: number; plan: string; usd?: number; credits?: number; regalo?: number } | null): Email {
  const link = `${SITE}/app`;
  // Pack Prueba (25 Oct 2026, back only with MODO_PACK=1): no gift; the first batch is US$9
  if (modoPack() && !cargado) {
    return {
      to, tag: "bienvenida",
      subject: "Bienvenido a Creads: tu primera tanda de anuncios",
      html: layout({
        preview: "Pega el link de tu producto y Creads propone 6 ángulos de venta.",
        title: "Testea 70 anuncios al mes, no 3",
        paragraphs: [
          esc(hello(name)),
          "Gracias por crear tu cuenta. Empieza por tu primera tanda: pega el link de tu producto, Creads lee tu página y te propone 6 ángulos de venta. Eso no tiene costo.",
          "Cuando elijas los ángulos, creas 10 anuncios en 4:5 y 9:16 con el Pack Prueba de US$9 (hasta 12 imágenes o 1 video con avatar). Si después te suscribes dentro de 7 días, esos US$9 se descuentan de tu primer mes.",
        ],
        cta: { label: "Hacer mi primera tanda", href: `${link}/tanda` },
        after: ["Si tienes cualquier duda, responde este correo: lo lee una persona."],
      }),
      text: plain([hello(name), "", "Pega el link de tu producto y Creads te propone 6 ángulos de venta (sin costo).", "Crea 10 anuncios con el Pack Prueba de US$9. Si te suscribes dentro de 7 días, se descuenta de tu primer mes.", "", `Hacer mi primera tanda: ${link}/tanda`]),
    };
  }
  // «prueba con tarjeta» (required at sign-up since 26 Oct 2026): the gift loads once the card is added (nothing
  // charged today); the plan, price and credits come from the trial plan (lib/prueba.ts resumenPrueba)
  if (prueba && !cargado) {
    const gift = prueba.regalo ?? 200;
    const precio = prueba.usd ? ` (US$${prueba.usd.toLocaleString("es-CL")} al mes${prueba.credits ? `, ${prueba.credits.toLocaleString("es-CL")} créditos cada mes` : ""})` : "";
    return {
      to, tag: "bienvenida",
      subject: `Último paso: activa tu prueba gratis de ${prueba.dias} días en Creads IA`,
      html: layout({
        preview: `Agrega tu tarjeta (hoy no se cobra nada) y recibe ${gift} créditos de regalo.`,
        title: "Te falta un paso: agregar tu tarjeta",
        paragraphs: [
          esc(hello(name)),
          `Gracias por crear tu cuenta en Creads IA. Para entrar al estudio y recibir tus <b>${gift} créditos de regalo</b>, agrega tu tarjeta en la ventana segura de Mercado Pago. <b>Hoy no se cobra nada</b>: tienes ${prueba.dias} días gratis.`,
          `Si te gusta, al terminar la prueba sigues con el plan ${esc(prueba.plan)}${esc(precio)}. Si no, lo cancelas antes en «Planes» con un clic y no pagas nada.`,
        ],
        cta: { label: "Agregar mi tarjeta y empezar", href: `${link}/automatico` },
        after: ["Creads nunca ve tu tarjeta: la guarda Mercado Pago. Si tienes cualquier duda, responde este correo."],
      }),
      text: plain([hello(name), "", `Agrega tu tarjeta (hoy no se cobra nada) y recibe ${gift} créditos de regalo: tienes ${prueba.dias} días gratis.`, `Si no cancelas antes, sigues con el plan ${prueba.plan}${precio}.`, "", `Agregar tarjeta: ${link}/automatico`]),
    };
  }
  // the gift is already in the account: straight to Automático
  if (cargado) {
    return {
      to, tag: "bienvenida",
      subject: "Tu primer anuncio de regalo ya está cargado",
      html: layout({
        preview: "Entra a Automático, cuéntale qué vendes y en minutos tienes tu anuncio.",
        title: "Tu primer anuncio va por nuestra cuenta",
        paragraphs: [
          esc(hello(name)),
          "Gracias por crear tu cuenta en Creads IA. Ya te cargamos 200 créditos de regalo para tu primer anuncio en video (unos 12 segundos, con una persona hablando de tu negocio), sin tarjeta.",
          "Entra a <b>Automático</b>, cuéntale qué vendes y a quién, y Creads te hace el guion, la persona, el video y la revisión.",
        ],
        cta: { label: "Hacer mi anuncio de regalo", href: `${link}/automatico` },
        after: ["También puedes espiar anuncios de tu competencia y crear guiones gratis. Si tienes cualquier duda, responde este correo."],
      }),
      text: plain([hello(name), "", "Ya te cargamos créditos para tu primer anuncio en video, gratis y sin tarjeta.", "", `Hacer mi anuncio: ${link}/automatico`]),
    };
  }
  // a new account that hasn't paid: the button confirms the email and gives the first ad as a gift
  if (regalo) {
    return {
      to, tag: "bienvenida",
      subject: "Confirma tu correo y recibe tu primer anuncio de regalo",
      html: layout({
        preview: "Un clic y tienes créditos para tu primer anuncio en video, gratis.",
        title: "Tu primer anuncio va por nuestra cuenta",
        paragraphs: [
          esc(hello(name)),
          "Gracias por crear tu cuenta en Creads IA. Confirma tu correo con el botón y te cargamos créditos para tu primer anuncio en video (unos 12 segundos, con una persona hablando de tu negocio), sin tarjeta.",
          "Después entra a <b>Automático</b>, cuéntale qué vendes y Creads te hace el guion, la persona, el video y la revisión.",
        ],
        cta: { label: "Confirmar y recibir mi anuncio", href: regalo },
        after: ["Mientras tanto ya puedes espiar anuncios de tu competencia y crear guiones gratis. Si tienes cualquier duda, responde este correo."],
      }),
      text: plain([hello(name), "", "Confirma tu correo y te cargamos créditos para tu primer anuncio en video, gratis y sin tarjeta.", "", `Confirmar: ${regalo}`]),
    };
  }
  return {
    to, tag: "bienvenida",
    subject: "Bienvenido a Creads IA",
    html: layout({
      preview: "Tu cuenta está lista. Así haces tu primer anuncio.",
      title: "Tu cuenta está lista",
      paragraphs: [
        esc(hello(name)),
        "Gracias por crear tu cuenta en Creads IA. Desde ahora puedes tener anuncios en video con una persona hablando de tu negocio, sin grabar ni editar, más imágenes para tus anuncios.",
        "<b>La forma más fácil:</b> entra a <b>Automático</b> y cuéntale a Creads qué vendes. Te hace las preguntas necesarias, te propone el guion, crea a la persona, hace el video, lo revisa y te lo entrega listo para publicar.",
      ],
      cta: { label: "Hacer mi primer anuncio", href: `${link}/automatico` },
      after: ["Para generar necesitas un plan activo. Si tienes cualquier duda, responde este correo y te ayudamos."],
    }),
    text: plain([hello(name), "", "Tu cuenta en Creads IA está lista.", "", "La forma más fácil: entra a Automático y cuéntale a Creads qué vendes. Te propone el guion, crea a la persona, hace el video, lo revisa y te lo entrega listo.", "", `Hacer mi primer anuncio: ${link}/automatico`]),
  };
}

/** To the owner, on every approved payment (owner, 22 Oct 2026: «¿cómo me avisan cuando caiga un suscriptor?»). */
export function ownerSaleEmail(to: string, o: { label: string; amount: number; currency: string; customer: string; account: string; renewal: boolean; orderId: string }): Email {
  const amount = o.currency === "CLP" ? clp(o.amount) : `US$${o.amount.toFixed(2)}`;
  const kind = o.renewal ? "Renovación" : "Nueva venta";
  const rows: [string, string][] = [["Qué compró", o.label], ["Monto", amount], ["Cliente", o.customer || "—"], ["Cuenta", o.account || "—"], ["Pedido", o.orderId]];
  return {
    to, tag: "venta",
    subject: `💰 ${kind}: ${o.label} · ${amount}`,
    html: layout({
      preview: `${o.customer || "Un cliente"} pagó ${amount}.`,
      title: o.renewal ? "Se renovó un plan" : "¡Cayó una venta!",
      paragraphs: [o.renewal ? "Mercado Pago cobró la renovación mensual de este cliente." : "Un cliente acaba de pagar. Su saldo ya está cargado y le llegó el comprobante."],
      rows,
      cta: { label: "Ver en el Panel", href: `${SITE}/admin` },
    }),
    text: plain([`${kind}`, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", `Panel: ${SITE}/admin`]),
  };
}

/** To the owner, when a customer turns off their monthly renewal. */
export function ownerCancelEmail(to: string, o: { customer: string; plan: string | null; until: string | null; reason?: string }): Email {
  const rows: [string, string][] = [["Cliente", o.customer], ["Plan", o.plan ?? "—"], ["Sigue activo hasta", o.until ?? "—"], ...(o.reason ? [["Motivo", o.reason] as [string, string]] : [])];
  return {
    to, tag: "venta",
    subject: `Un cliente canceló la renovación · ${o.plan ?? "plan"}`,
    html: layout({ preview: `${o.customer} canceló la renovación.`, title: "Canceló la renovación", paragraphs: ["Este cliente apagó la renovación automática. Su plan sigue hasta la fecha pagada: es buen momento para escribirle."], rows, cta: { label: "Ver en el Panel", href: `${SITE}/admin` } }),
    text: plain(["Canceló la renovación", "", ...rows.map(([k, v]) => `${k}: ${v}`)]),
  };
}

export function receiptEmail(to: string, o: { label: string; credits: number; amount: number; currency: string; orderId: string; paymentId: string }): Email {
  const link = `${SITE}/app`;
  const amount = o.currency === "CLP" ? clp(o.amount) : `US$${o.amount.toFixed(2)}`;
  const secs = fmtCredits(o.credits);
  const rows: [string, string][] = [["Compra", o.label], ["Créditos agregados a tu saldo", secs], ["Total pagado", amount], ["N° de pedido", o.orderId]];
  return {
    to, tag: "pago",
    subject: `Pago recibido · ${secs} en tu cuenta`,
    html: layout({
      preview: `Recibimos tu pago de ${amount}. Tu saldo ya está disponible.`,
      title: "Recibimos tu pago",
      paragraphs: ["Hola,", "Tu pago se confirmó y el saldo ya está en tu cuenta. Puedes empezar a crear al tiro."],
      rows,
      cta: { label: "Hacer un anuncio", href: `${link}/automatico` },
      after: [`Este correo confirma tu pago (pago ${esc(o.paymentId)} en Mercado Pago); no reemplaza la boleta. Si necesitas ayuda con un cobro, responde este correo con el número de pedido.`],
    }),
    text: plain(["Hola,", "", "Recibimos tu pago y el saldo ya está en tu cuenta.", "", ...rows.map(([k, v]) => `${k}: ${v}`), `Pago en Mercado Pago: ${o.paymentId}`, "", `Hacer un anuncio: ${link}/automatico`]),
  };
}

/** The customer stopped the renewal: what happens now, in one look (no guilt, an easy way back). */
export function cancelEmail(to: string, name: string | null, o: { plan: string | null; until: string | null }): Email {
  const plan = o.plan ? `tu plan ${o.plan}` : "tu plan";
  const until = o.until ? longDate(o.until) : null;
  const line = until ? `Cancelaste la renovación de ${plan}. Lo sigues usando hasta el <b>${esc(until)}</b> y después no se te cobra nada más.` : `Cancelaste la renovación de ${plan}. No se te cobra nada más.`;
  return {
    to, tag: "cancelacion",
    subject: "Cancelaste la renovación de tu plan",
    html: layout({
      preview: until ? `Sigues con tu plan hasta el ${until}.` : "No se te cobra nada más.",
      title: "Listo, no se renueva",
      paragraphs: [esc(hello(name)), line, "Tus anuncios, avatares y voces quedan guardados. Si cambias de idea, vuelves a activarlo con un clic."],
      cta: { label: "Ver mi plan", href: `${SITE}/app/planes` },
      after: ["¿Algo no funcionó como esperabas? Responde este correo: lo leemos nosotros y nos ayuda a mejorar."],
    }),
    text: plain([hello(name), "", line.replace(/<\/?b>/g, ""), "Tus anuncios, avatares y voces quedan guardados. Si cambias de idea, vuelves a activarlo con un clic.", "", `Ver mi plan: ${SITE}/app/planes`]),
  };
}

/** Mercado Pago couldn't charge the monthly renewal: tell the customer before the plan lapses. */
export function renewalFailedEmail(to: string, name: string | null, o: { plan: string | null }): Email {
  const plan = o.plan ? `tu plan ${o.plan}` : "tu plan";
  return {
    to, tag: "renovacion-rechazada",
    subject: "No pudimos renovar tu plan",
    html: layout({
      preview: "Revisa tu tarjeta en Mercado Pago para no perder tu saldo.",
      title: "No pudimos renovar tu plan",
      paragraphs: [esc(hello(name)), `Mercado Pago no pudo cobrar la renovación de ${esc(plan)}. Suele pasar por una tarjeta vencida, sin cupo o bloqueada para compras en línea.`, "Mercado Pago lo vuelve a intentar en los próximos días. Para que no se corte, revisa tu tarjeta en Mercado Pago o actualízala desde tu plan en Creads."],
      cta: { label: "Revisar mi plan", href: `${SITE}/app/planes` },
      after: ["¿Necesitas ayuda? Responde este correo."],
    }),
    text: plain([hello(name), "", `Mercado Pago no pudo cobrar la renovación de ${plan} (tarjeta vencida, sin cupo o bloqueada para compras en línea).`, "Lo vuelve a intentar en los próximos días. Revisa tu tarjeta o actualízala desde tu plan.", "", `Revisar mi plan: ${SITE}/app/planes`]),
  };
}

/** Affiliate program: the application was approved; their link and code. */
export function affiliateApprovedEmail(to: string, name: string | null, code: string): Email {
  const link = `${SITE}/?ref=${encodeURIComponent(code)}`;
  return {
    to, tag: "afiliado-aprobado",
    subject: "Ya eres afiliado de Creads",
    html: layout({
      preview: "Tu enlace y tu código ya funcionan.",
      title: "Ya eres afiliado de Creads",
      paragraphs: [esc(hello(name)), "Aprobamos tu postulación al programa de afiliados. Desde ahora, quien entre por tu enlace o escriba tu código al crear su cuenta queda asociado a ti."],
      rows: [["Tu enlace", link], ["Tu código", code]],
      cta: { label: "Ver mi panel de afiliado", href: `${SITE}/app/afiliados` },
      after: ["En tu panel completa tus datos de pago (PayPal, Wise o transferencia). Antes de compartir tu enlace, lee los términos del programa: " + `${SITE}/afiliados/terminos`],
    }),
    text: plain([hello(name), "", "Aprobamos tu postulación al programa de afiliados de Creads.", `Tu enlace: ${link}`, `Tu código: ${code}`, "", `Tu panel: ${SITE}/app/afiliados`, `Términos: ${SITE}/afiliados/terminos`]),
  };
}

/** The balance is about to run out (less than one ad left): a heads-up before a job is refused. */
export function lowBalanceEmail(to: string, name: string | null, o: { seconds: number; credits?: number; until: string | null }): Email {
  const left = o.credits != null ? fmtCredits(o.credits) : fmtSeconds(Math.max(0, Math.floor(o.seconds)));
  const renew = o.until ? ` Tu plan se renueva el ${longDate(o.until)} con saldo nuevo.` : "";
  return {
    to, tag: "saldo-bajo",
    subject: `Te quedan ${left}`,
    html: layout({
      preview: "Te alcanza para menos de un anuncio.",
      title: `Te quedan ${left}`,
      paragraphs: [esc(hello(name)), `Te queda saldo para menos de un anuncio.${esc(renew)}`, "Si necesitas más antes, puedes cargar saldo extra o pasarte a un plan más grande."],
      cta: { label: "Ver planes y saldo", href: `${SITE}/app/planes` },
    }),
    text: plain([hello(name), "", `Te quedan ${left} de video: menos de un anuncio.${renew}`, "Puedes cargar saldo extra o pasarte a un plan más grande.", "", `Ver planes: ${SITE}/app/planes`]),
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

export function planEndingEmail(to: string, name: string | null, o: { plan: string | null; until: string; daysLeft: number; credits: number | null; renews?: boolean }): Email {
  const link = `${SITE}/app/planes`;
  if (o.renews) {
    // automatic renewal: nothing to do, only a heads-up about the credits that will expire
    const plan = o.plan ? `Tu plan ${o.plan}` : "Tu plan";
    const left = o.credits && o.credits > 0 ? `Te quedan ${o.credits.toLocaleString("es-CL")} créditos de este período: los que no uses antes de esa fecha vencen.` : "";
    const title = `${plan} se renueva ${o.daysLeft <= 0 ? "hoy" : `el ${longDate(o.until)}`}`;
    return {
      to, tag: "plan-se-renueva", subject: title,
      html: layout({ preview: "No tienes que hacer nada.", title, paragraphs: [esc(hello(name)), `${esc(plan)} se renueva solo el <b>${esc(longDate(o.until))}</b>: no tienes que hacer nada. ${esc(left)}`], cta: { label: "Seguir creando", href: `${SITE}/app` } }),
      text: plain([hello(name), "", `${plan} se renueva solo el ${longDate(o.until)}: no tienes que hacer nada. ${left}`, "", `Seguir creando: ${SITE}/app`]),
    };
  }
  const when = o.daysLeft <= 0 ? "hoy" : o.daysLeft === 1 ? "mañana" : `en ${o.daysLeft} días`;
  const plan = o.plan ? `Tu plan ${o.plan}` : "Tu plan";
  const left = o.credits && o.credits > 0 ? `Te quedan ${o.credits.toLocaleString("es-CL")} créditos: úsalos antes de esa fecha, porque los créditos vencen con el período del plan.` : "Renueva para seguir generando sin pausa.";
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

/**
 * After the plan ended (3 and 14 days later): what they made is still there, and an honest question about
 * what was missing (their answer comes straight to the owner). Marketing-ish, so it respects opt-outs.
 */
export function winbackEmail(to: string, name: string | null, o: { daysAgo: 3 | 14; plan: string | null; ads: number; unsub: string }): Email {
  const plan = o.plan ? `tu plan ${o.plan}` : "tu plan";
  const made = o.ads > 0 ? `Tus ${o.ads.toLocaleString("es-CL")} anuncio${o.ads === 1 ? "" : "s"}, avatares y voces siguen guardados en tu cuenta.` : "Tus avatares, voces y guiones siguen guardados en tu cuenta.";
  const v = o.daysAgo === 3
    ? {
        subject: "Tu estudio sigue aquí",
        title: "Tu estudio sigue aquí",
        paragraphs: [esc(hello(name)), `Hace unos días venció ${esc(plan)}. ${esc(made)}`, "Cuando quieras volver a crear, renuevas y sigues justo donde quedaste. Si algo no te funcionó como esperabas, <b>respóndenos este correo</b>: lo leemos nosotros, no un robot."],
        cta: { label: "Volver a crear", href: `${SITE}/app/planes` },
      }
    : {
        subject: "¿Qué te faltó en Creads?",
        title: "¿Qué te faltó?",
        paragraphs: [esc(hello(name)), "Queremos que Creads sea la herramienta que no dejas nunca, y para eso necesitamos saber qué no funcionó contigo.", "<b>Respóndenos con una línea</b>: ¿fue el precio, la calidad de algún video, que faltaba algo, o simplemente no lo necesitaste este mes? Lo leemos todo y mejoramos con eso.", esc(made)],
        cta: { label: "Ver los planes", href: `${SITE}/app/planes` },
      };
  return {
    to, tag: `volver-${o.daysAgo}`, subject: v.subject, unsub: o.unsub,
    html: layout({ preview: v.title, title: v.title, paragraphs: v.paragraphs, cta: v.cta, unsub: o.unsub }),
    text: plain([...v.paragraphs.map(unhtml), "", `${v.cta.label}: ${v.cta.href}`, "", `No quiero recibir más consejos: ${o.unsub}`]),
  };
}

export interface DailyReport {
  day: string; // YYYY-MM-DD (yesterday)
  salesCount: number;
  salesUsd: number;
  salesClp: number;
  signups: number;
  installs?: number;
  aiUsd: number;
  expired: number;
  ending: number;
  alerts: string[];
  /** What the in-app assistant handled. */
  support?: { chats: number; people: number; solved: number; topics: [string, number][]; unsolved: string[] };
  errors?: { total: number; kinds: number; top: string[] };
  gen?: { total: number; failed: number; failedUsd: number; refunded: number };
  /** Exact sales and spend of the day (lib/gasto.ts) and the month so far. */
  money?: import("./gasto").DayLedger;
  month?: { from: string; vendido: number; neto: number; gastado: number; resultado: number; dias: number };
}

const TOPIC_ES: Record<string, string> = { creditos: "créditos", planes_pago: "planes y pagos", crear: "crear anuncios", marca: "voces y avatares", herramientas: "herramientas", falla: "fallas", cuenta: "cuenta", otro: "otros" };

/** The owner's 9:00 summary: money in, AI spent, new accounts and anything to look at. */
export function ownerReportEmail(to: string, r: DailyReport): Email {
  const usd = (n: number) => `US$${n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const margin = r.salesUsd - r.aiUsd;
  const m = r.money;
  const line = (l: { usd: number | null; real: boolean; note?: string }) => (l.usd == null ? `— (${l.note ?? "sin dato"})` : `${usd(l.usd)}${l.real ? "" : ` · ${l.note ?? "estimado"}`}`);
  const moneyRows: [string, string][] = m ? [
    ["Vendido", `${m.ventas.count} · ${usd(m.ventas.usd)}${m.ventas.clp ? ` ($${m.ventas.clp.toLocaleString("es-CL")} CLP)` : ""}`],
    ["− IVA (19%)", usd(m.ventas.iva)],
    ["− Mercado Pago", `${usd(m.ventas.mp)}${m.ventas.mpReal ? "" : " · estimado"}`],
    ["= Neto de ventas", usd(m.ventas.neto)],
    ["Video y labios (fal.ai)", line(m.gastos.fal)],
    ["Claude (asistente, guiones, revisión)", line(m.gastos.claude)],
    ["Imágenes (Google)", line(m.gastos.google)],
    ["Voces (ElevenLabs, extra del plan)", line(m.gastos.eleven)],
    ...(m.gastos.oficina.usd != null ? [["Oficina de agentes", line(m.gastos.oficina)] as [string, string]] : []),
    ["Campañas en Meta", line(m.gastos.meta)],
    ["Costos fijos (del día)", line(m.gastos.fijos)],
    ["= Gastado", usd(m.gastoTotal)],
    ["Resultado del día", usd(m.resultado)],
    ...(r.month ? [[`Mes (desde el ${r.month.from.slice(8)})`, `vendido ${usd(r.month.vendido)} · neto ${usd(r.month.neto)} · gastado ${usd(r.month.gastado)} · resultado ${usd(r.month.resultado)}`] as [string, string]] : []),
  ] : [];
  const rows: [string, string][] = m ? [...moneyRows] : [
    ["Ventas", `${r.salesCount} · ${usd(r.salesUsd)}${r.salesClp ? ` ($${Math.round(r.salesClp).toLocaleString("es-CL")} CLP)` : ""}`],
    ["Gasto en IA (estimado)", usd(r.aiUsd)],
    ["Ventas − gasto IA", usd(margin)],
  ];
  rows.push(
    ["Cuentas nuevas", String(r.signups)],
    ["Instalaciones de la app", String(r.installs ?? 0)],
    ["Planes que vencen en 3 días", String(r.ending)],
    ["Créditos vencidos hoy", r.expired.toLocaleString("es-CL")],
  );
  if (r.gen) rows.push(["Generaciones fallidas", r.gen.total ? `${r.gen.failed} de ${r.gen.total} (${Math.round((r.gen.failed / r.gen.total) * 100)}%) · ${usd(r.gen.failedUsd)} en riesgo` : "Sin generaciones"]);
  if (r.gen?.refunded) rows.push(["Créditos devueltos a clientes", r.gen.refunded.toLocaleString("es-CL")]);
  if (r.errors) rows.push(["Errores registrados", r.errors.total ? `${r.errors.total} (${r.errors.kinds} tipo${r.errors.kinds === 1 ? "" : "s"})` : "Ninguno"]);
  const sp = r.support;
  if (sp) rows.push(["Asistente Creads", sp.chats ? `${sp.chats} pregunta${sp.chats === 1 ? "" : "s"} de ${sp.people} cliente${sp.people === 1 ? "" : "s"} · ${Math.round((sp.solved / sp.chats) * 100)}% resueltas` : "Sin preguntas"]);
  const topics = sp?.topics.length ? `Temas: ${sp.topics.map(([t, n]) => `${TOPIC_ES[t] ?? t} (${n})`).join(", ")}.` : "";
  const unsolved = sp?.unsolved ?? [];
  const date = longDate(r.day);
  const ok = !r.alerts.length;
  return {
    to, tag: "resumen-dueno",
    subject: `Creads · ${date}: ${r.salesCount} venta${r.salesCount === 1 ? "" : "s"}, ${usd(r.salesUsd)}${m ? ` · gastado ${usd(m.gastoTotal)}` : ""}${ok ? "" : " · ⚠ revisar"}`,
    html: layout({
      preview: ok ? "Todo en orden." : `${r.alerts.length} cosa(s) para revisar.`,
      title: `Resumen del ${date}`,
      paragraphs: [ok ? "Todo anduvo en orden. Estos son los números de ayer:" : "Hay algo para revisar (abajo). Estos son los números de ayer:"],
      rows,
      cta: { label: "Abrir el Panel", href: `${SITE}/admin` },
      after: [
        ...(r.alerts.length ? [`<b>Para revisar:</b><br>${r.alerts.map((a) => `• ${esc(a)}`).join("<br>")}`] : []),
        ...(r.errors?.top.length ? [`<b>Errores más repetidos:</b><br>${r.errors.top.map((e) => `• ${esc(e)}`).join("<br>")}`] : []),
        ...(topics ? [esc(topics)] : []),
        ...(unsolved.length ? [`<b>Lo que el asistente no supo responder</b> (vale la pena sumarlo al Centro de ayuda o mejorar el producto):<br>${unsolved.map((q) => `• «${esc(q)}»`).join("<br>")}`] : []),
      ],
    }),
    text: plain([`Resumen del ${date}`, "", ...rows.map(([k, v]) => `${k}: ${v}`), "", ...(r.alerts.length ? ["Para revisar:", ...r.alerts.map((a) => `- ${a}`)] : ["Todo en orden."]), ...(topics ? ["", topics] : []), ...(unsolved.length ? ["", "Lo que el asistente no supo responder:", ...unsolved.map((q) => `- «${q}»`)] : []), "", `Panel: ${SITE}/admin`]),
  };
}

export type ActivationStep = 1 | 3 | 7;

/** Tips in the first week, so new customers get to their first ad (and keep making them). */
export function activationEmail(to: string, name: string | null, o: { step: ActivationStep; hasPlan: boolean; ads: number; unsub: string }): Email {
  const plan = o.hasPlan ? "" : " Tienes 7 días gratis con 200 créditos de regalo al agregar tu tarjeta; después, los planes parten en US$29 al mes.";
  const variants: Record<ActivationStep, { subject: string; title: string; paragraphs: string[]; cta: { label: string; href: string } }> = {
    1: {
      subject: "Tu primer anuncio en 10 minutos",
      title: "Tu primer anuncio en 10 minutos",
      paragraphs: [
        esc(hello(name)),
        "La forma más rápida de partir:",
        "<b>1.</b> Entra a <b>Crear guion</b> y pega un anuncio que esté funcionando (tuyo o de la competencia). Presiona <b>Desarmar el guion</b>: vas a ver su hook, dolor, oferta y CTA, y qué mejorar.<br><b>2.</b> Pide <b>10 hooks</b> o <b>3 ángulos</b> y elige el mejor.<br><b>3.</b> Presiona <b>Llevar a Crear anuncio</b>, elige tu avatar y genera.",
        esc(plan.trim()),
      ].filter(Boolean),
      cta: { label: "Crear mi guion", href: `${SITE}/app/guiones` },
    },
    3: o.ads > 0
      ? {
          subject: "3 formas de sacarle más a Creads",
          title: "Ya hiciste tu primer anuncio. ¿Y ahora?",
          paragraphs: [esc(hello(name)), "Los anuncios que más venden casi nunca salen a la primera: salen de testear versiones.", "<b>Cambia solo el hook:</b> pide 10 hooks y haz 3 versiones del mismo anuncio.<br><b>Prueba otro ángulo:</b> la misma oferta contada desde el ahorro, el miedo o una historia.<br><b>Historias animadas:</b> un formato que destaca en el feed y casi nadie está usando."],
          cta: { label: "Hacer 3 versiones", href: `${SITE}/app/guiones` },
        }
      : {
          subject: "¿Te ayudo con tu primer anuncio?",
          title: "¿Te ayudo con tu primer anuncio?",
          paragraphs: [esc(hello(name)), "Vi que todavía no has creado tu primer anuncio. Si algo no quedó claro o no sabes por dónde partir, <b>responde este correo</b> con qué vendes y a quién, y te ayudamos a armar el guion.", `O parte solo: en «Crear guion», la opción «Crear desde cero» escribe 3 guiones con solo contarle qué vendes.${esc(plan)}`],
          cta: { label: "Crear mi primer anuncio", href: `${SITE}/app/guiones` },
        },
    7: {
      subject: "Lo que hacen los que más venden con sus anuncios",
      title: "El método de los anuncios ganadores",
      paragraphs: [
        esc(hello(name)),
        "En los anuncios que venden, el patrón se repite:",
        "<b>1. Parte de un guion que ya funciona</b> (el tuyo o uno de la competencia) y desármalo.<br><b>2. Cambia una sola cosa por vez</b>: el hook o el ángulo, no todo junto.<br><b>3. Publica 3 versiones con el mismo presupuesto</b> y compara el costo por lead.<br><b>4. Quédate con la ganadora</b> y vuelve a iterar sobre ella.",
        `Creads está hecho para hacer ese ciclo en minutos, no en días.${esc(plan)}`,
      ],
      cta: { label: "Seguir creando", href: `${SITE}/app` },
    },
  };
  const v = variants[o.step];
  return {
    to, tag: `activacion-${o.step}`, subject: v.subject, unsub: o.unsub,
    html: layout({ preview: v.title, title: v.title, paragraphs: v.paragraphs, cta: v.cta, unsub: o.unsub }),
    text: plain([...v.paragraphs.map(unhtml), "", `${v.cta.label}: ${v.cta.href}`, "", `No quiero recibir más consejos: ${o.unsub}`]),
  };
}

/**
 * «Algo no salió bien»: a customer's generation failed (its credits are already back). Sent once, grouped,
 * with a human tone and a real way to talk to someone. Service email: it goes even to people who opted out
 * of tips, because it's about something they paid for.
 */
export function careEmail(to: string, name: string | null, o: { items: { what: string; href: string }[]; whatsapp?: string }): Email {
  const n = o.items.length;
  const list = o.items.slice(0, 5).map((x) => `• ${esc(x.what)}`).join("<br>");
  const main = o.items[0];
  const wa = o.whatsapp ? `https://wa.me/${o.whatsapp}?text=${encodeURIComponent("Hola, tuve un problema con una generación en Creads")}` : "";
  const title = n === 1 ? "Algo no salió como esperábamos" : `${n} generaciones no salieron como esperábamos`;
  const paragraphs = [
    esc(hello(name)),
    n === 1 ? `Tu ${esc(main.what)} no se pudo terminar. Los créditos ya volvieron a tu cuenta.` : `Estas generaciones no se pudieron terminar y sus créditos ya volvieron a tu cuenta:<br>${list}`,
    "Ya lo estamos revisando para que no se repita. Si quieres, lo vemos contigo: <b>responde este correo</b>" + (wa ? " o escríbenos por WhatsApp" : "") + " y te ayudamos a que salga bien.",
  ];
  return {
    to, tag: "cuidado-falla", subject: title,
    html: layout({ preview: n === 1 ? `Tu ${main.what} no se pudo terminar. Los créditos ya volvieron.` : "Los créditos ya volvieron a tu cuenta.", title, paragraphs, cta: { label: "Volver a intentarlo", href: `${SITE}${main.href}` }, after: wa ? [`<a href="${esc(wa)}" style="color:#7c3aed;font-weight:700">Escribirnos por WhatsApp</a>`] : [] }),
    text: plain([...paragraphs.map(unhtml), "", `Volver a intentarlo: ${SITE}${main.href}`, wa && `WhatsApp: ${wa}`]),
  };
}

/** An alarm for the owner: something is failing right now (an error or many failed generations). */
export function alarmEmail(to: string, a: { title: string; detail: string; rows?: [string, string][]; times?: number }): Email {
  return {
    to, tag: "alarma",
    subject: `⚠ Creads: ${a.title}`.slice(0, 140),
    html: layout({
      preview: a.detail.slice(0, 120),
      title: a.title,
      paragraphs: [esc(a.detail), ...(a.times && a.times > 1 ? [`Pasó <b>${a.times} veces</b> desde el último aviso.`] : [])],
      rows: a.rows,
      cta: { label: "Ver errores en el Panel", href: `${SITE}/admin?tab=errores` },
      after: ["Este aviso se repite como máximo cada 6 horas por el mismo problema. Si ya lo resolviste, márcalo como resuelto en el Panel."],
    }),
    text: plain([`⚠ ${a.title}`, "", a.detail, ...(a.rows ?? []).map(([k, v]) => `${k}: ${v}`), "", `Panel: ${SITE}/admin?tab=errores`]),
  };
}

/** The office CEO's morning brief (Panel → Oficina). The text comes from an AI agent: escaped, no links. */
export function officeEmail(to: string, b: { resumen: string; prioridades: string[]; informe: string; estado: string; alertas: [string, string][] }): Email {
  const mark = b.estado === "urgente" ? "🔴" : b.estado === "atencion" ? "🟡" : "🟢";
  const para = b.informe.split(/\n{2,}/).map((t) => esc(t.trim()).replace(/\n/g, "<br>")).filter(Boolean).slice(0, 12);
  return {
    to, tag: "oficina",
    subject: `${mark} Oficina Creads: ${b.resumen}`.replace(/\s+/g, " ").slice(0, 140),
    html: layout({
      preview: b.resumen,
      title: "Resumen del día de tu oficina",
      paragraphs: [`<b>${esc(b.resumen)}</b>`, ...(b.prioridades.length ? [`<b>Lo primero hoy:</b><br>${b.prioridades.map((p, i) => `${i + 1}. ${esc(p)}`).join("<br>")}`] : []), ...para],
      rows: b.alertas,
      cta: { label: "Abrir la Oficina", href: `${SITE}/admin?tab=oficina` },
      after: ["Lo escribió tu CEO General (agente de IA) con los informes de todas las áreas y los números reales. Revisa los detalles en el Panel antes de actuar."],
    }),
    text: plain([`${mark} ${b.resumen}`, "", ...b.prioridades.map((p, i) => `${i + 1}. ${p}`), "", b.informe, "", ...b.alertas.map(([k, v]) => `${k}: ${v}`), "", `Oficina: ${SITE}/admin?tab=oficina`]),
  };
}

/** «Tu anuncio de regalo te está esperando» (owner, 24 Oct 2026): accounts that signed up and haven't used it. */
export function regaloReminderEmail(to: string, name: string | null, unsub: string): Email {
  const link = `${SITE}/app/automatico`;
  return {
    to, tag: "regalo-recordatorio", unsub,
    subject: "Tu anuncio de regalo te está esperando",
    html: layout({
      preview: "Tienes créditos cargados para tu primer anuncio en video. Te toma 5 minutos.",
      title: "Tu primer anuncio sigue esperándote",
      paragraphs: [
        esc(hello(name)),
        "Cuando creaste tu cuenta en Creads te cargamos créditos para tu primer anuncio en video, con una persona hablando de tu negocio. Todavía no lo has usado, y te toma unos 5 minutos:",
        "<b>1.</b> Entra a <b>Automático</b>.<br><b>2.</b> Escríbele qué vendes y qué quieres que haga la gente. Por ejemplo: <i>«Tengo una pastelería en Ñuñoa y quiero más pedidos por WhatsApp»</i>.<br><b>3.</b> Aprueba el guion y la persona, y Creads te entrega el video revisado, listo para Instagram, Facebook y TikTok.",
      ],
      cta: { label: "Hacer mi anuncio de regalo", href: link },
      after: ["Si te trabaste en algo, responde este correo y te ayudamos."],
      unsub,
    }),
    text: plain([hello(name), "", "Tienes créditos cargados para tu primer anuncio en video y todavía no los usas. Entra a Automático, cuéntale qué vendes y en 5 minutos lo tienes.", "", `Hacer mi anuncio: ${link}`, "", `No recibir más estos correos: ${unsub}`]),
  };
}

/** The customer's ad finished while they were away (owner, 25 Oct 2026: «que salga todo perfecto»). */
export function adReadyEmail(to: string, name: string | null, o: { titulo?: string | null }): Email {
  const link = `${SITE}/app/automatico`;
  return {
    to, tag: "anuncio-listo",
    subject: "Tu anuncio está listo 🎬",
    html: layout({
      preview: "Revisado y listo para publicar en Instagram, Facebook y TikTok.",
      title: "Tu anuncio está listo",
      paragraphs: [
        esc(hello(name)),
        `Terminamos tu anuncio${o.titulo ? ` «${esc(o.titulo)}»` : ""}. Ya pasó la revisión de calidad y está listo para descargar y publicar.`,
        "Si quieres cambiar una palabra de los subtítulos o hacer otra versión con otro gancho, pídeselo a Creads en el mismo chat.",
      ],
      cta: { label: "Ver mi anuncio", href: link },
      after: ["Si algo no te gustó, responde este correo y lo revisamos contigo."],
    }),
    text: plain([hello(name), "", "Tu anuncio está listo, revisado y para descargar.", "", `Verlo: ${link}`]),
  };
}

/** The day before the free trial's first charge: plain, so nobody is surprised (fewer disputes). */
export function trialEndingEmail(to: string, name: string | null, o: { fecha: string; plan: string; usd: number; clp: number; credits: number; ads: number }): Email {
  const planes = `${SITE}/app/planes`;
  // the price in dollars like the site; the pesos are what Mercado Pago really charges the card
  const monto = `US$${o.usd.toLocaleString("es-CL")} al mes`;
  const pesos = o.clp > 0 ? ` (Mercado Pago cobra $${Math.round(o.clp).toLocaleString("es-CL")} en pesos chilenos)` : "";
  return {
    to, tag: "prueba-termina",
    subject: `Mañana termina tu prueba gratis de Creads IA`,
    html: layout({
      preview: `El ${o.fecha} se cobra el plan ${o.plan} (${monto}). Si no quieres seguir, cancélalo hoy.`,
      title: "Mañana termina tu prueba gratis",
      paragraphs: [
        esc(hello(name)),
        o.ads > 0 ? "Ya probaste Creads con tus créditos de regalo. ¡Bien!" : "Todavía no haces tu primer anuncio: aún estás a tiempo, te toma unos 5 minutos.",
        `El <b>${esc(o.fecha)}</b> Mercado Pago cobra el plan <b>${esc(o.plan)}: ${monto}</b>${pesos}, con ${o.credits.toLocaleString("es-CL")} créditos nuevos cada mes. No tienes que hacer nada para seguir.`,
        "Si prefieres no seguir, cancela hoy en «Planes» con un clic y no se te cobra nada.",
      ],
      cta: { label: "Ver mi prueba y mi plan", href: planes },
      after: ["¿Dudas? Responde este correo y te ayudamos."],
    }),
    text: plain([hello(name), "", `Mañana (${o.fecha}) se cobra el plan ${o.plan}: ${monto}${pesos}. Para no seguir, cancela hoy en Planes: ${planes}`]),
  };
}

// ---------- funnel emails by behaviour (owner's plan, 25 Oct 2026). Sent only with CORREOS_COMPORTAMIENTO=1 ----------

export type Embudo = "sin-generar-1h" | "sin-generar-24h" | "sin-pagar-1" | "sin-pagar-3" | "sin-pagar-5" | "checkout-1h" | "pago-bienvenida" | "tanda-lista" | "pack-dia-5" | "caso-dia-14";

const EMBUDO: Record<Embudo, { subject: string; preview: string; title: string; body: string[]; cta: { label: string; path: string } }> = {
  "sin-generar-1h": {
    subject: "Tu primera tanda está a un link de distancia",
    preview: "Pega el link de tu producto y Creads hace el resto.",
    title: "Pega el link de tu producto",
    body: [
      "Ya tienes tu cuenta. Lo más rápido para ver de qué es capaz Creads: pega el link de tu producto o tu tienda.",
      "Creads lee tu página, te propone 6 ángulos de venta (dolor, deseo, mecanismo, prueba social, creencia y oferta) y crea 10 anuncios en 4:5 y 9:16, listos para subir a Meta.",
    ],
    cta: { label: "Crear mi primera tanda", path: "/app/tanda" },
  },
  "sin-generar-24h": {
    subject: "¿Te ayudo con tu primera tanda?",
    preview: "Si no tienes página, basta con describir tu producto en dos frases.",
    title: "Tu primera tanda en 3 minutos",
    body: [
      "Vimos que todavía no creas tu primera tanda de anuncios.",
      "Si no tienes página web, no importa: describe tu producto en dos frases (qué es, a quién se lo vendes y su precio) y Creads propone los ángulos por ti.",
      "Si algo no te quedó claro, responde este correo y te ayudamos.",
    ],
    cta: { label: "Hacer mi tanda ahora", path: "/app/tanda" },
  },
  "sin-pagar-1": {
    subject: "Tus anuncios ya están listos para testear",
    preview: "Súbelos a Meta y deja que los números decidan.",
    title: "Siguiente paso: testea",
    body: [
      "Ya creaste tus primeros anuncios. Ahora súbelos a Meta con el mismo presupuesto cada uno y deja que los números elijan al ganador.",
      "El anuncio que vende se quema en días. Gana el que testea más rápido: con un plan puedes crear tandas nuevas cada semana.",
    ],
    cta: { label: "Ver planes", path: "/app/planes" },
  },
  "sin-pagar-3": {
    subject: "¿Cómo te fue con tus anuncios?",
    preview: "Haz variaciones del que mejor funcionó.",
    title: "¿Cuál funcionó mejor?",
    body: [
      "Si ya testeaste tus anuncios, el siguiente paso es hacer variaciones del que mejor funcionó: otro gancho, otra persona, otro formato.",
      "Con un plan tienes saldo para imágenes y videos con avatar cada mes, y lo gastas como quieras.",
    ],
    cta: { label: "Elegir mi plan", path: "/app/planes" },
  },
  "sin-pagar-5": {
    subject: "Un último dato antes de tu próxima campaña",
    preview: "Testear 3 anuncios al mes no alcanza.",
    title: "Testea 70 anuncios al mes, no 3",
    body: [
      "Las cuentas que crecen en Meta no adivinan: testean muchos ángulos y se quedan con los que venden.",
      "Creads te da imágenes, videos UGC y avatares que hablan, en español o inglés, con tu marca, listos para subir. Elige el plan que se ajuste a tu ritmo.",
      "Si tienes dudas, responde este correo: lo lee una persona.",
    ],
    cta: { label: "Ver planes", path: "/app/planes" },
  },
  "checkout-1h": {
    subject: "Tu plan quedó a medio camino",
    preview: "Termina tu compra en un minuto.",
    title: "¿Se cortó tu pago?",
    body: [
      "Empezaste a contratar un plan pero el pago no se completó.",
      "Si fue un problema con la tarjeta, prueba con otra o con otro medio de pago. Si tienes una duda sobre el plan, responde este correo y te ayudamos.",
    ],
    cta: { label: "Terminar mi compra", path: "/app/planes" },
  },
  "pago-bienvenida": {
    subject: "Bienvenido a Creads: así sacas el máximo",
    preview: "Tu saldo ya está cargado.",
    title: "Tu plan ya está activo",
    body: [
      "Gracias por confiar en Creads. Tu saldo ya está cargado y lo puedes gastar en imágenes o videos, como quieras.",
      "Tres consejos para empezar: carga tu kit de marca (logo, colores y producto) una sola vez; haz una tanda por semana; y cuando un anuncio funcione, pide variaciones de ese.",
    ],
    cta: { label: "Ir a mi estudio", path: "/app" },
  },
  // block F (25 Oct 2026). {x} are filled per customer by embudoEmail's `vars`
  "tanda-lista": {
    subject: "Tu tanda está lista",
    preview: "Tus anuncios ya están listos para descargar y subir a Meta.",
    title: "Tu tanda está lista",
    body: [
      "Tus {n} anuncios de {producto} ya están listos, cada uno en 4:5 para el feed y en 9:16 para stories y reels.",
      "Descarga el ZIP y súbelos a Meta con el mismo presupuesto cada uno: en pocos días los números te dicen cuál vende más. Cuando tengas un ganador, pide variaciones de ese.",
    ],
    cta: { label: "Ver mi tanda", path: "/app/tanda?id={id}" },
  },
  "pack-dia-5": {
    subject: "Tu descuento de {monto} vence el {fecha}",
    preview: "Si eliges un plan antes, lo que pagaste por el Pack Prueba se descuenta de tu primer mes.",
    title: "Tu Pack Prueba todavía vale {monto}",
    body: [
      "Hace 5 días compraste el Pack Prueba. Si eliges un plan hasta el {fecha} a las {hora} (hora de Chile), esos {monto} se descuentan de tu primer mes.",
      "Después de esa fecha el plan se cobra completo.",
      "¿No sabes qué plan te conviene? Responde este correo y te ayudamos a elegir.",
    ],
    cta: { label: "Elegir mi plan", path: "/app/planes" },
  },
  "caso-dia-14": {
    subject: "¿Nos cuentas cómo te fue?",
    preview: "Tu experiencia ayuda a otros negocios a decidirse. Te toma 3 minutos.",
    title: "¿Nos cuentas cómo te fue?",
    body: [
      "Hace dos semanas compraste el Pack Prueba y te sumaste a los casos fundadores de Creads. ¡Gracias!",
      "Queremos saber cómo te fue: qué anuncios usaste y qué resultados viste. Si tienes una captura del Administrador de anuncios de Meta, súbela también.",
      "Antes de mostrar cualquier cosa te pedimos permiso en el mismo formulario. Y si todavía no lanzas tu campaña, responde este correo y te ayudamos a armarla.",
    ],
    cta: { label: "Contar mi experiencia", path: "/app/caso" },
  },
};

const fill = (s: string, vars?: Record<string, string>) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m) : s);

export function embudoEmail(to: string, name: string | null, tipo: Embudo, unsub?: string, vars?: Record<string, string>): Email {
  const e = EMBUDO[tipo];
  const href = `${SITE}${fill(e.cta.path, vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, encodeURIComponent(v)])))}`;
  const subject = fill(e.subject, vars), title = fill(e.title, vars), body = e.body.map((b) => fill(b, vars));
  return {
    to, tag: `embudo-${tipo}`, subject, unsub,
    html: layout({ preview: fill(e.preview, vars), title, paragraphs: [esc(hello(name)), ...body.map(esc)], cta: { label: e.cta.label, href }, unsub }),
    text: plain([hello(name), "", ...body, "", `${e.cta.label}: ${href}`, unsub && `\nNo quiero recibir más consejos: ${unsub}`]),
  };
}

/** The texts, for the owner to read and approve (Panel and docs). */
export const EMBUDO_TEXTOS = EMBUDO;
