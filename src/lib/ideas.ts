// Real ads made with Creads (25 Oct 2026), shown on the home page and in the studio's «Galería de ideas».
// Every brand on them is invented. They use ad formats that are common among ads that scale in ecommerce,
// affiliate, nutra and lead gen (before/after, us vs them, listicle, quiz, native post, UGC selfie, offer
// bundle…); nothing here claims these exact ads were tested. Browser-safe (no node imports).
// To add one: put the image in /public/ejemplos (4:5, 600×750) or /public/ideas (9:16, 450×800) and list it.

export type Rubro = "ecommerce" | "nutra" | "afiliados" | "leadgen";
export const RUBROS: { id: Rubro; label: string }[] = [
  { id: "ecommerce", label: "Ecommerce" },
  { id: "nutra", label: "Nutra" },
  { id: "afiliados", label: "Afiliados" },
  { id: "leadgen", label: "Lead gen" },
];

export interface Idea {
  id: string;
  src: string;
  formato: "4:5" | "9:16";
  rubro: Rubro;
  idioma: "es" | "en";
  /** the ad format, as media buyers call it */
  tipo: string;
  /** what makes this format work, one line */
  porque: string;
  /** a ready brief to make one like it for your product ({producto} is replaced) */
  brief: string;
  /** shown on the home page */
  portada?: boolean;
}

export const IDEAS: Idea[] = [
  { id: "stride-flash", src: "/ejemplos/stride-flash.jpg", formato: "4:5", rubro: "ecommerce", idioma: "es", tipo: "Oferta flash", porque: "Descuento grande y fecha de término: urgencia en un vistazo.", brief: "{producto} floating over a bold gradient in the brand colour, huge «-40% SOLO HOY», free-shipping line, «Termina a medianoche» pill, button at the bottom.", portada: true },
  { id: "velour", src: "/ejemplos/velour.jpg", formato: "4:5", rubro: "ecommerce", idioma: "es", tipo: "Lujo editorial", porque: "Luz, textura y una frase corta: se siente premium.", brief: "{producto} on a satin surface with soft petals and morning light, short elegant serif headline, size line, thin outlined button.", portada: false },
  { id: "aural-ficha", src: "/ejemplos/aural-ficha.jpg", formato: "4:5", rubro: "ecommerce", idioma: "en", tipo: "Ficha de marketplace", porque: "Cuatro beneficios con íconos: se lee como una ficha de tienda.", brief: "{producto} centred on pure white, product name on top, four thin-line callouts with icons for its key benefits, five stars at the bottom.", portada: true },
  { id: "lino", src: "/ejemplos/lino.jpg", formato: "4:5", rubro: "ecommerce", idioma: "es", tipo: "Editorial de moda", porque: "Parece revista, no anuncio: sube el valor percibido.", brief: "Editorial street photo of a model wearing {producto}, elegant serif headline top-left, short offer line, thin outlined button.", portada: true },
  { id: "kalma", src: "/ejemplos/kalma.jpg", formato: "4:5", rubro: "nutra", idioma: "es", tipo: "Escena del problema", porque: "La persona se ve en la escena antes de leer el producto.", brief: "Night scene of the problem {producto} solves, the product on the nightstand, question headline on top, three check bullets, soft button.", portada: true },
  { id: "sheetskills", src: "/ejemplos/sheetskills.jpg", formato: "4:5", rubro: "afiliados", idioma: "en", tipo: "Advertorial nativo", porque: "Se ve como un artículo: baja la defensa ante el anuncio.", brief: "News-style article card: SPONSORED label, first-person result headline about {producto}, candid photo, short paragraph, «Read More» button.", portada: true },
  { id: "techo-tormenta", src: "/ejemplos/techo-tormenta.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Gancho de seguro", porque: "Dice quién paga: saca la objeción del precio.", brief: "Real photo of the damage {producto} fixes with a pro inspecting it, red banner headline about insurance covering it, free-inspection line, «Check If I Qualify» button.", portada: true },
  { id: "ventanas", src: "/ejemplos/ventanas.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Costo escondido", porque: "Pone un número al problema que la persona ya siente.", brief: "Bright aspirational photo of the finished result of {producto}, headline about the hidden monthly cost of not fixing it, free estimate + financing line, yellow button.", portada: true },
  { id: "bano-antes-despues", src: "/ejemplos/bano-antes-despues.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Antes / después", porque: "El resultado se entiende en un segundo, sin leer.", brief: "Split before/after of the same space or result for {producto}, labels BEFORE and AFTER, headline on top, yellow button at the bottom.", portada: true },
  { id: "pawease", src: "/ejemplos/pawease.jpg", formato: "4:5", rubro: "ecommerce", idioma: "en", tipo: "Lista de 3 razones", porque: "Responde las objeciones antes de que aparezcan.", brief: "Lifestyle photo of {producto} in use, headline «3 reasons people are switching», three numbered white labels with short benefits, button at the bottom.", portada: true },
  { id: "luma-noche", src: "/ejemplos/luma-noche.jpg", formato: "4:5", rubro: "nutra", idioma: "es", tipo: "Selfie UGC", porque: "Parece un post de una persona real, no un anuncio.", brief: "Casual selfie of a real-looking customer holding {producto} at home, story-sticker text on top, free-shipping pill at the bottom.", portada: true },
  { id: "quiz-sueno", src: "/ejemplos/quiz-sueno.jpg", formato: "4:5", rubro: "afiliados", idioma: "en", tipo: "Quiz", porque: "Hace que la persona se identifique con una respuesta y quiera seguir.", brief: "Question headline about the problem {producto} solves, three answer buttons, «Take the 30-second quiz →» at the bottom, clean app-like design.", portada: true },
  { id: "techo", src: "/ejemplos/techo.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Pregunta que califica", porque: "Solo hace clic quien cumple la condición: leads más baratos y mejores.", brief: "Photo of the problem in a real home, headline that is a yes/no qualifying question about {producto}, free inspection line, red button.", portada: true },
  { id: "aurea-serum", src: "/ejemplos/aurea-serum.jpg", formato: "4:5", rubro: "ecommerce", idioma: "es", tipo: "Nosotros vs. ellos", porque: "La diferencia queda a la vista en checks y cruces.", brief: "Split comparison: {producto} with green checks vs. «the usual one» with red crosses on the same three points, headline on top, black button.", portada: true },
  { id: "flexdaily", src: "/ejemplos/flexdaily.jpg", formato: "4:5", rubro: "nutra", idioma: "en", tipo: "Historia de un cliente tipo", porque: "Muestra el resultado deseado en una escena, sin prometer nada.", brief: "Aspirational scene of the ideal customer living the outcome, {producto} visible on the side, short story headline, orange «Learn more» button.", portada: true },
  { id: "solar", src: "/ejemplos/solar.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Problema → solución", porque: "Nombra el dolor (la cuenta de luz) y ofrece revisar si califica.", brief: "Happy customers in front of their home with {producto}, white card with the pain as a question, «see if you qualify» line, orange button.", portada: true },
  { id: "grano-alto", src: "/ejemplos/grano-alto.jpg", formato: "4:5", rubro: "ecommerce", idioma: "es", tipo: "Oferta bundle", porque: "Sube el ticket promedio: llevar más sale más conveniente.", brief: "Premium still life of three variants of {producto}, headline «Pack de 3», savings line, free-shipping badge, black button.", portada: true },
  { id: "seguro-auto", src: "/ejemplos/seguro-auto.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Pregunta de dolor", porque: "Toca algo que la persona ya siente cada mes.", brief: "Relatable person in their daily setting checking their phone, headline «Paying too much for…?», «compare in 2 minutes», green button.", portada: true },
  { id: "nacar-colageno", src: "/ejemplos/nacar-colageno.jpg", formato: "4:5", rubro: "nutra", idioma: "es", tipo: "Bodegón premium", porque: "La estética vende el producto como un ritual, no como un remedio.", brief: "Elegant still life of {producto} with natural props, serif headline about a daily ritual, flavour/servings line, gold 2x1 badge.", portada: true },
  { id: "erguido", src: "/ejemplos/erguido.jpg", formato: "4:5", rubro: "ecommerce", idioma: "es", tipo: "Producto + uso", porque: "Muestra el producto y, al lado, a alguien usándolo.", brief: "{producto} big on a flat colour background and a person using it on the side, punchy headline, discount badge, black «Comprar ahora» button.", portada: true },
  { id: "bano-rosado", src: "/ejemplos/bano-rosado.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Post nativo", porque: "Parece una foto que cualquiera subiría; la pregunta hace que se detengan.", brief: "Smartphone photo of the «before» problem, big outlined question on top, green «free quote» label at the bottom.", portada: false },
  { id: "seguro-vida", src: "/ejemplos/seguro-vida.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Emocional familiar", porque: "Habla de proteger a otros, no de la póliza.", brief: "Warm family moment, cream card with a protection headline and age range, navy «See my options» button.", portada: false },
  { id: "blendgo", src: "/ejemplos/blendgo.jpg", formato: "4:5", rubro: "ecommerce", idioma: "en", tipo: "Producto en la mano", porque: "Se ve el tamaño y el uso real en un vistazo.", brief: "{producto} held in one hand outdoors, shallow depth of field, benefit headline with time, discount badge, «Shop now» pill.", portada: true },
  { id: "aire-acondicionado", src: "/ejemplos/aire-acondicionado.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Escena del problema", porque: "La gente se ve reflejada en la escena antes de leer.", brief: "A family living the problem {producto} solves, red band with the question, speed promise line, blue estimate button.", portada: false },
  { id: "cimientos-1", src: "/ejemplos/cimientos-1.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Sí / No", porque: "Una pregunta con dos botones: responder es fácil y engancha.", brief: "Bold question headline about the price of {producto}, big green YES and red NO buttons, dark background.", portada: true },
  { id: "cimientos-2", src: "/ejemplos/cimientos-2.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Ventana de error", porque: "Un formato inesperado que corta el scroll.", brief: "Old-computer error window with the question about {producto} and YES/NO buttons, retro teal background.", portada: true },
  { id: "cimientos-3", src: "/ejemplos/cimientos-3.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Neón", porque: "Contraste alto: destaca en un feed claro.", brief: "Neon sign style question about {producto} on a dark brick wall, glowing YES/NO.", },
  { id: "cimientos-4", src: "/ejemplos/cimientos-4.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Bloques de color", porque: "Mitad pregunta, mitad respuesta: simple y directo.", brief: "Top half black with the question about {producto}, bottom half split green YES and red NO.", },
  { id: "cimientos-5", src: "/ejemplos/cimientos-5.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Muro con grieta", porque: "Muestra el problema real detrás del texto.", brief: "Cracked wall photo behind a bold question about {producto}, YES/NO buttons.", },
  { id: "cimientos-6", src: "/ejemplos/cimientos-6.jpg", formato: "4:5", rubro: "leadgen", idioma: "en", tipo: "Nota adhesiva", porque: "Parece escrito a mano: se siente cercano.", brief: "Yellow sticky note on a wall with a handwritten question about {producto} and YES/NO boxes.", },
  { id: "cimientos-v-001", src: "/ideas/cimientos-v-001.jpg", formato: "9:16", rubro: "leadgen", idioma: "en", tipo: "Etiqueta de precio", porque: "El precio escrito en una etiqueta se lee como un dato, no como publicidad.", brief: "Brown paper price tag hanging on a string with a handwritten price line for {producto}." },
  { id: "cimientos-v-004", src: "/ideas/cimientos-v-004.jpg", formato: "9:16", rubro: "leadgen", idioma: "en", tipo: "Precio tachado", porque: "Rompe la creencia de que es caro.", brief: "The price people expect crossed out in red, then the real price of {producto} in yellow, dark navy background." },
  { id: "cimientos-v-006", src: "/ideas/cimientos-v-006.jpg", formato: "9:16", rubro: "leadgen", idioma: "en", tipo: "Persona con cartel", porque: "Una persona común sosteniendo el mensaje genera confianza.", brief: "Real-looking customer in front of their home holding a handwritten sign with a short line about {producto}." },
  { id: "cimientos-v-008", src: "/ideas/cimientos-v-008.jpg", formato: "9:16", rubro: "leadgen", idioma: "en", tipo: "Señal de tránsito", porque: "Una señal amarilla se lee como advertencia.", brief: "Yellow road sign against blue sky with a short warning-style line about {producto}." },
  { id: "cimientos-v-012", src: "/ideas/cimientos-v-012.jpg", formato: "9:16", rubro: "leadgen", idioma: "en", tipo: "Objeto simbólico", porque: "Un objeto (una alcancía rota) cuenta el miedo a gastar.", brief: "A symbolic object that represents the money fear around {producto}, short bold headline on top." },
  { id: "cimientos-v-016", src: "/ideas/cimientos-v-016.jpg", formato: "9:16", rubro: "leadgen", idioma: "en", tipo: "Expectativa vs. realidad", porque: "Contrasta lo que la gente cree con lo que de verdad pasa.", brief: "Top: «What you expect» with the scary price, bottom: the real price of {producto} on a green band." },
  { id: "cimientos-v-018", src: "/ideas/cimientos-v-018.jpg", formato: "9:16", rubro: "leadgen", idioma: "en", tipo: "Ilustración retro", porque: "Un estilo vintage llama la atención entre fotos.", brief: "1950s pin-up style illustration pointing at the problem, retro headline about {producto}." },
  { id: "cimientos-v-019", src: "/ideas/cimientos-v-019.jpg", formato: "9:16", rubro: "leadgen", idioma: "en", tipo: "Icono simple", porque: "Fondo de color e icono: limpio y fácil de leer en stories.", brief: "Flat icon of the subject of {producto} on a navy background, short headline with a highlighted phrase." },
];

export const IDEAS_PORTADA = IDEAS.filter((i) => i.portada);
