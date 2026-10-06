// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { SITE_CONFIG } from './src/lib/seo.ts';
import { allPages } from './src/lib/pages.ts';

const pagesByPath = new Map(allPages().map((page) => [page.path, page]));

// https://astro.build/config
export default defineConfig({
  site: SITE_CONFIG.url,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [
    sitemap({
      // Pages missing from the registry are kept so serialize() fails loudly.
      filter: (url) => !pagesByPath.get(new URL(url).pathname)?.noindex,
      serialize(item) {
        const page = pagesByPath.get(new URL(item.url).pathname);
        if (!page) throw new Error(`Sitemap: ${item.url} is missing from src/lib/pages.ts`);
        return { ...item, lastmod: page.lastmod };
      },
    }),
  ],
  vite: { plugins: [tailwindcss()] },
});
