/**
 * The offline «نشاط صفي» as a teacher met it on 2026-11-20, when the live call
 * failed and the discussion blueprint stood in (Grade 6 social studies,
 * «حُرِّيَّةُ التَّعْبيرِ», 30 minutes, a ready-made question typed as the
 * objective). Four things were wrong with it, and each test below names one:
 *
 *  1. The claim was quoted twice — ««يمكن تطبيق … دون استثناء.» — هل توافق؟».
 *  2. «فكّر بمفردك» said «دقيقتان» on a step the schedule gave 5 minutes.
 *  3. The teacher's own question never appeared; a generic claim replaced it.
 *  4. «احسم الادعاء بدقة، مع تسمية الشرط الذي كان مفقودًا فيه» — and a claim
 *     about applying a concept «دون استثناء» — is wording for Grade 10, not 6.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildOfflineActivity } from '@/services/ai/generators.ts';
import { activityGradeNumber, teacherQuestion } from '@/services/ai/activityBlueprints.ts';
import type { ActivityOutput, AIRequest } from '@/services/ai/AIService.ts';

const TYPES = ['individual', 'group', 'discussion', 'hands-on', 'game'] as const;

const G6_SOCIAL = {
  topic: 'حُرِّيَّةُ التَّعْبيرِ',
  lessonId: 'kbl-g6-social-s1-nccd-u5_l1',
  subject: 'الدراسات الاجتماعية',
  grade: 'الصف السادس',
  language: 'arabic' as const,
};
const TEACHER_OBJECTIVE = 'يعبّر الطالب عن رأيه بحرية واحترام: لو كنت وزير التربية ليوم واحد، شو أول إشي بتغيّره ولماذا؟';
const TEACHER_QUESTION = 'لو كنت وزير التربية ليوم واحد، شو أول إشي بتغيّره ولماذا؟';

const CASES = [
  { label: 'g6 social / ar', ...G6_SOCIAL },
  { label: 'g10 math / ar', topic: 'قانون الجيوب', subject: 'الرياضيات', grade: 'الصف العاشر', language: 'arabic' as const },
  { label: 'g10 chem / ar', topic: 'الروابط الأيونية', subject: 'الكيمياء', grade: 'الصف العاشر', language: 'arabic' as const },
  { label: 'g10 math / en', topic: 'Law of Sines', subject: 'Mathematics', grade: 'Grade 10', language: 'english' as const },
];

function make(req: Partial<AIRequest>, variant = 0): ActivityOutput {
  return buildOfflineActivity({ duration: 30, ...req } as AIRequest, variant);
}

/** Every step's text, title included. */
const stepText = (a: ActivityOutput) => a.steps.map(s => `${s.title}\n${s.description}`).join('\n');
const allText = (a: ActivityOutput) => JSON.stringify(a);

/**
 * The minute counts a sentence states, in either language: «دقيقة واحدة»,
 * «دقيقتان», «N دقائق», «N دقيقة», "one minute", "N minutes".
 */
function statedMinutes(text: string): number[] {
  const out: number[] = [];
  const re = /(\d+)\s*(?:دقائق|دقيقة)|(دقيقة واحدة)|(دقيقتان|دقيقتين)|(\d+)\s*minutes?|\b(one|two) minutes?\b/gi;
  for (const m of text.matchAll(re)) {
    if (m[1]) out.push(Number(m[1]));
    else if (m[2]) out.push(1);
    else if (m[3]) out.push(2);
    else if (m[4]) out.push(Number(m[4]));
    else if (m[5]) out.push(m[5].toLowerCase() === 'one' ? 1 : 2);
  }
  return out;
}

describe('activity text is quoted once', () => {
  for (const c of CASES) {
    for (const type of TYPES) {
      it(`${c.label} / ${type}: no doubled quotation marks, in any version`, () => {
        for (const variant of [0, 1, 2]) {
          const text = allText(make({ ...c, activityType: type }, variant));
          assert.doesNotMatch(text, /««|»»/, `doubled guillemets in ${type} v${variant}`);
          assert.doesNotMatch(text, /““|””/, `doubled curly quotes in ${type} v${variant}`);
        }
      });
    }
  }
});

describe('a step says the minutes it is given', () => {
  for (const language of ['arabic', 'english'] as const) {
    const base = language === 'arabic' ? CASES[0] : CASES[3];
    for (const duration of [20, 30, 45, 60]) {
      it(`${language} / ${duration} min: discussion «think alone» states its own length`, () => {
        const a = make({ ...base, activityType: 'discussion', duration });
        const think = a.steps[1]!;
        const said = statedMinutes(think.description);
        assert.ok(said.length >= 1, `no length stated: ${think.description}`);
        assert.equal(said[0], think.durationMin, think.description);
      });

      it(`${language} / ${duration} min: discussion pairs + class add up to the step`, () => {
        const a = make({ ...base, activityType: 'discussion', duration });
        const discuss = a.steps[2]!;
        const said = statedMinutes(discuss.description);
        assert.equal(said.length, 2, `expected a pairs and a class length: ${discuss.description}`);
        assert.equal(said[0]! + said[1]!, discuss.durationMin, discuss.description);
      });

      it(`${language} / ${duration} min: the game keeps its review minutes in the tip`, () => {
        const a = make({ ...base, activityType: 'game', duration });
        const review = a.steps[3]!.durationMin;
        const tip = a.teacherTips.find(t => /مراجعة|review/i.test(t) && statedMinutes(t).length);
        assert.ok(tip, 'the review tip states a length');
        assert.deepEqual(statedMinutes(tip!), [review], tip);
      });

      it(`${language} / ${duration} min: four jigsaw turns fit inside the regroup step`, () => {
        const a = make({ ...base, activityType: 'group', duration });
        const regroup = a.steps[2]!;
        const secs = [...regroup.description.matchAll(/(\d+)\s*(?:ثانية|seconds)/g)].map(m => Number(m[1]));
        assert.equal(secs.length, 1, regroup.description);
        assert.ok(4 * secs[0]! <= regroup.durationMin * 60, `${4 * secs[0]!}s of turns in ${regroup.durationMin} min`);
      });
    }
  }
});

describe("the teacher's objective reaches the offline activity", () => {
  it('a question typed as the objective is what the discussion is about', () => {
    const a = make({ ...G6_SOCIAL, activityType: 'discussion', objectives: TEACHER_OBJECTIVE });
    assert.ok(a.steps[0]!.description.includes(TEACHER_QUESTION), a.steps[0]!.description);
    // An open question is answered, not voted on: no agree/disagree cards, no
    // generic claim on the board next to it.
    assert.doesNotMatch(stepText(a), /دون استثناء|هل توافق/);
    assert.doesNotMatch(a.materials.join('\n'), /«أوافق» \/ «لا أوافق»/);
  });

  it('an English question objective leads the discussion too', () => {
    const q = 'If you could change one school rule, which would it be and why?';
    // A social-studies lesson: a maths lesson's question is answered, not discussed.
    const a = make({ ...G6_SOCIAL, language: 'english', activityType: 'discussion', objectives: `Students give a reasoned opinion: ${q}` });
    assert.ok(a.steps[0]!.description.includes(q), a.steps[0]!.description);
    assert.doesNotMatch(stepText(a), /Do you agree\?/);
  });

  it('an objective with no question keeps the claim and the vote', () => {
    const a = make({ ...G6_SOCIAL, activityType: 'discussion', objectives: 'أن يعبّر الطالب عن رأيه باحترام' });
    assert.match(stepText(a), /هل توافق|تصويت/);
  });

  for (const type of TYPES) {
    it(`${type}: the typed objective is the activity's objective`, () => {
      const a = make({ ...G6_SOCIAL, activityType: type, objectives: TEACHER_OBJECTIVE });
      assert.equal(a.objective, TEACHER_OBJECTIVE);
    });
  }
});

describe('teacherQuestion', () => {
  it('takes the question after the lead-in', () => {
    assert.equal(teacherQuestion(TEACHER_OBJECTIVE), TEACHER_QUESTION);
  });
  it('keeps a two-part question whole', () => {
    assert.equal(teacherQuestion('ما رأيك في الواجبات؟ ولماذا؟'), 'ما رأيك في الواجبات؟ ولماذا؟');
  });
  it('drops quotation marks around the question', () => {
    assert.equal(teacherQuestion('ناقش: «هل الواجب ضروري برأيك؟»'), 'هل الواجب ضروري برأيك؟');
  });
  it('is null for an objective with no question', () => {
    assert.equal(teacherQuestion('أن يعبّر الطالب عن رأيه باحترام'), null);
    assert.equal(teacherQuestion(undefined), null);
  });
  // Found in review: a «.» or «:» inside a number is not a sentence break.
  it('does not cut inside a number', () => {
    assert.equal(teacherQuestion('أن يقدّر الطالب: لو كان طولك 1.5 متر، كيف ستتغيّر حياتك؟'), 'لو كان طولك 1.5 متر، كيف ستتغيّر حياتك؟');
    assert.equal(teacherQuestion('لو قسّمنا الصف بنسبة 3:4، أي قسم تفضّل أن تكون فيه؟'), 'لو قسّمنا الصف بنسبة 3:4، أي قسم تفضّل أن تكون فيه؟');
  });
  it('breaks on «؛» and a dash', () => {
    assert.equal(teacherQuestion('يعبّر الطالب عن رأيه؛ ما رأيك في الواجبات المدرسية؟'), 'ما رأيك في الواجبات المدرسية؟');
    assert.equal(teacherQuestion('نقاش حول الواجبات — برأيك هل الواجب ضروري؟'), 'برأيك هل الواجب ضروري؟');
  });
  it('strips only a balanced pair of quotation marks', () => {
    assert.equal(teacherQuestion('ناقش: «هل الواجب ضروري برأيك؟» ولماذا؟'), 'هل الواجب ضروري برأيك؟ ولماذا؟');
    assert.equal(teacherQuestion('ناقش: «برأيك، هل الواجب ضروري؟'), 'برأيك، هل الواجب ضروري؟');
  });
  // A question with one answer is not an open discussion question: the
  // question format would tell the teacher it has no right answer.
  it('is null for a question with one answer', () => {
    assert.equal(teacherQuestion('أن يحل الطالب: ما قيمة س إذا كان 2س + 3 = 7؟'), null);
    assert.equal(teacherQuestion('أن يجيب الطالب عن: ما هي الخلية؟'), null);
    assert.equal(teacherQuestion('Students answer: what is a cell?'), null);
  });
});

describe('a factual question objective keeps the claim discussion', () => {
  it('maths: the question is not posted as an open discussion', () => {
    const a = make({ ...CASES[1], activityType: 'discussion', objectives: 'أن يحل الطالب: لو كان 2س + 3 = 7، فما قيمة س؟' });
    assert.doesNotMatch(stepText(a), /اكتب سؤال النقاش/);
  });
});

describe('the question discussion is still its own format', () => {
  it('differs from every other type on every field but the objective', () => {
    const out = Object.fromEntries(TYPES.map(t => [t, make({ ...G6_SOCIAL, activityType: t, objectives: TEACHER_OBJECTIVE })]));
    for (const field of ['groupSize', 'materials', 'steps', 'teacherTips', 'differentiation', 'assessment'] as const) {
      const values = TYPES.map(t => JSON.stringify((out[t] as any)[field]));
      assert.equal(new Set(values).size, TYPES.length, `"${field}" is shared between activity types`);
    }
    assert.doesNotMatch(out.discussion!.groupSize, /مجموعات/);
  });
});

describe('activityGradeNumber', () => {
  it('reads the book first, then the name', () => {
    assert.equal(activityGradeNumber('grade-6', 'الصف العاشر'), 6);
    assert.equal(activityGradeNumber(null, 'الصف السادس'), 6);
    assert.equal(activityGradeNumber(null, 'الصف الأول'), 1);
    assert.equal(activityGradeNumber(undefined, 'Grade 4'), 4);
    assert.equal(activityGradeNumber(null, ''), null);
  });
  // Found in review: «الصف الثاني عشر» matched «الثاني» and read as Grade 2.
  it('does not read Grades 11 and 12 as 1 and 2', () => {
    assert.equal(activityGradeNumber(null, 'الصف الثاني عشر'), 12);
    assert.equal(activityGradeNumber(null, 'الصف الحادي عشر'), 11);
  });
});

describe('a Grade 6 discussion is worded for Grade 6', () => {
  it('neither the claim nor the close is abstract', () => {
    for (const variant of [0, 1, 2]) {
      const text = stepText(make({ ...G6_SOCIAL, activityType: 'discussion' }, variant));
      assert.doesNotMatch(text, /دون استثناء/, `v${variant}`);
      assert.doesNotMatch(text, /الشرط الذي كان مفقودًا/, `v${variant}`);
    }
  });

  it('Grade 10 keeps its own wording', () => {
    const text = stepText(make({ ...CASES[2], activityType: 'discussion' }));
    assert.match(text, /الشرط الذي كان مفقودًا/);
  });
});
