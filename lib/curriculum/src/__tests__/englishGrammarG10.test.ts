import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR_UNITS_G10, NOT_COVERED_G10 } from '../englishGrammarG10.ts';
import { offeredGrammar } from '../englishGrammar.ts';

const IDS = ['u1_l1', 'u1_l5', 'u2_l1', 'u2_l4', 'u3_l1', 'u3_l4', 'u3_l5', 'u4_l1', 'u4_l4', 'u5_l1', 'u5_l3'].map(s => `kbl-eng-s1-nccd-${s}`);

describe('Grade 10 grammar units', () => {
  it('are the eleven grammar lessons, in hub order, all unsigned', () => {
    assert.deepEqual(GRAMMAR_UNITS_G10.map(u => u.lessonId), IDS);
    for (const u of GRAMMAR_UNITS_G10) {
      assert.equal(u.reviewedBy, null, u.lessonId);
      assert.equal(offeredGrammar(u.lessonId), null, u.lessonId);
      assert.deepEqual(u.patterns, []);
    }
  });
  it('have a not-covered note each, in plain text the form can print', () => {
    assert.deepEqual(Object.keys(NOT_COVERED_G10).sort(), [...IDS].sort());
    for (const id of IDS) {
      const notes = NOT_COVERED_G10[id];
      assert.ok(notes.length >= 3, id);
      for (const n of notes) {
        assert.ok(!/["&<>]/.test(n), `${id}: ${n}`);
        assert.ok(!/[ء-ي]و[A-Za-z]|(^|\s)و[A-Za-z]/.test(n), `${id}: «و» glued to an English word: ${n}`);
      }
    }
  });
});
