// Subtitle options for the final ad. Shared by the editor (browser) and the montage (server), so the
// preview and the rendered video follow the same rules.

export type Look = "clasico" | "resaltar" | "caja" | "palabra" | "suave" | "pop" | "subir" | "karaoke" | "salto" | "neon" | "etiqueta";
export type Case = "normal" | "upper" | "lower";
export type Position = "arriba" | "centro" | "abajo";

export const LOOKS: { id: Look; name: string; hint: string; animated?: boolean }[] = [
  { id: "resaltar", name: "Palabra resaltada", hint: "La palabra que se dice cambia de color" },
  { id: "clasico", name: "Clásico", hint: "Letras con borde negro" },
  { id: "caja", name: "Caja", hint: "Texto sobre una caja oscura" },
  { id: "palabra", name: "Una palabra", hint: "Una palabra a la vez, grande y con salto", animated: true },
  { id: "suave", name: "Sombra suave", hint: "Sin borde, con sombra (más limpio)" },
  { id: "salto", name: "Resaltada con salto", hint: "La palabra que se dice cambia de color y crece", animated: true },
  { id: "karaoke", name: "Karaoke", hint: "El color avanza letra a letra mientras habla", animated: true },
  { id: "pop", name: "Pop", hint: "Cada frase entra con un pequeño rebote", animated: true },
  { id: "subir", name: "Sube y aparece", hint: "Cada frase sube suave desde abajo", animated: true },
  { id: "neon", name: "Neón", hint: "Letras con brillo de color", animated: false },
  { id: "etiqueta", name: "Etiqueta de color", hint: "Texto sobre una caja del color que elijas", animated: false },
];

/** `width`: average letter width as a share of the font size (to know how many words fit on a line). */
export const FONTS: { id: string; name: string; file: string; ass: string; css: string; width: number; capsOnly?: boolean }[] = [
  { id: "montserrat", name: "Montserrat", file: "Montserrat-ExtraBold.ttf", ass: "Montserrat ExtraBold", css: "CapMontserrat", width: 0.6 },
  { id: "poppins", name: "Poppins", file: "Poppins-ExtraBold.ttf", ass: "Poppins ExtraBold", css: "CapPoppins", width: 0.6 },
  { id: "inter", name: "Inter", file: "Inter-Black.ttf", ass: "Inter Black", css: "CapInter", width: 0.6 },
  { id: "archivo", name: "Archivo Black", file: "ArchivoBlack-Regular.ttf", ass: "Archivo Black", css: "CapArchivo", width: 0.66 },
  { id: "anton", name: "Anton", file: "Anton-Regular.ttf", ass: "Anton", css: "CapAnton", width: 0.44 },
  { id: "bebas", name: "Bebas Neue", file: "BebasNeue-Regular.ttf", ass: "Bebas Neue", css: "CapBebas", width: 0.4, capsOnly: true },
];

export const COLORS: { hex: string; name: string }[] = [
  { hex: "#FFFFFF", name: "Blanco" },
  { hex: "#FFE100", name: "Amarillo" },
  { hex: "#3DFF6E", name: "Verde" },
  { hex: "#38D6FF", name: "Celeste" },
  { hex: "#FF4FD8", name: "Rosado" },
  { hex: "#FF3B3B", name: "Rojo" },
  { hex: "#111111", name: "Negro" },
  { hex: "#D4AF37", name: "Dorado" },
  { hex: "#F5F1EA", name: "Crema" },
  { hex: "#8A5CFF", name: "Violeta" },
  { hex: "#FF8A00", name: "Naranjo" },
];

/** Sizes offered as quick picks (like a text editor). */
export const SIZES = [16, 20, 24, 28, 32, 36, 40];

export interface CaptionStyle {
  look: Look;
  font: string;
  /** Text size like in a text editor: 24 is the usual size for a vertical ad. */
  size: number;
  color: string;
  accent: string;
  position: Position;
  /** Most words on screen at once. */
  words: number;
  case: Case;
  /** Keep commas and periods. */
  punct: boolean;
  /** Spell every word as in the script (fixes what the transcription heard wrong). */
  script: boolean;
  /** «Hecho con Creads IA» badge in a corner for the whole video (for Creads' own content). */
  sello: boolean;
  /** Free placement anywhere on the video: the text's centre, in % of the width and height. When set, it
   *  wins over `position` (which stays as the quick «arriba / centro / abajo» choice). */
  x?: number;
  y?: number;
}

/** Looks whose second colour matters (the highlighted word, the karaoke fill, the glow, the box). */
export const USES_ACCENT: Look[] = ["resaltar", "salto", "karaoke", "neon", "etiqueta"];

export const DEFAULT_STYLE: CaptionStyle = {
  look: "resaltar", font: "montserrat", size: 24, color: "#FFFFFF", accent: "#FFE100",
  position: "abajo", words: 3, case: "normal", punct: true, script: true, sello: false,
};

const HEX = /^#[0-9a-f]{6}$/i;
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d);
const clamp = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Math.round(Number(v));
  return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/** Cleans whatever the browser sent (also reads the old {preset, size} shape). */
export function normalizeStyle(raw: unknown): CaptionStyle {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (typeof r.preset === "number" && r.look === undefined) {
    const old = { 1: "clasico", 2: "resaltar", 3: "caja", 4: "clasico" } as Record<number, Look>;
    return {
      ...DEFAULT_STYLE,
      look: old[r.preset] ?? "resaltar",
      color: r.preset === 4 ? "#FFE100" : "#FFFFFF",
      case: r.preset === 4 ? "upper" : "normal",
      size: clamp(Number(r.size) / 4, 8, 48, 24),
    };
  }
  return {
    look: oneOf(r.look, LOOKS.map((l) => l.id), DEFAULT_STYLE.look),
    font: oneOf(r.font, FONTS.map((f) => f.id), DEFAULT_STYLE.font),
    size: clamp(r.size, 8, 48, DEFAULT_STYLE.size),
    color: typeof r.color === "string" && HEX.test(r.color) ? r.color.toUpperCase() : DEFAULT_STYLE.color,
    accent: typeof r.accent === "string" && HEX.test(r.accent) ? r.accent.toUpperCase() : DEFAULT_STYLE.accent,
    position: oneOf(r.position, ["arriba", "centro", "abajo"] as const, DEFAULT_STYLE.position),
    words: clamp(r.words, 1, 6, DEFAULT_STYLE.words),
    case: oneOf(r.case, ["normal", "upper", "lower"] as const, DEFAULT_STYLE.case),
    punct: r.punct === undefined ? DEFAULT_STYLE.punct : Boolean(r.punct),
    script: r.script === undefined ? DEFAULT_STYLE.script : Boolean(r.script),
    sello: r.sello === true,
    ...(r.y !== undefined && r.y !== null && isFinite(Number(r.y)) ? { x: clamp(r.x ?? 50, 8, 92, 50), y: clamp(r.y, 6, 94, 80) } : {}),
  };
}

export const fontOf = (id: string) => FONTS.find((f) => f.id === id) ?? FONTS[0];

/** Font height in pixels on a video of W×H. Size 24 = 96 px on a 1080×1920 vertical video. */
export function fontPx(size: number, W: number, H: number) {
  const base = Math.min(W, H) / 1080;
  return Math.round(size * 4 * base * (W > H ? 0.85 : 1));
}

/** Distance from the bottom edge to the text, in pixels (ASS MarginV with bottom alignment). */
export function marginPx(position: Position, H: number, vertical: boolean) {
  if (position === "abajo") return Math.round(H * (vertical ? 0.26 : 0.1)); // above Meta's buttons and caption
  if (position === "arriba") return Math.round(H * (vertical ? 0.2 : 0.1));
  return 0;
}

/** Applies the case and punctuation choices to one word. */
export function shapeWord(w: string, s: Pick<CaptionStyle, "case" | "punct">) {
  // without punctuation: drop periods, commas, colons and quotes at the edges ("34,000" keeps its comma)
  const t = s.punct ? w : w.replace(/^["“”'(]+/, "").replace(/[.,;:"“”')]+$/, "");
  return s.case === "upper" ? t.toLocaleUpperCase("es") : s.case === "lower" ? t.toLocaleLowerCase("es") : t;
}

const hex2 = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
/** "#RRGGBB" → ASS "&HAABBGGRR" (alpha 00 = solid). */
export function assColor(hex: string, alpha = 0) {
  const h = hex.replace("#", "");
  return `&H${hex2(alpha)}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase();
}
/** Inline override form "&HBBGGRR&". */
export const assInline = (hex: string) => `&H${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}&`.toUpperCase();

/**
 * Ready-made subtitle styles (one click sets everything): from calm UGC to luxury, Creads' neon and the
 * high-energy TikTok look. The customer can still change any detail after picking one.
 */
export const CAPTION_PRESETS: { id: string; name: string; hint: string; style: Partial<CaptionStyle> }[] = [
  { id: "ugc", name: "UGC tranqui", hint: "Natural, como un video real de celular", style: { look: "suave", font: "poppins", size: 22, color: "#FFFFFF", accent: "#FFFFFF", case: "normal", words: 3, position: "abajo", punct: true } },
  { id: "normal", name: "Normal", hint: "Clásico con borde, se lee en todo", style: { look: "clasico", font: "montserrat", size: 24, color: "#FFFFFF", accent: "#FFE100", case: "normal", words: 3, position: "abajo", punct: true } },
  { id: "resaltado", name: "Palabra resaltada", hint: "La palabra que se dice en amarillo", style: { look: "resaltar", font: "montserrat", size: 26, color: "#FFFFFF", accent: "#FFE100", case: "normal", words: 3, position: "abajo", punct: false } },
  { id: "impacto", name: "Impacto TikTok", hint: "Grande, mayúsculas, con salto", style: { look: "salto", font: "anton", size: 32, color: "#FFFFFF", accent: "#FFE100", case: "upper", words: 2, position: "centro", punct: false } },
  { id: "palabra", name: "Una a una", hint: "Una palabra a la vez, grande", style: { look: "palabra", font: "archivo", size: 34, color: "#FFFFFF", accent: "#3DFF6E", case: "upper", words: 1, position: "centro", punct: false } },
  { id: "luxury", name: "Luxury", hint: "Crema y dorado, entra suave", style: { look: "subir", font: "poppins", size: 22, color: "#F5F1EA", accent: "#D4AF37", case: "normal", words: 3, position: "abajo", punct: true } },
  { id: "karaoke", name: "Karaoke", hint: "El color avanza mientras habla", style: { look: "karaoke", font: "montserrat", size: 26, color: "#FFFFFF", accent: "#3DFF6E", case: "upper", words: 3, position: "abajo", punct: false } },
  { id: "creads", name: "Creads neón", hint: "Brillo rosado, el estilo de Creads", style: { look: "neon", font: "archivo", size: 28, color: "#FFFFFF", accent: "#FF4FD8", case: "upper", words: 2, position: "abajo", punct: false } },
  { id: "etiqueta", name: "Etiqueta", hint: "Texto sobre una caja de color", style: { look: "etiqueta", font: "inter", size: 24, color: "#FFFFFF", accent: "#FF3B3B", case: "normal", words: 3, position: "abajo", punct: false } },
  { id: "pop", name: "Pop color", hint: "Rebota al entrar, amarillo", style: { look: "pop", font: "poppins", size: 28, color: "#FFE100", accent: "#FFE100", case: "upper", words: 2, position: "centro", punct: false } },
  { id: "noticia", name: "Noticia", hint: "Caja oscura, letra condensada", style: { look: "caja", font: "bebas", size: 30, color: "#FFFFFF", accent: "#FFFFFF", case: "upper", words: 4, position: "abajo", punct: false } },
];
