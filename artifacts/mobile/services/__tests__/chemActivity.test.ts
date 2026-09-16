/**
 * Chemistry reaches the activity slides — and stops where it should.
 *
 * Three separate failures are pinned here, because they fail in different
 * directions:
 *
 *  1. A chemistry activity used to get concept-shaped filler («عرّف الموضوع
 *     بكلماتك») where a maths one got real items. That is the gap being closed.
 *  2. A chemistry activity must NOT get the geometry instruction. The
 *     hands-on format tells students to draw the figure to scale and measure
 *     it with a protractor, which is nonsense for a molar-mass problem — so
 *     `ctx.math` still guards that one branch, and chemistry takes the
 *     build-a-model path instead, which is the right one for bonding anyway.
 *  3. A chemistry Quick Check must never be labelled «تم التحقق من الإجابة
 *     رياضيًا». Chemistry stems carry «=» («q = m·c·ΔT», «Z = 11»), enough for
 *     `classifyVerifiableTopic` to hand one to SymPy as an equation. The
 *     badge is a claim the product makes carefully; a false one is worse than
 *     no bank at all.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService } from '../ai/generators.ts';
import { classifyVerifiableTopic } from '../ai/verifyMathGuards.ts';
import { CHEM_BANK } from '@workspace/math-practice';
import type { AIRequest, ClassroomActivityRequest } from '../ai/AIService.ts';

const service = new MockAIService();

const CHEM = {
  grade: '10',
  subject: 'Chemistry',
  language: 'arabic',
  difficulty: 'standard',
  duration: 20,
  groupType: 'groups',
  teachingGoal: 'practice',
};

const stepText = (a: { steps: Array<{ description: string }> }) =>
  a.steps.map(s => s.description).join('\n');

describe('a chemistry activity is built from chemistry', () => {
  it('puts a real worked item in the individual format', async () => {
    const act = await service.generateActivity({
      ...CHEM,
      topic: 'المول والكتلة المولية',
      activityType: 'individual',
    } as AIRequest);

    const body = stepText(act);
    // The bank's stems carry a formula or a quantity; the concept fallback is
    // prose with the topic substituted in.
    assert.match(
      body,
      /[A-Za-z₀-₉]|\d\s*(g\/mol|mol|g)/u,
      `no concrete item reached the steps:\n${body}`,
    );
    assert.ok(
      !body.includes('يدرسه الطالب صامتًا ويضع خطًا تحت الجملة'),
      'fell back to the concept branch despite chemistry having a bank',
    );
  });

  it('splits the jigsaw by problem rather than by topic word', async () => {
    const act = await service.generateActivity({
      ...CHEM,
      topic: 'التفاعلات الكيميائية',
      activityType: 'group',
    } as AIRequest);

    const body = stepText(act);
    assert.ok(
      !body.includes(`عرّف التفاعلات الكيميائية بكلماتك`),
      `jigsaw used the no-content fallback:\n${body}`,
    );
  });

  it('does NOT hand chemistry the geometry instruction', async () => {
    const act = await service.generateActivity({
      ...CHEM,
      topic: 'الروابط الكيميائية وأنواعها',
      activityType: 'hands-on',
    } as AIRequest);

    const body = stepText(act);
    // `manipulativeTask`'s maths branch. Asking a student to draw a bonding
    // question "to scale" and measure it with a protractor is the failure.
    assert.ok(
      !body.includes('بمقياس رسم 1 سم : 1 وحدة'),
      `chemistry was given the scale-drawing task:\n${body}`,
    );
    assert.ok(
      !body.includes('بالمسطرة/المنقلة'),
      `chemistry was told to measure with a protractor:\n${body}`,
    );
    // It should get the model-building branch — which is what a chemistry
    // teacher would actually do for bonding.
    assert.match(body, /ابنِ نموذجًا ملموسًا/u, `expected the build-a-model task:\n${body}`);
  });

  it('still gives maths the geometry instruction', async () => {
    const act = await service.generateActivity({
      ...CHEM,
      subject: 'Mathematics',
      topic: 'الدائرة ومعادلتها',
      activityType: 'hands-on',
    } as AIRequest);

    const body = stepText(act);
    assert.ok(
      body.includes('بمقياس رسم 1 سم : 1 وحدة'),
      `the maths hands-on branch was lost:\n${body}`,
    );
  });
});

describe('a chemistry Quick Check is labelled honestly', () => {
  /**
   * The hazard, measured rather than assumed.
   *
   * `verifyIfPossible` only calls SymPy when `classifyVerifiableTopic`
   * accepts the stem — and it accepts chemistry stems, because «(Z = 12)»
   * parses as a linear equation. Those are the items that would be handed to
   * a maths verifier and could come back labelled «تم التحقق من الإجابة
   * رياضيًا», which the product means literally.
   *
   * This is asserted here rather than end to end because an end-to-end test
   * CANNOT see it: the verifier service is unreachable under test, so
   * `verifyIfPossible` catches and returns the bank label either way, and the
   * slide looks identical with the guard removed. (Checked — that is not a
   * guess.) So the guard in `generateClassroomActivity` is defence in depth,
   * and this is what records why it is there.
   *
   * If this ever fails because no chemistry stem classifies any more, the
   * guard has become unnecessary — decide that deliberately rather than
   * discovering it when a stem with an «=» is added back.
   */
  it('chemistry stems do reach the maths verifier gate, which is why the guard exists', () => {
    const classified = CHEM_BANK.filter(i => classifyVerifiableTopic(i.promptAr ?? i.eq));
    assert.ok(
      classified.length > 0,
      'no chemistry stem would be misrouted — the quick-check guard may now be dead code',
    );
    // All of them are the «(Z = n)» electron-configuration stems today.
    for (const item of classified) {
      assert.match(
        item.promptAr ?? item.eq,
        /=/u,
        `classified for a reason other than an «=»: ${item.id}`,
      );
    }
  });

  it('labels a chemistry quick check as a bank item, not a proof', async () => {
    const act = await service.generateClassroomActivity({
      ...CHEM,
      topic: 'التوزيع الإلكتروني للذرات',
      activityType: 'quick-check',
      numQuestions: 4,
    } as ClassroomActivityRequest);

    const questionSlides = act.slides.filter(s => s.type === 'question');
    assert.ok(questionSlides.length > 0, 'no question slides were produced');
    for (const slide of questionSlides) {
      const blob = JSON.stringify(slide);
      assert.ok(!blob.includes('symbolic'), `marked symbolically verified:
${blob}`);
    }
  });

  it('produces question slides at all, which it did not before', async () => {
    const act = await service.generateClassroomActivity({
      ...CHEM,
      topic: 'التفاعلات الكيميائية',
      activityType: 'quick-check',
      numQuestions: 4,
    } as ClassroomActivityRequest);

    const questionSlides = act.slides.filter(s => s.type === 'question');
    assert.ok(
      questionSlides.length >= 2,
      `chemistry Quick Check fell back to the no-bank path: ${questionSlides.length} question slides`,
    );
  });
});

describe('a subject with no bank is unchanged', () => {
  it('leaves biology on the concept steps', async () => {
    const act = await service.generateActivity({
      ...CHEM,
      subject: 'Biology',
      topic: 'الخلية ووظائفها',
      activityType: 'individual',
    } as AIRequest);

    const body = stepText(act);
    assert.ok(
      !/الكتلة المولية|وازن المعادلة|التوزيع الإلكتروني/.test(body),
      `a chemistry item reached a biology activity:\n${body}`,
    );
  });
});
