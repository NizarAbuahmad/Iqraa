import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeRng } from '../publicGames/rng.ts';
import type { TextQuestion } from '../publicGames/textQuiz.ts';
import { buildAntonymRound } from '../publicGames/antonyms.ts';
import { buildPluralRound } from '../publicGames/plurals.ts';
import { buildNumberRound } from '../publicGames/numberType.ts';
import { buildFractionRound } from '../publicGames/fractions.ts';
import { buildMatterRound, STATE_DEFINITION, SUBSTANCES } from '../publicGames/matterStates.ts';
import { buildGovernorateRound } from '../publicGames/governorates.ts';
import { toArabicDigits } from '../labFormat.ts';

const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
const langs = ['ar', 'en'] as const;
const answerLabel = (q: TextQuestion) => q.options.find(o => o.id === q.correctId)!.label;
const latin = (s: string) => s.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/٫/g, '.');

function eachQuestion(build: (lang: 'ar' | 'en', n: number, rng: () => number) => TextQuestion[], fn: (q: TextQuestion, lang: 'ar' | 'en') => void) {
  for (const lang of langs) for (const seed of seeds) for (const q of build(lang, 8, makeRng(seed))) fn(q, lang);
}

test('opposites, plurals and governorates explain by restating the key, naming the subject and the answer', () => {
  for (const build of [buildAntonymRound, buildPluralRound, buildGovernorateRound]) {
    eachQuestion(build, q => {
      assert.ok(q.explanation && q.explanation.length > 0);
      assert.ok(q.explanation.includes(q.subject!), `${q.explanation} lacks ${q.subject}`);
      assert.ok(q.explanation.includes(answerLabel(q)), `${q.explanation} lacks ${answerLabel(q)}`);
      assert.equal(q.explanationLtr, undefined);
    });
  }
});

test('states of matter: the line names the substance, its state and that state\'s definition', () => {
  const stateLabel = { solid: { ar: 'صلب', en: 'Solid' }, liquid: { ar: 'سائل', en: 'Liquid' }, gas: { ar: 'غاز', en: 'Gas' } };
  assert.equal(SUBSTANCES.length >= 20, true);
  eachQuestion(buildMatterRound, (q, lang) => {
    const state = q.correctId as 'solid' | 'liquid' | 'gas';
    assert.ok(q.explanation!.includes(q.subject!));
    assert.ok(q.explanation!.includes(stateLabel[state][lang]));
    assert.ok(q.explanation!.includes(STATE_DEFINITION[state][lang]));
  });
});

test('which number: the line carries the answer in the right digits and the right property', () => {
  const word = {
    playNumberEvenPrompt: { ar: 'زوجي', en: 'even' },
    playNumberOddPrompt: { ar: 'فردي', en: 'odd' },
    playNumberPrimePrompt: { ar: 'أولي', en: 'prime' },
  } as const;
  eachQuestion(buildNumberRound, (q, lang) => {
    const n = q.correctId;
    assert.ok(q.explanation!.includes(lang === 'ar' ? toArabicDigits(n) : n), q.explanation);
    assert.ok(q.explanation!.includes(word[q.promptKey as keyof typeof word][lang]), q.explanation);
    assert.equal(q.explanationLtr, undefined);
    // No operator inside a sentence of Arabic.
    assert.doesNotMatch(q.explanation!, /[=×÷+−≈]/);
  });
});

test('fractions: the LTR line gives both decimals, in option order, with = only when exact', () => {
  eachQuestion(buildFractionRound, (q, lang) => {
    assert.ok(q.explanation && q.explanation.length > 0);
    const line = q.explanationLtr!.replace(/[‭‬]/g, '');
    const parts = line.split('    ');
    assert.equal(parts.length, 2);
    parts.forEach((part, i) => {
      const m = /^([0-9٠-٩]+)\/([0-9٠-٩]+) (=|≈) ([0-9٠-٩]+[.٫][0-9٠-٩]+)$/.exec(part);
      assert.ok(m, `bad part «${part}»`);
      const [n, d] = [Number(latin(m[1]!)), Number(latin(m[2]!))];
      assert.equal(q.options[i]!.id, `${n}/${d}`, 'parts follow option order');
      const dec = Number(latin(m[4]!));
      assert.ok(Math.abs(dec - n / d) <= 0.005 + 1e-9, `${part}: ${dec} vs ${n / d}`);
      const exact = Number((n / d).toFixed(2)) === n / d;
      assert.equal(m[3], exact ? '=' : '≈', part);
      if (lang === 'ar') assert.doesNotMatch(part, /[0-9]/); // Arabic-Indic digits only
    });
  });
});

test('the board and the text-quiz renderer show a reveal', () => {
  const root = join(import.meta.dirname, '..', '..');
  const board = readFileSync(join(root, 'components', 'publicGames', 'TriviaGame.tsx'), 'utf8');
  const quiz = readFileSync(join(root, 'components', 'publicGames', 'TextQuizGame.tsx'), 'utf8');
  assert.match(board, /renderReveal\?:/);
  assert.match(board, /renderReveal\(question, selected\)/);
  assert.match(board, /ScrollView/);
  assert.match(quiz, /renderReveal=/);
  assert.match(quiz, /explanationLtr/);
});
