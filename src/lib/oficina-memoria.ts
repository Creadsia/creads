// The first version of the «Memoria de Creads» every office agent reads (Panel → Oficina → Memoria).
// The owner edits it from the panel; this text is only used until he saves his own version.

export const DEFAULT_MEMORY = `MEMORIA DE CREADS (lo que todos los agentes deben saber) · octubre 2026

QUÉ ES CREADS
- Creads IA (creadsia.com) es un estudio de anuncios en video con IA para anunciantes de captación de clientes en Meta (seguros de auto, remodelación de baños, reparación de cimientos, etc.). El cliente pega un guion ganador y recibe anuncios terminados: cortes, video con IA, voz, subtítulos y revisión automática de calidad.
- Dueño: Gastón (Creadsia, hola@creadsia.com), en Chile. No es técnico: todo se le explica en simple.
- Visión: competir de frente con Higgsfield y ganar Latinoamérica. Creads existe para ayudar a los marketeros a crecer, así que cuida la plata del cliente.

LOS 4 PILARES
1. La mayor cantidad de modelos en un solo estudio simple: Veo (Google), Kling, Seedance, Nano Banana, ElevenLabs y los que vayan saliendo.
2. Menos errores: cada generación fallida es plata que pierde el cliente. Se revisa antes de gastar, hay control de calidad después y se rehace gratis cuando la revisión encuentra un error grave. El sistema aprende: las fallas se guardan como reglas que mejoran los próximos videos de todos.
3. Fácil: en español y en inglés, flujos simples que reemplazan un día de trabajo. Más fácil que Higgsfield.
4. Precio/calidad es la marca. Acceso por API y MCP para agencias y usuarios avanzados.

LO QUE HACE LA PLATAFORMA HOY
- Espiar anuncios: busca anuncios activos de la competencia en la biblioteca de Meta y desarma sus guiones.
- Crear guion: desarma un guion ganador, escribe versiones propias, hooks y ángulos.
- Crear anuncio: guion → cortes (máx. 8) → escenas → videos, con formatos UGC, podcast, entrevista, ronda, noticiero, comentario y drive-thru. Voz, subtítulos y armado automático.
- Voces (clonación con permiso), avatares (cara + voz, con consentimiento), imágenes 4:5 para el feed.
- Historias animadas: guion, personajes, imágenes, animación, música IA, canción con letra, música propia o sin música, personajes que hablan con sus labios o narrador.
- Recrear video: cambiar persona, producto, ropa o lugar de un video, o copiar el movimiento.
- Asistente de ayuda dentro de la plataforma, guías paso a paso y videos de ayuda.
- Panel interno del dueño: Lanzamiento, Estadísticas (estilo Shopify), Oficina de agentes, errores y alarmas, saldos de proveedores, clientes, planes, finanzas.

PRECIOS (siempre en US$)
- Planes mensuales: Starter US$119, Plus US$219, Studio US$449; 50% de descuento el primer mes.
- Anual (por mes): Starter US$99, Plus US$182, Studio US$374.
- Recargas de créditos: US$25, US$89 y US$209.
- Los créditos vencen al terminar el período pagado; las recargas se compran sobre un plan activo y vencen con él.
- Pendiente de decidir: el 50% del primer mes hace perder plata en Plus y Studio si el cliente usa todos los créditos. Propuesta: 50% solo en Starter y 20% en Plus y Studio.

REGLAS DE LA MARCA
- La IA se presenta como «Creads IA». A los clientes nunca se les muestran nombres de proveedores, saldos, claves ni errores técnicos. Sí se nombran los modelos (Veo, Kling, Seedance, Nano Banana, ElevenLabs).
- No se promete «si falla no pagas»: el mensaje es calidad, no devoluciones.
- Textos de la plataforma en español (tú). Tema oscuro «modo suave» con acento violeta.
- No se gastan créditos de generación en pruebas sin avisar al dueño.

ESTADO DEL LANZAMIENTO
- Todavía no está lanzado al público. Se lanza primero en Chile, pensando en ir a todo el mundo (versión en inglés en /en).
- Hecho: cobros con Mercado Pago, correos automáticos, resumen diario del dueño, alarmas de errores, límites antifraude, estadísticas, guías de ayuda, revisión independiente del código.
- Cobros: decidido (17 oct) abrir una LLC en EE.UU. y cobrar en US$ con Stripe (planes con renovación automática, recibos en US$).
- Falta (lo principal): la LLC y Stripe conectado, ambiente de pruebas, Vercel Pro y Supabase Pro, verificación en dos pasos en todas las cuentas, topes de gasto en proveedores, abogado (términos, privacidad, uso de caras y voces), contador (IVA, boletas), cuota de Veo con Google, beta cerrada con 5 a 10 clientes reales y el «Día 1».
- Trabajo técnico pendiente: fila de generación por proveedor, prueba de carga, pruebas automáticas del recorrido completo, gasto real por proveedor en el Panel.

EQUIPO
- Gastón (dueño). Benjamín apoya en el área comercial (ventas, conectar píxeles y campañas), con acceso limitado.
- Claude (en el estudio de desarrollo) programa y publica los cambios de la plataforma. Los agentes de la oficina analizan y proponen; no cambian el sistema.

COMPETENCIA
- Principal: Higgsfield. También: Arcads, Creatify, HeyGen, Captions/Mirage, MakeUGC, Pippit (CapCut), Freepik, Krea, OpenArt, Hedra.

CAMPAÑAS (estimación inicial)
- Con US$1.000 en Meta Chile: unos 20 a 60 suscriptores (US$17 a US$50 por suscriptor). Los primeros US$300 a 500 sirven para aprender.
- Lo que más baja el costo: un primer paso gratis (por ejemplo, «desarma tu guion gratis») y anuncios hechos con la propia Creads.
`;
