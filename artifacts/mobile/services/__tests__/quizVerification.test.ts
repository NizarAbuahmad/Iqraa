/**
 * Quiz verification provenance.
 *
 * What these guard: a quiz may only claim a key was proved when something
 * proved it, and a verifier that is unavailable must degrade to "from the
 * reviewed bank" rather than to silence or to a claim.
 *
 * The unit is the question. A quiz mixes derivative items the verifier can
 * prove with word problems it cannot touch, so the old whole-deck boolean was
 * wrong either way: true vouched for keys nobody checked, false hid the ones
 * that were checked.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BANK_OUTCOME,
  isTrueFalseAnswer,
  stripOptionLabel,
  summarizeVerification,
  toVerifiablePair,
  verifyDeckExamples,
  verifyQuizAnswers,
  verifyWorksheetAnswers,
  type VerifyOutcome,
} from '../quizVerification.ts';
import type { ActivitySlide, QuizOutput, WorksheetOutput } from '../ai/AIService.ts';

const quiz = (answers: string[]): QuizOutput => ({
  title: 'اختبار',
  duration: 15,
  totalPoints: answers.length,
  questions: answers.map((a, i) => ({
    id: `q${i}`,
    type: 'multiple_choice' as const,
    text: `اشتقاق ${i}`,
    options: [a, 'خطأ'],
    correctAnswer: a,
    points: 1,
    explanation: '',
  })),
});

// The generator never populates a worksheet question's own `answer` field —
// only the top-level `answerKey`, keyed by 1-based position across the
// flattened section/question list. Mirror that shape here.
const worksheet = (answers: string[]): WorksheetOutput => ({
  title: 'ورقة عمل',
  instructions: '',
  sections: [
    {
      type: 'short_answer',
      title: 'القسم الأول',
      questions: answers.map((_, i) => ({ text: `اشتقاق ${i}`, points: 1 })),
    },
  ],
  answerKey: answers.map((a, i) => ({ num: i + 1, answer: a })),
});

const proves: VerifyOutcome = { verifiedBy: 'symbolic', computedAnswer: '12x^3' };

describe('verifyQuizAnswers', () => {
  it('returns one outcome per question, in order', async () => {
    // Callers index into this by question number; a dropped entry silently
    // shifts every badge after it onto the wrong question.
    let n = 0;
    const out = await verifyQuizAnswers(quiz(['a', 'b', 'c']), async () => {
      n += 1;
      return n === 2 ? proves : BANK_OUTCOME;
    });
    assert.equal(out.length, 3);
    assert.equal(out[1]!.verifiedBy, 'symbolic');
    assert.equal(out[0]!.verifiedBy, 'bank');
  });

  it('degrades to bank when the verifier throws', async () => {
    // The verifier being down is an infrastructure gap, not evidence about
    // the answer. It must never become a claim in either direction.
    const out = await verifyQuizAnswers(quiz(['a']), async () => {
      throw new Error('ECONNREFUSED');
    });
    assert.deepEqual(out, [BANK_OUTCOME]);
  });

  it('does not call the verifier for a question with no answer key', async () => {
    let called = false;
    const out = await verifyQuizAnswers(quiz(['']), async () => {
      called = true;
      return proves;
    });
    assert.equal(called, false);
    assert.equal(out[0]!.verifiedBy, 'bank');
  });

  it('passes the wrong options as distractors, not the correct one', async () => {
    let seen: string[] = [];
    await verifyQuizAnswers(quiz(['a']), async (_q, _a, d) => {
      seen = d;
      return proves;
    });
    assert.deepEqual(seen, ['خطأ']);
  });
});

describe('verifyWorksheetAnswers', () => {
  it('returns one outcome per question, positionally aligned to answerKey', async () => {
    let n = 0;
    const out = await verifyWorksheetAnswers(worksheet(['a', 'b', 'c']), async () => {
      n += 1;
      return n === 2 ? proves : BANK_OUTCOME;
    });
    assert.equal(out.length, 3);
    assert.equal(out[1]!.verifiedBy, 'symbolic');
    assert.equal(out[0]!.verifiedBy, 'bank');
  });

  it('degrades to bank when the verifier throws', async () => {
    const out = await verifyWorksheetAnswers(worksheet(['a']), async () => {
      throw new Error('ECONNREFUSED');
    });
    assert.deepEqual(out, [BANK_OUTCOME]);
  });

  it('does not call the verifier for a question with no answerKey entry', async () => {
    let called = false;
    const out = await verifyWorksheetAnswers(worksheet(['']), async () => {
      called = true;
      return proves;
    });
    assert.equal(called, false);
    assert.equal(out[0]!.verifiedBy, 'bank');
  });

  it('flattens sections in order before matching against answerKey', async () => {
    const ws: WorksheetOutput = {
      title: 'ورقة عمل',
      instructions: '',
      sections: [
        { type: 'short_answer', title: 'الأول', questions: [{ text: 'س1', points: 1 }] },
        { type: 'short_answer', title: 'الثاني', questions: [{ text: 'س2', points: 1 }] },
      ],
      answerKey: [
        { num: 1, answer: 'a' },
        { num: 2, answer: 'b' },
      ],
    };
    const seen: string[] = [];
    await verifyWorksheetAnswers(ws, async (_q, a) => { seen.push(a); return proves; });
    assert.deepEqual(seen, ['a', 'b']);
  });
});

describe('verifyDeckExamples', () => {
  const slide = (type: ActivitySlide['type'], answer?: string): ActivitySlide => ({
    slideNumber: 1,
    type,
    title: 'شريحة',
    content: 'اشتق: 3x^4',
    durationSeconds: 0,
    ...(answer !== undefined ? { answer } : {}),
  });

  it('returns outcomes aligned to the slide array, undefined for non-examples', async () => {
    const deck = [slide('intro'), slide('challenge', '12x^3'), slide('summary')];
    const out = await verifyDeckExamples(deck, async () => proves);
    assert.equal(out.length, 3);
    assert.equal(out[0], undefined);
    assert.deepEqual(out[1], proves);
    assert.equal(out[2], undefined);
  });

  it('skips a challenge slide with no answer — nothing to prove a key against', async () => {
    let called = false;
    const out = await verifyDeckExamples([slide('challenge')], async () => {
      called = true;
      return proves;
    });
    assert.equal(called, false);
    assert.equal(out[0], undefined);
  });

  it('degrades to bank when the verifier throws', async () => {
    const out = await verifyDeckExamples([slide('challenge', '12x^3')], async () => {
      throw new Error('ECONNREFUSED');
    });
    assert.deepEqual(out, [BANK_OUTCOME]);
  });

  it("rephrases a book-style f(x)/f'(x) pair so the classifier sees a derivative", async () => {
    // The exact shape the curriculum stores: typographic ² and −, marker in
    // the answer. Verbatim this classifies as an equation and can never be
    // proved; rephrased it is exactly what the derivative prover supports.
    const seen: string[] = [];
    const ex: ActivitySlide = {
      slideNumber: 1, type: 'challenge', title: 'مثال',
      content: 'f(x) = 4x² + 3x − 1', answer: "f'(x) = 8x + 3", durationSeconds: 60,
    };
    await verifyDeckExamples([ex], async (q, a) => { seen.push(q, a); return proves; });
    assert.match(seen[0]!, /f'\(x\) = \?/);
    assert.equal(seen[1], '8x + 3');
  });
});

describe('toVerifiablePair', () => {
  it('latinizes typographic math in the derived answer', () => {
    const p = toVerifiablePair('f(x) = x³', "f'(x) = 3x²");
    assert.equal(p.answer, '3x^2');
    assert.match(p.question, /→ f'\(x\) = \?$/);
  });

  it('leaves non-derivative pairs untouched', () => {
    const p = toVerifiablePair('حل: x² - 5x + 6 = 0', 'x = 2 أو x = 3');
    assert.equal(p.question, 'حل: x² - 5x + 6 = 0');
    assert.equal(p.answer, 'x = 2 أو x = 3');
  });
});

describe('summarizeVerification', () => {
  it('counts symbolic and bank separately', () => {
    const s = summarizeVerification([proves, BANK_OUTCOME, proves]);
    assert.deepEqual(s, { total: 3, symbolic: 2, bank: 1, anySymbolic: true });
  });

  it('reports anySymbolic false when nothing was proved', () => {
    // This is the state the whole hosted demo has been in: everything from the
    // bank, nothing checked. The summary must not read as a success.
    const s = summarizeVerification([BANK_OUTCOME, BANK_OUTCOME]);
    assert.equal(s.anySymbolic, false);
    assert.equal(s.symbolic, 0);
  });

  it('handles an empty quiz without dividing by zero', () => {
    assert.deepEqual(summarizeVerification([]), {
      total: 0, symbolic: 0, bank: 0, anySymbolic: false,
    });
  });
});

describe('derivative pairs reach the verifier in the form it can parse', () => {
  /** Records exactly what the verifier was asked, not just how many times. */
  const recorder = () => {
    const calls: { question: string; answer: string; distractors: string[] }[] = [];
    const fn = async (question: string, answer: string, distractors: string[]) => {
      calls.push({ question, answer, distractors });
      return BANK_OUTCOME;
    };
    return { calls, fn };
  };

  it('strips the f′(x) prefix for a quiz, as the deck path already did', async () => {
    // Verbatim, the verifier received answer "f'(x) = 2x" — unparseable — so
    // every derivative item in a quiz degraded to 'bank' while the identical
    // item inside a class deck verified. Same maths, two different stories.
    const { calls, fn } = recorder();
    const q = quiz(["f'(x) = 2x"]);
    q.questions[0]!.text = 'أوجد مشتقة f(x) = x².';
    await verifyQuizAnswers(q, fn);
    assert.equal(calls[0]!.answer, '2x');
    assert.match(calls[0]!.question, /f'\(x\) = \?$/);
  });

  it('does the same for a worksheet', async () => {
    const { calls, fn } = recorder();
    const w = worksheet(["f'(x) = 3x² - 4"]);
    w.sections[0]!.questions[0]!.text = 'أوجد f′(x) إذا كان f(x) = x³ − 4x.';
    await verifyWorksheetAnswers(w, fn);
    assert.equal(calls[0]!.answer, '3x^2 - 4');
  });

  it('leaves a non-derivative pair untouched', async () => {
    const { calls, fn } = recorder();
    const q = quiz(['x = 6']);
    q.questions[0]!.text = 'ما ناتج / حل: 2x + 5 = 17؟';
    await verifyQuizAnswers(q, fn);
    assert.equal(calls[0]!.answer, 'x = 6');
    assert.equal(calls[0]!.question, 'ما ناتج / حل: 2x + 5 = 17؟');
  });

  it('keeps passing the distractors alongside the rewritten pair', async () => {
    const { calls, fn } = recorder();
    const q = quiz(["f'(x) = 2x"]);
    q.questions[0]!.text = 'أوجد مشتقة f(x) = x².';
    q.questions[0]!.options = ["f'(x) = 2x", 'x²', '2'];
    await verifyQuizAnswers(q, fn);
    assert.deepEqual(calls[0]!.distractors, ['x²', '2']);
  });
});

describe('option labels on generated multiple-choice keys', () => {
  // `quizPromptAr` asks the model for `"options": ["أ) خيار", …]` and
  // `"correctAnswer": "أ) الخيار الصحيح"`, so every generated MCQ arrives
  // labelled. SymPy cannot parse «أ) 15x²»: the key failed to parse and every
  // distractor came back parse_or_compare_error, so the item was rejected as
  // bad_distractors. No generated multiple-choice derivative had ever earned
  // a symbolic badge — on the one family the verifier is best at. It failed
  // closed, so the badge was never wrong, just never shown.
  const recorder = () => {
    const calls: { question: string; answer: string; distractors: string[] }[] = [];
    const fn = async (question: string, answer: string, distractors: string[]) => {
      calls.push({ question, answer, distractors });
      return BANK_OUTCOME;
    };
    return { calls, fn };
  };

  it('strips the label from the key and from every distractor', async () => {
    const { calls, fn } = recorder();
    const q = quiz(['أ) 15x²']);
    q.questions[0]!.text = 'ما مشتقة الدالة f(x) = 5x³؟';
    q.questions[0]!.options = ['أ) 15x²', 'ب) 5x²', 'ج) 15x³', 'د) 3x²'];
    await verifyQuizAnswers(q, fn);
    assert.equal(calls[0]!.answer, '15x²');
    assert.deepEqual(calls[0]!.distractors, ['5x²', '15x³', '3x²']);
  });

  it('does not leave the correct option in its own distractor list', async () => {
    // The filter compares option to key. Strip one side only and «أ) 15x²»
    // no longer equals '15x²', so the right answer rides along as a
    // distractor and check_distractors rejects it as equivalent_to_answer —
    // turning a correct key into a failed verification.
    const { calls, fn } = recorder();
    const q = quiz(['أ) 15x²']);
    q.questions[0]!.options = ['أ) 15x²', 'ب) 5x²'];
    await verifyQuizAnswers(q, fn);
    assert.deepEqual(calls[0]!.distractors, ['5x²']);
  });

  it('leaves an unlabelled answer alone', () => {
    assert.equal(stripOptionLabel('15x²'), '15x²');
    assert.equal(stripOptionLabel('(x-2)(x+3)'), '(x-2)(x+3)');
    assert.equal(stripOptionLabel('x = 5'), 'x = 5');
  });

  it('never eats a decimal point', () => {
    // Accepting `1.` as a label would rewrite the decimal key '2. 5' to '5'.
    assert.equal(stripOptionLabel('2.5'), '2.5');
    assert.equal(stripOptionLabel('2. 5'), '2. 5');
  });
});

describe('صح/خطأ questions', () => {
  it('never asks the verifier to prove a verdict', async () => {
    // A true/false statement about a derivative still reads as a derivative
    // question, so the classifier claims it and the verifier is asked whether
    // «صحيح» equals 2x. It never can. Worse, the item is then reported as a
    // key SymPy rejected — indistinguishable from the model getting the maths
    // wrong, when it answered exactly the question it was asked.
    let called = false;
    const q = quiz(['صحيح']);
    q.questions[0]!.type = 'true_false';
    q.questions[0]!.text = 'مشتقة الدالة f(x) = x² هي 2x. صح أم خطأ؟';
    q.questions[0]!.options = ['صحيح', 'خطأ'];
    const out = await verifyQuizAnswers(q, async () => {
      called = true;
      return proves;
    });
    assert.equal(called, false);
    assert.equal(out[0]!.verifiedBy, 'bank');
  });

  it('recognises both spellings, both languages, labelled or not', () => {
    for (const a of ['صحيح', 'صح', 'خطأ', 'خاطئ', 'true', 'False', 'ج) صحيح']) {
      assert.equal(isTrueFalseAnswer(a), true, a);
    }
    for (const a of ['15x²', 'x = 5', '']) {
      assert.equal(isTrueFalseAnswer(a), false, a);
    }
  });
});
