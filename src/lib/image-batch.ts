// «Varias imágenes a la vez»: the styles from the prototype (legacy/creads-artifact.html, image tab), and the
// prompts that turn one idea into N different ad images and check each result.

export type ImageStyle = "libre" | "producto" | "cartel" | "selfie" | "antesdespues" | "nativo" | "texto";

export const IMAGE_STYLES: { id: ImageStyle; label: string; how: string }[] = [
  { id: "libre", label: "Libre", how: "Any ad-worthy composition that fits the idea." },
  { id: "producto", label: "Producto", how: "Product photography: the product as the hero, clean or lifestyle setting, premium light." },
  { id: "cartel", label: "Persona con cartel", how: "A real-looking person holding a handwritten cardboard sign with a short punchy line (the line in Spanish unless the idea is in English)." },
  { id: "selfie", label: "Selfie UGC", how: "A casual smartphone selfie of a real-looking customer, natural light, authentic, not staged." },
  { id: "antesdespues", label: "Antes / después", how: "A clear before/after split in one image, same subject and framing, the difference obvious at a glance." },
  { id: "nativo", label: "Post nativo", how: "Looks like an ordinary organic social media photo, not an ad: candid, imperfect, everyday setting." },
  { id: "texto", label: "Solo texto", how: "A bold typographic graphic: one short question or statement in big type on a simple background (like a «Yes/No» ad)." },
];

export function ideasPrompt(idea: string, style: ImageStyle, n: number, aspect: string) {
  const s = IMAGE_STYLES.find((x) => x.id === style) ?? IMAGE_STYLES[0];
  return `You write image-generation prompts for paid social ads (Meta, TikTok). The advertiser wants ${n} DIFFERENT images to test against each other.

Their idea (any language): """${idea}"""
Style: ${s.label} — ${s.how}
Format: ${aspect}${aspect === "4:5" || aspect === "9:16" ? " (keep faces, products and any text inside the central safe zone, away from the top and bottom 12%)" : ""}

Rules:
- Each prompt is a different angle: change the hook, the scene, the person, the framing or the emotion. Never ${n} near-copies.
- Write each prompt in English, detailed and photorealistic unless the style says otherwise.
- Any words that must appear IN the image go in double quotes, short (max 6 words), spelled exactly, in the idea's language.
- Only original people and invented brands: no celebrities, no real logos or trademarks, no children alone with unrelated adults.
- No promises of income or medical results, nothing misleading.

Return JSON: {"prompts": ["...", "..."]} with exactly ${n} prompts.`;
}

export function reviewPrompt(prompt: string) {
  return `Check this generated ad image against the request: """${prompt}"""
Look only for SERIOUS problems a customer would reject: misspelled or garbled text, extra or deformed fingers/limbs, a melted face, an obviously wrong product, or a real brand logo.
Return JSON: {"ok": true|false, "nota": "if not ok: one short sentence in Spanish saying what is wrong"}`;
}
