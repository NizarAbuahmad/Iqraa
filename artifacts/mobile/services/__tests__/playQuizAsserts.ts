import assert from 'node:assert/strict';
import type { TextQuestion } from '../publicGames/textQuiz.ts';

/** A playable question: enough distinct options and exactly one that is correct. */
export function assertWellFormed(q: TextQuestion, minOptions = 2): void {
  assert.ok(q.options.length >= minOptions, `only ${q.options.length} options`);
  assert.equal(new Set(q.options.map(o => o.id)).size, q.options.length, 'duplicate option id');
  assert.equal(new Set(q.options.map(o => o.label)).size, q.options.length, 'duplicate option label');
  assert.equal(q.options.filter(o => o.id === q.correctId).length, 1, 'correct answer must appear exactly once');
}
