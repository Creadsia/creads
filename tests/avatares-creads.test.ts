import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://sb.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "x";

import { PRESETS, presetById, presetPrompt, presetRef } from "../src/lib/avatares-creads";

test("Creads avatars: 16 invented people with unique ids, stored in Creadsia's own folder", () => {
  assert.ok(PRESETS.length >= 10 && PRESETS.length <= 20);
  assert.equal(new Set(PRESETS.map((p) => p.id)).size, PRESETS.length);
  for (const p of PRESETS) {
    assert.match(presetPrompt(p), /non-famous/);
    assert.match(presetRef(p.id), /^\/api\/media\/ws\/main\/presets\//);
  }
  assert.equal(presetById("../x"), null);
  assert.ok(PRESETS.some((p) => p.lang === "en") && PRESETS.some((p) => p.lang === "es-CL"));
});
