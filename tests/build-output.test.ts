// Checks the built site in dist/ against the SEO rules and HTML budget in CLAUDE.md.
// Run `npm run build` first.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
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

// Page titles live in <head>; inline chart SVGs in the body carry their own <title>.
const head = (html: string) => html.slice(0, html.indexOf('</head>'));
const titles = (html: string) => matchAll(head(html), /<title>([^<]*)<\/title>/g);
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
  const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1] ?? '');
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
  assert.match(robotsTxt, new RegExp(`^Sitemap: ${ORIGIN}/sitemap\\.xml$`, 'm'));
});

test('icons load as lazy, sized external images and are never inlined in bulk', () => {
  for (const page of pages) {
    const icons = [...page.html.matchAll(/<img\b[^>]*src="\/icons\/[^"]+"[^>]*>/g)].map((m) => m[0]);
    assert.ok(icons.length <= 30, `${page.file} references ${icons.length} icons`);
    for (const img of icons) {
      assert.match(img, /\bloading="lazy"/, `${page.file}: icon without loading="lazy": ${img}`);
      assert.match(img, /\bwidth="\d+"/, `${page.file}: icon without width: ${img}`);
      assert.match(img, /\bheight="\d+"/, `${page.file}: icon without height: ${img}`);
      // Astro writes alt="" as a bare `alt` attribute, which is valid HTML.
      assert.match(img, /\salt(?:="[^"]*")?[\s>]/, `${page.file}: icon without alt: ${img}`);
    }
    // Inline SVG is allowed only for the rendered chart preview, never for icons.
    assert.doesNotMatch(page.html, /<svg\b[^>]*viewBox="0 0 32 32"/, `${page.file} inlines an icon SVG`);
    const outsidePreview = page.html.replace(/<div class="ccm-preview"[\s\S]*?<\/section>/, '');
    const inlineSvgs = outsidePreview.match(/<svg\b/g)?.length ?? 0;
    assert.ok(inlineSvgs === 0, `${page.file} has ${inlineSvgs} inline <svg> elements outside the chart preview`);
  }
});

test('each page preloads exactly one font file, and it exists', () => {
  for (const page of pages) {
    const preloads = [...page.html.matchAll(/<link\b[^>]*rel="preload"[^>]*as="font"[^>]*>/g)].map((m) => m[0]);
    assert.equal(preloads.length, 1, `${page.file} has ${preloads.length} font preloads`);
    const href = /href="([^"]+)"/.exec(preloads[0]!)?.[1] ?? '';
    assert.match(href, /^\/fonts\/[\w-]+\.woff2$/, `${page.file} preload href`);
    assert.ok(existsSync(join(DIST, href)), `${href} is missing from dist`);
    assert.match(preloads[0]!, /\bcrossorigin\b/, `${page.file}: font preload needs crossorigin`);
  }
});

test('the About page credits the icon set and font with their licenses', () => {
  const about = pages.find((p) => p.path === '/about/');
  assert.ok(about, 'about page missing');
  assert.match(about.html, /Fluent Emoji/);
  assert.match(about.html, /MIT License/);
  assert.match(about.html, /href="\/icons\/LICENSE\.txt"/);
  assert.match(about.html, /SIL Open Font License/);
  assert.match(about.html, /href="\/fonts\/LICENSE\.txt"/);
  assert.ok(existsSync(join(DIST, 'icons', 'LICENSE.txt')), 'dist/icons/LICENSE.txt missing');
  assert.ok(existsSync(join(DIST, 'fonts', 'LICENSE.txt')), 'dist/fonts/LICENSE.txt missing');
});

const INITIAL_JS_BUDGET_GZIP = 50 * 1024;

/** A module script plus everything it imports statically (dynamic import() is excluded). */
function staticModuleGraph(entry: string): string[] {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const code = readFileSync(join(DIST, file), 'utf8');
    // Static imports: `import x from"./a.js"`, `import"./a.js"`, `export*from"./a.js"`; not `import("./a.js")`.
    for (const m of code.matchAll(/(?:\bimport|\bexport)(?:[\s\w{},*$]*?from)?\s*["']([^"']+\.js)["']/g)) {
      const target = m[1]!.startsWith('/') ? m[1]!.slice(1) : join(file, '..', m[1]!).split(sep).join('/');
      visit(target);
    }
  };
  visit(entry.replace(/^\//, ''));
  return [...seen];
}

test('initial JS stays within 50 KB gzipped; PDF libraries load only on demand', () => {
  for (const page of pages) {
    const entries = [...page.html.matchAll(/<script type="module" src="([^"]+)"/g)].map((m) => m[1]!);
    const inline = [...page.html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
    const files = entries.flatMap(staticModuleGraph);
    const code = [...files.map((f) => readFileSync(join(DIST, f))), ...inline.map((s) => Buffer.from(s))];
    const gzipped = code.reduce((sum, buf) => sum + gzipSync(buf).length, 0);
    assert.ok(gzipped <= INITIAL_JS_BUDGET_GZIP, `${page.file} loads ${gzipped} bytes of gzipped JS`);
    for (const file of files) {
      assert.doesNotMatch(file, /jspdf|svg2pdf|html2canvas|librarySearch|themeThumbnails|export\./i, `${page.file} eagerly loads ${file}`);
    }
  }
});

test('tool pages render the editor with a finished chart and no headings inside it', () => {
  const toolPaths = ['/chore-chart-maker/', '/reward-chart-maker/', '/roommate-chore-chart/', '/morning-routine-chart/', '/family-chore-chart/', '/free-chore-chart-template/', '/elegant-chore-chart/', '/chores-for-5-year-olds/'];
  for (const path of toolPaths) {
    const page = pages.find((p) => p.path === path);
    assert.ok(page, `${path} missing`);
    const start = page.html.indexOf('data-ccm ');
    assert.ok(start > 0, `${path} has no editor`);
    const tool = page.html.slice(start, page.html.indexOf('</dialog>', start));
    assert.doesNotMatch(tool, /<h[1-6][\s>]/, `${path}: heading tag inside the tool`);
    assert.match(tool, /data-ccm-preview[^>]*><div class="ccm-page"><svg /, `${path}: preview chart is server-rendered`);
    assert.ok(tool.indexOf('data-ccm-preview') < tool.indexOf('data-ccm-form'), `${path}: preview comes before the controls (above the fold on mobile)`);
    assert.match(tool, /aria-live="polite"/, `${path}: live region`);
  }
});

/** Internal hrefs in a page (same-origin paths), without hash or query. */
const internalLinks = (html: string) =>
  [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)]
    .map((m) => decodeEntities(m[1]!))
    .filter((href) => href.startsWith('/') && !href.startsWith('//'))
    .map((href) => href.replace(/[?#].*$/, ''));

/** dist/ file that serves a URL path, or null. */
function distFileFor(path: string): string | null {
  const candidates = path.endsWith('/') ? [join(DIST, path, 'index.html')] : [join(DIST, path)];
  return candidates.find((file) => existsSync(file) && statSync(file).isFile()) ?? null;
}

test('no broken internal links, and page links use the trailing slash', () => {
  for (const page of pages) {
    for (const href of internalLinks(page.html)) {
      assert.ok(distFileFor(href), `${page.file} links to missing ${href}`);
      const isAsset = /\.[a-z0-9]+$/i.test(href);
      assert.ok(isAsset || href.endsWith('/'), `${page.file} links to ${href} without a trailing slash`);
    }
  }
});

test('no orphan pages: every indexable page is linked from at least 2 other pages', () => {
  const linkedFrom = new Map<string, Set<string>>();
  for (const page of pages) {
    for (const href of new Set(internalLinks(page.html))) {
      if (href === page.path) continue;
      if (!linkedFrom.has(href)) linkedFrom.set(href, new Set());
      linkedFrom.get(href)!.add(page.path);
    }
  }
  for (const page of indexable()) {
    if (page.path === '/') continue;
    const sources = linkedFrom.get(page.path)?.size ?? 0;
    assert.ok(sources >= 2, `${page.path} is linked from ${sources} other page(s)`);
  }
});

test('FAQPage JSON-LD matches the visible FAQ text, in order', () => {
  const normalize = (text: string) => decodeEntities(text.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
  for (const page of pages) {
    const faqs = jsonLdBlocks(page.html)
      .map((block) => JSON.parse(block) as { '@type': string; mainEntity?: { name: string; acceptedAnswer: { text: string } }[] })
      .filter((data) => data['@type'] === 'FAQPage');
    const section = /<section aria-labelledby="faq">([\s\S]*?)<\/section>/.exec(page.html)?.[1];
    if (faqs.length === 0) {
      assert.equal(section, undefined, `${page.file} shows an FAQ without FAQPage JSON-LD`);
      continue;
    }
    assert.equal(faqs.length, 1, `${page.file} has ${faqs.length} FAQPage blocks`);
    assert.ok(section, `${page.file} has FAQPage JSON-LD but no visible FAQ section`);
    const visible = [...section.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => ({
      question: normalize(m[1]!),
      answer: normalize(m[2]!),
    }));
    const structured = faqs[0]!.mainEntity!.map((q) => ({ question: q.name.trim(), answer: q.acceptedAnswer.text.trim() }));
    assert.ok(structured.length > 0, `${page.file} FAQPage is empty`);
    assert.deepEqual(visible, structured, `${page.file}: visible FAQ differs from JSON-LD`);
  }
});

test('every <img> has width, height and alt', () => {
  for (const page of pages) {
    for (const [img] of page.html.matchAll(/<img\b[^>]*>/g)) {
      assert.match(img, /\swidth="\d+"/, `${page.file}: img without width: ${img}`);
      assert.match(img, /\sheight="\d+"/, `${page.file}: img without height: ${img}`);
      assert.match(img, /\salt(?:="[^"]*")?[\s/>]/, `${page.file}: img without alt: ${img}`);
    }
  }
});

test('no page has h1–h6 inside the embedded tool', () => {
  let toolPages = 0;
  for (const page of pages) {
    const start = page.html.indexOf('data-ccm ');
    if (start < 0) continue;
    toolPages++;
    const end = page.html.indexOf('</dialog>', start);
    assert.ok(end > start, `${page.file}: tool markup has no closing dialog`);
    assert.doesNotMatch(page.html.slice(start, end), /<h[1-6][\s>]/, `${page.file}: heading tag inside the tool`);
  }
  assert.ok(toolPages >= 6, `only ${toolPages} pages embed the tool`);
});

test('every og:image is a 1200×630 PNG in dist, and main pages each have their own', () => {
  const ownImages = new Map<string, string>();
  for (const page of pages) {
    const url = /<meta property="og:image" content="([^"]*)"/.exec(page.html)?.[1] ?? '';
    assert.ok(url.startsWith(`${ORIGIN}/`), `${page.file} og:image "${url}"`);
    const file = join(DIST, new URL(url).pathname);
    assert.ok(existsSync(file), `${page.file}: ${url} is missing from dist`);
    const png = readFileSync(file);
    assert.equal(png.toString('ascii', 1, 4), 'PNG', `${url} is not a PNG`);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630], `${url} size`);
    if (url.includes('/og/')) {
      assert.ok(!ownImages.has(url), `${page.file} reuses the og:image of ${ownImages.get(url)}`);
      ownImages.set(url, page.file);
    }
  }
  for (const page of indexable()) {
    if (['/about/', '/contact/', '/privacy-policy/', '/terms/'].includes(page.path)) continue;
    assert.ok([...ownImages.values()].includes(page.file), `${page.path} has no page-specific og:image`);
  }
});

test('llms.txt lists every indexable page and no others', () => {
  const llms = readFileSync(join(DIST, 'llms.txt'), 'utf8');
  const listed = [...llms.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((m) => m[1]!).sort();
  const expected = indexable().map((p) => `${ORIGIN}${p.path}`).sort();
  assert.deepEqual(listed, expected);
});

test('every page has complete Open Graph and Twitter tags that match its title and description', () => {
  const meta = (html: string, attr: 'property' | 'name', key: string) =>
    matchAll(head(html), new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`, 'g'));
  for (const page of pages) {
    const one = (attr: 'property' | 'name', key: string) => {
      const found = meta(page.html, attr, key);
      assert.equal(found.length, 1, `${page.file} has ${found.length} ${key}`);
      assert.ok(found[0]!.trim().length > 0, `${page.file} has an empty ${key}`);
      return found[0]!;
    };
    assert.equal(one('property', 'og:title'), titles(page.html)[0], `${page.file} og:title`);
    assert.equal(one('property', 'og:description'), descriptions(page.html)[0], `${page.file} og:description`);
    assert.match(one('property', 'og:type'), /^(website|article)$/, `${page.file} og:type`);
    assert.equal(one('property', 'og:site_name'), SITE_CONFIG.name);
    assert.equal(one('property', 'og:locale'), 'en_US');
    assert.equal(one('property', 'og:image:type'), 'image/png');
    assert.equal(one('property', 'og:image:width'), '1200');
    assert.equal(one('property', 'og:image:height'), '630');
    one('property', 'og:image:alt');
    assert.equal(one('name', 'twitter:card'), 'summary_large_image');
    assert.equal(one('name', 'twitter:title'), titles(page.html)[0]);
    assert.equal(one('name', 'twitter:description'), descriptions(page.html)[0]);
    assert.equal(one('name', 'twitter:image'), one('property', 'og:image'), `${page.file} twitter:image`);
    if (meta(page.html, 'property', 'og:type')[0] === 'article') {
      assert.match(one('property', 'article:published_time'), /^\d{4}-\d{2}-\d{2}$/);
      assert.match(one('property', 'article:modified_time'), /^\d{4}-\d{2}-\d{2}$/);
    }
  }
});
