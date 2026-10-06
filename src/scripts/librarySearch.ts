// Searchable chore library, loaded on demand when "Browse all chores" is opened.
// Result buttons reuse data-action="add-library-chore", handled by editor.ts.
import { CHORE_CATEGORIES, CHORE_LIBRARY, searchChores, type ChoreCategory } from '../lib/choreLibrary.ts';
import { iconImg } from '../lib/editorMarkup.ts';
import { escapeXml as esc } from '../lib/renderChart.ts';

const MAX_RESULTS = 40;
const CATEGORY_LABELS: Record<ChoreCategory, string> = {
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  pets: 'Pets',
  outdoor: 'Outdoor',
  'self-care': 'Self-care',
  school: 'School',
  laundry: 'Laundry',
  cleaning: 'Cleaning',
};

export function mountLibrary(container: HTMLElement): void {
  if (container.dataset.mounted !== undefined) {
    container.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    return;
  }
  container.dataset.mounted = '';
  container.hidden = false;
  container.innerHTML = `<div class="grid gap-2 sm:grid-cols-2">
<label class="ccm-label">Search chores<input type="search" class="ccm-input" data-lib-query autocomplete="off" maxlength="40"></label>
<label class="ccm-label">Category<select class="ccm-input" data-lib-category><option value="">All categories</option>${CHORE_CATEGORIES.map(
    (c) => `<option value="${c}">${CATEGORY_LABELS[c]}</option>`,
  ).join('')}</select></label></div>
<p class="mt-2 text-sm text-muted" data-lib-count aria-live="polite"></p>
<ul class="mt-2 grid max-h-96 gap-1 overflow-y-auto" data-lib-results></ul>`;

  const query = container.querySelector<HTMLInputElement>('[data-lib-query]')!;
  const category = container.querySelector<HTMLSelectElement>('[data-lib-category]')!;
  const results = container.querySelector<HTMLElement>('[data-lib-results]')!;
  const count = container.querySelector<HTMLElement>('[data-lib-count]')!;

  const render = () => {
    const pool = query.value.trim() ? searchChores(query.value) : [...CHORE_LIBRARY];
    const filtered = category.value ? pool.filter((c) => c.category === category.value) : pool;
    results.innerHTML = filtered
      .slice(0, MAX_RESULTS)
      .map(
        (c) =>
          `<li><button type="button" class="ccm-chip w-full justify-start" data-action="add-library-chore" data-chore-id="${c.id}">${iconImg(c.iconId, 24)}<span class="flex-1 text-left">${esc(c.label)}</span><span class="text-xs text-muted">Ages ${c.minAge}${c.maxAge >= 18 ? '+' : `–${c.maxAge}`}</span><span class="sr-only">, add</span></button></li>`,
      )
      .join('');
    count.textContent =
      filtered.length > MAX_RESULTS ? `Showing ${MAX_RESULTS} of ${filtered.length} chores.` : `${filtered.length} chores.`;
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  query.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  });
  category.addEventListener('change', render);
  render();
  query.focus();
}
