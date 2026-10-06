// Chart renderer: (config, options) → SVG pages. The single source of truth for
// the live preview, PNG, PDF and print. Pure TypeScript (no DOM), so Node can
// run it in tests and Astro can render the first preview at build time.
//
// Units are CSS pixels at 96 per inch; the root <svg> carries physical width
// and height (in or mm) so printers and PDF output get the exact paper size.
import type { IconId } from './icons.ts';
import { DAYS, type ChartConfig, type Chore, type Day, type Kid, type KidColor } from './types.ts';
import { applyInkSaver, borderDashArray, getTheme, headerDecorationSvg, stickerPath, type ChartTheme } from './themes.ts';

export type IconResolver = (id: IconId) => string;

export interface RenderOptions {
  /** Returns the href for an icon: a URL for the preview, a data: URI for PNG/PDF export. */
  iconResolver: IconResolver;
  /** Reference date for "this week" when config.startDate is null. */
  today?: Date;
  /** Extra CSS placed in the SVG, e.g. an @font-face with an embedded font for PNG export. */
  fontCss?: string;
}

export const PX_PER_INCH = 96;
export const SAFE_MARGIN_IN = 0.4;
export const FONT_FAMILY = "Nunito, 'Nunito Fallback', Arial, sans-serif";
const PAPER_INCHES = { letter: { w: 8.5, h: 11 }, a4: { w: 210 / 25.4, h: 297 / 25.4 } } as const;

export const KID_COLOR_HEX: Readonly<Record<KidColor, string>> = {
  teal: '#14b8a6',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  pink: '#ec4899',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
};

const DAY_LABELS: Record<Day, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CURRENCY_SYMBOLS: Record<ChartConfig['allowance']['currency'], string> = {
  USD: '$',
  CAD: '$',
  AUD: '$',
  NZD: '$',
  GBP: '£',
  EUR: '€',
};
const ROUTINE_GROUPS = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'After School' },
  { key: 'evening', label: 'Bedtime' },
  { key: undefined, label: 'Anytime' },
] as const;

export interface PageGeometry {
  widthIn: number;
  heightIn: number;
  /** Page size in CSS px (96/in). */
  width: number;
  height: number;
  /** Safe margin in CSS px. */
  margin: number;
}

export function pageGeometry(config: Pick<ChartConfig, 'paper' | 'orientation'>): PageGeometry {
  const paper = PAPER_INCHES[config.paper];
  const landscape = config.orientation === 'landscape';
  const widthIn = landscape ? paper.h : paper.w;
  const heightIn = landscape ? paper.w : paper.h;
  return { widthIn, heightIn, width: widthIn * PX_PER_INCH, height: heightIn * PX_PER_INCH, margin: SAFE_MARGIN_IN * PX_PER_INCH };
}

// ---------------------------------------------------------------------------
// SVG string helpers

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const fmt = (n: number) => String(Math.round(n * 10) / 10);

type Attrs = Record<string, string | number | undefined>;

function attrs(a: Attrs): string {
  let out = '';
  for (const [key, value] of Object.entries(a)) {
    if (value === undefined) continue;
    out += ` ${key}="${typeof value === 'number' ? fmt(value) : escapeXml(value)}"`;
  }
  return out;
}

function tag(name: string, a: Attrs, children?: string): string {
  return children === undefined ? `<${name}${attrs(a)}/>` : `<${name}${attrs(a)}>${children}</${name}>`;
}

interface TextStyle {
  size: number;
  fill: string;
  bold?: boolean;
  anchor?: 'start' | 'middle' | 'end';
}

function text(x: number, y: number, content: string, style: TextStyle): string {
  return tag(
    'text',
    {
      x,
      y,
      'font-size': style.size,
      'font-weight': style.bold ? 700 : undefined,
      fill: style.fill,
      'text-anchor': style.anchor && style.anchor !== 'start' ? style.anchor : undefined,
    },
    escapeXml(content),
  );
}

// ---------------------------------------------------------------------------
// Text measurement (approximate; there is no DOM). Errs on the wide side.

function charWidth(char: string): number {
  if (/\p{Extended_Pictographic}|\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}/u.test(char)) return 1.05;
  if (char === ' ') return 0.27;
  if (/[A-Z]/.test(char)) return 0.68;
  if (/[mwMW]/.test(char)) return 0.82;
  if (/[a-z0-9]/.test(char)) return 0.54;
  if (/[.,:;'!|il]/.test(char)) return 0.28;
  return 0.6;
}

export function approxTextWidth(content: string, size: number, bold = false): number {
  let units = 0;
  for (const char of content) units += /[\p{M}\p{Cf}]/u.test(char) ? 0 : charWidth(char);
  return units * size * (bold ? 1.06 : 1);
}

interface FittedText {
  size: number;
  lines: string[];
}

function truncateToWidth(content: string, maxWidth: number, size: number, bold: boolean): string {
  if (approxTextWidth(content, size, bold) <= maxWidth) return content;
  const chars = Array.from(content);
  while (chars.length > 0 && approxTextWidth(`${chars.join('')}…`, size, bold) > maxWidth) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

/** Largest font size (≤ maxSize) at which `content` fits in maxWidth on up to maxLines lines. */
export function fitText(content: string, maxWidth: number, maxSize: number, minSize: number, bold = false, maxLines = 1): FittedText {
  const words = content.split(' ');
  // Most balanced two-line split, by the wider of the two lines.
  let split: [string, string] | undefined;
  if (maxLines >= 2 && words.length > 1) {
    let best = Infinity;
    for (let i = 1; i < words.length; i++) {
      const pair: [string, string] = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
      const widest = Math.max(approxTextWidth(pair[0], 1, bold), approxTextWidth(pair[1], 1, bold));
      if (widest < best) {
        best = widest;
        split = pair;
      }
    }
  }
  for (let size = maxSize; size >= minSize; size -= 0.5) {
    if (approxTextWidth(content, size, bold) <= maxWidth) return { size, lines: [content] };
    if (split && split.every((line) => approxTextWidth(line, size, bold) <= maxWidth)) return { size, lines: [...split] };
  }
  return { size: minSize, lines: [truncateToWidth(content, maxWidth, minSize, bold)] };
}

// ---------------------------------------------------------------------------
// Dates

function isoToUtc(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** First day of the chart week (UTC midnight), aligned to config.weekStart. */
export function weekStartDate(config: ChartConfig, today: Date): Date {
  const base = config.startDate
    ? isoToUtc(config.startDate)
    : new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const startDay = config.weekStart === 'sun' ? 0 : 1;
  const offset = (base.getUTCDay() - startDay + 7) % 7;
  return addDays(base, -offset);
}

function shortDate(date: Date): string {
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/** Days in display order for the configured week start. */
export function orderedDays(config: Pick<ChartConfig, 'weekStart'>): Day[] {
  return config.weekStart === 'sun' ? ['sun', ...DAYS.filter((d) => d !== 'sun')] : [...DAYS];
}

// ---------------------------------------------------------------------------
// Rotation

/**
 * Round-robin rotation: schedule[week][person] = chore indices. Chore j goes to
 * person (j + week) mod people, so over `people` weeks everyone does every chore
 * exactly once and weekly loads never differ by more than one.
 */
export function rotationSchedule(choreCount: number, people: number, weeks: number): number[][][] {
  const n = Math.max(1, people);
  return Array.from({ length: weeks }, (_, week) => {
    const row: number[][] = Array.from({ length: n }, () => []);
    for (let chore = 0; chore < choreCount; chore++) row[(chore + week) % n]!.push(chore);
    return row;
  });
}

/** Weeks shown on a rotation chart: whole rotation cycles, at least 4 weeks. */
export function rotationWeeks(people: number): number {
  const n = Math.max(1, people);
  return n * Math.ceil(4 / n);
}

// ---------------------------------------------------------------------------
// Page scaffolding

interface Ctx {
  config: ChartConfig;
  theme: ChartTheme;
  geo: PageGeometry;
  options: RenderOptions;
  large: boolean;
  today: Date;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function kidName(kid: Kid, index: number): string {
  return kid.name || `Child ${index + 1}`;
}

function image(ctx: Ctx, id: IconId, x: number, y: number, size: number): string {
  return tag('image', { href: ctx.options.iconResolver(id), x, y, width: size, height: size });
}

function frame(ctx: Ctx, box: Box): string {
  const { border, palette } = ctx.theme;
  const dash = borderDashArray(border);
  const linecap = border.style === 'dotted' ? 'round' : undefined;
  let out = tag('rect', {
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
    rx: border.radius,
    fill: 'none',
    stroke: palette.border,
    'stroke-width': border.width,
    'stroke-dasharray': dash,
    'stroke-linecap': linecap,
  });
  if (border.style === 'double') {
    const inset = border.width + 2;
    out += tag('rect', {
      x: box.x + inset,
      y: box.y + inset,
      width: box.w - inset * 2,
      height: box.h - inset * 2,
      rx: Math.max(0, border.radius - inset),
      fill: 'none',
      stroke: palette.border,
      'stroke-width': 1,
    });
  }
  return out;
}

const segment = (x1: number, y1: number, x2: number, y2: number) => `M${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}`;

/** All grid lines of a table as one path (much smaller than one <line> each). */
function gridPath(segments: string[], stroke: string): string {
  return segments.length ? tag('path', { d: [...new Set(segments)].join(''), fill: 'none', stroke, 'stroke-width': 1 }) : '';
}

function checkbox(ctx: Ctx, cx: number, cy: number, size: number): string {
  return tag('rect', {
    x: cx - size / 2,
    y: cy - size / 2,
    width: size,
    height: size,
    rx: Math.min(6, size / 4),
    fill: ctx.theme.palette.page,
    stroke: ctx.theme.palette.text,
    'stroke-width': ctx.large ? 2 : 1.5,
  });
}

interface HeaderInput {
  title: string;
  subtitle?: string;
  avatarKid?: { kid: Kid; index: number };
  legendKids?: Kid[];
}

/** Draws the header band, decoration strip and optional legend; returns the markup and the body's top y. */
function header(ctx: Ctx, input: HeaderInput): { svg: string; bottom: number } {
  const { geo, theme, large } = ctx;
  const { palette } = theme;
  const m = geo.margin;
  const cw = geo.width - m * 2;
  const bandH = large ? 96 : 84;
  let svg = tag('rect', {
    x: m,
    y: m,
    width: cw,
    height: bandH,
    rx: theme.border.radius,
    fill: palette.headerBg,
    stroke: theme.inkSaver ? palette.text : undefined,
    'stroke-width': theme.inkSaver ? 1.5 : undefined,
  });

  const avatarSize = input.avatarKid ? bandH - 24 : 0;
  if (input.avatarKid) {
    svg += image(ctx, input.avatarKid.kid.avatarIcon, m + cw - 16 - avatarSize, m + 12, avatarSize);
  }
  const textW = cw - 40 - (avatarSize ? avatarSize + 16 : 0);
  const title = fitText(input.title || 'My Chart', textW, large ? 40 : 34, 16, true);
  if (input.subtitle) {
    const sub = fitText(input.subtitle, textW, large ? 19 : 16, 10);
    svg += text(m + 20, m + bandH * 0.5, title.lines[0]!, { size: title.size, fill: palette.headerText, bold: true });
    svg += text(m + 20, m + bandH * 0.5 + sub.size + 8, sub.lines[0]!, { size: sub.size, fill: palette.headerText });
  } else {
    svg += text(m + 20, m + bandH / 2 + title.size * 0.36, title.lines[0]!, {
      size: title.size,
      fill: palette.headerText,
      bold: true,
    });
  }

  const stripY = m + bandH + 6;
  const stripH = 24;
  svg += tag(
    'svg',
    { x: m, y: stripY, width: cw, height: stripH, viewBox: `0 0 ${fmt(cw)} ${stripH}`, overflow: 'hidden', 'aria-hidden': 'true' },
    headerDecorationSvg(theme, cw, stripH),
  );
  let bottom = stripY + stripH;

  const legend = input.legendKids ?? [];
  if (legend.length > 1) {
    const chipH = large ? 32 : 28;
    const size = large ? 15 : 13;
    let x = m;
    let y = bottom + 6;
    legend.forEach((kid, index) => {
      const label = truncateToWidth(kidName(kid, index), 240, size, true);
      const w = chipH + 10 + approxTextWidth(label, size, true) + 14;
      if (x + w > m + cw) {
        x = m;
        y += chipH + 6;
      }
      svg += tag('rect', { x, y, width: w, height: chipH, rx: chipH / 2, fill: palette.cellBg, stroke: KID_COLOR_HEX[kid.color], 'stroke-width': 3 });
      svg += image(ctx, kid.avatarIcon, x + 5, y + 3, chipH - 6);
      svg += text(x + chipH + 6, y + chipH / 2 + size * 0.36, label, { size, fill: palette.cellText, bold: true });
      x += w + 8;
    });
    bottom = y + chipH;
  }
  return { svg, bottom: bottom + 10 };
}

function footerTop(ctx: Ctx): number {
  return ctx.geo.height - ctx.geo.margin - 16;
}

function footer(ctx: Ctx): string {
  const { geo, theme } = ctx;
  return text(geo.width - geo.margin, geo.height - geo.margin - 3, 'chorechartmaker.com', {
    size: 9,
    fill: theme.palette.mutedText,
    anchor: 'end',
  });
}

function page(ctx: Ctx, title: string, body: string): string {
  const { geo, theme } = ctx;
  const units = ctx.config.paper === 'a4' ? 'mm' : 'in';
  const physical = (inches: number) => (units === 'mm' ? `${fmt(inches * 25.4)}mm` : `${fmt(inches)}in`);
  const style = ctx.options.fontCss ? tag('defs', {}, `<style>${ctx.options.fontCss.replace(/<\//g, '<\\/')}</style>`) : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg"${attrs({
      width: physical(geo.widthIn),
      height: physical(geo.heightIn),
      viewBox: `0 0 ${fmt(geo.width)} ${fmt(geo.height)}`,
      role: 'img',
      'aria-label': title,
      'font-family': FONT_FAMILY,
    })}>` +
    tag('title', {}, escapeXml(title)) +
    style +
    tag('rect', { x: 0, y: 0, width: geo.width, height: geo.height, fill: theme.palette.page, 'data-part': 'background' }) +
    body +
    footer(ctx) +
    '</svg>'
  );
}

function weekSubtitle(ctx: Ctx): string | undefined {
  if (!ctx.config.showDates) return undefined;
  const start = weekStartDate(ctx.config, ctx.today);
  return `Week of ${shortDate(start)}, ${start.getUTCFullYear()}`;
}

function joinSubtitle(...parts: (string | undefined)[]): string | undefined {
  const present = parts.filter((p): p is string => Boolean(p));
  return present.length ? present.join(' · ') : undefined;
}

// ---------------------------------------------------------------------------
// Chore × day table (weekly, routine, family)

type TableRow = { kind: 'chore'; chore: Chore } | { kind: 'blank' } | { kind: 'group'; label: string };

interface TableOptions {
  routine: boolean;
  stripes: boolean;
  kids: Kid[];
}

function choreDayTable(ctx: Ctx, top: number, rows: TableRow[], opts: TableOptions): string {
  const { config, geo, theme, large } = ctx;
  const { palette } = theme;
  const m = geo.margin;
  const cw = geo.width - m * 2;
  const landscape = config.orientation === 'landscape';
  const days = orderedDays(config);
  const choreRows = rows.filter((r) => r.kind === 'chore');
  const showPoints = choreRows.some((r) => r.kind === 'chore' && (r.chore.points ?? 0) > 0);
  const showAllowance =
    config.allowance.enabled && choreRows.some((r) => r.kind === 'chore' && (r.chore.allowance ?? 0) > 0);

  const labelW = cw * (landscape ? 0.34 : opts.routine ? 0.46 : 0.42);
  const pointsW = showPoints ? (large ? 64 : 54) : 0;
  const allowanceW = showAllowance ? (large ? 74 : 64) : 0;
  const dayW = (cw - labelW - pointsW - allowanceW) / days.length;
  const headH = (config.showDates ? 44 : 32) + (large ? 6 : 0);

  const bottom = footerTop(ctx) - 4;
  const groups = rows.filter((r) => r.kind === 'group').length;
  const units = rows.length - groups + groups * 0.7;
  const maxRow = opts.routine ? (large ? 100 : 88) : large ? 104 : 92;
  const rowH = Math.min(maxRow, (bottom - top - headH) / Math.max(units, 1));
  const groupH = rowH * 0.7;

  let svg = '';
  // Column header
  svg += tag('rect', { x: m, y: top, width: cw, height: headH, fill: palette.accent });
  const headSize = large ? 16 : 13;
  const headBase = config.showDates ? top + headH * 0.45 : top + headH / 2 + headSize * 0.36;
  svg += text(m + 12, top + headH / 2 + headSize * 0.36, opts.routine ? 'Routine' : 'Chores', {
    size: headSize,
    fill: palette.accentText,
    bold: true,
  });
  const weekStart = weekStartDate(config, ctx.today);
  days.forEach((day, i) => {
    const cx = m + labelW + dayW * i + dayW / 2;
    svg += text(cx, headBase, DAY_LABELS[day], { size: headSize, fill: palette.accentText, bold: true, anchor: 'middle' });
    if (config.showDates) {
      svg += text(cx, headBase + headSize + 2, shortDate(addDays(weekStart, i)), {
        size: large ? 12 : 10,
        fill: palette.accentText,
        anchor: 'middle',
      });
    }
  });
  const extraX = m + labelW + dayW * days.length;
  if (showPoints) {
    svg += text(extraX + pointsW / 2, top + headH / 2 + headSize * 0.36, 'Points', {
      size: Math.min(headSize, 12),
      fill: palette.accentText,
      bold: true,
      anchor: 'middle',
    });
  }
  if (showAllowance) {
    svg += text(extraX + pointsW + allowanceW / 2, top + headH / 2 + headSize * 0.36, CURRENCY_SYMBOLS[config.allowance.currency], {
      size: headSize,
      fill: palette.accentText,
      bold: true,
      anchor: 'middle',
    });
  }

  // Rows
  let y = top + headH;
  const lines: string[] = [];
  const kidById = new Map(opts.kids.map((kid) => [kid.id, kid]));
  rows.forEach((row, index) => {
    if (row.kind === 'group') {
      svg += tag('rect', { x: m, y, width: cw, height: groupH, fill: palette.accent });
      const size = Math.min(groupH * 0.55, large ? 20 : 17);
      svg += text(m + 12, y + groupH / 2 + size * 0.36, row.label, { size, fill: palette.accentText, bold: true });
      y += groupH;
      lines.push(segment(m, y, m + cw, y));
      return;
    }
    svg += tag('rect', { x: m, y, width: cw, height: rowH, fill: index % 2 === 0 ? palette.cellBg : palette.page });
    const chore = row.kind === 'chore' ? row.chore : undefined;

    // Assignee color stripes
    let labelX = m + 10;
    if (opts.stripes && chore && chore.assignees.length > 0) {
      const stripeH = (rowH - 6) / chore.assignees.length;
      chore.assignees.forEach((id, i) => {
        const kid = kidById.get(id);
        if (kid) svg += tag('rect', { x: m + 4, y: y + 3 + stripeH * i, width: 6, height: stripeH, fill: KID_COLOR_HEX[kid.color] });
      });
      labelX = m + 16;
    }

    if (chore) {
      const iconMax = opts.routine ? (large ? 64 : 54) : large ? 52 : 44;
      const icon = Math.max(0, Math.min(rowH - 8, iconMax));
      if (icon >= 10) {
        svg += image(ctx, chore.iconId, labelX, y + (rowH - icon) / 2, icon);
        labelX += icon + 8;
      }
      const maxSize = Math.min(rowH * 0.4, opts.routine ? (large ? 28 : 22) : large ? 26 : 20);
      const maxLines = rowH >= maxSize * 2.5 ? 2 : 1;
      const fitted = fitText(chore.label || ' ', m + labelW - labelX - 8, maxSize, Math.min(8, maxSize), large, maxLines);
      const lineH = fitted.size * 1.15;
      const firstBase = y + rowH / 2 - ((fitted.lines.length - 1) * lineH) / 2 + fitted.size * 0.36;
      fitted.lines.forEach((line, i) => {
        svg += text(labelX, firstBase + i * lineH, line, { size: fitted.size, fill: palette.cellText, bold: large });
      });
    } else {
      // Blank row for handwriting
      lines.push(segment(labelX, y + rowH * 0.72, m + labelW - 12, y + rowH * 0.72));
    }

    const box = Math.max(6, Math.min(rowH * 0.56, dayW * 0.62, large ? 34 : 28));
    days.forEach((day, i) => {
      const cx = m + labelW + dayW * i + dayW / 2;
      if (!chore || chore.days.includes(day)) svg += checkbox(ctx, cx, y + rowH / 2, box);
      else svg += text(cx, y + rowH / 2 + 4, '–', { size: 12, fill: palette.mutedText, anchor: 'middle' });
    });
    const valueSize = Math.min(rowH * 0.42, large ? 18 : 14);
    if (showPoints && chore?.points) {
      svg += text(extraX + pointsW / 2, y + rowH / 2 + valueSize * 0.36, String(chore.points), {
        size: valueSize,
        fill: palette.cellText,
        bold: true,
        anchor: 'middle',
      });
    }
    if (showAllowance && chore?.allowance) {
      svg += text(
        extraX + pointsW + allowanceW / 2,
        y + rowH / 2 + valueSize * 0.36,
        `${CURRENCY_SYMBOLS[config.allowance.currency]}${chore.allowance.toFixed(2)}`,
        { size: valueSize, fill: palette.cellText, bold: true, anchor: 'middle' },
      );
    }
    y += rowH;
    lines.push(segment(m, y, m + cw, y));
  });

  // Vertical lines between columns, then the frame
  const columnXs = [m + labelW, ...days.slice(1).map((_, i) => m + labelW + dayW * (i + 1))];
  if (showPoints || showAllowance) columnXs.push(extraX);
  if (showPoints && showAllowance) columnXs.push(extraX + pointsW);
  for (const x of columnXs) {
    lines.push(segment(x, top, x, y));
  }
  svg += gridPath(lines, palette.border);
  svg += frame(ctx, { x: m, y: top, w: cw, h: y - top });
  return svg;
}

function blankRows(count: number): TableRow[] {
  return Array.from({ length: count }, () => ({ kind: 'blank' }) as const);
}

function choresForKid(chores: Chore[], kid: Kid): Chore[] {
  return chores.filter((chore) => chore.assignees.length === 0 || chore.assignees.includes(kid.id));
}

function weeklyPage(ctx: Ctx, chores: Chore[], kids: Kid[], options: { focusKid?: { kid: Kid; index: number } } = {}): string {
  const focus = options.focusKid ?? (kids.length === 1 ? { kid: kids[0]!, index: 0 } : undefined);
  const head = header(ctx, {
    title: ctx.config.title,
    subtitle: joinSubtitle(focus ? kidName(focus.kid, focus.index) : undefined, weekSubtitle(ctx)),
    avatarKid: focus,
    legendKids: focus ? [] : kids,
  });
  const rows: TableRow[] = chores.length ? chores.map((chore) => ({ kind: 'chore', chore })) : blankRows(6);
  const body = head.svg + choreDayTable(ctx, head.bottom, rows, { routine: false, stripes: !focus && kids.length > 1, kids });
  return page(ctx, ctx.config.title, body);
}

function routinePage(ctx: Ctx): string {
  const { config } = ctx;
  const focus = config.kids.length === 1 ? { kid: config.kids[0]!, index: 0 } : undefined;
  const head = header(ctx, {
    title: config.title,
    subtitle: joinSubtitle(focus ? kidName(focus.kid, focus.index) : undefined, weekSubtitle(ctx)),
    avatarKid: focus,
    legendKids: focus ? [] : config.kids,
  });
  const rows: TableRow[] = [];
  for (const group of ROUTINE_GROUPS) {
    const chores = config.chores.filter((c) => c.timeOfDay === group.key);
    if (chores.length === 0) continue;
    rows.push({ kind: 'group', label: group.label });
    for (const chore of chores) rows.push({ kind: 'chore', chore });
  }
  const body =
    head.svg +
    choreDayTable(ctx, head.bottom, rows.length ? rows : blankRows(6), { routine: true, stripes: !focus, kids: config.kids });
  return page(ctx, config.title, body);
}

// ---------------------------------------------------------------------------
// Reward chart

function rewardPage(ctx: Ctx, focus?: { kid: Kid; index: number }): string {
  const { config, geo, theme, large } = ctx;
  const { palette } = theme;
  const m = geo.margin;
  const cw = geo.width - m * 2;
  const head = header(ctx, {
    title: config.title,
    subtitle: focus ? kidName(focus.kid, focus.index) : undefined,
    avatarKid: focus,
  });
  let y = head.bottom;
  let svg = head.svg;

  // Prize box
  const prizeH = large ? 74 : 64;
  svg += tag('rect', { x: m, y, width: cw, height: prizeH, rx: theme.border.radius, fill: palette.accent });
  const giftSize = prizeH - 18;
  svg += image(ctx, 'reward-gift', m + 12, y + 9, giftSize);
  const prize = config.reward.prizeText || '________________';
  const prizeLine = fitText(`My reward: ${prize}`, cw - giftSize - 40, large ? 26 : 22, 11, true);
  svg += text(m + giftSize + 24, y + prizeH * 0.45, prizeLine.lines[0]!, { size: prizeLine.size, fill: palette.accentText, bold: true });
  svg += text(m + giftSize + 24, y + prizeH * 0.45 + (large ? 22 : 19), `Collect ${config.reward.goal} stickers to earn it!`, {
    size: large ? 16 : 13,
    fill: palette.accentText,
  });
  y += prizeH + 12;

  // What earns a sticker
  const chores = focus ? choresForKid(config.chores, focus.kid) : config.chores;
  if (chores.length) {
    const size = large ? 16 : 13;
    svg += text(m, y + size, 'Earn a sticker for:', { size, fill: palette.text, bold: true });
    y += size + 8;
    const cols = cw > 600 ? 3 : 2;
    const maxRows = Math.min(Math.ceil(chores.length / cols), 4);
    const itemH = large ? 30 : 26;
    const colW = cw / cols;
    chores.slice(0, cols * maxRows).forEach((chore, i) => {
      const x = m + (i % cols) * colW;
      const iy = y + Math.floor(i / cols) * itemH;
      svg += image(ctx, chore.iconId, x, iy + 2, itemH - 4);
      const label = fitText(chore.label || ' ', colW - itemH - 12, large ? 15 : 13, 8);
      svg += text(x + itemH + 4, iy + itemH / 2 + label.size * 0.36, label.lines[0]!, { size: label.size, fill: palette.text });
    });
    y += maxRows * itemH + 10;
  }

  // Sticker grid
  const goal = config.reward.goal;
  const area: Box = { x: m, y, w: cw, h: footerTop(ctx) - 6 - y };
  const cols = Math.max(1, Math.min(goal, Math.ceil(Math.sqrt((goal * area.w) / Math.max(area.h, 1)))));
  const rowsCount = Math.ceil(goal / cols);
  const cell = Math.min(area.w / cols, area.h / rowsCount);
  const gridX = area.x + (area.w - cell * cols) / 2;
  const gridY = area.y + (area.h - cell * rowsCount) / 2;
  for (let i = 0; i < goal; i++) {
    const cx = gridX + (i % cols) * cell;
    const cy = gridY + Math.floor(i / cols) * cell;
    const numberSize = 18;
    svg += tag(
      'svg',
      { x: cx, y: cy, width: cell, height: cell, viewBox: '0 0 100 100', 'data-part': 'sticker' },
      tag('path', {
        d: stickerPath(theme.sticker, 50, 50, 84),
        fill: palette.cellBg,
        stroke: palette.stickerStroke,
        'stroke-width': 4,
        'stroke-linejoin': 'round',
      }) + text(50, 50 + numberSize * 0.36, String(i + 1), { size: numberSize, fill: palette.mutedText, bold: true, anchor: 'middle' }),
    );
  }
  svg += frame(ctx, { x: area.x, y: area.y - 4, w: area.w, h: area.h + 8 });
  return page(ctx, config.title, svg);
}

// ---------------------------------------------------------------------------
// Rotation chart

function rotationPage(ctx: Ctx): string {
  const { config, geo, theme, large } = ctx;
  const { palette } = theme;
  const m = geo.margin;
  const cw = geo.width - m * 2;
  const people: { kid?: Kid; label: string }[] = config.kids.length
    ? config.kids.map((kid, i) => ({ kid, label: kidName(kid, i) }))
    : [{ label: 'Person 1' }, { label: 'Person 2' }];
  const weeks = rotationWeeks(people.length);
  const schedule = rotationSchedule(config.chores.length, people.length, weeks);
  const head = header(ctx, { title: config.title, subtitle: weekSubtitle(ctx) });
  let svg = head.svg;
  const top = head.bottom;

  const weekColW = config.showDates ? (large ? 128 : 112) : large ? 96 : 84;
  const personW = (cw - weekColW) / people.length;
  const headH = large ? 52 : 44;
  const bottom = footerTop(ctx) - 4;
  const rowH = (bottom - top - headH) / weeks;

  svg += tag('rect', { x: m, y: top, width: cw, height: headH, fill: palette.accent });
  const headSize = large ? 16 : 13;
  svg += text(m + 10, top + headH / 2 + headSize * 0.36, 'Week', { size: headSize, fill: palette.accentText, bold: true });
  people.forEach((person, i) => {
    const x = m + weekColW + personW * i;
    let labelX = x + 8;
    if (person.kid) {
      const avatar = Math.min(headH - 12, 32);
      svg += image(ctx, person.kid.avatarIcon, labelX, top + (headH - avatar) / 2, avatar);
      labelX += avatar + 6;
    }
    const label = fitText(person.label, x + personW - labelX - 6, headSize, 8, true);
    svg += text(labelX, top + headH / 2 + label.size * 0.36, label.lines[0]!, { size: label.size, fill: palette.accentText, bold: true });
  });

  const start = weekStartDate(config, ctx.today);
  const maxLines = Math.max(1, ...schedule.flatMap((week) => week.map((cell) => cell.length)));
  const lineH = Math.min((rowH - 8) / maxLines, large ? 32 : 26);
  const lineSize = Math.max(6, Math.min(lineH * 0.6, large ? 18 : 14));
  const lines: string[] = [];
  schedule.forEach((week, w) => {
    const y = top + headH + rowH * w;
    svg += tag('rect', { x: m, y, width: cw, height: rowH, fill: w % 2 === 0 ? palette.cellBg : palette.page });
    const weekLabel = config.showDates
      ? `${shortDate(addDays(start, w * 7))} – ${shortDate(addDays(start, w * 7 + 6))}`
      : `Week ${w + 1}`;
    const weekText = fitText(weekLabel, weekColW - 14, large ? 16 : 13, 7, true);
    svg += text(m + 10, y + 8 + weekText.size, weekText.lines[0]!, { size: weekText.size, fill: palette.cellText, bold: true });
    week.forEach((choreIndexes, p) => {
      const x = m + weekColW + personW * p;
      choreIndexes.forEach((choreIndex, line) => {
        const chore = config.chores[choreIndex]!;
        const ly = y + 4 + line * lineH;
        const box = Math.min(lineH * 0.6, 16);
        svg += checkbox(ctx, x + 6 + box / 2, ly + lineH / 2, box);
        let labelX = x + 12 + box;
        const icon = lineH - 4;
        if (icon >= 10) {
          svg += image(ctx, chore.iconId, labelX, ly + 2, icon);
          labelX += icon + 4;
        }
        const label = fitText(chore.label || ' ', x + personW - labelX - 6, lineSize, Math.min(6, lineSize));
        svg += text(labelX, ly + lineH / 2 + label.size * 0.36, label.lines[0]!, { size: label.size, fill: palette.cellText });
      });
      lines.push(segment(x, top, x, top + headH + rowH * weeks));
    });
    lines.push(segment(m, y + rowH, m + cw, y + rowH));
  });
  svg += gridPath(lines, palette.border);
  svg += frame(ctx, { x: m, y: top, w: cw, h: headH + rowH * weeks });
  return page(ctx, config.title, svg);
}

// ---------------------------------------------------------------------------
// Entry points

/** Renders every page of the chart (one per kid for reward and per-kid family charts). */
export function renderChartPages(config: ChartConfig, options: RenderOptions): string[] {
  const base = getTheme(config.theme);
  const ctx: Ctx = {
    config,
    theme: config.inkSaver ? applyInkSaver(base) : base,
    geo: pageGeometry(config),
    options,
    large: config.largeText,
    today: options.today ?? new Date(),
  };
  const kids = config.kids;
  switch (config.type) {
    case 'weekly':
      return [weeklyPage(ctx, config.chores, kids)];
    case 'routine':
      return [routinePage(ctx)];
    case 'family':
      if (config.familyLayout === 'perKid' && kids.length > 1) {
        return kids.map((kid, index) => weeklyPage(ctx, choresForKid(config.chores, kid), kids, { focusKid: { kid, index } }));
      }
      return [weeklyPage(ctx, config.chores, kids)];
    case 'reward':
      return kids.length ? kids.map((kid, index) => rewardPage(ctx, { kid, index })) : [rewardPage(ctx)];
    case 'rotation':
      return [rotationPage(ctx)];
  }
}

/** The first page only; convenient for previews of single-page charts. */
export function renderChart(config: ChartConfig, options: RenderOptions): string {
  return renderChartPages(config, options)[0]!;
}
