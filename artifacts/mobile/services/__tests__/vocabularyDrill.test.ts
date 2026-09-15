/**
 * Vocabulary drills.
 *
 * The counts here are pinned on purpose. Every one of them was produced by a
 * parser whose failure mode is a silent zero rather than an error — the
 * extractor's own header lists five layout traps that each returned "no words"
 * while looking like it had run. If a re-extraction drops a book, that must
 * fail here rather than look like "the books changed".
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGLISH_VOCABULARY,
  MIN_DRILL_WORDS,
  lessonHasVocabularyDrill,
  validateEnglishVocabulary,
  vocabularyForLesson,
} from '@workspace/curriculum/vocabulary';

import {
  BLANK,
  DRILL_OPTIONS,
  blankOut,
  drillsForLesson,
  isDrillAnswerCorrect,
} from '../vocabularyDrill.ts';

describe('the extracted corpus', () => {
  it('is structurally valid', () => {
    assert.deepEqual(validateEnglishVocabulary(), []);
  });

  it('holds what the three usable books yielded', () => {
    assert.equal(ENGLISH_VOCABULARY.length, 730);
    assert.equal(new Set(ENGLISH_VOCABULARY.map(w => w.lessonId)).size, 72);
    assert.equal(ENGLISH_VOCABULARY.filter(w => w.sentence).length, 237);
  });

  it('never carries a phonetic mark into a headword', () => {
    // The Word List, the irregular-verbs table and the Grammar Reference share
    // the same back-matter pages. Stress marks are how a transcription that
    // leaked into the headword column gives itself away.
    for (const w of ENGLISH_VOCABULARY) {
      assert.ok(!/[ˈˌː]/.test(w.word), `${w.word} carries IPA`);
      assert.ok(!/[.!?]/.test(w.word), `${w.word} is a sentence, not a headword`);
    }
  });
});

describe('drills', () => {
  const lesson = 'kbl-eng-s1-nccd-u2_l3';

  it('offers four options, one of them right', () => {
    const drills = drillsForLesson(lesson);
    assert.ok(drills.length > 0, 'a lesson with words produced no drill');
    for (const d of drills) {
      assert.equal(d.options.length, DRILL_OPTIONS);
      assert.equal(new Set(d.options).size, d.options.length, `duplicate option in ${d.word}`);
      assert.ok(d.answerIndex >= 0 && d.answerIndex < DRILL_OPTIONS);
      assert.ok(isDrillAnswerCorrect(d, d.answerIndex));
      assert.ok(!isDrillAnswerCorrect(d, (d.answerIndex + 1) % DRILL_OPTIONS));
    }
  });

  it('draws every distractor from the same lesson', () => {
    // The point of the drill is "which of these words did this lesson teach".
    // An option from another lesson is answerable without knowing any of them.
    const own = new Set(vocabularyForLesson(lesson).map(w => w.word));
    for (const d of drillsForLesson(lesson)) {
      if (d.kind !== 'gap_fill') continue;
      for (const o of d.options) assert.ok(own.has(o), `${o} is not from this lesson`);
    }
  });

  it('hides the answer from the prompt', () => {
    for (const d of drillsForLesson(lesson)) {
      if (d.kind !== 'gap_fill') continue;
      assert.ok(d.prompt.includes(BLANK), `${d.word}: no blank in the prompt`);
      assert.ok(
        !new RegExp(`\\b${d.word}\\b`, 'i').test(d.prompt),
        `${d.word}: the prompt still contains its own answer`,
      );
    }
  });

  it('orders options the same way every time', () => {
    // A React list re-renders on every tap. With Math.random the options would
    // reshuffle under the student's finger between picking and seeing the mark.
    const a = drillsForLesson(lesson);
    const b = drillsForLesson(lesson);
    assert.deepEqual(a.map(d => d.options), b.map(d => d.options));
  });

  it('renders nothing for a lesson with too few words, or none at all', () => {
    assert.deepEqual(drillsForLesson('kbl-math-s1-nccd-u1_l1'), []);
    assert.deepEqual(drillsForLesson(''), []);
    assert.equal(lessonHasVocabularyDrill('kbl-math-s1-nccd-u1_l1'), false);
  });

  it('agrees with lessonHasVocabularyDrill about which lessons are drillable', () => {
    const drillable = [...new Set(ENGLISH_VOCABULARY.map(w => w.lessonId))]
      .filter(id => vocabularyForLesson(id).length >= MIN_DRILL_WORDS);
    for (const id of drillable) assert.ok(lessonHasVocabularyDrill(id), id);
    // And the gate is real: some lessons genuinely fall under it.
    const all = new Set(ENGLISH_VOCABULARY.map(w => w.lessonId));
    assert.ok(drillable.length < all.size, 'the minimum-words gate never fires');
  });
});

describe('blankOut', () => {
  it('replaces the word wherever it sits, whatever its case', () => {
    assert.equal(blankOut('Research is hard.', 'research'), `${BLANK} is hard.`);
    assert.equal(blankOut('I like research.', 'research'), `I like ${BLANK}.`);
  });

  it('does not blank the middle of a longer word', () => {
    // "research" inside "researcher" would leave a stub the student must guess
    // around, and the answer would no longer fit the sentence.
    assert.equal(blankOut('The researcher agreed.', 'research'), 'The researcher agreed.');
  });
});
