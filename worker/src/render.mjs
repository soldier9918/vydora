// Renders a video from local asset files with FFmpeg. No browser involved.
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { frameSize, bitrateOf, sceneDurations, motionFor, zoompanExpr, captionsAss, timeline, xfadeName } from "./plan.mjs";

const FPS = 30;
export function run(cmd, args, onLine) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => { err += d; if (err.length > 20000) err = err.slice(-20000); onLine?.(String(d)); });
    p.on("close", (c) => (c === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${c}: ${err.slice(-1500)}`))));
  });
}
export async function probeSecs(file) {
  if (!file) return 0;
  const out = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(out.trim()) || 0;
}
const atempo = (s) => { const f = []; let r = s; while (r > 2) { f.push("atempo=2"); r /= 2; } while (r < 0.5) { f.push("atempo=0.5"); r /= 0.5; } f.push(`atempo=${r.toFixed(4)}`); return f.join(","); };

/**
 * scenes: [{ image, clip?, audio?, caption }] (local paths)
 * v: video row (aspect_ratio, quality, caption_*, motion_*, transition_*, narration_speed, music_*, logo_*)
 * opts: { workDir, out, musicFile?, logoFile?, watermark?, onProgress?(0..1) }
 */
export async function renderVideo(scenes, v, opts) {
  const { workDir, out } = opts;
  const { W, H } = frameSize(v.aspect_ratio, v.quality);
  const speed = Number(v.narration_speed) > 0 ? Number(v.narration_speed) : 1;
  const audioSecs = [];
  for (const s of scenes) audioSecs.push(await probeSecs(s.audio));
  const durs = sceneDurations(audioSecs, speed);
  const tl = timeline(durs, !!v.transition_enabled && scenes.length > 1);

  // 1) One silent video segment per scene (restartable unit; small memory footprint).
  const segs = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i], len = tl.seg[i], frames = Math.ceil(len * FPS);
    const ass = path.join(workDir, `cap-${i}.ass`);
    await writeFile(ass, captionsAss(s.caption, durs[i], { W, H, color: v.caption_color, size: v.caption_size, style: v.caption_style }));
    const seg = path.join(workDir, `seg-${i}.mp4`);
    const assArg = ass.replace(/\\/g, "/").replace(/:/g, "\\:");
    let input, vf;
    if (s.clip) {
      input = ["-stream_loop", "-1", "-i", s.clip];
      vf = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},subtitles='${assArg}'`;
    } else {
      const z = zoompanExpr(motionFor(v.motion_type ?? "zoom-in", i), frames, v.motion_enabled !== false);
      input = ["-loop", "1", "-i", s.image];
      // Upscale first so zoompan stays smooth (no jitter).
      vf = `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},zoompan=z='${z.z}':x='${z.x}':y='${z.y}':d=${frames}:s=${W}x${H}:fps=${FPS},subtitles='${assArg}'`;
    }
    await run("ffmpeg", ["-y", ...input, "-t", len.toFixed(3), "-vf", vf, "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", seg]);
    segs.push(seg);
    opts.onProgress?.(0.7 * (i + 1) / scenes.length);
  }

  // 2) Narration track: each scene's voice at narration speed, padded to scene length.
  const narr = path.join(workDir, "narration.wav");
  {
    const args = ["-y"], parts = [];
    scenes.forEach((s, i) => {
      if (s.audio) { args.push("-i", s.audio); parts.push(`[${parts.length}:a]${atempo(speed)},aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur=${durs[i].toFixed(3)}[a${i}]`); }
      else { args.push("-f", "lavfi", "-t", durs[i].toFixed(3), "-i", "anullsrc=r=48000:cl=stereo"); parts.push(`[${parts.length}:a]anull[a${i}]`); }
    });
    const fc = parts.join(";") + ";" + scenes.map((_, i) => `[a${i}]`).join("") + `concat=n=${scenes.length}:v=0:a=1[out]`;
    await run("ffmpeg", [...args, "-filter_complex", fc, "-map", "[out]", narr]);
  }

  // 3) Join segments with transitions, add music (+ducking), logo and watermark, mux.
  const args = ["-y"];
  segs.forEach((f) => args.push("-i", f));
  const nI = segs.length;
  args.push("-i", narr);
  const music = v.music_enabled !== false && opts.musicFile;
  if (music) args.push("-stream_loop", "-1", "-i", opts.musicFile);
  if (opts.logoFile) args.push("-i", opts.logoFile);
  const f = [];
  let last = "[0:v]";
  if (segs.length > 1 && v.transition_enabled) {
    for (let i = 1; i < segs.length; i++) {
      const o = i === segs.length - 1 ? "[vx]" : `[x${i}]`;
      f.push(`${last}[${i}:v]xfade=transition=${xfadeName(v.transition_type ?? "crossfade", i)}:duration=0.8:offset=${tl.offsets[i - 1].toFixed(3)}${o}`);
      last = o;
    }
  } else if (segs.length > 1) { f.push(segs.map((_, i) => `[${i}:v]`).join("") + `concat=n=${segs.length}:v=1:a=0[vx]`); last = "[vx]"; }
  if (opts.logoFile) {
    const li = nI + 1 + (music ? 1 : 0), lw = Math.round(W * 0.12), m = Math.round(W * 0.025);
    const pos = { "top-left": [m, m], "top-right": [`W-w-${m}`, m], "bottom-left": [m, `H-h-${m}`] }[v.logo_position] ?? [`W-w-${m}`, `H-h-${m}`];
    f.push(`[${li}:v]scale=${lw}:-1,format=rgba,colorchannelmixer=aa=${(Number(v.logo_opacity ?? 60) / 100).toFixed(2)}[lg]`);
    f.push(`${last}[lg]overlay=${pos[0]}:${pos[1]}[vl]`); last = "[vl]";
  }
  if (opts.watermark) {
    const fs = Math.max(12, Math.round(Math.min(W, H) * 0.028));
    f.push(`${last}drawtext=text='Made with Vydora':fontcolor=0xf5f1ea:fontsize=${fs}:box=1:boxcolor=0x0a0a0cbf:boxborderw=${Math.round(fs * 0.6)}:x=${Math.round(W * 0.025 + fs * 0.6)}:y=H-th-${Math.round(H * 0.03 + fs * 0.6)}[vw]`);
    last = "[vw]";
  }
  if (music) {
    const vol = (Number(v.music_volume ?? 30) / 100).toFixed(2);
    f.push(`[${nI + 1}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${vol}[m]`);
    if (v.music_ducking !== false) {
      f.push(`[${nI}:a]asplit=2[n1][n2]`, `[m][n2]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md]`, `[n1][md]amix=inputs=2:duration=first:normalize=0[aout]`);
    } else f.push(`[${nI}:a][m]amix=inputs=2:duration=first:normalize=0[aout]`);
  } else f.push(`[${nI}:a]anull[aout]`);
  if (last === "[0:v]") { f.push(`[0:v]null[vfinal]`); last = "[vfinal]"; }
  args.push("-filter_complex", f.join(";"), "-map", last, "-map", "[aout]", "-t", tl.total.toFixed(3),
    "-c:v", "libx264", "-preset", "veryfast", "-b:v", bitrateOf(v.quality), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out);
  await run("ffmpeg", args);
  opts.onProgress?.(1);
  return { seconds: tl.total, width: W, height: H };
}
