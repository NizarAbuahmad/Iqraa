/**
 * Two bugs left open by the Class Activity review (2026-10-04), each
 * reproduced here before it was fixed.
 *
 *  1. Typing «أنشئ نشاطًا» on /home opened the lesson plan.
 *     `buildGeneratorNav` sends any tool with `enabled: false` to the lesson
 *     plan, and `activity` is `enabled: false` — a flag that exists to keep it
 *     out of the suggestion chips and the related-tools panel, not to stop a
 *     teacher who asked for it by name. The tools tab and the chat «+» both
 *     offer the activity, so the typed path was the only one that refused.
 *     Once routing worked, the topic came out as «ًا»: the tanween on
 *     «نشاطًا» was left behind by `extractLessonTopic`.
 *  2. Regenerate kept the saved id, so on a reopened activity the button still
 *     read «تحديث» and overwrote the version the teacher had saved with the
 *     replacement they were only looking at.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGeneratorNav,
  extractLessonTopic,
  getVisibleHeroSuggestions,
  getVisibleHomeTools,
  getRelatedToolIds,
  inferToolFromPrompt,
} from '../homeAiTools.ts';
import { savedIdAfterGeneration } from '../generationScope.ts';

describe('a typed activity request opens the activity generator', () => {
  const typed = (text: string, fallback = 'درس الاقترانات') => {
    const toolId = inferToolFromPrompt(text);
    return { toolId, nav: buildGeneratorNav(toolId, extractLessonTopic(text, fallback), 'ar') };
  };

  it('«أنشئ نشاطًا» routes to /ai-tools/activity, not the lesson plan', () => {
    const { toolId, nav } = typed('أنشئ نشاطًا');
    assert.equal(toolId, 'activity');
    assert.equal(nav.pathname, '/ai-tools/activity');
  });

  it('falls back to the lesson already open when no topic is typed', () => {
    const { nav } = typed('أنشئ نشاطًا');
    assert.equal(nav.params.topic, 'درس الاقترانات');
  });

  for (const text of [
    'أنشئ نشاطًا عن الاقترانات',
    'أنشئ نشاطاً عن الاقترانات',
    'أنشئ نشاطا عن الاقترانات',
    'أنشئ نشاطًا صفيًا عن الاقترانات',
    'أنشئ نشاطاً صفياً عن الاقترانات',
    'أنشئ نشاط صفي عن الاقترانات',
  ]) {
    it(`takes the lesson as the topic from «${text}»`, () => {
      assert.equal(extractLessonTopic(text, 'x'), 'الاقترانات');
      assert.equal(typed(text).nav.params.topic, 'الاقترانات');
    });
  }

  it('does not strip a word that merely begins like نشاط', () => {
    assert.equal(extractLessonTopic('أنشئ نشاطات الحركة', 'x'), 'نشاطات الحركة');
  });

  it('still sends a typed homework request to an enabled tool', () => {
    // Homework is parked on every surface (hidden in toolCatalog), so it keeps
    // being redirected — the decision this change deliberately leaves alone.
    const { toolId, nav } = typed('أنشئ واجبًا عن الاقترانات');
    assert.equal(toolId, 'homework');
    assert.equal(nav.pathname, '/ai-tools/lesson-plan');
  });

  it('leaves the activity out of the suggestion surfaces, as decided', () => {
    assert.ok(!getVisibleHomeTools().some(t => t.id === 'activity'));
    assert.ok(!getVisibleHeroSuggestions().some(s => s.id === 'activity'));
    assert.ok(!getRelatedToolIds('lesson-plan').includes('activity'));
  });
});

describe('a regenerated activity is a new copy, not an update', () => {
  it('drops the saved id when the teacher regenerates', () => {
    assert.equal(savedIdAfterGeneration('saved-1', { regenerate: true }), undefined);
  });

  it('keeps the saved id on a plain generation', () => {
    // useEnglishRefresh calls generate() and then saves over the Arabic copy.
    assert.equal(savedIdAfterGeneration('saved-1', {}), 'saved-1');
    assert.equal(savedIdAfterGeneration('saved-1', undefined), 'saved-1');
  });

  it('stays unsaved when nothing was saved', () => {
    assert.equal(savedIdAfterGeneration(undefined, { regenerate: true }), undefined);
  });
});
