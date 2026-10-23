/**
 * Grade 10 Semester 1 grammar on the eleven authored lessons (spec: docs/superpowers/specs/2026-10-23-english-corner-grammar-g10-design.md):
 * the lessons, their book statements, the item rules and the audio list. The wrongness of a distractor and the force of a
 * marker are a teacher's call on the printed form; these tests only catch a malformed item.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GRAMMAR_UNITS, allGrammarSpoken, grammarUnit, grammarUnitsForGrade, offeredGrammar, unitSentences } from '../englishGrammar.ts';
import { G10_ITEM_LESSONS } from '../englishGrammarG10Items.ts';
import { GRAMMAR_ONLY_LESSONS, hubLesson } from '../englishHub.ts';

const dataFile = () => JSON.parse(readFileSync(new URL('../data/iqra_curriculum_g10_english_sem1.json', import.meta.url), 'utf8'));
const L = (s: string) => `kbl-eng-s1-nccd-${s}`;
const FIRST = ['u1_l1', 'u1_l5', 'u2_l1', 'u2_l4', 'u3_l1'].map(L);
const sentencesOf = (id: string) => unitSentences(grammarUnit(id)!);
const ids = () => G10_ITEM_LESSONS.map(l => l.lessonId);

/** topic: [size, kind] — the kind is pinned per sub-topic, so a meaning item cannot appear outside the topics meant for it. */
const SIZES: Record<string, Record<string, [number, 'form' | 'meaning']>> = {
  [L('u1_l1')]: { 'habit-markers': [12, 'meaning'], 'temporary-markers': [12, 'meaning'], stative: [8, 'form'], questions: [8, 'form'] },
  [L('u1_l5')]: { 'a-an': [8, 'form'], 'already-mentioned': [12, 'meaning'], 'unique-things': [10, 'form'], 'no-article': [10, 'form'] },
  [L('u2_l1')]: { 'result-count': [14, 'meaning'], duration: [14, 'meaning'], forms: [12, 'form'] },
  [L('u2_l4')]: { ing: [14, 'form'], to: [14, 'form'], 'change-of-meaning': [12, 'meaning'] },
  [L('u3_l1')]: { interrupted: [14, 'meaning'], 'earlier-event': [14, 'meaning'], forms: [12, 'form'] },
};

describe('Grade 10 authored lessons', () => {
  it('start with the five lessons of Task 1, unsigned and offered to nobody', () => {
    assert.deepEqual(ids().slice(0, 5), FIRST);
    for (const id of ids()) {
      assert.ok(hubLesson(id), id);
      assert.equal(hubLesson(id)!.grade, 10, id);
      assert.equal(grammarUnit(id)!.reviewedBy, null, id);
      assert.equal(offeredGrammar(id), null, id);
    }
  });

  it('make Articles the one grammar-only lesson, under the word floor, and the rest lessons with words', () => {
    assert.ok(GRAMMAR_ONLY_LESSONS.includes(L('u1_l5')));
    assert.equal(hubLesson(L('u1_l5'))!.grammarOnly, true);
    for (const id of ids().filter(i => i !== L('u1_l5'))) assert.equal(hubLesson(id)!.grammarOnly, undefined, id);
  });

  it("carry the book's own statement for that lesson id", () => {
    for (const l of G10_ITEM_LESSONS) {
      const key = l.lessonId.replace(/^.*-nccd-/, '');
      const lesson = dataFile().units.flatMap((u: any) => u.lessons).find((x: any) => x.id === key);
      assert.equal(lesson?.objectives?.[0], l.statement, l.lessonId);
    }
  });

  it('give 40 items a lesson in the pinned sub-topic sizes and kinds', () => {
    for (const [id, sizes] of Object.entries(SIZES)) {
      const s = sentencesOf(id);
      assert.equal(s.length, 40, id);
      for (const [topic, [size, kind]] of Object.entries(sizes)) {
        const own = s.filter(x => x.patternId === topic);
        assert.equal(own.length, size, `${id} ${topic}`);
        assert.ok(own.every(x => x.kind === kind), `${id} ${topic} must be ${kind}`);
      }
      assert.deepEqual([...new Set(s.map(x => x.patternId))].sort(), Object.keys(sizes).sort(), id);
    }
  });

  it('are buildable, picture-free, unique and never a Yes or No', () => {
    for (const id of ids()) {
      const s = sentencesOf(id);
      const seen = new Set<string>();
      for (const x of s) {
        assert.ok(x.tokens.length >= 2 && x.tokens.length <= 9, `${id} ${x.text}`);
        assert.equal(x.build!.prompt, null, x.text);
        assert.equal(x.picture, null);
        assert.equal(x.yesNo, null);
        assert.ok(x.kind === 'form' || x.kind === 'meaning', x.text);
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
    const ok = new Set(['I', "I'm", "I'd", "I'll", "I've", 'Dad', 'Mum', 'TV', 'Jordan', 'Amman', 'Aqaba', 'Petra', 'Irbid', 'Sun', 'Moon', 'Earth', 'Mars', 'Saturday', 'Sunday', 'Monday', 'Friday', 'Fridays', 'English', 'French', 'Arabic']);
    for (const id of ids()) for (const x of sentencesOf(id)) {
      x.tokens.forEach((t, i) => {
        const word = t.replace(/[.,?!]+$/, '');
        const startsSentence = i === 0 || /[.?!]$/.test(x.tokens[i - 1]);
        if (/^[A-Z]/.test(word) && !startsSentence) assert.ok(ok.has(word), `${id}: «${x.text}» has «${word}»`);
      });
    }
  });

  it('never use a bare past simple as a present perfect distractor', () => {
    const past = new Set('saw did went ate took wrote broke wore gave drew threw knew spoke rode sang swam drank began chose fell forgot hid flew grew shook stole woke came became ran'.split(' '));
    for (const x of sentencesOf(L('u2_l1')).filter(y => y.patternId === 'forms')) {
      for (const w of x.choose!.wrong.toLowerCase().replace(/[.,?!]/g, '').split(/\s+/)) assert.ok(!past.has(w), `${x.text}: ${w}`);
    }
  });

  it('send true sentences to the audio list and no twin', () => {
    const spoken = new Set(allGrammarSpoken());
    for (const id of ids()) for (const x of sentencesOf(id)) {
      assert.ok(spoken.has(x.text), x.text);
      assert.ok(!spoken.has(x.claim!.falseText) || sentencesOf(id).some(y => y.text === x.claim!.falseText), `voiced twin ${x.claim!.falseText}`);
    }
  });

  it('are in GRAMMAR_UNITS under Grade 10', () => {
    for (const id of ids()) assert.ok(GRAMMAR_UNITS.some(u => u.lessonId === id), id);
    assert.equal(grammarUnitsForGrade(10).length, ids().length);
  });
});
