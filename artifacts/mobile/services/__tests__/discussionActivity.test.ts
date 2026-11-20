/**
 * The offline discussion activity, as a teacher actually received it.
 *
 * On 2026-11-20 a live call failed and a Grade 6 teacher got this blueprint
 * for «حرية التعبير» with the objective «يعبّر الطالب عن رأيه بحرية واحترام:
 * لو كنت وزير التربية ليوم واحد، شو أول إشي بتغيّره ولماذا؟». Three things
 * were wrong on her screen:
 *   - the board text read ««يمكن تطبيق …» — هل توافق؟» (the claim carries its
 *     own guillemets and the step wrapped it again);
 *   - «فكّر بمفردك» said «دقيقتان» while the step was given 5 minutes;
 *   - her question appeared nowhere: the steps argued a generic claim instead.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '@/services/ai/generators.ts';
import { arMinutes } from '@/services/ai/lessonPlanTypes.ts';
import type { AIRequest } from '@/services/ai/AIService.ts';

const QUESTION_AR = 'لو كنت وزير التربية ليوم واحد، شو أول إشي بتغيّره ولماذا؟';
const QUESTION_EN = 'If you were Minister of Education for one day, what is the first thing you would change, and why?';

function discussion(over: Partial<AIRequest>) {
  return aiService.generateActivity({
    grade: 'الصف السادس',
    subject: 'الدراسات الاجتماعية',
    topic: 'حرية التعبير',
    language: 'arabic',
    activityType: 'discussion',
    duration: 30,
    ...over,
  } as AIRequest);
}

const allText = (a: { steps: { title: string; description: string }[] }) =>
  a.steps.map(s => `${s.title}\n${s.description}`).join('\n');

describe('offline discussion activity', () => {
  for (const [label, over] of [
    ['ar', {}],
    ['en', { language: 'english', topic: 'Freedom of expression', subject: 'Social Studies', grade: 'Grade 6' }],
  ] as const) {
    it(`never doubles the quote marks around the claim (${label})`, async () => {
      const text = allText(await discussion(over as Partial<AIRequest>));
      assert.doesNotMatch(text, /««|»»|““|””/);
    });
  }

  for (const duration of [20, 30, 45]) {
    it(`says the silent-thinking step's own minutes (${duration} min, ar)`, async () => {
      const a = await discussion({ duration });
      const think = a.steps[1];
      assert.match(think.description, new RegExp(arMinutes(think.durationMin)));
      if (think.durationMin !== 2) assert.doesNotMatch(think.description, /دقيقتان/);
    });

    it(`says the silent-thinking step's own minutes (${duration} min, en)`, async () => {
      const a = await discussion({ duration, language: 'english', topic: 'Freedom of expression', subject: 'Social Studies' });
      const think = a.steps[1];
      const n = think.durationMin;
      assert.match(think.description, new RegExp(n === 1 ? 'One minute' : `${n} minutes`));
    });
  }

  it("builds the discussion around the teacher's question when the objective asks one (ar)", async () => {
    const a = await discussion({ objectives: `يعبّر الطالب عن رأيه بحرية واحترام: ${QUESTION_AR}` });
    const text = allText(a);
    assert.ok(a.steps[0].description.includes(QUESTION_AR), 'the question is what goes on the board');
    assert.doesNotMatch(text, /دون استثناء|هل توافق؟/, 'no invented claim replaces it');
    assert.doesNotMatch(a.materials.join('\n'), /«أوافق» \/ «لا أوافق»/, 'no agree/disagree cards for an open question');
  });

  it("builds the discussion around the teacher's question when the objective asks one (en)", async () => {
    const a = await discussion({
      language: 'english', topic: 'Freedom of expression', subject: 'Social Studies',
      objectives: `Students express their opinion freely and respectfully: ${QUESTION_EN}`,
    });
    assert.ok(a.steps[0].description.includes(QUESTION_EN));
    assert.doesNotMatch(allText(a), /without exception|Do you agree\?/);
  });

  it('keeps the contestable claim when the objective asks nothing', async () => {
    const a = await discussion({ objectives: 'يميّز الطالب بين الرأي والحقيقة' });
    assert.match(a.steps[0].description, /هل توافق؟/);
  });
});
