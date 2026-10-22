/**
 * Grade 4 grammar on the app side (spec: docs/superpowers/specs/2026-10-22-english-corner-grammar-g4-design.md):
 * picture-free True or false and Yes or No, the past-tense hint, and the round builders on the Grade 4 data.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { type GrammarSentence } from '@workspace/curriculum/englishGrammar';
import { makeRng } from '../publicGames/rng.ts';
import { buildTrueFalseRound, buildYesNoRound, grammarActivityAvailable } from '../englishHub/games.ts';

const sentence = (over: Partial<GrammarSentence>): GrammarSentence => ({
  key: 'k', lessonId: 'kbl-g4-eng-s1-nccd-u4_l1', patternId: 'p', text: 'The mountain is higher than the hill.', tokens: [], picture: null,
  marker: null, choose: null, falsePicture: null, yesNo: null, claim: null, build: null, ...over,
});
const claims = ['mountain', 'lion', 'river', 'lake', 'sea'].map((w, i) =>
  sentence({ key: `c${i}`, text: `The ${w} is higher than the hill.`, claim: { falseText: `The hill is higher than the ${w}.` } }));
const fact = (question: string, answer: boolean, i: number): GrammarSentence => sentence({
  key: `f${i}`, text: `${question} ${answer ? 'Yes, it is.' : "No, it isn't."}`,
  yesNo: { kind: 'fact', question, otherQuestion: null, yes: 'Yes, it is.', no: "No, it isn't.", answer, hint: null },
});

describe('picture-free True or false', () => {
  it('draws claims: a true one shows its text, a false one its swapped twin, and no picture word', () => {
    const round = buildTrueFalseRound(claims, makeRng(1));
    assert.equal(round.length, 5);
    for (const q of round) {
      assert.equal(q.pictureWord, null);
      assert.equal(q.text, q.isTrue ? q.sentence.text : q.sentence.claim!.falseText);
    }
    assert.equal(round.filter(q => q.isTrue).length, 3);
    assert.equal(grammarActivityAvailable('grammar-true', claims), true);
  });
});

describe('picture-free Yes or No', () => {
  it('draws facts with no picture, half yes and half no, each question once', () => {
    const facts = [
      fact('Is the mountain higher than the hill?', true, 0), fact('Is the lake deeper than the pool?', true, 1),
      fact('Is the river wider than the stream?', true, 2), fact('Is the hill higher than the mountain?', false, 3),
      fact('Is the pool deeper than the lake?', false, 4), fact('Is the stream wider than the river?', false, 5),
    ];
    const round = buildYesNoRound(facts, makeRng(2));
    assert.equal(round.length, 6);
    for (const q of round) assert.equal(q.picture, null);
    assert.equal(round.filter(q => q.answer).length, 3);
    assert.equal(new Set(round.map(q => q.question)).size, 6);
    assert.equal(grammarActivityAvailable('grammar-yesno', facts), true);
  });
});
