// Editor markup, export helpers and presets as the editor uses them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import { XMLValidator } from 'fast-xml-parser';
import { choreListHtml, kidListHtml, renderPreviewHtml, suggestionAge, suggestionChipsHtml } from '../src/lib/editorMarkup.ts';
import { exportFileName, setPngDpi } from '../src/lib/exportUtils.ts';
import { PAGE_PRESETS, PRESET_IDS, getPreset } from '../src/lib/presets.ts';
import { validateConfig } from '../src/lib/state.ts';

const hostile = validateConfig({
  type: 'family',
  kids: [
    { id: 'a', name: '<img src=x onerror>', age: 7 },
    { id: 'b', name: '"quoted" & \'single\'' },
  ],
  chores: [
    { label: '</li><script>alert(1)</script>', iconId: 'bed', assignees: ['a'] },
    { label: 'Feed "Rex" & co', iconId: 'pet-bowl', assignees: ['a', 'b'], points: 5 },
  ],
  allowance: { enabled: true, currency: 'USD' },
});

function allMarkup(config = hostile): string {
  return [kidListHtml(config), choreListHtml(config), suggestionChipsHtml(6, config)].join('');
}

test('editor markup escapes all user text', () => {
  const html = allMarkup();
  assert.doesNotMatch(html, /<script|<img src=x/);
  assert.ok(html.includes('&lt;img src=x onerror&gt;'));
  assert.ok(html.includes('&quot;quoted&quot; &amp; &#39;single&#39;'));
  assert.ok(html.includes('&lt;/li&gt;&lt;script&gt;'));
  // Well-formed enough to parse as XML once void elements are closed.
  const xml = `<root>${html.replace(/<(input|img)([^>]*?)>/g, '<$1$2/>').replace(/ (checked|disabled|selected|readonly|hidden|draggable|data-[\w-]+)(?=[ />])/g, ' $1="$1"')}</root>`;
  assert.equal(XMLValidator.validate(xml), true);
});

test('editor markup uses no heading tags and labels every control', () => {
  const html = allMarkup();
  assert.doesNotMatch(html, /<h[1-6][\s>]/, 'no headings inside the tool');
  for (const match of html.matchAll(/<(input|select)\b([^>]*)>/g)) {
    const attrs = match[2]!;
    const id = /\sid="([^"]+)"/.exec(attrs)?.[1];
    const before = html.slice(0, match.index);
    const insideLabel = before.lastIndexOf('<label') > before.lastIndexOf('</label>');
    const labelled = /\saria-label="[^"]+"/.test(attrs) || insideLabel || (id !== undefined && html.includes(`for="${id}"`));
    assert.ok(labelled, `unlabelled control: ${match[0]}`);
  }
  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    const name = /\saria-label="[^"]+"/.test(match[1]!) || /[A-Za-z]/.test(match[2]!.replace(/<[^>]+>/g, ''));
    assert.ok(name, `button without an accessible name: ${match[0].slice(0, 120)}`);
  }
});

test('touch targets use the 44px button, chip and day classes', () => {
  const html = allMarkup();
  for (const match of html.matchAll(/<button\b[^>]*class="([^"]+)"/g)) {
    assert.match(match[1]!, /\bccm-(?:btn|chip)\b/, `button without a 44px class: ${match[0]}`);
  }
  assert.ok((html.match(/class="ccm-day"/g) ?? []).length === hostile.chores.length * 7);
});

test('editor icons are lazy external images', () => {
  const html = allMarkup();
  for (const match of html.matchAll(/<img\b[^>]*>/g)) {
    assert.match(match[0], /src="\/icons\/[\w-]+\.svg"/);
    assert.match(match[0], /loading="lazy"/);
  }
  assert.doesNotMatch(html, /<svg/, 'icons are never inlined');
});

test('suggestions follow the age and skip chores already on the chart', () => {
  const config = getPreset('age-5')!;
  assert.equal(suggestionAge(config), 5);
  const chips = suggestionChipsHtml(5, config);
  for (const chore of config.chores) assert.ok(!chips.includes(`>${chore.label}<`), `${chore.label} suggested twice`);
  assert.ok((chips.match(/data-action="add-library-chore"/g) ?? []).length > 0);
  assert.ok(!suggestionChipsHtml(3, config).includes('Mow the lawn'));
});

test('every landing page preset renders a ready-made chart preview', () => {
  for (const [path, presetId] of Object.entries(PAGE_PRESETS)) {
    const config = getPreset(presetId);
    assert.ok(config, `${path}: preset ${presetId}`);
    const preview = renderPreviewHtml(config);
    assert.match(preview, /^<div class="ccm-page"><svg /, `${path}: preview`);
    assert.ok(config.chores.length > 0, `${path}: preset has chores so first-time visitors see a finished chart`);
  }
  assert.ok(PRESET_IDS.length >= 10);
});

test('export file names follow chore-chart-[name]-[date]', () => {
  const date = new Date(2026, 9, 6);
  assert.equal(exportFileName(validateConfig({ kids: [{ name: 'Zoë Ann' }] }), 'pdf', date), 'chore-chart-zoe-ann-2026-10-06.pdf');
  assert.equal(exportFileName(validateConfig({ title: 'Family Jobs!' }), 'png', date), 'chore-chart-family-jobs-2026-10-06.png');
  assert.equal(exportFileName(validateConfig({ title: '日本' }), 'pdf', date), 'chore-chart-chart-2026-10-06.pdf');
  assert.equal(exportFileName(validateConfig({ kids: [{ name: '../../etc' }] }), 'pdf', date), 'chore-chart-etc-2026-10-06.pdf');
  assert.equal(exportFileName(validateConfig({ kids: [{ name: 'Ava' }] }), 'png', date, 'Ben'), 'chore-chart-ava-ben-2026-10-06.png');
});

test('setPngDpi inserts a valid pHYs chunk after IHDR', () => {
  // Minimal 1×1 PNG.
  const png = Uint8Array.from(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    ),
  );
  const out = Buffer.from(setPngDpi(png, 300));
  assert.equal(out.length, png.length + 21);
  assert.equal(out.subarray(37, 41).toString('latin1'), 'pHYs');
  assert.equal(out.readUInt32BE(41), 11811, '300 dpi in pixels per meter');
  assert.equal(out.readUInt32BE(45), 11811);
  assert.equal(out[49], 1);
  assert.equal(out.readUInt32BE(50), crc32(out.subarray(37, 50)), 'chunk CRC');
  assert.throws(() => setPngDpi(new Uint8Array(10), 300));
});
