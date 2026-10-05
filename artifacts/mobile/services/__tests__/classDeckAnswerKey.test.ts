/**
 * A class deck must never tick an option the answer key did not name.
 *
 * `indexOfAnswer` fell back to `Math.max(0, findIndex(...))`, so any key that
 * matched no option became «option A is correct». Live AI makes that the
 * common case, not a corner: the quiz prompt asks for options like
 * «أ) 3 / ب) 4» and a key like «ب) 4», and a model that answers with the
 * bare «4» or just «ب» matched nothing — so a class was shown A ticked green
 * and teams were awarded points on it. A key that was missing altogether threw
 * and failed the whole build over one question.
 *
 * The rule now: resolve the key by text (exact, whitespace-insensitive, with
 * option letters ignored on either side), then by a bare option letter, and
 * otherwise say "unresolved" — the question is dropped from a game (it cannot
 * be adjudicated) and shown as an open question, with the key as text, in a
 * quiz or worksheet deck.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDeckFromQuiz,
  buildDeckFromWorksheet,
  buildGameDeckFromQuiz,
  indexOfAnswer,
} from '../classDeck.ts';
import type { QuizOutput, WorksheetOutput } from '../ai/AIService.ts';

describe('indexOfAnswer', () => {
  const plain = ['3', '4', '5', '6'];
  const labelled = ['أ) 3', 'ب) 4', 'ج) 5', 'د) 6'];

  it('finds an exact or whitespace-insensitive match', () => {
    assert.equal(indexOfAnswer(plain, '5'), 2);
    assert.equal(indexOfAnswer(['x  y', 'z'], 'x y'), 0);
  });

  it('ignores an option letter the model baked into either side', () => {
    assert.equal(indexOfAnswer(labelled, '4'), 1);
    assert.equal(indexOfAnswer(plain, 'ب) 4'), 1);
    assert.equal(indexOfAnswer(labelled, 'ج) 5'), 2);
  });

  it('reads a bare option letter by position, Arabic or Latin', () => {
    assert.equal(indexOfAnswer(labelled, 'ب'), 1);
    assert.equal(indexOfAnswer(labelled, 'د)'), 3);
    assert.equal(indexOfAnswer(['a', 'b', 'c'], 'C'), 2);
    assert.equal(indexOfAnswer(['a', 'b', 'c'], 'b.'), 1);
  });

  it('prefers the option text over a letter reading', () => {
    // «و» is both the word and option (و); an option that says it wins.
    assert.equal(indexOfAnswer(['ه', 'و', 'ز'], 'و'), 1);
  });

  it('says unresolved — never option A — when nothing matches', () => {
    assert.equal(indexOfAnswer(plain, '7'), -1);
    assert.equal(indexOfAnswer(plain, 'something else'), -1);
    assert.equal(indexOfAnswer(plain, 'هـ'), -1); // a letter past the last option
    assert.equal(indexOfAnswer(plain, ''), -1);
    assert.equal(indexOfAnswer(plain, undefined), -1);
    assert.equal(indexOfAnswer(plain, null), -1);
  });

  it('does not read a bare number as a position', () => {
    // «2» that matches no option is a wrong key, not «the second option».
    assert.equal(indexOfAnswer(['10', '20'], '2'), -1);
  });
});

const quiz = (qs: Array<Partial<QuizOutput['questions'][number]>>): QuizOutput => ({
  title: 'اختبار', duration: 10, totalPoints: qs.length,
  questions: qs.map((q, i) => ({
    id: i + 1, type: 'multiple_choice', text: `س${i + 1}`, options: ['3', '4', '5', '6'],
    correctAnswer: '4', points: 1, ...q,
  })),
}) as unknown as QuizOutput;

describe('the Class Challenge drops what it cannot adjudicate', () => {
  const build = (q: QuizOutput) => buildGameDeckFromQuiz(q, 'درس', true, { teamCount: 3 });

  it('keeps a question whose key resolves, however it was written', () => {
    const deck = build(quiz([{ correctAnswer: 'ب) 4' }, { correctAnswer: 'ب' }, { correctAnswer: '4' }]));
    const idx = deck.slides.filter(s => s.type === 'question').map(s => s.correctIndex);
    assert.deepEqual(idx, [1, 1, 1]);
    assert.equal(deck.game?.questionCount, 3);
  });

  it('drops a question with a wrong, missing or undefined key instead of serving option A', () => {
    const deck = build(quiz([
      { correctAnswer: '4' },
      { correctAnswer: '99' },
      { correctAnswer: undefined },
      { correctAnswer: '5' },
    ]));
    const qs = deck.slides.filter(s => s.type === 'question');
    assert.equal(qs.length, 2);
    assert.deepEqual(qs.map(s => s.correctIndex), [1, 2]);
    assert.equal(deck.game?.questionCount, 2);
    // Numbered and indexed contiguously, so the scoreboard's «n of N» stays true.
    assert.deepEqual(qs.map(s => s.questionIndex), [0, 1]);
  });

  it('builds an empty game rather than throwing when no key resolves', () => {
    const deck = build(quiz([{ correctAnswer: undefined }, { correctAnswer: 'nope' }]));
    assert.equal(deck.game?.questionCount, 0);
  });
});

describe('a quiz or worksheet deck shows an unresolved key as text, not as option A', () => {
  it('quiz: the question becomes an open one carrying the key', () => {
    const deck = buildDeckFromQuiz(quiz([{ correctAnswer: '99' }, { correctAnswer: undefined }]), 'درس', true);
    const qs = deck.slides.filter(s => s.title.startsWith('سؤال'));
    assert.equal(qs.length, 2);
    assert.ok(qs.every(s => s.type === 'challenge' && s.correctIndex === undefined));
    assert.equal(qs[0]!.answer, '99');
    assert.equal(qs[1]!.answer, '');
  });

  it('worksheet: same rule', () => {
    const ws = {
      instructions: '', sections: [{ title: 'ق', questions: [{ text: 'س', options: ['3', '4'], points: 1 }] }],
      answerKey: [{ num: 1, answer: 'ليس خيارًا' }],
    } as unknown as WorksheetOutput;
    const deck = buildDeckFromWorksheet(ws, 'درس', true);
    const q = deck.slides.find(s => s.title === 'سؤال 1')!;
    assert.equal(q.type, 'challenge');
    assert.equal(q.correctIndex, undefined);
    assert.equal(q.answer, 'ليس خيارًا');
  });

  it('still ticks the right option when the key resolves', () => {
    const deck = buildDeckFromQuiz(quiz([{ correctAnswer: 'ب' }]), 'درس', true);
    assert.equal(deck.slides.find(s => s.title === 'سؤال 1')!.correctIndex, 1);
  });
});

describe('the Class Challenge reads as Arabic, not as a template', () => {
  const text = (teams: number, n: number) => {
    const deck = buildGameDeckFromQuiz(
      quiz(Array.from({ length: n }, () => ({ correctAnswer: '4' }))), 'درس', true, { teamCount: teams },
    );
    return deck.slides.map(s => s.content).join('\n') + '\n' + deck.teacherPreparation;
  };

  it('two teams are «فريقين», not «2 فرق»', () => {
    const t = text(2, 4);
    assert.match(t, /مقسوم إلى فريقين/);
    assert.doesNotMatch(t, /2 فرق/);
  });

  it('three to six teams take the plural', () => {
    assert.match(text(4, 4), /مقسوم إلى 4 فرق/);
  });

  it('the standings count agrees with the number of questions', () => {
    const t = text(3, 12);
    assert.doesNotMatch(t, /من 12 أسئلة/);
    assert.match(t, /من 12 سؤال/);
  });
});
