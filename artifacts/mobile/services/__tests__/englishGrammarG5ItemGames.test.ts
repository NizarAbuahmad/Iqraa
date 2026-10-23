/**
 * The ten authored Grade 5 lessons on the app side (spec: docs/superpowers/specs/2026-10-23-english-corner-grammar-g5-design.md):
 * Choose, Build and True or false on hand-written items, no Yes or No, and a True or false that plays no sound.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { allGrammarSpoken, grammarUnit, unitSentences } from '@workspace/curriculum/englishGrammar';
import { makeRng } from '../publicGames/rng.ts';
import {
  buildChooseRound,
  buildSentenceRound,
  buildTrueFalseRound,
  grammarActivityAvailable,
  isSentenceBuilt,
  isSilentTrueFalse,
} from '../englishHub/games.ts';

const LESSONS = [
  's1-nccd-u1_l1', 's1-nccd-u2_l1', 's1-nccd-u3_l1', 's1-nccd-u4_l1', 's1-nccd-u5_l1',
  's2-nccd-u6_l1', 's2-nccd-u7_l1', 's2-nccd-u8_l1', 's2-nccd-u9_l1', 's2-nccd-u10_l1',
].map(s => `kbl-g5-eng-${s}`);
const SEEDS = [1, 2, 3, 4, 5, 6];
const sentences = (id: string) => unitSentences(grammarUnit(id)!);

describe('Grade 5 authored lessons in the app', () => {
  it('offer Choose, Build and True or false on every lesson, and never Yes or No', () => {
    for (const id of LESSONS) {
      const s = sentences(id);
      assert.equal(grammarActivityAvailable('grammar-choose', s), true, id);
      assert.equal(grammarActivityAvailable('grammar-build', s), true, id);
      assert.equal(grammarActivityAvailable('grammar-true', s), true, id);
      assert.equal(grammarActivityAvailable('grammar-yesno', s), false, id);
    }
  });

  it('Choose: the right option is the answer, and it differs from the distractor', () => {
    for (const id of LESSONS) for (const seed of SEEDS) {
      const round = buildChooseRound(sentences(id), makeRng(seed));
      assert.ok(round.length >= 6, id);
      for (const q of round) {
        assert.equal(q.options[q.answerIndex], q.sentence.choose!.right, id);
        assert.notEqual(q.options[0], q.options[1], id);
      }
    }
  });

  it('Build: the tiles are the whole sentence, and the tiles in order are judged right', () => {
    for (const id of LESSONS) for (const seed of SEEDS) {
      const round = buildSentenceRound(sentences(id), makeRng(seed));
      assert.ok(round.length >= 6, id);
      for (const q of round) {
        assert.ok(!q.prompt, `${id}: ${q.sentence.text}`);
        assert.equal(q.tiles.length, q.sentence.build!.tokens.length);
        assert.equal(isSentenceBuilt(q.sentence.build!.tokens.map(text => ({ text })), q.sentence), true, q.sentence.text);
      }
    }
  });

  it('True or false: the sentence or its twin, no picture, half true, and silent', () => {
    for (const id of LESSONS) for (const seed of SEEDS) {
      const round = buildTrueFalseRound(sentences(id), makeRng(seed));
      assert.ok(round.length >= 6, `${id}: a round of ${round.length}`);
      for (const q of round) {
        assert.equal(q.pictureWord, null);
        assert.equal(q.text, q.isTrue ? q.sentence.text : q.sentence.claim!.falseText);
        assert.equal(isSilentTrueFalse(q.sentence), true, q.text);
      }
      assert.equal(round.filter(q => q.isTrue).length, round.length / 2, id);
    }
  });

  it('no authored twin is voiced', () => {
    const spoken = new Set(allGrammarSpoken());
    const trues = new Set(LESSONS.flatMap(id => sentences(id).map(x => x.text)));
    for (const id of LESSONS) for (const x of sentences(id)) {
      assert.ok(spoken.has(x.text), x.text);
      assert.ok(!spoken.has(x.claim!.falseText) || trues.has(x.claim!.falseText), `voiced twin «${x.claim!.falseText}»`);
    }
  });
});
