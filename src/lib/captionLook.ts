import type { CaptionStyle } from "./typewriter";

export const CAPTION_STYLES: { value: CaptionStyle; label: string }[] = [
  { value: "typewriter", label: "Typewriter" },
  { value: "pop", label: "Word pop" },
  { value: "sentence", label: "Sentence" },
  { value: "full", label: "Full text" },
  { value: "karaoke", label: "Karaoke highlight" },
  { value: "cinematic", label: "Cinematic bar" },
  { value: "none", label: "None" },
];

/** Web-safe font stacks so the downloaded video renders them without loading anything. */
export const CAPTION_FONTS = [
  { value: "mono", label: "Typewriter (mono)", css: "'Courier New', Courier, monospace" },
  { value: "sans", label: "Clean sans", css: "Arial, Helvetica, sans-serif" },
  { value: "serif", label: "Classic serif", css: "Georgia, 'Times New Roman', serif" },
  { value: "impact", label: "Bold impact", css: "Impact, 'Arial Black', sans-serif" },
  { value: "rounded", label: "Friendly", css: "'Trebuchet MS', Verdana, sans-serif" },
  { value: "heavy", label: "Heavy block", css: "'Arial Black', 'Helvetica Neue', Arial, sans-serif" },
  { value: "narrow", label: "Tall narrow", css: "'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue', sans-serif" },
  { value: "elegant", label: "Elegant", css: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif" },
  { value: "news", label: "Newspaper", css: "'Times New Roman', Times, serif" },
  { value: "modern", label: "Modern", css: "'Segoe UI', Roboto, 'Helvetica Neue', sans-serif" },
  { value: "tahoma", label: "Crisp", css: "Tahoma, Verdana, Geneva, sans-serif" },
  { value: "handwritten", label: "Handwritten", css: "'Comic Sans MS', 'Comic Neue', cursive" },
  { value: "script", label: "Fancy script", css: "'Brush Script MT', 'Segoe Script', cursive" },
  { value: "code", label: "Coder", css: "'Lucida Console', Monaco, 'Consolas', monospace" },
] as const;

export const CAPTION_COLORS = [
  { value: "#ffffff", label: "White" },
  { value: "#ffe14d", label: "Yellow" },
  { value: "#c6ff3d", label: "Lime" },
  { value: "#4de1ff", label: "Cyan" },
  { value: "#ff5a3c", label: "Red" },
  { value: "#ff7ad9", label: "Pink" },
] as const;

/** px at 1280×720 export; preview scales from the same number. */
export const CAPTION_SIZES = [
  { value: "small", label: "Small", px: 44 },
  { value: "medium", label: "Medium", px: 60 },
  { value: "large", label: "Large", px: 80 },
  { value: "xl", label: "Extra large", px: 100 },
] as const;

export type CaptionLook = { style: CaptionStyle; font: string; color: string; size: string };

export const fontCss = (v: string) => (CAPTION_FONTS.find((f) => f.value === v) ?? CAPTION_FONTS[0]).css;
export const sizePx = (v: string) => (CAPTION_SIZES.find((s) => s.value === v) ?? CAPTION_SIZES[1]).px;
export const safeColor = (v: string) => (CAPTION_COLORS.some((c) => c.value === v) ? v : "#ffffff");

/** Karaoke highlight colour: yellow, or lime when the text itself is yellow. */
export const highlightColor = (base: string) => (safeColor(base) === "#ffe14d" ? "#c6ff3d" : "#ffe14d");

/** One-tap caption looks; each sets style, font and colour together. */
export const CAPTION_PRESETS = [
  { id: "karaoke", label: "Karaoke", style: "karaoke", font: "heavy", color: "#ffffff" },
  { id: "yellow", label: "Bold yellow", style: "pop", font: "impact", color: "#ffe14d" },
  { id: "green", label: "Bold green", style: "pop", font: "impact", color: "#c6ff3d" },
  { id: "cinematic", label: "Cinematic bar", style: "cinematic", font: "serif", color: "#ffffff" },
] as const;

/**
 * Where captions sit. Vertical (9:16) videos keep captions inside the Shorts safe zone:
 * lifted above the title/channel area and clear of the like/comment buttons on the right.
 * Fractions of the frame: bottom = gap below the last line, width = text width, centre = x.
 */
export const captionBox = (aspect?: string | null) =>
  aspect === "9:16" ? { bottom: 0.25, width: 0.7, centre: 0.44 } : { bottom: 0, width: 0.85, centre: 0.5 };
