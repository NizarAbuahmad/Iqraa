/**
 * Grade 9 grammar pilot on the app side (spec: docs/superpowers/specs/2026-10-23-english-corner-grammar-g9-pilot-design.md):
 * the two S1 U4 lessons through the round builders. No picture anywhere; the noun or the written pair decides.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { allGrammarSpoken, buildCap, grammarUnitsForGrade, unitSentences } from '@workspace/curriculum/englishGrammar';
import { makeRng } from '../publicGames/rng.ts';
import {
  ROUND_LENGTH,
  buildChooseRound,
  buildSentenceRound,
  buildTrueFalseRound,
  buildYesNoRound,
  grammarActivityAvailable,
  isSentenceBuilt,
  isYesNoRight,
  yesNoExchange,
} from '../englishHub/games.ts';

const UNITS = grammarUnitsForGrade(9).map(u => ({ id: u.lessonId, sentences: unitSentences(u) }));
const COMPARE = 'kbl-g9-eng-s1-nccd-u4_l1';
const QUANT = 'kbl-g9-eng-s1-nccd-u4_l3';
const SEEDS = [1, 2, 3, 4, 5, 6];
const spoken = new Set(allGrammarSpoken());
const unit = (id: string) => UNITS.find(u => u.id === id)!.sentences;

describe('which activity each Grade 9 lesson offers', () => {
  it('comparatives: Choose, Build, True or false, Yes or No; quantifiers: Choose and Build only', () => {
    assert.deepEqual(UNITS.map(u => u.id).sort(), [COMPARE, QUANT]);
    const offered = (a: Parameters<typeof grammarActivityAvailable>[0]) => UNITS.filter(u => grammarActivityAvailable(a, u.sentences)).map(u => u.id);
    assert.deepEqual(offered('grammar-choose').sort(), [COMPARE, QUANT]);
    assert.deepEqual(offered('grammar-build').sort(), [COMPARE, QUANT]);
    assert.deepEqual(offered('grammar-true'), [COMPARE]);
    assert.deepEqual(offered('grammar-yesno'), [COMPARE]);
  });
});

describe('Choose on Grade 9', () => {
  it('the right option is the blanked word and the two options differ', () => {
    for (const { id, sentences } of UNITS) for (const seed of SEEDS) {
      for (const q of buildChooseRound(sentences, makeRng(seed))) {
        assert.equal(q.options[q.answerIndex], q.sentence.choose!.right, id);
        assert.notEqual(q.options[0], q.options[1], id);
      }
    }
  });

  it('quantifiers: many goes with a counted food and much with an uncounted one', () => {
    for (const seed of SEEDS) for (const q of buildChooseRound(unit(QUANT), makeRng(seed))) {
      const { right } = q.sentence.choose!;
      const text = q.sentence.text;
      if (right === 'many' || right === 'a few') assert.doesNotMatch(text, /\b(cream|honey|jam|salt|sugar|porridge|milk|rice)\b/, text);
      else assert.doesNotMatch(text, /\b(grapes|olives|mushrooms|pancakes|doughnuts|croissants|muffins|carrots)\b/, text);
    }
  });
});

describe('Build on Grade 9', () => {
  it('tiles are the build tokens, at most nine, and the tiles in order are judged right', () => {
    for (const { id, sentences } of UNITS) for (const seed of SEEDS) {
      for (const q of buildSentenceRound(sentences, makeRng(seed))) {
        const build = q.sentence.build!;
        assert.equal(q.tiles.length, build.tokens.length, `${id} ${q.sentence.text}`);
        assert.ok(q.tiles.length <= buildCap(9), q.sentence.text);
        assert.equal(isSentenceBuilt(build.tokens.map(text => ({ text })), q.sentence), true, q.sentence.text);
      }
    }
  });
});

describe('comparatives: picture-free True or false and Yes or No', () => {
  const sentences = unit(COMPARE);

  it('True or false shows the sentence or its swapped twin, never a picture; half true; every text voiced', () => {
    for (const seed of SEEDS) {
      const round = buildTrueFalseRound(sentences, makeRng(seed));
      assert.ok(round.length >= 6, `round of ${round.length}`);
      for (const q of round) {
        assert.equal(q.pictureWord, null);
        assert.ok(q.sentence.claim, q.sentence.key);
        assert.equal(q.text, q.isTrue ? q.sentence.text : q.sentence.claim!.falseText);
        assert.ok(spoken.has(q.text), q.text);
      }
      assert.equal(round.filter(q => q.isTrue).length, round.length / 2);
    }
  });

  it('Yes or No is a fact with no picture and no hint, half Yes, each question once and every exchange voiced', () => {
    for (const seed of SEEDS) {
      const round = buildYesNoRound(sentences, makeRng(seed));
      assert.equal(round.length, ROUND_LENGTH);
      assert.equal(round.filter(q => q.answer).length, ROUND_LENGTH / 2);
      assert.equal(new Set(round.map(q => q.question)).size, round.length);
      for (const q of round) {
        assert.equal(q.picture, null);
        assert.equal(q.kind, 'fact');
        assert.equal(q.hint, null);
        assert.ok(spoken.has(q.question) && spoken.has(yesNoExchange(q)), q.question);
        assert.equal(isYesNoRight(q, q.answer), true);
      }
    }
  });

  it('an opinion row is never judged: no True or false or Yes or No text is a Pancakes / Muffins / Jam opinion', () => {
    const opinions = /^(Pancakes|Muffins|Doughnuts|Jam|Salmon|Grapes) (is|are) (tastier|more popular) than/;
    for (const seed of SEEDS) {
      for (const q of buildTrueFalseRound(sentences, makeRng(seed))) assert.doesNotMatch(q.text, opinions, q.text);
      for (const q of buildYesNoRound(sentences, makeRng(seed))) assert.doesNotMatch(q.question, /tastier|more popular/, q.question);
    }
  });
});
