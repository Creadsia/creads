import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { cutParts, joinParts, partsPlan, probe, workdir } from "../src/lib/montage";
import { writeFile } from "node:fs/promises";

test("long videos are planned in equal parts of 10 s or less (at most 3)", () => {
  assert.deepEqual(partsPlan(8).length, 1);
  assert.deepEqual(partsPlan(10.05).length, 1);
  assert.equal(partsPlan(10.6).length, 2);
  const p = partsPlan(25);
  assert.equal(p.length, 3);
  assert.ok(p.every((x) => x.len <= 10 && x.len >= 3));
  assert.equal(partsPlan(30).length, 3);
});

test("a 25 s video is cut into parts and joined back, with and without sound", { timeout: 120_000 }, async () => {
  const dir = await workdir("test-parts");
  const src = `${dir}/src.mp4`;
  execFileSync(ffmpegPath as unknown as string, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=30", "-f", "lavfi", "-i", "sine=frequency=440", "-t", "25", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", src]);
  const files = await cutParts(dir, src, partsPlan(25));
  assert.equal(files.length, 3);
  for (const f of files) assert.ok(Math.abs((await probe(f)).dur - 25 / 3) < 0.2);
  const withSound = await joinParts(dir, files, true);
  await writeFile(`${dir}/a.mp4`, withSound);
  const a = await probe(`${dir}/a.mp4`);
  assert.ok(Math.abs(a.dur - 25) < 0.4, `joined ${a.dur}`);
  assert.equal(a.audio, true);
  const silent = await joinParts(dir, files, false);
  await writeFile(`${dir}/b.mp4`, silent);
  const b = await probe(`${dir}/b.mp4`);
  assert.ok(Math.abs(b.dur - 25) < 0.4);
  assert.equal(b.audio, false);
});

import { cropImage, sceneCuts, sizeOf } from "../src/lib/montage";
test("finds a change of shot and crops a box out of a picture", { timeout: 60_000 }, async () => {
  const dir = await workdir("test-cuts");
  const ff = ffmpegPath as unknown as string;
  execFileSync(ff, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=360x640:rate=24:duration=4", "-f", "lavfi", "-i", "color=c=red:size=360x640:rate=24:duration=3", "-filter_complex", "[0:v][1:v]concat=n=2:v=1[v]", "-map", "[v]", "-c:v", "libx264", "-preset", "ultrafast", `${dir}/cut.mp4`]);
  const cuts = await sceneCuts(`${dir}/cut.mp4`);
  assert.ok(cuts.some((c) => Math.abs(c - 4) < 0.2), `cuts ${cuts}`);
  execFileSync(ff, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=1376x768", "-frames:v", "1", `${dir}/sheet.png`]);
  assert.deepEqual(await sizeOf(`${dir}/sheet.png`), [1376, 768]);
  const [w, h] = await cropImage(`${dir}/sheet.png`, { x: 0.63, y: 0, w: 0.37, h: 1 }, `${dir}/face.jpg`, 0.08);
  assert.ok(w > 500 && w <= 560 && h === 768, `${w}x${h}`);
});
