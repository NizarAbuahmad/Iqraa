/**
 * Smart Template launch tests.
 *
 * Runs with Node's built-in test runner:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/smartTemplates.test.ts
 *
 * The templates moved off the retired /home screen onto the AI Tools tab. The
 * screen only renders rows; everything that decides where a row goes lives in
 * `buildGeneratorNav`, so that is what is pinned here — including the branch
 * the old screen never had to handle: no lesson picked yet.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildGeneratorNav,
  getVisibleSmartTemplates,
  getToolById,
} from '../homeAiTools.ts';

/** What the tab's press handler builds, kept in one place so it cannot drift. */
function topicFor(hint: string, lessonTopic: string): string {
  const topic = lessonTopic.trim();
  return topic ? `${hint}: ${topic}` : hint;
}

describe('every visible template can actually launch', () => {
  const templates = getVisibleSmartTemplates();

  it('there are templates to show at all', () => {
    assert.ok(templates.length > 0);
  });

  for (const tpl of templates) {
    it(`"${tpl.labelEn}" routes to an enabled tool with a topic`, () => {
      const nav = buildGeneratorNav(tpl.toolId, topicFor(tpl.topicHintAr, 'الاقترانات'), 'ar');
      assert.ok(nav.pathname.startsWith('/'), 'pathname is a real route');
      assert.ok(nav.params.topic, 'a topic is always passed');
      assert.match(nav.params.topic, /الاقترانات/, 'the lesson topic survives');
      assert.match(nav.params.topic, new RegExp(tpl.topicHintAr), 'the hint survives');
      assert.equal(getToolById(tpl.toolId).enabled, true, 'never a coming_soon tool');
    });
  }
});

describe('no lesson picked yet', () => {
  it('sends the hint alone rather than a topic ending in a bare colon', () => {
    for (const tpl of getVisibleSmartTemplates()) {
      const topic = topicFor(tpl.topicHintAr, '');
      assert.equal(topic, tpl.topicHintAr);
      assert.doesNotMatch(topic, /:\s*$/);

      const nav = buildGeneratorNav(tpl.toolId, topic, 'ar');
      assert.ok(nav.params.topic, 'still launches with a usable topic');
    }
  });

  it('treats whitespace as no pick, not as a topic', () => {
    assert.equal(topicFor('خطة درس 45 دقيقة', '   '), 'خطة درس 45 دقيقة');
  });
});
