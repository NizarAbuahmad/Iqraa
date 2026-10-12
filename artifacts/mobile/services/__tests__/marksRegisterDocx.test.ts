import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as docx from 'docx';

import { buildMarksRegister } from '../marksRegister.ts';
import { buildMarksRegisterDocx } from '../marksRegisterDocx.ts';
import { documentXmlOf } from './docxXml.ts';

const register = buildMarksRegister(
  [{ id: 's1', displayName: 'أحمد' }, { id: 's2', displayName: 'سارة' }],
  [{ id: 'e1', title: 'اختبار الوحدة الأولى', totalMarks: '10.00' }],
  { e1: [{ studentId: 's1', result: { earnedMarks: '7.50', isProvisional: false } }] },
);
const meta = { className: 'العاشر أ', subject: 'الرياضيات', grade: 'الصف العاشر' };

async function xml(isAr: boolean): Promise<string> {
  return documentXmlOf(await docx.Packer.toBuffer(buildMarksRegisterDocx(register, meta, isAr, docx)));
}

describe('buildMarksRegisterDocx', () => {
  it('prints the head, every student, the exam column and the paper columns', async () => {
    const x = await xml(true);
    for (const s of ['سجل العلامات', 'العاشر أ', 'أحمد', 'سارة', 'اختبار الوحدة الأولى', 'اختبار قصير', 'امتحان نصفي', 'العلامة العظمى']) {
      assert.ok(x.includes(s), `missing «${s}»`);
    }
    assert.ok(x.includes('>7.5<'), 'the mark on record is printed, trimmed');
  });

  it('is landscape and reads right to left in Arabic', async () => {
    const x = await xml(true);
    assert.match(x, /w:orient="landscape"/);
    assert.match(x, /w:bidiVisual/);
  });

  it('is left to right in English', async () => {
    const x = await xml(false);
    assert.ok(x.includes('Marks Register'));
    assert.doesNotMatch(x, /w:bidiVisual\/>/);
  });
});
