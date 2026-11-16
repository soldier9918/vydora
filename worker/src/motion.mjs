// Copy of src/lib/motion.ts (horror looks) for the cloud worker. Keep in sync.
const rnd = (n) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const lines = (seed, count, maxSize, alpha) => Array.from({ length: count }, (_, i) => ({ pos: rnd(seed * 13 + i), size: 0.002 + rnd(seed * 7 + i * 3) * maxSize, a: alpha * (0.4 + 0.6 * rnd(seed + i * 11)) }));
const ease = (t) => t * t * (3 - 2 * t);
export const HORROR = ["h-flicker", "h-strobe", "h-streaks", "h-vhs", "h-static", "h-creep", "h-fade", "h-lightning", "h-blood", "h-heartbeat", "h-tilt", "h-sway", "h-shake", "h-lurch", "h-jumpscare", "h-possessed"];
export const horrorFor = (type, i) => (type === "h-random" ? HORROR[(i * 5 + 2) % HORROR.length] : type);
export const isHorror = (type) => String(type).startsWith("h-");

export function horrorAt(type, progress) {
  const none = { scale: 1, x: 0, y: 0, rot: 0 };
  const p = Math.max(0, Math.min(1, progress)), k = ease(p), lerp = (a, b) => a + (b - a) * k;
  let m;
  switch (type) {
    case "h-flicker": { const f = Math.floor(p * 160); const off = rnd(f) < 0.18; m = { ...none, scale: lerp(1.04, 1.12), fx: { dark: off ? 0.75 : 0.15 * rnd(f + 1) } }; break; }
    case "h-strobe": { const on = Math.floor(p * 60) % 2 === 0; m = { ...none, scale: 1.08, fx: { dark: on ? 0 : 0.85 } }; break; }
    case "h-streaks": { const f = Math.floor(p * 120); m = { ...none, scale: lerp(1.05, 1.1), x: 0.004 * (rnd(f) - 0.5), fx: { dark: 0.1 + 0.1 * rnd(f + 5), streaks: lines(f, 1 + Math.floor(rnd(f + 9) * 4), 0.004, 0.6) } }; break; }
    case "h-vhs": { const f = Math.floor(p * 90); const g = rnd(f) < 0.3; m = { ...none, scale: 1.1, x: g ? 0.03 * (rnd(f + 2) - 0.5) : 0, fx: { bands: g ? lines(f, 3, 0.05, 0.5) : lines(f, 1, 0.01, 0.2), red: g ? 0.12 : 0 } }; break; }
    case "h-static": { const f = Math.floor(p * 140); m = { ...none, scale: 1.1, x: 0.01 * (rnd(f) - 0.5), fx: { dark: rnd(f + 3) < 0.15 ? 0.6 : 0.1, bands: lines(f, 4, 0.03, 0.45), streaks: lines(f + 50, 2, 0.003, 0.4) } }; break; }
    case "h-creep": m = { ...none, scale: lerp(1, 1.22), fx: { dark: lerp(0, 0.45) } }; break;
    case "h-fade": m = { ...none, scale: lerp(1.05, 1.12), fx: { dark: lerp(0, 0.8) } }; break;
    case "h-lightning": { const f = Math.floor(p * 100); const hit = rnd(Math.floor(p * 8) + 0.5) > 0.55 && f % 12 < 2; m = { ...none, scale: lerp(1.05, 1.12), fx: { dark: hit ? 0 : 0.45, flash: hit ? 0.7 : 0 } }; break; }
    case "h-blood": { const s = (Math.sin(p * Math.PI * 8) + 1) / 2; m = { ...none, scale: 1.08 + 0.03 * s, fx: { red: 0.15 + 0.25 * s, dark: 0.2 } }; break; }
    case "h-heartbeat": { const b = (p * 6) % 1; const th = b < 0.08 ? 1 - b / 0.08 : b > 0.2 && b < 0.28 ? 0.6 * (1 - (b - 0.2) / 0.08) : 0; m = { ...none, scale: 1.08 + 0.05 * th, fx: { dark: 0.3 - 0.2 * th, red: 0.1 * th } }; break; }
    case "h-tilt": m = { ...none, scale: lerp(1.18, 1.26), rot: lerp(0, -6), fx: { dark: 0.2 } }; break;
    case "h-sway": m = { ...none, scale: 1.18, rot: 3 * Math.sin(p * Math.PI * 3), x: 0.03 * Math.sin(p * Math.PI * 2), fx: { dark: 0.25 } }; break;
    case "h-shake": { const f = Math.floor(p * 200); m = { scale: 1.15, x: 0.04 * (rnd(f) - 0.5), y: 0.04 * (rnd(f + 1) - 0.5), rot: 2 * (rnd(f + 2) - 0.5), fx: { dark: 0.2 } }; break; }
    case "h-lurch": { const seg = Math.floor(p * 5); m = { ...none, scale: 1.12 + 0.03 * rnd(seg), x: 0.05 * (rnd(seg + 1) - 0.5), y: 0.05 * (rnd(seg + 2) - 0.5), rot: 3 * (rnd(seg + 3) - 0.5), fx: { dark: 0.25 } }; break; }
    case "h-jumpscare": { const j = p < 0.7 ? 0 : ease(Math.min((p - 0.7) / 0.05, 1)); m = { ...none, scale: lerp(1, 1.04) + 0.3 * j, x: j ? 0.01 * (rnd(Math.floor(p * 200)) - 0.5) : 0, fx: { dark: 0.35 * (1 - j), flash: p > 0.7 && p < 0.73 ? 0.6 : 0 } }; break; }
    case "h-possessed": { const f = Math.floor(p * 150); m = { scale: 1.18, x: 0.03 * (rnd(f) - 0.5), y: 0.03 * (rnd(f + 1) - 0.5), rot: 3 * Math.sin(p * 9), fx: { dark: rnd(f + 4) < 0.2 ? 0.7 : 0.2, red: 0.15 + 0.15 * Math.sin(p * 20), streaks: lines(f, 2, 0.004, 0.5), bands: rnd(f + 6) < 0.3 ? lines(f, 2, 0.04, 0.4) : [] } }; break; }
    default: m = { ...none, scale: lerp(1, 1.15) };
  }
  const lim = (m.scale - 1) / 2;
  return { ...m, x: Math.max(-lim, Math.min(lim, m.x)), y: Math.max(-lim, Math.min(lim, m.y)) };
}
