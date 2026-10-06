// Chart themes: palette, header decoration, border and sticker shape.
// All artwork is original, made of simple SVG shapes (no characters or brands).
// Pure TypeScript: returns SVG markup strings for the chart renderer.
import type { Theme as ThemeId } from './types.ts';

export interface ThemePalette {
  /** Chart paper background. */
  page: string;
  text: string;
  /** Secondary text on the page and in cells (dates, hints). */
  mutedText: string;
  headerBg: string;
  headerText: string;
  /** Chore row / cell background. */
  cellBg: string;
  cellText: string;
  /** Day-name chips and badges. */
  accent: string;
  accentText: string;
  /** Grid lines (decorative). */
  border: string;
  stickerFill: string;
  /** Sticker outline; must stay visible on the page (3:1). */
  stickerStroke: string;
  /** Fills for header decoration shapes (purely decorative). */
  decor: readonly string[];
}

export type DecorationKind = 'confetti' | 'clouds' | 'waves' | 'stars' | 'spikes' | 'leaves' | 'pennants' | 'rule';
export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double';
export type StickerShape = 'star' | 'heart' | 'circle' | 'sparkle' | 'egg' | 'leaf' | 'hexagon' | 'square';

export interface ChartTheme {
  id: ThemeId;
  name: string;
  description: string;
  palette: ThemePalette;
  decoration: DecorationKind;
  border: { style: BorderStyle; width: number; radius: number };
  sticker: StickerShape;
  /** Mostly white with thin dark lines: cheap to print. */
  inkSaver: boolean;
}

/** Text/background pairs the renderer draws; every pair must meet WCAG AA (4.5:1). */
export const TEXT_PAIRS = [
  ['text', 'page'],
  ['mutedText', 'page'],
  ['headerText', 'headerBg'],
  ['cellText', 'cellBg'],
  ['mutedText', 'cellBg'],
  ['accentText', 'accent'],
] as const satisfies readonly (readonly [keyof ThemePalette, keyof ThemePalette])[];

export const THEMES: Readonly<Record<ThemeId, ChartTheme>> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    description: 'Bright teal header with colorful confetti.',
    palette: {
      page: '#ffffff',
      text: '#1f2937',
      mutedText: '#4b5563',
      headerBg: '#0f766e',
      headerText: '#ffffff',
      cellBg: '#f0fdfa',
      cellText: '#1f2937',
      accent: '#fde68a',
      accentText: '#78350f',
      border: '#94a3b8',
      stickerFill: '#fbbf24',
      stickerStroke: '#b45309',
      decor: ['#f59e0b', '#ef4444', '#3b82f6', '#10b981'],
    },
    decoration: 'confetti',
    border: { style: 'solid', width: 2, radius: 8 },
    sticker: 'star',
    inkSaver: false,
  },
  pastel: {
    id: 'pastel',
    name: 'Pastel',
    description: 'Soft pinks and blues with fluffy clouds.',
    palette: {
      page: '#fffafc',
      text: '#3f3d56',
      mutedText: '#5f5b78',
      headerBg: '#fbcfe8',
      headerText: '#6b2150',
      cellBg: '#f5f3ff',
      cellText: '#3f3d56',
      accent: '#bae6fd',
      accentText: '#0c4a6e',
      border: '#d8b4fe',
      stickerFill: '#f9a8d4',
      stickerStroke: '#be185d',
      decor: ['#ffffff', '#bae6fd', '#e9d5ff', '#fde68a'],
    },
    decoration: 'clouds',
    border: { style: 'dashed', width: 2, radius: 16 },
    sticker: 'heart',
    inkSaver: false,
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    description: 'Deep blue waves and bubbles.',
    palette: {
      page: '#f0f9ff',
      text: '#0c2d48',
      mutedText: '#2f5675',
      headerBg: '#075985',
      headerText: '#ffffff',
      cellBg: '#e0f2fe',
      cellText: '#0c2d48',
      accent: '#67e8f9',
      accentText: '#083344',
      border: '#7dd3fc',
      stickerFill: '#7dd3fc',
      stickerStroke: '#0369a1',
      decor: ['#38bdf8', '#7dd3fc', '#e0f2fe'],
    },
    decoration: 'waves',
    border: { style: 'solid', width: 2, radius: 12 },
    sticker: 'circle',
    inkSaver: false,
  },
  space: {
    id: 'space',
    name: 'Space',
    description: 'Night sky with stars and a ringed planet.',
    palette: {
      page: '#111633',
      text: '#f1f5f9',
      mutedText: '#c7d2fe',
      headerBg: '#312e81',
      headerText: '#fef9c3',
      cellBg: '#1e2147',
      cellText: '#f1f5f9',
      accent: '#fde047',
      accentText: '#1e1b4b',
      border: '#6366f1',
      stickerFill: '#fde047',
      stickerStroke: '#facc15',
      decor: ['#fde047', '#a5b4fc', '#f472b6'],
    },
    decoration: 'stars',
    border: { style: 'double', width: 3, radius: 6 },
    sticker: 'sparkle',
    inkSaver: false,
  },
  dinosaur: {
    id: 'dinosaur',
    name: 'Dinosaur',
    description: 'Leafy greens with a row of spiky back plates.',
    palette: {
      page: '#fbfdf4',
      text: '#1f2a14',
      mutedText: '#4a5a32',
      headerBg: '#3f6212',
      headerText: '#ffffff',
      cellBg: '#f0f7e1',
      cellText: '#1f2a14',
      accent: '#fdba74',
      accentText: '#431407',
      border: '#a3c46c',
      stickerFill: '#fdba74',
      stickerStroke: '#c2410c',
      decor: ['#65a30d', '#84cc16', '#fb923c'],
    },
    decoration: 'spikes',
    border: { style: 'solid', width: 3, radius: 14 },
    sticker: 'egg',
    inkSaver: false,
  },
  jungle: {
    id: 'jungle',
    name: 'Jungle',
    description: 'Big tropical leaves in greens and yellow.',
    palette: {
      page: '#f7fbf3',
      text: '#12301c',
      mutedText: '#3d5c45',
      headerBg: '#166534',
      headerText: '#fefce8',
      cellBg: '#ecfdf3',
      cellText: '#12301c',
      accent: '#fde047',
      accentText: '#422006',
      border: '#86c79a',
      stickerFill: '#86efac',
      stickerStroke: '#15803d',
      decor: ['#16a34a', '#4ade80', '#facc15'],
    },
    decoration: 'leaves',
    border: { style: 'dotted', width: 3, radius: 10 },
    sticker: 'leaf',
    inkSaver: false,
  },
  sports: {
    id: 'sports',
    name: 'Sports',
    description: 'Team colors with a string of pennant flags.',
    palette: {
      page: '#ffffff',
      text: '#111827',
      mutedText: '#4b5563',
      headerBg: '#1d4ed8',
      headerText: '#ffffff',
      cellBg: '#eff6ff',
      cellText: '#111827',
      accent: '#dc2626',
      accentText: '#ffffff',
      border: '#93c5fd',
      stickerFill: '#ffffff',
      stickerStroke: '#1f2937',
      decor: ['#dc2626', '#facc15', '#ffffff'],
    },
    decoration: 'pennants',
    border: { style: 'solid', width: 3, radius: 4 },
    sticker: 'hexagon',
    inkSaver: false,
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Black and white with thin lines. Uses the least ink.',
    palette: {
      page: '#ffffff',
      text: '#111111',
      mutedText: '#555555',
      headerBg: '#ffffff',
      headerText: '#111111',
      cellBg: '#ffffff',
      cellText: '#111111',
      accent: '#ffffff',
      accentText: '#111111',
      border: '#9ca3af',
      stickerFill: '#ffffff',
      stickerStroke: '#111111',
      decor: [],
    },
    decoration: 'rule',
    border: { style: 'solid', width: 1, radius: 0 },
    sticker: 'square',
    inkSaver: true,
  },
};

export function getTheme(id: ThemeId): ChartTheme {
  return THEMES[id] ?? THEMES.classic;
}

/**
 * The theme as printed with the "ink saver" option: white fills, dark text and
 * outlines only. Keeps the theme's border style and sticker shape.
 */
export function applyInkSaver(theme: ChartTheme): ChartTheme {
  if (theme.inkSaver) return theme;
  return {
    ...theme,
    palette: {
      ...THEMES.minimal.palette,
      border: '#9ca3af',
    },
    decoration: 'rule',
    inkSaver: true,
  };
}

// ---------------------------------------------------------------------------
// SVG helpers

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** SVG stroke-dasharray for a border style, or undefined for solid lines. */
export function borderDashArray(border: ChartTheme['border']): string | undefined {
  if (border.style === 'dashed') return `${fmt(border.width * 4)} ${fmt(border.width * 2.5)}`;
  if (border.style === 'dotted') return `0 ${fmt(border.width * 2)}`;
  return undefined;
}

function polygon(points: [number, number][]): string {
  return `M${points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L')}Z`;
}

function starPoints(cx: number, cy: number, outer: number, inner: number, spikes: number, rotation = -Math.PI / 2) {
  const points: [number, number][] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = rotation + (i * Math.PI) / spikes;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return points;
}

/** Path data for a sticker of `shape`, centered on (cx, cy) and fitting a `size` × `size` box. */
export function stickerPath(shape: StickerShape, cx: number, cy: number, size: number): string {
  const r = size / 2;
  switch (shape) {
    case 'star':
      return polygon(starPoints(cx, cy, r, r * 0.45, 5));
    case 'sparkle':
      return polygon(starPoints(cx, cy, r, r * 0.4, 4));
    case 'hexagon':
      return polygon(Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
      }));
    case 'circle':
      return `M${fmt(cx - r)} ${fmt(cy)}a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(size)} 0a${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-size)} 0Z`;
    case 'egg':
      return [
        `M${fmt(cx)} ${fmt(cy - r)}`,
        `C${fmt(cx + r * 0.75)} ${fmt(cy - r)} ${fmt(cx + r * 0.85)} ${fmt(cy + r * 0.2)} ${fmt(cx + r * 0.8)} ${fmt(cy + r * 0.35)}`,
        `C${fmt(cx + r * 0.7)} ${fmt(cy + r)} ${fmt(cx - r * 0.7)} ${fmt(cy + r)} ${fmt(cx - r * 0.8)} ${fmt(cy + r * 0.35)}`,
        `C${fmt(cx - r * 0.85)} ${fmt(cy + r * 0.2)} ${fmt(cx - r * 0.75)} ${fmt(cy - r)} ${fmt(cx)} ${fmt(cy - r)}Z`,
      ].join('');
    case 'heart':
      return [
        `M${fmt(cx)} ${fmt(cy + r * 0.85)}`,
        `C${fmt(cx - r * 1.2)} ${fmt(cy)} ${fmt(cx - r * 0.9)} ${fmt(cy - r * 0.95)} ${fmt(cx)} ${fmt(cy - r * 0.45)}`,
        `C${fmt(cx + r * 0.9)} ${fmt(cy - r * 0.95)} ${fmt(cx + r * 1.2)} ${fmt(cy)} ${fmt(cx)} ${fmt(cy + r * 0.85)}Z`,
      ].join('');
    case 'leaf':
      return [
        `M${fmt(cx - r * 0.8)} ${fmt(cy + r * 0.8)}`,
        `Q${fmt(cx - r)} ${fmt(cy - r)} ${fmt(cx + r * 0.8)} ${fmt(cy - r * 0.8)}`,
        `Q${fmt(cx + r)} ${fmt(cy + r)} ${fmt(cx - r * 0.8)} ${fmt(cy + r * 0.8)}Z`,
      ].join('');
    case 'square': {
      const corner = r * 0.2;
      const s = size - corner * 2;
      return `M${fmt(cx - r + corner)} ${fmt(cy - r)}h${fmt(s)}q${fmt(corner)} 0 ${fmt(corner)} ${fmt(corner)}v${fmt(s)}q0 ${fmt(corner)} ${fmt(-corner)} ${fmt(corner)}h${fmt(-s)}q${fmt(-corner)} 0 ${fmt(-corner)} ${fmt(-corner)}v${fmt(-s)}q0 ${fmt(-corner)} ${fmt(corner)} ${fmt(-corner)}Z`;
    }
  }
}

/** Small deterministic PRNG so decorations look scattered but render identically every time. */
function seededRandom(seed: string) {
  let h = 2166136261;
  for (const char of seed) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * SVG elements (no wrapper) decorating a strip of `width` × `height` that the
 * renderer places alongside the header. Decorations never sit behind text.
 */
export function headerDecorationSvg(theme: ChartTheme, width: number, height: number): string {
  const colors = theme.palette.decor;
  const color = (i: number) => colors[i % colors.length] ?? theme.palette.border;
  const random = seededRandom(theme.id);
  const shapes: string[] = [];
  const step = Math.max(height * 1.4, 24);
  const count = Math.max(1, Math.floor(width / step));

  switch (theme.decoration) {
    case 'confetti':
      for (let i = 0; i < count * 2; i++) {
        const x = random() * width;
        const y = height * (0.2 + random() * 0.6);
        const s = height * (0.12 + random() * 0.12);
        shapes.push(
          i % 2 === 0
            ? `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(s / 2)}" fill="${color(i)}"/>`
            : `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(s)}" height="${fmt(s / 2.5)}" rx="${fmt(s / 5)}" fill="${color(i)}" transform="rotate(${fmt(random() * 90 - 45)} ${fmt(x)} ${fmt(y)})"/>`,
        );
      }
      break;
    case 'clouds':
      for (let i = 0; i < Math.ceil(count / 2); i++) {
        const x = (i + 0.5) * (width / Math.ceil(count / 2));
        const y = height * 0.55;
        const r = height * 0.22;
        shapes.push(
          `<g fill="${color(i)}"><circle cx="${fmt(x - r)}" cy="${fmt(y)}" r="${fmt(r)}"/><circle cx="${fmt(x)}" cy="${fmt(y - r * 0.6)}" r="${fmt(r * 1.25)}"/><circle cx="${fmt(x + r)}" cy="${fmt(y)}" r="${fmt(r)}"/><rect x="${fmt(x - r)}" y="${fmt(y)}" width="${fmt(r * 2)}" height="${fmt(r)}"/></g>`,
        );
      }
      break;
    case 'waves': {
      const amplitude = height * 0.18;
      const wavelength = step;
      for (const [row, offset] of [[0, 0.45], [1, 0.75]] as const) {
        let d = `M0 ${fmt(height * offset)}`;
        for (let x = 0; x < width; x += wavelength) {
          d += `q${fmt(wavelength / 4)} ${fmt(-amplitude)} ${fmt(wavelength / 2)} 0t${fmt(wavelength / 2)} 0`;
        }
        shapes.push(`<path d="${d}" fill="none" stroke="${color(row)}" stroke-width="${fmt(height * 0.1)}" stroke-linecap="round"/>`);
      }
      for (let i = 0; i < count; i++) {
        shapes.push(`<circle cx="${fmt(random() * width)}" cy="${fmt(height * (0.1 + random() * 0.2))}" r="${fmt(height * (0.04 + random() * 0.05))}" fill="none" stroke="${color(1)}" stroke-width="${fmt(height * 0.03)}"/>`);
      }
      break;
    }
    case 'stars': {
      for (let i = 0; i < count * 2; i++) {
        const x = random() * width;
        const y = height * (0.15 + random() * 0.7);
        const r = height * (0.06 + random() * 0.1);
        shapes.push(`<path d="${polygon(starPoints(x, y, r, r * 0.45, 5))}" fill="${color(i % 2 === 0 ? 0 : 1)}"/>`);
      }
      const px = width * 0.9;
      const py = height * 0.5;
      const pr = height * 0.28;
      shapes.push(
        `<circle cx="${fmt(px)}" cy="${fmt(py)}" r="${fmt(pr)}" fill="${color(2)}"/><ellipse cx="${fmt(px)}" cy="${fmt(py)}" rx="${fmt(pr * 1.7)}" ry="${fmt(pr * 0.45)}" fill="none" stroke="${color(1)}" stroke-width="${fmt(height * 0.05)}" transform="rotate(-15 ${fmt(px)} ${fmt(py)})"/>`,
      );
      break;
    }
    case 'spikes': {
      const plate = width / count;
      for (let i = 0; i < count; i++) {
        const x = i * plate;
        shapes.push(`<path d="${polygon([[x, height], [x + plate / 2, height * 0.3], [x + plate, height]])}" fill="${color(i % 2)}"/>`);
        shapes.push(`<circle cx="${fmt(x + plate / 2)}" cy="${fmt(height * 0.78)}" r="${fmt(height * 0.07)}" fill="${color(2)}"/>`);
      }
      break;
    }
    case 'leaves':
      for (let i = 0; i < count; i++) {
        const x = (i + 0.5) * (width / count);
        const size = height * (0.6 + random() * 0.3);
        const angle = (i % 2 === 0 ? -1 : 1) * (20 + random() * 25);
        shapes.push(
          `<path d="${stickerPath('leaf', x, height / 2, size)}" fill="${color(i % 3)}" transform="rotate(${fmt(angle)} ${fmt(x)} ${fmt(height / 2)})"/>`,
        );
      }
      break;
    case 'pennants': {
      const flag = width / count;
      shapes.push(`<path d="M0 ${fmt(height * 0.15)}Q${fmt(width / 2)} ${fmt(height * 0.35)} ${fmt(width)} ${fmt(height * 0.15)}" fill="none" stroke="${theme.palette.border}" stroke-width="${fmt(height * 0.04)}"/>`);
      for (let i = 0; i < count; i++) {
        const x = i * flag;
        const sag = Math.sin((Math.PI * (i + 0.5)) / count) * height * 0.1;
        const top = height * 0.17 + sag;
        shapes.push(
          `<path d="${polygon([[x + flag * 0.1, top], [x + flag * 0.9, top], [x + flag / 2, top + height * 0.6]])}" fill="${color(i)}" stroke="${theme.palette.border}" stroke-width="${fmt(height * 0.02)}"/>`,
        );
      }
      break;
    }
    case 'rule':
      shapes.push(`<line x1="0" y1="${fmt(height / 2)}" x2="${fmt(width)}" y2="${fmt(height / 2)}" stroke="${theme.palette.text}" stroke-width="1"/>`);
      break;
  }
  return shapes.join('');
}
