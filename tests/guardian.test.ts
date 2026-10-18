import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG, STUCK_TEXT, cleanConfig, failingModels, mergeIncidents, pageState } from "../src/lib/guardian";
import { oneLine } from "../src/lib/whatsapp";

const c = DEFAULT_CONFIG;

test("a page is ok, slow or down by its time and status", () => {
  assert.equal(pageState(800, 200, c), "ok");
  assert.equal(pageState(4000, 200, c), "lento");
  assert.equal(pageState(12000, 200, c), "falla");
  assert.equal(pageState(300, 503, c), "falla");
  assert.equal(pageState(300, 0, c), "falla");
});

test("only models failing a lot, for several customers, with enough attempts, count", () => {
  const f = (model: string, status: string, owner = "u1", error: string | null = null) => ({ model, status, owner, error });
  const rows = [
    f("seedance", "failed", "u1"), f("seedance", "failed", "u2"), f("seedance", "failed", "u3"), f("seedance", "done"),
    f("veo-fast", "failed"), ...Array(9).fill(f("veo-fast", "done")),
    f("kling", "failed"), f("kling", "generating"),
    // one customer's bad prompts don't pause a model for everyone
    ...Array(5).fill(f("hailuo", "failed", "u9")),
    // the Guardián's own «stuck» failures don't count either
    ...Array(5).fill(null).map((_, i) => f("wan", "failed", `u${i}`, STUCK_TEXT)),
  ];
  assert.deepEqual(failingModels(rows, c), [["seedance", 3, 4]]);
});

test("incidents open, repeat, worsen and close by themselves", () => {
  const p = (key: string, severidad: "aviso" | "critico" = "aviso") => ({ key, area: "plataforma" as const, severidad, titulo: key, detalle: "d" });
  let r = mergeIncidents([], [p("a"), p("b")], "t1");
  assert.equal(r.nuevos.length, 2);
  r = mergeIncidents(r.list, [p("a", "critico")], "t2");
  assert.equal(r.nuevos.length, 0);
  assert.equal(r.peores.length, 1);
  assert.deepEqual(r.resueltos.map((i) => i.key), ["b"]);
  const a = r.list.find((i) => i.key === "a")!;
  assert.equal(a.count, 2);
  assert.equal(a.abierto, true);
  const once = mergeIncidents(r.list, [{ ...p("x"), accion: "hice algo", oneOff: true }], "t3");
  const x = once.list.find((i) => i.key === "x")!;
  assert.equal(x.abierto, false);
  assert.deepEqual(x.acciones, ["hice algo"]);
});

test("a check that couldn't run doesn't close its incidents", () => {
  const p = (key: string) => ({ key, area: "plataforma" as const, severidad: "critico" as const, titulo: key, detalle: "d" });
  const r = mergeIncidents([], [p("db:caida"), p("prov:fal:falla")], "t1");
  const r2 = mergeIncidents(r.list, [], "t2", new Set(["pagina", "lenta", "db"]));
  assert.deepEqual(r2.resueltos.map((i) => i.key), ["db:caida"]);
  assert.equal(r2.list.find((i) => i.key === "prov:fal:falla")!.abierto, true);
});

test("thresholds the owner types stay within sane limits", () => {
  const k = cleanConfig({ lentoMs: 50, caidoMs: 40, fallasPct: 500, whatsapp: false, erroresMax: "x" as never }, c);
  assert.equal(k.lentoMs, 500);
  assert.ok(k.caidoMs > k.lentoMs);
  assert.equal(k.fallasPct, 100);
  assert.equal(k.whatsapp, false);
  assert.equal(k.erroresMax, c.erroresMax);
});

test("WhatsApp template text is one line", () => {
  assert.equal(oneLine("a\nb\t c     d"), "a · b · c d");
});
