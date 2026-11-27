/**
 * A worksheet question carries ONE place to write the answer.
 *
 * A maths fill-in item already ends with «الإجابة: __________»
 * (`lib/math-practice`), and the worksheet appended its own answer block on
 * top, so every such question printed «الإجابة:» twice — 171 of the Grade 2
 * worksheet questions in the 2026-11-13 audit, and the same in every grade.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '../ai/generators.ts';
import type { AIRequest } from '../ai/AIService.ts';

const LESSONS = [
  { topic: 'الجمع مع إعادة التجميع (1)', subject: 'الرياضيات', grade: 'الصف الثاني', language: 'arabic', marker: /الإجابة:/g },
  { topic: 'الطرح مع وجود أصفار', subject: 'الرياضيات', grade: 'الصف الثاني', language: 'arabic', marker: /الإجابة:/g },
  { topic: 'المعادلات الأسية', subject: 'الرياضيات', grade: 'الصف العاشر', language: 'arabic', marker: /الإجابة:/g },
  { topic: 'المعادلات الأسية', subject: 'الرياضيات', grade: 'الصف العاشر', language: 'english', marker: /Answer:/g },
];

describe('worksheet answer lines', () => {
  for (const { marker, ...lesson } of LESSONS) {
    it(`${lesson.topic} (${lesson.grade}, ${lesson.language}): no question asks for its answer twice`, async () => {
      const w = await aiService.generateWorksheet({
        ...lesson, difficulty: 'medium', numQuestions: 12, questionTypes: ['fill_blank', 'short_answer'],
      } as AIRequest);
      const texts = w.sections.flatMap(s => s.questions.map(q => q.text));
      assert.ok(texts.length > 0);
      for (const text of texts) {
        assert.ok((text.match(marker) ?? []).length <= 1, text);
      }
    });
  }
});
