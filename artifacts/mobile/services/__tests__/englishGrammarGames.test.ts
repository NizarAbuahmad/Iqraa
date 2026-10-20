/**
 * Round builders for the Grade 1 grammar activities (Choose the word, Build the
 * sentence, True or false). The builders do not gate on review — that is the
 * lesson screen's `offeredGrammar` — so they are tested over every unit.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { GRAMMAR_UNITS, unitSentences } from '@workspace/curriculum/englishGrammar';
import { makeRng } from '../publicGames/rng.ts';
import {
  EMPTY_PROGRESS,
  MAX_BUILD_TILES,
  ROUND_LENGTH,
  buildChooseRound,
  buildSentenceRound,
  buildTrueFalseRound,
  grammarActivityAvailable,
  isSentenceBuilt,
  lessonStars,
  recordResult,
} from '../englishHub/games.ts';

const UNITS = GRAMMAR_UNITS.map(u => ({ id: u.lessonId, sentences: unitSentences(u) }));

describe('Choose the word', () => {
  it('offers two distinct options, the right one at answerIndex, only from sentences with a blank', () => {
    for (const { id, sentences } of UNITS) {
      for (let seed = 1; seed <= 5; seed += 1) {
        const round = buildChooseRound(sentences, makeRng(seed));
        assert.ok(round.length > 0 && round.length <= ROUND_LENGTH, id);
        for (const q of round) {
          assert.ok(q.sentence.choose, `${id}: ${q.sentence.key}`);
          assert.equal(q.options.length, 2);
          assert.notEqual(q.options[0], q.options[1]);
          assert.equal(q.options[q.answerIndex], q.sentence.choose!.right);
          assert.ok(q.options.includes(q.sentence.choose!.wrong));
        }
      }
    }
  });

  it('puts the right option first sometimes and second sometimes', () => {
    const all = UNITS.flatMap(({ sentences }) => buildChooseRound(sentences, makeRng(3)));
    assert.ok(all.some(q => q.answerIndex === 0));
    assert.ok(all.some(q => q.answerIndex === 1));
  });
});

describe('Build the sentence', () => {
  it('tiles are the sentence shuffled, never already in order, never more than the cap', () => {
    for (const { id, sentences } of UNITS) {
      for (let seed = 1; seed <= 5; seed += 1) {
        for (const q of buildSentenceRound(sentences, makeRng(seed))) {
          const texts = q.tiles.map(t => t.text);
          assert.deepEqual([...texts].sort(), [...q.sentence.tokens].sort(), q.sentence.key);
          assert.ok(texts.length <= MAX_BUILD_TILES, `${id}: ${q.sentence.text}`);
          if (texts.length >= 2) assert.notEqual(texts.join(' '), q.sentence.text, q.sentence.key);
          assert.equal(new Set(q.tiles.map(t => t.id)).size, q.tiles.length);
        }
      }
    }
  });

  it('isSentenceBuilt reads the tiles in order', () => {
    const s = unitSentences(GRAMMAR_UNITS[1]!).find(x => x.tokens.length >= 3)!;
    const tiles = s.tokens.map(text => ({ text }));
    assert.equal(isSentenceBuilt(tiles, s), true);
    const swapped = [tiles[1]!, tiles[0]!, ...tiles.slice(2)];
    assert.equal(isSentenceBuilt(swapped, s), false);
    assert.equal(isSentenceBuilt(tiles.slice(1), s), false);
  });
});

describe('True or false', () => {
  it('a true item shows its own word, a false one its false picture, and a round holds both', () => {
    for (const { id, sentences } of UNITS) {
      for (let seed = 1; seed <= 5; seed += 1) {
        const round = buildTrueFalseRound(sentences, makeRng(seed));
        assert.ok(round.length > 0 && round.length <= ROUND_LENGTH, id);
        for (const q of round) {
          assert.ok(q.sentence.picture && q.sentence.falsePicture, q.sentence.key);
          assert.equal(q.pictureWord, q.isTrue ? q.sentence.picture!.word : q.sentence.falsePicture);
        }
        if (round.length >= 2) {
          assert.ok(round.some(q => q.isTrue), id);
          assert.ok(round.some(q => !q.isTrue), id);
        }
      }
    }
  });
});

describe('availability, scoring, reproducibility', () => {
  it('nothing is available from no sentences', () => {
    for (const a of ['grammar-choose', 'grammar-build', 'grammar-true'] as const) {
      assert.equal(grammarActivityAvailable(a, []), false);
    }
  });

  it('every Grade 1 unit can offer all three, except True or false in Unit 1', () => {
    // Unit 1 pictures only mum and dad: brother, sister and friend have no
    // emoji a child could tell from "boy"/"girl", so the card stays hidden there.
    const noTrueFalse = new Set(['kbl-g1-eng-s1-nccd-u1_l1']);
    for (const { id, sentences } of UNITS) {
      for (const a of ['grammar-choose', 'grammar-build', 'grammar-true'] as const) {
        const expected = !(a === 'grammar-true' && noTrueFalse.has(id));
        assert.equal(grammarActivityAvailable(a, sentences), expected, `${id} ${a}`);
      }
    }
  });

  it('a grammar result counts towards the lesson stars', () => {
    const p = recordResult(EMPTY_PROGRESS, 'L', 'grammar-choose', 3, '2026-10-16');
    assert.equal(lessonStars(p, 'L'), 3);
  });

  it('the same seed gives the same rounds', () => {
    const s = UNITS[2]!.sentences;
    assert.deepEqual(buildChooseRound(s, makeRng(9)), buildChooseRound(s, makeRng(9)));
    assert.deepEqual(buildSentenceRound(s, makeRng(9)), buildSentenceRound(s, makeRng(9)));
    assert.deepEqual(buildTrueFalseRound(s, makeRng(9)), buildTrueFalseRound(s, makeRng(9)));
  });
});
