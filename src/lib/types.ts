// Chart data model. Pure types and constants, shared by state, presets and the renderer.
import type { AvatarIconId, ChoreIconId } from './icons.ts';

export const CHART_TYPES = ['weekly', 'routine', 'reward', 'family', 'rotation'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

/** Days in storage order. Display order depends on `weekStart`. */
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];

export const WEEK_STARTS = ['mon', 'sun'] as const;
export type WeekStart = (typeof WEEK_STARTS)[number];

export const TIMES_OF_DAY = ['morning', 'afternoon', 'evening'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const KID_COLORS = ['teal', 'blue', 'purple', 'pink', 'red', 'orange', 'yellow', 'green'] as const;
export type KidColor = (typeof KID_COLORS)[number];

export const THEMES = ['classic', 'bright', 'pastel', 'mono'] as const;
export type Theme = (typeof THEMES)[number];

export const PAPER_SIZES = ['letter', 'a4'] as const;
export type PaperSize = (typeof PAPER_SIZES)[number];

export const ORIENTATIONS = ['portrait', 'landscape'] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export const CURRENCIES = ['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'NZD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const LIMITS = {
  maxKids: 8,
  kidNameLength: 20,
  maxChores: 20,
  choreLabelLength: 40,
  titleLength: 50,
  prizeTextLength: 40,
  rewardGoal: { min: 5, max: 30, default: 10 },
  points: { min: 0, max: 100 },
  allowance: { min: 0, max: 100 },
} as const;

export interface Kid {
  /** Stable within a config: k1…k8, by position. */
  id: string;
  name: string;
  color: KidColor;
  avatarIcon: AvatarIconId;
}

export interface Chore {
  /** Stable within a config: c1…c20, by position. */
  id: string;
  label: string;
  iconId: ChoreIconId;
  /** Kid ids. Empty means unassigned (or everyone, on rotation charts). */
  assignees: string[];
  days: Day[];
  timeOfDay?: TimeOfDay;
  points?: number;
  /** Amount in `allowance.currency`, rounded to cents. */
  allowance?: number;
}

export interface RewardSettings {
  enabled: boolean;
  /** Number of stickers to reach the prize (5–30). */
  goal: number;
  prizeText: string;
}

export interface AllowanceSettings {
  enabled: boolean;
  currency: Currency;
}

export interface ChartConfig {
  type: ChartType;
  title: string;
  kids: Kid[];
  chores: Chore[];
  weekStart: WeekStart;
  showDates: boolean;
  /** ISO date (YYYY-MM-DD) of the first day shown, or null for "this week". */
  startDate: string | null;
  reward: RewardSettings;
  allowance: AllowanceSettings;
  theme: Theme;
  paper: PaperSize;
  orientation: Orientation;
  inkSaver: boolean;
  largeText: boolean;
}
