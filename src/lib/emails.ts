import type { Email } from "./providers/email";

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
}

const TOPIC_ES: Record<string, string> = { creditos: "créditos", planes_pago: "planes y pagos", crear: "crear anuncios", marca: "voces y avatares", herramientas: "herramientas", falla: "fallas", cuenta: "cuenta", otro: "otros" };

/** The owner's 9:00 summary: money in, AI spent, new accounts and anything to look at. */
export function ownerReportEmail(to: string, r: DailyReport): Email {
  const usd = (n: number) => `US$${n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const margin = r.salesUsd - r.aiUsd;
  const rows: [string, string][] = [
    ["Ventas", `${r.salesCount} · ${usd(r.salesUsd)}${r.salesClp ? ` ($${Math.round(r.salesClp).toLocaleString("es-CL")} CLP)` : ""}`],
    ["Gasto en IA (estimado)", usd(r.aiUsd)],
    ["Ventas − gasto IA", usd(margin)],
    ["Cuentas nuevas", String(r.signups)],
    ["Instalaciones de la app", String(r.installs ?? 0)],
    ["Planes que vencen en 3 días", String(r.ending)],
    ["Créditos vencidos hoy", r.expired.toLocaleString("es-CL")],
  ];
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
    subject: `Creads · ${date}: ${r.salesCount} venta${r.salesCount === 1 ? "" : "s"}, ${usd(r.salesUsd)}${ok ? "" : " · ⚠ revisar"}`,
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
  const plan = o.hasPlan ? "" : " Para generar videos activa tu plan: Emprende cuesta US$55 al mes.";
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
        "Después de miles de anuncios, el patrón se repite:",
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
