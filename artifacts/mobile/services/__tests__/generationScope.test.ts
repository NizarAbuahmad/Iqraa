/**
 * What a generator screen saves, exports and presents is the scope the
 * material was GENERATED under — not whatever the pickers say now.
 *
 * Every screen let the form drift after generation: changing grade or
 * subject cleared the topic but kept the result, so Save stored it under
 * the new subject as «اختبار: », and "present on screen" re-grounded the
 * lesson from the topic box (the lesson-title trap in CLAUDE.md). The scope
 * is captured once, at generation time, and re-derived once more when a
 * saved material is reopened.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  captureGenerationScope,
  materialScope,
  reopenedGenerationScope,
} from '../generationScope.ts';
import { resolveGeneratorGrounding } from '../kbContext.ts';
import { getLessonById } from '../knowledgeBase.ts';

const LESSON = getLessonById('kbl-math-s1-nccd-u1_l1')!;

describe('captureGenerationScope', () => {
  it('freezes the pickers, the trimmed topic and the grounded lesson', () => {
    const grounding = resolveGeneratorGrounding(LESSON.titleAr, 'ar');
    const scope = captureGenerationScope({ gradeIdx: 2, subjectIdx: 1, topic: `  ${LESSON.titleAr}  ` }, grounding);
    assert.equal(scope.gradeIdx, 2);
    assert.equal(scope.subjectIdx, 1);
    assert.equal(scope.topic, LESSON.titleAr);
    assert.equal(scope.grounded, true);
    assert.equal(scope.lesson?.id, LESSON.id);
  });

  it('records an ungrounded topic as such, with no lesson', () => {
    const grounding = resolveGeneratorGrounding('zzz-not-a-lesson-qq', 'ar');
    const scope = captureGenerationScope({ gradeIdx: 0, subjectIdx: 0, topic: 'zzz-not-a-lesson-qq' }, grounding);
    assert.equal(scope.grounded, false);
    assert.equal(scope.lesson, null);
  });
});

describe('reopenedGenerationScope', () => {
  it('re-grounds the saved topic so a reopened material keeps its lesson', () => {
    const scope = reopenedGenerationScope({ gradeIdx: 3, subjectIdx: 2 }, LESSON.titleAr, 'ar');
    assert.ok(scope);
    assert.equal(scope.gradeIdx, 3);
    assert.equal(scope.lesson?.id, LESSON.id);
    assert.equal(scope.grounded, true);
  });

  it('is null when the saved material carries no topic', () => {
    assert.equal(reopenedGenerationScope({ gradeIdx: 0, subjectIdx: 0 }, undefined, 'ar'), null);
    assert.equal(reopenedGenerationScope({ gradeIdx: 0, subjectIdx: 0 }, '   ', 'ar'), null);
  });
});

describe('materialScope', () => {
  it('prefers the generation-time scope over the live form', () => {
    const generated = captureGenerationScope({ gradeIdx: 1, subjectIdx: 1, topic: 'old' }, resolveGeneratorGrounding('old', 'ar'));
    const scope = materialScope(generated, { gradeIdx: 0, subjectIdx: 0, topic: '' });
    assert.equal(scope.topic, 'old');
    assert.equal(scope.subjectIdx, 1);
  });

  it('falls back to the live form, ungrounded, when nothing was generated', () => {
    const scope = materialScope(null, { gradeIdx: 0, subjectIdx: 2, topic: ' live ' });
    assert.equal(scope.topic, 'live');
    assert.equal(scope.subjectIdx, 2);
    assert.equal(scope.lesson, null);
    assert.equal(scope.grounded, false);
  });
});
