// Copy of src/lib/typewriter.ts caption timing for the cloud worker. Keep in sync.
export function wrapByChars(text, maxChars) {
  const limit = Math.max(1, Math.floor(maxChars)); const lines = []; let line = "";
  const flush = () => { if (line) { lines.push(line); line = ""; } };
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (word.length > limit) { flush(); let rest = word; while (rest.length > limit) { lines.push(rest.slice(0, limit)); rest = rest.slice(limit); } line = rest; continue; }
    const test = line ? `${line} ${word}` : word;
    if (test.length > limit && line) { flush(); line = word; } else line = test;
  }
  flush(); return lines;
}
function wordCountAt(flat, fraction) {
  if (!flat.length) return 0;
  const f = Math.min(Math.max(fraction, 0), 1);
  if (f <= 0) return 0; if (f >= 1) return flat.length;
  const cost = flat.map((w) => w.length + 1 + (/[,;:]$/.test(w) ? 2 : /[.!?]$/.test(w) ? 4 : 0));
  const at = f * cost.reduce((a, b) => a + b, 0);
  let n = 0, start = 0; for (const c of cost) { if (start <= at) n++; start += c; }
  return n;
}
export function typedLine(lines, fraction) {
  const clean = lines.map((l) => l.split(/\s+/).filter(Boolean).join(" ")).filter(Boolean);
  if (!clean.length) return "";
  const f = Math.min(Math.max(fraction, 0), 1);
  if (f <= 0) return ""; if (f >= 1) return clean[clean.length - 1];
  const cost = (ch) => 1 + (/[,;:]/.test(ch) ? 2 : /[.!?]/.test(ch) ? 4 : 0);
  const lineCost = clean.map((l) => [...l].reduce((a, ch) => a + cost(ch), 0) + 1);
  let at = f * lineCost.reduce((a, b) => a + b, 0);
  for (let i = 0; i < clean.length; i++) {
    if (at < lineCost[i] || i === clean.length - 1) { let out = ""; for (const ch of clean[i]) { if (at <= 0) break; out += ch; at -= cost(ch); } return out || clean[i][0]; }
    at -= lineCost[i];
  }
  return "";
}
export function typedWords(lines, fraction) {
  const words = lines.map((l) => l.split(/\s+/).filter(Boolean));
  let n = wordCountAt(words.flat(), fraction);
  for (let i = 0; i < words.length; i++) {
    if (n <= words[i].length || i === words.length - 1) { const take = Math.max(0, Math.min(n, words[i].length)); return take ? [words[i].slice(0, take).join(" ")] : []; }
    n -= words[i].length;
  }
  return [];
}
export function typedPair(lines, fraction) {
  const words = lines.map((l) => l.split(/\s+/).filter(Boolean)).filter((w) => w.length);
  const n = wordCountAt(words.flat(), fraction);
  if (!n) return [];
  let seen = 0;
  for (let p = 0; p < words.length; p += 2) { const page = words.slice(p, p + 2); seen += page.reduce((a, w) => a + w.length, 0); if (n <= seen || p + 2 >= words.length) return page.map((w) => w.join(" ")); }
  return [];
}
export function karaokeAt(lines, fraction) {
  const words = lines.map((l) => l.split(/\s+/).filter(Boolean)).filter((w) => w.length);
  let n = wordCountAt(words.flat(), fraction);
  if (!n) return { words: [], active: -1 };
  for (let i = 0; i < words.length; i++) { if (n <= words[i].length || i === words.length - 1) return { words: words[i], active: Math.min(n, words[i].length) - 1 }; n -= words[i].length; }
  return { words: [], active: -1 };
}
