/**
 * The teaching style has to shape the whole lesson, not one field.
 *
 * `teachingStyle` used to reach exactly ONE of the plan's eleven fields —
 * `mainActivity`. Everything around it stayed direct-instruction shaped, so a
 * `collaborative` plan opened with group task cards and then, two sections
 * later, told students «المناقشة بين الطلبة مؤجّلة». The plan contradicted
 * itself inside one document. With an uploaded file the picker was inert
 * altogether: the document branch hardcoded «شرح مباشر من المواد المرفوعة».
 *
 * Note on what these tests do NOT assert: `introduction`, `closure`,
 * `assessment` and `homework` all vary between two runs of the SAME style —
 * that is the `pick()` helper. Measuring "the three styles differ" on those
 * fields would pass even with the style ignored, which is exactly how the
 * original defect hid. Every assertion below is either about a field the style
 * genuinely owns, or about a phrase that only one style may contain.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '@/services/ai/generators.ts';
import { LESSON_STYLE_IDS } from '@/services/ai/lessonPlanBlueprints.ts';
import type { AIRequest, LessonPlanOutput } from '@/services/ai/AIService.ts';

/** The real block shape, per `buildDocumentPromptBlock` in
 *  `services/documents/extractMeta.ts`. A block that does not match the parser
 *  silently falls through to the normal path and proves nothing. */
const DOC_BLOCK = [
  '=== مواد المعلم المرفوعة (سياق أساسي) ===',
  'ملف 1: bonding.pdf (pdf)',
  'جودة الاستخراج: نص حقيقي',
  'عنوان: الروابط الأيونية',
  'ملخص: ملخص الدرس من الملف',
  'مفاهيم: الرابطة الأيونية · الرابطة التساهمية · الشحنة',
].join('\n');

const AR = { topic: 'قانون الجيوب', subject: 'الرياضيات', grade: 'الصف العاشر', language: 'arabic' as const, duration: 45 };
const EN = { topic: 'Law of Sines', subject: 'Mathematics', grade: 'Grade 10', language: 'english' as const, duration: 45 };

/** The fields the style owns. Deliberately excludes the randomised ones. */
const STYLE_FIELDS = [
  'materials', 'mainActivity', 'guidedPractice',
  'independentPractice', 'assessment', 'differentiation',
] as const;

const plan = (base: typeof AR | typeof EN, teachingStyle: string, additionalContext?: string) =>
  aiService.generateLessonPlan({ ...base, teachingStyle, ...(additionalContext ? { additionalContext } : {}) } as AIRequest);

describe('teaching style shapes the whole plan', () => {
  for (const [name, base] of [['ar', AR], ['en', EN]] as const) {
    it(`${name}: every style-owned field differs across all three styles`, async () => {
      const out: Record<string, LessonPlanOutput> = {};
      for (const style of LESSON_STYLE_IDS) out[style] = await plan(base, style);
      for (const field of STYLE_FIELDS) {
        const values = LESSON_STYLE_IDS.map(s => JSON.stringify((out[s] as any)[field]));
        assert.equal(
          new Set(values).size, LESSON_STYLE_IDS.length,
          `"${field}" is shared between styles — ${new Set(values).size} distinct across ${LESSON_STYLE_IDS.length}`,
        );
      }
    });
  }

  it('an unknown style falls back to direct rather than throwing', async () => {
    const out = await plan(AR, 'socratic-seminar');
    assert.ok(out.mainActivity.length > 0);
    const direct = await plan(AR, 'direct');
    assert.equal(out.guidedPractice, direct.guidedPractice);
  });
});

describe('a plan does not contradict its own style', () => {
  it('collaborative never bans peer discussion', async () => {
    // The exact clause the old plan carried, from lpIndependentAr/En.
    const ar = JSON.stringify(await plan(AR, 'collaborative'));
    assert.ok(!/المناقشة بين الطلبة مؤجّلة/.test(ar), 'collaborative plan still defers peer discussion');
    const en = JSON.stringify(await plan(EN, 'collaborative'));
    assert.ok(!/peer discussion is not/i.test(en), 'collaborative plan still forbids peer discussion');
  });

  it('collaborative keeps individual accountability, without calling it solo work', async () => {
    const out = await plan(AR, 'collaborative');
    assert.match(out.independentPractice, /مساءلة فردية/, 'expected individual accountability after the group work');
    assert.match(out.mainActivity, /بطاقات مهمة|بطاقة/, 'expected task cards');
  });

  it('inquiry does not hand over the rule before students look for it', async () => {
    const out = await plan(AR, 'inquiry');
    assert.match(out.mainActivity, /تخمين/, 'expected students to record a conjecture');
    assert.match(out.guidedPractice, /لن أشرح القاعدة/, 'expected the guided phase to withhold the rule');
    assert.match(out.independentPractice, /حالة جديدة|لم تُناقَش/, 'expected the conclusion to be tested on a new case');
  });

  it('direct keeps its I-Do / We-Do / You-Do sequence', async () => {
    const out = await plan(AR, 'direct');
    assert.match(out.mainActivity, /أنا أفعل/);
    assert.match(out.guidedPractice, /نحن نفعل/);
    assert.match(out.independentPractice, /أنت تفعل/);
  });

  it('only direct describes its independent stage as individual by design', async () => {
    // Guards the opposite failure: stripping the clause everywhere would pass
    // the collaborative test above while making the direct plan incoherent.
    const direct = await plan(AR, 'direct');
    assert.match(direct.independentPractice, /فردي/);
  });
});

describe('the 5E model is a style of its own, appended to the picker', () => {
  it('is the fourth style — appended, so a saved styleIdx never moves', () => {
    assert.deepEqual([...LESSON_STYLE_IDS], ['direct', 'inquiry', 'collaborative', '5e']);
  });

  /** The index of the first stage label in `text`; -1 when it is missing. */
  const at = (text: string, label: string) => text.indexOf(label);

  it('ar: the five stages are named, in order, across the fields that carry them', async () => {
    const out = await plan(AR, '5e');
    assert.match(out.introduction, /^التشويق/, 'the opening hook is the Engage stage and says so');
    const explore = at(out.mainActivity, 'الاستكشاف');
    const explain = at(out.mainActivity, 'التفسير');
    assert.ok(explore >= 0 && explain >= 0, 'main activity names Explore and Explain');
    assert.ok(explore < explain, 'students explore BEFORE the teacher explains');
    assert.match(out.guidedPractice, /التوسّع/, 'guided practice is the Elaborate stage');
    assert.match(out.independentPractice, /التقويم/, 'independent practice is the Evaluate stage');
    assert.match(out.assessment, /التقويم/);
  });

  it('en: the five stages are named, in order, across the fields that carry them', async () => {
    const out = await plan(EN, '5e');
    assert.match(out.introduction, /^Engage/, 'the opening hook is the Engage stage and says so');
    const explore = at(out.mainActivity, 'Explore');
    const explain = at(out.mainActivity, 'Explain');
    assert.ok(explore >= 0 && explain >= 0, 'main activity names Explore and Explain');
    assert.ok(explore < explain, 'students explore BEFORE the teacher explains');
    assert.match(out.guidedPractice, /Elaborate/);
    assert.match(out.independentPractice, /Evaluate/);
    assert.match(out.assessment, /Evaluate/);
  });

  it('the formal term is named only after the exploring, never in the opening', async () => {
    // KB lesson with a known key term: «قانون الجيوب» has one; the opening must not state it as a rule.
    const out = await plan(AR, '5e');
    const explain = out.mainActivity.indexOf('التفسير');
    const before = out.mainActivity.slice(0, explain);
    assert.ok(!/سأسمّي الفكرة/.test(before), 'the idea is named before the Explain stage');
    assert.match(out.mainActivity.slice(explain), /سأسمّي الفكرة/);
  });

  it('does not ban peer discussion, and keeps an individual Evaluate stage', async () => {
    const ar = JSON.stringify(await plan(AR, '5e'));
    assert.ok(!/المناقشة بين الطلبة مؤجّلة/.test(ar));
    const out = await plan(AR, '5e');
    assert.match(out.independentPractice, /يعمل كل طالب بمفرده/);
  });

  it('is not the inquiry plan with a new label', async () => {
    const five = await plan(AR, '5e');
    const inquiry = await plan(AR, 'inquiry');
    // Inquiry settles on a wording with the class and withholds the rule; 5E has a teacher-led Explain stage.
    assert.ok(!/تخمين/.test(five.mainActivity), '5E should not be the conjecture routine');
    assert.match(inquiry.mainActivity, /تخمين/);
    assert.match(five.mainActivity, /سأسمّي الفكرة/);
  });

  it('a document-grounded 5E plan keeps the stage labels, including Engage', async () => {
    const out = await plan(AR, '5e', DOC_BLOCK);
    assert.match(out.introduction, /^التشويق/);
    assert.match(out.mainActivity, /الاستكشاف/);
    assert.match(out.mainActivity, /الرابطة/, 'the file’s own concepts reach the plan');
  });

  it('the other styles do not get an Engage label', async () => {
    for (const style of ['direct', 'inquiry', 'collaborative']) {
      assert.ok(!/^التشويق/.test((await plan(AR, style)).introduction), style);
    }
  });
});

describe('an attached document does not make the style picker inert', () => {
  it('the document path honours the style', async () => {
    const out: Record<string, LessonPlanOutput> = {};
    for (const style of LESSON_STYLE_IDS) out[style] = await plan(AR, style, DOC_BLOCK);
    for (const field of STYLE_FIELDS) {
      const values = LESSON_STYLE_IDS.map(s => JSON.stringify((out[s] as any)[field]));
      assert.equal(
        new Set(values).size, LESSON_STYLE_IDS.length,
        `document path: "${field}" is shared between styles`,
      );
    }
  });

  it('it really is the document path, and it still uses the file', async () => {
    // If the block did not parse, this would be the ordinary path and the test
    // above would prove nothing about documents.
    const out = await plan(AR, 'collaborative', DOC_BLOCK);
    assert.match(JSON.stringify(out.materials), /bonding\.pdf|المواد المرفوعة|الملف/, 'document path not taken');
    assert.match(out.mainActivity, /الرابطة/, 'the file’s own concepts did not reach the plan');
  });

  it('collaborative with a document is not the direct plan', async () => {
    const collab = await plan(AR, 'collaborative', DOC_BLOCK);
    const direct = await plan(AR, 'direct', DOC_BLOCK);
    assert.notEqual(collab.mainActivity, direct.mainActivity);
    assert.notEqual(collab.independentPractice, direct.independentPractice);
  });
});
