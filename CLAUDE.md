# CLAUDE.md

Guidance for all work in this repo. Read it before every change.

## Project

**chore chart maker** (https://chorechartmaker.com) is a site of free, privacy-first printable tools.

- First tool: **Chore Chart Maker** at `/chore-chart-maker/`.
- More tools (e.g. a bingo card generator) will be added later as sibling pages. Keep the architecture multi-tool: shared layout, SEO, JSON-LD and print/export code lives in shared modules, and each tool brings only its own logic and UI.

**Audience:** parents of kids aged 2–14 come first, mostly in the US. Teachers, roommates and caregivers come next. **Letter is the default paper size, and A4 is supported.**

## Stack

- **Astro 5**: `output: 'static'`, `trailingSlash: 'always'`, `build.format: 'directory'`.
- **Tailwind CSS v4** via `@tailwindcss/vite`.
- **TypeScript strict**, **Node 22**.
- **Deploy:** a Cloudflare Worker serves `dist/` as static assets (`wrangler.toml`).
- **Tests:** `node --experimental-strip-types --test tests/*.test.ts`.

### Code layout

| Path | Contents |
| --- | --- |
| `src/lib/*.ts` | Pure logic: state, chore library, SVG renderer (`renderChart.ts` is the single source of truth for preview, PNG, PDF and print). **No Astro/Vite-only syntax** (no `astro:*` imports, `import.meta.env`, `?raw`/`?url` imports or path aliases), so Node can import these files directly in tests. Use explicit `.ts` extensions in relative imports. |
| `src/scripts/` | Browser-only code: `editor.ts` (chart editor), `export.ts` (PDF/PNG/print, loaded on click), lazy `librarySearch.ts` and `themeThumbnails.ts`. The only network access allowed is `fetchAsset()` for our own `/icons/` and `/fonts/` (enforced by `tests/privacy-audit.test.ts`). |
| `src/pages/` | Routes, one directory per URL. |
| `src/layouts/`, `src/components/` | Shared shell and UI. |
| `public/` | Static assets: icons as individual files, the self-hosted font. |
| `scripts/` | One-off asset generators: `fetch-icons.mjs` (Fluent Emoji → `public/icons/` + generated `src/lib/iconManifest.ts`), `generate-icons.mjs` (favicons, default OG image), `generate-og-images.mjs` (per-page 1200×630 OG images → `public/og/`; re-run after changing a page H1 or preset). |
| `tests/*.test.ts` | Node test runner tests: logic plus build-output budget/SEO checks. |

## Privacy invariant (non-negotiable)

- Kids' names, chores and chart content **never leave the browser**. There is no backend and there are no accounts.
- Chart state lives in `localStorage` and can be shared through the **URL hash**. Never put it in the query string, because the hash is never sent to the server.
- Analytics receive **categorical events only** (e.g. `chart_type`, `export_format`), never user-entered text.
- No third-party scripts that could read page content.

## Performance budget

Enforce these with tests where possible.

- HTML **≤ 60 KB** per page.
- Initial JS **≤ 50 KB gzipped**.
- PDF libraries are **lazy-loaded** (dynamic `import()`) only when the user clicks export.
- Icons load as external files and are never inlined in bulk.
- Mobile **LCP < 2.0 s**, **CLS < 0.05**. Reserve space for anything that loads late.
- Font: self-hosted and subset, with `font-display: swap`.

**Append-only lists:** share-link hashes encode icons, themes and other enums by index, so never reorder or remove entries in `src/lib/icons.ts` or the enum arrays in `src/lib/types.ts` once released. Themes must keep every text/background pair at WCAG AA (tested).

## SEO rules

- Exactly **one `<h1>`** per page.
- Unique `<title>` (**≤ 60 chars**) and meta description (**140–160 chars**) on every page.
- A self-referencing **https canonical with a trailing slash**.
- Tool UI must **not** use `h1`–`h6` for control labels. Use `<label>`, `<legend>` or styled text instead.
- Every page is in the sitemap with `lastmod`.
- JSON-LD comes only from **shared builders**. Never hand-write it per page.
- No fake reviews or ratings, no trademarked characters, no medical claims.

## URL map (v1)

```
/                          hub
/chore-chart-maker/
/reward-chart-maker/
/chores-for-kids-by-age/
/chores-for-[N]-year-olds/ N = 3–12, added gradually
/roommate-chore-chart/
/morning-routine-chart/
/family-chore-chart/
/free-chore-chart-template/
/elegant-chore-chart/
/about/
/contact/
/privacy-policy/
/terms/
404
```

## Definition of done

A change is done only when all of these hold:

1. `npm run build` passes.
2. `npm test` passes.
3. `npm run check` passes.
4. No page exceeds the 60 KB HTML budget.

## Development

Start the dev server in background mode:

```
astro dev --background
```

Manage it with `astro dev stop`, `astro dev status` and `astro dev logs`.

Astro docs: https://docs.astro.build. Check the [routing](https://docs.astro.build/en/guides/routing/), [components](https://docs.astro.build/en/basics/astro-components/) and [styling](https://docs.astro.build/en/guides/styling/) guides before related work.
