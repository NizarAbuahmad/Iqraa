import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GRAMMAR_UNITS_G8, NOT_COVERED_G8 } from '../englishGrammarG8.ts';
import { grammarUnit, offeredGrammar, unitSentences } from '../englishGrammar.ts';

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
  it('print an adverb example in the u1_l3 note that the adverb-position rows really test, never be + adverb', () => {
    const note = NOT_COVERED_G8['kbl-g8-eng-s1-nccd-u1_l3']!.join(' ');
    assert.ok(!/\b(is|are) (always|usually|often|never)\b|\b(always|usually|often|never) (is|are)\b/i.test(note), note);
    const rows = unitSentences(grammarUnit('kbl-g8-eng-s1-nccd-u1_l3')!).filter(x => x.patternId === 'adverb-position');
    const right = /\(([a-z ]+?) \u0644\u0627 ([a-z ]+?)\)/.exec(note);
    assert.ok(right, 'the note has a (right لا wrong) example');
    assert.ok(rows.some(x => x.text.toLowerCase().includes(right![1]!) && x.claim!.falseText.toLowerCase().includes(right![2]!)), 'a row tests this example');
  });
  it('give every can-vs-cant sentence its own verb and object after the modal', () => {
    const tails = unitSentences(grammarUnit('kbl-g8-eng-s1-nccd-u2_l3')!)
      .filter(x => x.patternId === 'can-vs-cant')
      .map(x => x.text.replace(/^.*\bcan(?:'t)?\s/, ''));
    assert.equal(new Set(tails).size, tails.length, tails.join(' | '));
  });
});
