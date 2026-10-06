# chore chart maker

Free, privacy-first printable tools at https://chorechartmaker.com. The first one is the Chore Chart Maker (`/chore-chart-maker/`). Nothing you type leaves your browser.

Built with Astro, Tailwind CSS v4 and TypeScript, and deployed as a static site on Cloudflare Workers. See [CLAUDE.md](./CLAUDE.md) for architecture, budgets and project rules.

## Requirements

- Node 22+

## Commands

| Command | Action |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server at `localhost:4321` |
| `astro dev --background` | Start the dev server in the background (`astro dev stop` / `status` / `logs`) |
| `npm run build` | Build the static site to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run tests (`node --experimental-strip-types --test tests/*.test.ts`) |
| `npm run check` | Type-check the project (`astro check`) |
| `npx wrangler deploy` | Deploy `dist/` to Cloudflare (needs `wrangler.toml`) |

## Definition of done

`npm run build`, `npm test` and `npm run check` all pass, and no page's HTML exceeds 60 KB.
