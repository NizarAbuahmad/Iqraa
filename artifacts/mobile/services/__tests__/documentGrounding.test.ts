import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDocumentGrounding,
  topicFromDocumentGrounding,
} from '../documents/grounding.ts';

describe('parseDocumentGrounding', () => {
  it('parses Arabic prompt blocks into objectives and concepts', () => {
    const block = [
      '=== مواد المعلم المرفوعة (سياق أساسي) ===',
      '',
      'ملف 1: المشتقات.pdf (pdf)',
      'عنوان: المشتقات',
      'ملخص: جاهز للتحضير',
      'أهداف:',
      '- أن يفهم الطالب قاعدة القوة',
      '- أن يحسب مشتقة كثيرة حدود',
      'مفاهيم: مشتقة · قاعدة القوة · ميل',
      'نص مستخرج:',
      'مثال: أوجد مشتقة 3x^2',
    ].join('\n');

    const g = parseDocumentGrounding(block);
    assert.equal(g.present, true);
    assert.equal(g.title, 'المشتقات');
    assert.ok(g.objectives.some(o => /قاعدة القوة/.test(o)));
    assert.ok(g.concepts.includes('مشتقة'));
    assert.equal(topicFromDocumentGrounding(g, 'fallback'), 'المشتقات');
  });

  it('parses English prompt blocks', () => {
    const block = [
      '=== Teacher-uploaded materials (primary context) ===',
      '',
      'File 1: derivatives.pdf (pdf)',
      'Title: Derivatives',
      'Objectives:',
      '- Students apply the power rule',
      'Concepts: derivative · power rule',
      'Extracted text:',
      'Example: find the derivative of 3x^2',
    ].join('\n');
    const g = parseDocumentGrounding(block);
    assert.equal(g.present, true);
    assert.equal(g.title, 'Derivatives');
    assert.ok(g.concepts.some(c => /power rule/i.test(c)));
  });

  it('returns empty for unrelated context', () => {
    const g = parseDocumentGrounding('just some notes');
    assert.equal(g.present, false);
  });
});
