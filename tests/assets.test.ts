// Icon files, icon manifest and self-hosted font.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { ALL_ICON_IDS, AVATAR_ICON_IDS, REWARD_ICON_IDS } from '../src/lib/icons.ts';
import { ICON_MANIFEST, iconImgAttrs } from '../src/lib/iconManifest.ts';
import { CHORE_LIBRARY } from '../src/lib/choreLibrary.ts';

const PUBLIC = new URL('../public/', import.meta.url);
const MAX_ICON_BYTES = 8 * 1024;
const MAX_ICON_SET_BYTES = 200 * 1024;

test('the manifest has exactly one entry per icon id', () => {
  assert.deepEqual(Object.keys(ICON_MANIFEST).sort(), [...ALL_ICON_IDS].sort());
  assert.equal(new Set(ALL_ICON_IDS).size, ALL_ICON_IDS.length, 'duplicate icon ids');
  assert.equal(AVATAR_ICON_IDS.length, 16);
  assert.ok(REWARD_ICON_IDS.length >= 8);
  for (const chore of CHORE_LIBRARY) assert.ok(ICON_MANIFEST[chore.iconId], `${chore.id} icon missing from manifest`);
});

test('every manifest entry points at an optimized, safe SVG with alt text', () => {
  let total = 0;
  for (const [id, entry] of Object.entries(ICON_MANIFEST)) {
    assert.equal(entry.path, `/icons/${id}.svg`);
    assert.ok(entry.alt.trim().length > 0 && entry.alt.length <= 40, `${id} alt text`);
    const file = new URL(`.${entry.path}`, PUBLIC);
    assert.ok(existsSync(file), `${entry.path} is missing`);
    const svg = readFileSync(file, 'utf8');
    const bytes = statSync(file).size;
    total += bytes;
    assert.ok(bytes <= MAX_ICON_BYTES, `${entry.path} is ${bytes} bytes`);
    assert.match(svg, /^<svg[^>]*viewBox="0 0 32 32"/, `${entry.path} must be a 32×32 viewBox SVG`);
    assert.doesNotMatch(svg, /<script|\son\w+=|<foreignObject|href="(?!#)/i, `${entry.path} has unsafe content`);
    assert.doesNotMatch(svg, /\n\s|<!--|<metadata|xmlns:(?!xlink)/, `${entry.path} is not optimized`);
  }
  assert.ok(total <= MAX_ICON_SET_BYTES, `icon set is ${total} bytes`);
});

test('public/icons contains only manifest icons plus the license', () => {
  const files = readdirSync(new URL('icons/', PUBLIC));
  const expected = new Set([...ALL_ICON_IDS.map((id) => `${id}.svg`), 'LICENSE.txt']);
  assert.deepEqual(files.filter((f) => !expected.has(f)), [], 'unexpected files');
  const license = readFileSync(new URL('icons/LICENSE.txt', PUBLIC), 'utf8');
  assert.match(license, /Fluent Emoji/);
  assert.match(license, /MIT License/);
});

test('iconImgAttrs builds a lazy, sized <img>', () => {
  assert.deepEqual(iconImgAttrs('broom'), {
    src: '/icons/broom.svg',
    alt: ICON_MANIFEST.broom.alt,
    width: 32,
    height: 32,
    loading: 'lazy',
    decoding: 'async',
  });
  assert.equal(iconImgAttrs('broom', 48, '').alt, '');
});

test('the self-hosted font is a small Latin woff2 set with an OFL license', () => {
  const fonts = readdirSync(new URL('fonts/', PUBLIC)).filter((f) => f.endsWith('.woff2'));
  assert.deepEqual(fonts.sort(), ['nunito-latin-400-normal.woff2', 'nunito-latin-700-normal.woff2']);
  for (const font of fonts) {
    const data = readFileSync(new URL(`fonts/${font}`, PUBLIC));
    assert.equal(data.subarray(0, 4).toString('latin1'), 'wOF2', `${font} is not woff2`);
    assert.ok(data.length <= 30 * 1024, `${font} is ${data.length} bytes; is it subset?`);
  }
  assert.match(readFileSync(new URL('fonts/LICENSE.txt', PUBLIC), 'utf8'), /SIL OPEN FONT LICENSE/i);

  const css = readFileSync(new URL('../src/styles/global.css', import.meta.url), 'utf8');
  const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]!).filter((f) => /'Nunito'/.test(f));
  assert.equal(faces.length, fonts.length, 'one @font-face per font file');
  for (const face of faces) {
    assert.match(face, /font-display:\s*swap/, 'font-display: swap');
    assert.match(face, /unicode-range:/, 'unicode-range for the Latin subset');
  }
});
