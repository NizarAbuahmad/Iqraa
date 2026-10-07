import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMaterialKind } from '../continueTeaching.ts';
import type { SavedMaterial } from '../workspace.ts';

const saved = (over: Partial<SavedMaterial>): SavedMaterial => ({
  id: 'm1', type: 'worksheet', title: 't', subject: 'الكيمياء', grade: 'الصف العاشر', topic: 'x',
  language: 'ar', content: '{}', savedAt: '2026-10-06T00:00:00.000Z', isFavorite: false, formState: {},
  ...over,
} as SavedMaterial);

describe('resolveMaterialKind', () => {
  it('reads a saved virtual-lab sheet as the worksheet it is filed as', () => {
    // `materialKind: 'virtual-lab'` is not a ContinueMaterialKind. It must fall
    // through to `type`, not be passed along as an unknown kind to the card.
    const item = saved({ formState: { lessonId: 'kbl-chem-s1-nccd-u1_lab', materialKind: 'virtual-lab' } });
    assert.equal(resolveMaterialKind(item), 'worksheet');
  });

  it('still honours the kinds it knows', () => {
    assert.equal(resolveMaterialKind(saved({ formState: { materialKind: 'homework' } })), 'homework');
    assert.equal(resolveMaterialKind(saved({ type: 'quiz', formState: {} })), 'quiz');
  });
});
