/**
 * Grade 5 grammar on the ten authored hub lessons (spec: docs/superpowers/specs/2026-10-23-english-corner-grammar-g5-design.md):
 * the lessons, their book statements, the item rules and the audio list. The wrongness of a distractor is a teacher's
 * call on the printed form; these tests only catch a malformed item.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRAMMAR_UNITS, allGrammarSpoken, grammarUnit, grammarUnitsForGrade, offeredGrammar, unitSentences } from '../englishGrammar.ts';
import { G5_ITEM_LESSONS } from '../englishGrammarG5Items.ts';
import { hubLesson } from '../englishHub.ts';

const dataFile = (sem: 1 | 2) => JSON.parse(readFileSync(new URL(`../data/iqra_curriculum_g5_english_sem${sem}.json`, import.meta.url), 'utf8'));
const L = (s: string) => `kbl-g5-eng-${s}`;
const S1 = ['s1-nccd-u1_l1', 's1-nccd-u2_l1', 's1-nccd-u3_l1', 's1-nccd-u4_l1', 's1-nccd-u5_l1'].map(L);
const S2 = ['s2-nccd-u6_l1', 's2-nccd-u7_l1', 's2-nccd-u8_l1', 's2-nccd-u9_l1', 's2-nccd-u10_l1'].map(L);
const sentencesOf = (id: string) => unitSentences(grammarUnit(id)!);
const ids = () => G5_ITEM_LESSONS.map(l => l.lessonId);

const SIZES: Record<string, Record<string, number>> = {
  [L('s1-nccd-u1_l1')]: { 'third-person-s': 14, 'before-after': 14, 'when-clauses': 12 },
  [L('s1-nccd-u2_l1')]: { 'taller-forms': 10, 'more-forms': 10, superlatives: 12, irregular: 8 },
  [L('s1-nccd-u3_l1')]: { 'was-were': 14, 'did-questions': 14, 'regular-irregular': 12 },
  [L('s1-nccd-u4_l1')]: { will: 14, wont: 12, 'will-questions': 14 },
  [L('s1-nccd-u5_l1')]: { who: 14, where: 14, which: 12 },
  [L('s2-nccd-u6_l1')]: { irregular: 16, 'did-negatives': 12, questions: 12 },
  [L('s2-nccd-u7_l1')]: { 'was-were-ing': 14, 'when-while': 14, questions: 12 },
  [L('s2-nccd-u8_l1')]: { should: 14, shouldnt: 14, 'advice-questions': 12 },
  [L('s2-nccd-u9_l1')]: { 'have-has': 16, 'havent-hasnt': 12, questions: 12 },
  [L('s2-nccd-u10_l1')]: { 'ever-questions': 14, never: 14, 'short-answers': 12 },
};

describe('Grade 5 authored lessons', () => {
  it('are the ten hub lessons, Semester 1 then Semester 2, unsigned and offered to nobody', () => {
    assert.deepEqual(ids(), [...S1, ...S2]);
    for (const id of ids()) {
      assert.ok(hubLesson(id), id);
      assert.equal(hubLesson(id)!.grammarOnly, undefined, id);
      assert.equal(grammarUnit(id)!.reviewedBy, null, id);
      assert.equal(offeredGrammar(id), null, id);
    }
  });

  it('are ten lessons and 400 items', () => {
    assert.equal(G5_ITEM_LESSONS.length, 10);
    assert.equal(G5_ITEM_LESSONS.reduce((n, l) => n + sentencesOf(l.lessonId).length, 0), 400);
    assert.equal(grammarUnitsForGrade(5).length, 10);
  });

  it("carry the book's own statement for that lesson id", () => {
    for (const l of G5_ITEM_LESSONS) {
      const sem = l.lessonId.includes('-s1-') ? 1 : 2;
      const key = l.lessonId.replace(/^.*-nccd-/, '');
      const lesson = dataFile(sem).units.flatMap((u: any) => u.lessons).find((x: any) => x.id === key);
      assert.equal(lesson?.objectives?.[0], l.statement, l.lessonId);
    }
  });

  it('give 40 items a lesson in the pinned sub-topic sizes', () => {
    for (const [id, sizes] of Object.entries(SIZES)) {
      const s = sentencesOf(id);
      assert.equal(s.length, 40, id);
      const by = new Map<string, number>();
      for (const x of s) by.set(x.patternId, (by.get(x.patternId) ?? 0) + 1);
      assert.deepEqual(Object.fromEntries(by), sizes, id);
    }
  });

  it('are buildable, picture-free, unique, form-only and never a Yes or No', () => {
    for (const id of ids()) {
      const s = sentencesOf(id);
      const seen = new Set<string>();
      for (const x of s) {
        assert.ok(x.tokens.length >= 2 && x.tokens.length <= 9, `${id} ${x.text}`);
        assert.equal(x.build!.prompt, null, x.text);
        assert.equal(x.picture, null);
        assert.equal(x.yesNo, null);
        assert.equal(x.kind, 'form', x.text);
        assert.ok(!seen.has(x.text), `duplicate ${x.text}`);
        seen.add(x.text);
      }
      for (const x of s) assert.ok(!seen.has(x.claim!.falseText), `twin of «${x.text}» is a true sentence`);
    }
  });

  it('have a distractor that differs and a silent twin that differs from the sentence', () => {
    for (const id of ids()) for (const x of sentencesOf(id)) {
      assert.notEqual(x.choose!.right, x.choose!.wrong, x.text);
      assert.notEqual(x.claim!.falseText, x.text, x.text);
      assert.equal(x.claim!.voiced, false, x.text);
    }
  });

  it('contain no capitalised name (only a sentence start, I, a family word or a place)', () => {
    const ok = new Set(['I', "I'm", "I'd", "I'll", "I've", 'Dad', 'Mum', 'Granny', 'TV', 'Jordan', 'Amman', 'Aqaba', 'Petra', 'Sun', 'Moon', 'Earth', 'Mars', 'Saturday', 'Sunday', 'Monday', 'Friday', 'English', 'Science']);
    for (const id of ids()) for (const x of sentencesOf(id)) {
      x.tokens.forEach((t, i) => {
        const word = t.replace(/[.,?!]+$/, '');
        const startsSentence = i === 0 || /[.?!]$/.test(x.tokens[i - 1]);
        if (/^[A-Z]/.test(word) && !startsSentence) assert.ok(ok.has(word), `${id}: «${x.text}» has «${word}»`);
      });
      for (const name of ['Jameela', 'Katy', 'Alice', 'Hamed']) assert.ok(!x.text.includes(name), x.text);
    }
  });

  it('never use the past simple as a present perfect distractor', () => {
    for (const id of [L('s2-nccd-u9_l1'), L('s2-nccd-u10_l1')].filter(i => ids().includes(i))) {
      for (const x of sentencesOf(id)) assert.ok(!/^(saw|did|went|ate|took|made|wrote)$/.test(x.choose!.wrong), `${id}: ${x.text}`);
    }
  });

  it('send true sentences to the audio list and no twin', () => {
    const spoken = new Set(allGrammarSpoken());
    for (const id of ids()) for (const x of sentencesOf(id)) {
      assert.ok(spoken.has(x.text), x.text);
      assert.ok(!spoken.has(x.claim!.falseText) || sentencesOf(id).some(y => y.text === x.claim!.falseText), `voiced twin ${x.claim!.falseText}`);
    }
  });

  it('are in GRAMMAR_UNITS under Grade 5', () => {
    for (const id of ids()) assert.ok(GRAMMAR_UNITS.some(u => u.lessonId === id), id);
    assert.equal(grammarUnitsForGrade(5).length, ids().length);
  });
});
