import test from 'node:test';
import assert from 'node:assert/strict';
import { summaryLine, previewRows, moreRowsLabel, lessonPlanSections, activitySections } from '../generatorSummary.ts';

/*
  The docked bar's one-line summary and the desktop paper preview's rows. Both
  are pure so they can be pinned here (the screens cannot be loaded under bare
  node). The Arabic count agreement is the part that goes wrong: a template
  that pastes a digit in front of a fixed noun is wrong for three of the four
  Arabic number classes (arCountPhrase says why).
*/

test('the Arabic summary is the line the design shows', () => {
  assert.equal(
    summaryLine({ questions: 10, minutes: 20, marks: 20, kinds: 4 }, 'ar'),
    '10 أسئلة · 20 دقيقة · 20 درجة · 4 أنواع',
  );
});

test('each Arabic count takes the noun form its number class needs', () => {
  assert.equal(summaryLine({ questions: 1 }, 'ar'), 'سؤال واحد');
  assert.equal(summaryLine({ questions: 2 }, 'ar'), 'سؤالان');
  assert.equal(summaryLine({ questions: 15 }, 'ar'), '15 سؤالًا');
  assert.equal(summaryLine({ minutes: 10 }, 'ar'), '10 دقائق');
  assert.equal(summaryLine({ minutes: 45 }, 'ar'), '45 دقيقة');
  assert.equal(summaryLine({ minutes: 2 }, 'ar'), 'دقيقتان');
  assert.equal(summaryLine({ marks: 10 }, 'ar'), '10 درجات');
  assert.equal(summaryLine({ marks: 100 }, 'ar'), '100 درجة');
  assert.equal(summaryLine({ kinds: 1 }, 'ar'), 'نوع واحد');
  assert.equal(summaryLine({ kinds: 2 }, 'ar'), 'نوعان');
  assert.equal(summaryLine({ kinds: 3 }, 'ar'), '3 أنواع');
});

test('the English summary agrees in number too', () => {
  assert.equal(
    summaryLine({ questions: 10, minutes: 20, marks: 20, kinds: 4 }, 'en'),
    '10 questions · 20 min · 20 marks · 4 types',
  );
  assert.equal(summaryLine({ questions: 1, marks: 1, kinds: 1 }, 'en'), '1 question · 1 mark · 1 type');
});

test('a part that is left out is left out of the line, in a fixed order', () => {
  assert.equal(summaryLine({ marks: 20, questions: 5 }, 'ar'), '5 أسئلة · 20 درجة');
  assert.equal(summaryLine({}, 'ar'), '');
});

test('Latin digits stay Latin: the line is composed from computed numbers, never converted here', () => {
  assert.doesNotMatch(summaryLine({ questions: 10, minutes: 20, marks: 20, kinds: 4 }, 'ar'), /[٠-٩]/);
});

test('preview rows cycle the types in order and number from 1', () => {
  const { rows, remainder } = previewRows(['a', 'b', 'c'], 5, 6);
  assert.deepEqual(rows, [
    { n: 1, type: 'a' }, { n: 2, type: 'b' }, { n: 3, type: 'c' }, { n: 4, type: 'a' }, { n: 5, type: 'b' },
  ]);
  assert.equal(remainder, 0);
});

test('preview rows stop at maxRows and report what is left', () => {
  const { rows, remainder } = previewRows(['a'], 20, 6);
  assert.equal(rows.length, 6);
  assert.equal(rows.at(-1)?.n, 6);
  assert.equal(remainder, 14);
});

test('preview rows survive no types and a nonsense count', () => {
  assert.deepEqual(previewRows([], 4, 6).rows.map(r => r.type), [null, null, null, null]);
  assert.deepEqual(previewRows(['a'], 0, 6), { rows: [], remainder: 0 });
  assert.deepEqual(previewRows(['a'], -3, 6), { rows: [], remainder: 0 });
  assert.deepEqual(previewRows(['a'], Number.NaN, 6), { rows: [], remainder: 0 });
});

test('the remainder line agrees with its number', () => {
  assert.equal(moreRowsLabel(0, 'ar'), '');
  assert.equal(moreRowsLabel(1, 'ar'), '+ سؤال آخر');
  assert.equal(moreRowsLabel(2, 'ar'), '+ سؤالان آخران');
  assert.equal(moreRowsLabel(4, 'ar'), '+ 4 أسئلة أخرى');
  assert.equal(moreRowsLabel(14, 'ar'), '+ 14 سؤالًا آخر');
  assert.equal(moreRowsLabel(4, 'en'), '+ 4 more');
  assert.equal(moreRowsLabel(0, 'en'), '');
});

test('a level word closes the line: the worksheet names a level where the quiz names minutes and marks', () => {
  assert.equal(summaryLine({ questions: 20, kinds: 3, level: 'مرتفع' }, 'ar'), '20 سؤالًا · 3 أنواع · مرتفع');
  assert.equal(summaryLine({ questions: 10, kinds: 2, level: 'Normal' }, 'en'), '10 questions · 2 types · Normal');
  // Last whatever else is named, and alone it is the whole line.
  assert.equal(summaryLine({ level: 'صعب', minutes: 20 }, 'ar'), '20 دقيقة · صعب');
  assert.equal(summaryLine({ level: 'صعب' }, 'ar'), 'صعب');
});

test('an empty or blank level adds nothing, and the quiz line is unchanged', () => {
  assert.equal(summaryLine({ questions: 10, level: '' }, 'ar'), '10 أسئلة');
  assert.equal(summaryLine({ questions: 10, level: '   ' }, 'ar'), '10 أسئلة');
  assert.equal(summaryLine({ questions: 10, minutes: 20, marks: 20, kinds: 4 }, 'ar'), '10 أسئلة · 20 دقيقة · 20 درجة · 4 أنواع');
});

test('a lesson plan names its duration, sections and style: «45 دقيقة · 10 أقسام · التعليم المباشر»', () => {
  assert.equal(summaryLine({ minutes: 45, sections: 10, level: 'التعليم المباشر' }, 'ar'), '45 دقيقة · 10 أقسام · التعليم المباشر');
  assert.equal(summaryLine({ minutes: 90, sections: 11, level: 'التعلم التعاوني' }, 'ar'), '90 دقيقة · 11 قسمًا · التعلم التعاوني');
  assert.equal(summaryLine({ minutes: 30, sections: 10, level: 'Direct instruction' }, 'en'), '30 min · 10 sections · Direct instruction');
});

test('each Arabic section count takes the noun form its number class needs', () => {
  assert.equal(summaryLine({ sections: 1 }, 'ar'), 'قسم واحد');
  assert.equal(summaryLine({ sections: 2 }, 'ar'), 'قسمان');
  assert.equal(summaryLine({ sections: 3 }, 'ar'), '3 أقسام');
  assert.equal(summaryLine({ sections: 10 }, 'ar'), '10 أقسام');
  assert.equal(summaryLine({ sections: 11 }, 'ar'), '11 قسمًا');
  assert.equal(summaryLine({ sections: 1 }, 'en'), '1 section');
});

test('the Arabic minutes of the four lesson durations agree', () => {
  for (const [m, want] of [[30, '30 دقيقة'], [45, '45 دقيقة'], [60, '60 دقيقة'], [90, '90 دقيقة']] as const) {
    assert.equal(summaryLine({ minutes: m }, 'ar'), want);
  }
});

test('the lesson plan sections come in teaching order, with the prior review only when asked', () => {
  const without = lessonPlanSections(false);
  const withReview = lessonPlanSections(true);
  assert.deepEqual(without, ['objectives', 'materials', 'introduction', 'mainActivity', 'guidedPractice', 'independentPractice', 'closure', 'assessment', 'differentiation', 'homework']);
  assert.equal(without.length, 10);
  assert.equal(withReview.length, 11);
  assert.equal(withReview[2], 'priorReview', 'the review sits between the materials and the introduction, as LessonPlanView prints it');
  // One row per section: nothing is cut, so no «+ N more» line is needed.
  const { rows, remainder } = previewRows(withReview, withReview.length, 11);
  assert.equal(rows.length, 11);
  assert.equal(remainder, 0);
  assert.deepEqual(rows.map(r => r.type), withReview);
});

test('an activity names its duration and type: «30 دقيقة · جماعي»', () => {
  assert.equal(summaryLine({ minutes: 30, level: 'جماعي' }, 'ar'), '30 دقيقة · جماعي');
  assert.equal(summaryLine({ minutes: 20, level: 'لعبة تعليمية' }, 'ar'), '20 دقيقة · لعبة تعليمية');
  assert.equal(summaryLine({ minutes: 60, level: 'Group work' }, 'en'), '60 min · Group work');
  // The four durations the screen offers all take «دقيقة».
  for (const m of [20, 30, 45, 60]) assert.equal(summaryLine({ minutes: m }, 'ar'), `${m} دقيقة`);
});

test('the activity sections come in the order the result prints them', () => {
  assert.deepEqual(activitySections(), ['objective', 'materials', 'steps', 'teacherTips', 'differentiation', 'assessment']);
  const { rows, remainder } = previewRows(activitySections(), 6, 6);
  assert.equal(rows.length, 6);
  assert.equal(remainder, 0);
  assert.deepEqual(rows.map(r => r.type), activitySections());
  // A fresh array each time: a caller cannot reorder the shared list.
  assert.notEqual(activitySections(), activitySections());
});
