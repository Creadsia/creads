// Lead-gen niches offered when creating an ad. Customers can type their own; the library groups by it.
export const NICHES = [
  "Reparación de cimientos",
  "Remodelación de baño",
  "Remodelación de cocina",
  "Techos",
  "Paneles solares",
  "Ventanas",
  "Aire acondicionado (HVAC)",
  "Seguro de auto",
  "Seguro de vida",
  "Seguro de salud",
  "Ayuda con deudas",
  "Abogados / accidentes",
  "Bienes raíces",
];

/** The same niche written differently ("techos", "Techos ") counts as one. */
export const nicheKey = (n: string) => n.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

/** Clean label as saved. */
export const cleanNiche = (n: unknown) => (typeof n === "string" ? n.trim().replace(/\s+/g, " ").slice(0, 60) : "");
