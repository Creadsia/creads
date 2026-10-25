// Did the clip say the script? Ported from the prototype's montage tool (legacy/af.py: norm, align, qa).
// Numbers are compared as digits ("thirty four thousand" = "34,000"), small mishearings are forgiven.

const SKIP = new Set(["dollars", "dollar", "bucks", "uh", "um", "umm", "uhh", "eh", "ehh", "mmm"]);
const U = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(" ");
const UN = new Map(U.map((w, i) => [w, i]));
const T: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

function nums(toks: string[]): string[] {
  const out: string[] = [];
  let cur: number | null = null;
  let total = 0;
  const flush = () => {
    if (cur !== null || total) out.push(String(total + (cur ?? 0)));
    cur = null;
    total = 0;
  };
  for (const w of toks) {
    if (/^\d+$/.test(w)) {
      if (cur !== null && cur < 100 && w.length <= 2 && cur % 100 === 0 && cur) { cur += Number(w); continue; }
      flush(); cur = Number(w); continue;
    }
    if (UN.has(w)) {
      const v = UN.get(w)!;
      if (cur === null) cur = v;
      else if (cur % 10 === 0 && cur >= 20 && cur < 100 && v < 10) cur += v;
      else if (cur % 100 === 0 && cur >= 100) cur += v;
      else { flush(); cur = v; }
      continue;
    }
    if (w in T) {
      const v = T[w];
      if (cur === null) cur = v;
      else if (cur < 20 && cur > 0) cur = cur * 100 + v; // "one sixty" -> 160
      else if (cur % 100 === 0 && cur >= 100) cur += v;
      else { flush(); cur = v; }
      continue;
    }
    if (w === "hundred" && cur !== null) { cur *= 100; continue; }
    if ((w === "thousand" || w === "k") && (cur !== null || total)) { total = (total + (cur ?? 0)) * 1000; cur = null; continue; }
    if (w === "and" && cur !== null && cur >= 100) continue;
    flush();
    out.push(w);
  }
  flush();
  return out;
}

export function norm(t: string, lang: "en" | "es" = "en"): string[] {
  let s = t.toLowerCase().replace(/['’]/g, "");
  if (lang === "es") s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/(?<=\d),(?=\d{3})/g, "").replace(/(?<=\d)\.(?=\d{3})/g, "").replace(/(\d)k\b/g, "$1 thousand").replace(/-/g, " ");
  const toks = s.match(lang === "es" ? /[a-zñ]+|\d+/g : /[a-z]+|\d+/g) ?? [];
  return (lang === "en" ? nums(toks) : toks).filter((w) => !SKIP.has(w));
}

/** Ratcliff/Obershelp similarity, the same measure as Python's difflib.SequenceMatcher.ratio(). */
export function ratio<T>(a: ArrayLike<T>, b: ArrayLike<T>): number {
  if (!a.length && !b.length) return 1;
  const rec = (alo: number, ahi: number, blo: number, bhi: number): number => {
    let best = 0, bi = alo, bj = blo;
    let prev = new Map<number, number>();
    for (let i = alo; i < ahi; i++) {
      const next = new Map<number, number>();
      for (let j = blo; j < bhi; j++) {
        if (a[i] === b[j]) {
          const k = (prev.get(j - 1) ?? 0) + 1;
          next.set(j, k);
          if (k > best) { best = k; bi = i - k + 1; bj = j - k + 1; }
        }
      }
      prev = next;
    }
    if (!best) return 0;
    return best + rec(alo, bi, blo, bj) + rec(bi + best, ahi, bj + best, bhi);
  };
  return (2 * rec(0, a.length, 0, b.length)) / (a.length + b.length);
}

const same = (a: string, b: string) => a === b || (a.length > 2 && b.length > 2 && ratio(a, b) >= 0.66);

function align(a: string[], b0: string[]): string[] {
  const sa = new Set(a);
  const b: string[] = [];
  for (const w of b0) {
    // the transcriber sometimes splits numbers ("3 40"): glue them back when the script has the joined number
    if (b.length && /^\d+$/.test(w) && /^\d+$/.test(b[b.length - 1]) && sa.has(b[b.length - 1] + w)) b[b.length - 1] += w;
    else b.push(w);
  }
  return b.map((w) => {
    if (sa.has(w) || !a.length) return w;
    const best = a.reduce((x, y) => (ratio(y, w) > ratio(x, w) ? y : x));
    return same(best, w) ? best : w;
  });
}

export interface Word { w: string; s: number; e: number }
export interface QaResult {
  sim: number;
  heard: string;
  issues: string[];
  severe: boolean; // only these are worth spending money on (automatic redo)
}

function ngrams(t: string[], n: number) {
  const m = new Map<string, number>();
  for (let k = 0; k + n <= t.length; k++) { const g = t.slice(k, k + n).join(" "); m.set(g, (m.get(g) ?? 0) + 1); }
  return m;
}

/** Compares what was heard in a clip with the words it had to say. */
export function compare(script: string, words: Word[], lang: "en" | "es", clipDuration?: number): QaResult {
  const heard = words.map((x) => x.w).join(" ");
  const a = norm(script, lang);
  const b = align(a, norm(heard, lang));
  const sim = ratio(a, b);
  const issues: string[] = [];
  if (sim < 0.9) issues.push(`no dice el guion exacto (${Math.round(sim * 100)}% de coincidencia)`);

  const reps = new Set<string>();
  for (let k = 1; k < b.length; k++) if (b[k] === b[k - 1] && b[k].length > 2) reps.add(b[k]);
  for (const n of [3, 2]) {
    const ga = ngrams(a, n), gb = ngrams(b, n);
    for (const [g, v] of gb) if (v >= 2 && v > (ga.get(g) ?? 0)) reps.add(g);
  }
  if (reps.size) issues.push(`repite: ${[...reps].join(", ")}`);
  const extra = b.filter((w) => !a.includes(w));
  if (extra.length >= 3) issues.push(`dice palabras de más: ${extra.slice(0, 8).join(" ")}`);
  const missing = a.filter((w) => !b.includes(w));
  if (missing.length >= 3) issues.push(`se salta palabras: ${missing.slice(0, 8).join(" ")}`);
  const cut = Boolean(clipDuration && words.length && clipDuration - words[words.length - 1].e < 0.12);
  if (cut) issues.push("la última palabra queda cortada");
  const gaps = words.slice(1).map((w, k) => w.s - words[k].e);
  if (gaps.length && Math.max(...gaps) > 1.4) issues.push(`silencio largo a mitad de frase (${Math.max(...gaps).toFixed(1)} s)`);
  if (!words.length) issues.push("no se escucha a nadie hablando");

  // stutter: a repeated chunk that the script doesn't have
  const repeatsIn = (t: string[]) => {
    const s = new Set<string>();
    for (const n of [1, 2, 3]) for (let k = 0; k + 2 * n <= t.length; k++) {
      const x = t.slice(k, k + n).join(" "), y = t.slice(k + n, k + 2 * n).join(" ");
      if (x === y && (n > 1 || t[k].length > 2)) s.add(x);
    }
    return s;
  };
  const ra = repeatsIn(a);
  const stutter = [...repeatsIn(b)].some((x) => !ra.has(x));
  // a phrase the script doesn't have (owner's E2E test, 25 Oct 2026: «Creads punto IA» said in the middle of a
  // customer's English ad): 3+ extra words in a row, or our own brand when the script doesn't name it
  let run = 0, maxRun = 0;
  for (const w of b) { run = a.includes(w) ? 0 : run + 1; maxRun = Math.max(maxRun, run); }
  const brand = (t: string[]) => t.some((w) => /^(c|k)re(a|e)(d|t)s?(ia)?$/.test(w));
  const foreignBrand = brand(b) && !brand(a);
  if (maxRun >= 3 && !issues.some((x) => x.startsWith("dice palabras de más"))) issues.push(`dice una frase que no está en el guion: ${extra.slice(0, 8).join(" ")}`);
  if (foreignBrand) issues.push("nombra «Creads» y el guion no lo dice");
  const severe = !words.length || sim < 0.8 || cut || (stutter && sim < 0.95) || maxRun >= 3 || foreignBrand;
  return { sim: Math.round(sim * 1000) / 1000, heard, issues, severe };
}
