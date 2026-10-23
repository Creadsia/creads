// The help center: short answers to what customers ask most, each with a link to where it's done.
// The same articles feed the in-app assistant (src/app/api/asistente), so a fix here fixes both.
// Safe for the browser. Keep answers short, in tú, and true to how the product works today.

export interface HelpLink { label: string; href: string }
export interface HelpArticle {
  id: string;
  cat: HelpCat;
  q: string;
  a: string;
  link?: HelpLink;
  /** Extra words people use for the same thing (for the search box). */
  tags?: string;
}

export const HELP_CATS = [
  { id: "empezar", label: "Empezar" },
  { id: "creditos", label: "Créditos y planes" },
  { id: "crear", label: "Crear anuncios" },
  { id: "marca", label: "Voces, avatares y productos" },
  { id: "herramientas", label: "Imágenes" },
  { id: "problemas", label: "Si algo falla" },
  { id: "cuenta", label: "Tu cuenta" },
] as const;
export type HelpCat = (typeof HELP_CATS)[number]["id"];

export const HELP: HelpArticle[] = [
  // ---------- empezar ----------
  {
    id: "primer-anuncio", cat: "empezar",
    q: "¿Cómo hago mi primer anuncio?",
    a: "Son 3 pasos. 1) Espiar anuncios: busca tu nicho y elige uno que lleve semanas activo. 2) Crear guion: pégalo y pide «Desarmar», «10 hooks» o «3 ángulos»; al final toca «Pasar a crear mi anuncio» y el guion se copia solo. 3) Crear anuncio: elige el formato, tu avatar y tu voz, revisa el precio y genera.",
    link: { label: "Crear mi guion", href: "/app/guiones" },
    tags: "empezar inicio partir tutorial pasos",
  },
  {
    id: "espiar", cat: "empezar",
    q: "¿Cómo encuentro anuncios que funcionan?",
    a: "En «Espiar anuncios» escribe qué vendes y elige tu país: ves los anuncios activos de Facebook e Instagram ordenados por días activo. Un anuncio que lleva 30 días o más está vendiendo. Toca «Desarmar este guion» y lo llevamos a «Crear guion» para hacer tu versión.",
    link: { label: "Espiar anuncios", href: "/app/spy" },
    tags: "espiar competencia biblioteca meta facebook ads library ganadores",
  },
  {
    id: "orden-marca", cat: "empezar",
    q: "¿Qué tengo que preparar antes de crear?",
    a: "En «Tu marca»: primero tu voz (clonada o una de la biblioteca), después tu avatar (tu cara o uno creado con IA) y, si quieres, tus productos. Lo haces una vez y queda guardado para todos tus anuncios.",
    link: { label: "Ir a Voces", href: "/app/voces" },
    tags: "marca preparar configurar",
  },
  {
    id: "app", cat: "empezar",
    q: "¿Hay app para el celular?",
    a: "Sí: instálala desde el menú de tu cuenta, en «Instalar la app». En iPhone se instala desde Safari con «Compartir» → «Agregar a pantalla de inicio». Funciona igual que en el computador.",
    tags: "celular iphone android instalar aplicación móvil",
  },

  // ---------- créditos y planes ----------
  {
    id: "que-es-credito", cat: "creditos",
    q: "¿Qué es un crédito y cuánto cuesta cada cosa?",
    a: "Es lo que gastas al generar. Siempre ves el costo en créditos antes de apretar el botón. Como referencia: un anuncio UGC de 30 s con Veo 3.1 Fast son unos 300 créditos, una foto de producto 8, un borrador de 8 s con Veo 3.1 Lite unos 40. Escribir guiones, escenas y la revisión de calidad no gastan créditos.",
    link: { label: "Ver mis créditos", href: "/app/planes" },
    tags: "precio costo cuanto sale cobran gasto",
  },
  {
    id: "planes", cat: "creditos",
    q: "¿Qué planes hay?",
    a: "Básico US$25 al mes (500 créditos), Emprende US$55 al mes (1.500 créditos) y Negocio US$99 al mes (3.000 créditos). Todo se paga con esos créditos: videos, imágenes y voces. Un segundo de video con persona IA usa unos 11 créditos. Sin permanencia: cancelas cuando quieras.",
    link: { label: "Ver planes", href: "/app/planes" },
    tags: "precio starter plus studio mensual anual descuento",
  },
  {
    id: "vencen", cat: "creditos",
    q: "¿Los créditos vencen?",
    a: "Sí: duran el mes que pagaste. Los que no uses vencen cuando termina ese período. Te avisamos por correo antes de que venzan.",
    link: { label: "Ver mi vencimiento", href: "/app/planes" },
    tags: "expiran vencimiento caducan acumulan",
  },
  {
    id: "recargas", cat: "creditos",
    q: "Me quedé sin créditos, ¿cómo recargo?",
    a: "En «Planes y créditos» compras una recarga sin cambiar de plan: 500 créditos por US$29, 1.000 por US$55 o 3.000 por US$139. Necesitas un plan activo, y las recargas vencen junto con tu plan.",
    link: { label: "Recargar créditos", href: "/app/planes" },
    tags: "recarga pack comprar mas creditos saldo sin saldo",
  },
  {
    id: "pago", cat: "creditos",
    q: "¿Cómo pago? ¿Me llega comprobante?",
    a: "Los precios están en dólares y se cobran en pesos chilenos al cambio del día. Pagas en una ventana segura: Creads nunca ve tu tarjeta. Los créditos se cargan apenas se aprueba el pago y el comprobante te llega al correo.",
    link: { label: "Planes y créditos", href: "/app/planes" },
    tags: "pagar tarjeta debito credito boleta factura comprobante pesos dolares",
  },
  {
    id: "renovacion", cat: "creditos",
    q: "¿Cómo cancelo o cambio mi plan?",
    a: "En «Planes y créditos» → «Cancelar renovación», con un clic. Sigues con tu plan y tus créditos hasta la fecha pagada. Para subir o bajar de plan, elige el nuevo plan en la misma página.",
    link: { label: "Planes y créditos", href: "/app/planes" },
    tags: "cancelar baja suscripcion renovacion cambiar plan subir bajar",
  },
  {
    id: "devolucion", cat: "creditos",
    q: "¿Me pueden devolver el pago?",
    a: "Si no has usado ningún crédito de esa compra y nos escribes dentro de los 10 días siguientes, te devolvemos el pago. Si ya usaste créditos, no aplica, porque el servicio se entrega al instante.",
    link: { label: "Ver términos", href: "/terminos" },
    tags: "reembolso devolucion plata dinero retracto",
  },

  // ---------- crear ----------
  {
    id: "formatos", cat: "crear",
    q: "¿Qué formatos de anuncio puedo hacer?",
    a: "UGC selfie (una persona hablando a cámara), Voz en off + escenas, Antes / después, Entrevista callejera, Podcast, Reportaje en terreno, Ronda de testimonios y Respuesta a comentario, además de Historias animadas. Elige el que más se use en tu nicho: los ganadores de la Biblioteca de Meta te dan la pista.",
    link: { label: "Crear anuncio", href: "/app/crear" },
    tags: "formato ugc podcast noticiero reportaje entrevista testimonios voz en off antes despues historias animadas",
  },
  {
    id: "modelo", cat: "crear",
    q: "¿Qué modelo de video elijo?",
    a: "Veo 3.1 Fast (Recomendado): el mejor equilibrio entre calidad y precio. Veo 3.1 Lite (Más económico): ideal para probar hooks rápido. Veo 3.1 (Máxima calidad): para el anuncio final. También tienes Kling, Seedance y más en «Video e imagen IA».",
    link: { label: "Crear anuncio", href: "/app/crear" },
    tags: "veo kling seedance modelo calidad barato",
  },
  {
    id: "calidad", cat: "crear",
    q: "¿Qué es la revisión de calidad automática?",
    a: "Cuando termina cada escena, Creads la revisa sola (que diga el texto correcto, sin errores visibles). Si encuentra un error, te marca qué corte es y qué falló, para que lo rehagas con una nota de qué cambiar (cuesta los créditos de ese corte). Si un modelo falla y no entrega nada, los créditos vuelven solos.",
    tags: "qa revision error rehacer calidad",
  },
  {
    id: "tiempo", cat: "crear",
    q: "¿Cuánto se demora en generar?",
    a: "Una imagen, segundos. Un video de 8 s, normalmente 1 a 4 minutos. Un anuncio completo, unos minutos más por el montaje y los subtítulos. Mientras genera ves los segundos que lleva, y puedes cerrar la página: queda guardado.",
    tags: "demora tarda lento cuanto tiempo esperando cargando",
  },
  {
    id: "descargar", cat: "crear",
    q: "¿Dónde quedan mis anuncios y cómo los descargo?",
    a: "Los que se están haciendo, en «En producción». Los listos, en «Anuncios terminados», con el botón «Descargar». Lo que hagas en las herramientas queda en «Tus creaciones».",
    link: { label: "Anuncios terminados", href: "/app/biblioteca" },
    tags: "descargar bajar guardar biblioteca donde quedo",
  },
  {
    id: "derechos", cat: "crear",
    q: "¿Puedo usar los anuncios en mis campañas o para clientes?",
    a: "Sí, lo que creas es tuyo: lo puedes publicar en tus campañas y en las de tus clientes. Lo único: necesitas permiso de las personas cuya cara o voz uses.",
    tags: "derechos comercial uso clientes agencia propiedad",
  },

  // ---------- marca ----------
  {
    id: "clonar-voz", cat: "marca",
    q: "¿Cómo clono mi voz?",
    a: "En «Voces», sube o graba de 1 a 3 minutos de una sola persona hablando, sin música ni ruido (sirven audios de WhatsApp o notas de voz). Necesitas el permiso de esa persona. En unos minutos tus anuncios hablan con esa voz.",
    link: { label: "Ir a Voces", href: "/app/voces" },
    tags: "voz clonar clonada grabar audio",
  },
  {
    id: "avatar", cat: "marca",
    q: "¿Cómo creo mi avatar?",
    a: "En «Avatares», sube una foto clara de la cara (de frente y con buena luz). Necesitas el permiso de esa persona. Después lo eliges al crear cada anuncio.",
    link: { label: "Ir a Avatares", href: "/app/avatares" },
    tags: "avatar cara persona actor foto",
  },
  {
    id: "producto", cat: "marca",
    q: "¿Para qué sirve cargar mis productos?",
    a: "Es opcional. Si subes fotos de tu producto, Creads lo usa en las escenas y en las fotos para el feed, así aparece tal como es.",
    link: { label: "Ir a Productos", href: "/app/productos" },
    tags: "producto foto marca empaque",
  },

  // ---------- herramientas ----------
  // Recrear video, Herramientas IA and Doblaje are hidden since 21 Oct 2026 (Creads sells UGC ads and images).
  {
    id: "imagenes", cat: "herramientas",
    q: "¿Cómo hago imágenes para mis anuncios?",
    a: "En «Imágenes para anuncios» describe tu anuncio, elige cuántas imágenes quieres y el formato (4:5 para el feed). Si subes la foto de tu avatar o de tu producto, aparecen tal cual. Creads escribe una idea distinta para cada imagen y revisa cada una al salir.",
    link: { label: "Imágenes para anuncios", href: "/app/laboratorio" },
    tags: "imagen imagenes foto feed 4:5 banner",
  },

  // ---------- problemas ----------
  {
    id: "fallo", cat: "problemas",
    q: "Mi video falló, ¿perdí mis créditos?",
    a: "No. Si se usaron créditos y el trabajo falla, vuelven solos a tu saldo, sin que tengas que pedirlo (los ves en tus movimientos). Puedes reintentarlo; si vuelve a fallar, prueba con otro modelo o cambia un poco la instrucción.",
    link: { label: "Ver mis movimientos", href: "/app/planes" },
    tags: "fallo error fallo devolvieron creditos perdi cobro",
  },
  {
    id: "rechazado", cat: "problemas",
    q: "Me dice que el contenido fue rechazado",
    a: "Los modelos rechazan algunas cosas: personas famosas, marcas registradas, menores, violencia o desnudos. Cambia la instrucción o la foto y vuelve a intentar. Los créditos de lo rechazado vuelven solos.",
    tags: "rechazado bloqueado no permitido politica contenido",
  },
  {
    id: "pegado", cat: "problemas",
    q: "Se quedó cargando mucho rato",
    a: "Algunos videos tardan más cuando hay mucha demanda. Puedes cerrar la página y volver: el trabajo sigue y queda guardado. Si pasan más de 15 minutos, recarga la página; si falló, los créditos vuelven solos.",
    tags: "pegado cargando lento no termina colgado",
  },
  {
    id: "cara-no-sale", cat: "problemas",
    q: "El modelo no acepta la cara de mi avatar",
    a: "Algunos modelos no trabajan con caras de personas reales. Reintenta las escenas fallidas con otro modelo desde el mismo anuncio: el botón aparece arriba de las escenas que fallaron.",
    link: { label: "En producción", href: "/app/videos" },
    tags: "cara avatar rechaza modelo persona",
  },
  {
    id: "codigo-ref", cat: "problemas",
    q: "Me apareció un error con un código de referencia",
    a: "Ese código nos permite encontrar exactamente qué pasó. Normalmente es algo pasajero: espera un minuto y reintenta. Si se repite, escríbelo en el asistente o en tu correo a hola@creadsia.com.",
    tags: "codigo referencia error ref",
  },

  // ---------- cuenta ----------
  {
    id: "clave", cat: "cuenta",
    q: "Olvidé mi clave",
    a: "En la pantalla de entrada toca «¿Olvidaste tu clave?» y escribe tu correo. Te llega un enlace que dura 1 hora para crear una nueva.",
    tags: "clave contraseña password olvide entrar acceso",
  },
  {
    id: "correos", cat: "cuenta",
    q: "No quiero recibir correos con consejos",
    a: "Cada correo de consejos trae abajo el enlace «No quiero recibir más consejos». Los avisos de tu cuenta (pagos, vencimientos, clave) siempre te llegan.",
    tags: "correos email spam baja desuscribir",
  },
  {
    id: "equipo", cat: "cuenta",
    q: "¿Puede trabajar más gente en mi cuenta?",
    a: "Sí: el plan Ultra incluye 3 usuarios trabajando en la misma cuenta, con los mismos avatares, voces y créditos. Para sumar a alguien, escríbenos a hola@creadsia.com con su correo y lo agregamos.",
    link: { label: "Ver planes", href: "/app/planes" },
    tags: "equipo usuarios agencia compartir cuenta",
  },
  {
    id: "datos", cat: "cuenta",
    q: "¿Qué hacen con mis fotos, voces y datos?",
    a: "Se guardan en una carpeta privada de tu cuenta y solo se usan para crear tu contenido. Nunca usamos tu cara o tu voz para otra cosa. Si quieres borrar tu cuenta y tus archivos, escríbenos a hola@creadsia.com.",
    link: { label: "Privacidad", href: "/privacidad" },
    tags: "privacidad datos borrar cuenta eliminar seguridad",
  },
];

/** Studio pages the assistant may link to (anything else it suggests is dropped). */
export const HELP_PLACES: HelpLink[] = [
  { label: "Inicio", href: "/app" },
  { label: "Espiar anuncios", href: "/app/spy" },
  { label: "Crear guion", href: "/app/guiones" },
  { label: "Crear anuncio", href: "/app/crear" },
  { label: "Voces", href: "/app/voces" },
  { label: "Avatares", href: "/app/avatares" },
  { label: "Productos", href: "/app/productos" },
  { label: "En producción", href: "/app/videos" },
  { label: "Anuncios terminados", href: "/app/biblioteca" },
  { label: "Imágenes para anuncios", href: "/app/laboratorio" },
  { label: "Planes y créditos", href: "/app/planes" },
  { label: "Mi cuenta", href: "/app/cuenta" },
  { label: "Centro de ayuda", href: "/app/ayuda" },
  { label: "Términos", href: "/terminos" },
  { label: "Privacidad", href: "/privacidad" },
];

/** True if the assistant may link there (one of the places above, or a tool page). */
export function allowedHelpLink(href: unknown): href is string {
  if (typeof href !== "string" || href.length > 80) return false;
  if (HELP_PLACES.some((p) => p.href === href)) return true;
  return /^\/app\/herramientas\/[a-z-]{3,30}$/.test(href);
}

// words that don't help find anything
const STOP = new Set("como que por para con los las del una uno unos unas mis tus sus que hay hago hace puedo quiero tengo esta este esto son ser donde cual cuando porque pero mas".split(" "));
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Articles matching a search, best first (every word must appear somewhere). */
export function searchHelp(query: string, list: HelpArticle[] = HELP): HelpArticle[] {
  const words = fold(query).split(/[^a-z0-9ñ]+/).filter((w) => w.length > 2 && !STOP.has(w));
  if (!words.length) return list;
  const scored = list.map((h) => {
    const q = fold(h.q), body = fold(`${h.a} ${h.tags ?? ""}`);
    let score = 0;
    for (const w of words) {
      if (q.includes(w)) score += 3;
      else if (body.includes(w)) score += 1;
      else return { h, score: -1 };
    }
    return { h, score };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.h);
}
