/**
 * Grade 4 grammar on the app side (spec: docs/superpowers/specs/2026-10-22-english-corner-grammar-g4-design.md):
 * picture-free True or false and Yes or No, the past-tense hint, and the round builders on the Grade 4 data.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { allGrammarSpoken, buildCap, grammarUnitsForGrade, unitSentences, type GrammarSentence } from '@workspace/curriculum/englishGrammar';
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

const UNITS = grammarUnitsForGrade(4).map(u => ({ id: u.lessonId, sentences: unitSentences(u) }));
const L = (sem: number, unit: number) => `kbl-g4-eng-s${sem}-nccd-u${unit}_l1`;
const SEEDS = [1, 2, 3, 4, 5, 6];
const spoken = new Set(allGrammarSpoken());
const unit = (id: string) => UNITS.find(u => u.id === id)!.sentences;

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

describe('which activity each Grade 4 lesson offers', () => {
  it('Choose and Build on all nine; True or false and Yes or No on S1 U1, U3, U4, U5 and S2 U8', () => {
    assert.equal(UNITS.length, 9);
    const offered = (a: Parameters<typeof grammarActivityAvailable>[0]) => UNITS.filter(u => grammarActivityAvailable(a, u.sentences)).map(u => u.id);
    assert.equal(offered('grammar-choose').length, 9);
    assert.equal(offered('grammar-build').length, 9);
    assert.deepEqual(offered('grammar-true'), [L(1, 1), L(1, 3), L(1, 4), L(1, 5), L(2, 8)]);
    assert.deepEqual(offered('grammar-yesno'), [L(1, 1), L(1, 3), L(1, 4), L(1, 5), L(2, 8)]);
  });
});

describe('Choose and Build on Grade 4', () => {
  it('Choose: the right option is the blanked word, and the two options differ', () => {
    for (const { id, sentences } of UNITS) for (const seed of SEEDS) {
      for (const q of buildChooseRound(sentences, makeRng(seed))) {
        assert.equal(q.options[q.answerIndex], q.sentence.choose!.right, id);
        assert.notEqual(q.options[0], q.options[1], id);
      }
    }
  });

  it('Build: tiles are the build tokens, at most nine, and the tiles in order are judged right', () => {
    for (const { id, sentences } of UNITS) for (const seed of SEEDS) {
      for (const q of buildSentenceRound(sentences, makeRng(seed))) {
        const build = q.sentence.build!;
        assert.equal(q.tiles.length, build.tokens.length, `${id} ${q.sentence.text}`);
        assert.ok(q.tiles.length <= buildCap(4), q.sentence.text);
        assert.equal(isSentenceBuilt(build.tokens.map(text => ({ text })), q.sentence), true, q.sentence.text);
      }
    }
  });

  it('Build: a long pair asks for its answer only, with the question voiced', () => {
    const halved = SEEDS.flatMap(seed => buildSentenceRound(unit(L(1, 1)), makeRng(seed))).filter(q => q.prompt);
    for (const q of halved) {
      assert.ok(q.prompt!.endsWith('?'), q.prompt!);
      assert.ok(spoken.has(q.prompt!), `${q.prompt} is not voiced`);
    }
    assert.ok(halved.length > 0, 'S1 U1 has a pair over nine words');
  });
});

describe('S1 U4 on the app: picture-free comparisons', () => {
  const ranking = unit(L(1, 4));

  it('True or false shows the sentence or its swapped twin and never a picture; half true; every text voiced', () => {
    for (const seed of SEEDS) {
      const round = buildTrueFalseRound(ranking, makeRng(seed));
      assert.equal(round.length, 6);
      for (const q of round) {
        assert.equal(q.pictureWord, null);
        assert.equal(q.text, q.isTrue ? q.sentence.text : q.sentence.claim!.falseText);
        assert.ok(spoken.has(q.text), q.text);
      }
      assert.equal(round.filter(q => q.isTrue).length, 3);
    }
  });

  it('Yes or No is a fact with no picture and no hint, half Yes, each question once and every exchange voiced', () => {
    for (const seed of SEEDS) {
      const round = buildYesNoRound(ranking, makeRng(seed));
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
});

describe('Yes or No elsewhere on Grade 4', () => {
  it('S2 U8 says «✅ = it was there»; S1 U3 says «it\'s there»; S1 U1 and U5 are match items with a picture', () => {
    const hints = (id: string) => new Set(SEEDS.flatMap(seed => buildYesNoRound(unit(id), makeRng(seed)).map(q => q.hint)));
    assert.deepEqual([...hints(L(2, 8))], ['was']);
    assert.deepEqual([...hints(L(1, 3))], ['there']);
    for (const id of [L(1, 1), L(1, 5)]) for (const q of buildYesNoRound(unit(id), makeRng(1))) {
      assert.equal(q.kind, 'match', id);
      assert.ok(q.picture, id);
      assert.ok(spoken.has(q.question) && spoken.has(yesNoExchange(q)), q.question);
    }
  });

  it('a pictured True or false only asks a sentence with a picture and a wrong picture; S2 U8 true or false is only «there was»', () => {
    for (const id of [L(1, 1), L(1, 3), L(1, 5), L(2, 8)]) for (const seed of SEEDS) {
      for (const q of buildTrueFalseRound(unit(id), makeRng(seed))) assert.ok(q.sentence.picture && q.sentence.falsePicture && q.pictureWord, q.sentence.key);
    }
  });
});
