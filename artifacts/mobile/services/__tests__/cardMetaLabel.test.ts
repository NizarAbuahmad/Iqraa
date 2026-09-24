import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_CARDS, cardMetaLabel } from '../classroomRouting.ts';

test('card meta renders in Arabic on the Arabic hub', () => {
  assert.equal(cardMetaLabel('Easy–Advanced', 'ar'), 'سهل–متقدم');
  assert.equal(cardMetaLabel('Whole Class', 'ar'), 'الصف كاملًا');
  assert.equal(cardMetaLabel('whole-class', 'ar'), 'الصف كاملًا');
  assert.equal(cardMetaLabel('10–30 min', 'ar'), '10–30 دقيقة');
  assert.equal(cardMetaLabel('Whole Class', 'en'), 'Whole Class');
});

test('no card leaves a Latin word behind in Arabic', () => {
  for (const c of ACTIVITY_CARDS) {
    for (const v of [c.difficulty, c.groupType, c.duration]) {
      assert.doesNotMatch(cardMetaLabel(v, 'ar'), /[A-Za-z]/, `${c.id}: ${v}`);
    }
  }
});
