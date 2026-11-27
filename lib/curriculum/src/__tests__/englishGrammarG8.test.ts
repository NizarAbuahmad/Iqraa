import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR_UNITS_G8, NOT_COVERED_G8 } from '../englishGrammarG8.ts';
import { offeredGrammar } from '../englishGrammar.ts';

const IDS = ['u1_l1', 'u1_l3', 'u2_l1', 'u2_l3', 'u3_l1'].map(s => `kbl-g8-eng-s1-nccd-${s}`);

describe('Grade 8 grammar units', () => {
  it('are the grammar lessons in hub order, all unsigned', () => {
    assert.deepEqual(GRAMMAR_UNITS_G8.map(u => u.lessonId), IDS);
    for (const u of GRAMMAR_UNITS_G8) {
      assert.equal(u.reviewedBy, null, u.lessonId);
      assert.equal(offeredGrammar(u.lessonId), null, u.lessonId);
      assert.deepEqual(u.patterns, []);
    }
  });
  it('have a not-covered note each, in plain text the form can print', () => {
    assert.deepEqual(Object.keys(NOT_COVERED_G8).sort(), [...IDS].sort());
    for (const id of IDS) {
      const notes = NOT_COVERED_G8[id]!;
      assert.ok(notes.length >= 3, id);
      for (const n of notes) {
        assert.ok(!/["&<>]/.test(n), `${id}: ${n}`);
        assert.ok(!/[ء-ي]و[A-Za-z]|(^|\s)و[A-Za-z]/.test(n), `${id}: «و» glued to an English word: ${n}`);
      }
    }
  });
});
