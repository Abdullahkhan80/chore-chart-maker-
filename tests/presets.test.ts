import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE_PRESETS, PRESET_IDS, choresForAgePreset, getPreset } from '../src/lib/presets.ts';
import { getChoreById } from '../src/lib/choreLibrary.ts';
import { AGE_PAGE_AGES, agePagePath } from '../src/lib/pages.ts';
import { decodeShareHash, encodeShareHash, validateConfig } from '../src/lib/state.ts';
import { CHART_TYPES } from '../src/lib/types.ts';

test('every preset is already valid, non-empty and shareable', () => {
  for (const id of PRESET_IDS) {
    const preset = getPreset(id);
    assert.ok(preset, `preset ${id} missing`);
    assert.deepEqual(validateConfig(preset), preset, `preset ${id} changes when validated`);
    assert.ok(preset.kids.length > 0, `preset ${id} has no kids`);
    assert.ok(preset.chores.length > 0, `preset ${id} has no chores`);
    assert.ok(preset.title.length > 0, `preset ${id} has no title`);
    for (const chore of preset.chores) assert.ok(chore.label.length > 0, `preset ${id} has an empty chore`);
    assert.deepEqual(decodeShareHash(encodeShareHash(preset)), preset, `preset ${id} share round-trip`);
  }
});

test('there is a preset for each chart type and the required landing presets', () => {
  for (const id of [...CHART_TYPES, 'reward', 'roommates', 'morning-routine', 'age-5']) {
    assert.ok(PRESET_IDS.includes(id), `missing preset ${id}`);
  }
  for (const type of CHART_TYPES) assert.equal(getPreset(type)!.type, type);
  assert.equal(getPreset('reward')!.reward.enabled, true);
  assert.equal(getPreset('roommates')!.type, 'rotation');
});

test('every landing page maps to an existing preset', () => {
  for (const [path, presetId] of Object.entries(PAGE_PRESETS)) {
    assert.ok(PRESET_IDS.includes(presetId), `${path} maps to unknown preset ${presetId}`);
  }
  for (const age of AGE_PAGE_AGES) assert.equal(PAGE_PRESETS[agePagePath(age)], `age-${age}`);
});

test('age presets only use chores suitable for that age', () => {
  for (let age = 2; age <= 14; age++) {
    const ids = choresForAgePreset(age);
    assert.equal(new Set(ids).size, ids.length, `age ${age} has duplicate chores`);
    for (const id of ids) {
      const chore = getChoreById(id)!;
      assert.ok(chore.minAge <= age && age <= chore.maxAge, `${id} is not suitable for age ${age}`);
    }
    assert.ok(getPreset(`age-${age}`), `missing preset age-${age}`);
  }
});

test('getPreset rejects unknown and hostile ids', () => {
  for (const id of ['nope', '__proto__', 'constructor', 'toString', 'age-99', '', null, undefined, 5, {}]) {
    assert.equal(getPreset(id), null, `getPreset(${String(id)})`);
  }
});

test('getPreset returns a fresh copy each time', () => {
  const a = getPreset('weekly')!;
  a.kids[0]!.name = 'changed';
  assert.notEqual(getPreset('weekly')!.kids[0]!.name, 'changed');
});
