/**
 * Round builders on the Grade 2 grammar data, and Yes or No. The builders do not gate on review
 * (the lesson screen's `offeredGrammar` does), so they are tested over every Grade 2 unit.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { allGrammarSpoken, grammarUnitsForGrade, unitSentences } from '@workspace/curriculum/englishGrammar';
import { makeRng } from '../publicGames/rng.ts';
import {
  EMPTY_PROGRESS,
  GRAMMAR_ACTIVITIES,
  MAX_BUILD_TILES,
  ROUND_LENGTH,
  buildChooseRound,
  buildSentenceRound,
  buildTrueFalseRound,
  buildYesNoRound,
  grammarActivityAvailable,
  isYesNoRight,
  lessonStars,
  recordResult,
  yesNoExchange,
} from '../englishHub/games.ts';

const UNITS = grammarUnitsForGrade(2).map(u => ({ id: u.lessonId, sentences: unitSentences(u) }));
const YES_NO_UNITS = ['kbl-g2-eng-s1-nccd-u1_l1', 'kbl-g2-eng-s2-nccd-u6_l1'];
const SEEDS = [1, 2, 3, 4, 5, 6];
const spoken = new Set(allGrammarSpoken());

describe('the Grade 1 activities on Grade 2 data', () => {
  it('Choose, Build and True or false are offered on every Grade 2 unit', () => {
    assert.equal(UNITS.length, 8);
    for (const { id, sentences } of UNITS) {
      for (const a of ['grammar-choose', 'grammar-build', 'grammar-true'] as const) {
        assert.ok(grammarActivityAvailable(a, sentences), `${id} ${a}`);
      }
    }
  });

  it('every round is well formed and no Build sentence is longer than the cap', () => {
    for (const { id, sentences } of UNITS) {
      for (const seed of SEEDS) {
        for (const q of buildChooseRound(sentences, makeRng(seed))) {
          assert.equal(q.options[q.answerIndex], q.sentence.choose!.right, id);
          assert.notEqual(q.options[0], q.options[1], id);
        }
        for (const q of buildSentenceRound(sentences, makeRng(seed))) {
          assert.ok(q.sentence.tokens.length <= MAX_BUILD_TILES, q.sentence.text);
          assert.equal(q.tiles.length, q.sentence.tokens.length);
        }
        for (const q of buildTrueFalseRound(sentences, makeRng(seed))) {
          assert.ok(q.sentence.picture && q.sentence.falsePicture, q.sentence.key);
        }
      }
    }
  });

  it('a Yes or No sentence is never a Choose or True or false item', () => {
    for (const { sentences } of UNITS) {
      const asked = new Set(sentences.filter(s => s.yesNo).map(s => s.key));
      for (const seed of SEEDS) {
        for (const q of buildChooseRound(sentences, makeRng(seed))) assert.ok(!asked.has(q.sentence.key), q.sentence.key);
        for (const q of buildTrueFalseRound(sentences, makeRng(seed))) assert.ok(!asked.has(q.sentence.key), q.sentence.key);
      }
    }
  });
});

describe('Yes or No', () => {
  it('is offered on toys and food only', () => {
    for (const { id, sentences } of UNITS) {
      assert.equal(grammarActivityAvailable('grammar-yesno', sentences), YES_NO_UNITS.includes(id), id);
    }
    assert.ok(GRAMMAR_ACTIVITIES.includes('grammar-yesno'));
  });

  it('a round is eight items, half Yes and half No, never a picture twice, and every exchange is voiced', () => {
    for (const { id, sentences } of UNITS.filter(u => YES_NO_UNITS.includes(u.id))) {
      for (const seed of SEEDS) {
        const round = buildYesNoRound(sentences, makeRng(seed));
        assert.equal(round.length, ROUND_LENGTH, id);
        assert.equal(round.filter(q => q.answer).length, ROUND_LENGTH / 2, id);
        const pictures = round.map(q => q.picture!.word);
        assert.equal(new Set(pictures).size, pictures.length, `${id}: a picture twice`);
        for (const q of round) {
          assert.ok(spoken.has(q.question), q.question);
          assert.ok(spoken.has(yesNoExchange(q)), yesNoExchange(q));
        }
      }
    }
  });

  it('a match question names the picture exactly when the answer is Yes', () => {
    const toys = UNITS.find(u => u.id === YES_NO_UNITS[0])!.sentences;
    for (const seed of SEEDS) {
      for (const q of buildYesNoRound(toys, makeRng(seed))) {
        assert.equal(q.kind, 'match');
        const named = /^Is it an? (.+)\?$/.exec(q.question)![1];
        assert.equal(named === q.picture!.word, q.answer, q.question);
        assert.equal(isYesNoRight(q, q.answer), true);
        assert.equal(isYesNoRight(q, !q.answer), false);
        assert.equal(yesNoExchange(q), `${q.question} ${q.answer ? "Yes, it is." : "No, it isn't."}`);
      }
    }
  });

  it('a marker answer follows the ✅ / ❌ beside the picture', () => {
    const food = UNITS.find(u => u.id === YES_NO_UNITS[1])!.sentences;
    for (const seed of SEEDS) {
      for (const q of buildYesNoRound(food, makeRng(seed))) {
        assert.equal(q.kind, 'marker');
        assert.equal(q.answer, q.marker === 'yes', q.question);
        assert.equal(yesNoExchange(q), q.sentence.text, q.question);
      }
    }
  });

  it('stars for it count toward the lesson', () => {
    const p = recordResult(EMPTY_PROGRESS, YES_NO_UNITS[0], 'grammar-yesno', 3, '2026-10-19');
    assert.equal(lessonStars(p, YES_NO_UNITS[0]), 3);
  });
});
