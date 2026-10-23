import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR_UNITS_G5, NOT_COVERED_G5 } from '../englishGrammarG5.ts';
import { offeredGrammar } from '../englishGrammar.ts';

describe('Grade 5 grammar units', () => {
  it('are the ten grammar lessons of the hub, in hub order, all unsigned', () => {
    const L = (s: string) => `kbl-g5-eng-${s}`;
    const hubOrder = ['s1-nccd-u1_l1', 's1-nccd-u2_l1', 's1-nccd-u3_l1', 's1-nccd-u4_l1', 's1-nccd-u5_l1',
      's2-nccd-u6_l1', 's2-nccd-u7_l1', 's2-nccd-u8_l1', 's2-nccd-u9_l1', 's2-nccd-u10_l1'].map(L);
    assert.deepEqual(GRAMMAR_UNITS_G5.map(u => u.lessonId), hubOrder);
    for (const u of GRAMMAR_UNITS_G5) {
      assert.equal(u.reviewedBy, null, u.lessonId);
      assert.equal(offeredGrammar(u.lessonId), null, u.lessonId);
      assert.deepEqual(u.patterns, []);
    }
  });
  it('have a not-covered note each, in plain text the form can print', () => {
    for (const u of GRAMMAR_UNITS_G5) {
      const notes = NOT_COVERED_G5[u.lessonId];
      assert.ok(notes && notes.length >= 3, u.lessonId);
      for (const n of notes) assert.ok(!/["&<>]/.test(n), `${u.lessonId}: ${n}`);
    }
    assert.deepEqual(Object.keys(NOT_COVERED_G5).sort(), GRAMMAR_UNITS_G5.map(u => u.lessonId).sort());
  });
});
