/**
 * The True or false card's subtitle on the English lesson screen. «Does the sentence match the picture?» is only
 * true for a lesson whose sentences have pictures (Grades 1-4); Grades 5, 9 and 10 are hand-written items with no
 * picture at all, and there the card says right or wrong. The screen imports react-native, so the rule is a pure
 * helper in `englishHub/games.ts` and this pins it against the real lesson data.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { grammarUnit, grammarUnitsForGrade, unitSentences } from '@workspace/curriculum/englishGrammar';
import { buildTrueFalseRound, grammarActivityAvailable, trueFalseDescKey } from '../englishHub/games.ts';
import translations from '../i18n.ts';

const sentences = (id: string) => unitSentences(grammarUnit(id)!);
// The game shows a picture only for a sentence that has BOTH `picture` and `falsePicture`.
const hasPicture = (id: string) => sentences(id).some(s => s.picture && s.falsePicture);

/** A small deterministic generator, so a round is the same on every run. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('True or false subtitle', () => {
  it('keeps the picture copy on a Grade 1 lesson, whose sentences have pictures', () => {
    const units = grammarUnitsForGrade(1);
    assert.ok(units.length > 0);
    for (const u of units) {
      assert.equal(hasPicture(u.lessonId), true, u.lessonId);
      assert.equal(trueFalseDescKey(unitSentences(u)), 'hubGTrueDesc', u.lessonId);
    }
  });

  it('says right or wrong on an authored Grade 5, 9 and 10 lesson, which has no picture', () => {
    for (const id of ['kbl-g5-eng-s1-nccd-u1_l1', 'kbl-g9-eng-s1-nccd-u4_l1', 'kbl-eng-s1-nccd-u3_l1']) {
      assert.equal(hasPicture(id), false, `${id} has a picture, so the premise of this test is gone`);
      assert.equal(trueFalseDescKey(sentences(id)), 'hubGTrueDescPlain', id);
    }
  });

  it('says right or wrong on every Grade 5, 9 and 10 lesson', () => {
    for (const g of [5, 9, 10]) {
      for (const u of grammarUnitsForGrade(g)) {
        assert.equal(trueFalseDescKey(unitSentences(u)), 'hubGTrueDescPlain', u.lessonId);
      }
    }
  });

  it('follows what the game actually shows: a round with a picture keeps the picture copy, one without says right or wrong', () => {
    let pictured = 0;
    let plain = 0;
    for (const g of [1, 2, 3, 4, 5, 9, 10]) {
      for (const u of grammarUnitsForGrade(g)) {
        const s = unitSentences(u);
        if (!grammarActivityAvailable('grammar-true', s)) continue;
        const rng = seeded(g * 1000 + u.lessonId.length);
        // Enough rounds that every judgeable sentence of the lesson has been asked at least once.
        let shown = 0;
        let withoutPicture = 0;
        for (let r = 0; r < 60; r++) {
          const round = buildTrueFalseRound(s, rng);
          for (const q of round) (q.pictureWord !== null ? shown++ : withoutPicture++);
          // One round never mixes the two kinds, so one subtitle is true of all of it.
          assert.ok(round.every(q => q.pictureWord !== null) || round.every(q => q.pictureWord === null), `${u.lessonId} mixes pictured and picture-free questions in one round`);
        }
        assert.equal(shown > 0 && withoutPicture > 0, false, `${u.lessonId} mixes pictured and picture-free questions across rounds`);
        assert.equal(trueFalseDescKey(s), shown > 0 ? 'hubGTrueDesc' : 'hubGTrueDescPlain', u.lessonId);
        if (shown > 0) pictured++; else plain++;
      }
    }
    assert.ok(pictured > 0 && plain > 0);
  });

  it('a sentence with a picture but no false picture is not shown with a picture, so it does not earn the picture copy', () => {
    const real = sentences('kbl-g2-eng-s1-nccd-u1_l1').find(s => s.picture && s.falsePicture)!;
    assert.ok(real, 'premise: a pictured sentence with a false picture');
    assert.equal(trueFalseDescKey([real]), 'hubGTrueDesc');
    assert.equal(trueFalseDescKey([{ ...real, falsePicture: null }]), 'hubGTrueDescPlain');
    assert.equal(trueFalseDescKey([{ ...real, picture: null }]), 'hubGTrueDescPlain');
  });

  it('is the picture copy for no sentences at all only if none is pictured (empty list reads plain)', () => {
    assert.equal(trueFalseDescKey([]), 'hubGTrueDescPlain');
  });

  it('has both keys in both languages, and the plain one does not mention a picture', () => {
    for (const lang of ['ar', 'en'] as const) {
      const t = translations[lang] as Record<string, unknown>;
      assert.equal(typeof t.hubGTrueDesc, 'string');
      assert.equal(typeof t.hubGTrueDescPlain, 'string');
    }
    assert.equal(translations.ar.hubGTrueDescPlain, 'هل الجملة صحيحة أم خاطئة؟');
    assert.equal(translations.en.hubGTrueDescPlain, 'Is the sentence right or wrong?');
  });
});
