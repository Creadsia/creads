import { TIPOS, type TipoAngulo } from "./tanda-tipos";

// «Biblioteca de hooks y ángulos por rubro» (25 Oct 2026). Browser-safe data: hook templates by industry and by
// the same 6 angle families as «Primera tanda» (TIPOS). Original wording written for Creads. House rules:
// no income or medical promises, no invented numbers, reviews or testimonials (social-proof templates talk about
// what people ask or do, never counts), Chilean Spanish with «tú». Placeholders: {producto}, {publico}, {precio}.

export const RUBROS = ["ecommerce", "cursos", "salud", "servicios", "leadgen"] as const;
export type Rubro = (typeof RUBROS)[number];
export type Idioma = "es" | "en";
export interface Hook { es: string; en: string }

export const esRubro = (v: unknown): v is Rubro => (RUBROS as readonly string[]).includes(String(v));

export const RUBRO_INFO: Record<Rubro, { label: Record<Idioma, string>; ejemplo: string; nota: string; prompt: string }> = {
  ecommerce: {
    label: { es: "Ecommerce", en: "Ecommerce" },
    ejemplo: "Ej: Botella térmica de acero que mantiene el agua fría 24 horas, para gente que entrena. Cuesta $14.990 con envío gratis.",
    nota: "Productos físicos que se compran en una tienda online.",
    prompt: "Online store selling a physical product: concrete use moments, what's in the box, shipping, returns and price matter.",
  },
  cursos: {
    label: { es: "Cursos e infoproductos", en: "Courses and info products" },
    ejemplo: "Ej: Curso online de Excel para administrativos que quieren dejar de hacer todo a mano. 12 clases cortas, $29.990.",
    nota: "Sin promesas de ingresos ni de resultados garantizados.",
    prompt: "Online course or info product: sell the skill, the format and the time it takes. NEVER promise income, earnings, jobs or guaranteed results.",
  },
  salud: {
    label: { es: "Salud y bienestar", en: "Health and wellness" },
    ejemplo: "Ej: Clases de yoga online para principiantes, 20 minutos al día desde la casa. Primera semana gratis.",
    nota: "Cuidado: nada de curar, sanar ni bajar X kilos. Habla de hábitos y experiencia, no de resultados médicos.",
    prompt: "Health and wellness: talk about habits, routine, comfort and experience. NEVER claim to cure, treat, heal or prevent anything, no weight-loss numbers, no before/after body claims, no medical results.",
  },
  servicios: {
    label: { es: "Servicios", en: "Services" },
    ejemplo: "Ej: Peluquería canina a domicilio en Ñuñoa y Providencia. Agenda por WhatsApp, desde $18.000.",
    nota: "Servicios locales o profesionales: agendar, cotizar, confianza.",
    prompt: "Local or professional service: trust, ease of booking, what happens step by step, coverage area and price range.",
  },
  leadgen: {
    label: { es: "Captación de clientes (seguros, remodelación…)", en: "Lead gen (insurance, remodeling…)" },
    ejemplo: "Ej: Remodelación de baños en Santiago. Visita y presupuesto sin costo, trabajos con garantía por escrito.",
    nota: "El objetivo es que dejen sus datos o pidan una cotización. Seguros: sin prometer coberturas que no están en la póliza.",
    prompt: "Lead generation (insurance, remodeling, solar, legal, etc.): the goal is a quote request or a form. Lower the effort of asking. No invented savings, coverage or prices; insurance claims only as the policy says.",
  },
};

export const HOOKS: Record<Rubro, Record<TipoAngulo, Hook[]>> = {
  ecommerce: {
    dolor: [
      { es: "¿Cansado de comprar algo que se rompe al mes? Mira {producto}.", en: "Tired of buying things that break in a month? Look at {producto}." },
      { es: "Si eres {publico}, ya sabes lo molesto que es esto.", en: "If you're {publico}, you know how annoying this is." },
      { es: "Lo que nadie te dice antes de comprar uno barato.", en: "What nobody tells you before you buy the cheap one." },
      { es: "Ese problema de todos los días tiene una solución simple.", en: "That everyday problem has a simple fix." },
      { es: "Deja de improvisar: {producto} hace lo que necesitas.", en: "Stop improvising: {producto} does what you need." },
    ],
    deseo: [
      { es: "Imagina tu día con {producto} a mano.", en: "Picture your day with {producto} at hand." },
      { es: "El detalle que hace que todo se vea mejor.", en: "The detail that makes everything look better." },
      { es: "Para {publico} que quiere algo que dure.", en: "For {publico} who want something that lasts." },
      { es: "Lo vas a usar más de lo que crees.", en: "You'll use it more than you think." },
      { es: "Así se siente tener lo correcto desde el principio.", en: "This is what having the right thing from day one feels like." },
    ],
    mecanismo: [
      { es: "Por qué {producto} está hecho distinto (y por qué importa).", en: "Why {producto} is made differently (and why it matters)." },
      { es: "Mira de cerca: este es el detalle que lo cambia todo.", en: "Look closely: this is the detail that changes everything." },
      { es: "Lo probamos en el uso diario, no en una foto bonita.", en: "We tested it in daily use, not in a pretty photo." },
      { es: "Tres cosas que tiene {producto} y los otros no.", en: "Three things {producto} has that the others don't." },
    ],
    prueba_social: [
      { es: "Lo que más nos preguntan sobre {producto}, respondido.", en: "The question we get most about {producto}, answered." },
      { es: "¿Sirve para regalar? Una de las preguntas que más nos llegan.", en: "Does it work as a gift? One of the questions we get most." },
      { es: "La duda número uno antes de comprar (y la respuesta).", en: "The number one doubt before buying (and the answer)." },
      { es: "Así lo usan quienes ya lo tienen en casa.", en: "This is how people who already have it use it." },
    ],
    creencia: [
      { es: "«Todos son iguales.» No, y te mostramos por qué.", en: "\"They're all the same.\" They're not, and here's why." },
      { es: "Pensabas que lo bueno tenía que ser caro.", en: "You thought good had to mean expensive." },
      { es: "Comprar online no tiene que ser un riesgo.", en: "Buying online doesn't have to be a gamble." },
      { es: "No necesitas uno más grande, necesitas uno mejor.", en: "You don't need a bigger one, you need a better one." },
    ],
    oferta: [
      { es: "{producto} a {precio}. Sin letra chica.", en: "{producto} for {precio}. No fine print." },
      { es: "Lo que recibes por {precio}, en una sola foto.", en: "Everything you get for {precio}, in one photo." },
      { es: "Pídelo hoy y revisa los plazos de envío en la tienda.", en: "Order today and check delivery times at the store." },
      { es: "Lo que pagas: {precio}. Lo que recibes: {producto}.", en: "What you pay: {precio}. What you get: {producto}." },
      { es: "Si no es lo que esperabas, revisa nuestra política de cambios.", en: "Not what you expected? Check our returns policy." },
    ],
  },

  cursos: {
    dolor: [
      { es: "¿Llevas meses queriendo aprender esto y no partes?", en: "Been meaning to learn this for months and haven't started?" },
      { es: "Ver tutoriales sueltos no es lo mismo que aprender.", en: "Watching random tutorials isn't the same as learning." },
      { es: "Si eres {publico}, esto te está quitando horas cada semana.", en: "If you're {publico}, this is eating hours of your week." },
      { es: "El problema no eres tú, es cómo te lo enseñaron.", en: "The problem isn't you, it's how you were taught." },
      { es: "Basta de empezar de cero cada vez.", en: "Stop starting from scratch every time." },
    ],
    deseo: [
      { es: "Aprende a tu ritmo, desde el celular o el computador.", en: "Learn at your own pace, from your phone or laptop." },
      { es: "Imagina resolverlo tú solo, sin pedirle ayuda a nadie.", en: "Imagine solving it yourself, without asking anyone." },
      { es: "Para {publico} que quiere hacerlo bien, no a medias.", en: "For {publico} who want to do it right, not halfway." },
      { es: "Lo que vas a saber hacer al terminar {producto}.", en: "What you'll know how to do when you finish {producto}." },
    ],
    mecanismo: [
      { es: "Así está armado {producto}: clase por clase.", en: "How {producto} is built: lesson by lesson." },
      { es: "Clases cortas y una tarea práctica en cada una.", en: "Short lessons with a hands-on task in each one." },
      { es: "Por qué empezamos por lo que vas a usar mañana.", en: "Why we start with what you'll use tomorrow." },
      { es: "El método en 3 pasos que seguimos en {producto}.", en: "The 3-step method we follow in {producto}." },
      { es: "Mira una clase completa antes de decidir.", en: "Watch a full lesson before you decide." },
    ],
    prueba_social: [
      { es: "Lo que más nos preguntan antes de inscribirse.", en: "What people ask us most before signing up." },
      { es: "¿Sirve si parto de cero? La pregunta más común.", en: "Does it work if I'm a total beginner? The most common question." },
      { es: "El tipo de persona que suele tomar {producto}.", en: "The kind of person who usually takes {producto}." },
      { es: "Las dudas que nos llegan por mensaje, respondidas.", en: "The questions we get by DM, answered." },
    ],
    creencia: [
      { es: "«No tengo tiempo.» ¿Y 15 minutos al día?", en: "\"I don't have time.\" How about 15 minutes a day?" },
      { es: "No necesitas ser bueno para los números para aprender esto.", en: "You don't need to be a numbers person to learn this." },
      { es: "Aprender online no es aprender solo.", en: "Learning online doesn't mean learning alone." },
      { es: "No es tarde para empezar. Es el momento más fácil.", en: "It's not too late to start. It's the easiest it's been." },
    ],
    oferta: [
      { es: "{producto} completo por {precio}. Acceso para revisarlo cuando quieras.", en: "All of {producto} for {precio}. Access to review it whenever you want." },
      { es: "Mira la primera clase gratis y decide.", en: "Watch the first lesson free, then decide." },
      { es: "Lo que incluye {producto}, sin rodeos.", en: "What {producto} includes, straight up." },
      { es: "Inscripciones abiertas: revisa las fechas en el link.", en: "Enrollment is open: check the dates at the link." },
    ],
  },

  salud: {
    dolor: [
      { es: "¿Terminas el día con cero energía para ti?", en: "Do you end the day with zero energy left for yourself?" },
      { es: "Si eres {publico}, cuidarte no debería ser otra tarea pesada.", en: "If you're {publico}, self-care shouldn't feel like another chore." },
      { es: "Empezar una rutina es fácil. Mantenerla, no tanto.", en: "Starting a routine is easy. Keeping it, not so much." },
      { es: "Sabes que te hace bien, pero nunca encuentras el momento.", en: "You know it's good for you, but you never find the time." },
    ],
    deseo: [
      { es: "Un rato del día que es solo para ti.", en: "A part of your day that's just for you." },
      { es: "Sentirte bien en tu rutina, a tu manera.", en: "Feeling good in your routine, your way." },
      { es: "Para {publico} que quiere un hábito simple y constante.", en: "For {publico} who want a simple, steady habit." },
      { es: "Así se ve una mañana con más calma.", en: "This is what a calmer morning looks like." },
    ],
    mecanismo: [
      { es: "Qué es {producto} y cómo se usa, en 20 segundos.", en: "What {producto} is and how to use it, in 20 seconds." },
      { es: "Pensado para que lo hagas aunque tengas poco tiempo.", en: "Designed so you can do it even when you're short on time." },
      { es: "Lo que trae {producto} y para qué sirve cada parte.", en: "What's in {producto} and what each part is for." },
      { es: "Paso a paso: tu primera semana con {producto}.", en: "Step by step: your first week with {producto}." },
    ],
    prueba_social: [
      { es: "La pregunta que más nos hacen sobre {producto}.", en: "The question we're asked most about {producto}." },
      { es: "Cómo lo integran a su día quienes ya lo usan.", en: "How people who already use it fit it into their day." },
      { es: "¿Es para principiantes? Lo que más nos consultan.", en: "Is it for beginners? What people ask us most." },
      { es: "Las dudas más comunes antes de partir, respondidas.", en: "The most common questions before starting, answered." },
    ],
    creencia: [
      { es: "Cuidarte no tiene que ser todo o nada.", en: "Taking care of yourself doesn't have to be all or nothing." },
      { es: "No necesitas una hora libre para empezar.", en: "You don't need a free hour to get started." },
      { es: "Bienestar no es perfección, es constancia.", en: "Wellness isn't perfection, it's consistency." },
      { es: "Si tienes dudas de salud, consulta a tu médico. Esto es para tu rutina.", en: "Health questions go to your doctor. This is for your routine." },
    ],
    oferta: [
      { es: "Prueba {producto} por {precio}.", en: "Try {producto} for {precio}." },
      { es: "Todo lo que incluye {producto}, sin sorpresas.", en: "Everything included in {producto}, no surprises." },
      { es: "Empieza esta semana: revisa las condiciones en el link.", en: "Start this week: check the terms at the link." },
      { es: "Elige el plan que se acomoda a tu rutina.", en: "Pick the plan that fits your routine." },
    ],
  },

  servicios: {
    dolor: [
      { es: "¿Otra vez esperando a alguien que no llega?", en: "Waiting again for someone who doesn't show up?" },
      { es: "Cotizar con cinco personas para que nadie responda.", en: "Asking five people for a quote and no one replies." },
      { es: "Si eres {publico}, no tienes tiempo para hacerlo tú.", en: "If you're {publico}, you don't have time to do it yourself." },
      { es: "Lo barato salió caro. Otra vez.", en: "The cheap option turned out expensive. Again." },
    ],
    deseo: [
      { es: "Agenda hoy y olvídate del tema.", en: "Book today and forget about it." },
      { es: "Un servicio que llega, cumple y te avisa.", en: "A service that shows up, delivers and keeps you posted." },
      { es: "Para {publico} que valora su tiempo.", en: "For {publico} who value their time." },
      { es: "Así queda cuando lo hace alguien que sabe.", en: "This is how it looks when someone who knows does it." },
    ],
    mecanismo: [
      { es: "Cómo trabajamos: del primer mensaje al trabajo terminado.", en: "How we work: from the first message to the finished job." },
      { es: "Precio claro antes de empezar. Así funciona {producto}.", en: "A clear price before we start. That's how {producto} works." },
      { es: "Lo que revisamos en cada visita (y casi nadie revisa).", en: "What we check on every visit (that almost nobody does)." },
      { es: "Tres pasos y listo: escribes, agendamos, lo hacemos.", en: "Three steps: you message, we schedule, we do it." },
    ],
    prueba_social: [
      { es: "Lo que más nos preguntan antes de agendar.", en: "What people ask us most before booking." },
      { es: "¿Llegan a mi comuna? La pregunta del día.", en: "Do you cover my area? The question of the day." },
      { es: "Así se ve un trabajo nuestro, sin filtros.", en: "This is one of our jobs, no filters." },
      { es: "¿Cuánto se demora? Lo primero que todos preguntan.", en: "How long does it take? The first thing everyone asks." },
    ],
    creencia: [
      { es: "Un buen servicio no tiene que costar una fortuna.", en: "Good service doesn't have to cost a fortune." },
      { es: "«Lo hago yo y me ahorro la plata.» ¿Seguro?", en: "\"I'll do it myself and save the money.\" Are you sure?" },
      { es: "Pedir una cotización no te compromete a nada.", en: "Asking for a quote doesn't commit you to anything." },
      { es: "Profesional no significa complicado.", en: "Professional doesn't mean complicated." },
    ],
    oferta: [
      { es: "{producto} desde {precio}. Cotiza sin compromiso.", en: "{producto} from {precio}. No-obligation quote." },
      { es: "Escríbenos hoy y te respondemos con fecha y precio.", en: "Message us today and get a date and a price." },
      { es: "Revisa disponibilidad para esta semana.", en: "Check availability for this week." },
      { es: "Todo lo que incluye el servicio, escrito antes de empezar.", en: "Everything the service includes, in writing before we start." },
    ],
  },

  leadgen: {
    dolor: [
      { es: "¿Sabes realmente qué cubre lo que ya pagas?", en: "Do you really know what you're already paying for covers?" },
      { es: "Ese arreglo que llevas años postergando.", en: "That repair you've been putting off for years." },
      { es: "Si eres {publico}, esto te puede salir caro si esperas.", en: "If you're {publico}, waiting on this can get expensive." },
      { es: "Pedir presupuestos no debería tomarte una semana.", en: "Getting quotes shouldn't take you a week." },
    ],
    deseo: [
      { es: "Imagina tu casa como siempre la quisiste.", en: "Picture your home the way you always wanted it." },
      { es: "La tranquilidad de saber que estás cubierto.", en: "The peace of mind of knowing you're covered." },
      { es: "Para {publico} que quiere decidir con información clara.", en: "For {publico} who want to decide with clear information." },
      { es: "Primero ve las opciones. Después decides.", en: "See the options first. Decide later." },
    ],
    mecanismo: [
      { es: "Cómo funciona: dejas tus datos, te llamamos, recibes tu propuesta.", en: "How it works: leave your details, we call, you get a proposal." },
      { es: "Comparamos las opciones por ti y te las explicamos simple.", en: "We compare the options for you and explain them simply." },
      { es: "Qué revisamos en la visita técnica de {producto}.", en: "What we check during the {producto} site visit." },
      { es: "Lo que tiene que decir una buena cotización (por escrito).", en: "What a good quote should say (in writing)." },
    ],
    prueba_social: [
      { es: "Lo que más nos preguntan antes de pedir una cotización.", en: "What people ask most before requesting a quote." },
      { es: "La duda más común sobre {producto}, respondida.", en: "The most common question about {producto}, answered." },
      { es: "Así quedó un trabajo reciente (fotos reales del proyecto).", en: "A recent job, as it turned out (real project photos)." },
      { es: "¿Ya tienes otra cotización? Pídenos una segunda opinión.", en: "Already have a quote? Ask us for a second opinion." },
    ],
    creencia: [
      { es: "Cotizar no te compromete a contratar.", en: "Getting a quote doesn't commit you to hiring." },
      { es: "«Eso es carísimo.» ¿Ya lo cotizaste?", en: "\"That's way too expensive.\" Have you actually priced it?" },
      { es: "La letra chica sí se puede entender. Te la explicamos.", en: "The fine print can make sense. We'll walk you through it." },
      { es: "No necesitas saber de construcción para pedir un buen presupuesto.", en: "You don't need to know construction to get a good quote." },
    ],
    oferta: [
      { es: "Cotización sin costo. Deja tus datos en 1 minuto.", en: "Free quote. Leave your details in a minute." },
      { es: "Agenda tu visita y recibe tu presupuesto por escrito.", en: "Book a visit and get your quote in writing." },
      { es: "{producto} desde {precio}: pide el detalle para tu caso.", en: "{producto} from {precio}: ask for the details for your case." },
      { es: "Te llamamos en el horario que elijas.", en: "We call you at the time you choose." },
    ],
  },
};

export const PLACEHOLDERS = ["producto", "publico", "precio"] as const;
export type Vars = Partial<Record<(typeof PLACEHOLDERS)[number], string>>;

/** Fills {producto}, {publico}, {precio}; empty values keep the placeholder so the gap stays visible. */
export const rellenar = (tpl: string, v: Vars) =>
  tpl.replace(/\{(producto|publico|precio)\}/g, (m, k: keyof Vars) => (v[k]?.trim() ? v[k]!.trim() : m));

/** The line added to the angles prompt of «Primera tanda» when the customer comes from a rubro. */
export const rubroPrompt = (r: Rubro) => `INDUSTRY: ${RUBRO_INFO[r].label.en}. ${RUBRO_INFO[r].prompt}`;

export const todosLosHooks = () => RUBROS.flatMap((r) => TIPOS.flatMap((t) => HOOKS[r][t].map((h) => ({ rubro: r, tipo: t, ...h }))));
