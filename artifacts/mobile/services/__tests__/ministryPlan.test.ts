/**
 * What this guards: the Ministry lesson-plan export is a Word file with one
 * landscape page per lesson, fills the header/outcomes/date/section from the
 * plan, prints both role columns at a fixed, equal width whatever they hold
 * (the printed-HTML version let a filled teacher column squeeze the learner
 * column to a sliver), and keeps the four stages with their minutes.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import * as docx from 'docx';

import { buildMinistryPlanDocx, ministryDayAndDate, stagesFromLessonPlan, type MinistryLessonPage } from '../ministryPlan.ts';
import { learnerRoles } from '../ministryLearnerRoles.ts';

const page: MinistryLessonPage = {
  subject: 'الرياضيات',
  grade: 'الصف الأول',
  unit: 'معالجة البيانات',
  lesson: 'التصنيف وفق خاصية واحدة',
  periods: 1,
  priorLearning: 'الدرس السابق',
  outcomes: ['يصنف الأشياء', 'يطبق مفهوم التصنيف'],
  section: 'الأول أ',
  date: '2026-09-20',
  teacher: 'معلم <b>',
  stages: [
    { teacher: 'يسأل', learner: 'يجيب' },
    { teacher: 'يشرح\nيمثّل', learner: 'يدوّن' },
    { teacher: '', learner: '' },
    { teacher: 'يلخص', learner: 'يراجع' },
  ],
};

/** word/document.xml out of a .docx — read through the zip's central directory. */
async function documentXml(pages: MinistryLessonPage[]): Promise<string> {
  const buf = await docx.Packer.toBuffer(buildMinistryPlanDocx(pages, docx));
  let p = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(p + 10);
  p = buf.readUInt32LE(p + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === 'word/document.xml') {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      return (method === 8 ? inflateRawSync(data) : data).toString('utf8');
    }
    p += 46 + nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  throw new Error('no word/document.xml');
}

describe('buildMinistryPlanDocx', () => {
  it('makes one landscape section per lesson', async () => {
    const xml = await documentXml([page, { ...page, date: '2026-09-21' }]);
    assert.equal((xml.match(/<w:sectPr/g) ?? []).length, 2);
    assert.equal((xml.match(/w:orient="landscape"/g) ?? []).length, 2);
  });

  it('fills the header, outcomes, section, day/date and both role columns', async () => {
    const xml = await documentXml([page]);
    for (const s of [
      'المبحث: الرياضيات', 'الدرس: التصنيف وفق خاصية واحدة', 'عدد الحصص: 1', 'التعلم القبلي: الدرس السابق',
      '1_ يصنف الأشياء', '4_ ', 'الأول أ', 'الأحد 2026-09-20', 'يسأل', 'يجيب', 'يمثّل', 'يراجع', '15د', 'تأكيد التعلم',
    ]) assert.ok(xml.includes(s), s);
  });

  it('fixes the role columns at equal width, right to left', async () => {
    const xml = await documentXml([page]);
    assert.equal((xml.match(/<w:gridCol w:w="6650"\/>/g) ?? []).length, 2);
    assert.ok(xml.includes('w:type="fixed"'));
    assert.ok(xml.includes('<w:bidiVisual/>'));
  });

  it('escapes teacher-typed text', async () => {
    const xml = await documentXml([page]);
    assert.ok(!xml.includes('معلم <b>'));
    assert.ok(xml.includes('معلم &lt;b&gt;'));
  });

  it('falls back to the raw string for an unreal date', () => {
    assert.equal(ministryDayAndDate('nope'), 'nope');
  });
});

describe('stagesFromLessonPlan', () => {
  const base = {
    introduction: 'a', mainActivity: 'b', guidedPractice: 'c',
    independentPractice: ' ', differentiation: 'd', closure: 'e', assessment: '',
  };

  it('folds the phases into the teacher column, skipping blanks', () => {
    const st = stagesFromLessonPlan(base);
    assert.deepEqual(st.map(s => s.teacher), ['a', 'b\nc', 'd', 'e']);
  });

  it('never leaves a learner cell empty when the model gave no split', () => {
    for (const opts of [undefined, { lang: 'en' as const }, { lang: 'ar' as const, style: 'inquiry' as const }]) {
      const st = stagesFromLessonPlan(base, opts);
      assert.equal(st.length, 4);
      assert.ok(st.every(s => s.learner.trim() !== ''), JSON.stringify(opts));
    }
  });

  it("fills the learner column in the plan's language and teaching style", () => {
    const en = stagesFromLessonPlan(base, { lang: 'en', style: 'collaborative', topic: 'Vocabulary' });
    assert.ok(en.every(s => /[A-Za-z]/.test(s.learner) && !/[\u0600-\u06FF]/.test(s.learner)));
    const ar = stagesFromLessonPlan(base, { lang: 'ar' });
    assert.ok(ar.every(s => /[\u0600-\u06FF]/.test(s.learner)));
  });

  it("keeps the model's learner text and fills only a blank learner cell", () => {
    const roles = [
      { teacher: 't1', learner: 'real learner' },
      { teacher: 't2', learner: '' },
      { teacher: 't3', learner: '  ' },
      { teacher: 't4', learner: 'l4' },
    ];
    const st = stagesFromLessonPlan({ ...base, ministryRoles: roles }, { lang: 'en' });
    assert.equal(st[0].learner, 'real learner');
    assert.equal(st[3].learner, 'l4');
    assert.deepEqual(st.map(s => s.teacher), ['t1', 't2', 't3', 't4']);
    assert.ok(st[1].learner.trim() !== '' && st[2].learner.trim() !== '');
  });

  it("prefers the model's teacher/learner split when it is whole", () => {
    const roles = [1, 2, 3, 4].map(i => ({ teacher: `m${i}`, learner: `l${i}` }));
    assert.deepEqual(stagesFromLessonPlan({ ...base, ministryRoles: roles }), roles);
  });

  it("takes the teacher column from the phases, and the learner column from the model, when the teacher edited the plan", () => {
    const roles = [1, 2, 3, 4].map(i => ({ teacher: `model teacher ${i}`, learner: `model learner ${i}` }));
    const st = stagesFromLessonPlan({ ...base, ministryRoles: roles }, { teacherFromPhases: true });
    assert.deepEqual(st.map(s => s.teacher), ['a', 'b\nc', 'd', 'e']);
    assert.deepEqual(st.map(s => s.learner), roles.map(r => r.learner));
  });

  it('keeps the model teacher text when the plan was not edited', () => {
    const roles = [1, 2, 3, 4].map(i => ({ teacher: `model teacher ${i}`, learner: `model learner ${i}` }));
    assert.deepEqual(
      stagesFromLessonPlan({ ...base, ministryRoles: roles }, { teacherFromPhases: false }).map(s => s.teacher),
      roles.map(r => r.teacher),
    );
  });

  it('falls back to the folded phases when the split is short or empty', () => {
    assert.equal(stagesFromLessonPlan({ ...base, ministryRoles: [{ teacher: 'x', learner: 'y' }] })[0].teacher, 'a');
    const blank = [1, 2, 3, 4].map(() => ({ teacher: ' ', learner: '' }));
    assert.equal(stagesFromLessonPlan({ ...base, ministryRoles: blank })[1].teacher, 'b\nc');
  });
});

describe('learnerRoles', () => {
  const STYLES = ['direct', 'inquiry', 'collaborative'] as const;

  it('gives four non-empty stages for every style and language', () => {
    for (const lang of ['ar', 'en'] as const) {
      for (const style of STYLES) {
        const r = learnerRoles({ lang, style });
        assert.equal(r.length, 4);
        assert.ok(r.every(x => x.trim() !== ''), `${lang}/${style}`);
      }
    }
  });

  it('differs by style where the style changes what students do (explain, expand)', () => {
    for (const lang of ['ar', 'en'] as const) {
      for (const stage of [1, 2]) {
        const texts = STYLES.map(style => learnerRoles({ lang, style })[stage]);
        assert.equal(new Set(texts).size, STYLES.length, `${lang} stage ${stage}`);
      }
    }
  });

  it('puts students in groups for the collaborative style only', () => {
    assert.match(learnerRoles({ lang: 'en', style: 'collaborative' })[1], /group/i);
    assert.doesNotMatch(learnerRoles({ lang: 'en', style: 'direct' })[1], /group/i);
    assert.match(learnerRoles({ lang: 'ar', style: 'collaborative' })[1], /مجموعات/);
  });

  it('names the lesson in the explain stage when it is known', () => {
    assert.ok(learnerRoles({ lang: 'en', topic: 'Vocabulary' })[1].includes('Vocabulary'));
    assert.ok(learnerRoles({ lang: 'ar', topic: 'قانون الجيوب' })[1].includes('قانون الجيوب'));
    assert.ok(learnerRoles({ lang: 'en' })[1].trim() !== '');
  });
});
