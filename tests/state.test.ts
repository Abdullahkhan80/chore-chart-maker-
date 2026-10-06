import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HASH_LENGTH,
  SCHEMA_VERSION,
  STORAGE_KEY,
  createDefaultConfig,
  decodeShareHash,
  encodeShareHash,
  loadFromStorage,
  migrate,
  sanitizeText,
  saveToStorage,
  validateConfig,
} from '../src/lib/state.ts';
import { LIMITS, type ChartConfig } from '../src/lib/types.ts';

function fullConfig(): ChartConfig {
  return validateConfig({
    type: 'family',
    title: 'Ölçü family 🏡 chores',
    kids: [
      { id: 'a', name: 'Zoë', color: 'purple', avatarIcon: 'avatar-fox' },
      { id: 'b', name: '李小龙', color: 'green', avatarIcon: 'avatar-owl' },
      { id: 'c', name: 'Sam 👨‍👩‍👧', color: 'red', avatarIcon: 'avatar-rocket' },
    ],
    chores: [
      { label: 'Make the bed', iconId: 'bed', assignees: ['a', 'c'], days: ['mon', 'wed', 'fri'], timeOfDay: 'morning', points: 5, allowance: 0.25 },
      { label: 'Feed the cat', iconId: 'pet-bowl', assignees: ['b'], days: ['sun', 'sat'], points: 0 },
      { label: 'Trash', iconId: 'trash-can', assignees: [], days: [] },
    ],
    weekStart: 'mon',
    showDates: true,
    startDate: '2026-10-05',
    reward: { enabled: true, goal: 25, prizeText: 'Movie night' },
    allowance: { enabled: true, currency: 'GBP' },
    theme: 'pastel',
    paper: 'a4',
    orientation: 'portrait',
    inkSaver: true,
    largeText: true,
  });
}

/** Asserts every limit in LIMITS holds for a config. */
function assertWithinLimits(config: ChartConfig) {
  assert.ok(config.kids.length <= LIMITS.maxKids, 'too many kids');
  assert.ok(config.chores.length <= LIMITS.maxChores, 'too many chores');
  assert.ok(Array.from(config.title).length <= LIMITS.titleLength, 'title too long');
  assert.ok(Array.from(config.reward.prizeText).length <= LIMITS.prizeTextLength, 'prize too long');
  assert.ok(config.reward.goal >= LIMITS.rewardGoal.min && config.reward.goal <= LIMITS.rewardGoal.max, 'goal');
  const kidIds = new Set(config.kids.map((k) => k.id));
  for (const kid of config.kids) assert.ok(Array.from(kid.name).length <= LIMITS.kidNameLength, 'kid name too long');
  for (const chore of config.chores) {
    assert.ok(Array.from(chore.label).length <= LIMITS.choreLabelLength, 'chore label too long');
    for (const id of chore.assignees) assert.ok(kidIds.has(id), `dangling assignee ${id}`);
    if (chore.points !== undefined) assert.ok(chore.points >= 0 && chore.points <= LIMITS.points.max, 'points');
    if (chore.allowance !== undefined) assert.ok(chore.allowance >= 0 && chore.allowance <= LIMITS.allowance.max);
  }
  for (const text of [config.title, config.reward.prizeText, ...config.kids.map((k) => k.name), ...config.chores.map((c) => c.label)]) {
    assert.doesNotMatch(text, /\p{Cc}/u, `control character in ${JSON.stringify(text)}`);
  }
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

test('validateConfig is idempotent and keeps valid input', () => {
  const config = fullConfig();
  assert.deepEqual(validateConfig(config), config);
  assert.equal(config.kids[2]!.name, 'Sam 👨‍👩‍👧', 'keeps emoji with zero-width joiners');
  assert.deepEqual(config.chores[0]!.assignees, ['k1', 'k3'], 'remaps assignee ids');
  assert.deepEqual(config.chores[1]!.days, ['sat', 'sun'], 'sorts days');
});

test('validateConfig returns defaults for garbage input', () => {
  for (const input of [undefined, null, 42, 'x', [], true, { type: 'nope' }]) {
    assert.deepEqual(validateConfig(input), createDefaultConfig('weekly'));
  }
});

test('validateConfig clamps oversized and out-of-range values', () => {
  const config = validateConfig({
    title: 'T'.repeat(500),
    kids: Array.from({ length: 50 }, (_, i) => ({ id: `x${i}`, name: 'N'.repeat(200), color: 'chartreuse', avatarIcon: '../../etc/passwd' })),
    chores: Array.from({ length: 500 }, () => ({
      label: 'L'.repeat(1000),
      iconId: '<svg onload=alert(1)>',
      assignees: ['x0', 'x0', 'ghost', 7, null],
      days: ['mon', 'funday', 'mon'],
      points: 1e9,
      allowance: -5,
      timeOfDay: 'midnight',
    })),
    reward: { enabled: 'yes', goal: 1000, prizeText: 'P'.repeat(100) },
    allowance: { enabled: true, currency: 'BTC' },
    startDate: '2026-02-31',
    paper: 'tabloid',
  });
  assertWithinLimits(config);
  assert.equal(config.kids.length, LIMITS.maxKids);
  assert.equal(config.chores.length, LIMITS.maxChores);
  assert.equal(config.kids[0]!.color, 'teal');
  assert.equal(config.kids[0]!.avatarIcon, 'avatar-bear');
  const chore = config.chores[0]!;
  assert.equal(chore.iconId, 'star');
  assert.deepEqual(chore.assignees, ['k1']);
  assert.deepEqual(chore.days, ['mon']);
  assert.equal(chore.points, LIMITS.points.max);
  assert.equal(chore.allowance, 0);
  assert.equal(chore.timeOfDay, undefined);
  assert.equal(config.reward.enabled, false);
  assert.equal(config.reward.goal, LIMITS.rewardGoal.max);
  assert.equal(config.allowance.currency, 'USD');
  assert.equal(config.startDate, null);
  assert.equal(config.paper, 'letter');
  assert.equal(validateConfig({ reward: { goal: 1 } }).reward.goal, LIMITS.rewardGoal.min);
  assert.equal(validateConfig({ reward: { goal: Number.NaN } }).reward.goal, LIMITS.rewardGoal.default);
});

test('sanitizeText strips control and bidi characters and truncates by code point', () => {
  const nul = String.fromCharCode(0);
  const rlo = String.fromCharCode(0x202e);
  const zwsp = String.fromCharCode(0x200b);
  assert.equal(sanitizeText(`  Ann${nul}a\t\n\rB${rlo}ob${zwsp}  `, 20), 'Ann a Bob');
  assert.equal(sanitizeText('a'.repeat(30), 20), 'a'.repeat(20));
  assert.equal(sanitizeText('😀'.repeat(30), 20), '😀'.repeat(20), 'does not split surrogate pairs');
  assert.equal(sanitizeText(123, 20), '');
  assert.equal(sanitizeText('<b>hi</b>', 20), '<b>hi</b>', 'text is stored as-is; escaping happens at render time');
});

test('share hash round-trips a full config', () => {
  const config = fullConfig();
  const hash = encodeShareHash(config);
  assert.match(hash, /^v1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeShareHash(hash), config);
  assert.deepEqual(decodeShareHash(`#${hash}`), config, 'accepts a leading #');
  assert.deepEqual(decodeShareHash(encodeShareHash(createDefaultConfig('reward'))), createDefaultConfig('reward'));
});

test('a maximal config still fits in a share hash', () => {
  const config = validateConfig({
    title: '界'.repeat(100),
    kids: Array.from({ length: 8 }, (_, i) => ({ id: `${i}`, name: '界'.repeat(30) })),
    chores: Array.from({ length: 20 }, () => ({
      label: '界'.repeat(60),
      assignees: ['0', '1', '2', '3', '4', '5', '6', '7'],
      points: 100,
      allowance: 99.99,
    })),
    reward: { prizeText: '界'.repeat(60) },
  });
  const hash = encodeShareHash(config);
  assert.ok(hash.length <= MAX_HASH_LENGTH, `hash is ${hash.length} chars`);
  assert.deepEqual(decodeShareHash(hash), config);
});

test('malicious or malformed hashes are rejected or clamped', () => {
  const encodeJson = (json: string) => 'v1.' + Buffer.from(json, 'utf8').toString('base64url');
  const encode = (value: unknown) => encodeJson(JSON.stringify(value));

  const malformed = [
    '',
    '#',
    'v1.',
    'v2.eyJ9',
    'v1.%%%',
    'v1.!!!',
    'v1.' + 'A'.repeat(MAX_HASH_LENGTH),
    'v1.bm90IGpzb24',
    encode([1, 2]),
    encode('str'),
    encode(null),
  ];
  for (const bad of malformed) {
    assert.equal(decodeShareHash(bad), null, `expected null for ${bad.slice(0, 40)}`);
  }
  assert.equal(decodeShareHash('v1.' + Buffer.from([0xff, 0xfe, 0xfd]).toString('base64url')), null, 'invalid UTF-8');

  // Over every limit, but small enough to pass the hash length check and reach validation.
  // "__proto__" is spliced into the raw JSON: in an object literal it would set the prototype instead.
  const hostileJson = JSON.stringify({
    t: 99,
    n: `Pwn${String.fromCharCode(0)}${'x'.repeat(200)}`,
    k: Array.from({ length: 20 }, () => ['K'.repeat(30), 999, -1]),
    c: Array.from({ length: 30 }, () => ['C'.repeat(50), 1e6, 0xffffffff, 0x7fffffff, 42, 1e12, 1e12]),
    r: [1, 99999, 'R'.repeat(100)],
    a: [1, 77],
    s: '9999-99-99',
    constructor: { prototype: { polluted: true } },
  }).replace('{', '{"__proto__":{"polluted":true},');
  const hostileHash = encodeJson(hostileJson);
  assert.ok(hostileHash.length < MAX_HASH_LENGTH, `hostile hash is ${hostileHash.length} chars`);
  const hostile = decodeShareHash(hostileHash);
  assert.ok(hostile, 'hostile but well-formed payload decodes to a clamped config');
  assertWithinLimits(hostile);
  assert.equal(hostile.type, 'weekly');
  assert.equal(hostile.startDate, null);
  assert.equal(({} as Record<string, unknown>).polluted, undefined, 'no prototype pollution');
  assert.equal(decodeShareHash('x'.repeat(MAX_HASH_LENGTH + 1)), null);
});

test('localStorage round-trip uses the versioned key', () => {
  const storage = memoryStorage();
  const config = fullConfig();
  assert.equal(saveToStorage(storage, config), true);
  const stored = JSON.parse(storage.data.get(STORAGE_KEY)!) as { v: number };
  assert.equal(STORAGE_KEY, 'chorechartmaker-chore-chart-v1');
  assert.equal(stored.v, SCHEMA_VERSION);
  assert.deepEqual(loadFromStorage(storage), config);
});

test('loadFromStorage tolerates missing, corrupt and future data', () => {
  const storage = memoryStorage();
  assert.equal(loadFromStorage(storage), null);
  storage.data.set(STORAGE_KEY, '{not json');
  assert.equal(loadFromStorage(storage), null);
  storage.data.set(STORAGE_KEY, JSON.stringify({ v: SCHEMA_VERSION + 1, config: {} }));
  assert.equal(loadFromStorage(storage), null, 'unknown future version');
  storage.data.set(STORAGE_KEY, JSON.stringify({ v: 1, config: { kids: 'nope', title: 7 } }));
  assert.deepEqual(loadFromStorage(storage), createDefaultConfig('weekly'));

  const throwing = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  };
  assert.equal(loadFromStorage(throwing), null);
  assert.equal(saveToStorage(throwing, fullConfig()), false);
});

test('migrate validates current-version payloads and rejects unknown versions', () => {
  assert.deepEqual(migrate({ v: 1, config: fullConfig() }), fullConfig());
  assert.equal(migrate({ v: 0, config: {} }), null);
  assert.equal(migrate({ v: 1.5, config: {} }), null);
  assert.equal(migrate({ config: {} }), null);
  assert.equal(migrate(null), null);
});
