// Renders a video from local asset files with FFmpeg. No browser involved.
// Mirrors src/lib/exportVideo.ts: intro/outro cards, motion (incl. horror looks), typed captions,
// transitions, logo, mood music with ducking, transition sounds.
import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { frameSize, bitrateOf, sceneDurations, motionFor, zoompanExpr, captionsAss, timeline, xfadeName } from "./plan.mjs";
import { horrorAt, isHorror } from "./motion.mjs";
import { SR, renderMood, hasMood, applyGainSchedule, duckSchedule, addSfx, sfxFor, writeWav } from "./synth.mjs";

const FPS = 30;
const BG = "0x0b0a0c";
const FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
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
async function hasAudio(file) {
  const out = await run("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", file]).catch(() => "");
  return out.trim().length > 0;
}
const atempo = (s) => { const f = []; let r = s; while (r > 2) { f.push("atempo=2"); r /= 2; } while (r < 0.5) { f.push("atempo=0.5"); r /= 0.5; } f.push(`atempo=${r.toFixed(4)}`); return f.join(","); };
const x264 = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"];

/** Horror look: per-frame crop/rotate (camera) and colour boxes (flicker, blood, flash, scratches, VHS bands) driven by sendcmd. */
async function horrorSegment(image, type, len, W, H, assArg, workDir, i, seg) {
  const S = 2, SW = W * S, SH = H * S, frames = Math.ceil(len * FPS);
  const N = 4, cmds = [];
  for (let f = 0; f < frames; f++) {
    const m = horrorAt(type, f / Math.max(1, frames - 1)), fx = m.fx ?? {};
    const cw = Math.round(SW / m.scale), ch = Math.round(SH / m.scale);
    const cx = Math.round(SW / 2 - (m.x * SW) / m.scale - cw / 2), cy = Math.round(SH / 2 - (m.y * SH) / m.scale - ch / 2);
    const c = [`crop@c w ${cw}`, `crop@c h ${ch}`, `crop@c x ${Math.max(0, Math.min(SW - cw, cx))}`, `crop@c y ${Math.max(0, Math.min(SH - ch, cy))}`,
      `rotate@r angle ${((m.rot ?? 0) * Math.PI / 180).toFixed(5)}`,
      `drawbox@red color 0x8b0000@${Math.min(1, fx.red ?? 0).toFixed(3)}`, `drawbox@dark color black@${Math.min(1, fx.dark ?? 0).toFixed(3)}`, `drawbox@flash color white@${Math.min(1, fx.flash ?? 0).toFixed(3)}`];
    for (let k = 0; k < N; k++) {
      const s = fx.streaks?.[k], b = fx.bands?.[k];
      c.push(`drawbox@s${k} x ${Math.round((s?.pos ?? 0) * W)}`, `drawbox@s${k} w ${Math.max(1, Math.round((s?.size ?? 0) * W))}`, `drawbox@s${k} color 0xeeeeee@${(s?.a ?? 0).toFixed(3)}`);
      c.push(`drawbox@b${k} y ${Math.round((b?.pos ?? 0) * H)}`, `drawbox@b${k} h ${Math.max(1, Math.round((b?.size ?? 0) * H))}`, `drawbox@b${k} color 0xdddddd@${(b?.a ?? 0).toFixed(3)}`);
    }
    cmds.push(`${(f / FPS).toFixed(4)} ${c.join(", ")};`);
  }
  const cmdFile = path.join(workDir, `fx-${i}.cmd`);
  await writeFile(cmdFile, cmds.join("\n"));
  const boxes = [`drawbox@red=x=0:y=0:w=iw:h=ih:color=0x8b0000@0:t=fill`, `drawbox@dark=x=0:y=0:w=iw:h=ih:color=black@0:t=fill`, `drawbox@flash=x=0:y=0:w=iw:h=ih:color=white@0:t=fill`];
  for (let k = 0; k < N; k++) boxes.push(`drawbox@s${k}=x=0:y=0:w=1:h=ih:color=0xeeeeee@0:t=fill`, `drawbox@b${k}=x=0:y=0:w=iw:h=1:color=0xdddddd@0:t=fill`);
  const vf = `scale=${SW}:${SH}:force_original_aspect_ratio=increase:flags=lanczos,crop=${SW}:${SH},format=yuv420p,sendcmd=f='${cmdFile.replace(/:/g, "\\:")}',crop@c=w=${SW}:h=${SH}:x=0:y=0,scale=${W}:${H}:flags=bicubic,rotate@r=a=0:fillcolor=black,${boxes.join(",")},subtitles='${assArg}'`;
  await run("ffmpeg", ["-y", "-loop", "1", "-framerate", String(FPS), "-i", image, "-t", len.toFixed(3), "-vf", vf, "-an", ...x264, seg]);
}

/** Intro/outro: branded title card with fades, or the saved clip fitted to the frame. */
async function cardSegment(card, W, H, workDir, name) {
  const out = path.join(workDir, `${name}.mp4`);
  const fit = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${BG},fps=${FPS},setsar=1,format=yuv420p`;
  if (card.clip) {
    const secs = Math.min(30, (await probeSecs(card.clip)) || card.seconds);
    const audio = await hasAudio(card.clip);
    await run("ffmpeg", ["-y", "-i", card.clip, "-t", secs.toFixed(3), "-vf", fit, ...x264, ...(audio ? ["-c:a", "pcm_s16le", "-ar", String(SR), "-ac", "2"] : ["-an"]), out.replace(/\.mp4$/, ".mkv")]);
    return { file: out.replace(/\.mp4$/, ".mkv"), secs, audio };
  }
  const secs = card.seconds, base = Math.min(W, H);
  const tFile = path.join(workDir, `${name}-t.txt`), sFile = path.join(workDir, `${name}-s.txt`);
  await writeFile(tFile, card.title ?? ""); await writeFile(sFile, card.subtitle ?? "");
  const fsT = Math.round(Math.min(base * 0.09, (W * 0.9) / Math.max(1, (card.title ?? "").length * 0.62)));
  const fsS = Math.round(Math.min(base * 0.045, (W * 0.9) / Math.max(1, (card.subtitle ?? "").length * 0.6)));
  const esc = (f) => f.replace(/:/g, "\\:");
  const vf = [
    `drawbox=x=${Math.round(W / 2 - base * 0.06)}:y=${Math.round(H / 2 + base * 0.02)}:w=${Math.round(base * 0.12)}:h=${Math.max(3, Math.round(base * 0.008))}:color=0xeb3d5f:t=fill`,
    `drawtext=fontfile=${FONT_BOLD}:textfile='${esc(tFile)}':fontsize=${fsT}:fontcolor=0xf5f1ea:x=(w-text_w)/2:y=${Math.round(H / 2 - base * 0.02)}-ascent`,
    `drawtext=fontfile=${FONT_BOLD}:textfile='${esc(sFile)}':fontsize=${fsS}:fontcolor=0xc9f04a:x=(w-text_w)/2:y=${Math.round(H / 2 + base * 0.1)}-ascent`,
    `fade=t=in:st=0:d=0.5:color=${BG}`, `fade=t=out:st=${Math.max(0, secs - 0.5).toFixed(3)}:d=0.5:color=${BG}`, "setsar=1", "format=yuv420p",
  ].join(",");
  await run("ffmpeg", ["-y", "-f", "lavfi", "-i", `color=c=${BG}:s=${W}x${H}:r=${FPS}:d=${secs}`, "-vf", vf, "-an", ...x264, out]);
  return { file: out, secs, audio: false };
}

/**
 * scenes: [{ image, clip?, audio?, caption }] (local paths)
 * v: video row (aspect_ratio, quality, caption_*, motion_*, transition_*, narration_speed, music_*, sfx_*, logo_*)
 * opts: { workDir, out, musicFile?, logoFile?, watermark?, intro?, outro? ({title, subtitle, seconds, clip?}), onProgress?(0..1) }
 */
export async function renderVideo(scenes, v, opts) {
  const { workDir, out } = opts;
  const { W, H, scale, baseW } = frameSize(v.aspect_ratio, v.quality);
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
    await writeFile(ass, captionsAss(s.caption, durs[i], { W, H, color: v.caption_color, size: v.caption_size, style: v.caption_style ?? "typewriter", font: v.caption_font ?? "mono", scale, wrapPx: baseW * 0.85 * scale, speak: audioSecs[i] > 0 ? audioSecs[i] / speed : durs[i] }));
    const seg = path.join(workDir, `seg-${i}.mp4`);
    const assArg = ass.replace(/\\/g, "/").replace(/:/g, "\\:");
    const motion = motionFor(v.motion_type ?? "zoom-in", i);
    if (s.clip) {
      const vf = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},fps=${FPS},subtitles='${assArg}'`;
      await run("ffmpeg", ["-y", "-stream_loop", "-1", "-i", s.clip, "-t", len.toFixed(3), "-vf", vf, "-an", ...x264, seg]);
    } else if (v.motion_enabled !== false && isHorror(motion)) {
      await horrorSegment(s.image, motion, len, W, H, assArg, workDir, i, seg);
    } else {
      const z = zoompanExpr(motion, frames, v.motion_enabled !== false);
      // zoompan snaps its crop to whole input pixels; a large supersample makes each snap sub-pixel in the output (no wobble).
      const SS = W * H > 1_500_000 ? 4 : 6;
      const vf = `scale=${W * SS}:${H * SS}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W * SS}:${H * SS},zoompan=z='${z.z}':x='${z.x}':y='${z.y}':d=${frames}:s=${W}x${H}:fps=${FPS},subtitles='${assArg}'`;
      await run("ffmpeg", ["-y", "-loop", "1", "-i", s.image, "-t", len.toFixed(3), "-vf", vf, "-an", ...x264, seg]);
    }
    segs.push(seg);
    opts.onProgress?.(0.7 * (i + 1) / scenes.length);
  }

  const intro = opts.intro ? await cardSegment(opts.intro, W, H, workDir, "intro") : null;
  const outro = opts.outro ? await cardSegment(opts.outro, W, H, workDir, "outro") : null;
  const pre = intro?.secs ?? 0, total = pre + tl.total + (outro?.secs ?? 0);

  // 2) Narration track: each scene's voice at narration speed, padded to scene length.
  const narr = path.join(workDir, "narration.wav");
  {
    const args = ["-y"], parts = [];
    scenes.forEach((s, i) => {
      if (s.audio) { args.push("-i", s.audio); parts.push(`[${parts.length}:a]${atempo(speed)},aresample=${SR},aformat=channel_layouts=stereo,apad=whole_dur=${durs[i].toFixed(3)}[a${i}]`); }
      else { args.push("-f", "lavfi", "-t", durs[i].toFixed(3), "-i", `anullsrc=r=${SR}:cl=stereo`); parts.push(`[${parts.length}:a]anull[a${i}]`); }
    });
    const fc = parts.join(";") + ";" + scenes.map((_, i) => `[a${i}]`).join("") + `concat=n=${scenes.length}:v=0:a=1[out]`;
    await run("ffmpeg", [...args, "-filter_complex", fc, "-map", "[out]", narr]);
  }

  // 3) Composed mood music (ducked under the narrator) + transition sounds, like the browser's Web Audio mix.
  const moodOn = v.music_enabled !== false && hasMood(v.music_mood) && !opts.musicFile;
  const sfxOn = !!v.sfx_enabled && scenes.length > 1;
  let bed = null;
  if (moodOn || sfxOn) {
    const buf = moodOn ? renderMood(v.music_mood, total) : new Float32Array(Math.ceil((total + 1) * SR));
    if (moodOn) applyGainSchedule(buf, [{ t: -pre, level: Math.max(0, Math.min(1, Number(v.music_volume ?? 30) / 100)) }, ...duckSchedule(durs, audioSecs.map((a) => (a > 0 ? a / speed : null)), Number(v.music_volume ?? 30), v.music_ducking !== false)], pre);
    if (sfxOn) for (let i = 1; i < scenes.length; i++) addSfx(buf, sfxFor(v.sfx_type ?? "whoosh", i - 1), pre + tl.offsets[i - 1], Number(v.sfx_volume ?? 50));
    bed = path.join(workDir, "bed.wav");
    await writeWav(bed, buf);
  }

  // 4) Join segments with transitions, logo and watermark, then cards; mix audio; mux.
  const args = ["-y"];
  segs.forEach((f) => args.push("-i", f));
  let n = segs.length;
  const iNarr = n++; args.push("-i", narr);
  const music = v.music_enabled !== false && opts.musicFile;
  const iMusic = music ? n++ : -1; if (music) args.push("-stream_loop", "-1", "-i", opts.musicFile);
  const iLogo = opts.logoFile ? n++ : -1; if (opts.logoFile) args.push("-i", opts.logoFile);
  const iBed = bed ? n++ : -1; if (bed) args.push("-i", bed);
  const iIntro = intro ? n++ : -1; if (intro) args.push("-i", intro.file);
  const iOutro = outro ? n++ : -1; if (outro) args.push("-i", outro.file);
  const f = [];
  let last = "[0:v]";
  if (segs.length > 1 && v.transition_enabled) {
    for (let i = 1; i < segs.length; i++) {
      const o = `[x${i}]`;
      f.push(`${last}[${i}:v]xfade=transition=${xfadeName(v.transition_type ?? "crossfade", i)}:duration=0.8:offset=${tl.offsets[i - 1].toFixed(3)}${o}`);
      last = o;
    }
  } else if (segs.length > 1) { f.push(segs.map((_, i) => `[${i}:v]`).join("") + `concat=n=${segs.length}:v=1:a=0[vx]`); last = "[vx]"; }
  if (opts.logoFile) {
    const lw = Math.round(W * 0.12), m = Math.round(W * 0.025);
    const pos = { "top-left": [m, m], "top-right": [`W-w-${m}`, m], "bottom-left": [m, `H-h-${m}`] }[v.logo_position] ?? [`W-w-${m}`, `H-h-${m}`];
    f.push(`[${iLogo}:v]scale=${lw}:-1,format=rgba,colorchannelmixer=aa=${(Number(v.logo_opacity ?? 60) / 100).toFixed(2)}[lg]`);
    f.push(`${last}[lg]overlay=${pos[0]}:${pos[1]}[vl]`); last = "[vl]";
  }
  if (opts.watermark) {
    const fs = Math.max(12, Math.round(Math.min(W, H) * 0.028));
    f.push(`${last}drawtext=text='Made with Vydora':fontcolor=0xf5f1ea:fontsize=${fs}:box=1:boxcolor=0x0a0a0cbf:boxborderw=${Math.round(fs * 0.6)}:x=${Math.round(W * 0.025 + fs * 0.6)}:y=H-th-${Math.round(H * 0.03 + fs * 0.6)}[vw]`);
    last = "[vw]";
  }
  f.push(`${last}trim=duration=${tl.total.toFixed(3)},setpts=PTS-STARTPTS,fps=${FPS},setsar=1,format=yuv420p[vmain]`); last = "[vmain]";
  if (intro || outro) {
    const parts = [intro && `[${iIntro}:v]`, last, outro && `[${iOutro}:v]`].filter(Boolean);
    f.push(`${parts.join("")}concat=n=${parts.length}:v=1:a=0[vcat]`); last = "[vcat]";
  }
  // Audio: narration (after the intro), uploaded music (sidechain-ducked), composed bed, card clip sound.
  const mix = [];
  f.push(`[${iNarr}:a]adelay=${Math.round(pre * 1000)}:all=1[nar]`);
  if (music) {
    const vol = (Number(v.music_volume ?? 30) / 100).toFixed(2);
    f.push(`[${iMusic}:a]aresample=${SR},aformat=channel_layouts=stereo,volume=${vol}[m]`);
    if (v.music_ducking !== false) { f.push(`[nar]asplit=2[n1][n2]`, `[m][n2]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md]`); mix.push("[n1]", "[md]"); }
    else mix.push("[nar]", "[m]");
  } else mix.push("[nar]");
  if (bed) mix.push(`[${iBed}:a]`);
  if (intro?.audio) mix.push(`[${iIntro}:a]`);
  if (outro?.audio) { f.push(`[${iOutro}:a]adelay=${Math.round((pre + tl.total) * 1000)}:all=1[oa]`); mix.push("[oa]"); }
  f.push(mix.length > 1 ? `${mix.join("")}amix=inputs=${mix.length}:duration=longest:normalize=0[aout]` : `${mix[0]}anull[aout]`);
  args.push("-filter_complex", f.join(";"), "-map", last, "-map", "[aout]", "-t", total.toFixed(3),
    "-c:v", "libx264", "-preset", "veryfast", "-b:v", bitrateOf(v.quality), "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out);
  await run("ffmpeg", args);
  opts.onProgress?.(1);
  return { seconds: total, width: W, height: H };
}
