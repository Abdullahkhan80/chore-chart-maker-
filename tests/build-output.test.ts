// Checks the built site in dist/ against the SEO rules and HTML budget in CLAUDE.md.
// Run `npm run build` first.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_CONFIG } from '../src/lib/seo.ts';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const HTML_BUDGET_BYTES = 60 * 1024;
const ORIGIN = `https://${SITE_CONFIG.domain}`;

interface BuiltPage {
  file: string;
  /** URL path the page is served at, e.g. "/about/". */
  path: string;
  html: string;
  bytes: number;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function matchAll(html: string, regex: RegExp): string[] {
  return [...html.matchAll(regex)].map((m) => decodeEntities(m[1] ?? ''));
}

const titles = (html: string) => matchAll(html, /<title>([^<]*)<\/title>/g);
const descriptions = (html: string) => matchAll(html, /<meta name="description" content="([^"]*)"/g);
const canonicals = (html: string) => matchAll(html, /<link rel="canonical" href="([^"]*)"/g);
const robots = (html: string) => matchAll(html, /<meta name="robots" content="([^"]*)"/g);
const isNoindex = (html: string) => robots(html).some((r) => r.includes('noindex'));
const jsonLdBlocks = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? '');

let pages: BuiltPage[] = [];

before(() => {
  assert.ok(existsSync(join(DIST, 'index.html')), 'dist/ is missing: run `npm run build` before `npm test`');
  pages = walk(DIST)
    .filter((file) => file.endsWith('.html'))
    .map((file) => {
      const rel = relative(DIST, file).split(sep).join('/');
      const path = rel === '404.html' ? '/404/' : `/${rel.replace(/(^|\/)index\.html$/, '$1')}`;
      const html = readFileSync(file, 'utf8');
      return { file: rel, path, html, bytes: Buffer.byteLength(html) };
    });
});

const indexable = () => pages.filter((p) => !isNoindex(p.html));

test('every HTML file is within the 60 KB budget', () => {
  for (const page of pages) {
    assert.ok(page.bytes <= HTML_BUDGET_BYTES, `${page.file} is ${page.bytes} bytes (budget ${HTML_BUDGET_BYTES})`);
  }
});

test('every page has exactly one H1', () => {
  for (const page of pages) {
    const count = page.html.match(/<h1[\s>]/gi)?.length ?? 0;
    assert.equal(count, 1, `${page.file} has ${count} <h1> elements`);
  }
});

test('every page has one unique title of at most 60 characters', () => {
  const seen = new Map<string, string>();
  for (const page of pages) {
    const found = titles(page.html);
    assert.equal(found.length, 1, `${page.file} has ${found.length} <title> elements`);
    const title = found[0]!.trim();
    assert.ok(title.length > 0 && title.length <= 60, `${page.file} title is ${title.length} chars: "${title}"`);
    assert.ok(!seen.has(title), `${page.file} reuses the title of ${seen.get(title)}: "${title}"`);
    seen.set(title, page.file);
  }
});

test('every page has one unique meta description of 140–160 characters', () => {
  const seen = new Map<string, string>();
  for (const page of pages) {
    const found = descriptions(page.html);
    assert.equal(found.length, 1, `${page.file} has ${found.length} meta descriptions`);
    const description = found[0]!.trim();
    assert.ok(
      description.length >= 140 && description.length <= 160,
      `${page.file} description is ${description.length} chars: "${description}"`,
    );
    assert.ok(!seen.has(description), `${page.file} reuses the description of ${seen.get(description)}`);
    seen.set(description, page.file);
  }
});

test('indexable pages have a self-referencing https canonical with a trailing slash', () => {
  for (const page of indexable()) {
    const found = canonicals(page.html);
    assert.equal(found.length, 1, `${page.file} has ${found.length} canonical links`);
    assert.equal(found[0], `${ORIGIN}${page.path}`, `${page.file} canonical`);
    assert.ok(found[0]!.endsWith('/'), `${page.file} canonical lacks a trailing slash`);
    assert.match(page.html, new RegExp(`<meta property="og:url" content="${ORIGIN}${page.path}"`), `${page.file} og:url`);
  }
});

test('no canonical, og:url or JSON-LD URL points at www or http', () => {
  for (const page of pages) {
    assert.doesNotMatch(page.html, /https?:\/\/www\.chorechartmaker\.com/, `${page.file} references www`);
    assert.doesNotMatch(page.html, /http:\/\/chorechartmaker\.com/, `${page.file} references http`);
  }
});

test('the 404 page is noindex', () => {
  const notFound = pages.find((p) => p.file === '404.html');
  assert.ok(notFound, 'dist/404.html is missing');
  assert.ok(isNoindex(notFound.html), '404.html must have <meta name="robots" content="noindex, ...">');
});

test('JSON-LD blocks are valid, escaped and schema.org typed', () => {
  for (const page of pages) {
    for (const block of jsonLdBlocks(page.html)) {
      assert.ok(!block.includes('<'), `${page.file} has an unescaped "<" in JSON-LD`);
      const data = JSON.parse(block) as Record<string, unknown>;
      assert.equal(data['@context'], 'https://schema.org', `${page.file} JSON-LD @context`);
      assert.equal(typeof data['@type'], 'string', `${page.file} JSON-LD @type`);
    }
  }
});

test('WebSite and Organization JSON-LD appear on the homepage only', () => {
  const typesOf = (page: BuiltPage) =>
    jsonLdBlocks(page.html).map((block) => (JSON.parse(block) as { '@type': string })['@type']);
  for (const page of pages) {
    const types = typesOf(page);
    if (page.path === '/') {
      assert.ok(types.includes('WebSite') && types.includes('Organization'), 'homepage needs WebSite + Organization');
    } else {
      assert.ok(!types.includes('WebSite') && !types.includes('Organization'), `${page.file} has WebSite/Organization`);
    }
  }
});

test('the sitemap lists exactly the indexable pages, each with lastmod', () => {
  const index = readFileSync(join(DIST, 'sitemap-index.xml'), 'utf8');
  const sitemapFiles = matchAll(index, /<loc>([^<]*)<\/loc>/g).map((loc) => new URL(loc).pathname.slice(1));
  assert.ok(sitemapFiles.length > 0, 'sitemap-index.xml lists no sitemaps');

  const entries = sitemapFiles.flatMap((name) =>
    [...readFileSync(join(DIST, name), 'utf8').matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1] ?? ''),
  );
  const locs = entries.map((entry) => matchAll(entry, /<loc>([^<]*)<\/loc>/g)[0] ?? '');
  for (const [i, entry] of entries.entries()) {
    assert.match(entry, /<lastmod>[^<]+<\/lastmod>/, `sitemap entry ${locs[i]} lacks lastmod`);
  }

  const expected = indexable()
    .map((p) => `${ORIGIN}${p.path}`)
    .sort();
  assert.deepEqual([...locs].sort(), expected);
});

test('robots.txt points at the sitemap', () => {
  const robotsTxt = readFileSync(join(DIST, 'robots.txt'), 'utf8');
  assert.match(robotsTxt, new RegExp(`^Sitemap: ${ORIGIN}/sitemap-index\\.xml$`, 'm'));
});
