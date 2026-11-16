import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { run, probeSecs, renderVideo } from "../src/render.mjs";
import { sceneDurations, timeline } from "../src/plan.mjs";

test("scene length matches browser rule: audio/speed + 0.4, else 4 Seconds", () => {
  assert.deepEqual(sceneDurations([10, 0], 2), [5.4, 4]);
});
test("transitions do not change total length", () => {
  const t = timeline([5, 6, 7], true);
  assert.equal(t.total, 18); assert.deepEqual(t.offsets, [5, 11]); assert.deepEqual(t.seg, [5.8, 6.8, 7]);
});
test("renders an MP4 with narration, captions, transitions and ducked music", { timeout: 300000 }, async () => {
  const d = await mkdtemp(path.join(tmpdir(), "vyd-"));
  const scenes = [];
  for (let i = 0; i < 3; i++) {
    const img = path.join(d, `i${i}.png`), aud = path.join(d, `a${i}.mp3`);
    await run("ffmpeg", ["-y", "-f", "lavfi", "-i", `testsrc2=s=1536x1024:d=1`, "-frames:v", "1", img]);
    await run("ffmpeg", ["-y", "-f", "lavfi", "-i", `sine=f=${300 + i * 100}:d=${2 + i}`, aud]);
    scenes.push({ image: img, audio: aud, caption: `Scene ${i + 1} narration with several words to check caption chunking works` });
  }
  const music = path.join(d, "m.mp3");
  await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "sine=f=120:d=3", music]);
  const out = path.join(d, "out.mp4");
  const meta = await renderVideo(scenes, { aspect_ratio: "16:9", quality: "720p", narration_speed: 1, transition_enabled: true, transition_type: "random", motion_type: "random", music_enabled: true, music_volume: 30, music_ducking: true, caption_style: "typewriter" }, { workDir: d, out, musicFile: music, watermark: true });
  const secs = await probeSecs(out);
  assert.ok(Math.abs(secs - meta.seconds) < 0.2, `duration ${secs} vs ${meta.seconds}`);
  assert.ok(Math.abs(meta.seconds - (2.4 + 3.4 + 4.4)) < 0.01);
  console.log("rendered", out, secs);
});
