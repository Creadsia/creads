// Internal finance book for the admin panel: types, starting data and the margin math.
// Shared by the server (storage) and the browser (panel). No secrets ever go in here.

export type Moneda = "USD" | "CLP";

export interface Movimiento {
  id: string;
  fecha: string; // YYYY-MM-DD
  tipo: "gasto" | "recarga" | "ingreso";
  servicio: string;
  detalle: string;
  monto: number | null; // null = still to fill in
  moneda: Moneda;
}

export interface CostoFijo {
  id: string;
  servicio: string;
  para: string;
  montoUsd: number | null;
  frecuencia: "mensual" | "anual";
  estado: "activo" | "pendiente" | "cancelar";
  nota?: string;
}

export interface CostoModelo {
  id: string;
  nombre: string;
  proveedor: string;
  tipo: "video" | "imagen" | "voz" | "texto";
  unidad: "s" | "img" | "anuncio" | "1k car";
  usd: number;
  creditos: number; // what we charge per unit (0 = included)
  nota?: string;
}

export interface Cuenta {
  id: string;
  orden: number;
  servicio: string;
  para: string;
  cuenta: string;
  clave: string; // WHERE the key lives (env var name), never the key itself
  panel: string;
  estado: "activa" | "pendiente" | "cancelar";
  nota?: string;
}

export interface Plan {
  id: string;
  nombre: string;
  mensual: number;
  anual: number; // per month, billed yearly
  creditos: number;
}

export interface Config {
  usdClp: number; // fallback only: the live observed dollar is used when it can be read
  limiteNuevas?: number; // US$ per day an account can spend in its first 48 h (anti-fraud; 0 = off)
  cambioColchon?: number; // % added to the observed dollar for the pesos charged (card exchange spread)
  costoCredito: number; // US$ per credit, worst case incl. redos
  uso: number; // % of credits customers use
  stripePct: number;
  stripeFijo: number;
  ivaPct?: number; // VAT included in the price of sales to Chile (19), paid to the SII
  pctChile?: number; // % of sales that carry Chilean VAT
  planes: Plan[];
  afiliado: { tipo: "recurrente" | "cpa"; pct: number; meses: number; cpa: number; vida: number };
  proyeccion: Record<string, number> & { pctAfiliado: number; pctPromo?: number };
}

export interface Finanzas {
  movimientos: Movimiento[];
  fijos: CostoFijo[];
  modelos: CostoModelo[];
  cuentas: Cuenta[];
  config: Config;
  actualizado?: string;
}

export const DEFAULT_FINANZAS: Finanzas = {
  movimientos: [
    { id: "m-google-1015", fecha: "2026-10-15", tipo: "recarga", servicio: "Google Cloud (Gemini)", detalle: "Saldo prepagado para Veo y Nano Banana", monto: 24000, moneda: "CLP" },
    { id: "m-fal-1015", fecha: "2026-10-15", tipo: "recarga", servicio: "fal.ai", detalle: "Saldo para pruebas de Kling y Seedance", monto: 20, moneda: "USD" },
    { id: "m-vercel", fecha: "2026-10-13", tipo: "gasto", servicio: "Vercel Pro", detalle: "Primer mes (revisar fecha)", monto: 20, moneda: "USD" },
    { id: "m-anthropic", fecha: "2026-10-14", tipo: "recarga", servicio: "Anthropic Console", detalle: "Saldo de Claude (revisar monto y fecha)", monto: null, moneda: "USD" },
    { id: "m-dominio", fecha: "2026-10-13", tipo: "gasto", servicio: "Namecheap", detalle: "Dominio creadsia.com (revisar monto y fecha)", monto: null, moneda: "USD" },
    { id: "m-workspace", fecha: "2026-10-13", tipo: "gasto", servicio: "Google Workspace", detalle: "Correo hola@creadsia.com (revisar monto y fecha)", monto: null, moneda: "USD" },
  ],
  fijos: [
    { id: "vercel", servicio: "Vercel Pro", para: "Publica la página y la plataforma", montoUsd: 20, frecuencia: "mensual", estado: "activo" },
    { id: "workspace", servicio: "Google Workspace", para: "Correo hola@creadsia.com", montoUsd: null, frecuencia: "mensual", estado: "activo", nota: "Anotar el monto exacto de la factura" },
    { id: "dominio", servicio: "Namecheap · creadsia.com", para: "Dominio", montoUsd: null, frecuencia: "anual", estado: "activo", nota: "Anotar lo que se pagó por el año" },
    { id: "supabase", servicio: "Supabase", para: "Base de datos y archivos", montoUsd: 0, frecuencia: "mensual", estado: "activo", nota: "Plan gratis. Pasa a US$25/mes al crecer" },
    { id: "github", servicio: "GitHub", para: "Guarda el código", montoUsd: 0, frecuencia: "mensual", estado: "activo", nota: "Plan gratis" },
    { id: "elevenlabs", servicio: "ElevenLabs", para: "Voces y clonación", montoUsd: null, frecuencia: "mensual", estado: "pendiente", nota: "Plan Starter, al contratarlo" },
    { id: "higgsfield", servicio: "Higgsfield Ultra", para: "Solo el prototipo antiguo", montoUsd: null, frecuencia: "mensual", estado: "cancelar", nota: "Cancelar cuando Creads genere todo por su cuenta" },
  ],
  modelos: [
    { id: "omni-flash", nombre: "Gemini Omni Flash", proveedor: "Google (Gemini)", tipo: "video", unidad: "s", usd: 0.1, creditos: 10, nota: "720p con audio, modelo nuevo de Google" },
    { id: "veo-fast", nombre: "Veo 3.1 Fast", proveedor: "Google (Vertex)", tipo: "video", unidad: "s", usd: 0.15, creditos: 10, nota: "720p con audio; fal.ai solo de emergencia" },
    { id: "veo", nombre: "Veo 3.1", proveedor: "Google (Vertex)", tipo: "video", unidad: "s", usd: 0.4, creditos: 30, nota: "720p con audio; fal.ai solo de emergencia" },
    { id: "kling", nombre: "Kling 3.0", proveedor: "fal.ai", tipo: "video", unidad: "s", usd: 0.14, creditos: 10, nota: "Confirmar si el audio cobra aparte" },
    { id: "kling-pro", nombre: "Kling 3.0 Pro", proveedor: "fal.ai", tipo: "video", unidad: "s", usd: 0.14, creditos: 10, nota: "Confirmar si el audio cobra aparte" },
    { id: "seedance-fast", nombre: "Seedance 2.0 Fast", proveedor: "fal.ai", tipo: "video", unidad: "s", usd: 0.2419, creditos: 15, nota: "Créditos sugeridos, aún no en la web" },
    { id: "seedance", nombre: "Seedance 2.0", proveedor: "fal.ai", tipo: "video", unidad: "s", usd: 0.3024, creditos: 18, nota: "Créditos sugeridos, aún no en la web" },
    { id: "seedance-25", nombre: "Seedance 2.5", proveedor: "fal.ai", tipo: "video", unidad: "s", usd: 0.462, creditos: 28, nota: "Créditos sugeridos, aún no en la web" },
    { id: "hailuo-23", nombre: "Hailuo 2.3", proveedor: "fal.ai", tipo: "video", unidad: "s", usd: 0.056, creditos: 4, nota: "Solo desde imagen, sin audio. US$0,28 por 6 s" },
    { id: "wan-30", nombre: "Wan 3.0", proveedor: "fal.ai", tipo: "video", unidad: "s", usd: 0.1, creditos: 7, nota: "720p con audio" },
    { id: "grok-video-lite", nombre: "Grok Video Lite", proveedor: "xAI (directo)", tipo: "video", unidad: "s", usd: 0.03, creditos: 2, nota: "720p con sonido; el más barato" },
    { id: "grok-video", nombre: "Grok Video", proveedor: "xAI (directo)", tipo: "video", unidad: "s", usd: 0.07, creditos: 5, nota: "720p con sonido" },
    { id: "grok-video-15", nombre: "Grok Imagine Video 1.5", proveedor: "xAI (directo, fal de respaldo)", tipo: "video", unidad: "s", usd: 0.14, creditos: 10, nota: "720p" },
    { id: "tool-quitar-fondo", nombre: "Quitar fondo (Bria)", proveedor: "fal.ai", tipo: "imagen", unidad: "img", usd: 0.03, creditos: 2 },
    { id: "tool-editar", nombre: "Editar imagen (Nano Banana Pro)", proveedor: "fal.ai", tipo: "imagen", unidad: "img", usd: 0.15, creditos: 9 },
    { id: "tool-upscale-img", nombre: "Mejorar imagen (SeedVR2)", proveedor: "fal.ai", tipo: "imagen", unidad: "img", usd: 0.02, creditos: 1, nota: "Precio aproximado" },
    { id: "tool-upscale-vid", nombre: "Mejorar video a 1080p (SeedVR2)", proveedor: "fal.ai", tipo: "video", unidad: "s", usd: 0.062, creditos: 4 },
    { id: "tool-avatar", nombre: "Avatar que habla (OmniHuman 2)", proveedor: "fal.ai", tipo: "video", unidad: "s", usd: 0.16, creditos: 10, nota: "Precio aproximado: confirmar con la primera factura" },
    { id: "tool-lipsync", nombre: "Sincronizar labios (Kling)", proveedor: "fal.ai", tipo: "video", unidad: "s", usd: 0.014, creditos: 1 },
    { id: "tool-doblaje", nombre: "Doblaje (ElevenLabs)", proveedor: "ElevenLabs", tipo: "video", unidad: "s", usd: 0.0083, creditos: 1, nota: "US$0,50/min; el plan Creator incluye 12 min al mes" },
    { id: "kling-turbo", nombre: "Kling 3.0 Turbo", proveedor: "fal.ai", tipo: "video", unidad: "s", usd: 0.14, creditos: 10, nota: "Sin audio" },
    { id: "hailuo-23-pro", nombre: "Hailuo 2.3 Pro", proveedor: "fal.ai", tipo: "video", unidad: "s", usd: 0.082, creditos: 5, nota: "US$0,49 por clip de ~6 s en 1080p, desde imagen" },
    { id: "nano-banana-2", nombre: "Nano Banana 2", proveedor: "fal.ai", tipo: "imagen", unidad: "img", usd: 0.08, creditos: 5 },
    { id: "seedream-5-pro", nombre: "Seedream 5 Pro", proveedor: "fal.ai", tipo: "imagen", unidad: "img", usd: 0.0675, creditos: 4, nota: "Precio provisional del proveedor" },
    { id: "flux-3", nombre: "FLUX 3", proveedor: "fal.ai", tipo: "imagen", unidad: "img", usd: 0.048, creditos: 3 },
    { id: "flux-3-klein", nombre: "FLUX 3 Klein", proveedor: "fal.ai", tipo: "imagen", unidad: "img", usd: 0.009, creditos: 1, nota: "Borradores. Precio planificado del proveedor" },
    { id: "tool-musica", nombre: "Música IA (ElevenLabs)", proveedor: "ElevenLabs", tipo: "voz", unidad: "s", usd: 0.0025, creditos: 1, nota: "US$0,15/min; parte va incluida en el plan" },
    { id: "tool-efectos", nombre: "Efectos de sonido (ElevenLabs)", proveedor: "ElevenLabs", tipo: "voz", unidad: "s", usd: 0.002, creditos: 1, nota: "US$0,12/min" },
    { id: "nano-banana-pro", nombre: "Nano Banana Pro", proveedor: "Google (Gemini)", tipo: "imagen", unidad: "img", usd: 0.134, creditos: 8 },
    { id: "claude", nombre: "Claude", proveedor: "Anthropic", tipo: "texto", unidad: "anuncio", usd: 0.03, creditos: 0, nota: "Guion, cortes y revisión. Estimado; va incluido" },
  ],
  cuentas: [
    { id: "namecheap", orden: 1, servicio: "Namecheap", para: "Dominio creadsia.com y DNS", cuenta: "Por confirmar (la de la compra)", clave: "", panel: "https://www.namecheap.com/myaccount/", estado: "activa" },
    { id: "workspace", orden: 2, servicio: "Google Workspace", para: "Correo de la empresa", cuenta: "hola@creadsia.com", clave: "", panel: "https://admin.google.com", estado: "activa" },
    { id: "github", orden: 3, servicio: "GitHub", para: "Código de la plataforma", cuenta: "Organización Creadsia (repo creads)", clave: "", panel: "https://github.com/Creadsia/creads", estado: "activa" },
    { id: "vercel", orden: 4, servicio: "Vercel", para: "Publica creadsia.com. Aquí viven todas las claves", cuenta: "Equipo creadsia, proyecto creads", clave: "Settings → Environment Variables", panel: "https://vercel.com/creadsia/creads/settings/environment-variables", estado: "activa" },
    { id: "supabase", orden: 5, servicio: "Supabase", para: "Base de datos, registros y archivos generados", cuenta: "Proyecto fybferdmkxeefycjciix", clave: "SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY", nota: "La clave secreta se llama «vercel_creads» en Supabase", panel: "https://supabase.com/dashboard/project/fybferdmkxeefycjciix", estado: "activa" },
    { id: "anthropic", orden: 6, servicio: "Anthropic Console", para: "Claude: guiones, cortes y revisión", cuenta: "Por confirmar", clave: "ANTHROPIC_API_KEY", panel: "https://console.anthropic.com", estado: "activa" },
    { id: "gemini", orden: 7, servicio: "Google AI Studio", para: "Veo 3.1 y Nano Banana Pro", cuenta: "hola@creadsia.com · proyecto gen-lang-client-0442562469 · Nivel 1", clave: "GEMINI_API_KEY", nota: "La clave que termina en «hotg». La de la cuenta personal («ix0Q») no se usa", panel: "https://aistudio.google.com/apikey", estado: "activa" },
    { id: "gcloud", orden: 8, servicio: "Google Cloud · Facturación", para: "Saldo prepagado de Gemini y alertas de gasto", cuenta: "hola@creadsia.com · organización creadsia.com", clave: "", panel: "https://console.cloud.google.com/billing", estado: "activa" },
    { id: "fal", orden: 9, servicio: "fal.ai", para: "Kling, Seedance y más modelos", cuenta: "hola@creadsia.com", clave: "FAL_KEY", nota: "Recarga automática apagada", panel: "https://fal.ai/dashboard", estado: "activa" },
    { id: "elevenlabs", orden: 10, servicio: "ElevenLabs", para: "Voces, clonación y doblaje", cuenta: "hola@creadsia.com", clave: "ELEVENLABS_API_KEY", panel: "https://elevenlabs.io/app/settings/api-keys", estado: "pendiente" },
    { id: "estudio", orden: 11, servicio: "Estudio de Creads", para: "Entrar a creadsia.com/estudio", cuenta: "Código de acceso", clave: "CREADS_ACCESS_CODE", nota: "Temporal, hasta que existan cuentas de clientes", panel: "https://www.creadsia.com/estudio", estado: "activa" },
    { id: "admin", orden: 12, servicio: "Panel interno", para: "Entrar a creadsia.com/admin (este panel)", cuenta: "Clave de administrador", clave: "ADMIN_ACCESS_CODE", nota: "Solo el dueño. No compartir", panel: "https://www.creadsia.com/admin", estado: "activa" },
    { id: "higgsfield", orden: 13, servicio: "Higgsfield", para: "Prototipo antiguo y videos de la portada", cuenta: "Por confirmar", clave: "", panel: "https://higgsfield.ai", estado: "cancelar" },
  ],
  config: {
    usdClp: 950,
    cambioColchon: 2,
    limiteNuevas: 25,
    costoCredito: 0.0193,
    uso: 70,
    stripePct: 4.4,
    stripeFijo: 0.3,
    ivaPct: 19,
    pctChile: 100,
    planes: [
      { id: "starter", nombre: "Starter", mensual: 25, anual: 21, creditos: 300 },
      { id: "plus", nombre: "Plus", mensual: 55, anual: 47, creditos: 1000 },
      { id: "studio", nombre: "Ultra", mensual: 129, anual: 109, creditos: 3000 },
    ],
    afiliado: { tipo: "recurrente", pct: 30, meses: 12, cpa: 50, vida: 8 },
    proyeccion: { starter: 100, plus: 40, studio: 10, pctAfiliado: 30, pctPromo: 100 },
  },
};

// ---------- math ----------

export const toUsd = (m: Pick<Movimiento, "monto" | "moneda">, usdClp: number) =>
  m.monto == null ? 0 : m.moneda === "CLP" ? m.monto / usdClp : m.monto;

/** Fixed costs per month, ignoring the ones marked to cancel. */
export const fijoMensual = (fijos: CostoFijo[]) =>
  fijos
    .filter((f) => f.estado !== "cancelar" && f.montoUsd != null)
    .reduce((a, f) => a + (f.frecuencia === "anual" ? (f.montoUsd as number) / 12 : (f.montoUsd as number)), 0);

export interface PlanMonth {
  precio: number;
  iva: number;
  modelos: number;
  stripe: number;
  afiliado: number;
  queda: number;
  margen: number;
}

/** What one customer on a plan leaves us in one month. */
/** VAT inside a price paid in Chile (prices include it): the part that goes to the SII, never to us. */
export function ivaOf(c: Config, precio: number) {
  const pct = Math.max(0, Number(c.ivaPct ?? 19));
  const chile = Math.min(100, Math.max(0, Number(c.pctChile ?? 100))) / 100;
  return precio * chile * (pct / (100 + pct));
}

export function planMonth(c: Config, p: Plan, o: { anual?: boolean; promo?: boolean; viaAf?: boolean; uso?: number }): PlanMonth {
  let precio = o.anual ? p.anual : p.mensual;
  if (o.promo) precio *= 0.5;
  const modelos = p.creditos * ((o.uso ?? c.uso) / 100) * c.costoCredito;
  const stripe = (precio * c.stripePct) / 100 + c.stripeFijo;
  const afiliado = o.viaAf && c.afiliado.tipo === "recurrente" ? (precio * c.afiliado.pct) / 100 : 0;
  const iva = ivaOf(c, precio);
  const queda = precio - iva - modelos - stripe - afiliado;
  return { precio, iva, modelos, stripe, afiliado, queda, margen: precio ? (queda / precio) * 100 : 0 };
}

/** Monthly projection for a number of subscribers per plan, before fixed costs. */
export function proyectar(f: Finanzas) {
  const c = f.config;
  let mrr = 0, iva = 0, modelos = 0, stripe = 0, afiliados = 0, subs = 0;
  for (const p of c.planes) {
    const n = Number(c.proyeccion[p.id] || 0);
    if (!n) continue;
    // part of them in their first month, paying 50% (all of them right after launch)
    const promo = Math.min(100, Math.max(0, Number(c.proyeccion.pctPromo ?? 100))) / 100;
    subs += n;
    for (const [share, o] of [[1 - promo, {}], [promo, { promo: true }]] as const) {
      if (!share) continue;
      const k = n * share;
      const r = planMonth(c, p, o);
      const ra = planMonth(c, p, { ...o, viaAf: true });
      mrr += k * r.precio;
      iva += k * r.iva;
      modelos += k * r.modelos;
      stripe += k * r.stripe;
      afiliados += ((k * c.proyeccion.pctAfiliado) / 100) * ra.afiliado;
    }
  }
  // what the subscriptions themselves leave (fixed costs are looked at on their own)
  const neto = mrr - iva - modelos - stripe - afiliados;
  return { subs, mrr, iva, modelos, stripe, afiliados, neto, margen: mrr ? (neto / mrr) * 100 : 0 };
}

/** Plan prices before the October 2026 increase: a saved book that still has them gets today's plans. */
const OLD_PRICES: Record<string, number> = { starter: 79, plus: 219, studio: 449 };
export function withCurrentPlans(f: Finanzas): Finanzas {
  const old = f.config?.planes?.some((p) => OLD_PRICES[p.id] === p.mensual);
  return old ? { ...f, config: { ...f.config, planes: DEFAULT_FINANZAS.config.planes } } : f;
}
