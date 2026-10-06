// Chore chart editor. Hydrates the server-rendered ChoreChartMaker component:
// restores state (URL hash → localStorage → preset), keeps the controls and the
// live SVG preview in sync, and lazy-loads the library search, theme thumbnails
// and exporters. All chart data stays in this browser.
import { chartParams, trackEvent } from '../lib/analytics.ts';
import { getChoreById } from '../lib/choreLibrary.ts';
import {
  choreListHtml,
  iconImg,
  renderPreviewHtml,
  kidDisplayName,
  kidListHtml,
  suggestionAge,
  suggestionChipsHtml,
} from '../lib/editorMarkup.ts';
import { AVATAR_ICON_IDS, CHORE_ICON_IDS, isIconId, type ChoreIconId } from '../lib/icons.ts';
import { ICON_MANIFEST } from '../lib/iconManifest.ts';
import { getPreset } from '../lib/presets.ts';
import {
  STORAGE_KEY,
  createDefaultConfig,
  decodeShareHash,
  encodeShareHash,
  loadFromStorage,
  saveToStorage,
  validateConfig,
} from '../lib/state.ts';
import { DAYS, KID_COLORS, LIMITS, type ChartConfig, type Day } from '../lib/types.ts';

const PREVIEW_DELAY_MS = 150;
const SAVE_DELAY_MS = 400;

interface RenderFlags {
  kids?: boolean;
  chores?: boolean;
  suggestions?: boolean;
  /** Selector of the element to focus after re-rendering. */
  focus?: string;
  announce?: string;
}

function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function mount(root: HTMLElement): void {
  const $ = <T extends Element = HTMLElement>(selector: string) => root.querySelector<T>(selector);
  const form = $<HTMLFormElement>('[data-ccm-form]')!;
  const previewEl = $('[data-ccm-preview]')!;
  const pagesEl = $('[data-ccm-pages]')!;
  const announcer = $('[data-ccm-announce]')!;
  const kidsEl = $('[data-ccm-kids]')!;
  const choresEl = $('[data-ccm-chores]')!;
  const suggestionsEl = $('[data-ccm-suggestions]')!;
  const suggestAgeEl = $<HTMLSelectElement>('[data-ccm-suggest-age]')!;
  const customLabelEl = $<HTMLInputElement>('[data-ccm-custom-label]')!;
  const customIconEl = $('[data-ccm-custom-icon]')!;
  const iconDialog = $<HTMLDialogElement>('[data-ccm-icon-dialog]')!;
  const iconGrid = $('[data-ccm-icon-grid]')!;
  const shareOutput = $<HTMLInputElement>('[data-ccm-share-output]')!;
  const presetId = root.dataset.preset ?? 'weekly';
  const presetConfig = () => getPreset(presetId) ?? createDefaultConfig();

  let state: ChartConfig = presetConfig();
  let step = 1;
  let created = false;
  let customIcon: ChoreIconId = 'star';
  let pickerTarget: number | 'new' = 'new';
  let pickerReturnFocus: HTMLElement | null = null;
  let dragFrom: number | null = null;

  // ------------------------------------------------------------------ output

  const announce = (message: string) => {
    announcer.textContent = '';
    // A fresh text node makes screen readers repeat identical messages.
    requestAnimationFrame(() => (announcer.textContent = message));
  };

  const renderPreview = () => {
    previewEl.innerHTML = renderPreviewHtml(state);
    const count = previewEl.children.length;
    pagesEl.textContent = count > 1 ? `${count} pages, one per child` : '';
  };
  const schedulePreview = debounce(renderPreview, PREVIEW_DELAY_MS);
  const scheduleSave = debounce(() => {
    const store = storage();
    if (store) saveToStorage(store, state);
  }, SAVE_DELAY_MS);

  const renderSuggestions = () => {
    suggestionsEl.innerHTML = suggestionChipsHtml(Number(suggestAgeEl.value) || suggestionAge(state), state);
  };

  const renderLists = (flags: RenderFlags) => {
    const activeId = document.activeElement instanceof HTMLElement ? document.activeElement.id : '';
    if (flags.kids) kidsEl.innerHTML = kidListHtml(state);
    if (flags.chores) choresEl.innerHTML = choreListHtml(state);
    if (flags.suggestions || flags.chores) renderSuggestions();
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-action="add-kid"]')) {
      button.disabled = state.kids.length >= LIMITS.maxKids;
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-action="add-custom-chore"]')) {
      button.disabled = state.chores.length >= LIMITS.maxChores;
    }
    for (const el of root.querySelectorAll('[data-ccm-chore-count]')) {
      el.textContent = `${state.chores.length} of ${LIMITS.maxChores} chores`;
    }
    const target = flags.focus ? root.querySelector<HTMLElement>(flags.focus) : activeId ? document.getElementById(activeId) : null;
    if (target && target !== document.activeElement && !(target as HTMLButtonElement).disabled) target.focus();
  };

  const updateConditional = () => {
    for (const el of root.querySelectorAll<HTMLElement>('[data-when]')) {
      const [key, value] = (el.dataset.when ?? '').split(':');
      el.hidden = !(
        (key === 'type' && state.type === value) ||
        (key === 'dates' && state.showDates) ||
        (key === 'allowance' && state.allowance.enabled)
      );
    }
  };

  const syncStyleControls = () => {
    const set = (name: string, value: string | boolean) => {
      for (const el of form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)) {
        if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
          el.checked = el.type === 'radio' ? el.value === value : value === true;
        } else {
          el.value = String(value);
        }
      }
    };
    set('title', state.title);
    set('type', state.type);
    set('theme', state.theme);
    set('paper', state.paper);
    set('orientation', state.orientation);
    set('weekStart', state.weekStart);
    set('showDates', state.showDates);
    set('startDate', state.startDate ?? '');
    set('familyLayout', state.familyLayout);
    set('rewardGoal', String(state.reward.goal));
    set('prizeText', state.reward.prizeText);
    set('allowanceEnabled', state.allowance.enabled);
    set('currency', state.allowance.currency);
    set('largeText', state.largeText);
    set('inkSaver', state.inkSaver);
  };

  const renderAll = () => {
    suggestAgeEl.value = String(suggestionAge(state));
    renderLists({ kids: true, chores: true, suggestions: true });
    syncStyleControls();
    updateConditional();
    renderPreview();
  };

  /** Applies a change: validates, re-renders what changed, saves and refreshes the preview. */
  const commit = (mutate: (draft: ChartConfig) => void, flags: RenderFlags = {}) => {
    const draft = structuredClone(state);
    mutate(draft);
    state = validateConfig(draft);
    if (flags.kids || flags.chores || flags.suggestions) renderLists(flags);
    updateConditional();
    schedulePreview();
    scheduleSave();
    if (flags.announce) announce(flags.announce);
    if (!created) {
      created = true;
      trackEvent('chart_created', { chart_type: state.type });
    }
  };

  // ------------------------------------------------------------------ actions

  const addLibraryChore = (choreId: string) => {
    const entry = getChoreById(choreId);
    if (!entry) return;
    if (state.chores.length >= LIMITS.maxChores) {
      announce(`A chart holds up to ${LIMITS.maxChores} chores.`);
      return;
    }
    commit(
      (d) => {
        d.chores.push({
          id: 'new',
          label: entry.label,
          iconId: entry.iconId,
          assignees: [],
          days: [...DAYS],
          ...(entry.timeOfDay ? { timeOfDay: entry.timeOfDay } : {}),
        });
      },
      { chores: true, focus: '[data-ccm-suggestions] button:not([disabled])', announce: `Added ${entry.label}. ${state.chores.length + 1} chores.` },
    );
  };

  const addCustomChore = () => {
    const label = customLabelEl.value.trim();
    if (!label) {
      announce('Type a chore name first.');
      customLabelEl.focus();
      return;
    }
    if (state.chores.length >= LIMITS.maxChores) {
      announce(`A chart holds up to ${LIMITS.maxChores} chores.`);
      return;
    }
    commit((d) => d.chores.push({ id: 'new', label, iconId: customIcon, assignees: [], days: [...DAYS] }), {
      chores: true,
      announce: `Added ${label}.`,
    });
    customLabelEl.value = '';
    customLabelEl.focus();
  };

  const moveChore = (from: number, to: number) => {
    if (to < 0 || to >= state.chores.length || from === to) return;
    const label = state.chores[from]?.label || `Chore ${from + 1}`;
    commit(
      (d) => {
        const [moved] = d.chores.splice(from, 1);
        if (moved) d.chores.splice(to, 0, moved);
      },
      {
        chores: true,
        focus: `[data-action="move-chore"][data-index="${to}"][data-dir="${to < from ? -1 : 1}"]`,
        announce: `Moved ${label} to position ${to + 1} of ${state.chores.length}.`,
      },
    );
  };

  const addKid = () => {
    if (state.kids.length >= LIMITS.maxKids) return;
    const usedColors = new Set(state.kids.map((k) => k.color));
    const usedAvatars = new Set(state.kids.map((k) => k.avatarIcon));
    commit(
      (d) =>
        d.kids.push({
          id: 'new',
          name: '',
          color: KID_COLORS.find((c) => !usedColors.has(c)) ?? KID_COLORS[0],
          avatarIcon: AVATAR_ICON_IDS.find((a) => !usedAvatars.has(a)) ?? AVATAR_ICON_IDS[0],
        }),
      { kids: true, chores: true, focus: `#ccm-kid-${state.kids.length}-name`, announce: `Added child ${state.kids.length + 1}.` },
    );
  };

  const setStep = (next: number, moveFocus = true) => {
    step = Math.min(4, Math.max(1, next));
    for (const fieldset of root.querySelectorAll<HTMLElement>('[data-step]')) {
      fieldset.toggleAttribute('data-active', fieldset.dataset.step === String(step));
    }
    for (const button of root.querySelectorAll<HTMLElement>('[data-action="go-step"]')) {
      if (button.dataset.target === String(step)) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-action="step-prev"]')) button.disabled = step === 1;
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-action="step-next"]')) button.hidden = step === 4;
    if (moveFocus) root.querySelector<HTMLElement>(`[data-step="${step}"]`)?.focus({ preventScroll: false });
  };

  const openIconPicker = (target: number | 'new', trigger: HTMLElement) => {
    pickerTarget = target;
    pickerReturnFocus = trigger;
    if (!iconGrid.childElementCount) {
      iconGrid.innerHTML = CHORE_ICON_IDS.map(
        (id) =>
          `<button type="button" class="ccm-btn p-1" data-pick-icon="${id}" aria-label="${ICON_MANIFEST[id].alt}">${iconImg(id, 32)}</button>`,
      ).join('');
    }
    iconDialog.showModal();
    const current = target === 'new' ? customIcon : state.chores[target]?.iconId;
    iconGrid.querySelector<HTMLElement>(`[data-pick-icon="${current}"]`)?.focus();
  };

  const pickIcon = (id: string) => {
    if (!isIconId(id) || !(CHORE_ICON_IDS as readonly string[]).includes(id)) return;
    const iconId = id as ChoreIconId;
    iconDialog.close();
    if (pickerTarget === 'new') {
      customIcon = iconId;
      customIconEl.innerHTML = iconImg(iconId, 32);
      pickerReturnFocus?.focus();
      announce(`Icon: ${ICON_MANIFEST[iconId].alt}.`);
    } else {
      const index = pickerTarget;
      commit((d) => {
        if (d.chores[index]) d.chores[index].iconId = iconId;
      }, { chores: true, focus: `[data-action="pick-icon"][data-index="${index}"]`, announce: `Icon: ${ICON_MANIFEST[iconId].alt}.` });
    }
  };

  const runExport = async (button: HTMLButtonElement, kind: 'pdf' | 'png' | 'print') => {
    const label = { pdf: 'PDF', png: 'PNG image', print: 'print preview' }[kind];
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    announce(`Preparing your ${label}…`);
    try {
      const exporter = await import('./export.ts');
      if (kind === 'pdf') {
        await exporter.exportPdf(state);
        trackEvent('export_pdf', chartParams(state));
      } else if (kind === 'png') {
        await exporter.exportPng(state);
        trackEvent('export_png', chartParams(state));
      } else {
        trackEvent('print', chartParams(state));
        await exporter.printChart(state);
      }
      if (kind !== 'print') announce(`Your ${label} is downloading.`);
    } catch {
      announce(`Sorry, the ${label} could not be created. Please try again.`);
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  };

  const copyShareLink = async () => {
    const url = `${location.origin}${location.pathname}#${encodeShareHash(state)}`;
    trackEvent('share_link_copied', { chart_type: state.type });
    try {
      await navigator.clipboard.writeText(url);
      shareOutput.hidden = true;
      announce('Share link copied. The chart is stored in the link itself, not on our servers.');
    } catch {
      shareOutput.hidden = false;
      shareOutput.value = url;
      shareOutput.select();
      announce('Copy the share link from the box.');
    }
  };

  const startOver = () => {
    if (!window.confirm('Start over? This clears the chart saved on this device.')) return;
    try {
      storage()?.removeItem(STORAGE_KEY);
    } catch {
      // Storage may be blocked; nothing to clear.
    }
    state = presetConfig();
    customIcon = 'star';
    customIconEl.innerHTML = iconImg(customIcon, 32);
    renderAll();
    setStep(1);
    announce('Started over with a fresh chart.');
  };

  // ------------------------------------------------------------------ events

  const indexOf = (el: HTMLElement) => Number(el.closest<HTMLElement>('[data-index]')?.dataset.index);

  const onField = (event: Event) => {
    const el = event.target as HTMLInputElement | HTMLSelectElement;
    if (!(el instanceof HTMLElement) || el.closest('[data-ccm-library]')) return;
    const isChange = event.type === 'change';
    const index = indexOf(el);

    if (el.dataset.kidField) {
      const field = el.dataset.kidField;
      if (field === 'name' && isChange) return;
      if (field !== 'name' && !isChange) return;
      commit(
        (d) => {
          const kid = d.kids[index];
          if (!kid) return;
          if (field === 'age') kid.age = el.value ? Number(el.value) : undefined;
          else (kid as unknown as Record<string, string>)[field] = el.value;
        },
        { kids: field !== 'name', chores: true },
      );
      if (field === 'age' && el.value) {
        suggestAgeEl.value = el.value;
        renderSuggestions();
      }
      return;
    }
    if (el.dataset.choreField) {
      const field = el.dataset.choreField;
      if (isChange) return; // text and number fields update live on input
      commit((d) => {
        const chore = d.chores[index];
        if (!chore) return;
        if (field === 'label') chore.label = el.value;
        else if (el.value === '') delete chore[field as 'points' | 'allowance'];
        else chore[field as 'points' | 'allowance'] = Number(el.value);
      });
      return;
    }
    if (el instanceof HTMLInputElement && el.closest('[data-days]') && isChange) {
      const day = el.value as Day;
      commit((d) => {
        const chore = d.chores[index];
        if (!chore) return;
        chore.days = el.checked ? [...chore.days, day] : chore.days.filter((x) => x !== day);
      });
      return;
    }
    if (el instanceof HTMLInputElement && el.closest('[data-assignees]') && isChange) {
      const kidId = el.value;
      commit((d) => {
        const chore = d.chores[index];
        if (!chore) return;
        chore.assignees = el.checked ? [...chore.assignees, kidId] : chore.assignees.filter((x) => x !== kidId);
      });
      return;
    }
    if (el === suggestAgeEl) {
      if (isChange) renderSuggestions();
      return;
    }
    if (el === customLabelEl || el === shareOutput) return;

    const name = el.getAttribute('name');
    if (!name) return;
    const textField = name === 'title' || name === 'prizeText';
    if (textField === isChange) return; // text: live on input; others: on change
    const value = el.value;
    const checked = el instanceof HTMLInputElement && el.checked;
    const before = state;
    commit(
      (d) => {
        switch (name) {
          case 'title': d.title = value; break;
          case 'prizeText': d.reward.prizeText = value; break;
          case 'type':
            d.type = value as ChartConfig['type'];
            if (value === 'reward') d.reward.enabled = true;
            break;
          case 'theme': d.theme = value as ChartConfig['theme']; break;
          case 'paper': d.paper = value as ChartConfig['paper']; break;
          case 'orientation': d.orientation = value as ChartConfig['orientation']; break;
          case 'weekStart': d.weekStart = value as ChartConfig['weekStart']; break;
          case 'showDates': d.showDates = checked; break;
          case 'startDate': d.startDate = value || null; break;
          case 'familyLayout': d.familyLayout = value as ChartConfig['familyLayout']; break;
          case 'rewardGoal': d.reward.goal = Number(value); break;
          case 'allowanceEnabled': d.allowance.enabled = checked; break;
          case 'currency': d.allowance.currency = value as ChartConfig['allowance']['currency']; break;
          case 'largeText': d.largeText = checked; break;
          case 'inkSaver': d.inkSaver = checked; break;
        }
      },
      { chores: name === 'weekStart' || name === 'allowanceEnabled' },
    );
    if (name === 'type' && state.type !== before.type) {
      trackEvent('chart_type_selected', { chart_type: state.type });
      announce(`Chart type changed. The preview is updated.`);
    }
    if (name === 'theme' && state.theme !== before.theme) {
      trackEvent('theme_selected', { theme: state.theme });
      announce('Theme changed. The preview is updated.');
    }
    if (name === 'rewardGoal' && el instanceof HTMLInputElement) el.value = String(state.reward.goal);
  };

  form.addEventListener('input', onField);
  form.addEventListener('change', onField);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (document.activeElement === customLabelEl) addCustomChore();
  });

  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const picked = target.closest<HTMLElement>('[data-pick-icon]');
    if (picked) {
      pickIcon(picked.dataset.pickIcon ?? '');
      return;
    }
    const button = target.closest<HTMLButtonElement>('[data-action]');
    if (!button || button.disabled) return;
    const index = indexOf(button);
    switch (button.dataset.action) {
      case 'add-kid':
        addKid();
        break;
      case 'remove-kid': {
        const name = kidDisplayName(state.kids[index]!, index);
        commit((d) => d.kids.splice(index, 1), {
          kids: true,
          chores: true,
          focus: state.kids.length > 1 ? `[data-action="remove-kid"][data-index="${Math.max(0, index - 1)}"]` : '[data-action="add-kid"]',
          announce: `Removed ${name}.`,
        });
        break;
      }
      case 'remove-chore': {
        const label = state.chores[index]?.label || `Chore ${index + 1}`;
        commit((d) => d.chores.splice(index, 1), {
          chores: true,
          focus:
            state.chores.length > 1
              ? `[data-action="remove-chore"][data-index="${Math.min(index, state.chores.length - 2)}"]`
              : '[data-ccm-custom-label]',
          announce: `Removed ${label}. ${state.chores.length - 1} chores.`,
        });
        break;
      }
      case 'move-chore':
        moveChore(index, index + Number(button.dataset.dir));
        break;
      case 'add-library-chore':
        addLibraryChore(button.dataset.choreId ?? '');
        break;
      case 'add-custom-chore':
        addCustomChore();
        break;
      case 'pick-icon':
        openIconPicker(button.dataset.index === 'new' ? 'new' : index, button);
        break;
      case 'close-icon-picker':
        iconDialog.close();
        pickerReturnFocus?.focus();
        break;
      case 'open-library': {
        const container = $('[data-ccm-library]')!;
        button.setAttribute('aria-expanded', 'true');
        void import('./librarySearch.ts').then((m) => m.mountLibrary(container));
        break;
      }
      case 'go-step':
        setStep(Number(button.dataset.target));
        break;
      case 'step-prev':
        setStep(step - 1);
        break;
      case 'step-next':
        setStep(step + 1);
        break;
      case 'show-preview':
        previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'show-download':
        setStep(4, false);
        root.querySelector('[data-step="4"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        root.querySelector<HTMLElement>('[data-action="export-pdf"]')?.focus({ preventScroll: true });
        break;
      case 'export-pdf':
        void runExport(button, 'pdf');
        break;
      case 'export-png':
        void runExport(button, 'png');
        break;
      case 'print':
        void runExport(button, 'print');
        break;
      case 'copy-link':
        void copyShareLink();
        break;
      case 'start-over':
        startOver();
        break;
    }
  });

  // Drag-and-drop reordering (the ↑/↓ buttons are the keyboard and touch alternative).
  choresEl.addEventListener('dragstart', (event) => {
    const handle = (event.target as HTMLElement).closest<HTMLElement>('[data-drag-handle]');
    if (!handle || !event.dataTransfer) return;
    dragFrom = indexOf(handle);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(dragFrom));
    const item = handle.closest('li');
    if (item) event.dataTransfer.setDragImage(item, 24, 24);
  });
  choresEl.addEventListener('dragover', (event) => {
    if (dragFrom !== null) event.preventDefault();
  });
  choresEl.addEventListener('drop', (event) => {
    const item = (event.target as HTMLElement).closest<HTMLElement>('li[data-index]');
    if (dragFrom === null || !item) return;
    event.preventDefault();
    moveChore(dragFrom, indexOf(item));
    dragFrom = null;
  });
  choresEl.addEventListener('dragend', () => (dragFrom = null));

  // Lazy theme thumbnails: rendered when the theme picker scrolls into view.
  const themePicker = $('[data-ccm-themes]');
  if (themePicker && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      void import('./themeThumbnails.ts').then((m) => m.renderThemeThumbnails(themePicker));
    });
    observer.observe(themePicker);
  }

  const loadFromHash = (): boolean => {
    if (!location.hash.startsWith('#v')) return false;
    const fromHash = decodeShareHash(location.hash);
    history.replaceState(null, '', location.pathname + location.search);
    if (!fromHash) return false;
    state = fromHash;
    const store = storage();
    if (store) saveToStorage(store, state);
    return true;
  };

  window.addEventListener('hashchange', () => {
    if (loadFromHash()) {
      renderAll();
      announce('Loaded the shared chart.');
    }
  });

  // ------------------------------------------------------------------ restore

  let restored = loadFromHash();
  if (!restored) {
    const store = storage();
    const saved = store ? loadFromStorage(store) : null;
    if (saved) {
      state = saved;
      restored = true;
    }
  }
  if (restored && JSON.stringify(state) !== JSON.stringify(presetConfig())) renderAll();
  else {
    syncStyleControls();
    updateConditional();
  }
  setStep(1, false);
  root.dataset.ready = '';
}

for (const root of document.querySelectorAll<HTMLElement>('[data-ccm]')) mount(root);
