// The launch checklist (Panel → Lanzamiento): what is checked by itself on the server (AUTO, see
// /api/admin/lanzamiento) and what the owner ticks by hand (MANUAL). Shared by the panel and the office.

export interface LaunchCheck { id: string; state: "ok" | "falta" | "revisar"; detail: string }
export const AUTO: Record<string, { title: string; how: string }> = {
  billing: { title: "Base de datos de pagos (billing.sql)", how: "Supabase → SQL Editor → New query → pega todo supabase/billing.sql → Run. Se puede ejecutar más de una vez sin problema." },
  "mp-token": { title: "Mercado Pago: Access Token", how: "mercadopago.cl/developers → Tus integraciones → tu aplicación → Credenciales de producción → Access Token → Vercel: MP_ACCESS_TOKEN." },
  "mp-webhook": { title: "Mercado Pago: avisos de pago", how: "En tu aplicación → Webhooks: URL https://www.creadsia.com/api/pagos/mp, eventos Pagos y Planes y suscripciones → copia la clave secreta → Vercel: MP_WEBHOOK_SECRET." },
  "mp-once": { title: "Modo de cobro de los planes", how: "MP_ONE_TIME=1 cobra cada mes por separado (recomendado mientras uses una cuenta temporal)." },
  meta: { title: "Meta: API de conversiones (no es el píxel)", how: "El píxel ya está instalado. Este token deja que Creads avise las ventas a Meta desde el servidor (cuenta iPhone y bloqueadores). Administrador de eventos → tu píxel → Configuración → API de conversiones → Generar token de acceso → pégalo en Panel → Marketing → Conexiones (no hace falta Vercel; lo puede hacer un socio). Hazlo antes de lanzar anuncios." },
  admin: { title: "Clave de administrador (llave maestra)", how: "Sirve para recuperar tu cuenta de dueño si pierdes la clave y el teléfono (en creadsia.com/app?dueno). Vercel → Environment Variables → ADMIN_ACCESS_CODE con 24 caracteres o más → guárdala en un lugar seguro → Redeploy." },
  email: { title: "Correos automáticos (Resend)", how: "Resend → API Keys → Vercel: RESEND_API_KEY." },
  cron: { title: "Avisos de plan por vencer", how: "Vercel: CRON_SECRET con una clave larga inventada." },
  dolar: { title: "Dólar automático", how: "Se lee solo del Banco Central cada día. Si falla, se usa el «Dólar de respaldo» de arriba en el Panel." },
  stats: { title: "Contador de visitas (Estadísticas)", how: "Supabase → SQL Editor → New query → pega todo supabase/stats.sql → Run. Desde ese momento la pestaña Estadísticas cuenta visitas, dispositivos, ubicación y canal (anónimo, sin datos personales)." },
  "meta-ads": { title: "Meta conectado al estudio de marketing", how: "Para que los agentes suban campañas (en pausa), lean métricas y publiquen en Instagram y Facebook. Se conecta en Panel → Marketing → Conexiones, con la guía paso a paso que está ahí mismo (token del usuario del sistema, cuenta publicitaria, página e Instagram). Lo puede hacer un socio." },
  ai: { title: "Modelos de IA", how: "Claves de Anthropic, Google, fal.ai y ElevenLabs en Vercel." },
  guardian: { title: "Guardián: revisión cada 5 minutos", how: "Vercel: GUARDIAN_TOKEN con 24 caracteres o más inventados → Redeploy. Después, en UptimeRobot, un monitor de tipo «Keyword» con la dirección que aparece en Plataforma → Guardián, palabra «OK», cada 5 minutos." },
  whatsapp: { title: "Alertas al celular (Telegram o WhatsApp)", how: "Telegram (rápido y gratis): en Telegram busca @BotFather → /newbot → ponle nombre → te da una clave; en Vercel pon TELEGRAM_BOT_TOKEN = esa clave → Redeploy; abre tu bot y apriétale Iniciar; en Plataforma → Guardián aprieta «Mandarme uno de prueba». WhatsApp: CallMeBot (gratis). Agrega su número a tus contactos, mándale el mensaje de activación, te responde con tu clave; en Vercel pon CALLMEBOT_PHONE (con +56) y CALLMEBOT_KEY. La oficial: WhatsApp Cloud API de Meta (pídele a Claude el paso a paso)." },
};
/** `urgent`: blocks the launch (shown in red). `who`: "tu" = the owner, "claude" = pending work of the AI developer. */
export const MANUAL: { id: string; title: string; how: string; urgent?: boolean; who?: "tu" | "claude" }[] = [
  { id: "iva", title: "Precios con o sin impuestos: decidir y anotar", how: "Con el asesor: ¿los US$119/219/449 incluyen impuestos (IVA de Chile u otros) o se suman al pagar? Hoy el Panel asume IVA incluido para ventas en Chile. Si cambia, avísale a Claude para ajustar la web, el checkout y el Panel.", urgent: true, who: "tu" },
  { id: "abogado", title: "Abogado: Términos, Privacidad y uso de caras y voces", how: "Que revise /terminos y /privacidad (Ley 19.628 y la nueva Ley 21.719 de datos personales), el consentimiento para clonar caras y voces, el retracto y el uso de anuncios de terceros en «Espiar anuncios».", urgent: true, who: "tu" },
  { id: "mal-uso", title: "Protocolo ante mal uso (suplantación, estafas)", how: "Definir qué hacer si alguien denuncia que usaron su cara o voz sin permiso: bloquear la cuenta, borrar el contenido, guardar registro y responder en 48 h. Escríbelo en una página y Claude lo agrega a los Términos y al Panel.", urgent: true, who: "tu" },
  { id: "staging", title: "Ambiente de pruebas listo", how: "1) Supabase → New project «creads-staging» y ejecuta ahí schema.sql, tenancy.sql y billing.sql. 2) Vercel → Settings → Environment Variables: copia cada variable marcando solo «Preview», con las claves del proyecto de pruebas (y claves de prueba de la pasarela, nunca las reales). 3) Avísale a Claude: publica la rama «staging» y te pasa el link (sale con una franja amarilla «AMBIENTE DE PRUEBAS»).", urgent: true, who: "tu" },
  { id: "alarma-prueba", title: "Probar las alarmas por correo", how: "Panel → Errores y alarmas → «Enviarme una alarma de prueba». Si no llega, revisa spam y que RESEND_API_KEY esté en Vercel.", urgent: true, who: "tu" },
  { id: "cuota-google", title: "Pedir más cuota de Veo a Google (justo antes de lanzar)", how: "Google Cloud → IAM y administración → Cuotas → busca «Veo» / «generate video» → solicitar aumento. Pide para al menos 30 videos por minuto. Tarda días: hazlo apenas tengas fecha de lanzamiento.", urgent: true, who: "tu" },
  { id: "beta", title: "Beta cerrada con 5 a 10 clientes reales", how: "Antes del lanzamiento abierto: que cada uno haga el recorrido completo (se registra → paga → voz y avatar → crea un anuncio → lo descarga). Mira dónde se traban, compara el gasto real de cada proveedor con el Panel y pregúntales cuánto pagarían.", urgent: true, who: "tu" },
  { id: "c-e2e", title: "Claude: pruebas automáticas del recorrido completo", how: "Un robot que todos los días en el ambiente de pruebas se registra, paga en modo prueba, genera un anuncio barato y lo descarga, y te avisa si algo se rompe. Necesita el ambiente de pruebas listo.", urgent: true, who: "claude" },
  { id: "c-gasto", title: "Claude: gasto real por proveedor en el Panel", how: "Conectar las facturas o consumos de Google, fal.ai, ElevenLabs y Anthropic para comparar lo estimado con lo cobrado. Se hace durante la beta.", urgent: true, who: "claude" },
  { id: "c-contracargos", title: "Claude: evidencia para contracargos", how: "Por cada pago, guardar qué generó el cliente, cuándo y desde dónde, para defenderte si desconoce el cargo con su banco.", urgent: true, who: "claude" },
  { id: "c-retencion", title: "Claude: borrado automático de archivos viejos", how: "Aplicar la política de retención de los Términos: borrar solo los archivos de cuentas cerradas o vencidas hace más del plazo, para no pagar almacenamiento de más.", who: "claude" },
  { id: "c-analitica", title: "Claude: analítica de producto (dónde abandonan)", how: "Medir cada paso (registro, pago, voz, avatar, primer anuncio) para ver dónde se cae la gente. Necesita que crees una cuenta gratis en posthog.com y pegues la clave en Vercel.", who: "claude" },
  { id: "c-cola", title: "Claude: fila de generación por proveedor", how: "Que los videos esperen su turno en una fila con un máximo por proveedor (Google, fal.ai, ElevenLabs) en vez de mandarse todos juntos. Así, con cientos de clientes generando a la vez, nadie recibe un error por «demasiadas solicitudes»: solo espera unos segundos más. Se prueba en el ambiente de pruebas.", urgent: true, who: "claude" },
  { id: "c-carga", title: "Claude: prueba de carga (cientos de clientes a la vez)", how: "Simular 500 a 1.000 clientes usando Creads al mismo tiempo en el ambiente de pruebas, sin generar videos reales (no gasta), para ver qué se pone lento y arreglarlo antes de lanzar.", urgent: true, who: "claude" },
  { id: "c-tablas", title: "Claude: registros en la base de datos", how: "Mover a tablas de la base de datos lo que hoy se guarda en archivos (errores, soporte, avisos, caché del espía). Con miles de clientes, los archivos se vuelven lentos y se pueden pisar.", who: "claude" },
  { id: "c-auditoria", title: "Revisión de un programador senior humano", how: "Cuando haya ingresos: unas horas de un experto en seguridad que revise el código y las claves, y alguien que pueda responder si algo se cae un domingo.", who: "tu" },
  { id: "pasarela", title: "Automático 1 · LLC en EE.UU. + Stripe (cobro en US$)", how: "Decidido (17 oct): cobrar en dólares con Stripe a nombre de una LLC. 1) Abrir la LLC (Stripe Atlas lo hace todo junto: LLC, número de impuestos EIN y cuenta Stripe; o Doola/Firstbase) y una cuenta bancaria en US$ (Mercury o Relay). 2) Crear la cuenta en stripe.com y, sin esperar la LLC, sacar las claves de PRUEBA (Developers → API keys) y pegarlas en Vercel solo en «Preview» para el ambiente de pruebas: STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET. 3) Avísale a Claude: conecta Stripe (planes mensuales y anuales, recargas, renovación automática) y lo probamos ahí. 4) Con la LLC lista, las claves reales en Production.", urgent: true },
  { id: "compra", title: "Compra de prueba", how: "Cuando la pasarela esté conectada: desde una cuenta nueva compra el pack de 500 créditos. Deben llegar los créditos y el correo de pago. Después la puedes devolver.", urgent: true },
  { id: "2fa", title: "Verificación en dos pasos en tus cuentas", how: "Primero las 5 llaves de todo: correo (Google), Vercel, GitHub, Supabase y Namecheap. También tu cuenta de Creads (Mi cuenta). Después: Mercado Pago, Google Cloud, fal.ai, ElevenLabs, Anthropic y Resend.", urgent: true },
  { id: "recarga", title: "Automático 2 · Recarga automática con tarjeta", how: "Para no quedarte nunca sin saldo. Google AI Studio → Billing → Setup auto-reload (US$50 cuando quede menos de US$15). ElevenLabs → Developers → Top Up → Auto Top Up (US$20 bajo US$10). fal.ai y Anthropic: buscar «Auto top-up» o «Auto reload» en Billing (US$50 bajo US$20 / US$20 bajo US$5)." },
  { id: "caps", title: "Topes de gasto", how: "Límite mensual en fal.ai, ElevenLabs y Anthropic; alerta de presupuesto en Google Cloud. El tope diario de Creads está en Saldos y alertas.", urgent: true },
  { id: "vercel-pro", title: "Vercel en plan Pro", how: "El plan gratis (Hobby) no permite uso comercial y corta los procesos largos (armar películas, clonar voces). Vercel → Settings → Billing → Pro (US$20/mes).", urgent: true },
  { id: "backups", title: "Supabase en plan Pro (no se pausa y tiene respaldo)", how: "El plan gratis se pausa solo si pasa días sin uso y no tiene respaldo. Supabase → Settings → Billing → Pro (US$25/mes): respaldo diario incluido.", urgent: true },
  { id: "dominio", title: "Dominio y correo con renovación automática", how: "Namecheap → Domain List → creadsia.com → Auto-Renew activado y tarjeta al día. Lo mismo con Google Workspace (tu correo hola@creadsia.com). Si el dominio vence, se cae todo." },
  { id: "monitor", title: "Aviso si la web se cae", how: "uptimerobot.com (gratis) → crear cuenta → Add New Monitor → HTTP(s) → URL https://www.creadsia.com → cada 5 minutos → avisarte por correo y por la app del celular.", urgent: true },
  { id: "whatsapp", title: "WhatsApp de ayuda", how: "Vercel → Environment Variables → NEXT_PUBLIC_WHATSAPP = tu número con código de país, sin + ni espacios (ej: 56912345678) → Redeploy. Aparece un botón de WhatsApp en la web, en el checkout y en el menú de cuenta." },
  { id: "claves", title: "Gestor de contraseñas y acceso de emergencia", how: "Guarda todas las claves (Vercel, Supabase, Namecheap, proveedores, ADMIN_ACCESS_CODE) en 1Password o Bitwarden y deja a una persona de confianza con acceso de emergencia.", urgent: true },
  { id: "marca", title: "Registrar la marca Creads IA", how: "inapi.cl → solicitud de marca (clase 42: software y servicios en línea; opcional clase 35: publicidad). Cuesta unos $100.000–200.000 CLP. Que nadie te la pueda quitar." },
  { id: "contador", title: "Contador o asesor: LLC, impuestos e IVA", how: "Con un asesor que sepa de LLC y Chile: impuestos de la LLC en EE.UU. (formularios anuales) y en Chile (tú como dueño), IVA de servicios digitales a clientes chilenos, cómo sacar la plata a Chile, y revisar /terminos (sobre todo el retracto). Lleva esta lista a la reunión.", urgent: true },
  { id: "gasto-real", title: "Automático 3 · Gasto real de cada proveedor en el Panel", how: "Después de la pasarela: clave de administrador de Anthropic (gasto diario real) y la exportación de facturación de Google Cloud, para comparar lo estimado con lo que cobran de verdad. Pídeselo a Claude.", urgent: true },
  { id: "boletas", title: "Automático 4 · Facturas y recibos", how: "Stripe manda recibo e invoice en US$ a cada cliente de forma automática. Con el contador: si a clientes de Chile (personas, no empresas) hay que cobrarles IVA como servicio digital extranjero y registrarse en el SII; Stripe Tax puede calcularlo. Después Claude lo activa.", urgent: true },
  { id: "dia-1", title: "Día 1: borrón y cuenta nueva", how: "Justo antes de la primera venta real: lo de hoy se archiva como «Ensayo» (no se borra) y el Panel parte de cero en movimientos, pedidos y gasto en IA. Claude te muestra antes la lista exacta para tu OK.", urgent: true },
  { id: "precios", title: "Precios nuevos (oct 2026)", how: "Starter US$119, Plus US$219, Studio US$449 al mes, con 50% el primer mes; anual con 2 meses gratis; recargas US$25 / 89 / 209 (sin cambio). Con el 50% cada plan deja al menos unos US$24 el primer mes aunque el cliente use todos los créditos. Márcalo cuando lo revises en la web." },
  { id: "espia", title: "Buscador de anuncios (Espiar anuncios)", how: "En scrapecreators.com → copia tu API key y pégala en Vercel como SCRAPECREATORS_API_KEY (Production) y redeploy. Reclama los créditos gratis (¿cómo nos conociste? +1.000, estrella en GitHub +1.000). Después recarga: US$47 = 25.000 créditos (cada búsqueda o guion ≈ 1 crédito, las búsquedas repetidas en 24 h no gastan). Activa la recarga automática si la ofrecen." },
  { id: "inspiracion", title: "Llenar la galería «Recrear video»", how: "Entra a Recrear video (menú Herramientas) y, abajo, «Agregar ejemplo»: sube 8 a 12 anuncios ganadores de tus nichos (hasta 30 s, que tengas permiso para usar), con título, etiqueta (ej. «Seguros · UGC») y una instrucción sugerida. Tus clientes los verán con el botón «Recrear». Antes de lanzar, prueba 1 recreación de cada tipo (gasta créditos reales: unos US$0,85 cambiar elementos de 5 s, US$1,30 copiar movimiento de 10 s)." },
];

/**
 * Order of the red (blocking) work: first what the owner can do alone from his computer (settings and
 * connections), hardest first, with a rough time; then what needs another person or has to wait;
 * then Claude's part. Ids not listed here go last in their group.
 */
export const RED_ORDER: { pc: [string, string][]; otros: [string, string][]; claude: [string, string][] } = {
  pc: [
    ["pasarela", "LLC: días a semanas; claves de prueba de Stripe: 15 min"],
    ["staging", "1–2 h"],
    ["mp-token", "20 min"],
    ["mp-webhook", "20 min"],
    ["gasto-real", "45 min (después de la pasarela)"],
    ["billing", "10 min"],
    ["stats", "5 min"],
    ["meta", "15 min"],
    ["2fa", "1 h (son varias cuentas)"],
    ["claves", "1 h"],
    ["caps", "30 min"],
    ["mal-uso", "30 min (escribir una página)"],
    ["compra", "15 min (cuando la pasarela esté lista)"],
    ["admin", "5 min"],
    ["email", "10 min"],
    ["ai", "15 min"],
    ["cron", "5 min"],
    ["mp-once", "5 min"],
    ["dolar", "5 min"],
    ["vercel-pro", "5 min (pagar)"],
    ["backups", "5 min (pagar)"],
    ["monitor", "10 min"],
    ["alarma-prueba", "2 min (después de los correos)"],
  ],
  otros: [
    ["contador", "una reunión: LLC, impuestos e IVA"],
    ["iva", "se decide en la misma reunión con el contador"],
    ["boletas", "con el contador"],
    ["abogado", "pide hora ya: suele tardar"],
    ["cuota-google", "pedirla 1–2 semanas antes de lanzar"],
    ["beta", "al final, con todo lo de arriba listo"],
    ["dia-1", "lo último, justo antes de la primera venta"],
  ],
  claude: [
    ["c-e2e", "parte cuando el ambiente de pruebas esté listo"],
    ["c-contracargos", "parte cuando la pasarela esté lista"],
    ["c-cola", "parte cuando el ambiente de pruebas esté listo"],
    ["c-carga", "después de la fila, antes de la beta"],
    ["c-gasto", "durante la beta"],
  ],
};

