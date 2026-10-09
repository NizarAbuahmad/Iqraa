/**
 * The printed worksheet is the paper a student holds. Each case here was found
 * by printing one (headless Chromium, 2026-10-08), not by reading the code:
 *
 * - `3^(2x)` and `5^x` reached the student with a literal caret — only digit
 *   exponents were raised;
 * - the name/class/date lines were underscores glued into the instructions
 *   paragraph, beside a note meant for the generator («لا حاجة لملاحظات
 *   المعلم — هذه ورقة للطالب»);
 * - the masthead printed the placeholder «اسم المدرسة» as if it were a name;
 * - a half-solved question got its numbered blanks AND three ruled lines;
 * - every option, «صح» and «خطأ» included, took a line of its own.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorksheetHTML } from '../exportHtml.ts';
import { formatWorksheetText } from '../exportText.ts';
import { MockAIService } from '../ai/generators.ts';
import type { AIRequest, WorksheetOutput } from '../ai/AIService.ts';

const meta = { subject: 'الرياضيات', grade: 'الصف العاشر' };
/** `esc` wraps maths in invisible bidi isolates; strip them to compare words. */
const plain = (html: string) => html.replace(/[⁦-⁩‎‏؜]/g, '');

const LEGACY_AR = 'الاسم: ________________    الصف: الصف العاشر    التاريخ: ________________\n\n'
  + 'مقدمة قصيرة: هذه ورقة تدريب صفية حول «المعادلات الأسية». اعمل بهدوء.\n\n'
  + '• أجب في المساحات المخصصة.\n• بيّن خطوات الحل عند الحاجة.\n• لا حاجة لملاحظات المعلم — هذه ورقة للطالب.';

const sheet = (over: Partial<WorksheetOutput> = {}): WorksheetOutput => ({
  title: 'ورقة عمل',
  instructions: 'أجب عن الأسئلة.',
  sections: [{
    type: 'mixed',
    title: 'أ) تمارين',
    questions: [
      { text: 'أوجد حل المعادلة: 3^(2x) = 81', points: 4 },
      { text: 'أوجد حل المعادلة: 5^x = 125', options: ['x = 2', 'x = 3', 'x = 4', 'x = 5'], points: 2 },
      { text: 'العبارة 2^0 = 1 صحيحة.', options: ['صح', 'خطأ'], points: 2 },
      { text: 'ما الأساس المشترك للعددين 8 و 32 عند كتابتهما كقوى؟', options: ['الأساس 2 لأن كليهما من قوى العدد 2', 'الأساس 4 لأن 4 يقسم كليهما', 'الأساس 8', 'لا يوجد أساس مشترك'], points: 2 },
    ],
  }],
  answerKey: [],
  ...over,
}) as WorksheetOutput;

/** The `<div class="q-card">…</div>` blocks, in order. */
const cards = (html: string) => html.split('<div class="q-card">').slice(1);

describe('printed worksheet: exponents', () => {
  it('raises a letter or bracketed exponent instead of printing a caret', () => {
    const html = plain(buildWorksheetHTML(sheet(), 'ورقة', meta, true, [], false));
    assert.ok(html.includes('3<sup>2x</sup> = 81'), 'bracketed exponent');
    assert.ok(html.includes('5<sup>x</sup> = 125'), 'letter exponent');
    const questions = cards(html).join('');
    assert.ok(!questions.includes('^'), 'a caret reached the paper');
  });

  // <title> holds text only: a tag there is printed literally, in the browser
  // tab and as the saved PDF's name.
  it('keeps markup out of the document title', () => {
    const html = buildWorksheetHTML(sheet(), 'ورقة: 2^x = 8', meta, true, [], false);
    const title = /<title>([^]*?)<\/title>/.exec(html)?.[1] ?? '';
    assert.ok(!title.includes('<'), title);
  });
});

describe('printed worksheet: the student header', () => {
  it('has name, class and date lines and a score out of the total', () => {
    const html = plain(buildWorksheetHTML(sheet(), 'ورقة', meta, true, [], false));
    assert.ok(html.includes('class="exam-fields"'));
    for (const field of ['الاسم', 'الصف والشعبة', 'التاريخ']) assert.ok(html.includes(`${field}:`), field);
    assert.ok(html.includes('/ 10'), 'score out of the points total (4+2+2+2)');
  });

  it('drops the old name line and the generator note from saved instructions', () => {
    const html = plain(buildWorksheetHTML(sheet({ instructions: LEGACY_AR }), 'ورقة', meta, true, [], false));
    assert.ok(!html.includes('________________'), 'old underscore name line printed');
    assert.ok(!html.includes('لا حاجة لملاحظات المعلم'), 'generator note printed');
    assert.ok(html.includes('مقدمة قصيرة'), 'the rest of the instructions kept');
  });

  it('prints the instruction bullets as a list, not one run-on paragraph', () => {
    const html = plain(buildWorksheetHTML(sheet({ instructions: LEGACY_AR }), 'ورقة', meta, true, [], false));
    assert.ok(html.includes('<li>أجب في المساحات المخصصة.</li>'));
    assert.ok(html.includes('<li>بيّن خطوات الحل عند الحاجة.</li>'));
  });

  it('does not print the school-name placeholder as if it were a name', () => {
    const html = plain(buildWorksheetHTML(sheet(), 'ورقة', meta, true, [], false));
    assert.ok(!html.includes('اسم المدرسة'));
    assert.ok(html.includes('المدرسة:'), 'a line to write the school on');
  });
});

describe('printed worksheet: room to write', () => {
  it('gives a half-solved question no extra ruled lines under its own blanks', () => {
    const halfSolved = sheet({
      sections: [{
        type: 'short_answer',
        title: 'مثال نكمله',
        questions: [
          { text: 'حل 3^x = 9\n\nأكمل الحل:\n1) نكتب 9 = 3^2\n2) __________', points: 6 },
          { text: 'أوجد x إذا كان 5^x = 25', points: 4 },
        ],
      }],
    });
    const [first, second] = cards(buildWorksheetHTML(halfSolved, 'ورقة', meta, true, [], false));
    assert.ok(!first!.includes('q-rule'), 'half-solved question got ruled lines too');
    assert.ok(first!.includes('<span class="q-blank"><span>2)</span>'), 'its own blank is a writing line');
    assert.ok(second!.includes('q-rule'), 'an open question still gets ruled lines');
  });

  it('pins a multi-line question\'s number to its first line', () => {
    const html = buildWorksheetHTML(sheet(), 'ورقة', meta, true, [], false);
    const rule = /\.q-head \{([^}]*)\}/.exec(html)?.[1] ?? '';
    assert.ok(rule.includes('align-items: flex-start'), rule);
  });
});

describe('printed worksheet: options take the room they need', () => {
  it('sets very short options four across, short ones two across, long ones one per line', () => {
    const [, mcq, tf, long] = cards(buildWorksheetHTML(sheet(), 'ورقة', meta, true, [], false));
    assert.ok(tf!.includes('q-options q-options-4'), 'true/false');
    assert.ok(mcq!.includes('q-options q-options-4'), 'x = 2 … x = 5');
    assert.ok(long!.includes('<div class="q-options">'), 'long options stay one per line');
  });

  it('sets medium options two across', () => {
    const ws = sheet({
      sections: [{ type: 'multiple_choice', title: 'أ', questions: [
        { text: 'س', options: ['الأساس 2 والأس 5', 'الأساس 4 والأس 2', 'الأساس 8 والأس 1', 'لا شيء مما سبق'], points: 1 },
      ] }],
    });
    const [only] = cards(buildWorksheetHTML(ws, 'ورقة', meta, true, [], false));
    assert.ok(only!.includes('q-options q-options-2'), only);
  });
});

describe('shared worksheet text', () => {
  it('carries the name line once, from the export, even for an old saved sheet', () => {
    for (const instructions of ['أجب عن الأسئلة.', LEGACY_AR]) {
      const text = formatWorksheetText(sheet({ instructions }), 'ورقة', meta, true, false);
      assert.equal(text.match(/الاسم:/g)?.length, 1, text);
      assert.ok(!text.includes('لا حاجة لملاحظات المعلم'));
    }
  });
});

describe('generated worksheet instructions', () => {
  const service = new MockAIService();
  (service as unknown as { delay: () => Promise<void> }).delay = async () => {};
  const req = {
    difficulty: 'mixed', numQuestions: 8, grade: 'الصف العاشر',
    subject: 'الرياضيات', topic: 'المعادلات الأسية',
    questionTypes: ['multiple_choice', 'short_answer'],
  };

  it('leaves the name line to the paper and carries no note to itself (Arabic)', async () => {
    const ws = await service.generateWorksheet({ ...req, language: 'arabic' } as unknown as AIRequest);
    assert.ok(!ws.instructions.includes('الاسم:'), ws.instructions);
    assert.ok(!ws.instructions.includes('لا حاجة لملاحظات المعلم'), ws.instructions);
  });

  it('the same in English', async () => {
    const ws = await service.generateWorksheet({ ...req, language: 'english' } as unknown as AIRequest);
    assert.ok(!ws.instructions.includes('Name:'), ws.instructions);
    assert.ok(!/no teacher notes/i.test(ws.instructions), ws.instructions);
  });
});
