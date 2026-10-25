/**
 * The Yes or No card's subtitle on the English lesson screen. «Pick the answer that fits the picture» is only true
 * for a lesson whose Yes/No questions have pictures. Grade 4 Semester 1 Unit 4 (12 of 12) and Grade 9 Semester 1
 * Unit 4 (20 of 20) have none: their questions are plain, so the card there asks for the right answer to the question.
 * The screen imports react-native, so the rule is a pure helper in `englishHub/games.ts`; this pins it against the
 * lessons that really offer Yes/No and against what `buildYesNoRound` shows.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { grammarUnit, grammarUnitsForGrade, unitSentences } from '@workspace/curriculum/englishGrammar';
import { buildYesNoRound, grammarActivityAvailable, yesNoDescKey } from '../englishHub/games.ts';
import translations from '../i18n.ts';

const sentences = (id: string) => unitSentences(grammarUnit(id)!);

function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const offering = [1, 2, 3, 4, 5, 9, 10].flatMap(g => grammarUnitsForGrade(g).filter(u => grammarActivityAvailable('grammar-yesno', unitSentences(u))));

describe('Yes or No subtitle', () => {
  it('finds the lessons that offer Yes/No (premise)', () => {
    const ids = offering.map(u => u.lessonId);
    assert.ok(ids.includes('kbl-g4-eng-s1-nccd-u4_l1'));
    assert.ok(ids.includes('kbl-g9-eng-s1-nccd-u4_l1'));
    assert.ok(ids.includes('kbl-g2-eng-s1-nccd-u1_l1'));
  });

  it('says plain on Grade 4 Semester 1 Unit 4 and Grade 9 Semester 1 Unit 4, whose Yes/No questions have no picture', () => {
    for (const id of ['kbl-g4-eng-s1-nccd-u4_l1', 'kbl-g9-eng-s1-nccd-u4_l1']) {
      const s = sentences(id);
      assert.equal(s.filter(x => x.yesNo).some(x => x.picture), false, `${id} has a pictured Yes/No question, so the premise is gone`);
      assert.equal(yesNoDescKey(s), 'hubGYesNoDescPlain', id);
    }
  });

  it('keeps the picture copy on a Grade 2 and a Grade 3 lesson, whose Yes/No questions have pictures', () => {
    for (const id of ['kbl-g2-eng-s1-nccd-u1_l1', 'kbl-g2-eng-s2-nccd-u6_l1', 'kbl-g3-eng-s2-nccd-u9_l1', 'kbl-g4-eng-s1-nccd-u1_l1']) {
      assert.equal(yesNoDescKey(sentences(id)), 'hubGYesNoDesc', id);
    }
  });

  it('follows what the game shows, lesson by lesson, and a round never mixes the two kinds', () => {
    let pictured = 0;
    let plain = 0;
    for (const u of offering) {
      const s = unitSentences(u);
      const rng = seeded(u.lessonId.length * 7919);
      let shown = 0;
      let without = 0;
      for (let r = 0; r < 60; r++) {
        const round = buildYesNoRound(s, rng);
        for (const q of round) (q.picture !== null ? shown++ : without++);
        assert.ok(round.every(q => q.picture !== null) || round.every(q => q.picture === null), `${u.lessonId} mixes pictured and picture-free questions in one round`);
      }
      assert.equal(shown > 0 && without > 0, false, `${u.lessonId} mixes pictured and picture-free questions across rounds`);
      assert.equal(yesNoDescKey(s), shown > 0 ? 'hubGYesNoDesc' : 'hubGYesNoDescPlain', u.lessonId);
      if (shown > 0) pictured++; else plain++;
    }
    assert.ok(pictured > 0);
    assert.equal(plain, 2);
  });

  it('only a sentence that offers a Yes/No question counts: a pictured sentence without one does not', () => {
    const real = sentences('kbl-g2-eng-s1-nccd-u1_l1').find(x => x.yesNo && x.picture)!;
    assert.ok(real);
    assert.equal(yesNoDescKey([real]), 'hubGYesNoDesc');
    assert.equal(yesNoDescKey([{ ...real, yesNo: null }]), 'hubGYesNoDescPlain');
    assert.equal(yesNoDescKey([{ ...real, picture: null }]), 'hubGYesNoDescPlain');
    assert.equal(yesNoDescKey([]), 'hubGYesNoDescPlain');
  });

  it('has both keys in both languages, and the plain one does not mention a picture', () => {
    for (const lang of ['ar', 'en'] as const) {
      const t = translations[lang] as Record<string, unknown>;
      assert.equal(typeof t.hubGYesNoDesc, 'string');
      assert.equal(typeof t.hubGYesNoDescPlain, 'string');
    }
    assert.equal(translations.ar.hubGYesNoDescPlain, 'اختر الجواب الصحيح عن السؤال');
    assert.equal(translations.en.hubGYesNoDescPlain, 'Pick the right answer to the question');
  });
});
