// HTML for the editor's dynamic lists (kids, chores, suggestions). Pure string
// templates shared by the server render (ChoreChartMaker.astro) and the browser
// (editor.ts), so the first paint and later updates are identical. All user
// text goes through escapeXml(). No heading tags: labels use <label>/<legend>.
import { getChoresForAge } from './choreLibrary.ts';
import { AVATAR_ICON_IDS, type IconId } from './icons.ts';
import { ICON_MANIFEST } from './iconManifest.ts';
import { KID_COLOR_HEX, escapeXml as esc, orderedDays, renderChartPages } from './renderChart.ts';
import { KID_COLORS, LIMITS, type ChartConfig, type Chore, type Day, type Kid } from './types.ts';

const DAY_SHORT: Record<Day, string> = { mon: 'Mo', tue: 'Tu', wed: 'We', thu: 'Th', fri: 'Fr', sat: 'Sa', sun: 'Su' };
const DAY_FULL: Record<Day, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

/** Preview markup: every chart page, with icons as plain URLs (cached by the browser). */
export function renderPreviewHtml(config: ChartConfig): string {
  return renderChartPages(config, { iconResolver: (id) => ICON_MANIFEST[id].path })
    .map((svg) => `<div class="ccm-page">${svg}</div>`)
    .join('');
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function iconImg(id: IconId, size: number, alt = ''): string {
  return `<img src="${ICON_MANIFEST[id].path}" alt="${esc(alt)}" width="${size}" height="${size}" loading="lazy" decoding="async">`;
}

function options(values: readonly { value: string; label: string }[], selected: string): string {
  return values
    .map((o) => `<option value="${esc(o.value)}"${o.value === selected ? ' selected' : ''}>${esc(o.label)}</option>`)
    .join('');
}

export function kidDisplayName(kid: Kid, index: number): string {
  return kid.name || `Child ${index + 1}`;
}

export function kidItemHtml(kid: Kid, index: number): string {
  const id = `ccm-kid-${index}`;
  const name = kidDisplayName(kid, index);
  return `<li class="ccm-card" data-index="${index}">
<div class="flex items-center gap-2">${iconImg(kid.avatarIcon, 40)}<span class="ccm-swatch" style="background:${KID_COLOR_HEX[kid.color]}"></span>
<label class="sr-only" for="${id}-name">Child ${index + 1} name</label>
<input id="${id}-name" class="ccm-input min-w-0 flex-1" data-kid-field="name" value="${esc(kid.name)}" maxlength="${LIMITS.kidNameLength}" placeholder="Name" autocomplete="off">
<button type="button" class="ccm-btn" data-action="remove-kid" data-index="${index}" aria-label="Remove ${esc(name)}">✕</button></div>
<div class="mt-2 grid grid-cols-3 gap-2">
<label class="ccm-label">Age<input id="${id}-age" type="number" class="ccm-input" data-kid-field="age" min="${LIMITS.kidAge.min}" max="${LIMITS.kidAge.max}" inputmode="numeric" value="${kid.age ?? ''}"></label>
<label class="ccm-label">Color<select id="${id}-color" class="ccm-input" data-kid-field="color">${options(KID_COLORS.map((c) => ({ value: c, label: capitalize(c) })), kid.color)}</select></label>
<label class="ccm-label">Avatar<select id="${id}-avatar" class="ccm-input" data-kid-field="avatarIcon">${options(AVATAR_ICON_IDS.map((a) => ({ value: a, label: ICON_MANIFEST[a].alt })), kid.avatarIcon)}</select></label>
</div></li>`;
}

export function kidListHtml(config: ChartConfig): string {
  return config.kids.map(kidItemHtml).join('');
}

/** One chore row. Controls find their chore through the <li data-index>. */
export function choreItemHtml(chore: Chore, index: number, config: ChartConfig): string {
  const id = `ccm-chore-${index}`;
  const label = esc(chore.label || `Chore ${index + 1}`);
  const last = config.chores.length - 1;
  const days = orderedDays(config)
    .map((day) => `<label class="ccm-day"><input type="checkbox" value="${day}" aria-label="${DAY_FULL[day]}"${chore.days.includes(day) ? ' checked' : ''}><span>${DAY_SHORT[day]}</span></label>`)
    .join('');
  const assignees =
    config.kids.length > 1
      ? `<fieldset class="mt-2" data-assignees><legend class="ccm-label">Who does it? <span class="font-normal text-muted">(none = everyone)</span></legend><div class="flex flex-wrap gap-1">${config.kids
          .map((kid, k) => `<label class="ccm-chip"><input type="checkbox" value="${kid.id}"${chore.assignees.includes(kid.id) ? ' checked' : ''}>${esc(kidDisplayName(kid, k))}</label>`)
          .join('')}</div></fieldset>`
      : '';
  const allowance = config.allowance.enabled
    ? `<label class="ccm-label inline-flex items-center gap-2">Pay<input type="number" class="ccm-input w-24" data-chore-field="allowance" min="0" max="${LIMITS.allowance.max}" step="0.05" inputmode="decimal" value="${chore.allowance ?? ''}"></label>`
    : '';
  return `<li class="ccm-card" data-index="${index}">
<div class="flex items-center gap-2"><span class="ccm-handle" draggable="true" data-drag-handle aria-hidden="true">⠿</span>
<button type="button" class="ccm-btn px-1" data-action="pick-icon" data-index="${index}" aria-label="Change icon for ${label}">${iconImg(chore.iconId, 32)}</button>
<label class="sr-only" for="${id}">Chore ${index + 1}</label>
<input id="${id}" class="ccm-input min-w-0 flex-1" data-chore-field="label" value="${esc(chore.label)}" maxlength="${LIMITS.choreLabelLength}" autocomplete="off">
<button type="button" class="ccm-btn" data-action="remove-chore" data-index="${index}" aria-label="Remove ${label}">✕</button></div>
<fieldset class="mt-2" data-days><legend class="sr-only">Days for ${label}</legend><div class="flex flex-wrap gap-1">${days}</div></fieldset>
${assignees}<div class="mt-2 flex flex-wrap items-center gap-2">
<button type="button" class="ccm-btn" data-action="move-chore" data-dir="-1" data-index="${index}" aria-label="Move ${label} up"${index === 0 ? ' disabled' : ''}>↑</button>
<button type="button" class="ccm-btn" data-action="move-chore" data-dir="1" data-index="${index}" aria-label="Move ${label} down"${index === last ? ' disabled' : ''}>↓</button>
<label class="ccm-label inline-flex items-center gap-2">Points<input type="number" class="ccm-input w-20" data-chore-field="points" min="0" max="${LIMITS.points.max}" inputmode="numeric" value="${chore.points ?? ''}"></label>
${allowance}</div></li>`;
}

export function choreListHtml(config: ChartConfig): string {
  return config.chores.map((chore, i) => choreItemHtml(chore, i, config)).join('');
}

/** Age used for suggestions: the first kid with an age, else a sensible default. */
export function suggestionAge(config: ChartConfig, fallback = 6): number {
  return config.kids.find((kid) => kid.age !== undefined)?.age ?? fallback;
}

export function suggestionChipsHtml(age: number, config: ChartConfig, limit = 8): string {
  const existing = new Set(config.chores.map((c) => c.label.toLowerCase()));
  const full = config.chores.length >= LIMITS.maxChores;
  const chips = getChoresForAge(age)
    .filter((c) => !existing.has(c.label.toLowerCase()))
    .sort((a, b) => b.minAge - a.minAge)
    .slice(0, limit)
    .map(
      (c) =>
        `<button type="button" class="ccm-chip" data-action="add-library-chore" data-chore-id="${c.id}"${full ? ' disabled' : ''}>${iconImg(c.iconId, 24)}<span>${esc(c.label)}</span><span class="sr-only">, add</span></button>`,
    );
  return chips.length ? chips.join('') : '<p class="text-sm text-muted">All suggestions for this age are on your chart.</p>';
}
