// Starting configs for each chart type and landing page, selected with ?preset=<id>.
import { CHORE_CATEGORIES, getChoreById, getChoresForAge } from './choreLibrary.ts';
import { AGE_PAGE_AGES, PAGES, agePagePath } from './pages.ts';
import { createDefaultConfig, validateConfig } from './state.ts';
import { DAYS, type ChartConfig, type ChartType, type Chore, type Day } from './types.ts';

const WEEKDAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
const PRESET_AGE_MIN = 2;
const PRESET_AGE_MAX = 14;
const AGE_PRESET_CHORE_COUNT = 8;

function kids(names: string[]): ChartConfig['kids'] {
  // Colors and avatars are filled in by validateConfig().
  return names.map((name, i) => ({ id: `k${i + 1}`, name }) as ChartConfig['kids'][number]);
}

/** Chore rows from library ids. Throws on unknown ids so a typo fails tests. */
function chores(ids: string[], options: { assignees?: string[]; days?: Day[] } = {}): Chore[] {
  return ids.map((libraryId, i) => {
    const entry = getChoreById(libraryId);
    if (!entry) throw new Error(`Preset references unknown chore "${libraryId}"`);
    return {
      id: `c${i + 1}`,
      label: entry.label,
      iconId: entry.iconId,
      assignees: options.assignees ?? [],
      days: options.days ?? [...DAYS],
      ...(entry.timeOfDay ? { timeOfDay: entry.timeOfDay } : {}),
    };
  });
}

function build(type: ChartType, overrides: Partial<ChartConfig>): ChartConfig {
  return validateConfig({ ...createDefaultConfig(type), ...overrides });
}

/**
 * A varied set of chores for one age: round-robin across categories, taking the
 * most age-specific chores (highest minAge) in each category first.
 */
export function choresForAgePreset(age: number, count = AGE_PRESET_CHORE_COUNT): string[] {
  const byCategory = CHORE_CATEGORIES.map((category) =>
    getChoresForAge(age)
      .filter((chore) => chore.category === category)
      .sort((a, b) => b.minAge - a.minAge),
  );
  const picked: string[] = [];
  for (let round = 0; picked.length < count; round++) {
    const row = byCategory.map((list) => list[round]).filter((chore) => chore !== undefined);
    if (row.length === 0) break;
    for (const chore of row) if (picked.length < count) picked.push(chore.id);
  }
  return picked;
}

function agePreset(age: number): ChartConfig {
  return build('weekly', {
    title: `My Chores (Age ${age})`,
    kids: kids(['Child 1']),
    chores: chores(choresForAgePreset(age), { assignees: ['k1'] }),
  });
}

const BASE_PRESETS = {
  weekly: () =>
    build('weekly', {
      kids: kids(['Child 1']),
      chores: chores(['make-bed', 'clothes-in-hamper', 'set-table', 'feed-pet', 'tidy-bedroom', 'brush-teeth-bedtime'], {
        assignees: ['k1'],
      }),
    }),
  routine: () =>
    build('routine', {
      kids: kids(['Child 1']),
      chores: chores(['get-dressed', 'brush-teeth-morning', 'eat-breakfast', 'brush-hair', 'pack-backpack', 'put-on-shoes'], {
        assignees: ['k1'],
        days: WEEKDAYS,
      }),
    }),
  'morning-routine': () =>
    build('routine', {
      title: 'Morning Routine',
      kids: kids(['Child 1']),
      chores: chores(
        ['make-bed', 'get-dressed', 'brush-teeth-morning', 'brush-hair', 'eat-breakfast', 'pack-backpack', 'put-on-shoes'],
        { assignees: ['k1'], days: WEEKDAYS },
      ),
    }),
  'bedtime-routine': () =>
    build('routine', {
      title: 'Bedtime Routine',
      kids: kids(['Child 1']),
      chores: chores(
        ['put-toys-in-bin', 'bath-time', 'put-on-pajamas', 'brush-teeth-bedtime', 'read-before-bed', 'lights-out-on-time'],
        { assignees: ['k1'] },
      ),
    }),
  reward: () =>
    build('reward', {
      kids: kids(['Child 1']),
      chores: chores(['make-bed', 'brush-teeth-bedtime', 'put-toys-in-bin'], { assignees: ['k1'] }),
      reward: { enabled: true, goal: 10, prizeText: 'A trip to the park' },
      orientation: 'portrait',
    }),
  family: () =>
    build('family', {
      kids: kids(['Grown-up', 'Child 1', 'Child 2']),
      chores: [
        ...chores(['cook-simple-meal', 'take-out-trash'], { assignees: ['k1'] }),
        ...chores(['load-dishwasher', 'fold-laundry'], { assignees: ['k2'] }),
        ...chores(['set-table', 'feed-pet'], { assignees: ['k3'] }),
      ],
    }),
  rotation: () =>
    build('rotation', {
      kids: kids(['Person 1', 'Person 2', 'Person 3']),
      chores: chores(['take-out-trash', 'clean-bathroom', 'vacuum-room', 'wipe-counters'], { days: ['sat'] }),
    }),
  roommates: () =>
    build('rotation', {
      title: 'Roommate Chore Chart',
      kids: kids(['Roommate 1', 'Roommate 2', 'Roommate 3']),
      chores: chores(['take-out-trash', 'clean-bathroom', 'vacuum-room', 'mop-floor', 'wipe-counters', 'clean-fridge'], {
        days: ['sun'],
      }),
    }),
} satisfies Record<string, () => ChartConfig>;

const AGE_PRESETS = Object.fromEntries(
  Array.from({ length: PRESET_AGE_MAX - PRESET_AGE_MIN + 1 }, (_, i) => PRESET_AGE_MIN + i).map((age) => [
    `age-${age}`,
    () => agePreset(age),
  ]),
) as Record<`age-${number}`, () => ChartConfig>;

const PRESETS: Readonly<Record<string, () => ChartConfig>> = { ...BASE_PRESETS, ...AGE_PRESETS };

export const PRESET_IDS: readonly string[] = Object.keys(PRESETS);

/** A fresh preset config, or null for an unknown id (the id usually comes from the URL). */
export function getPreset(id: unknown): ChartConfig | null {
  if (typeof id !== 'string' || !Object.hasOwn(PRESETS, id)) return null;
  return PRESETS[id]!();
}

/** Default preset for each landing page path. */
export const PAGE_PRESETS: Readonly<Record<string, string>> = {
  [PAGES.choreChartMaker.path]: 'weekly',
  [PAGES.rewardChartMaker.path]: 'reward',
  [PAGES.roommateChoreChart.path]: 'roommates',
  [PAGES.morningRoutineChart.path]: 'morning-routine',
  [PAGES.familyChoreChart.path]: 'family',
  ...Object.fromEntries(AGE_PAGE_AGES.map((age) => [agePagePath(age), `age-${age}`])),
};
