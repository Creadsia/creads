// Types of the «Kit de marca», safe for the browser.

export const TONOS = ["cercano", "profesional", "divertido", "premium", "directo"] as const;
export type Tono = (typeof TONOS)[number];

export interface ProductoMarca { nombre: string; descripcion: string; url: string; precio: string; foto: string; publico: string }
export interface Marca {
  nombre: string;
  logo: string;
  /** where the logo goes on the images; "no" = never on the images */
  logoPos: "arriba-izq" | "arriba-der" | "abajo-izq" | "abajo-der" | "no";
  c1: string;
  c2: string;
  tono: Tono;
  /** extra notes on the voice of the brand (words to use or avoid) */
  notas: string;
  idioma: "es" | "en";
  producto: ProductoMarca;
  updatedAt?: string;
}

export const MARCA_VACIA: Marca = {
  nombre: "", logo: "", logoPos: "arriba-der", c1: "#FF2BD6", c2: "#19E3FF", tono: "cercano", notas: "", idioma: "es",
  producto: { nombre: "", descripcion: "", url: "", precio: "", foto: "", publico: "" },
};

