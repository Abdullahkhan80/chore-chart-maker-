import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { XMLValidator } from 'fast-xml-parser';
import {
  approxTextWidth,
  escapeXml,
  pageGeometry,
  renderChart,
  renderChartPages,
  rotationSchedule,
  rotationWeeks,
  type RenderOptions,
} from '../src/lib/renderChart.ts';
import { getPreset } from '../src/lib/presets.ts';
import { createDefaultConfig, validateConfig } from '../src/lib/state.ts';
import { CHART_TYPES, ORIENTATIONS, PAPER_SIZES, type ChartConfig, type ChartType } from '../src/lib/types.ts';

const OPTIONS: RenderOptions = { iconResolver: (id) => `/icons/${id}.svg`, today: new Date('2026-10-06T12:00:00Z') };
const SNAPSHOT_DIR = new URL('./__snapshots__/renderChart/', import.meta.url);

function config(type: ChartType, overrides: Partial<ChartConfig> = {}): ChartConfig {
  return validateConfig({
    ...createDefaultConfig(type),
    title: 'Test Chart',
    kids: [
      { id: 'a', name: 'Ava', color: 'blue', avatarIcon: 'avatar-fox' },
      { id: 'b', name: 'Ben', color: 'red', avatarIcon: 'avatar-owl' },
    ],
    chores: [
      { label: 'Make the bed', iconId: 'bed', assignees: ['a'], timeOfDay: 'morning' },
      { label: 'Feed the cat', iconId: 'pet-bowl', assignees: ['b'], timeOfDay: 'afternoon', points: 3 },
      { label: 'Brush teeth', iconId: 'toothbrush', assignees: ['a', 'b'], timeOfDay: 'evening', days: ['mon', 'wed'] },
    ],
    ...overrides,
  });
}

function assertValidSvg(svg: string, label: string) {
  const result = XMLValidator.validate(svg);
  assert.equal(result, true, `${label}: ${JSON.stringify(result)}`);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"[^>]* viewBox="0 0 [\d.]+ [\d.]+"/, `${label}: root element`);
  assert.doesNotMatch(svg, /NaN|undefined|Infinity/, `${label}: invalid numbers`);
}

const attr = (tagText: string, name: string) => {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tagText);
  return match ? Number.isNaN(Number(match[1])) ? match[1] : Number(match[1]) : undefined;
};

/** Every drawn element lies inside the safe margins (nested <svg> boxes are checked as boxes). */
function assertWithinSafeArea(svg: string, cfg: ChartConfig, label: string) {
  const { width, height, margin } = pageGeometry(cfg);
  const lo = margin - 0.6;
  const hiX = width - margin + 0.6;
  const hiY = height - margin + 0.6;
  // Drop the root tag, then collapse nested <svg> viewports to their opening tag.
  const body = svg.replace(/^<svg[^>]*>/, '').replace(/(<svg\b[^>]*>)[\s\S]*?<\/svg>/g, '$1');
  for (const match of body.matchAll(/<(rect|image|path|text|svg)\b([^>]*)>([^<]*)/g)) {
    const [, name, tagText, content] = match as unknown as [string, string, string, string];
    if (tagText.includes('data-part="background"')) continue;
    const where = `${label}: <${name}${tagText.slice(0, 80)}>`;
    if (name === 'path') {
      // Top-level paths are grid lines made of absolute M/L commands.
      const d = /\sd="([^"]*)"/.exec(tagText)?.[1] ?? '';
      assert.match(d, /^[ML\d. -]+$/, `${where} uses only M/L commands`);
      const numbers = d.split(/[ML ]/).filter(Boolean).map(Number);
      for (let i = 0; i < numbers.length; i += 2) {
        const [px, py] = [numbers[i]!, numbers[i + 1]!];
        assert.ok(px >= lo && px <= hiX && py >= lo && py <= hiY, `${where} point ${px},${py}`);
      }
    } else if (name === 'text') {
      const x = attr(tagText, 'x') as number;
      const y = attr(tagText, 'y') as number;
      const size = attr(tagText, 'font-size') as number;
      const anchor = (attr(tagText, 'text-anchor') as string | undefined) ?? 'start';
      // Text inside sticker viewports uses a 0–100 coordinate space; those are covered by the viewport box.
      if (tagText.includes('fill') && x <= 100 && y <= 100 && size === 18 && anchor === 'middle' && cfg.type === 'reward') continue;
      const w = approxTextWidth(content.replace(/&[a-z#0-9]+;/g, 'x'), size, /font-weight="700"/.test(tagText));
      const left = anchor === 'start' ? x : anchor === 'middle' ? x - w / 2 : x - w;
      assert.ok(y - size * 0.8 >= lo && y <= hiY, `${where} vertical`);
      assert.ok(left >= lo - 1 && left + w <= hiX + 1, `${where} horizontal (${content})`);
    } else {
      const x = attr(tagText, 'x') as number;
      const y = attr(tagText, 'y') as number;
      const w = attr(tagText, 'width') as number;
      const h = attr(tagText, 'height') as number;
      assert.ok(x >= lo && y >= lo && x + w <= hiX && y + h <= hiY, `${where} out of bounds`);
    }
  }
}

test('page geometry matches Letter and A4 in both orientations', () => {
  const letter = pageGeometry({ paper: 'letter', orientation: 'portrait' });
  assert.deepEqual([letter.widthIn, letter.heightIn, letter.width, letter.height], [8.5, 11, 816, 1056]);
  assert.ok(Math.abs(letter.margin - 0.4 * 96) < 1e-9, '0.4 in safe margin');
  const a4 = pageGeometry({ paper: 'a4', orientation: 'landscape' });
  assert.equal(Math.round(a4.width), 1123);
  assert.equal(Math.round(a4.height), 794);
  const svg = renderChart(config('weekly', { paper: 'a4', orientation: 'landscape' }), OPTIONS);
  assert.match(svg, /width="297mm" height="210mm"/);
  assert.match(renderChart(config('weekly', { orientation: 'portrait' }), OPTIONS), /width="8.5in" height="11in"/);
});

test('every layout renders valid SVG for every paper size and orientation', () => {
  for (const type of CHART_TYPES) {
    for (const paper of PAPER_SIZES) {
      for (const orientation of ORIENTATIONS) {
        for (const pages of [
          renderChartPages(config(type, { paper, orientation }), OPTIONS),
          renderChartPages(config(type, { paper, orientation, largeText: true, inkSaver: true, showDates: true }), OPTIONS),
          renderChartPages(validateConfig({ type, paper, orientation }), OPTIONS),
        ]) {
          assert.ok(pages.length >= 1);
          pages.forEach((svg, i) => assertValidSvg(svg, `${type}/${paper}/${orientation} page ${i + 1}`));
        }
      }
    }
  }
});

test('every chore and kid name appears, XML-escaped', () => {
  // Names are capped at 20 characters, so keep the hostile ones within the limit.
  const evilKid = '<script>"x"&</b>';
  const evilChore = `"><img src=x onerror=alert(1)> & co`;
  for (const type of CHART_TYPES) {
    const cfg = config(type, {
      kids: [
        { id: 'k1', name: evilKid, color: 'teal', avatarIcon: 'avatar-cat' },
        { id: 'k2', name: "Zoë O'Neil", color: 'pink', avatarIcon: 'avatar-bear' },
        { id: 'k3', name: 'Maximilianna Roseann', color: 'green', avatarIcon: 'avatar-owl' },
      ],
      chores: [
        { id: 'c1', label: evilChore, iconId: 'star', assignees: [], days: ['mon'], timeOfDay: 'morning' },
        { id: 'c2', label: 'Feed the fish 🐟', iconId: 'fish', assignees: [], days: ['tue'] },
      ],
      title: 'Title </svg><script>',
    });
    const svg = renderChartPages(cfg, OPTIONS).join('\n');
    for (const page of renderChartPages(cfg, OPTIONS)) assertValidSvg(page, type);
    assert.doesNotMatch(svg, /<script|<img|onerror=alert\(1\)>/, `${type}: unescaped markup`);
    for (const name of [evilKid, "Zoë O'Neil", 'Maximilianna Roseann']) assert.ok(svg.includes(escapeXml(name)), `${type}: kid name ${name} missing`);
    // Labels may wrap onto two <text> lines, so compare against all text content joined by spaces.
    const textContent = [...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]).join(' ');
    for (const label of [evilChore, 'Feed the fish 🐟']) assert.ok(textContent.includes(escapeXml(label)), `${type}: chore ${label} missing`);
    assert.ok(svg.includes(escapeXml('Title </svg><script>')), `${type}: title missing`);
  }
});

test('icon hrefs come from the resolver and are escaped', () => {
  const svg = renderChart(config('weekly'), { ...OPTIONS, iconResolver: (id) => `/icons/${id}.svg?a=1&b="2"` });
  assert.match(svg, /href="\/icons\/bed\.svg\?a=1&amp;b=&quot;2&quot;"/);
});

test('20 chores fit inside the safe margins on every page setup', () => {
  const chores = Array.from({ length: 20 }, (_, i) => ({
    label: i % 2 ? 'Empty the dishwasher and put dishes away' : `Chore ${i + 1}`,
    iconId: 'broom',
    assignees: [`k${(i % 2) + 1}`],
    timeOfDay: (['morning', 'afternoon', 'evening'] as const)[i % 3],
    points: 10,
    allowance: 1.5,
  }));
  for (const type of CHART_TYPES) {
    for (const paper of PAPER_SIZES) {
      for (const orientation of ORIENTATIONS) {
        for (const largeText of [false, true]) {
          const cfg = config(type, {
            paper,
            orientation,
            largeText,
            showDates: true,
            allowance: { enabled: true, currency: 'USD' },
            reward: { enabled: true, goal: 30, prizeText: 'A really big prize for finishing everything' },
            chores: chores as ChartConfig['chores'],
            kids: Array.from({ length: 8 }, (_, i) => ({
              id: `k${i + 1}`,
              name: 'Maximilianna Rose',
              color: 'teal',
              avatarIcon: 'avatar-cat',
            })) as ChartConfig['kids'],
          });
          assert.equal(cfg.chores.length, 20);
          renderChartPages(cfg, OPTIONS).forEach((svg, i) =>
            assertWithinSafeArea(svg, cfg, `${type}/${paper}/${orientation}/${largeText ? 'large' : 'normal'} p${i + 1}`),
          );
        }
      }
    }
  }
});

test('rotation is round-robin and fair', () => {
  for (let people = 1; people <= 8; people++) {
    const weeks = rotationWeeks(people);
    assert.ok(weeks >= 4 && weeks % people === 0, `${people} people → ${weeks} weeks`);
    for (let chores = 0; chores <= 20; chores++) {
      const schedule = rotationSchedule(chores, people, weeks);
      assert.equal(schedule.length, weeks);
      for (const week of schedule) {
        assert.deepEqual(week.flat().sort((a, b) => a - b), Array.from({ length: chores }, (_, i) => i), 'each chore once a week');
        const loads = week.map((cell) => cell.length);
        assert.ok(Math.max(...loads) - Math.min(...loads) <= 1, 'weekly loads differ by at most one');
      }
      // Over each full cycle, every person does every chore exactly once.
      for (let start = 0; start < weeks; start += people) {
        for (let person = 0; person < people; person++) {
          const done = schedule.slice(start, start + people).flatMap((week) => week[person]!).sort((a, b) => a - b);
          assert.deepEqual(done, Array.from({ length: chores }, (_, i) => i), `${people} people, ${chores} chores, person ${person}`);
        }
      }
      // Chores actually rotate: with 2+ people nobody keeps the same chore two weeks running.
      if (people > 1 && chores > 0) assert.notDeepEqual(schedule[0], schedule[1]);
    }
  }
});

test('reward and per-kid family charts render one page per kid', () => {
  assert.equal(renderChartPages(config('reward'), OPTIONS).length, 2);
  assert.equal(renderChartPages(config('family', { familyLayout: 'perKid' }), OPTIONS).length, 2);
  assert.equal(renderChartPages(config('family', { familyLayout: 'combined' }), OPTIONS).length, 1);
  assert.equal(renderChartPages(config('reward', { kids: [] }), OPTIONS).length, 1);
  const pages = renderChartPages(config('family', { familyLayout: 'perKid' }), OPTIONS);
  assert.ok(pages[0]!.includes('Make the bed') && !pages[0]!.includes('Feed the cat'), 'Ava gets her chores only');
  assert.ok(pages[1]!.includes('Feed the cat') && !pages[1]!.includes('Make the bed'), 'Ben gets his chores only');
  assert.ok(pages.every((p) => p.includes('Brush teeth')), 'shared chores appear on every page');
});

test('ink saver uses a white page and outline-only header', () => {
  const svg = renderChart(config('weekly', { theme: 'space', inkSaver: true }), OPTIONS);
  assert.match(svg, /data-part="background"/);
  assert.match(svg, /<rect x="0" y="0" width="[\d.]+" height="[\d.]+" fill="#ffffff" data-part="background"\/>/);
  assert.doesNotMatch(svg, /#111633|#312e81/, 'no dark space-theme fills');
});

test('rendering is deterministic', () => {
  for (const type of CHART_TYPES) {
    assert.equal(renderChartPages(config(type), OPTIONS).join(''), renderChartPages(config(type), OPTIONS).join(''));
  }
});

test('snapshots for each layout', () => {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const cases: Record<string, ChartConfig> = {
    weekly: validateConfig({ ...getPreset('weekly'), showDates: true }),
    routine: validateConfig({ ...getPreset('morning-routine'), theme: 'ocean' }),
    reward: validateConfig({ ...getPreset('reward'), theme: 'space' }),
    'family-combined': validateConfig({ ...getPreset('family'), theme: 'jungle' }),
    'family-per-kid': validateConfig({ ...getPreset('family'), theme: 'dinosaur', familyLayout: 'perKid' }),
    rotation: validateConfig({ ...getPreset('roommates'), theme: 'sports', showDates: true }),
    'ink-saver-large': validateConfig({ ...getPreset('weekly'), theme: 'pastel', inkSaver: true, largeText: true }),
  };
  const update = process.env.UPDATE_SNAPSHOTS === '1';
  for (const [name, cfg] of Object.entries(cases)) {
    const actual = renderChartPages(cfg, OPTIONS).join('\n');
    const file = new URL(`${name}.svg`, SNAPSHOT_DIR);
    if (update || !existsSync(file)) {
      writeFileSync(file, actual);
      continue;
    }
    assert.equal(actual, readFileSync(file, 'utf8'), `snapshot ${name} changed; rerun with UPDATE_SNAPSHOTS=1 if intended`);
  }
});
