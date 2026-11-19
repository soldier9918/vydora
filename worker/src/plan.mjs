// Pure timeline + FFmpeg plan, mirroring src/lib/exportVideo.ts timing rules.
import { wrapByChars, typedLine, typedWords, typedPair, karaokeAt } from "./typewriter.mjs";
export const TRANSITION_SECS = 0.8;
const RATIOS = { "16:9": [1280, 720], "9:16": [720, 1280], "1:1": [1080, 1080], "4:5": [864, 1080], "21:9": [1680, 720] };
const QUALITY = { "720p": { scale: 1, bitrate: "5M" }, "1080p": { scale: 1.5, bitrate: "8M" } };
const XFADE = { crossfade: "fade", "fade-black": "fadeblack", "fade-white": "fadewhite", blur: "hblur", flash: "fadewhite",
  "slide-left": "slideleft", "slide-right": "slideright", "slide-up": "slideup", "slide-down": "slidedown",
  "cover-left": "coverleft", "cover-up": "coverup", "reveal-left": "revealleft", "wipe-left": "wipeleft", "wipe-right": "wiperight",
  "wipe-up": "wipeup", "wipe-down": "wipedown", "barn-open": "horzopen", "box-out": "circleopen", "zoom-in": "zoomin",
  "zoom-out": "fadegrays", spin: "radial", whip: "smoothleft", glitch: "pixelize", blood: "fadeblack" };
const XFADE_ROT = Object.keys(XFADE);

export const even = (n) => Math.round(n / 2) * 2;
export function frameSize(aspect, quality) {
  const [w, h] = RATIOS[aspect] ?? RATIOS["16:9"];
  const s = (QUALITY[quality] ?? QUALITY["720p"]).scale;
  return { W: even(w * s), H: even(h * s), scale: s, baseW: w };
}
export const bitrateOf = (q) => (QUALITY[q] ?? QUALITY["720p"]).bitrate;

/** Scene length: narration / speed + 0.4s, or 4s without audio (same as browser export). */
export function sceneDurations(audioSecs, speed = 1) {
  const sp = speed > 0 ? speed : 1;
  return audioSecs.map((a) => (a && a > 0 ? a / sp + 0.4 : 4));
}

export function transitionFor(type, i) { return type === "random" ? XFADE_ROT[(i * 7 + 2) % XFADE_ROT.length] : type; }
export const xfadeName = (type, i) => XFADE[transitionFor(type, i)] ?? "fade";

// Same rotation as the browser (src/lib/motion.ts ROTATION), horror looks included.
const MOTION_ROT = ["zoom-in","subtle-zoom","zoom-out","punch-in","pan-left","pan-right","pan-up","pan-down","zoom-left","zoom-right","zoom-up","zoom-down","out-left","out-right","diagonal-down","diagonal-up","rotate-zoom","breathe","float","handheld","h-flicker","h-strobe","h-streaks","h-vhs","h-static","h-creep","h-fade","h-lightning","h-blood","h-heartbeat","h-tilt","h-sway","h-shake","h-lurch","h-jumpscare","h-possessed"];
const HORROR_ROT = MOTION_ROT.filter((m) => m.startsWith("h-"));
export function motionFor(type, i) {
  if (type === "random") return MOTION_ROT[(i * 7 + 3) % MOTION_ROT.length];
  if (type === "h-random") return HORROR_ROT[(i * 5 + 2) % HORROR_ROT.length];
  if (type === "alternate") return i % 2 === 0 ? "zoom-in" : "zoom-out";
  return type;
}

/** zoompan expressions; p = progress 0..1 over the segment. */
export function zoompanExpr(type, frames, enabled = true) {
  // Same smoothstep easing as the browser (motion.ts) so the glide starts and ends gently.
  const q = `(on/${Math.max(1, frames - 1)})`;
  const p = `(${q}*${q}*(3-2*${q}))`;
  const c = { x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" };
  if (!enabled) return { z: "1", ...c };
  const m = {
    "zoom-in": { z: `1+0.15*${p}`, ...c }, "subtle-zoom": { z: `1+0.06*${p}`, ...c }, "zoom-out": { z: `1.15-0.15*${p}`, ...c },
    "punch-in": { z: `1+0.3*min(1,${p}*3)`, ...c },
    "pan-left": { z: "1.15", x: `(iw-iw/zoom)*(1-${p})`, y: c.y }, "pan-right": { z: "1.15", x: `(iw-iw/zoom)*${p}`, y: c.y },
    "pan-up": { z: "1.15", x: c.x, y: `(ih-ih/zoom)*(1-${p})` }, "pan-down": { z: "1.15", x: c.x, y: `(ih-ih/zoom)*${p}` },
    "zoom-left": { z: `1.05+0.12*${p}`, x: `(iw-iw/zoom)*(0.5-0.4*${p})`, y: c.y }, "zoom-right": { z: `1.05+0.12*${p}`, x: `(iw-iw/zoom)*(0.5+0.4*${p})`, y: c.y },
    "zoom-up": { z: `1.05+0.12*${p}`, x: c.x, y: `(ih-ih/zoom)*(0.5-0.4*${p})` }, "zoom-down": { z: `1.05+0.12*${p}`, x: c.x, y: `(ih-ih/zoom)*(0.5+0.4*${p})` },
    "out-left": { z: `1.17-0.12*${p}`, x: `(iw-iw/zoom)*(0.5-0.4*${p})`, y: c.y }, "out-right": { z: `1.17-0.12*${p}`, x: `(iw-iw/zoom)*(0.5+0.4*${p})`, y: c.y },
    "diagonal-down": { z: "1.15", x: `(iw-iw/zoom)*${p}`, y: `(ih-ih/zoom)*${p}` }, "diagonal-up": { z: "1.15", x: `(iw-iw/zoom)*(1-${p})`, y: `(ih-ih/zoom)*(1-${p})` },
    breathe: { z: `1.06+0.04*sin(${p}*6.283)`, ...c }, float: { z: "1.1", x: `(iw-iw/zoom)*(0.5+0.3*sin(${p}*6.283))`, y: `(ih-ih/zoom)*(0.5+0.3*cos(${p}*6.283))` },
    handheld: { z: "1.08", x: `(iw-iw/zoom)*(0.5+0.08*sin(on*0.7))`, y: `(ih-ih/zoom)*(0.5+0.08*cos(on*0.9))` },
  };
  return m[type] ?? m["zoom-in"];
}

const assEscape = (s) => String(s).replace(/\\/g, "\\\\").replace(/[{}]/g, "").replace(/\r?\n/g, " ");
const ts = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = (s % 60).toFixed(2).padStart(5, "0"); return `${h}:${String(m).padStart(2, "0")}:${x}`; };
const SIZE_PX = { small: 44, medium: 60, large: 80, xl: 100 };
const FONT = { mono: ["DejaVu Sans Mono", 0.6], serif: ["DejaVu Serif", 0.55], sans: ["DejaVu Sans", 0.55], impact: ["DejaVu Sans Condensed", 0.5], rounded: ["DejaVu Sans", 0.55], heavy: ["DejaVu Sans", 0.6] };
/** Caption lines visible at time t (same rules and timing as the browser export, src/lib/exportVideo.ts). */
export function captionAt(lines, style, t, speak) {
  const f = t / Math.max(0.001, speak);
  if (style === "full") return lines;
  if (style === "pop") return typedWords(lines, f);
  if (style === "sentence" || style === "cinematic") return typedPair(lines, f);
  if (style === "karaoke") { const k = karaokeAt(lines, f); return k.words.length ? [k.words.join(" ")] : []; }
  const l = typedLine(lines, f); return l ? [l] : [];
}
/** Captions as ASS events that follow the narration exactly like the browser (typewriter, word pop, sentence, full). */
export function captionsAss(caption, dur, { W, H, color = "#ffffff", size = "medium", style = "typewriter", font = "mono", scale = 1, wrapPx, speak, aspect }) {
  const px = Math.round((SIZE_PX[size] ?? 60) * scale);
  const [fontName, cw] = FONT[font] ?? FONT.mono;
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : "ffffff";
  const bgr = hex.slice(4, 6) + hex.slice(2, 4) + hex.slice(0, 2);
  // Vertical videos keep captions in the Shorts safe zone (same as src/lib/captionLook.ts captionBox).
  const portrait = aspect === "9:16";
  const marginV = Math.max(0, Math.round(Math.min(W, H) * 0.09 + (portrait ? H * 0.25 : 0) - px * 0.22));
  const marginR = portrait ? Math.round(W * 0.12) : 0;
  const cine = style === "cinematic";
  const hl = (hex.toLowerCase() === "ffe14d" ? "c6ff3d" : "ffe14d");
  const hlBgr = hl.slice(4, 6) + hl.slice(2, 4) + hl.slice(0, 2);
  const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV\nStyle: Cap,${fontName},${px},&H00${bgr},${cine ? "&H70000000" : "&H40000000"},${cine ? "&H70000000" : "&H30000000"},1,0,${cine ? 3 : 1},${cine ? Math.round(px * 0.3) : 1.5},${cine ? 0 : 2},2,0,${marginR},${marginV}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  if (style === "none" || !caption?.trim()) return head;
  const lines = wrapByChars(caption, (wrapPx ?? W * 0.85) / (px * cw));
  const maxLines = Math.max(1, Math.floor((H * 0.7) / Math.round(px * 1.2)));
  const sp = speak > 0 ? speak : dur;
  const out = []; let cur = null, start = 0;
  const step = 1 / 30;
  for (let t = 0; t <= dur + 1e-6; t += step) {
    let d = captionAt(lines, style, t, sp); if (d.length > maxLines) d = d.slice(-maxLines);
    const txt = style === "karaoke"
      ? (() => { const k = karaokeAt(lines, t / Math.max(0.001, sp)); return k.words.map((w, i) => i === k.active ? `{\\c&H${hlBgr}&}${assEscape(w)}{\\c&H${bgr}&}` : assEscape(w)).join(" "); })()
      : d.map(assEscape).join("\\N");
    if (txt !== cur) { if (cur) out.push(`Dialogue: 0,${ts(start)},${ts(t)},Cap,,0,0,0,,${cur}`); cur = txt; start = t; }
  }
  if (cur) out.push(`Dialogue: 0,${ts(start)},${ts(dur)},Cap,,0,0,0,,${cur}`);
  return head + out.join("\n") + "\n";
}

/** Offsets for chaining xfade: segment i lasts dur_i (+T when a transition follows) so total length is unchanged. */
export function timeline(durs, transitions) {
  const T = transitions ? TRANSITION_SECS : 0;
  const seg = durs.map((d, i) => d + (i < durs.length - 1 ? T : 0));
  const offsets = []; let acc = 0;
  for (let i = 0; i < durs.length - 1; i++) { acc += durs[i]; offsets.push(acc); }
  return { seg, offsets, total: durs.reduce((a, b) => a + b, 0) };
}
