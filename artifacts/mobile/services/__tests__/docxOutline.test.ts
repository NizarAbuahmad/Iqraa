/**
 * The Word export's outline.
 *
 * What this guards: the old rule was `line === line.toUpperCase()`, which is
 * `true` for every Arabic line because Arabic is caseless. A generated lesson
 * plan came back with 23 Heading-2 paragraphs of which only 10 were section
 * labels — the rest were teacher instructions, assessment notes, homework and
 * the footer, all bold. In an Arabic-first product a case test cannot decide
 * document structure.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { classifyDocLines, docLineText } from '../docxOutline.ts';

/** The exact shape `formatLessonPlanText` emits. */
const planLines = [
  'خطة درس: الاشتقاق',
  'الرياضيات | الصف العاشر | 90 دقيقة',
  '═══════════════════════════════',
  '',
  'الأهداف',
  '───────',
  '• تعرُّف مفهوم مشتقة كثير الحدود',
  '• إيجاد الميل باستعمال المشتقة',
  '',
  'التمهيد',
  '───────',
  'اعرض موقفًا حياتيًا مرتبطًا بالاشتقاق واطلب من الطلاب التنبؤ بالنتيجة قبل الحساب.',
  '',
  'التقييم',
  '───────',
  'تكويني: أسئلة شفهية خلال الحصة ومراجعة التمارين الصفية.',
  'ختامي: اختبار قصير (5 دقائق) في بداية الحصة القادمة.',
  '',
  '═══════════════════════════════',
  'أُنشئ بواسطة إقرأ — مساعد التدريس الذكي',
];

describe('classifyDocLines', () => {
  const kinds = classifyDocLines(planLines);
  const at = (text: string) => kinds[planLines.indexOf(text)];

  it('promotes only the labels the formatter underlined', () => {
    assert.equal(at('الأهداف'), 'heading');
    assert.equal(at('التمهيد'), 'heading');
    assert.equal(at('التقييم'), 'heading');
    assert.equal(kinds.filter(k => k === 'heading').length, 3);
  });

  it('leaves Arabic prose as body text', () => {
    // Each of these was a bold Heading 2 in the shipped .docx.
    assert.equal(
      at('اعرض موقفًا حياتيًا مرتبطًا بالاشتقاق واطلب من الطلاب التنبؤ بالنتيجة قبل الحساب.'),
      'body',
    );
    assert.equal(at('تكويني: أسئلة شفهية خلال الحصة ومراجعة التمارين الصفية.'), 'body');
    assert.equal(at('ختامي: اختبار قصير (5 دقائق) في بداية الحصة القادمة.'), 'body');
    assert.equal(at('أُنشئ بواسطة إقرأ — مساعد التدريس الذكي'), 'body');
  });

  it('keeps the title, bullets, rules and blanks straight', () => {
    assert.equal(kinds[0], 'title');
    assert.equal(at('• تعرُّف مفهوم مشتقة كثير الحدود'), 'bullet');
    assert.equal(at('═══════════════════════════════'), 'rule');
    assert.equal(at('───────'), 'rule');
    assert.equal(at(''), 'blank');
  });

  it('does not mistake the line above a ═ separator for a heading', () => {
    // Only a dash rule underlines a label; ═ separates sections.
    assert.equal(at('الرياضيات | الصف العاشر | 90 دقيقة'), 'body');
  });

  it('handles English materials the same way', () => {
    const en = ['Lesson Plan: Derivatives', '', 'Objectives', '──────────', 'Students find slopes.'];
    const k = classifyDocLines(en);
    assert.deepEqual(k, ['title', 'blank', 'heading', 'rule', 'body']);
  });

  it('treats a heading at the very end without a following line as body', () => {
    // Fail safe: no underline, no promotion.
    assert.deepEqual(classifyDocLines(['t', 'التقييم']), ['title', 'body']);
  });
});

describe('docLineText', () => {
  it('strips the bullet marker and surrounding space', () => {
    assert.equal(docLineText('  • إيجاد الميل  ', 'bullet'), 'إيجاد الميل');
    assert.equal(docLineText('○ item', 'bullet'), 'item');
  });

  it('leaves every other kind untouched beyond trimming', () => {
    assert.equal(docLineText('  التقييم  ', 'heading'), 'التقييم');
    assert.equal(docLineText('• not a bullet here', 'body'), '• not a bullet here');
  });
});
