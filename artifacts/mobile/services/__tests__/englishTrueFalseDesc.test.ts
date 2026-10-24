/**
 * The True or false card's subtitle on the English lesson screen. «Does the sentence match the picture?» is only
 * true for a lesson whose sentences have pictures (Grades 1-4); Grades 5, 9 and 10 are hand-written items with no
 * picture at all, and there the card says right or wrong. The screen imports react-native, so the rule is a pure
 * helper in `englishHub/games.ts` and this pins it against the real lesson data.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { grammarUnit, grammarUnitsForGrade, unitSentences } from '@workspace/curriculum/englishGrammar';
import { trueFalseDescKey } from '../englishHub/games.ts';
import translations from '../i18n.ts';

const sentences = (id: string) => unitSentences(grammarUnit(id)!);
const hasPicture = (id: string) => sentences(id).some(s => s.picture);

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

  it('follows the data on Grades 2, 3 and 4: a lesson with a pictured sentence keeps the picture copy', () => {
    let pictured = 0;
    for (const g of [2, 3, 4]) {
      for (const u of grammarUnitsForGrade(g)) {
        const s = unitSentences(u);
        const expected = s.some(x => x.picture) ? 'hubGTrueDesc' : 'hubGTrueDescPlain';
        assert.equal(trueFalseDescKey(s), expected, u.lessonId);
        if (s.some(x => x.picture)) pictured++;
      }
    }
    assert.ok(pictured > 0);
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
