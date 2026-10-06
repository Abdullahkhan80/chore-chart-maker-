// Builds /sitemap.xml from the page registry, so every indexable page is listed with its lastmod.
// tests/build-output.test.ts checks it against the pages actually built into dist/.
import type { APIRoute } from 'astro';
import { indexablePages } from '../lib/pages.ts';
import { SITE_CONFIG } from '../lib/seo.ts';

export const GET: APIRoute = () => {
  const urls = indexablePages()
    .map((page) => `  <url>\n    <loc>${SITE_CONFIG.url}${page.path}</loc>\n    <lastmod>${page.lastmod}</lastmod>\n  </url>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
