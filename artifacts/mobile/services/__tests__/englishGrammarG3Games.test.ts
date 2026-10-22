/**
 * Round builders on the Grade 3 grammar data. The builders do not gate on review (the lesson screen's
 * `offeredGrammar` does), so they are tested over every Grade 3 unit.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { allGrammarSpoken, buildCap, grammarUnitsForGrade, unitSentences } from '@workspace/curriculum/englishGrammar';
import { makeRng } from '../publicGames/rng.ts';
import {
  MAX_BUILD_TILES,
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

const UNITS = grammarUnitsForGrade(3).map(u => ({ id: u.lessonId, sentences: unitSentences(u) }));
const G2 = grammarUnitsForGrade(2).map(u => ({ id: u.lessonId, sentences: unitSentences(u) }));
const L = (sem: number, unit: number) => `kbl-g3-eng-s${sem}-nccd-u${unit}_l1`;
const SEEDS = [1, 2, 3, 4, 5, 6];
const spoken = new Set(allGrammarSpoken());

describe('which activity each Grade 3 lesson offers', () => {
  it('Build everywhere; Choose on all but S2 U10 (all Yes or No); True or false on clothes, jobs and furniture; Yes or No on furniture and animals', () => {
    assert.equal(UNITS.length, 8);
    const offered = (a: Parameters<typeof grammarActivityAvailable>[0]) => UNITS.filter(u => grammarActivityAvailable(a, u.sentences)).map(u => u.id);
    assert.deepEqual(offered('grammar-choose'), UNITS.map(u => u.id).filter(id => id !== L(2, 10)));
    assert.equal(offered('grammar-build').length, 8);
    assert.deepEqual(offered('grammar-true'), [L(1, 3), L(1, 5), L(2, 9)]);
    assert.deepEqual(offered('grammar-yesno'), [L(2, 9), L(2, 10)]);
  });

  it('Grade 1 and 2 keep their cap of 7', () => {
    assert.equal(MAX_BUILD_TILES, 7);
    assert.equal(buildCap(2), 7);
    for (const { id, sentences } of G2) for (const seed of SEEDS) {
      for (const q of buildSentenceRound(sentences, makeRng(seed))) assert.ok(q.tiles.length <= MAX_BUILD_TILES, `${id}: ${q.sentence.text}`);
    }
  });
});

describe('Choose and Build on Grade 3', () => {
  it('Choose: the right option is the blanked word', () => {
    for (const { id, sentences } of UNITS) for (const seed of SEEDS) {
      for (const q of buildChooseRound(sentences, makeRng(seed))) {
        assert.equal(q.options[q.answerIndex], q.sentence.choose!.right, id);
        assert.notEqual(q.options[0], q.options[1], id);
      }
    }
  });

  it('Build: tiles are the build tokens, at most nine, and the placed tiles in order are judged against the build text', () => {
    for (const { id, sentences } of UNITS) for (const seed of SEEDS) {
      for (const q of buildSentenceRound(sentences, makeRng(seed))) {
        const build = q.sentence.build!;
        assert.equal(q.tiles.length, build.tokens.length, `${id} ${q.sentence.text}`);
        assert.ok(q.tiles.length <= buildCap(3), q.sentence.text);
        assert.equal(q.prompt, build.prompt);
        assert.equal(isSentenceBuilt(build.tokens.map(text => ({ text })), q.sentence), true, q.sentence.text);
        assert.equal(isSentenceBuilt([...build.tokens].reverse().map(text => ({ text })), q.sentence), build.tokens.length < 2 || build.tokens.join(' ') === [...build.tokens].reverse().join(' '));
      }
    }
  });

  it('Build: a long pair asks for its answer only, with the question as the prompt, and the whole sentence has a recording', () => {
    const routine = UNITS.find(u => u.id === L(1, 2))!.sentences;
    const rounds = SEEDS.flatMap(seed => buildSentenceRound(routine, makeRng(seed)));
    const halved = rounds.filter(q => q.prompt);
    assert.ok(halved.length > 0);
    for (const q of halved) {
      assert.ok(q.prompt!.endsWith('?'), q.prompt!);
      assert.ok(spoken.has(q.prompt!), `${q.prompt} is not voiced`);
      assert.ok(spoken.has(q.sentence.text));
    }
  });

  it('True or false: only sentences with a picture and a wrong picture are asked', () => {
    for (const { sentences } of UNITS) for (const seed of SEEDS) {
      for (const q of buildTrueFalseRound(sentences, makeRng(seed))) assert.ok(q.sentence.picture && q.sentence.falsePicture, q.sentence.key);
    }
  });
});

describe('Yes or No on Grade 3', () => {
  it('a round is eight items (six on S2 U9, which has six pictures), half Yes and half No, no picture twice, every exchange voiced', () => {
    for (const { id, sentences } of UNITS.filter(u => [L(2, 9), L(2, 10)].includes(u.id))) for (const seed of SEEDS) {
      const round = buildYesNoRound(sentences, makeRng(seed));
      const pictured = new Set(sentences.filter(s => s.yesNo && s.picture).map(s => s.picture!.word)).size;
      assert.equal(pictured, id === L(2, 9) ? 6 : pictured);
      assert.equal(round.length, Math.min(ROUND_LENGTH, pictured), id);
      assert.equal(round.filter(q => q.answer).length, Math.ceil(round.length / 2), id);
      const pictures = round.map(q => q.picture.word);
      assert.equal(new Set(pictures).size, pictures.length, `${id}: a picture twice`);
      for (const q of round) {
        assert.ok(spoken.has(q.question), q.question);
        assert.ok(spoken.has(yesNoExchange(q)), yesNoExchange(q));
        assert.equal(isYesNoRight(q, q.answer), true);
      }
    }
  });

  it('a fact asks from the row, with no hint; a marker asks «✅ = it\'s there»; Grade 2 food still says «likes»', () => {
    const animals = UNITS.find(u => u.id === L(2, 10))!.sentences;
    const kinds = new Set(SEEDS.flatMap(seed => buildYesNoRound(animals, makeRng(seed)).map(q => `${q.kind}:${q.hint}`)));
    assert.ok(kinds.has('fact:null'));
    assert.ok(kinds.has('marker:there'));
    assert.ok(![...kinds].some(k => k.startsWith('fact:') && k !== 'fact:null'));
    const food = G2.find(u => u.id === 'kbl-g2-eng-s2-nccd-u6_l1')!.sentences;
    for (const q of buildYesNoRound(food, makeRng(1))) assert.equal(q.hint, 'likes');
    for (const q of SEEDS.flatMap(seed => buildYesNoRound(animals, makeRng(seed)))) {
      if (q.kind === 'fact') assert.equal(q.answer, q.sentence.yesNo!.answer, q.question);
    }
  });
});
