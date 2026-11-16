// Offline copy of the browser's Web Audio mood music (src/lib/music.ts) and transition sounds (src/lib/sfx.ts),
// rendered to sample buffers so cloud videos sound like browser exports. Keep the numbers in sync with those files.
import { writeFile } from "node:fs/promises";
export const SR = 48000;

const MOODS = {
  cinematic: { bpm: 70, wave: "sawtooth", chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], cutoff: 900, beat: false, bass: true, arp: false },
  lofi: { bpm: 80, wave: "triangle", chords: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [45, 48, 52, 55]], cutoff: 1400, beat: true, bass: true, arp: false },
  mystery: { bpm: 60, wave: "sine", chords: [[45, 48, 52], [46, 49, 53], [44, 47, 51], [45, 48, 51]], cutoff: 700, beat: false, bass: true, arp: true },
  upbeat: { bpm: 118, wave: "square", chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], cutoff: 2000, beat: true, bass: true, arp: true },
  ambient: { bpm: 50, wave: "sine", chords: [[52, 59, 64], [48, 55, 64], [50, 57, 62], [47, 54, 62]], cutoff: 1100, beat: false, bass: false, arp: false },
  epic: { bpm: 90, wave: "sawtooth", chords: [[50, 57, 62], [46, 53, 58], [48, 55, 60], [45, 52, 57]], cutoff: 1600, beat: true, bass: true, arp: false },
  piano: { bpm: 72, wave: "triangle", chords: [[60, 64, 67, 72], [57, 60, 64, 69], [53, 57, 60, 65], [55, 59, 62, 67]], cutoff: 2500, beat: false, bass: false, arp: true },
  dark: { bpm: 64, wave: "sawtooth", chords: [[40, 43, 47], [41, 44, 48], [38, 41, 45], [40, 43, 46]], cutoff: 600, beat: true, bass: true, arp: false },
  horror: { bpm: 48, wave: "sine", chords: [[45, 46, 52], [44, 45, 51], [46, 47, 53], [43, 44, 50]], cutoff: 500, beat: false, bass: true, arp: true },
  sad: { bpm: 60, wave: "triangle", chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [52, 55, 59]], cutoff: 1300, beat: false, bass: true, arp: true },
  hopeful: { bpm: 84, wave: "triangle", chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60, 65]], cutoff: 1800, beat: false, bass: true, arp: true },
  documentary: { bpm: 76, wave: "sine", chords: [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61]], cutoff: 1200, beat: false, bass: true, arp: false },
  synthwave: { bpm: 100, wave: "sawtooth", chords: [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]], cutoff: 1700, beat: true, bass: true, arp: true },
  chill: { bpm: 72, wave: "sine", chords: [[53, 57, 60, 64], [50, 53, 57, 60], [55, 58, 62, 65], [48, 52, 55, 58]], cutoff: 1500, beat: true, bass: true, arp: false },
  corporate: { bpm: 110, wave: "triangle", chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], cutoff: 2200, beat: true, bass: true, arp: true },
  adventure: { bpm: 104, wave: "sawtooth", chords: [[50, 54, 57], [55, 59, 62], [57, 61, 64], [52, 55, 59]], cutoff: 1800, beat: true, bass: true, arp: false },
  dreamy: { bpm: 56, wave: "sine", chords: [[60, 67, 71, 74], [57, 64, 67, 72], [53, 60, 64, 69], [55, 62, 65, 71]], cutoff: 1600, beat: false, bass: false, arp: true },
  funky: { bpm: 112, wave: "square", chords: [[50, 53, 57, 60], [55, 58, 62, 65], [50, 53, 57, 60], [57, 61, 64, 67]], cutoff: 1500, beat: true, bass: true, arp: false },
  space: { bpm: 44, wave: "sine", chords: [[48, 55, 62], [50, 57, 64], [46, 53, 60], [43, 50, 57]], cutoff: 900, beat: false, bass: true, arp: true },
};
export const hasMood = (m) => !!MOODS[m];
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const TAU = Math.PI * 2;
const wave = (type, ph) => {
  const x = ph - Math.floor(ph);
  if (type === "square") return x < 0.5 ? 1 : -1;
  if (type === "sawtooth") return 2 * x - 1;
  if (type === "triangle") return 1 - 4 * Math.abs(x - 0.5);
  return Math.sin(TAU * x);
};
const expAt = (a, b, k) => a * (b / a) ** Math.min(1, Math.max(0, k));

/** Adds an oscillator note into buf. env(tRel) -> gain; freq(tRel) -> Hz. */
function osc(buf, t0, dur, type, freq, env) {
  const s0 = Math.max(0, Math.floor(t0 * SR)), s1 = Math.min(buf.length, Math.ceil((t0 + dur) * SR));
  let ph = 0;
  for (let s = s0; s < s1; s++) { const t = s / SR - t0; ph += freq(t) / SR; buf[s] += wave(type, ph) * env(t); }
}
/** RBJ biquad, coefficients refreshed every 32 samples so sweeps follow the browser's frequency ramps. */
function biquad(input, type, freqAt, q = 1) {
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  for (let n = 0; n < input.length; n++) {
    if (n % 32 === 0) {
      const w = TAU * Math.min(freqAt(n / SR), SR * 0.45) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * Math.max(0.0001, q));
      let B0, B1, B2;
      if (type === "highpass") { B0 = (1 + c) / 2; B1 = -(1 + c); B2 = (1 + c) / 2; }
      else if (type === "bandpass") { B0 = al; B1 = 0; B2 = -al; }
      else { B0 = (1 - c) / 2; B1 = 1 - c; B2 = (1 - c) / 2; }
      const A0 = 1 + al; b0 = B0 / A0; b1 = B1 / A0; b2 = B2 / A0; a1 = -2 * c / A0; a2 = (1 - al) / A0;
    }
    const x = input[n], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y; out[n] = y;
  }
  return out;
}

/** Mood music for `secs`, at full level (volume/ducking applied by the caller). */
export function renderMood(mood, secs) {
  const def = MOODS[mood]; const N = Math.ceil((secs + 1) * SR);
  const pads = new Float32Array(N), direct = new Float32Array(N);
  if (!def) return direct;
  const beat = 60 / def.bpm, bar = beat * 4;
  const note = (f, t, dur, vol, type, dest = pads) => {
    const a = Math.min(0.08, dur / 4);
    osc(dest, t, dur + 0.05, type, () => f, (x) => (x < a ? vol * x / a : x <= dur ? expAt(vol, 0.0001, (x - a) / (dur - a)) : 0));
  };
  const kick = (t) => osc(direct, t, 0.25, "sine", (x) => expAt(120, 40, x / 0.15), (x) => (x <= 0.2 ? expAt(0.5, 0.001, x / 0.2) : 0));
  for (let nextBar = 0.05, i = 0; nextBar < secs; nextBar += bar, i++) {
    const chord = def.chords[i % def.chords.length];
    const padVol = 0.08 / chord.length * 3;
    chord.forEach((m) => note(hz(m), nextBar, bar * 1.05, padVol, def.wave));
    if (def.bass) note(hz(chord[0] - 12), nextBar, bar, 0.12, "sine");
    if (def.arp) for (let k = 0; k < 8; k++) note(hz(chord[k % chord.length] + 12), nextBar + k * beat / 2, beat / 2, 0.05, "triangle");
    if (def.beat) for (let k = 0; k < 4; k++) kick(nextBar + k * beat);
  }
  const f = biquad(pads, "lowpass", () => def.cutoff, 1);
  for (let n = 0; n < N; n++) direct[n] += f[n];
  return direct;
}

/** Browser duckSchedule + setTargetAtTime(level, t, 0.08) applied to a buffer. */
export function applyGainSchedule(buf, points, offset = 0) {
  let g = 0, idx = 0; const k = 1 - Math.exp(-1 / (0.08 * SR));
  const pts = points.map((p) => ({ s: Math.round((p.t + offset) * SR), level: p.level }));
  let target = 0;
  for (let n = 0; n < buf.length; n++) {
    while (idx < pts.length && pts[idx].s <= n) target = pts[idx++].level;
    g += (target - g) * k; buf[n] *= g;
  }
  return buf;
}
export const DUCK_RATIO = 0.25;
export function duckSchedule(sceneDurations, speechDurations, volume, ducking) {
  const base = Math.max(0, Math.min(1, volume / 100));
  if (!ducking) return [{ t: 0, level: base }];
  const out = []; let t = 0;
  sceneDurations.forEach((d, i) => {
    const sp = speechDurations[i];
    if (sp && sp > 0) { out.push({ t, level: base * DUCK_RATIO }); out.push({ t: t + Math.min(sp, d), level: base }); } else out.push({ t, level: base });
    t += d;
  });
  return out;
}

const PLAYABLE = ["whoosh", "soft-whoosh", "swoosh-up", "reverse", "page", "typewriter", "ding", "shutter", "click", "pop", "bubble", "chime", "bell", "sparkle", "riser", "impact", "thud", "drum", "cymbal", "heartbeat", "glitch", "laser", "coin", "wind", "scratch", "notify"];
export const sfxFor = (type, i) => (type !== "random" ? type : PLAYABLE[(i * 7 + 3) % PLAYABLE.length]);
let seed = 1; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

/** Adds one transition sound at time `at` (volume 0-100) into buf. */
export function addSfx(buf, type, at, volume = 50) {
  const master = Math.max(0, Math.min(1, volume / 100));
  const env = (peak, attack, dur) => (x) => (x < 0 ? 0 : x < attack ? expAt(0.0001, peak, x / attack) : x <= dur ? expAt(peak, 0.0001, (x - attack) / (dur - attack)) : 0) * master;
  const tone = (f, t, dur, peak, w = "sine", f2) => osc(buf, t, dur + 0.05, w, (x) => (f2 ? expAt(f, f2, x / dur) : f), env(peak, Math.min(0.01, dur / 4), dur));
  const hiss = (t, dur, peak, attack, ft, f1, f2, q = 1) => {
    const n = Math.ceil((dur + 0.05) * SR), src = new Float32Array(n);
    for (let i = 0; i < n; i++) src[i] = rand() * 2 - 1;
    const f = biquad(src, ft, (x) => (f2 ? expAt(f1, f2, x / dur) : f1), q), e = env(peak, attack, dur), s0 = Math.floor(t * SR);
    for (let i = 0; i < n && s0 + i < buf.length; i++) if (s0 + i >= 0) buf[s0 + i] += f[i] * e(i / SR);
  };
  const t = at;
  switch (type) {
    case "whoosh": hiss(t, 0.6, 0.9, 0.25, "bandpass", 300, 3000, 2); break;
    case "soft-whoosh": hiss(t, 0.8, 0.4, 0.35, "lowpass", 400, 1500, 0.7); break;
    case "swoosh-up": hiss(t, 0.45, 0.8, 0.3, "bandpass", 500, 6000, 3); break;
    case "reverse": hiss(t, 0.9, 0.7, 0.8, "lowpass", 300, 5000, 1); break;
    case "page": hiss(t, 0.18, 0.7, 0.03, "highpass", 1500, 4000); hiss(t + 0.12, 0.2, 0.5, 0.02, "bandpass", 3000, 1500, 1); break;
    case "typewriter": for (let i = 0; i < 6; i++) { const k = t + i * 0.07 + (i % 2) * 0.015; hiss(k, 0.03, 0.9, 0.002, "bandpass", 2500, undefined, 4); tone(180, k, 0.03, 0.3, "square"); } break;
    case "ding": hiss(t, 0.04, 0.6, 0.002, "bandpass", 2500, undefined, 4); tone(2100, t + 0.05, 1.0, 0.4); tone(4200, t + 0.05, 0.5, 0.1); break;
    case "shutter": hiss(t, 0.05, 1, 0.002, "highpass", 2000); hiss(t + 0.09, 0.06, 0.8, 0.002, "bandpass", 1200, undefined, 2); break;
    case "click": tone(1800, t, 0.03, 0.6, "square"); break;
    case "pop": tone(400, t, 0.12, 0.8, "sine", 1200); break;
    case "bubble": [0, 0.08, 0.15].forEach((d, i) => tone(500 + i * 200, t + d, 0.1, 0.5, "sine", 1400 + i * 300)); break;
    case "chime": [72, 76, 79, 84].forEach((m, i) => tone(hz(m), t + i * 0.08, 0.9, 0.25)); break;
    case "bell": tone(880, t, 1.6, 0.4); tone(1760 * 1.2, t, 0.8, 0.12); tone(440, t, 1.2, 0.15); break;
    case "sparkle": for (let i = 0; i < 8; i++) tone(2000 + rand() * 3000, t + i * 0.05, 0.25, 0.15, "triangle"); break;
    case "riser": hiss(t, 1.0, 0.6, 0.9, "bandpass", 200, 8000, 2); tone(200, t, 1.0, 0.15, "sawtooth", 1600); break;
    case "impact": tone(90, t, 1.4, 1, "sine", 30); hiss(t, 0.6, 0.6, 0.005, "lowpass", 800, 100); break;
    case "thud": tone(110, t, 0.3, 1, "sine", 45); break;
    case "drum": tone(160, t, 0.35, 1, "sine", 50); hiss(t, 0.15, 0.4, 0.002, "bandpass", 1800, undefined, 1); break;
    case "cymbal": hiss(t, 1.5, 0.5, 0.005, "highpass", 6000); break;
    case "heartbeat": tone(70, t, 0.2, 1, "sine", 40); tone(65, t + 0.28, 0.25, 0.8, "sine", 40); break;
    case "glitch": for (let i = 0; i < 6; i++) tone(200 + rand() * 2000, t + i * 0.04, 0.035, 0.35, "square"); hiss(t, 0.25, 0.3, 0.005, "highpass", 3000); break;
    case "laser": tone(2500, t, 0.3, 0.35, "sawtooth", 150); break;
    case "coin": tone(988, t, 0.08, 0.35, "square"); tone(1319, t + 0.08, 0.4, 0.3, "square"); break;
    case "wind": hiss(t, 1.4, 0.5, 0.6, "bandpass", 400, 900, 3); break;
    case "scratch": hiss(t, 0.25, 0.8, 0.02, "bandpass", 600, 2500, 5); hiss(t + 0.25, 0.2, 0.6, 0.02, "bandpass", 2500, 600, 5); break;
    case "notify": tone(1047, t, 0.15, 0.35); tone(1568, t + 0.12, 0.35, 0.35); break;
    default: break;
  }
}

/** Mono float buffer -> 16-bit stereo WAV. */
export async function writeWav(file, buf) {
  const n = buf.length, data = Buffer.alloc(44 + n * 4);
  data.write("RIFF", 0); data.writeUInt32LE(36 + n * 4, 4); data.write("WAVEfmt ", 8); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22); data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28);
  data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34); data.write("data", 36); data.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, buf[i])) * 32767 | 0; data.writeInt16LE(v, 44 + i * 4); data.writeInt16LE(v, 46 + i * 4); }
  await writeFile(file, data);
}
