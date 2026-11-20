/**
 * The Iqrra logo on exported files, and the worksheet's with/without-answers
 * choice at export time.
 *
 * Before: the Word file was plain text with no logo at all, and the printed
 * page named the brand in a line of text. The worksheet screen exported the key
 * only if its on-screen "show answers" toggle happened to be on, and the export
 * menu could not change that.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as docx from 'docx';

import { BRAND_LOCKUP_PNG_BASE64, BRAND_LOCKUP_PNG_SIZE, WORD_LOCKUP_SPACE_AFTER, brandLockupSvg } from '../brandLockup.ts';
import { LOCKUP_ASPECT } from '../../constants/brandMark.ts';
import { buildWordDocument } from '../docxBuild.ts';
import { buildQuizDocx } from '../quizDocx.ts';
import { buildWorksheetHTML } from '../exportHtml.ts';
import { worksheetExports } from '../worksheetExport.ts';
import type { QuizOutput, WorksheetOutput } from '../ai/AIService.ts';
import { documentXmlOf, zipEntryNames, zipEntryOf } from './docxXml.ts';

const ws = {
  title: 't',
  instructions: 'أجب',
  sections: [{ type: 'short_answer', title: 'ق', questions: [{ text: 'س؟', points: 1 }] }],
  answerKey: [{ num: 1, answer: 'جواب سري' }],
} as unknown as WorksheetOutput;
const meta = { subject: 'اللغة العربية', grade: 'الصف الثامن' };

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

/** The PNG in word/media, and the header XML that places it. */
async function logoOf(doc: docx.Document) {
  const buf = await docx.Packer.toBuffer(doc);
  const names = zipEntryNames(buf);
  const media = names.filter(n => n.startsWith('word/media/') && !n.endsWith('/'));
  const headers = names.filter(n => /^word\/header\d*\.xml$/.test(n)).map(n => zipEntryOf(buf, n)!.toString('utf8'));
  return { media: media.map(n => zipEntryOf(buf, n)!), headers };
}

describe('brand lockup PNG', () => {
  it('is a real PNG in the lockup\'s proportions', () => {
    const png = Buffer.from(BRAND_LOCKUP_PNG_BASE64, 'base64');
    assert.ok(png.subarray(0, 4).equals(PNG_MAGIC));
    // Width and height straight from the IHDR chunk, not from the generated constant alone.
    assert.equal(png.readUInt32BE(16), BRAND_LOCKUP_PNG_SIZE.width);
    assert.equal(png.readUInt32BE(20), BRAND_LOCKUP_PNG_SIZE.height);
    const aspect = BRAND_LOCKUP_PNG_SIZE.width / BRAND_LOCKUP_PNG_SIZE.height;
    assert.ok(Math.abs(aspect - LOCKUP_ASPECT) < 0.02, `PNG ${aspect} vs lockup ${LOCKUP_ASPECT} — rerun scripts/render-brand-png.mjs`);
  });
});

describe('Word exports carry the logo', () => {
  for (const isAr of [true, false]) {
    it(`plain-text Word file (${isAr ? 'ar' : 'en'}): logo in every page header`, async () => {
      const { media, headers } = await logoOf(buildWordDocument('عنوان\n\nسطر', isAr, docx));
      assert.equal(media.length, 1);
      assert.ok(media[0]!.equals(Buffer.from(BRAND_LOCKUP_PNG_BASE64, 'base64')));
      assert.ok(headers.some(h => h.includes('<w:drawing>')), 'header places the image');
      const logoHeader = headers.find(h => h.includes('<w:drawing>'))!;
      assert.match(logoHeader, /<w:jc w:val="center"\/>/, 'centred');
      assert.match(logoHeader, new RegExp(`<w:spacing w:after="${WORD_LOCKUP_SPACE_AFTER}"`), 'space under it');
    });
  }

  it('the worksheet\'s Word file, both copies', async () => {
    for (const copy of ['student', 'teacher'] as const) {
      const { media } = await logoOf(worksheetExports(ws, 'ورقة', meta, true, copy).word(docx));
      assert.equal(media.length, 1, copy);
    }
  });

  it('the quiz\'s laid-out Word paper', async () => {
    const quiz = { title: 'q', duration: 10, totalPoints: 1, questions: [{ id: 'a', type: 'short_answer', text: 'س؟', correctAnswer: 'ج', points: 1, explanation: '' }] } as unknown as QuizOutput;
    const { media, headers } = await logoOf(buildQuizDocx(quiz, 'اختبار', meta, true, false, docx));
    assert.equal(media.length, 1);
    assert.ok(headers.some(h => h.includes('<w:drawing>')));
  });
});

describe('the printed page carries the logo', () => {
  it('worksheet PDF header draws the lockup, not just its name', () => {
    const html = buildWorksheetHTML(ws, 'ورقة', meta, true, [], false);
    assert.ok(html.includes(brandLockupSvg(78)));
  });
});

for (const screen of ['quiz', 'worksheet'] as const) {
  describe(`${screen} screen: with or without answers is picked at export`, () => {
    const src = readFileSync(join(import.meta.dirname, '..', '..', 'app', 'ai-tools', `${screen}.tsx`), 'utf8');
    it('offers the copy choice in the export menu, starting from the screen', () => {
      assert.match(src, /copyChoice=\{\{ value: exportCopy, onChange: setExportCopy \}\}/);
      assert.match(src, /setExportCopy\(showAnswers \? 'teacher' : 'student'\)/);
      assert.doesNotMatch(src, /onExport=\{\(\) => setShowExport\(true\)\}/);
    });
    it('every format follows that choice, not the on-screen toggle', () => {
      const start = src.indexOf('useGeneratorExport({');
      const block = src.slice(start, src.indexOf('onError: key =>', start));
      assert.ok(start > 0 && block.length > 0);
      assert.doesNotMatch(block, /showAnswers/);
      assert.equal((block.match(/exportWithKey/g) ?? []).length, screen === 'quiz' ? 4 : 3);
    });
  });
}

describe('where the key goes', () => {
  it('quiz Word paper: the teacher copy ends with the key, the student copy has none', async () => {
    const quiz = { title: 'q', duration: 10, totalPoints: 1, questions: [{ id: 'a', type: 'short_answer', text: 'سؤال الاختبار؟', correctAnswer: 'جواب سري', points: 1, explanation: '' }] } as unknown as QuizOutput;
    const xml = async (withKey: boolean) => documentXmlOf(await docx.Packer.toBuffer(buildQuizDocx(quiz, 'اختبار', meta, true, withKey, docx)));
    const teacher = await xml(true);
    assert.ok(teacher.lastIndexOf('جواب سري') > teacher.indexOf('مفتاح الإجابات'));
    assert.ok(teacher.indexOf('سؤال الاختبار؟') > 0, 'the question is on the paper');
    assert.ok(teacher.indexOf('مفتاح الإجابات') > teacher.indexOf('سؤال الاختبار؟'));
    assert.ok(!(await xml(false)).includes('جواب سري'));
  });
  it('worksheet: the key sits at the bottom of the teacher copy, and nowhere in the student copy', () => {
    const teacher = worksheetExports(ws, 'ورقة', meta, true, 'teacher').text;
    const student = worksheetExports(ws, 'ورقة', meta, true, 'student').text;
    assert.ok(teacher.indexOf('مفتاح الإجابات') > teacher.indexOf('س؟'));
    assert.ok(teacher.trimEnd().endsWith('جواب سري') || teacher.lastIndexOf('جواب سري') > teacher.indexOf('مفتاح الإجابات'));
    assert.ok(!student.includes('جواب سري'));
  });
});
