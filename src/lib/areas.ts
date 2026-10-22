// How the Panel interno is organised: one area per part of the business, each with its own pages and
// the office agents in charge of it. The CEO General (Dirección) sees every area and talks to the owner.
// Client-safe (no server imports): used by the panel's menu and by the office.

export type AreaId = "direccion" | "lanzamiento" | "numeros" | "marketing" | "clientes" | "plataforma";
export type PanelTab =
  | "oficina" | "equipo" | "lanzamiento"
  | "estadisticas" | "suscripciones" | "rentabilidad" | "resumen" | "movs" | "fijos" | "planes" | "modelos"
  | "marketing" | "campanas"
  | "contactar" | "clientes" | "registros"
  | "guardian" | "errores" | "calidad" | "saldos" | "estado" | "cuentas";

export interface Area {
  id: AreaId;
  name: string;
  /** One line under the area's title. */
  what: string;
  /** The pages of the area, in order (the first one opens by default). */
  tabs: [PanelTab, string][];
  /** The office agents in charge of the area (the first one is its head). */
  agents: string[];
}

export const AREAS: Area[] = [
  { id: "direccion", name: "Dirección", what: "Tu CEO General: el resumen del día, lo que espera tu aprobación y todo el equipo.", tabs: [["oficina", "CEO General y agentes"], ["equipo", "Personas y accesos"]], agents: ["general", "guardian"] },
  { id: "lanzamiento", name: "Lanzamiento", what: "Todo lo que falta para abrir Creads al público, en orden.", tabs: [["lanzamiento", "Lista de lanzamiento"]], agents: [] },
  {
    id: "numeros", name: "Ventas y finanzas", what: "Cuánto vendes, cuánto cuesta y cuánto queda.",
    tabs: [["estadisticas", "Estadísticas"], ["suscripciones", "Suscripciones y retención"], ["rentabilidad", "Rentabilidad"], ["resumen", "Proyección"], ["movs", "Movimientos"], ["fijos", "Costos fijos"], ["planes", "Planes y afiliados"], ["modelos", "Costo por modelo"]],
    agents: ["finanzas"],
  },
  { id: "marketing", name: "Marketing", what: "Anuncios, campañas pagadas en Meta y contenido orgánico.", tabs: [["campanas", "Resultados de campañas"], ["marketing", "Estudio de marketing"]], agents: ["marketing", "creativos", "trafico", "organico"] },
  { id: "clientes", name: "Clientes", what: "Tus clientes, sus accesos, registros y la atención.", tabs: [["contactar", "Clientes a contactar"], ["clientes", "Clientes y accesos"], ["registros", "Registros"]], agents: ["soporte"] },
  {
    id: "plataforma", name: "Plataforma", what: "Que todo funcione: errores, proveedores, seguridad y novedades de IA.",
    tabs: [["guardian", "Guardián (salud)"], ["errores", "Errores y alarmas"], ["calidad", "Calidad de videos"], ["saldos", "Saldos de proveedores"], ["estado", "Estado"], ["cuentas", "Cuentas de servicios"]],
    agents: ["ceo", "produccion", "seguridad", "novedades"],
  },
];

export const areaOfTab = (t: string) => AREAS.find((a) => a.tabs.some(([k]) => k === t));
/** The area an office agent belongs to (agents the owner creates pick one; default Dirección). */
export const areaOfAgent = (id: string, chosen?: string): AreaId => (AREAS.find((a) => a.agents.includes(id))?.id ?? (AREAS.some((a) => a.id === chosen) ? (chosen as AreaId) : "direccion"));
