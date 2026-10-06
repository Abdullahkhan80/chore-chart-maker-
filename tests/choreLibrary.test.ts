import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGE_BANDS,
  AGE_MAX,
  AGE_MIN,
  CHORE_CATEGORIES,
  CHORE_LIBRARY,
  getAgeBand,
  getChoreById,
  getChoresForAge,
  searchChores,
} from '../src/lib/choreLibrary.ts';
import { ICON_IDS } from '../src/lib/icons.ts';
import { LIMITS, TIMES_OF_DAY } from '../src/lib/types.ts';

test('library has about 120 chores covering every category', () => {
  assert.ok(CHORE_LIBRARY.length >= 110 && CHORE_LIBRARY.length <= 140, `${CHORE_LIBRARY.length} chores`);
  for (const category of CHORE_CATEGORIES) {
    assert.ok(CHORE_LIBRARY.some((c) => c.category === category), `no chores in ${category}`);
  }
});

test('chore ids are unique kebab-case and labels are unique', () => {
  const ids = new Set<string>();
  const labels = new Set<string>();
  for (const chore of CHORE_LIBRARY) {
    assert.match(chore.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad id ${chore.id}`);
    assert.ok(!ids.has(chore.id), `duplicate id ${chore.id}`);
    assert.ok(!labels.has(chore.label.toLowerCase()), `duplicate label ${chore.label}`);
    ids.add(chore.id);
    labels.add(chore.label.toLowerCase());
  }
});

test('every chore fits the chart limits and references a known icon', () => {
  for (const chore of CHORE_LIBRARY) {
    assert.ok(chore.label.length > 0 && chore.label.length <= LIMITS.choreLabelLength, `${chore.id} label length`);
    assert.ok(ICON_IDS.has(chore.iconId), `${chore.id} uses unknown icon ${chore.iconId}`);
    assert.ok(CHORE_CATEGORIES.includes(chore.category), `${chore.id} category`);
    if (chore.timeOfDay !== undefined) assert.ok(TIMES_OF_DAY.includes(chore.timeOfDay), `${chore.id} timeOfDay`);
  }
});

test('age ranges are valid integers within AGE_MIN–AGE_MAX', () => {
  for (const chore of CHORE_LIBRARY) {
    assert.ok(Number.isInteger(chore.minAge) && Number.isInteger(chore.maxAge), `${chore.id} ages must be integers`);
    assert.ok(chore.minAge >= AGE_MIN && chore.maxAge <= AGE_MAX, `${chore.id} ages out of range`);
    assert.ok(chore.minAge <= chore.maxAge, `${chore.id} minAge > maxAge`);
  }
});

test('age bands are contiguous and cover AGE_MIN–AGE_MAX', () => {
  assert.equal(AGE_BANDS[0]!.minAge, AGE_MIN);
  assert.equal(AGE_BANDS.at(-1)!.maxAge, AGE_MAX);
  for (let i = 1; i < AGE_BANDS.length; i++) {
    assert.equal(AGE_BANDS[i]!.minAge, AGE_BANDS[i - 1]!.maxAge + 1, `gap before ${AGE_BANDS[i]!.id}`);
  }
  assert.equal(getAgeBand(5)?.id, '4-5');
  assert.equal(getAgeBand(14)?.id, '13-plus');
});

test('every age from 2 to 14 has enough chores to fill a chart', () => {
  for (let age = 2; age <= 14; age++) {
    assert.ok(getChoresForAge(age).length >= 10, `only ${getChoresForAge(age).length} chores for age ${age}`);
  }
});

test('getChoresForAge returns exactly the chores whose range includes the age', () => {
  for (let age = AGE_MIN; age <= AGE_MAX; age++) {
    const expected = CHORE_LIBRARY.filter((c) => c.minAge <= age && age <= c.maxAge).map((c) => c.id);
    assert.deepEqual(
      getChoresForAge(age).map((c) => c.id),
      expected,
      `age ${age}`,
    );
  }
});

test('getChoresForAge follows common age guidance', () => {
  const idsFor = (age: number) => new Set(getChoresForAge(age).map((c) => c.id));
  const expectations: [age: number, has: string[], lacks: string[]][] = [
    [2, ['put-toys-in-bin', 'clothes-in-hamper'], ['set-table', 'make-bed', 'mow-lawn', 'vacuum-room']],
    [3, ['put-toys-in-bin'], ['feed-pet', 'load-dishwasher']],
    [4, ['feed-pet', 'set-table'], ['make-bed', 'fold-laundry']],
    [5, ['feed-pet', 'set-table'], ['empty-dishwasher-utensils']],
    [6, ['make-bed', 'empty-dishwasher-utensils'], ['fold-laundry', 'pack-lunch']],
    [7, ['make-bed', 'empty-dishwasher-utensils'], ['vacuum-room']],
    [8, ['fold-laundry', 'pack-lunch'], ['cook-simple-meal', 'mow-lawn']],
    [9, ['fold-laundry', 'pack-lunch'], ['vacuum-room']],
    [10, ['vacuum-room', 'cook-simple-meal'], ['own-laundry', 'mow-lawn', 'help-feed-pet']],
    [12, ['vacuum-room', 'cook-simple-meal'], ['own-laundry', 'mow-lawn']],
    [13, ['own-laundry', 'mow-lawn'], ['put-toys-in-bin', 'stuffed-animals-on-bed']],
  ];
  for (const [age, has, lacks] of expectations) {
    const ids = idsFor(age);
    for (const id of [...has, ...lacks]) assert.ok(getChoreById(id), `test references unknown chore ${id}`);
    for (const id of has) assert.ok(ids.has(id), `age ${age} should include ${id}`);
    for (const id of lacks) assert.ok(!ids.has(id), `age ${age} should not include ${id}`);
  }
});

test('getChoresForAge clamps out-of-range ages and rejects non-numbers', () => {
  assert.deepEqual(getChoresForAge(0), getChoresForAge(AGE_MIN));
  assert.deepEqual(getChoresForAge(99), getChoresForAge(AGE_MAX));
  assert.deepEqual(getChoresForAge(5.9), getChoresForAge(5));
  assert.deepEqual(getChoresForAge(Number.NaN), []);
});

test('searchChores matches all words, ignores case and accents, ranks prefix matches first', () => {
  const ids = (q: string, age?: number) => searchChores(q, { age }).map((c) => c.id);
  assert.ok(ids('DISH').includes('load-dishwasher'));
  assert.ok(ids('dïshwàsher').includes('load-dishwasher'));
  assert.deepEqual(ids('make bed'), ['make-bed']);
  assert.ok(ids('pets').includes('feed-pet'), 'matches by category');
  assert.equal(searchChores('feed')[0]!.id.startsWith('feed') || searchChores('feed')[0]!.label.startsWith('Feed'), true);
  assert.deepEqual(ids(''), []);
  assert.deepEqual(ids('   '), []);
  assert.deepEqual(ids('zzzz-no-match'), []);
  assert.ok(!ids('laundry', 4).includes('own-laundry'), 'age filter applies');
  assert.doesNotThrow(() => searchChores('x'.repeat(100_000)));
  assert.doesNotThrow(() => searchChores('(.*+?[\\'));
});
