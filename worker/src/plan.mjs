// Pure timeline + FFmpeg plan, mirroring src/lib/exportVideo.ts timing rules.
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
  return { W: even(w * s), H: even(h * s) };
}
export const bitrateOf = (q) => (QUALITY[q] ?? QUALITY["720p"]).bitrate;

/** Scene length: narration / speed + 0.4s, or 4s without audio (same as browser export). */
export function sceneDurations(audioSecs, speed = 1) {
  const sp = speed > 0 ? speed : 1;
  return audioSecs.map((a) => (a && a > 0 ? a / sp + 0.4 : 4));
}

export function transitionFor(type, i) { return type === "random" ? XFADE_ROT[(i * 7 + 2) % XFADE_ROT.length] : type; }
export const xfadeName = (type, i) => XFADE[transitionFor(type, i)] ?? "fade";

const MOTION_ROT = ["zoom-in", "subtle-zoom", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down", "zoom-left", "zoom-right", "zoom-up", "zoom-down", "diagonal-down", "diagonal-up", "breathe"];
export function motionFor(type, i) {
  if (type === "random") return MOTION_ROT[(i * 7 + 3) % MOTION_ROT.length];
  if (type === "alternate") return i % 2 === 0 ? "zoom-in" : "zoom-out";
  if (type === "h-random" || String(type).startsWith("h-")) return "zoom-in"; // horror overlays not ported yet
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
/** Captions as ASS: narration split into short chunks timed by word count across the scene. */
export function captionsAss(caption, dur, { W, H, color = "#ffffff", size = "medium", style = "typewriter" }) {
  const px = Math.round(({ small: 28, medium: 36, large: 48 }[size] ?? 36) * (H / 720));
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : "ffffff";
  const bgr = hex.slice(4, 6) + hex.slice(2, 4) + hex.slice(0, 2);
  const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV\nStyle: Cap,DejaVu Sans,${px},&H00${bgr},&H00000000,&H99000000,1,0,3,2,0,2,${Math.round(W * 0.06)},${Math.round(W * 0.06)},${Math.round(H * 0.08)}\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
  if (style === "none" || !caption?.trim()) return head;
  const words = caption.trim().split(/\s+/);
  const per = 8, chunks = [];
  for (let i = 0; i < words.length; i += per) chunks.push(words.slice(i, i + per).join(" "));
  const usable = Math.max(0.5, dur - 0.4);
  let t = 0;
  const lines = chunks.map((c) => {
    const len = usable * (c.split(" ").length / words.length);
    const line = `Dialogue: 0,${ts(t)},${ts(t + len)},Cap,,0,0,0,,${style === "typewriter" ? "{\\fad(120,0)}" : ""}${assEscape(c)}`;
    t += len; return line;
  });
  return head + lines.join("\n") + "\n";
}

/** Offsets for chaining xfade: segment i lasts dur_i (+T when a transition follows) so total length is unchanged. */
export function timeline(durs, transitions) {
  const T = transitions ? TRANSITION_SECS : 0;
  const seg = durs.map((d, i) => d + (i < durs.length - 1 ? T : 0));
  const offsets = []; let acc = 0;
  for (let i = 0; i < durs.length - 1; i++) { acc += durs[i]; offsets.push(acc); }
  return { seg, offsets, total: durs.reduce((a, b) => a + b, 0) };
}
