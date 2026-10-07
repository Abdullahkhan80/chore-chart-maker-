// Theme picker thumbnails, rendered on demand (never inlined in the page HTML).
import { THEMES, headerDecorationSvg, stickerPath, type ChartTheme } from '../lib/themes.ts';
import type { Theme } from '../lib/types.ts';

const W = 160;
const H = 100;

export function themeThumbnailSvg(theme: ChartTheme): string {
  const p = theme.palette;
  const rows = [38, 58, 78]
    .map(
      (y, i) =>
        `<rect x="8" y="${y}" width="144" height="18" fill="${i % 2 ? p.page : p.cellBg}"/>` +
        [0, 1, 2, 3].map((c) => `<rect x="${80 + c * 18}" y="${y + 4}" width="10" height="10" rx="2" fill="${p.page}" stroke="${p.text}" stroke-width="1"/>`).join('') +
        `<rect x="14" y="${y + 7}" width="${40 - i * 8}" height="4" rx="2" fill="${p.cellText}"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" aria-hidden="true" focusable="false">
<rect width="${W}" height="${H}" fill="${p.page}"/>
<rect x="8" y="6" width="144" height="18" rx="${Math.min(theme.border.radius, 6)}" fill="${p.headerBg}" stroke="${theme.inkSaver ? p.text : 'none'}"/>
<rect x="14" y="12" width="60" height="6" rx="3" fill="${p.headerText}"/>
<svg x="8" y="25" width="144" height="10" viewBox="0 0 144 10" overflow="hidden">${headerDecorationSvg(theme, 144, 10)}</svg>
${rows}
<path d="${stickerPath(theme.sticker, 150, 88, 14)}" fill="${p.cellBg}" stroke="${p.stickerStroke}" stroke-width="1.5"/>
</svg>`;
}

export function renderThemeThumbnails(container: ParentNode): void {
  // Each thumbnail follows its theme's radio input; the id comes from the input's value.
  for (const input of container.querySelectorAll<HTMLInputElement>('input[name="theme"]')) {
    const el = input.nextElementSibling;
    const id = input.value as Theme;
    if (!el || el.childElementCount || !(id in THEMES)) continue;
    el.innerHTML = themeThumbnailSvg(THEMES[id]);
  }
}
