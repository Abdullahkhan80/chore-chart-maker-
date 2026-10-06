// Privacy audit: analytics can only carry categorical values, and nothing in the
// app sends chart content anywhere. Scans the source, so new code is covered too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANALYTICS_EVENTS, sanitizeEvent, setAnalyticsTransport, trackEvent, type AnalyticsParams } from '../src/lib/analytics.ts';

const SRC = fileURLToPath(new URL('../src/', import.meta.url));
const ALLOWED_PARAM_KEYS = new Set(['chart_type', 'theme', 'paper', 'orientation']);
// A param value may only read a categorical config field, or be a string literal.
const ALLOWED_VALUE = /^(?:[\w$]+(?:\.[\w$]+)*\.(?:type|theme|paper|orientation)|'[a-z_]+')$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|astro|js|mjs)$/.test(name) ? [full] : [];
  });
}

// Browser code only: src/worker.ts is the server that serves the static site.
const files = sourceFiles(SRC)
  .filter((file) => !file.endsWith(`${sep}worker.ts`))
  .map((file) => ({ file: relative(SRC, file).split(sep).join('/'), text: readFileSync(file, 'utf8') }));

/** Arguments of each call to `name(` in `text`, split at top-level commas. */
function callArguments(text: string, name: string): string[][] {
  const calls: string[][] = [];
  const pattern = new RegExp(`(?<![\\w.])${name}\\(`, 'g');
  for (const match of text.matchAll(pattern)) {
    let depth = 0;
    let current = '';
    const args: string[] = [];
    for (let i = match.index! + match[0].length; i < text.length; i++) {
      const char = text[i]!;
      if ('([{'.includes(char)) depth++;
      if (')]}'.includes(char)) {
        if (depth === 0) break;
        depth--;
      }
      if (char === ',' && depth === 0) {
        args.push(current.trim());
        current = '';
      } else current += char;
    }
    if (current.trim()) args.push(current.trim());
    calls.push(args);
  }
  return calls;
}

test('sanitizeEvent keeps only allowed events, params and categorical values', () => {
  assert.equal(sanitizeEvent('page_view', {}), null);
  assert.equal(sanitizeEvent('__proto__', {}), null);
  assert.equal(sanitizeEvent(42, {}), null);
  assert.deepEqual(sanitizeEvent('export_pdf', { chart_type: 'weekly', theme: 'ocean', paper: 'a4', orientation: 'portrait' }), {
    name: 'export_pdf',
    params: { chart_type: 'weekly', theme: 'ocean', paper: 'a4', orientation: 'portrait' },
  });
  assert.deepEqual(
    sanitizeEvent('chart_created', { chart_type: 'Emma Smith', kid_name: 'Emma', title: 'My chart', theme: 'ocean' }),
    { name: 'chart_created', params: {} },
    'free text, unknown keys and keys not listed for the event are dropped',
  );
  assert.deepEqual(sanitizeEvent('theme_selected', null), { name: 'theme_selected', params: {} });
});

test('trackEvent only ever hands sanitized events to the transport', () => {
  const sent: unknown[] = [];
  setAnalyticsTransport((name, params) => sent.push({ name, params }));
  try {
    trackEvent('share_link_copied', { chart_type: 'family' });
    trackEvent('share_link_copied', { chart_type: 'Grandma’s house' as never });
    trackEvent('not_an_event' as never, {});
    trackEvent('theme_selected', { theme: 'space', chart_type: 'weekly' } as AnalyticsParams);
    assert.deepEqual(sent, [
      { name: 'share_link_copied', params: { chart_type: 'family' } },
      { name: 'share_link_copied', params: {} },
      { name: 'theme_selected', params: { theme: 'space' } },
    ]);
    setAnalyticsTransport(() => {
      throw new Error('provider down');
    });
    assert.doesNotThrow(() => trackEvent('print', {}), 'analytics errors never break the tool');
  } finally {
    setAnalyticsTransport(() => {});
  }
});

test('every trackEvent() call uses an allowed event and categorical params only', () => {
  let calls = 0;
  for (const { file, text } of files) {
    if (file === 'lib/analytics.ts') continue;
    for (const args of callArguments(text, 'trackEvent')) {
      calls++;
      const where = `${file}: trackEvent(${args.join(', ')})`;
      const event = /^'([a-z_]+)'$/.exec(args[0] ?? '')?.[1];
      assert.ok(event && Object.hasOwn(ANALYTICS_EVENTS, event), `${where}: event must be an allowed string literal`);
      assert.ok(args.length <= 2, `${where}: too many arguments`);
      const params = args[1];
      if (params === undefined) continue;
      if (/^chartParams\([\w$.]+\)$/.test(params)) continue;
      const body = /^\{([\s\S]*)\}$/.exec(params)?.[1];
      assert.ok(body !== undefined, `${where}: params must be an object literal or chartParams(config)`);
      for (const property of body.split(',').map((p) => p.trim()).filter(Boolean)) {
        const [key, value] = property.split(':').map((p) => p.trim());
        assert.ok(key && ALLOWED_PARAM_KEYS.has(key), `${where}: param "${key}" is not allowed`);
        assert.match(value ?? '', ALLOWED_VALUE, `${where}: value "${value}" could carry user text`);
      }
    }
  }
  assert.ok(calls >= 7, `expected the editor to track events, found ${calls} calls`);
});

test('no code sends data over the network except fetching our own static assets', () => {
  for (const { file, text } of files) {
    assert.doesNotMatch(text, /\b(?:sendBeacon|XMLHttpRequest|WebSocket|EventSource|RTCPeerConnection)\b/, `${file} uses a network API`);
    const fetches = callArguments(text, 'fetch');
    if (file === 'scripts/export.ts') {
      assert.deepEqual(fetches, [['path']], 'export.ts fetches only inside fetchAsset(path)');
      assert.match(text, /ASSET_PREFIXES = \['\/icons\/', '\/fonts\/'\]/, 'fetchAsset is limited to /icons/ and /fonts/');
      assert.match(text, /if \(!ASSET_PREFIXES\.some\(\(prefix\) => path\.startsWith\(prefix\)\)\) throw/, 'fetchAsset checks the prefix');
    } else {
      assert.equal(fetches.length, 0, `${file} calls fetch()`);
    }
    assert.doesNotMatch(text, /navigator\.sendBeacon|new Image\(\)\.src\s*=\s*['"`]https?:/, `${file} sends a beacon`);
  }
});

test('chart content is only shared through the URL hash, never the query string', () => {
  for (const { file, text } of files) {
    for (const match of text.matchAll(/encodeShareHash\(/g)) {
      const line = text.slice(text.lastIndexOf('\n', match.index) + 1, text.indexOf('\n', match.index));
      if (file === 'lib/state.ts') continue;
      assert.match(line, /#\$\{encodeShareHash\(/, `${file}: share data must go after "#": ${line.trim()}`);
    }
  }
});
