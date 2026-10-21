// Step-by-step guides inside the studio. Each guide belongs to one screen (`path`) and starts by
// itself the first time a customer opens it (once per browser), or later from the "?" button.
// A step points at an element marked with data-tour="<target>". If that element isn't on screen
// (a phone menu that's closed, a list still empty), the step shows in the middle of the screen —
// or is skipped when it's `optional`. A guide with `when` waits until that element exists (for
// screens that change as you go, like the steps of «Crear anuncio»).
// Help videos live in /public/ayuda/<video>.mp4 with a poster <video>.jpg (see VIDEOS). They are recorded
// from the real studio with demo data (no credits spent); re-record them when a screen changes a lot.
// A link to <path>?guia=<id> opens that screen and starts that guide.

export interface TourStep { target?: string; title: string; text: string; optional?: boolean }
/** `listed`: shown in the help center's list of guides (the main guide of each screen). */
export interface Tour { id: string; path: string; exact?: boolean; when?: string; title: string; steps: TourStep[]; video?: string; listed?: boolean }

export const TOURS: Tour[] = [
  {
    id: "inicio", path: "/app", exact: true, title: "Recorrido por Creads", video: "primer-anuncio", listed: true,
    steps: [
      { title: "Bienvenido a Creads 👋", text: "En 1 minuto te muestro dónde está cada cosa. Puedes saltar la guía cuando quieras y volver a verla con el botón «Ayuda» de arriba." },
      { target: "nav-campana|nav-menu", title: "Tu anuncio, paso a paso", text: "En el menú, «Haz tu anuncio» es cómo se hace cada anuncio: 1) espía qué está funcionando (opcional), 2) escribe el guion, 3) graba y escucha la voz, 4) crea el video." },
      { target: "nav-marca|nav-menu", title: "Tu marca, una sola vez", text: "En «Tu marca» van tu voz, tu avatar (la cara de quien habla) y tus productos. Se configuran una vez y sirven para todos tus anuncios." },
      { target: "primeros-pasos", title: "Tu lista para partir", text: "Aquí vas viendo qué te falta. El paso marcado es el siguiente que te conviene hacer.", optional: true },
      { target: "creditos", title: "Tus créditos", text: "Cada video, imagen o voz usa créditos. Si algo falla, los créditos vuelven solos." },
      { target: "ayuda", title: "¿Te perdiste? Aquí está la ayuda", text: "En «Ayuda» tienes la guía de cada pantalla y un video corto de cómo se hace. Y abajo a la derecha, el asistente responde tus dudas al tiro." },
    ],
  },
  {
    id: "espiar", path: "/app/spy", title: "Cómo espiar anuncios", video: "espiar-anuncios", listed: true,
    steps: [
      { target: "spy-buscar", title: "Escribe qué vendes", text: "Tu nicho o tu producto, como lo buscaría un cliente. Ej: «seguro de auto», «remodelación de baño»." },
      { target: "spy-pais", title: "Elige el país", text: "Te muestra los anuncios activos en ese país, en su idioma." },
      { target: "spy-filtros", title: "Mejor solo videos", text: "Deja marcado «Solo videos» si vas a hacer anuncios en video. Las ideas de abajo buscan con un toque." },
      { title: "Y a espiar", text: "Toca «Espiar anuncios». Cuando aparezcan los resultados, te muestro cómo saber cuáles están vendiendo." },
    ],
  },
  {
    id: "espiar-res", path: "/app/spy", when: "spy-resultados", title: "Cómo leer los resultados",
    steps: [
      { target: "spy-card", title: "Fíjate en los días activo", text: "🔥 Un anuncio que lleva 30 días o más, y con varias versiones, casi seguro le está funcionando al anunciante: nadie paga tanto tiempo algo que no vende." },
      { target: "spy-dias", title: "Filtra los que venden", text: "Con +30 o +60 días te quedas solo con los que llevan tiempo activos." },
      { target: "spy-desarmar", title: "Desarma el guion", text: "Sacamos lo que dice el video y lo llevamos a «Crear guion» para que hagas tu propia versión, sin copiarlo." },
    ],
  },
  {
    id: "guion", path: "/app/guiones", title: "Cómo crear un guion", video: "crear-guion", listed: true,
    steps: [
      { target: "guion-texto", title: "Pega el guion ganador", text: "Lo que dice la persona en el video: uno tuyo que funcionó o uno de la competencia que esté activo hace tiempo." },
      { target: "guion-contexto", title: "Cuéntanos qué vendes", text: "Idioma, nicho y tu oferta. Con esto la IA escribe para tu negocio y no para el de la competencia." },
      { target: "guion-modos", title: "Elige qué hacer", text: "«Desarmar» te explica por qué funciona. «Hacer mi versión» escribe 3 guiones originales. También hay 10 hooks nuevos, 3 ángulos o mejorar línea por línea." },
      { title: "Cuando te guste, llévalo a video", text: "Con el guion listo toca «Llevar a Crear anuncio». Lo guardamos para que no se pierda." },
    ],
  },
  {
    id: "guion-ref", path: "/app/guiones", when: "guion-ref", title: "Partiste de un anuncio espiado",
    steps: [
      { target: "guion-ref", title: "Este es el anuncio que espiaste", text: "Arriba ves de quién es y cuántos días lleva activo. Abajo quedó lo que dice el anuncio, para que lo trabajes." },
      { target: "guion-ref-mia", title: "Haz tu versión", text: "Escribe 3 guiones originales para tu negocio con lo que hace funcionar este anuncio. Antes, completa «Qué vendes» más abajo." },
    ],
  },
  {
    id: "crear", path: "/app/crear", when: "crear-guion", title: "Cómo crear un anuncio", video: "primer-anuncio", listed: true,
    steps: [
      { target: "crear-pasos", title: "4 pasos y listo", text: "Guion → cortes → escenas → videos. Puedes volver a cualquier paso sin perder lo que hiciste." },
      { target: "crear-guion", title: "Pega tu guion", text: "Si vienes de «Crear guion», ya está aquí. Arriba a la derecha eliges el idioma en que habla el video." },
      { target: "crear-formato", title: "Elige el formato", text: "UGC (una persona a cámara) y Podcast son los que más venden para captar contactos. Abajo te explicamos el que elijas." },
      { target: "crear-dividir", title: "Divide en cortes", text: "Cada corte es un video corto. Con 6 a 8 cortes el anuncio queda dinámico. Después revisas y corriges el texto de cada uno." },
    ],
  },
  {
    id: "crear-escenas", path: "/app/crear", when: "crear-escenas", title: "Las escenas de tu anuncio",
    steps: [
      { target: "crear-quien", title: "¿Quién habla?", text: "Elige tu avatar para que sea la misma persona en todos los cortes. Si no tienes, descríbela o créalo en «Avatares».", optional: true },
      { target: "crear-direccion", title: "Dirige el video (opcional)", text: "Escribe en español lo que quieres ver: dónde está, qué hace, más energía en el hook…" },
      { target: "crear-escenas-btn", title: "Crea los prompts", text: "Creads escribe la escena de cada corte sin cambiar tus palabras. Elige vertical 9:16 para Reels o 4:5 para el feed (con Veo sale en 9:16)." },
    ],
  },
  {
    id: "crear-videos", path: "/app/crear", when: "crear-modelo", title: "Generar los videos",
    steps: [
      { target: "crear-modelo", title: "Elige el modelo", text: "El recomendado es el mejor equilibrio entre calidad y precio. Cada uno dice cuánto cuesta un corte de 8 segundos." },
      { target: "crear-precio", title: "Revisa el precio antes", text: "Ves el total del anuncio y los créditos que te quedan. Si un corte falla, sus créditos vuelven solos." },
      { title: "Y a esperar un par de minutos", text: "Los cortes se generan, se revisan y se arman con voz y subtítulos. Lo encuentras en «En producción» y, terminado, en «Anuncios terminados»." },
    ],
  },
  {
    id: "voces", path: "/app/voces", title: "Cómo clonar tu voz", video: "clonar-voz", listed: true,
    steps: [
      { target: "voz-subir", title: "Sube o graba audio", text: "1 a 3 minutos de la persona hablando sola, sin música ni ruido. Un audio de WhatsApp sirve. También puedes grabar aquí con el micrófono." },
      { target: "voz-permiso", title: "Con permiso, siempre", text: "Solo puedes clonar tu voz o la de alguien que te dio permiso. Es obligatorio." },
      { target: "voz-crear", title: "Crea la voz", text: "En segundos queda lista. Después la eliges al crear tu avatar." },
    ],
  },
  {
    id: "avatares", path: "/app/avatares", title: "Cómo crear tu avatar", video: "crear-avatar", listed: true,
    steps: [
      { target: "avatar-nuevo", title: "Tu presentador fijo", text: "Un avatar es la persona que habla en tus anuncios: su cara y su voz. Se crea una vez." },
    ],
  },
  {
    id: "avatar-form", path: "/app/avatares", when: "avatar-foto", title: "Nuevo avatar",
    steps: [
      { target: "avatar-foto", title: "Una buena foto", text: "De frente, con buena luz y sin lentes de sol. Es la cara que va a aparecer en todos los cortes." },
      { target: "avatar-como", title: "Cómo es", text: "Edad, pelo, ropa… mejor en inglés. Ayuda a que la persona sea siempre la misma." },
      { target: "avatar-voz", title: "Su voz", text: "Elige la voz que clonaste en «Voces» o una de la biblioteca, y el idioma en que habla." },
      { target: "avatar-permiso", title: "Con permiso, siempre", text: "Solo con el permiso de la persona para usar su cara y su voz en anuncios." },
    ],
  },
  {
    id: "historias", path: "/app/historias", when: "hist-ideas", title: "Cómo crear una historia animada", listed: true,
    steps: [
      { target: "hist-ideas", title: "Parte de una idea", text: "Toca una de estas ideas y la ves armada: historia, cómo hablan los personajes, estilo y sonido. Después la cambias a tu gusto." },
      { target: "hist-sound", title: "Elige cómo suena", text: "Personajes que hablan con sus labios, narrador, música IA, una canción con letra, tu propia música o nada. Se combinan como quieras." },
      { target: "hist-crear", title: "Escribe el guion", text: "Es gratis. Después revisas el guion toma por toma, creas los personajes, las imágenes, las animas y armas la película. Pagas cada paso cuando lo apruebas." },
    ],
  },
  {
    id: "recrear", path: "/app/recrear", title: "Cómo recrear un video", video: "recrear-video", listed: true,
    steps: [
      { target: "recrear-modos", title: "Sube un video que te guste", text: "Elige: cambiar la persona, el producto, la ropa o el lugar con tus fotos (mismo movimiento y audio), o que tu personaje en una foto copie los mismos gestos y movimientos." },
      { target: "recrear-galeria", title: "O parte de un ejemplo", text: "Anuncios que funcionan. Toca «Recrear» y cámbiales lo que quieras por lo tuyo." },
    ],
  },
];

/** Help videos (in /public/ayuda), shown in the Centro de ayuda and in each screen's "?" menu. */
export const VIDEOS: { id: string; title: string; text: string; secs: number }[] = [
  { id: "primer-anuncio", title: "Tu primer anuncio, de principio a fin", text: "Del guion al video: formato, cortes, escenas y modelo.", secs: 72 },
  { id: "espiar-anuncios", title: "Espiar anuncios que funcionan", text: "Busca en tu nicho, filtra por días activo y desarma el guion.", secs: 44 },
  { id: "crear-guion", title: "Hacer tu versión de un guion ganador", text: "Desarmar, hooks, ángulos y tu propia versión.", secs: 44 },
  { id: "clonar-voz", title: "Clonar tu voz", text: "Qué audio subir y cómo queda lista.", secs: 32 },
  { id: "crear-avatar", title: "Crear tu avatar", text: "Foto, descripción, voz y permiso.", secs: 37 },
  { id: "recrear-video", title: "Recrear un video", text: "Cambia la persona, el producto o copia el movimiento.", secs: 50 },
];

export const tourMatches = (t: Tour, path: string) => (t.exact ? path === t.path : path === t.path || path.startsWith(`${t.path}/`));
export const toursFor = (path: string) => TOURS.filter((t) => tourMatches(t, path));
