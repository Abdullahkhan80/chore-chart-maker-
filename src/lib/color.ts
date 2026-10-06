// Color math for WCAG contrast checks. Pure, no DOM.

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parses #rgb or #rrggbb; throws on anything else. */
export function parseHex(hex: string): Rgb {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Not a hex color: ${hex}`);
  let digits = match[1]!;
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join('');
  const n = parseInt(digits, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** WCAG 2.x relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** WCAG AA minimum for normal-size text. */
export const AA_TEXT = 4.5;
/** WCAG AA minimum for large text and meaningful graphics (1.4.11). */
export const AA_GRAPHICS = 3;
