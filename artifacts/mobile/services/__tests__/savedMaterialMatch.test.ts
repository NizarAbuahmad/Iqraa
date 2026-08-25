/**
 * Recognising a generated material that is already in the workspace.
 *
 * What these guard: the save button's "محفوظ" state has to survive a reload,
 * and it may only claim a deck is saved when a real workspace item backs it.
 * Both failure directions are bugs a teacher feels — missing the match makes
 * the second press save a duplicate instead of removing, and matching too
 * eagerly makes the button offer to delete a different teacher's material.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { findMatchingItem, type MatchableMaterial } from '../savedMaterialMatch.ts';

const IDENTITY = {
  type: 'slides' as const,
  title: 'المتجهات في المستوى',
  subject: 'الرياضيات',
  grade: 'الصف العاشر',
  topic: 'المتجهات',
  language: 'ar' as const,
};

function item(over: Partial<MatchableMaterial> = {}): MatchableMaterial {
  return {
    id: 'ws_1',
    type: 'slides',
    title: 'المتجهات في المستوى',
    subject: 'الرياضيات',
    grade: 'الصف العاشر',
    topic: 'المتجهات',
    language: 'ar',
    content: '{"slides":[]}',
    ...over,
  };
}

describe('findMatchingItem', () => {
  it('finds the deck the screen just rebuilt', () => {
    assert.equal(findMatchingItem([item()], IDENTITY)?.id, 'ws_1');
  });

  it('returns null when the workspace is empty', () => {
    assert.equal(findMatchingItem([], IDENTITY), null);
  });

  it('matches through the whitespace a generated title picks up', () => {
    const found = findMatchingItem([item({ title: '  المتجهات في   المستوى ' })], IDENTITY);
    assert.equal(found?.id, 'ws_1');
  });

  it('matches an English title regardless of case', () => {
    const found = findMatchingItem(
      [item({ title: 'VECTORS IN THE PLANE', language: 'en' })],
      { ...IDENTITY, title: 'Vectors in the Plane', language: 'en' },
    );
    assert.equal(found?.id, 'ws_1');
  });

  it('ignores content drift — media and edits land after the save', () => {
    const found = findMatchingItem([item({ content: '{"slides":[{"type":"video"}]}' })], IDENTITY);
    assert.equal(found?.id, 'ws_1');
  });

  it('does not match another material type with the same title', () => {
    assert.equal(findMatchingItem([item({ type: 'lesson' })], IDENTITY), null);
  });

  it('does not match a different topic, grade, subject, or language', () => {
    for (const differing of [
      item({ topic: 'الاقترانات' }),
      item({ grade: 'الصف التاسع' }),
      item({ subject: 'الكيمياء' }),
      item({ language: 'en' }),
    ]) {
      assert.equal(findMatchingItem([differing], IDENTITY), null);
    }
  });

  it('takes the newest match, since old duplicates may still be stored', () => {
    // The workspace returns newest-first, and duplicates exist in workspaces
    // that used the save-every-press button this state replaced.
    const found = findMatchingItem([item({ id: 'ws_new' }), item({ id: 'ws_old' })], IDENTITY);
    assert.equal(found?.id, 'ws_new');
  });
});
