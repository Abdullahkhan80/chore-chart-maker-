import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChoreById } from '../src/lib/choreLibrary.ts';
import { choresForAgePreset } from '../src/lib/presets.ts';
import { QUICK_START_CHORES, buildQuickStartConfig } from '../src/lib/quickStart.ts';
import { decodeShareHash, encodeShareHash, validateConfig } from '../src/lib/state.ts';

const base = { name: '', age: null, choreIds: [], schedule: 'daily', theme: 'classic' };

test('every quick-start chore exists in the library', () => {
  for (const id of QUICK_START_CHORES) assert.ok(getChoreById(id), `unknown chore ${id}`);
});

test('builds a valid, shareable weekly chart from the answers', () => {
  const config = buildQuickStartConfig({
    ...base,
    name: '  Emma ',
    age: 6,
    choreIds: ['make-bed', 'feed-pet'],
    schedule: 'weekdays',
    theme: 'pastel',
  });
  assert.equal(config.type, 'weekly');
  assert.equal(config.title, "Emma's Chores");
  assert.equal(config.kids[0]!.name, 'Emma');
  assert.equal(config.kids[0]!.age, 6);
  assert.equal(config.theme, 'pastel');
  assert.deepEqual(config.chores.map((c) => c.label), ['Make the bed', 'Feed the pet']);
  for (const chore of config.chores) {
    assert.deepEqual(chore.days, ['mon', 'tue', 'wed', 'thu', 'fri']);
    assert.deepEqual(chore.assignees, ['k1']);
  }
  assert.deepEqual(validateConfig(config), config);
  assert.deepEqual(decodeShareHash(encodeShareHash(config)), config);
});

test('falls back to age suggestions, then to default chores', () => {
  const byAge = buildQuickStartConfig({ ...base, age: 9 });
  assert.deepEqual(
    byAge.chores.map((c) => c.label),
    choresForAgePreset(9, 6).map((id) => getChoreById(id)!.label),
  );
  const plain = buildQuickStartConfig(base);
  assert.ok(plain.chores.length > 0);
  assert.equal(plain.title, 'My Chores');
  assert.equal(plain.kids[0]!.name, 'Child 1');
});

test('ignores unknown chores, schedules, themes and out-of-range ages', () => {
  const config = buildQuickStartConfig({ ...base, age: 99, choreIds: ['nope'], schedule: 'hourly', theme: 'neon' });
  assert.equal(config.kids[0]!.age, undefined);
  assert.equal(config.theme, 'classic');
  assert.equal(config.chores[0]!.days.length, 7);
});
