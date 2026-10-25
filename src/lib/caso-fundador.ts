// «Caso fundador» (owner's plan, block D, 25 Oct 2026): at the Pack Prueba checkout the customer may tick an
// OPTIONAL box (never needed to pay) asking for help with their first campaign and allowing Creads to show
// their ads and results. 14 days after the pack is paid, those customers get one email asking for a testimonial
// (form at /app/caso, with its own explicit permission). The owner approves and publishes from the Panel.
// Client-safe: texts, types and the pure rules (who gets asked when, which status changes are allowed).

/** The exact text of the checkbox at the Pack Prueba checkout (stored with each acceptance). */
export const CASO_TEXTO = "Quiero ayuda para armar mi primera campaña y doy permiso para mostrar mis anuncios y resultados.";

/** The exact text of the permission box on the testimonial form (stored with each acceptance). */
export const PERMISO_TEXTO = "Doy permiso a Creads IA para mostrar este testimonio, mi nombre, mi rubro o tienda y la imagen que subí en su sitio web y en sus redes sociales. Puedo retirar este permiso cuando quiera desde este mismo formulario.";

/** Days after the Pack Prueba payment when the testimonial is asked for, and the last day it's still sent. */
export const DIA_TESTIMONIO = 14;
export const DIA_TESTIMONIO_HASTA = 21;

/** A consent as stored: when, and the exact words accepted. */
export interface Consentimiento { fecha: string; texto: string }

/**
 * inscrito: ticked the box, waiting for day 14 · pedido: the testimonial email went out · recibido: the
 * customer sent it · aprobado: the owner approved it · publicado: shown on the site.
 */
export type EstadoCaso = "inscrito" | "pedido" | "recibido" | "aprobado" | "publicado";

export interface Testimonio {
  nombre: string;
  rubro: string;
  texto: string;
  /** Screenshot of Meta Ads Manager (media link in the customer's private folder), optional. */
  imagen?: string;
  enviado: string;
  /** Explicit permission to publish; without it the testimonial can't be approved or shown. */
  permiso?: Consentimiento;
}

export interface Caso {
  userId: string;
  ws: string;
  email: string;
  name: string | null;
  /** The checkbox at the Pack Prueba checkout. */
  ayuda: Consentimiento;
  /** The Pack Prueba order where it was ticked (the last one, if ticked more than once). */
  pedido: string;
  estado: EstadoCaso;
  /** When the day-14 email was sent. */
  pedidoEn?: string;
  testimonio?: Testimonio;
  /** What the customer got in exchange, if anything (set by the owner; shown next to the testimonial). */
  beneficio?: string;
  aprobadoEn?: string;
  publicadoEn?: string;
  historial: { estado: EstadoCaso; fecha: string; por: string }[];
}

export const consentimiento = (texto: string, now = new Date()): Consentimiento => ({ fecha: now.toISOString(), texto });

/** Records (or refreshes) the checkout box. A case that already moved on keeps its status and first acceptance. */
export function inscribir(cur: Caso | undefined, o: { userId: string; ws: string; email: string; name: string | null; pedido: string }, now = new Date()): Caso {
  if (cur) return { ...cur, pedido: cur.estado === "inscrito" ? o.pedido : cur.pedido };
  return { ...o, ayuda: consentimiento(CASO_TEXTO, now), estado: "inscrito", historial: [{ estado: "inscrito", fecha: now.toISOString(), por: o.email }] };
}

/** Whether the testimonial email is due now: only ticked cases still waiting, from day 14 to day 21 after the pack was paid. */
export function tocaPedirTestimonio(c: Pick<Caso, "estado">, packPagadoEn: string | null | undefined, now = Date.now()) {
  if (c.estado !== "inscrito" || !packPagadoEn) return false;
  const days = (now - Date.parse(packPagadoEn)) / 86400_000;
  return Number.isFinite(days) && days >= DIA_TESTIMONIO && days < DIA_TESTIMONIO_HASTA;
}

export type AccionAdmin = "aprobar" | "publicar" | "despublicar";

/** Status changes the owner can make. Approving needs a testimonial with its permission; publishing needs approval. */
export function transicion(c: Pick<Caso, "estado" | "testimonio">, accion: AccionAdmin): EstadoCaso | null {
  const conPermiso = Boolean(c.testimonio?.texto && c.testimonio.permiso?.fecha && c.testimonio.permiso.texto);
  if (accion === "aprobar") return c.estado === "recibido" && conPermiso ? "aprobado" : null;
  if (accion === "publicar") return c.estado === "aprobado" && conPermiso ? "publicado" : null;
  if (accion === "despublicar") return c.estado === "publicado" ? "aprobado" : null;
  return null;
}

/** Applies an owner action (or returns null if it isn't allowed now). */
export function aplicarAccion(c: Caso, accion: AccionAdmin, por: string, now = new Date()): Caso | null {
  const estado = transicion(c, accion);
  if (!estado) return null;
  const fecha = now.toISOString();
  return {
    ...c, estado,
    ...(accion === "aprobar" ? { aprobadoEn: fecha } : {}),
    ...(accion === "publicar" ? { publicadoEn: fecha } : {}),
    ...(accion === "despublicar" ? { publicadoEn: undefined } : {}),
    historial: [...c.historial, { estado, fecha, por }].slice(-50),
  };
}

/** The customer sends (or edits) the testimonial: always back to «recibido», so the owner approves the new version. */
export function recibirTestimonio(c: Caso, t: { nombre: string; rubro: string; texto: string; imagen?: string; permiso: boolean }, now = new Date()): Caso {
  const fecha = now.toISOString();
  return {
    ...c, estado: "recibido", aprobadoEn: undefined, publicadoEn: undefined,
    testimonio: { nombre: t.nombre, rubro: t.rubro, texto: t.texto, ...(t.imagen ? { imagen: t.imagen } : {}), enviado: fecha, ...(t.permiso ? { permiso: consentimiento(PERMISO_TEXTO, now) } : {}) },
    historial: [...c.historial, { estado: "recibido" as const, fecha, por: c.email }].slice(-50),
  };
}

/** The customer withdraws the permission: the testimonial stops being shown at once. */
export function retirarPermiso(c: Caso, now = new Date()): Caso {
  if (!c.testimonio) return c;
  const { permiso: _p, ...t } = c.testimonio;
  void _p;
  return { ...c, estado: "recibido", aprobadoEn: undefined, publicadoEn: undefined, testimonio: t, historial: [...c.historial, { estado: "recibido" as const, fecha: now.toISOString(), por: c.email }].slice(-50) };
}

/** Only what can be shown: approved, published, with both consents stored. */
export function esPublicable(c: Caso) {
  return c.estado === "publicado" && Boolean(c.aprobadoEn && c.publicadoEn && c.ayuda?.fecha && c.testimonio?.texto && c.testimonio.permiso?.fecha && c.testimonio.permiso.texto);
}

export const ESTADO_LABEL: Record<EstadoCaso, string> = { inscrito: "Esperando día 14", pedido: "Pedido", recibido: "Recibido", aprobado: "Aprobado", publicado: "Publicado" };
