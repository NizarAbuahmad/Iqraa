/**
 * «اقترح ميزة»: an idea that asks for something «إقرأ» already does is answered
 * with how to do it — and only then. A false match tells a teacher their new
 * idea "already exists", so the misses below matter as much as the hits.
 *
 * Run:
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/existingFeature.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existingFeatureFor } from '../existingFeature.ts';

const id = (idea: string) => existingFeatureFor(idea)?.id ?? null;

describe('existingFeatureFor — Word and PDF export', () => {
  it('answers the idea that was actually sent, typo and all', () => {
    // From the admin list, 2026-10-29: «تصدسر» is a typo for «تصدير».
    assert.equal(id('اريد تصدسر ورقة الى وورد'), 'export');
  });

  it('answers «وورد» with or without a prefix', () => {
    for (const idea of ['ملف وورد للخطة', 'أريد حفظ الامتحان بالوورد', 'تنزيل الواجب كوورد', 'نسخة وورد، لو سمحتم']) {
      assert.equal(id(idea), 'export', idea);
    }
  });

  it('answers Word written in Latin letters inside an Arabic message', () => {
    assert.equal(id('أريد تصدير ورقة العمل إلى Word'), 'export');
  });

  it('answers PDF and docx', () => {
    for (const idea of ['حفظ الاختبار PDF', 'اريد ملف بي دي اف', 'Export the quiz as a .docx file', 'please add pdf export']) {
      assert.equal(id(idea), 'export', idea);
    }
  });

  it('answers English that names Word as a file', () => {
    for (const idea of ['I want to export worksheets to Word', 'Save it as a Word document', 'MS Word support please']) {
      assert.equal(id(idea), 'export', idea);
    }
  });

  it('does not read the English word "word" as Microsoft Word', () => {
    for (const idea of ['a word search game for vocabulary', 'more word problems in maths', 'one word answers', 'Word of the day for English class']) {
      assert.equal(id(idea), null, idea);
    }
  });

  it('does not read Arabic words that contain «ورد» as Word', () => {
    for (const idea of ['ورد في الدرس سؤال صعب', 'أريد ورود الأسئلة مرتبة', 'موارد إضافية للمعلم', 'الوردة في درس العلوم']) {
      assert.equal(id(idea), null, idea);
    }
  });
});

describe('existingFeatureFor — dark mode', () => {
  it('answers dark mode in Arabic and English', () => {
    for (const idea of ['الوضع الليلي', 'اضيفوا وضع داكن', 'أريد الوضع المظلم للتطبيق', 'please add dark mode', 'a night theme']) {
      assert.equal(id(idea), 'dark-mode', idea);
    }
  });
});

describe('existingFeatureFor — everything else is a new idea', () => {
  it('stays quiet on ideas that only name a tool', () => {
    // findAppPlaces would match each of these to a tool; they are still ideas.
    for (const idea of ['تحضير كل شيء', 'أريد لعبة للطلاب عن الكسور', 'اضافة اسئلة صح وخطأ للاختبار', 'لاشيء', '', '   ']) {
      assert.equal(id(idea), null, JSON.stringify(idea));
    }
  });

  it('gives the answer key the thank-you shows', () => {
    assert.deepEqual(existingFeatureFor('ملف وورد'), { id: 'export', howKey: 'faqA4' });
    assert.deepEqual(existingFeatureFor('dark mode'), { id: 'dark-mode', howKey: 'howDarkMode' });
  });
});
