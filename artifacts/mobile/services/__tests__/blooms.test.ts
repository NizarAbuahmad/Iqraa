/**
 * Cognitive-level classification from objective wording.
 *
 * The competency breakdown is only meaningful if this works on the actual
 * corpus, so the important assertions here run against real catalog objectives
 * rather than invented sentences. The corpus is written in masdar (verbal
 * nouns) — «حل»، «تعرُّف»، «نمذجة» — so a classifier tuned to conjugated verbs
 * would pass hand-written examples and score nothing on the real data.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyBlooms,
  normalizeArabic,
  getObjectivesForBook,
  getAllObjectives,
} from '../curriculumData.ts';

describe('normalizeArabic', () => {
  it('folds alef variants', () => {
    assert.equal(normalizeArabic('أحمد'), 'احمد');
    assert.equal(normalizeArabic('إيجاد'), 'ايجاد');
    assert.equal(normalizeArabic('آخر'), 'اخر');
  });

  it('strips harakat and tatweel', () => {
    assert.equal(normalizeArabic('تعرُّف'), 'تعرف');
    assert.equal(normalizeArabic('مـــعادلة'), 'معادله');
  });

  it('folds ta marbuta and alef maqsura', () => {
    assert.equal(normalizeArabic('نمذجة'), 'نمذجه');
    assert.equal(normalizeArabic('أخرى'), 'اخري');
  });
});

describe('classifyBlooms — masdar forms, as the curriculum is actually written', () => {
  const cases: [string, string][] = [
    ['حل نظام مكوَّن من معادلة خطية وأخرى تربيعية', 'Apply'],
    ['تعرُّف عدد الحلول الممكنة لنظام من معادلتين', 'Understand'],
    ['نمذجة مسألة حياتية باستعمال نظام معادلات، ثم حل النظام', 'Apply'],
    ['استعمال برمجية جيوجبرا لحل نظام معادلات بيانيًّا', 'Apply'],
    ['تبسيط المقادير الأسية', 'Apply'],
    ['حساب مساحة القطاع الدائري', 'Apply'],
    ['ذكر خصائص الدائرة', 'Remember'],
    ['تعريف الوتر في الدائرة', 'Remember'],
    ['شرح العلاقة بين الزاوية المركزية والزاوية المحيطية', 'Understand'],
    ['المقارنة بين النسب المثلثية للزوايا', 'Analyze'],
    ['تصنيف التفاعلات الكيميائية', 'Analyze'],
    ['تعليل اختلاف نصف القطر الذري', 'Analyze'],
    ['تقويم صحة الحل المقترح', 'Evaluate'],
    ['تصميم نموذج يمثّل حركة الجسم', 'Create'],
  ];

  for (const [text, expected] of cases) {
    it(`${expected}: ${text.slice(0, 42)}…`, () => {
      assert.equal(classifyBlooms(text), expected);
    });
  }

  it('matches conjugated verbs too, for hand-authored objectives', () => {
    assert.equal(classifyBlooms('يحسب الطلاب الطاقة المنبعثة'), 'Apply');
    assert.equal(classifyBlooms('يشرح الطلاب انتقالات الإلكترون'), 'Understand');
  });

  it('classifies the English objective text as well', () => {
    assert.equal(classifyBlooms('Students calculate the energy emitted'), 'Apply');
    assert.equal(classifyBlooms('Students compare two reaction types'), 'Analyze');
  });

  it('returns null rather than guessing when no action word is present', () => {
    assert.equal(classifyBlooms('الدائرة والمثلث'), null);
    assert.equal(classifyBlooms(''), null);
  });

  it('does not fire on an action word buried inside another word', () => {
    // "محلول" contains "حل" — matching it would classify a noun as Apply.
    assert.equal(classifyBlooms('محلول مائي مخفف'), null);
  });
});

describe('classifyBlooms — coverage of the real catalog', () => {
  it('classifies the great majority of math S1 objectives', () => {
    const objectives = getObjectivesForBook('book-math-10');
    const classified = objectives.filter(o => o.inferredBloomsLevel !== null);
    assert.ok(objectives.length > 0);
    assert.ok(
      classified.length / objectives.length >= 0.8,
      `only ${classified.length}/${objectives.length} math S1 objectives classified`,
    );
  });

  it('produces a real spread rather than one level for everything', () => {
    // The whole point: the stored data says 'Understand' for all of these.
    const levels = new Set(
      getAllObjectives()
        .filter(o => o.bloomsSource === 'defaulted' && o.inferredBloomsLevel)
        .map(o => o.inferredBloomsLevel),
    );
    assert.ok(
      levels.size >= 3,
      `inferred levels collapsed to ${levels.size}: ${[...levels].join(', ')}`,
    );
  });

  it('never overwrites an authored classification', () => {
    for (const o of getAllObjectives()) {
      if (o.bloomsSource === 'authored') {
        assert.equal(o.inferredBloomsLevel, null);
        assert.equal(o.effectiveBloomsLevel, o.bloomsLevel);
      }
    }
  });

  it('falls back to the stored level when nothing can be inferred', () => {
    const unclassified = getAllObjectives().filter(
      o => o.bloomsSource === 'defaulted' && o.inferredBloomsLevel === null,
    );
    for (const o of unclassified) {
      assert.equal(o.effectiveBloomsLevel, o.bloomsLevel);
    }
  });
});
