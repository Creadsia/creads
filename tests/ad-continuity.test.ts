import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://sb.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
process.env.FAL_KEY = "test";

import { readOrder, publicAd, type ApiAd } from "../src/lib/api-ads";
import { readLang, sttLang, spokenEs } from "../src/lib/ad-lang";
import { PERSON_REF, PRODUCT_EXACT, PRODUCT_GENERIC, adFramePrompt, autoPersona, personaWanted, scriptGender, usesPersona, withPersonRef, withoutPersonRef } from "../src/lib/ad-continuity";
import { cutsPrompt } from "../src/lib/cuts-prompt";
import { type SceneContext, directorPrompt, firstFramePrompt, scenePrompt } from "../src/lib/director";
import { type LookTarget, applyLook, lookPrompt } from "../src/lib/review-look";
import { defaultAccent, seededPick, usEnglish } from "../src/lib/voices";
import { framePrompts, runStep, type AdJob, type Studio } from "../src/lib/ad-runner";

const G = "Estas zapatillas STRIDE me cambiaron las mañanas: corro más liviano y sin dolor.";

// ---------- A/C: the order ----------

test("readOrder: es-CL, es (español neutro) and en; other Spanish locales are neutral Spanish; old orders keep es-CL", () => {
  const lang = (x: unknown) => (readOrder({ guion: G, idioma: x }) as { idioma: string }).idioma;
  assert.equal(lang(undefined), "es-CL");
  assert.equal(lang("es-CL"), "es-CL");
  assert.equal(lang("es"), "es");
  assert.equal(lang("es-MX"), "es");
  assert.equal(lang("en"), "en");
  assert.equal(lang("en-US"), "en");
  assert.equal(lang("fr"), "es-CL");
  assert.equal(readLang("es-419", "en"), "es");
  assert.equal(sttLang("es"), "es");
  assert.equal(sttLang("es-CL"), "es");
  assert.equal(sttLang("en"), "en");
  assert.equal(sttLang(undefined), "en");
  const es = readOrder({ guion: G, idioma: "es", dramatizacion: true }) as { aviso?: string };
  assert.equal(es.aviso, "Dramatización · actor IA");
});

test("readOrder: the product photo is a media link of the account (absolute links are trimmed), anything else is refused", () => {
  const o = readOrder({ guion: G, producto: "https://www.creadsia.com/api/media/ws/w01/uploads/zapatilla.png?x=1" });
  assert.equal(typeof o, "object");
  assert.equal((o as { producto?: string }).producto, "/api/media/ws/w01/uploads/zapatilla.png");
  assert.match(String(readOrder({ guion: G, producto: "https://otra-web.com/foto.png" })), /foto del producto no es válida/);
  assert.match(String(readOrder({ guion: G, producto: 42 })), /foto del producto/);
  assert.equal((readOrder({ guion: G }) as { producto?: string }).producto, undefined, "optional");
  assert.equal((readOrder({ guion: G, producto: "" }) as { producto?: string }).producto, undefined);
  const ad = { ...(o as object), id: "ad_x1y2z3", ws: "w01", userId: "u", createdAt: "", updatedAt: "", estado: "cola" } as ApiAd;
  assert.match(String(publicAd(ad).producto), /^https?:\/\/.+\/api\/media\/ws\/w01\/uploads\/zapatilla\.png$/);
});

test("readOrder: a title the caller gave is kept (the cut step doesn't rename it)", () => {
  assert.equal((readOrder({ guion: G, titulo: "Stride enero" }) as { tituloPropio?: boolean }).tituloPropio, true);
  assert.equal((readOrder({ guion: G }) as { tituloPropio?: boolean }).tituloPropio, undefined);
});

// ---------- C: Spanish wording in the prompts ----------

test("the cut prompt: Chilean for es-CL, neutral with no slang for es, American English (and an English title) for en", () => {
  const cl = cutsPrompt(G, { format: "ugc", cap: 8, maxSec: 8, lang: "es-CL" });
  const es = cutsPrompt(G, { format: "ugc", cap: 8, maxSec: 8, lang: "es" });
  const en = cutsPrompt("These shoes changed my mornings. I run lighter and without pain.", { format: "ugc", cap: 8, maxSec: 8, lang: "en" });
  assert.match(cl, /español de Chile/);
  assert.doesNotMatch(cl, /neutro/);
  assert.match(es, /español latino neutro/);
  assert.match(es, /SIN modismos/);
  assert.match(es, /cachai/, "names the slang to avoid");
  assert.doesNotMatch(es, /español de Chile/);
  assert.match(en, /EE\. UU\./);
  assert.match(en, /"titulo":"short name in English"/);
  assert.match(cl, /"titulo":"nombre corto en español"/);
  assert.match(spokenEs("es"), /el acento lo pone la voz/);
});

const ctx = (o: Partial<SceneContext> = {}): SceneContext => ({ format: "ugc", lang: "es-CL", aspect: "9:16", avatar: { description: "a woman about 30, plain olive t-shirt", hasPhoto: false }, script: G, ...o });
const cut = { tipo: "Hook", texto: "Estas zapatillas me cambiaron las mañanas." };

test("scene prompts: Chilean Spanish for es-CL, neutral Latin American Spanish for es, American English for en", () => {
  const cl = scenePrompt(ctx(), cut, {}, 0);
  const es = scenePrompt(ctx({ lang: "es" }), cut, {}, 0);
  const en = scenePrompt(ctx({ lang: "en" }), cut, {}, 0);
  assert.match(cl, /Chilean Spanish/);
  assert.match(cl, /looks like Chile/);
  assert.match(es, /neutral Latin American Spanish/);
  assert.match(es, /no regional slang/);
  assert.doesNotMatch(es, /Chile/);
  assert.match(en, /American English/);
  assert.doesNotMatch(en, /Spanish/);
  assert.match(directorPrompt(ctx({ lang: "es" }), [cut]), /español neutro/);
  assert.match(firstFramePrompt(ctx({ lang: "es" }), cut, {}), /looks Latin American/);
});

test("scene prompts: the customer's product photo is copied exactly; without one, an unbranded generic product", () => {
  const withPhoto = scenePrompt(ctx({ product: { name: "the product shown in the product reference photo", hasPhoto: true } }), cut, {}, 0);
  assert.ok(withPhoto.includes(PRODUCT_EXACT));
  assert.match(withPhoto, /never show any other brand/);
  assert.ok(!withPhoto.includes(PRODUCT_GENERIC));
  const none = scenePrompt(ctx(), cut, {}, 0);
  assert.ok(none.includes(PRODUCT_GENERIC));
  assert.match(none, /no logos, brand names, brand stripes/);
  assert.match(directorPrompt(ctx(), [cut]), /NO PRODUCT PHOTO/);
  assert.match(directorPrompt(ctx({ product: { name: "x", hasPhoto: true } }), [cut]), /photo of the real product/);
  assert.ok(firstFramePrompt(ctx({ product: { name: "x", hasPhoto: true } }), cut, {}).includes(PRODUCT_EXACT));
  assert.ok(firstFramePrompt(ctx(), cut, {}).includes(PRODUCT_GENERIC));
});

// ---------- A/B: first frames ----------

test("first frames: product exact (its label is the only logo) or generic; the automatic person copies the first cut", () => {
  const p = adFramePrompt({ setting: "un parque" }, "es", { product: true });
  assert.ok(p.includes(PRODUCT_EXACT));
  assert.match(p, /The reference image is the product/);
  assert.match(p, /no logos other than the product's own label/);
  assert.match(p, /looks Latin American/);
  const g = adFramePrompt(undefined, "en", {});
  assert.ok(g.includes(PRODUCT_GENERIC));
  assert.doesNotMatch(g, /Chile|Latin American/);

  const persona = autoPersona("ad_abc123", "es", G);
  const frames = framePrompts({ idioma: "es", persona, producto: "/api/media/ws/w01/p.png" }, [{ setting: "a" }, { setting: "b" }, { setting: "c" }]);
  assert.ok(!frames[0].includes(PERSON_REF), "cut 1 is drawn from the description");
  assert.ok(frames[0].includes(persona));
  assert.ok(frames[1].includes(PERSON_REF) && frames[2].includes(PERSON_REF), "later cuts copy cut 1's person");
  assert.match(frames[1], /first reference image is the person, the second one is the product/);
  // the reference couldn't be had: the description alone, and the product is the only reference again
  const alone = withoutPersonRef(frames[1]);
  assert.ok(!alone.includes(PERSON_REF) && alone.includes(persona));
  assert.match(alone, /The reference image is the product/);
  // cut 1 drawn again with another cut as the reference
  assert.ok(withPersonRef(frames[0]).includes(PERSON_REF));
  // an avatar: its photo is the reference of every cut
  const av = framePrompts({ idioma: "es-CL", avatarId: "11111111-1111-1111-1111-111111111111" }, [undefined, undefined]);
  assert.ok(av.every((f) => f.includes(PERSON_REF)));
  assert.ok(av.every((f) => f.includes("looks like Chile")));
});

test("the automatic person: stable per ad, gender from the script, a plain outfit with no logo", () => {
  const a = autoPersona("ad_1", "es", "Estoy cansada de que me duelan los pies cuando corro en la mañana.");
  assert.equal(a, autoPersona("ad_1", "es", "Estoy cansada de que me duelan los pies cuando corro en la mañana."));
  assert.match(a, /woman/);
  assert.match(a, /Latin American/);
  assert.match(a, /no print, no logo/);
  assert.match(autoPersona("ad_2", "en", "As a dad of three I never had time to run."), /American man/);
  assert.match(autoPersona("ad_3", "es-CL", "Soy mamá de dos y no tengo tiempo."), /Chilean woman/);
  assert.equal(scriptGender("Estoy cansado de todo."), "male");
  assert.equal(scriptGender("Soy una persona normal."), "", "«una» is not an adjective");
  assert.equal(personaWanted("ugc"), true);
  assert.equal(personaWanted("podcast"), true);
  assert.equal(personaWanted("ronda"), false, "a different person each cut on purpose");
  assert.equal(personaWanted("faceless"), false);
  const base = { persona: true, face: false, story: false, talking: false, actor: false, noFaces: false };
  assert.equal(usesPersona(base), true);
  assert.equal(usesPersona({ ...base, face: true }), false, "an avatar's photo already does it");
  assert.equal(usesPersona({ ...base, noFaces: true }), false, "Seedance refuses pictures of people");
  assert.equal(usesPersona({ ...base, talking: true }), false);
  assert.equal(usesPersona({ ...base, persona: false }), false);
});

// ---------- D: the review ----------

const targets = (n: number): LookTarget[] => Array.from({ length: n }, (_, idx) => ({ idx, issues: [], severe: false }));

test("review: another product is severe (free redo) and its frame is drawn again; only when there is a product photo", () => {
  const t = targets(3);
  applyLook(t, [{ corte: 2, tipo: "producto", problema: "zapatilla de otra marca", grave: false }], { hasProduct: true, format: "ugc" });
  assert.equal(t[1].severe, true, "a different product is always severe");
  assert.equal(t[1].redraw, true);
  assert.match(t[1].issues[0], /producto distinto/);
  const n = targets(2);
  applyLook(n, [{ corte: 1, tipo: "producto", problema: "otro producto", grave: true }], { hasProduct: false, format: "ugc" });
  assert.equal(n[0].severe, false, "without a photo there's nothing to compare");
  assert.equal(n[0].issues.length, 0);
});

test("review: clothes or person changing between scenes is severe only when clearly different", () => {
  const t = targets(4);
  applyLook(t, [
    { corte: 2, tipo: "persona", problema: "polera gris en vez de negra", grave: true, claro: true },
    { corte: 3, tipo: "persona", problema: "quizás otra luz", grave: true, claro: false },
    { corte: 4, tipo: "persona", problema: "pelo un poco distinto", grave: false, claro: true },
  ], { hasProduct: false, format: "ugc" });
  assert.equal(t[1].severe, true);
  assert.equal(t[1].redraw, true);
  assert.match(t[1].issues[0], /la ropa o la persona cambia entre escenas/);
  assert.equal(t[2].severe, false);
  assert.equal(t[3].severe, false);
  assert.equal(t[2].issues.length, 1, "still noted for the customer");
  // the automatic person comes from cut 1: redoing it keeps its frame (the others copied it)
  const p = targets(2);
  applyLook(p, [{ corte: 1, tipo: "persona", problema: "otra ropa", grave: true, claro: true }], { hasProduct: false, format: "ugc", personaFromFirst: true });
  assert.equal(p[0].severe, true);
  assert.equal(p[0].redraw, undefined);
  // a ronda has a different person on purpose
  const r = targets(2);
  applyLook(r, [{ corte: 2, tipo: "persona", problema: "otra persona", grave: true, claro: true }], { hasProduct: false, format: "ronda" });
  assert.equal(r[1].severe, false);
  // anything else: as the reviewer says
  const o = targets(2);
  applyLook(o, [{ corte: 1, tipo: "otro", problema: "mano deforme", grave: true }, { corte: 9, problema: "no existe", grave: true }], { hasProduct: false, format: "ugc" });
  assert.equal(o[0].severe, true);
  assert.equal(o[0].redraw, undefined);
});

test("review prompt: the product photo is the last image; consecutive cuts are compared", () => {
  const p = lookPrompt({ formatName: "UGC selfie", format: "ugc", twoPeople: false, narr: false, texts: ["a", "b", "c"], hasProduct: true });
  assert.match(p, /imagen 4\) NO es un corte/);
  assert.match(p, /ANTERIOR/);
  assert.match(p, /"claro"/);
  const q = lookPrompt({ formatName: "UGC selfie", format: "ugc", twoPeople: false, narr: false, texts: ["a", "b"], hasProduct: false });
  assert.doesNotMatch(q, /foto del producto real/);
  assert.match(q, /marca real/);
});

// ---------- C: default voices ----------

test("default voice: Chilean for es-CL, Mexican for es, an American library voice for en", () => {
  assert.equal(defaultAccent("es-CL"), "es-CL");
  assert.equal(defaultAccent("es"), "es-MX");
  assert.equal(defaultAccent("en"), null);
  const v = (id: string, labels: Record<string, string>, category = "premade") => ({ id, name: id, category, labels });
  assert.equal(usEnglish(v("a", { accent: "american", gender: "male" }), "male"), true);
  assert.equal(usEnglish(v("b", { accent: "british", gender: "male" }), "male"), false);
  assert.equal(usEnglish(v("c", { accent: "american", gender: "female" }), "male"), false);
  assert.equal(usEnglish(v("d", { accent: "american" }, "cloned"), ""), false, "never someone's clone");
  assert.equal(seededPick(["x", "y", "z"], "Valentina"), seededPick(["x", "y", "z"], "Valentina"));
  assert.equal(seededPick([], "a"), undefined);
});

// ---------- the pipeline sends it all ----------

test("the ad pipeline sends the product photo, the automatic person and the frames; a redo asks for a new frame", async () => {
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  const studio: Studio = async <T,>(path: string, body?: unknown) => {
    calls.push({ path, body: (body ?? {}) as Record<string, unknown> });
    if (path === "/api/scenes") return { scenes: [{ prompt: "p1", dir: { setting: "parque" } }, { prompt: "p2" }] } as T;
    if (path === "/api/ads/start") return { ad: { id: "ad-1" }, clips: [{ id: "c1" }, { id: "c2" }] } as T;
    if (path === "/api/review") return { results: [{ clipId: "c2", severe: true, freeRedo: true, redraw: true, issues: ["imagen: producto distinto"] }] } as T;
    return {} as T;
  };
  const j = { id: "ad_test9", estado: "escenas", updatedAt: new Date().toISOString(), titulo: "x", formato: "ugc", idioma: "es", guion: G, producto: "/api/media/ws/w01/p.png", cortes: [{ tipo: "Hook", texto: "uno" }, { tipo: "CTA", texto: "dos" }] } as AdJob;
  const patch = await runStep(j, studio, async () => "minimax-h3-max", false);
  assert.equal(patch.estado, "generando");
  assert.ok(patch.persona, "the automatic person is kept on the job");
  const scenes = calls.find((c) => c.path === "/api/scenes")!.body;
  assert.equal(scenes.lang, "es");
  assert.equal(scenes.productImage, "/api/media/ws/w01/p.png");
  assert.equal(scenes.avatarText, patch.persona);
  const start = calls.find((c) => c.path === "/api/ads/start")!.body;
  assert.equal(start.productImage, "/api/media/ws/w01/p.png");
  assert.equal(start.persona, patch.persona);
  const clips = start.clips as { framePrompt: string }[];
  assert.ok(clips[0].framePrompt.includes(PRODUCT_EXACT));
  assert.ok(clips[1].framePrompt.includes(PERSON_REF));

  // with an avatar there's no automatic person
  calls.length = 0;
  const withAvatar = await runStep({ ...j, avatarId: "11111111-1111-1111-1111-111111111111" }, studio, async () => "minimax-h3-max", false);
  assert.equal(withAvatar.persona, undefined);
  assert.equal(calls.find((c) => c.path === "/api/scenes")!.body.avatarText, undefined);

  calls.length = 0;
  await runStep({ ...j, estado: "revisando", adId: "ad-1" }, studio, async () => "x", false);
  const fix = calls.find((c) => c.path === "/api/clips/fix")!.body;
  assert.equal(fix.redraw, true);
  assert.equal(calls.find((c) => c.path === "/api/clips/run")!.body.free, true);

  // a title the caller chose survives the cut step
  const cutsStudio: Studio = async <T,>() => ({ titulo: "Título de la IA", cortes: [{ tipo: "Hook", texto: "uno" }] } as T);
  assert.equal((await runStep({ ...j, estado: "cola", titulo: "Mío", tituloPropio: true }, cutsStudio, async () => "x", false)).titulo, "Mío");
  assert.equal((await runStep({ ...j, estado: "cola", titulo: "Mío" }, cutsStudio, async () => "x", false)).titulo, "Título de la IA");
});
