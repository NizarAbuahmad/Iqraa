/**
 * The build-time gate on ready-made sheets (`premadeSheetGate.ts`): a question
 * a child cannot answer from the page never reaches the library.
 *
 * The cases are the real items found in a full 450-sheet draw of Grades 1–9
 * maths on 2026-11-20, and real neighbours that must pass: most «أيّ»
 * questions carry their choices in the stem, and flagging those would refuse
 * good sheets.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { unanswerableQuestions } from '../premadeSheetGate.ts';
import type { WorksheetOutput } from '../ai/AIService.ts';

type Q = { text: string; answer: string; options?: string[] };

/** Two sections, so the key's numbering has to run across them. */
const sheet = (...questions: Q[]): WorksheetOutput => {
  const half = Math.ceil(questions.length / 2);
  const toSection = (qs: Q[]) => ({ type: 'mixed', title: '', questions: qs.map(({ text, options }) => ({ text, options, points: 1 })) });
  return {
    title: 'ورقة عمل',
    instructions: '',
    sections: [toSection(questions.slice(0, half)), toSection(questions.slice(half))],
    answerKey: questions.map((q, i) => ({ num: i + 1, answer: q.answer })),
  } as unknown as WorksheetOutput;
};

describe('unanswerableQuestions', () => {
  it('flags a «best unit» question with no choices on the page: several answers are right, one is keyed', () => {
    const found = unanswerableQuestions(sheet({ text: 'أيّ وحدة أنسب لقياس طول الكتاب؟', answer: 'مشبك الورق' }));
    assert.deepEqual(found, ['أيّ وحدة أنسب لقياس طول الكتاب؟']);
  });

  it('flags a question that points at choices it does not show', () => {
    assert.equal(unanswerableQuestions(sheet({ text: 'أيّ الأسئلة الآتية سؤال إحصائي؟', answer: 'ما أطول طالب؟' })).length, 1);
    assert.equal(unanswerableQuestions(sheet({ text: 'أي هذه الأشياء يشبه الكرة؟', answer: 'حبة الكرز' })).length, 1);
    assert.equal(
      unanswerableQuestions(sheet({ text: 'جُمعت بيانات أزمنة الجري لدى 91 طالبًا. ما التمثيل الأنسب لهذه البيانات؟', answer: 'المدرج التكراري' })).length,
      1,
    );
  });

  it('finds the flagged question in the second section, by the key numbering', () => {
    const found = unanswerableQuestions(
      sheet(
        { text: 'ما العدد الذي يأتي بعد 4؟', answer: '5' },
        { text: 'أيّ وحدة أنسب لقياس كتلة قلم؟', answer: 'المشبك' },
      ),
    );
    assert.deepEqual(found, ['أيّ وحدة أنسب لقياس كتلة قلم؟']);
  });

  it('passes the same questions once their options are attached', () => {
    const found = unanswerableQuestions(
      sheet(
        { text: 'أيّ وحدة أنسب لقياس كتلة قلم؟', answer: 'المشبك', options: ['البطيخة', 'الحقيبة', 'الكرسي', 'المشبك'] },
        { text: 'أي هذه الأشياء يشبه الكرة؟', answer: 'حبة الكرز', options: ['حبة الكرز', 'علبة', 'كتاب', 'قلم'] },
      ),
    );
    assert.deepEqual(found, []);
  });

  it('passes a question that lists its choices in the stem, the usual shape', () => {
    const found = unanswerableQuestions(
      sheet(
        { text: 'أي الأعداد الآتية فردي: 88، 26، 81، 54؟', answer: '81' },
        { text: 'أيّ وحدة أنسب لقياس طول الكتاب: الخطوة، مشبك الورق، الحبل، الباب؟', answer: 'مشبك الورق' },
        {
          text: 'الرواتب الشهرية بالدينار: 320، 400، 2600. أي مقاييس النزعة المركزية أنسب لوصف هذه الرواتب: الوسط الحسابي، أم الوسيط، أم المنوال؟',
          answer: 'الوسيط',
        },
      ),
    );
    assert.deepEqual(found, []);
  });

  it('ignores harakat and guillemets when looking for the answer on the page', () => {
    const found = unanswerableQuestions(
      sheet({ text: 'أيّ هذه الكلمات اسم شكل: «مُثَلَّث»، قلم، باب؟', answer: 'مثلث' }),
    );
    assert.deepEqual(found, []);
  });

  it('passes a worked question that only mentions «الآتي», «هذه» or «التالي»', () => {
    // All refused by an earlier, broader rule in the 2026-11-20 build.
    const found = unanswerableQuestions(
      sheet(
        { text: 'ما العدد التالي للعدد 49؟', answer: '50' },
        { text: 'عند سامي هذه الأشكال: مثلث أحمر، مربع أحمر، مثلث أحمر. كم مربعًا أحمر عنده؟', answer: '1' },
        { text: 'رتّب الأعداد الآتية تنازليًّا: 583، 598، 147', answer: '598، 583، 147' },
        { text: 'ما الشكل التالي في النمط: △ ◇ △ ◇ △ ___ ؟', answer: '◇' },
        { text: 'اكتب العدد الآتي بالصيغة القياسية: 7 + 0.4', answer: '7.4' },
        { text: 'وُضعت هذه الأشياء معًا في مجموعة واحدة: ممحاة، مسطرة، قلم. على أيّ أساس صُنّفت؟', answer: 'الأدوات المدرسية' },
        { text: 'أي عدد نضيفه إلى 243 لنحصل على 283؟', answer: '40' },
      ),
    );
    assert.deepEqual(found, []);
  });

  it('passes an open «which» question whose answer is worked out, not picked', () => {
    const found = unanswerableQuestions(
      sheet(
        { text: 'بين أي عشرتين يقع العدد 37؟', answer: '30 و 40' },
        { text: 'ابدأ من العدد 9 وعُدّ تنازليًا 3 أعداد. عند أي عدد تتوقف؟', answer: '6' },
        { text: 'يبين التمثيل بالساق والورقة الآتي علامات الطلاب:\n1 | 3 4\n2 | 1 1\nكم طالبًا في المجموعة؟', answer: '4' },
      ),
    );
    assert.deepEqual(found, []);
  });
});
