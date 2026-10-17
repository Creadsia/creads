import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { tooMany } from "@/lib/rate";
import { needsCredits } from "@/lib/credits";
import { SESSION_ENDED, session } from "@/lib/access";
import { deleteVoice, elevenlabs } from "@/lib/providers/elevenlabs";
import type { VoiceSample } from "@/lib/providers/types";
import { fetchableUrl, ownsMedia } from "@/lib/media";
import { publicError } from "@/lib/public-error";
import { download, voiceSample, workdir } from "@/lib/montage";

export const maxDuration = 300;
const MAX_VOICES = 10; // clones per customer (they share Creadsia's voice slots)

// Creates a voice from the customer's own recordings. Two ways in:
// - JSON {name, consent, files: [refs]}: up to 5 audios or videos already uploaded to the customer's
//   storage (any format, up to 50 MB each). Each is cleaned to a mono mp3 (sound only, first 3 min).
// - form data {name, consent, file}: one small audio sent directly (kept for older screens).
// Requires an explicit consent tick from the uploader.
const MIN_SECONDS = 10;

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("heavy", s.user.id);
  if (limited) return limited;
  const ws = s.user.workspace;
  const broke = await needsCredits(s.user);
  if (broke) return NextResponse.json({ error: broke }, { status: 402 });
  if (ws !== "main" && (await s.db.count("voices").catch(() => 0)) >= MAX_VOICES) {
    return NextResponse.json({ error: `Ya tienes ${MAX_VOICES} voces creadas. Borra una que no uses para crear otra.` }, { status: 409 });
  }

  let name = "";
  let consent = false;
  let samples: VoiceSample[] = [];
  try {
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      const b = await req.json().catch(() => null);
      name = String(b?.name ?? "").trim().slice(0, 60);
      consent = b?.consent === true;
      const refs: unknown[] = Array.isArray(b?.files) ? b.files.slice(0, 6) : [];
      if (!consent) return NextResponse.json({ error: "Falta confirmar el permiso de la persona dueña de la voz." }, { status: 400 });
      if (!name) return NextResponse.json({ error: "Ponle un nombre a la voz." }, { status: 400 });
      if (!refs.length) return NextResponse.json({ error: "Sube al menos un audio." }, { status: 400 });
      if (refs.length > 5) return NextResponse.json({ error: "Máximo 5 audios por voz." }, { status: 400 });
      if (!refs.every((r) => ownsMedia(r, ws))) return NextResponse.json({ error: "Uno de los audios no es de tu cuenta." }, { status: 403 });
      const dir = await workdir(`voice-${s.user.id.slice(0, 8)}-${Date.now()}`);
      // all files at once (videos can be big): each becomes a clean mono mp3
      const done = await Promise.all((refs as string[]).map(async (ref, i) => {
        const src = path.join(dir, `in-${i}`);
        await download(await fetchableUrl(ref, ws, 600), src);
        const out = path.join(dir, `muestra-${i + 1}.mp3`);
        const dur = await voiceSample(src, out).catch(() => 0);
        return { i, dur, out };
      }));
      const bad = done.find((x) => x.dur < 1);
      if (bad) return NextResponse.json({ error: `El archivo ${bad.i + 1} no tiene audio que se pueda usar.` }, { status: 400 });
      const total = done.reduce((a, x) => a + x.dur, 0);
      for (const x of done) samples.push({ bytes: new Uint8Array(await readFile(x.out)), mime: "audio/mpeg", filename: `muestra-${x.i + 1}.mp3` });
      if (total < MIN_SECONDS) return NextResponse.json({ error: `Hay muy poco audio (${Math.round(total)} s). Sube al menos 30 segundos; lo ideal es 1 a 3 minutos.` }, { status: 400 });
    } else {
      const form = await req.formData().catch(() => null);
      name = String(form?.get("name") ?? "").trim().slice(0, 60);
      consent = form?.get("consent") === "yes";
      const file = form?.get("file");
      if (!consent) return NextResponse.json({ error: "Falta confirmar el permiso de la persona dueña de la voz." }, { status: 400 });
      if (!name || !(file instanceof File)) return NextResponse.json({ error: "Falta el nombre o el audio." }, { status: 400 });
      if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) return NextResponse.json({ error: "El archivo debe ser audio (mp3, m4a, wav)." }, { status: 400 });
      if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "El audio pesa más de 4 MB. Usa un mp3 de 1 a 2 minutos." }, { status: 413 });
      samples = [{ bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type, filename: file.name || "muestra.mp3" }];
    }
  } catch (err) {
    console.error("voices/clone prepare", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No se pudieron preparar los audios. Intenta de nuevo." }, { status: 502 });
  }

  try {
    const id = await elevenlabs.clone(name, samples);
    // The clone must be registered to this customer, or nobody may keep it.
    try {
      await s.db.insert("voices", { voice_id: id, name });
    } catch (err) {
      const missing = (err as { missingTable?: boolean }).missingTable;
      // before the accounts are separated (tenancy.sql) only Creadsia exists, so the clone stays with it
      if (!(missing && ws === "main")) {
        await deleteVoice(id);
        throw new Error("No se pudo guardar la voz en tu cuenta. Intenta de nuevo.");
      }
    }
    return NextResponse.json({ voiceId: id, samples: samples.length });
  } catch (err) {
    const msg = publicError(err, "No se pudo clonar la voz.");
    console.error("voices/clone", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
