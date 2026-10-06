// Chart state: validation/clamping, localStorage persistence and share-link hashes.
// Treat every input (URL hash, localStorage, form values) as untrusted: validateConfig()
// never throws and always returns a config within LIMITS.
import { AVATAR_ICON_IDS, CHORE_ICON_IDS, type AvatarIconId, type ChoreIconId } from './icons.ts';
import {
  CHART_TYPES,
  CURRENCIES,
  DAYS,
  FAMILY_LAYOUTS,
  KID_COLORS,
  LIMITS,
  ORIENTATIONS,
  PAPER_SIZES,
  THEMES,
  TIMES_OF_DAY,
  WEEK_STARTS,
  type ChartConfig,
  type ChartType,
  type Chore,
  type Day,
  type Kid,
} from './types.ts';

export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'chorechartmaker-chore-chart-v1';
/** Share hashes longer than this are rejected before decoding. */
export const MAX_HASH_LENGTH = 8000;
const HASH_PREFIX = `v${SCHEMA_VERSION}.`;

const DEFAULT_TITLES: Record<ChartType, string> = {
  weekly: 'Weekly Chore Chart',
  routine: 'Daily Routine',
  reward: 'Reward Chart',
  family: 'Family Chore Chart',
  rotation: 'Chore Rotation',
};

export function createDefaultConfig(type: ChartType = 'weekly'): ChartConfig {
  return {
    type,
    title: DEFAULT_TITLES[type],
    kids: [],
    chores: [],
    weekStart: 'sun',
    showDates: false,
    startDate: null,
    reward: { enabled: type === 'reward', goal: LIMITS.rewardGoal.default, prizeText: '' },
    allowance: { enabled: false, currency: 'USD' },
    theme: 'classic',
    familyLayout: 'combined',
    paper: 'letter',
    orientation: type === 'routine' ? 'portrait' : 'landscape',
    inkSaver: false,
    largeText: false,
  };
}

// ---------------------------------------------------------------------------
// Validation helpers

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function clampNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = clampNumber(value, min, max);
  return n === undefined ? fallback : Math.round(n);
}

const ZERO_WIDTH_JOINER = String.fromCharCode(0x200d);

/**
 * Plain single-line text: strips control and format characters (keeping the
 * zero-width joiner used by emoji), collapses whitespace and truncates to
 * `maxLength` code points without splitting surrogate pairs.
 */
export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  const cleaned = value
    .slice(0, maxLength * 8) // bound the work on huge inputs
    .normalize('NFC')
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\p{Cf}/gu, (char) => (char === ZERO_WIDTH_JOINER ? char : ''))
    .replace(/\s+/gu, ' ')
    .trim();
  return Array.from(cleaned).slice(0, maxLength).join('').trim();
}

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateDays(value: unknown): Day[] {
  if (!Array.isArray(value)) return [...DAYS];
  const set = new Set(value.slice(0, 50));
  return DAYS.filter((day) => set.has(day));
}

// ---------------------------------------------------------------------------
// Validation

/**
 * Returns a valid ChartConfig from any input. Unknown fields are dropped, values
 * are clamped to LIMITS, and kid/chore ids are renumbered k1…/c1… by position
 * (assignees are remapped to match).
 */
export function validateConfig(input: unknown): ChartConfig {
  const raw = isRecord(input) ? input : {};
  const type = pick(raw.type, CHART_TYPES, 'weekly');
  const base = createDefaultConfig(type);

  const kidIdMap = new Map<string, string>();
  const rawKids = Array.isArray(raw.kids) ? raw.kids.slice(0, LIMITS.maxKids) : [];
  const kids: Kid[] = rawKids.filter(isRecord).map((kid, index) => {
    const id = `k${index + 1}`;
    if (typeof kid.id === 'string' && !kidIdMap.has(kid.id)) kidIdMap.set(kid.id, id);
    const age = clampNumber(kid.age, LIMITS.kidAge.min, LIMITS.kidAge.max);
    return {
      id,
      name: sanitizeText(kid.name, LIMITS.kidNameLength),
      color: pick(kid.color, KID_COLORS, KID_COLORS[index % KID_COLORS.length]!),
      avatarIcon: pick<AvatarIconId>(kid.avatarIcon, AVATAR_ICON_IDS, AVATAR_ICON_IDS[index % AVATAR_ICON_IDS.length]!),
      ...(age === undefined ? {} : { age: Math.round(age) }),
    };
  });

  const rawChores = Array.isArray(raw.chores) ? raw.chores.slice(0, LIMITS.maxChores) : [];
  const chores: Chore[] = rawChores.filter(isRecord).map((chore, index) => {
    const assignees = Array.isArray(chore.assignees)
      ? [
          ...new Set(
            chore.assignees
              .slice(0, LIMITS.maxKids * 4)
              .map((id) => (typeof id === 'string' ? kidIdMap.get(id) : undefined))
              .filter((id): id is string => id !== undefined),
          ),
        ]
      : [];
    const result: Chore = {
      id: `c${index + 1}`,
      label: sanitizeText(chore.label, LIMITS.choreLabelLength),
      iconId: pick<ChoreIconId>(chore.iconId, CHORE_ICON_IDS, 'star'),
      assignees,
      days: validateDays(chore.days),
    };
    if (typeof chore.timeOfDay === 'string' && (TIMES_OF_DAY as readonly string[]).includes(chore.timeOfDay)) {
      result.timeOfDay = chore.timeOfDay as Chore['timeOfDay'];
    }
    const points = clampNumber(chore.points, LIMITS.points.min, LIMITS.points.max);
    if (points !== undefined) result.points = Math.round(points);
    const allowance = clampNumber(chore.allowance, LIMITS.allowance.min, LIMITS.allowance.max);
    if (allowance !== undefined) result.allowance = Math.round(allowance * 100) / 100;
    return result;
  });

  const reward = isRecord(raw.reward) ? raw.reward : {};
  const allowance = isRecord(raw.allowance) ? raw.allowance : {};
  const title = sanitizeText(raw.title, LIMITS.titleLength);

  return {
    type,
    title: typeof raw.title === 'string' ? title : base.title,
    kids,
    chores,
    weekStart: pick(raw.weekStart, WEEK_STARTS, base.weekStart),
    showDates: bool(raw.showDates, base.showDates),
    startDate: isValidIsoDate(raw.startDate) ? raw.startDate : null,
    reward: {
      enabled: bool(reward.enabled, base.reward.enabled),
      goal: clampInt(reward.goal, LIMITS.rewardGoal.min, LIMITS.rewardGoal.max, base.reward.goal),
      prizeText: sanitizeText(reward.prizeText, LIMITS.prizeTextLength),
    },
    allowance: {
      enabled: bool(allowance.enabled, base.allowance.enabled),
      currency: pick(allowance.currency, CURRENCIES, base.allowance.currency),
    },
    theme: pick(raw.theme, THEMES, base.theme),
    familyLayout: pick(raw.familyLayout, FAMILY_LAYOUTS, base.familyLayout),
    paper: pick(raw.paper, PAPER_SIZES, base.paper),
    orientation: pick(raw.orientation, ORIENTATIONS, base.orientation),
    inkSaver: bool(raw.inkSaver, base.inkSaver),
    largeText: bool(raw.largeText, base.largeText),
  };
}

// ---------------------------------------------------------------------------
// Versioned envelope and migrations

interface Envelope {
  v: number;
  config: unknown;
}

/**
 * Upgrades a stored payload to the current schema. Add a step here when
 * SCHEMA_VERSION is bumped (e.g. `if (v === 1) { config = from1to2(config); v = 2; }`).
 * Returns null for payloads from a newer, unknown version.
 */
export function migrate(payload: unknown): ChartConfig | null {
  if (!isRecord(payload) || typeof payload.v !== 'number' || !Number.isInteger(payload.v)) return null;
  const v = payload.v;
  if (v < 1 || v > SCHEMA_VERSION) return null;
  return validateConfig(payload.config);
}

// ---------------------------------------------------------------------------
// localStorage

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Saves the config; returns false if storage is unavailable or full. */
export function saveToStorage(storage: StorageLike, config: ChartConfig): boolean {
  try {
    const envelope: Envelope = { v: SCHEMA_VERSION, config: validateConfig(config) };
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
}

/** Loads the saved config, or null if nothing valid is stored. */
export function loadFromStorage(storage: StorageLike): ChartConfig | null {
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (text === null || text.length > MAX_HASH_LENGTH * 4) return null;
    return migrate(JSON.parse(text));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Share-link hash: "#v1.<base64url(JSON of the compact form)>"
//
// The compact form drops ids and uses short keys, bitmasks for days and
// assignees (by kid index), and index numbers for enum values.

type Compact = UnknownRecord;

function dayMask(days: readonly Day[]): number {
  return days.reduce((mask, day) => mask | (1 << DAYS.indexOf(day)), 0);
}

function daysFromMask(mask: unknown): Day[] | undefined {
  if (typeof mask !== 'number' || !Number.isInteger(mask)) return undefined;
  return DAYS.filter((_, i) => (mask & (1 << i)) !== 0);
}

function enumIndex<T>(values: readonly T[], value: T): number {
  return values.indexOf(value);
}

function enumAt<T>(values: readonly T[], index: unknown): T | undefined {
  return typeof index === 'number' && Number.isInteger(index) ? values[index] : undefined;
}

function toCompact(config: ChartConfig): Compact {
  const kidIndex = new Map(config.kids.map((kid, i) => [kid.id, i]));
  return {
    t: enumIndex(CHART_TYPES, config.type),
    n: config.title,
    k: config.kids.map((kid) => [
      kid.name,
      enumIndex(KID_COLORS, kid.color),
      enumIndex(AVATAR_ICON_IDS, kid.avatarIcon),
      kid.age ?? -1,
    ]),
    c: config.chores.map((chore) => [
      chore.label,
      enumIndex(CHORE_ICON_IDS, chore.iconId),
      chore.assignees.reduce((mask, id) => mask | (1 << (kidIndex.get(id) ?? 31)), 0) & 0xff,
      dayMask(chore.days),
      chore.timeOfDay === undefined ? -1 : enumIndex(TIMES_OF_DAY, chore.timeOfDay),
      chore.points ?? -1,
      chore.allowance ?? -1,
    ]),
    w: enumIndex(WEEK_STARTS, config.weekStart),
    d: config.showDates ? 1 : 0,
    s: config.startDate ?? 0,
    r: [config.reward.enabled ? 1 : 0, config.reward.goal, config.reward.prizeText],
    a: [config.allowance.enabled ? 1 : 0, enumIndex(CURRENCIES, config.allowance.currency)],
    h: enumIndex(THEMES, config.theme),
    y: enumIndex(FAMILY_LAYOUTS, config.familyLayout),
    p: enumIndex(PAPER_SIZES, config.paper),
    o: enumIndex(ORIENTATIONS, config.orientation),
    f: (config.inkSaver ? 1 : 0) | (config.largeText ? 2 : 0),
  };
}

/** Expands the compact form into a loose object; validateConfig() does the real checking. */
function fromCompact(compact: unknown): unknown {
  if (!isRecord(compact)) return null;
  const at = (value: unknown, i: number) => (Array.isArray(value) ? value[i] : undefined);
  const flag = (value: unknown) => (typeof value === 'number' ? value === 1 : undefined);
  const kidsRaw = Array.isArray(compact.k) ? compact.k.slice(0, LIMITS.maxKids) : [];
  const kids = kidsRaw.map((kid, i) => ({
    id: `k${i + 1}`,
    name: at(kid, 0),
    color: enumAt(KID_COLORS, at(kid, 1)),
    avatarIcon: enumAt(AVATAR_ICON_IDS, at(kid, 2)),
    age: (at(kid, 3) as number) >= 0 ? at(kid, 3) : undefined,
  }));
  const choresRaw = Array.isArray(compact.c) ? compact.c.slice(0, LIMITS.maxChores) : [];
  const chores = choresRaw.map((chore) => {
    const mask = at(chore, 2);
    return {
      label: at(chore, 0),
      iconId: enumAt(CHORE_ICON_IDS, at(chore, 1)),
      assignees: typeof mask === 'number' ? kids.filter((_, i) => (mask & (1 << i)) !== 0).map((kid) => kid.id) : [],
      days: daysFromMask(at(chore, 3)),
      timeOfDay: enumAt(TIMES_OF_DAY, at(chore, 4)),
      points: (at(chore, 5) as number) >= 0 ? at(chore, 5) : undefined,
      allowance: (at(chore, 6) as number) >= 0 ? at(chore, 6) : undefined,
    };
  });
  const flags = typeof compact.f === 'number' ? compact.f : 0;
  return {
    type: enumAt(CHART_TYPES, compact.t),
    title: compact.n,
    kids,
    chores,
    weekStart: enumAt(WEEK_STARTS, compact.w),
    showDates: flag(compact.d),
    startDate: compact.s,
    reward: { enabled: flag(at(compact.r, 0)), goal: at(compact.r, 1), prizeText: at(compact.r, 2) },
    allowance: { enabled: flag(at(compact.a, 0)), currency: enumAt(CURRENCIES, at(compact.a, 1)) },
    theme: enumAt(THEMES, compact.h),
    familyLayout: enumAt(FAMILY_LAYOUTS, compact.y),
    paper: enumAt(PAPER_SIZES, compact.p),
    orientation: enumAt(ORIENTATIONS, compact.o),
    inkSaver: (flags & 1) !== 0,
    largeText: (flags & 2) !== 0,
  };
}

function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(encoded: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/.test(encoded)) return null;
  try {
    const binary = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** Hash for a share link, without the leading "#". */
export function encodeShareHash(config: ChartConfig): string {
  return HASH_PREFIX + base64UrlEncode(JSON.stringify(toCompact(validateConfig(config))));
}

/** Decodes a share hash (with or without "#"); null if it is missing, oversized or malformed. */
export function decodeShareHash(hash: string): ChartConfig | null {
  if (typeof hash !== 'string' || hash.length > MAX_HASH_LENGTH) return null;
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!body.startsWith(HASH_PREFIX)) return null;
  const json = base64UrlDecode(body.slice(HASH_PREFIX.length));
  if (json === null) return null;
  try {
    const expanded = fromCompact(JSON.parse(json));
    return expanded === null ? null : validateConfig(expanded);
  } catch {
    return null;
  }
}
