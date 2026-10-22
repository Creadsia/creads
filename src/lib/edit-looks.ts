// Looks of the «Edición Pro» (shared by the studio and the montage; no server-only code here).

// ---------- looks ----------
// Every advertiser needs their own look (owner, 21 Oct 2026: the neon one only fits Creads). A look sets the
// headline font and treatment, the two brand colours, how strong the cut effects and sounds are, and the
// closing card. The customer picks a look and, optionally, their brand colours.
export interface ProLook {
  id: string;
  font: string; // headline font (assets/fonts)
  lineFont: string;
  size: number; // headline size at 720 wide
  upper: boolean;
  c1: string; // #RRGGBB: key word / bar / flash tint / closing underline
  c2: string; // #RRGGBB: second accent (alternates with c1)
  text: string; // #RRGGBB headline text
  outline: number; // outline at 720 wide (0 = none)
  box: boolean; // headline sits in a solid c1 box (news style)
  glow: boolean;
  tilt: boolean; // headlines pop in slightly rotated
  pop: boolean; // headlines pop in (scale); false = soft fade
  zoom: number; // punch-in on each cut (0 = none)
  flash: boolean;
  bar: boolean;
  sfx: "fuerte" | "suave" | "ninguno";
  endBg: string; // #RRGGBB closing card background
  endText: string; // #RRGGBB closing card text
}

export const LOOKS: Record<string, ProLook & { name: string; desc: string }> = {
  limpio: { id: "limpio", name: "Limpio", desc: "Blanco con un color de acento. Sirve para casi cualquier marca.", font: "Montserrat ExtraBold", lineFont: "Montserrat ExtraBold", size: 66, upper: false, c1: "#FFD400", c2: "#FFD400", text: "#FFFFFF", outline: 5, box: false, glow: false, tilt: false, pop: true, zoom: 0.06, flash: false, bar: true, sfx: "suave", endBg: "#0E0E10", endText: "#FFFFFF" },
  impacto: { id: "impacto", name: "Impacto", desc: "Letras gigantes, palabra clave en amarillo. Estilo TikTok de alto rendimiento.", font: "Anton", lineFont: "Montserrat ExtraBold", size: 92, upper: true, c1: "#FFE600", c2: "#FFE600", text: "#FFFFFF", outline: 7, box: false, glow: false, tilt: true, pop: true, zoom: 0.1, flash: true, bar: true, sfx: "fuerte", endBg: "#000000", endText: "#FFFFFF" },
  elegante: { id: "elegante", name: "Elegante", desc: "Sobrio y premium: cortes limpios, sin destellos ni sonidos.", font: "Poppins ExtraBold", lineFont: "Poppins ExtraBold", size: 58, upper: false, c1: "#E8D5B0", c2: "#E8D5B0", text: "#FFFFFF", outline: 0, box: false, glow: false, tilt: false, pop: false, zoom: 0.06, flash: false, bar: false, sfx: "ninguno", endBg: "#111111", endText: "#F5F1EA" },
  noticia: { id: "noticia", name: "Noticia", desc: "Títulos en caja de color, como un noticiero o reportaje.", font: "Bebas Neue", lineFont: "Inter Black", size: 84, upper: true, c1: "#E10600", c2: "#E10600", text: "#FFFFFF", outline: 0, box: true, glow: false, tilt: false, pop: true, zoom: 0.06, flash: false, bar: true, sfx: "suave", endBg: "#0A0A0A", endText: "#FFFFFF" },
  neon: { id: "neon", name: "Neón", desc: "Brillo, destellos y mucho movimiento (el estilo de Creads).", font: "Archivo Black", lineFont: "Montserrat ExtraBold", size: 80, upper: true, c1: "#FF2BD6", c2: "#19E3FF", text: "#FFFFFF", outline: 6, box: false, glow: true, tilt: true, pop: true, zoom: 0.12, flash: true, bar: true, sfx: "fuerte", endBg: "#05040A", endText: "#FFFFFF" },
};

const HEX = /^#?[0-9a-f]{6}$/i;
/** The look to use: a template, with the advertiser's brand colours on top when given. */
export function resolveLook(input?: { plantilla?: unknown; c1?: unknown; c2?: unknown; sonidos?: unknown } | null): ProLook {
  const base = LOOKS[String(input?.plantilla ?? "")] ?? LOOKS.limpio;
  const c1 = typeof input?.c1 === "string" && HEX.test(input.c1) ? `#${input.c1.replace("#", "")}` : base.c1;
  const c2 = typeof input?.c2 === "string" && HEX.test(input.c2) ? `#${input.c2.replace("#", "")}` : typeof input?.c1 === "string" && HEX.test(input.c1) ? c1 : base.c2;
  const sfx = input?.sonidos === false ? "ninguno" : base.sfx;
  return { ...base, c1, c2, sfx };
}
