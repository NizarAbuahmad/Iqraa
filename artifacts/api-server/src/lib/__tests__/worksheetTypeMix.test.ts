import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { worksheetPromptAr, worksheetPromptEn } from '../prompts.ts';
import { worksheetTypeQuota, worksheetSectionTotal } from '../worksheetTypes.ts';
import { stampWorksheetTypes, worksheetMissingTypes } from '../generationShape.ts';

const FIVE = ['multiple_choice', 'short_answer', 'fill_blank', 'true_false', 'word_problem'];
const mathBody = (over: Record<string, unknown> = {}) =>
  ({ topic: 'المعادلات', subject: 'Mathematics', grade: '10', numQuestions: 20, questionTypes: FIVE, ...over }) as any;

const mc = (text: string) => ({ text, options: ['أ', 'ب', 'ج', 'د'], points: 1 });
const sa = (text: string) => ({ text, points: 1 });
const fb = (text: string) => ({ text: `${text} __________`, points: 1 });
const tf = (text: string) => ({ text, options: ['صح', 'خطأ'], points: 1 });

describe('worksheet type quota', () => {
  it('splits the total evenly, earlier types taking the remainder', () => {
    assert.deepEqual(worksheetTypeQuota(FIVE, 19), [
      ['multiple_choice', 4], ['short_answer', 4], ['fill_blank', 4], ['true_false', 4], ['word_problem', 3],
    ]);
  });

  it('never lists a type with no room, and always sums to the total', () => {
    const q = worksheetTypeQuota(FIVE, 3);
    assert.deepEqual(q.map(([t]) => t), ['multiple_choice', 'short_answer', 'fill_blank']);
    assert.equal(q.reduce((n, [, k]) => n + k, 0), 3);
  });

  it('counts the worked example inside the total, homework and non-calc subjects not', () => {
    assert.equal(worksheetSectionTotal(mathBody()), 19);
    assert.equal(worksheetSectionTotal(mathBody({ homework: true })), 20);
    assert.equal(worksheetSectionTotal(mathBody({ subject: 'English', subjectId: 'english' })), 20);
  });
});

describe('worksheet prompt asks for a mix, not one type per section', () => {
  for (const [name, build] of [['ar', worksheetPromptAr], ['en', worksheetPromptEn]] as const) {
    it(`${name}: states each type's count and lets a section be mixed`, () => {
      const p = build(mathBody());
      for (const t of FIVE) assert.match(p, new RegExp(`${t}\\s*[:：=×x]\\s*\\d+`), `${t} has no count`);
      assert.match(p, /mixed/, 'a section may not be mixed');
      assert.doesNotMatch(p, /"type": "short_answer",\s*\n\s*"title"/, 'the sample section still models one type');
    });

    it(`${name}: every question carries its own type`, () => {
      const p = build(mathBody());
      assert.match(p, /\{ "type": "multiple_choice", "text"/);
    });

    it(`${name}: a single ticked type gets no quota table`, () => {
      const p = build(mathBody({ questionTypes: ['multiple_choice'] }));
      assert.doesNotMatch(p, /multiple_choice\s*[:：=×x]\s*\d+/);
    });
  }
});

describe('worksheetMissingTypes', () => {
  const sheet = (sections: unknown[]) => ({ sections });

  it('is the exact complaint: five ticked, three sections of nothing but multiple choice', () => {
    const parsed = sheet([
      { type: 'multiple_choice', title: 'سهلة', questions: [mc('1'), mc('2'), mc('3')] },
      { type: 'multiple_choice', title: 'متوسطة', questions: [mc('4'), mc('5'), mc('6')] },
      { type: 'multiple_choice', title: 'صعبة', questions: [mc('7'), mc('8'), mc('9')] },
    ]);
    assert.deepEqual(
      worksheetMissingTypes(parsed, mathBody({ numQuestions: 10 })),
      ['short_answer', 'fill_blank', 'true_false', 'word_problem'],
    );
  });

  it('is empty when every ticked type appears, however the model labelled it', () => {
    const parsed = sheet([
      { type: 'mixed', title: 'سهلة', questions: [mc('1'), { ...sa('2'), type: 'short_answer' }, fb('3')] },
      { type: 'mixed', title: 'متوسطة', questions: [tf('4'), { ...sa('5'), type: 'مسألة حياتية' }] },
    ]);
    assert.deepEqual(worksheetMissingTypes(parsed, mathBody({ numQuestions: 6 })), []);
  });

  it('only asks about types the total has room for', () => {
    const parsed = sheet([{ type: 'multiple_choice', title: 's', questions: [mc('1')] }]);
    assert.deepEqual(worksheetMissingTypes(parsed, mathBody({ numQuestions: 2, homework: true })), ['short_answer']);
  });

  it('asks nothing when the teacher ticked one type or sent none', () => {
    const parsed = sheet([{ type: 'multiple_choice', title: 's', questions: [mc('1')] }]);
    assert.deepEqual(worksheetMissingTypes(parsed, mathBody({ questionTypes: ['multiple_choice'] })), []);
    assert.deepEqual(worksheetMissingTypes(parsed, mathBody({ questionTypes: undefined })), []);
  });

  it('reads an unlabelled question with no options and no blank as short answer', () => {
    const parsed = sheet([{ type: 'multiple_choice', title: 's', questions: [{ text: 'اشرح', points: 1 }] }]);
    assert.deepEqual(
      worksheetMissingTypes(parsed, mathBody({ numQuestions: 5, questionTypes: ['multiple_choice', 'short_answer'] })),
      ['multiple_choice'],
    );
  });
});

describe('stampWorksheetTypes', () => {
  it('labels each question and calls a section holding more than one type mixed', () => {
    const parsed: any = {
      sections: [
        { type: 'multiple_choice', title: 'a', questions: [mc('1'), tf('2'), fb('3')] },
        { type: 'short_answer', title: 'b', questions: [mc('4'), mc('5')] },
      ],
    };
    stampWorksheetTypes(parsed);
    assert.deepEqual(parsed.sections[0].questions.map((q: any) => q.type), ['multiple_choice', 'true_false', 'fill_blank']);
    assert.equal(parsed.sections[0].type, 'mixed');
    assert.equal(parsed.sections[1].type, 'multiple_choice');
  });
});
