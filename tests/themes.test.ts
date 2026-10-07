import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AA_GRAPHICS, AA_TEXT, contrastRatio, parseHex } from '../src/lib/color.ts';
import { THEMES, TEXT_PAIRS, applyInkSaver, borderDashArray, headerDecorationSvg, stickerPath, type ChartTheme } from '../src/lib/themes.ts';
import { THEMES as THEME_IDS } from '../src/lib/types.ts';

const allThemes = Object.values(THEMES);
const variants = (theme: ChartTheme) => [
  { label: theme.id, theme },
  { label: `${theme.id} (ink saver)`, theme: applyInkSaver(theme) },
];

test('contrastRatio matches known WCAG values', () => {
  assert.equal(Math.round(contrastRatio('#000000', '#ffffff') * 10) / 10, 21);
  assert.equal(contrastRatio('#777777', '#777777'), 1);
  assert.equal(Math.round(contrastRatio('#767676', '#ffffff') * 100) / 100, 4.54);
  assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 });
  assert.throws(() => parseHex('red'));
});

test('there are exactly the 12 themes listed in types.ts, each complete', () => {
  assert.deepEqual(Object.keys(THEMES), [...THEME_IDS]);
  assert.equal(allThemes.length, 12);
  for (const theme of allThemes) {
    assert.ok(theme.name && theme.description, `${theme.id} needs a name and description`);
    for (const [key, value] of Object.entries(theme.palette)) {
      for (const color of Array.isArray(value) ? value : [value]) {
        assert.doesNotThrow(() => parseHex(color as string), `${theme.id}.${key} = ${String(color)}`);
      }
    }
  }
});

test('every text/background pair meets WCAG AA (4.5:1), including ink-saver variants', () => {
  for (const theme of allThemes) {
    for (const { label, theme: t } of variants(theme)) {
      for (const [fg, bg] of TEXT_PAIRS) {
        const ratio = contrastRatio(t.palette[fg], t.palette[bg]);
        assert.ok(ratio >= AA_TEXT, `${label}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
});

test('sticker outlines stay visible on the page and in cells (3:1)', () => {
  for (const theme of allThemes) {
    for (const { label, theme: t } of variants(theme)) {
      for (const bg of ['page', 'cellBg'] as const) {
        const ratio = contrastRatio(t.palette.stickerStroke, t.palette[bg]);
        assert.ok(ratio >= AA_GRAPHICS, `${label}: sticker outline on ${bg} is ${ratio.toFixed(2)}:1`);
      }
    }
  }
});

test('the minimal theme and ink-saver variants are white with dark text', () => {
  for (const theme of [THEMES.minimal, ...allThemes.map(applyInkSaver)]) {
    assert.equal(theme.inkSaver, true);
    for (const key of ['page', 'cellBg', 'headerBg', 'accent'] as const) {
      assert.equal(theme.palette[key], '#ffffff', `${theme.id} ink saver ${key}`);
    }
    assert.equal(theme.decoration, 'rule');
  }
});

test('sticker shapes produce closed, finite path data', () => {
  const shapes = new Set(allThemes.map((t) => t.sticker));
  assert.equal(shapes.size, allThemes.length, 'each theme has its own sticker shape');
  for (const shape of shapes) {
    const d = stickerPath(shape, 50, 50, 40);
    assert.match(d, /^M[\d.\- ]/, `${shape} starts with M`);
    assert.match(d, /Z$/, `${shape} is closed`);
    assert.doesNotMatch(d, /NaN|Infinity|undefined/, `${shape} has invalid numbers`);
  }
});

test('header decorations are deterministic, safe SVG made of simple shapes', () => {
  for (const theme of allThemes) {
    for (const [w, h] of [[600, 40], [300, 24], [10, 10]] as const) {
      const svg = headerDecorationSvg(theme, w, h);
      assert.ok(svg.length > 0, `${theme.id} renders nothing at ${w}x${h}`);
      assert.equal(svg, headerDecorationSvg(theme, w, h), `${theme.id} is not deterministic`);
      assert.doesNotMatch(svg, /NaN|Infinity|undefined/, `${theme.id} has invalid numbers`);
      assert.doesNotMatch(svg, /<(?:script|image|text|use|foreignObject)|href=|url\(/i, `${theme.id} uses non-shape SVG`);
      for (const tag of svg.matchAll(/<(\w+)/g)) {
        assert.ok(['circle', 'rect', 'path', 'g', 'ellipse', 'line'].includes(tag[1]!), `${theme.id} uses <${tag[1]}>`);
      }
    }
  }
});

test('border dash arrays match the border style', () => {
  for (const theme of allThemes) {
    const dash = borderDashArray(theme.border);
    if (theme.border.style === 'solid' || theme.border.style === 'double') assert.equal(dash, undefined);
    else assert.match(dash ?? '', /^[\d.]+ [\d.]+$/);
  }
});

test('site color tokens in global.css meet WCAG AA in light and dark mode', () => {
  const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  const tokenBlock = (start: number) => {
    const block = css.slice(start, css.indexOf('}', start));
    return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})/gi)].map((m) => [m[1]!, m[2]!]));
  };
  const light = tokenBlock(css.indexOf(':root {'));
  const dark = tokenBlock(css.indexOf(':root {', css.indexOf('prefers-color-scheme: dark')));
  const pairs = [
    ['fg', 'bg', AA_TEXT],
    ['fg', 'surface', AA_TEXT],
    ['muted', 'bg', AA_TEXT],
    ['muted', 'surface', AA_TEXT],
    ['brand', 'bg', AA_TEXT],
    ['brand', 'surface', AA_TEXT],
    ['brand-fg', 'brand', AA_TEXT],
    ['brand-fg', 'brand-strong', AA_TEXT],
    ['focus', 'bg', AA_GRAPHICS],
  ] as const;
  for (const [mode, tokens] of [['light', light], ['dark', dark]] as const) {
    for (const [fg, bg, min] of pairs) {
      assert.ok(tokens[fg] && tokens[bg], `${mode}: missing --${fg} or --${bg}`);
      const ratio = contrastRatio(tokens[fg]!, tokens[bg]!);
      assert.ok(ratio >= min, `${mode}: --${fg} on --${bg} is ${ratio.toFixed(2)}:1`);
    }
  }
});
