/**
 * Every Science Lab item names a lesson the app itself resolves. `lab.test.ts`
 * (lib/curriculum) checks the lesson exists in the catalog JSON; this checks
 * `getLessonById` returns it, which also requires the lesson to be visible
 * (MVP grade, subject and book). A row whose lesson the app hides shows no
 * lesson name in the Lab and no slide in the lesson's deck.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LAB_ITEMS } from '@workspace/curriculum/lab';
import { getLessonById } from '../knowledgeBase.ts';

describe('lab items and the app lesson index', () => {
  it('resolves every lab item\'s lesson', () => {
    const missing = LAB_ITEMS.filter(i => !getLessonById(i.lessonId)).map(i => `${i.id} → ${i.lessonId}`);
    assert.deepEqual(missing, []);
  });
});
