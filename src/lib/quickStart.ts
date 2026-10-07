// Homepage quick start: turns a few form answers into a full chart config that
// opens in the editor through a share hash, so nothing reaches the server.
import { getChoreById } from './choreLibrary.ts';
import { choresForAgePreset } from './presets.ts';
import { createDefaultConfig, validateConfig } from './state.ts';
import { DAYS, LIMITS, type ChartConfig, type Chore, type Day } from './types.ts';

/** Chore choices shown on the homepage, by library id. */
export const QUICK_START_CHORES = [
  'make-bed',
  'brush-teeth-morning',
  'put-toys-in-bin',
  'feed-pet',
  'set-table',
  'clothes-in-hamper',
  'tidy-bedroom',
  'pack-backpack',
] as const;

/** Used when no chore is ticked and no age is given. */
const DEFAULT_CHORES = ['make-bed', 'brush-teeth-morning', 'clothes-in-hamper', 'set-table', 'tidy-bedroom'];
const AGE_CHORE_COUNT = 6;

export const QUICK_START_SCHEDULES = {
  daily: { label: 'Every day', days: [...DAYS] },
  weekdays: { label: 'Weekdays (Mon–Fri)', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  weekends: { label: 'Weekends', days: ['sat', 'sun'] },
} as const satisfies Record<string, { label: string; days: readonly Day[] }>;

export type QuickStartSchedule = keyof typeof QUICK_START_SCHEDULES;

export interface QuickStartInput {
  name: string;
  age: number | null;
  choreIds: readonly string[];
  schedule: string;
  theme: string;
}

export function buildQuickStartConfig(input: QuickStartInput): ChartConfig {
  const name = input.name.trim().slice(0, LIMITS.kidNameLength);
  const age =
    input.age !== null && Number.isInteger(input.age) && input.age >= LIMITS.kidAge.min && input.age <= LIMITS.kidAge.max
      ? input.age
      : null;
  const picked = input.choreIds.filter((id) => getChoreById(id) !== undefined).slice(0, LIMITS.maxChores);
  const choreIds = picked.length > 0 ? picked : age !== null ? choresForAgePreset(age, AGE_CHORE_COUNT) : DEFAULT_CHORES;
  const schedule = Object.hasOwn(QUICK_START_SCHEDULES, input.schedule)
    ? QUICK_START_SCHEDULES[input.schedule as QuickStartSchedule]
    : QUICK_START_SCHEDULES.daily;

  const chores: Chore[] = choreIds.map((libraryId, i) => {
    const entry = getChoreById(libraryId)!;
    return {
      id: `c${i + 1}`,
      label: entry.label,
      iconId: entry.iconId,
      assignees: ['k1'],
      days: [...schedule.days],
      ...(entry.timeOfDay ? { timeOfDay: entry.timeOfDay } : {}),
    };
  });

  return validateConfig({
    ...createDefaultConfig('weekly'),
    title: name ? `${name}'s Chores` : 'My Chores',
    // Color and avatar are filled in by validateConfig().
    kids: [{ id: 'k1', name: name || 'Child 1', ...(age !== null ? { age } : {}) }],
    chores,
    // validateConfig() falls back to the default theme for unknown ids.
    theme: input.theme,
  });
}
