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

/** One new angle proposed from a winning ad: shown to the customer in Spanish, drawn from the English prompt. */
export interface Enfoque { angulo: string; idea: string; titular: string; hipotesis: string; prompt: string }
/** A variation of the SAME ad (same layout, boxes, colours, fonts, button), only the person or the words change. */
export interface Iteracion { cambio: string; titular: string; prompt: string }

/**
 * «Itera sobre este winner» (owner, 24 Oct 2026: he wanted the same ad with another person or other words, and
 * got an unrelated picture). The winning image goes to the image model as the image to EDIT, with this
 * instruction: everything identical except what the customer asks to change.
 */
export function iterarPrompt(cambio: { persona?: string; titular?: string; extra?: string }) {
  const keep = "Edit this exact ad image. Keep IDENTICAL: the layout and composition, the framing and camera angle, the photo style and lighting, the background gradient, every text box (same shape, colour, position and size), the font, the highlight colour and its position, the call-to-action button (same shape, colour and text) and the overall design.";
  const changes = [
    cambio.persona ? `Replace the person with ${cambio.persona}, in the same pose and position, holding the same product the same way, same natural phone-selfie look.` : "",
    cambio.titular ? `Replace the headline text with exactly: "${cambio.titular}" — same font, same white boxes, same line breaks style; highlight the same kind of key words with the same highlight colour. Spell it exactly, letter by letter.` : "",
    cambio.extra ? cambio.extra : "",
  ].filter(Boolean);
  return `${keep}\nChange ONLY this:\n- ${changes.join("\n- ") || "a slightly different pose and expression of the same person"}\nEverything else must look exactly like the original ad. No new logos or extra text.`;
}
export interface Analisis { tipo: string; que_se_ve: string; por_que_funciona: string[]; angulo: string; conciencia: string; riesgos: string; testear: string }

/**
 * «Analizar una ganadora» (owner, 24 Oct 2026): he uploaded a winning foundation-repair image with "analyse it
 * and find another approach" and the image model, which can't think, drew unrelated pictures. Claude looks at
 * the ad with a marketer's eye first (affiliate, business owner or e-commerce), explains why it works, and
 * proposes NEW angles for the same offer, each with its hypothesis and a ready prompt.
 */
export function winnerPrompt(nota: string, n: number, aspect: string) {
  return `You are a senior performance marketer and direct-response creative strategist for paid social (Meta, TikTok) static image ads. You think like the person who pays for the traffic: an affiliate or media buyer running an offer, a local business owner, or an e-commerce brand. The image is a WINNING ad from a real campaign.
${nota ? `What the advertiser says about it and wants: """${nota.slice(0, 1500)}"""\n` : ""}
1. Analyse it as a marketer, in natural Spanish from Chile (tuteo: «tú», never «vos»), short and concrete:
- "tipo": what kind of advertiser and funnel this is (e.g. "afiliado de lead-gen en EE. UU. para reparación de cimientos → landing de cotización", "ecommerce de un producto", "negocio local que busca agendas").
- "que_se_ve": what we see and why it stops the scroll in the feed.
- "por_que_funciona": 3 to 5 reasons: the hook in the headline (curiosity, fear of loss, savings, proof, real urgency, identity), who exactly it speaks to, the emotion, why it looks native (a phone photo or news, not an ad), how it pre-qualifies the click and what the click promises.
- "angulo": the angle in a few words.
- "conciencia": the audience's awareness level it targets (unaware / problem-aware / solution-aware / product-aware / most-aware) and what that means for the next tests.
- "riesgos": Meta ad-policy or trust risks to keep in mind for this niche (e.g. personal attributes, sensational claims, before/after, prices or promises the landing doesn't keep). One or two lines; say "ninguno relevante" if so.
- "testear": how to test the new approaches (same offer, budget and audience; what metric to compare: CTR, cost per lead or per purchase; how many days).
2. Then propose ${n} NEW approaches for the SAME offer and audience — truly different angles or awareness levels, not variations of the same picture. Draw from what works in that business model (lead-gen/affiliate: the scary detail close-up, "what X won't tell you", a quiz/checklist of signs, local-news style, quotes compared, the neighbour who waited too long; e-commerce: the product in real use, the problem it solves, unboxing, "why everyone is buying this", comparison with the usual alternative; local business: the owner, the real place, the offer, social proof only if real). Each one must look believable and be understood in one second.
For each approach:
- "angulo": the angle in a few words (Spanish).
- "idea": what the image shows, 1–2 sentences (Spanish).
- "titular": the EXACT headline on the image, max 8 words, in the SAME language as the winning ad (Spanish from Chile uses «tú», never «vos»: «prueba», «deja», never «probá», «dejá»). No prices, numbers or claims the ad doesn't support.
- "hipotesis": one line in Spanish: why it could beat the winner (which new audience segment, emotion or awareness level it opens).
- "prompt": a complete English prompt for an image model, written as a description of a REAL PHOTO, not an ad: "Amateur iPhone photo, slightly tilted, natural light, [exact real place typical of the audience], [subject and the detail that hooks], ordinary and unpolished, looks like a real person took it, not a stock photo. Bold text overlay at the top in a plain white box with black sans-serif letters: \\"[titular]\\". No logos, no other text." Adapt the look to the angle (local-news lower third, a phone screenshot, a product in hand…). ${aspect} format. Never copy the winning ad's photo, people, brand or exact headline.

3. Propose 4 ITERATIONS of the SAME ad: the same design kept identical (layout, boxes, colours, fonts, highlight, button), changing only ONE thing each, the way a media buyer iterates a winner: (a) another person of the same profile, (b) a different person (another age, look or a man), (c) the same image with a new headline in the same structure and tone, (d) another headline angle. For each:
- "cambio": what changes, in a few words (Spanish).
- "persona": only if the person changes: an English description of the new person (age, look, hair, clothes) — else "".
- "titular": the new headline EXACTLY as it must appear on the image (same language and length as the winner; Spanish from Chile uses «tú») — or "" to keep the original text.

Return JSON only: {"analisis":{"tipo":"...","que_se_ve":"...","por_que_funciona":["..."],"angulo":"...","conciencia":"...","riesgos":"...","testear":"..."},"iteraciones":[{"cambio":"...","persona":"...","titular":"..."}],"enfoques":[{"angulo":"...","idea":"...","titular":"...","hipotesis":"...","prompt":"..."}]}`;
}
