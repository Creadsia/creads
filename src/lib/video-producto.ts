// «Video de producto» (owner, 25 Oct 2026): short ecommerce videos that are not UGC — the product moving in a
// premium scene (spin, macro, splash, floating, unboxing, lifestyle), with the ad's headline on top. Three steps,
// all charged one by one and given back if they fail: a clean 9:16 scene of the real product (Nano Banana 2,
// ≈US$0.08), the scene animated (Hailuo 2.3 Pro 1080p 6 s, ≈US$0.49; Hailuo 2.3 if Pro is off), and the headline
// burnt in by the montage engine (free). Browser-safe: no node imports here.

export const ESTILOS_VIDEO = [
  {
    id: "giro", label: "Giro 360",
    escena: "the product standing alone on a glossy pedestal in a minimal studio with a soft gradient background in the brand colours, dramatic rim light, lots of empty space above",
    movimiento: "the product slowly rotates 360 degrees on the pedestal, smooth orbit of soft light, subtle reflections, premium commercial look",
  },
  {
    id: "macro", label: "Acercamiento macro",
    escena: "extreme close-up of the product's best detail (texture, label, material) with shallow depth of field, studio light, lots of empty space above",
    movimiento: "slow cinematic push-in towards the product detail, light sweeps across the surface, gentle focus pull",
  },
  {
    id: "salpicadura", label: "Salpicadura",
    escena: "the product on a wet reflective surface with water droplets, fresh ingredients or fruit related to it around, bright clean light, lots of empty space above",
    movimiento: "a fresh splash of water bursts around the product in slow motion, droplets fly and fall, the product stays still and sharp",
  },
  {
    id: "flotando", label: "Flotando",
    escena: "the product floating in mid-air over a soft pastel background in the brand colours, a few small related elements floating around it, lots of empty space above",
    movimiento: "the product floats and gently rises and tilts, the small elements drift slowly around it, dreamy soft light",
  },
  {
    id: "unboxing", label: "Unboxing",
    escena: "a premium gift box on a clean table with the product inside, hands about to open it, warm natural light, lots of empty space above",
    movimiento: "hands open the box lid and lift the product towards the camera, smooth and satisfying, warm light",
  },
  {
    id: "lifestyle", label: "En su lugar",
    escena: "the product in its natural place of use (kitchen, bathroom, desk, gym bag or nightstand), styled like a premium lifestyle photo, morning light, lots of empty space above",
    movimiento: "slow dolly shot around the product, soft morning light moves through the scene, subtle steam or natural movement where it makes sense",
  },
] as const;
export type EstiloVideo = (typeof ESTILOS_VIDEO)[number]["id"];
export const esEstiloVideo = (v: unknown): v is EstiloVideo => ESTILOS_VIDEO.some((e) => e.id === v);
export const estiloDe = (id: EstiloVideo) => ESTILOS_VIDEO.find((e) => e.id === id)!;

/** The picture the video starts from: the real product (from its photo) in the chosen scene, no text. */
export function escenaPrompt(o: { estilo: EstiloVideo; producto: string; marca: string }) {
  const e = estiloDe(o.estilo);
  return `Premium ecommerce commercial still, vertical 9:16. ${o.producto ? `Product: ${o.producto}. ` : ""}Show the product from the reference photo exactly as it is (same shape, label, colours). Scene: ${e.escena}.${o.marca ? ` ${o.marca}` : ""} Photorealistic, high-end, sharp. NO text, NO letters, NO logos other than the product's own label, NO watermark. Keep the top 30% of the frame calm and empty for a headline.`;
}

/** What moves in the video. */
export function movimientoPrompt(o: { estilo: EstiloVideo }) {
  return `${estiloDe(o.estilo).movimiento}. The product keeps its exact shape, label and colours the whole time. No text appears. Smooth, premium, 6 seconds.`;
}
