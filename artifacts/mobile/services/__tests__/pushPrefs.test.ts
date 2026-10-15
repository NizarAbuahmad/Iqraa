import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { normalizePushPrefs, PUSH_PREF_ROWS, showsFamilyPushPrefs, withPref } from '../pushPrefs.ts';

describe('normalizePushPrefs', () => {
  it('reads the server body', () => {
    assert.deepEqual(normalizePushPrefs({ preferences: { homework: false, exams: true, results: true } }), {
      homework: false,
      exams: true,
      results: true,
    });
  });
  it('reads a missing or malformed switch as on, like the server', () => {
    assert.deepEqual(normalizePushPrefs({ preferences: { exams: 'no' } }), { homework: true, exams: true, results: true });
  });
  it('refuses a body that is not the shape', () => {
    for (const bad of [null, {}, { preferences: null }, { preferences: [] }, 'x']) {
      assert.equal(normalizePushPrefs(bad), null, JSON.stringify(bad));
    }
  });
});

describe('withPref', () => {
  it('changes one switch and leaves the original alone', () => {
    const before = { homework: true, exams: true, results: true };
    assert.deepEqual(withPref(before, 'exams', false), { homework: true, exams: false, results: true });
    assert.deepEqual(before, { homework: true, exams: true, results: true });
  });
});

describe('showsFamilyPushPrefs', () => {
  it('is for parents and students only — nobody else is sent these', () => {
    assert.equal(showsFamilyPushPrefs('parent'), true);
    assert.equal(showsFamilyPushPrefs('student'), true);
    for (const role of ['teacher', 'school_admin', 'system_admin', null, undefined]) {
      assert.equal(showsFamilyPushPrefs(role), false, String(role));
    }
  });
});

describe('PUSH_PREF_ROWS', () => {
  it('has one row per category, in the order Settings shows them', () => {
    assert.deepEqual(PUSH_PREF_ROWS.map(r => r.category), ['homework', 'exams', 'results']);
  });
});
