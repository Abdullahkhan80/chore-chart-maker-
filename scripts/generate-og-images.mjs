// Generates a 1200×630 social (Open Graph) image for each main page into public/og/.
// Each card shows the page's H1 next to a real preview of the chart preset that page opens with,
// drawn by src/lib/renderChart.ts in the self-hosted Nunito font.
// Run: node --experimental-strip-types scripts/generate-og-images.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC = join(ROOT, 'public');

// Point fontconfig (used by sharp's librsvg) at the bundled Nunito TTFs. Native code only sees
// environment variables present at process start (notably on Windows), so re-run with it set.
if (!process.env.CCM_OG_FONTCONFIG) {
  const fontDir = join(PUBLIC, 'fonts', 'pdf').replaceAll('\\', '/');
  const fontConf = join(tmpdir(), 'ccm-og-fonts.conf');
  writeFileSync(
    fontConf,
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${fontDir}</dir>` +
      `<cachedir>${join(tmpdir(), 'ccm-og-fontcache').replaceAll('\\', '/')}</cachedir></fontconfig>`,
  );
  const child = spawnSync(process.execPath, [...process.execArgv, fileURLToPath(import.meta.url)], {
    env: { ...process.env, FONTCONFIG_FILE: fontConf, CCM_OG_FONTCONFIG: '1' },
    stdio: 'inherit',
  });
  process.exit(child.status ?? 1);
}

const { default: sharp } = await import('sharp');
const { ogImagePages, pageOgImagePath, PAGES } = await import('../src/lib/pages.ts');
const { PAGE_PRESETS, getPreset } = await import('../src/lib/presets.ts');
const { renderChart, pageGeometry, approxTextWidth, escapeXml } = await import('../src/lib/renderChart.ts');
const { ICON_MANIFEST } = await import('../src/lib/iconManifest.ts');

const WIDTH = 1200;
const HEIGHT = 630;
const BRAND = '#0f766e';
const INK = '#134e4a';
const MUTED = '#3f6b66';
const BG = '#f0fdfa';
const FONT = 'Nunito';
// A fixed date keeps the images identical between runs.
const TODAY = new Date('2026-10-05T12:00:00Z');

/** Presets for pages that do not open the editor themselves. */
const EXTRA_PRESETS = { [PAGES.home.path]: 'family', [PAGES.choresByAge.path]: 'age-6' };

const iconCache = new Map();
function iconDataUri(id) {
  if (!iconCache.has(id)) {
    const svg = readFileSync(join(PUBLIC, ICON_MANIFEST[id].path));
    iconCache.set(id, `data:image/svg+xml;base64,${svg.toString('base64')}`);
  }
  return iconCache.get(id);
}

/** Greedy word wrap using the renderer's Nunito width estimates. */
function wrap(text, size, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && approxTextWidth(next, size, true) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest headline size (72 → 44 px) that fits in three lines. */
function fitHeadline(text, maxWidth) {
  for (let size = 72; size >= 44; size -= 4) {
    const lines = wrap(text, size, maxWidth);
    if (lines.length <= 3) return { size, lines };
  }
  return { size: 44, lines: wrap(text, 44, maxWidth).slice(0, 3) };
}

/** The H1 with a capital first letter. */
function headline(page) {
  return page.h1.charAt(0).toUpperCase() + page.h1.slice(1);
}

function cardSvg(page) {
  const presetId = PAGE_PRESETS[page.path] ?? EXTRA_PRESETS[page.path] ?? 'weekly';
  const config = getPreset(presetId);
  if (!config) throw new Error(`Unknown preset ${presetId} for ${page.path}`);

  // Chart preview: the real first page, scaled into a paper card on the right.
  const geo = pageGeometry(config);
  const box = { x: 668, y: 44, w: 492, h: 542 };
  const scale = Math.min(box.w / geo.width, box.h / geo.height);
  const cw = Math.round(geo.width * scale);
  const ch = Math.round(geo.height * scale);
  const cx = box.x + Math.round((box.w - cw) / 2);
  const cy = box.y + Math.round((box.h - ch) / 2);
  const chart = renderChart(config, { iconResolver: iconDataUri, today: TODAY }).replace(/^<svg\b[^>]*>/, (tag) =>
    tag.replace(/\s(?:width|height)="[^"]*"/g, '').replace(/^<svg/, `<svg x="${cx}" y="${cy}" width="${cw}" height="${ch}"`),
  );

  const { size, lines } = fitHeadline(headline(page), 540);
  const lineHeight = Math.round(size * 1.12);
  const blockTop = 315 - (lines.length * lineHeight) / 2 + size * 0.8;
  const headlineText = lines
    .map((line, i) => `<text x="64" y="${Math.round(blockTop + i * lineHeight)}" font-size="${size}" font-weight="700" fill="${INK}">${escapeXml(line)}</text>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="${FONT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${BG}"/>
  <rect x="0" y="0" width="12" height="${HEIGHT}" fill="${BRAND}"/>
  <g transform="translate(64 60)">
    <rect width="52" height="52" rx="11" fill="${BRAND}"/>
    <polyline points="14.6,26.8 22.8,34.9 38.2,17.9" fill="none" stroke="#ffffff" stroke-width="5.8" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="68" y="36" font-size="30" font-weight="700" fill="${BRAND}">Chore Chart Maker</text>
  </g>
  ${headlineText}
  <text x="64" y="530" font-size="28" fill="${MUTED}">Free · Printable · No sign-up</text>
  <text x="64" y="572" font-size="24" font-weight="700" fill="${BRAND}">chorechartmaker.com</text>
  <rect x="${cx + 8}" y="${cy + 10}" width="${cw}" height="${ch}" rx="4" fill="#0f766e" opacity="0.18"/>
  <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="#ffffff"/>
  ${chart}
  <rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="none" stroke="#99d6cd" stroke-width="2"/>
</svg>`;
}

mkdirSync(join(PUBLIC, 'og'), { recursive: true });
for (const page of ogImagePages()) {
  const path = pageOgImagePath(page);
  const png = await sharp(Buffer.from(cardSvg(page)))
    .resize(WIDTH, HEIGHT)
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
  writeFileSync(join(PUBLIC, path), png);
  console.log(`${path} ${(png.length / 1024).toFixed(0)} KB`);
}
