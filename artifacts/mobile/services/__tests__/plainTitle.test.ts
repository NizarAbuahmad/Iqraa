/**
 * Curriculum titles are shown without tashkeel.
 *
 * The NCCD books are fully vowelled, and their titles were copied that way, so
 * a lesson card read «الاستماعُ» — a case ending on a heading. `plainTitle`
 * strips the marks at display time; the stored title keeps them (lesson lookup
 * ranks on the vowelled form). The last test pins that split: the screens that
 * render a lesson title do so through `plainTitle`.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { plainTitle } from '@workspace/curriculum';
import { KB_LESSONS } from '../knowledgeBase.ts';

const MARKS = /[ً-ْٰ]/;
const here = (p: string) => join(import.meta.dirname, p);

describe('plainTitle', () => {
  it('drops the case ending a heading never carries', () => {
    assert.equal(plainTitle('الاستماعُ'), 'الاستماع');
  });

  it('drops every mark, shadda and tanween included', () => {
    assert.equal(plainTitle('أسلوبُ النّداءِ'), 'أسلوب النداء');
    assert.equal(plainTitle('أتحدّثُ بطلاقةٍ'), 'أتحدث بطلاقة');
  });

  it('keeps hamza, letters, digits and punctuation', () => {
    assert.equal(plainTitle('أبني لغتي: مصادرُ الأفعالِ (صرفيّ) — 3'), 'أبني لغتي: مصادر الأفعال (صرفي) — 3');
    assert.equal(plainTitle('Vocabulary & Grammar'), 'Vocabulary & Grammar');
  });

  it('is empty for no title', () => {
    assert.equal(plainTitle(''), '');
    assert.equal(plainTitle(undefined), '');
    assert.equal(plainTitle(null), '');
  });

  it('leaves no mark on any curriculum title', () => {
    const vowelled = KB_LESSONS.filter(l => MARKS.test(l.titleAr));
    // The data really is vowelled — otherwise this test proves nothing.
    assert.ok(vowelled.length > 100, `only ${vowelled.length} vowelled titles`);
    for (const l of vowelled) assert.ok(!MARKS.test(plainTitle(l.titleAr)), l.titleAr);
  });

  it('is applied where the lesson title is rendered', () => {
    const files = [
      '../../components/generator/LessonCard.tsx',
      '../../components/today/PhoneToday.tsx',
      '../../components/ui/TopicSelector.tsx',
      '../../app/(tabs)/index.tsx',
      '../../app/curriculum/unit.tsx',
      '../../app/curriculum/lessons.tsx',
      '../../app/curriculum/lesson-detail.tsx',
    ];
    for (const f of files) {
      const src = readFileSync(here(f), 'utf8');
      assert.match(src, /plainTitle\(/, `${f} renders a title without plainTitle`);
    }
  });
});
