/**
 * The offline classroom activity fits the lesson it was asked for.
 *
 * The escape challenge (the builder's default card) and the error detective were
 * one hand-written set of quadratic equations whatever the lesson: «س² + 7س + 12
 * = 0», a key of quadratic roots, «حل معادلات ${topic}», «المحقق الرياضي» cases
 * about a lost negative root. A 2026-11-13 audit found all 397 Grade 7 lessons
 * served it — an English vocabulary lesson became "Solve Vocabulary: City
 * tourism equations". The bingo and relay no-bank fallbacks also called out
 * «المعادلة: الصيغة الرياضية…» / "Formula: …" for any subject.
 *
 * Now a lesson with a bank draws both types from it — a quadratics lesson its
 * own quadratics — and any other lesson gets a subject-neutral version built
 * from its own outcomes or concepts. The formula calls stay for maths only.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiService } from '../ai/generators.ts';
import type { ClassroomActivity, ClassroomActivityRequest } from '../ai/AIService.ts';
import { ACTIVITY_CARDS } from '../classroomRouting.ts';
import { KB_LESSONS, getBookForLesson, getLessonById } from '../knowledgeBase.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const TYPES = ACTIVITY_CARDS.map(c => c.id);
const SUBJECT_NAME: Record<string, string> = {
  mathematics: 'Mathematics', english: 'English', arabic: 'Arabic', science: 'Science', social: 'Social Studies',
  islamic: 'Islamic Education', 'digital-literacy': 'Digital Literacy', 'financial-literacy': 'Financial Literacy',
  'vocational-education': 'Vocational Education', 'creative-arts': 'Creative Arts', 'physical-education': 'Physical Education',
  chemistry: 'Chemistry', history: 'History',
};

/** Sentences of the hand-written quadratic set, both languages. */
const QUADRATIC_SET = [
  'س² + 7س + 12 = 0', 'x² + 7x + 12 = 0', 'س² - 9 = 0', 'x² − 9 = 0', 'جذر مزدوج', 'double root',
  'مختبر الرياضيات', 'Math Lab', 'حل معادلات', 'equations using multiple techniques',
  'الجذر السالب', 'negative root', 'القسمة على المتغير', 'Dividing by a variable', 'quadratic',
];
/** The no-bank bingo and relay calls that asked any subject for a formula. */
const FORMULA_CALLS = ['المعادلة: الصيغة الرياضية', 'Formula: The mathematical expression', 'في المعادلة الجديدة', 'into the new expression'];
/** Anything that reads as an equation or a formula. */
const EQUATION = /[=²]|معادل|صيغة رياضية|equation|formula/i;

const strings = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(x => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out));
  return out;
};
const textOf = (a: ClassroomActivity) => strings(a).join('\n');

function lessonReq(lessonId: string, activityType: string, lang: 'ar' | 'en'): ClassroomActivityRequest {
  const l = getLessonById(lessonId)!;
  const book = getBookForLesson(l)!;
  return {
    grade: book.gradeId, subject: SUBJECT_NAME[book.subjectId] ?? book.subjectId,
    topic: lang === 'ar' ? l.titleAr : l.titleEn, lessonId, activityType,
    duration: 20, difficulty: 'standard', groupType: 'groups', teachingGoal: 'practice',
    language: lang === 'ar' ? 'arabic' : 'english',
  };
}

const grade7 = KB_LESSONS.filter(l => getBookForLesson(l)?.gradeId === 'grade-7');

describe('the offline classroom activity fits the lesson', () => {
  it('probe: Grade 7 has its 397 lessons', () => assert.equal(grade7.length, 397));

  it('no Grade 7 lesson gets the quadratic set, nor a non-maths one a formula call, in any type or language', async () => {
    const bad: string[] = [];
    for (const l of grade7) for (const type of TYPES) for (const lang of ['ar', 'en'] as const) {
      const text = textOf(await aiService.generateClassroomActivity(lessonReq(l.id, type, lang)));
      const maths = getBookForLesson(l)!.subjectId === 'mathematics';
      // A maths lesson keeps the formula call and the detective's card name.
      for (const s of [...QUADRATIC_SET, ...(maths ? [] : [...FORMULA_CALLS, 'المحقق الرياضي'])]) if (text.includes(s)) bad.push(`${l.id} ${type} ${lang}: «${s}»`);
    }
    assert.deepEqual(bad.slice(0, 20), [], `${bad.length} hits`);
  });

  it('a non-maths Grade 7 lesson whose own text holds no equation gets none, in any type', async () => {
    let checked = 0;
    const bad: string[] = [];
    for (const l of grade7) {
      if (getBookForLesson(l)!.subjectId === 'mathematics') continue;
      const own = [l.titleAr, l.titleEn, l.summaryAr, l.summaryEn, ...l.objectives, ...l.keyConceptsAr, ...l.keyConceptsEn,
        ...(l.keyTerms ?? []).flatMap(t => [t.ar, t.en])].join('\n');
      if (EQUATION.test(own)) continue;
      checked++;
      for (const type of TYPES) for (const lang of ['ar', 'en'] as const) {
        const text = textOf(await aiService.generateClassroomActivity(lessonReq(l.id, type, lang)));
        const hit = text.match(new RegExp(`[^\\n]*(?:${EQUATION.source})[^\\n]*`, 'i'));
        if (hit) bad.push(`${l.id} ${type} ${lang}: ${hit[0]}`);
      }
    }
    assert.ok(checked > 200, `probe: ${checked} lessons checked`);
    assert.deepEqual(bad.slice(0, 20), [], `${bad.length} hits`);
  });

  it('the English vocabulary lesson from the audit is not asked to solve equations', async () => {
    const l = grade7.find(x => getBookForLesson(x)!.subjectId === 'english' && /vocabulary/i.test(x.titleEn))!;
    assert.ok(l, 'probe: a Grade 7 English vocabulary lesson');
    for (const type of ['escape-challenge', 'error-detective'] as const) {
      const a = await aiService.generateClassroomActivity(lessonReq(l.id, type, 'en'));
      assert.ok(!/solve|equation/i.test(textOf(a)), `${type}: ${a.learningObjective}`);
      assert.equal(a.activityType, type);
      assert.ok(a.slides.filter(s => s.type === 'challenge').length >= 3, type);
    }
  });

  it('keeps the escape challenge five codes long and the detective three cases long', async () => {
    for (const id of [grade7[0]!.id, 'kbl-hist-s1-nccd-u1_l1']) for (const lang of ['ar', 'en'] as const) {
      const escape = await aiService.generateClassroomActivity(lessonReq(id, 'escape-challenge', lang));
      assert.equal(escape.slides.filter(s => s.type === 'challenge').length, 5);
      assert.deepEqual(escape.slides.filter(s => s.type === 'reveal').map(s => s.unlockCode), ['8', '4', '7', '3', '6']);
      assert.equal(escape.slides.at(-1)!.type, 'summary');
      escape.slides.forEach((s, i) => assert.equal(s.slideNumber, i + 1));
      const detective = await aiService.generateClassroomActivity(lessonReq(id, 'error-detective', lang));
      assert.equal(detective.slides.filter(s => s.type === 'challenge').length, 3);
      assert.equal(detective.slides.length, 8);
    }
  });

  it('a maths lesson that is not about quadratics draws both types from its own bank', async () => {
    // Grade 10 «الاشتقاق»: a banked family with nothing quadratic about it.
    const l = getLessonById('kbl-math-s2-nccd-u6_l2')!;
    assert.equal(l?.titleAr, 'الاشتقاق', 'probe: the Grade 10 derivative lesson');
    for (const lang of ['ar', 'en'] as const) {
      for (const type of ['escape-challenge', 'error-detective'] as const) {
        const a = await aiService.generateClassroomActivity(lessonReq(l.id, type, lang));
        const text = textOf(a);
        for (const s of QUADRATIC_SET) assert.ok(!text.includes(s), `${type} ${lang}: «${s}»`);
        // Bank items carry an answer of their own on every challenge.
        for (const s of a.slides.filter(x => x.type === 'challenge')) assert.ok((s.answer ?? '').length > 0, type);
      }
    }
  });

  it('a quadratics lesson gets quadratics, from its own bank', async () => {
    // Grade 9 «حل المعادلة التربيعية بالتحليل إلى العوامل».
    const l = getLessonById('kbl-g9-math-s1-nccd-u3_l2')!;
    assert.ok(/تربيعي/.test(l.titleAr), `probe: ${l.titleAr}`);
    for (const type of ['escape-challenge', 'error-detective'] as const) {
      const a = await aiService.generateClassroomActivity(lessonReq(l.id, type, 'ar'));
      const challenges = a.slides.filter(s => s.type === 'challenge');
      assert.ok(challenges.length >= 3, type);
      // The bank's problems, keyed, not the outcome-based fallback. (Mostly
      // equations; the bank also holds a word problem or two.)
      assert.ok(challenges.some(s => /x/.test(s.content)), `${type}: ${challenges.map(s => s.content).join(' | ')}`);
      for (const s of challenges) {
        assert.ok((s.answer ?? '').length > 0 && !/إجابة مرنة|تُقبل كل ملاحظة/.test(s.answer ?? ''), `${type}: ${s.answer}`);
      }
      // The quadratic set's own stems are gone; what is left is the bank's.
      assert.ok(!textOf(a).includes('مختبر الرياضيات'), type);
    }
  });
});
