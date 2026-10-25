// Types and labels of «Primera tanda», safe for the browser (src/lib/tanda.ts has the server side).

export const TIPOS = ["dolor", "deseo", "mecanismo", "prueba_social", "creencia", "oferta"] as const;
export type TipoAngulo = (typeof TIPOS)[number];
export const TIPO_LABEL: Record<TipoAngulo, string> = {
  dolor: "Dolor", deseo: "Deseo", mecanismo: "Mecanismo", prueba_social: "Prueba social", creencia: "Creencia", oferta: "Oferta",
};

export interface Producto { nombre: string; descripcion: string; precio: string; publico: string; beneficios: string[]; objeciones: string[]; foto: string; url: string }
export interface Angulo { tipo: TipoAngulo; titulo: string; gancho: string; por_que: string }
export interface Pieza { n: number; tipo: TipoAngulo; titular: string; estilo: string; prompt: string; f45?: string; f916?: string; nota?: string; error?: string }
export interface Tanda { id: string; createdAt: string; updatedAt: string; idioma: "es" | "en"; producto: Producto; angulos: Angulo[]; piezas: Pieza[] }

