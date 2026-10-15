/**
 * The teacher's column is written in the teacher's own voice.
 *
 * The plans addressed the teacher in the imperative — «اعرض الظاهرة… اسأل…
 * فسّر… صحّح» — so the «دور المُعلم» column of the Ministry form read as an
 * instruction sheet handed to someone else. The form is the teacher's own
 * record of what they WILL do, so every action is first person, future:
 * «سأعرض الظاهرة… ثم سأسأل…». Words inside «…» are spoken to the students
 * («ما دليلك؟») and stay as they are, so they are removed before checking.
 *
 * What is NOT checked: the students' own roles («يكتب كل طالب…»), which are
 * third person already, and `homework`, which is addressed to the students.
 * The English plan is untouched.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '../ai/generators.ts';
import { LESSON_STYLE_IDS } from '../ai/lessonPlanBlueprints.ts';
import { KB_LESSONS, getBookForLesson } from '../knowledgeBase.ts';
import type { AIRequest, LessonPlanOutput } from '../ai/AIService.ts';
import { FIRST_PERSON, imperativesIn, norm } from './teacherVoiceCheck.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

/** Fields the teacher acts in. `homework` is the students' and `materials` are nouns. */
const TEACHER_FIELDS = [
  'priorReview', 'introduction', 'mainActivity', 'guidedPractice',
  'independentPractice', 'closure', 'assessment', 'differentiation',
] as const;

/** The same real block shape `lessonPlanStyle.test.ts` uses for a document-grounded plan. */
const DOC_BLOCK = [
  '=== مواد المعلم المرفوعة (سياق أساسي) ===',
  'ملف 1: bonding.pdf (pdf)',
  'جودة الاستخراج: نص حقيقي',
  'عنوان: الروابط الأيونية',
  'ملخص: ملخص الدرس من الملف',
  'مفاهيم: الرابطة الأيونية · الرابطة التساهمية · الشحنة',
].join('\n');

/** One lesson per subject, so every `LessonKind` is covered. */
const lessons = (() => {
  const seen = new Set<string>();
  const out: Array<{ subjectId: string; gradeId: string; id: string; title: string }> = [];
  for (const l of KB_LESSONS) {
    const b = getBookForLesson(l);
    if (!b || seen.has(b.subjectId)) continue;
    seen.add(b.subjectId);
    out.push({ subjectId: b.subjectId, gradeId: b.gradeId, id: l.id, title: l.titleAr });
  }
  return out;
})();

const planFor = (l: (typeof lessons)[number], style: string, extra: Partial<AIRequest> = {}) =>
  aiService.generateLessonPlan({
    grade: l.gradeId, subject: l.subjectId, topic: l.title, lessonId: l.id,
    language: 'arabic', duration: 45, teachingStyle: style, ...extra,
  } as AIRequest);

function assertTeacherVoice(p: LessonPlanOutput, label: string) {
  for (const f of TEACHER_FIELDS) {
    const value = (p as unknown as Record<string, unknown>)[f];
    if (typeof value !== 'string' || !value) continue;
    assert.deepEqual(imperativesIn(value), [], `${label} · ${f} addresses the teacher in the imperative:\n${value}`);
  }
  // A phase's own text must say what the teacher WILL do, not merely avoid the imperative.
  for (const f of ['mainActivity', 'guidedPractice', 'closure', 'assessment'] as const) {
    assert.match(norm(p[f] ?? ''), FIRST_PERSON, `${label} · ${f} never says «سأ…» / «سنـ…»:\n${p[f]}`);
  }
}

describe('the teacher column is in the teacher’s first-person voice', () => {
  it('the detector catches the screenshot’s own wording', () => {
    assert.deepEqual(imperativesIn('اعرض الظاهرة دون أن تشرحها، ثم اسأل: «ماذا لاحظتم؟» وسجّل التوقعات'), ['اعرض', 'اسأل', 'وسجل']);
    assert.deepEqual(imperativesIn('سأعرض الظاهرة دون أن أشرحها، ثم سأسأل: «ماذا لاحظتم؟» وسأسجّل التوقعات'), []);
  });

  for (const l of lessons) {
    for (const style of LESSON_STYLE_IDS) {
      it(`${l.subjectId} · ${style}`, async () => {
        // The intro and closure are drawn with `pick()`, so draw several.
        for (let i = 0; i < 6; i++) assertTeacherVoice(await planFor(l, style), `${l.subjectId}/${style}`);
      });
    }
  }

  it('a document-grounded plan is in the same voice', async () => {
    const l = lessons[0];
    for (const style of LESSON_STYLE_IDS) {
      assertTeacherVoice(await planFor(l, style, { additionalContext: DOC_BLOCK }), `doc/${style}`);
    }
  });
});
