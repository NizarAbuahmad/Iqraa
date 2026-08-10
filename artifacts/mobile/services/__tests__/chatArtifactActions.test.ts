/**
 * What these guard: every artifact kind chat can produce must map to a real
 * tool screen, a real workspace type, and its own payload.
 *
 * The mapping is the load-bearing part. Chat generates the same objects the
 * tool screens do, so "edit this" is a save plus a route — but a wrong route
 * opens the wrong editor, and a wrong payload saves the wrapper instead of the
 * material. Both fail silently: the teacher gets a screen, just not theirs.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  artifactMaterialType,
  artifactPayload,
  artifactRoute,
  artifactTitle,
} from '../chatArtifactActions.ts';
import type { ChatArtifactData } from '../ai/chatArtifacts.ts';

const PLAN = { title: 'خطة' } as never;
const WORKSHEET = { title: 'ورقة' } as never;
const QUIZ = { title: 'اختبار' } as never;
const ACTIVITY = { activityName: 'نشاط' } as never;

const ALL: ChatArtifactData[] = [
  { kind: 'lesson-plan', plan: PLAN },
  { kind: 'worksheet', worksheet: WORKSHEET },
  { kind: 'quiz', quiz: QUIZ },
  { kind: 'activity', activity: ACTIVITY },
];

describe('artifact mapping', () => {
  it('routes every kind to a tool screen that exists', () => {
    // Kept in step with app/ai-tools/*.tsx by hand; if a route is renamed this
    // is the test that should fail rather than a teacher hitting a blank screen.
    const routes = ALL.map(artifactRoute);
    assert.deepEqual(routes, [
      '/ai-tools/lesson-plan',
      '/ai-tools/worksheet',
      '/ai-tools/quiz',
      '/ai-tools/activity',
    ]);
  });

  it('maps every kind to a workspace material type', () => {
    assert.deepEqual(ALL.map(artifactMaterialType), [
      'lesson',
      'worksheet',
      'quiz',
      'activity',
    ]);
    // 'lesson-plan' is the chat kind; 'lesson' is the workspace type. They are
    // deliberately different names, so this pairing has to be asserted.
    assert.equal(artifactMaterialType({ kind: 'lesson-plan', plan: PLAN }), 'lesson');
  });

  it('unwraps the generator output, not the wrapper', () => {
    // Saving the union rather than its payload produces an item the tool
    // screen cannot parse — and it fails at open time, far from the cause.
    assert.equal(artifactPayload({ kind: 'quiz', quiz: QUIZ }), QUIZ);
    assert.equal(artifactPayload({ kind: 'lesson-plan', plan: PLAN }), PLAN);
    assert.equal(artifactPayload({ kind: 'worksheet', worksheet: WORKSHEET }), WORKSHEET);
    assert.equal(artifactPayload({ kind: 'activity', activity: ACTIVITY }), ACTIVITY);
  });

  it('titles in the teacher language, with the topic', () => {
    assert.equal(
      artifactTitle({ kind: 'quiz', quiz: QUIZ }, 'الاقترانات', 'ar'),
      'اختبار: الاقترانات',
    );
    assert.equal(
      artifactTitle({ kind: 'worksheet', worksheet: WORKSHEET }, 'Functions', 'en'),
      'Worksheet: Functions',
    );
  });

  it('still produces a findable title with no topic', () => {
    // An untitled row in the workspace can be found; a blank one cannot.
    assert.equal(artifactTitle({ kind: 'quiz', quiz: QUIZ }, '   ', 'ar'), 'اختبار');
    assert.equal(artifactTitle({ kind: 'activity', activity: ACTIVITY }, '', 'en'), 'Activity');
  });
});
