/**
 * Lesson prep board — what the home screen reports as ready.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/lessonBoard.test.ts
 *
 * Covers:
 *  1. A saved material ticks its own row and nothing else.
 *  2. Topics that differ only in diacritics, alef shape or punctuation are the
 *     same lesson — the case that made the board read "nothing prepared" for a
 *     lesson with three materials in it.
 *  3. An empty topic matches nothing (no lesson picked ≠ everything prepared).
 *  4. The newest material of a type is the one the row points at.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPrepBoard,
  materialsForTopic,
  normalizeTopic,
  prepSummary,
  sameTopic,
  type MaterialLike,
} from '../lessonBoard.ts';

const TOPIC = 'تركيب الاقترانات';

function material(over: Partial<MaterialLike> & { type: string }): MaterialLike {
  return {
    id: over.id ?? `m-${Math.random().toString(36).slice(2)}`,
    type: over.type,
    title: over.title ?? 'مادة',
    topic: over.topic ?? TOPIC,
    savedAt: over.savedAt ?? '2026-09-19T08:00:00.000Z',
  };
}

describe('buildPrepBoard', () => {
  it('ticks only the row the material belongs to', () => {
    const rows = buildPrepBoard([material({ type: 'worksheet' })], TOPIC);
    const done = rows.filter(r => r.done).map(r => r.type);
    assert.deepEqual(done, ['worksheet']);
    assert.deepEqual(prepSummary(rows), { done: 1, total: 5 });
  });

  it('counts both slide kinds as the slides row, and ignores a flow', () => {
    const rows = buildPrepBoard(
      [material({ type: 'prompt-slides' }), material({ type: 'flow' })],
      TOPIC,
    );
    assert.equal(rows.find(r => r.type === 'slides')?.done, true);
    assert.equal(prepSummary(rows).done, 1);
  });

  it('matches a topic that differs only in diacritics, alef shape or punctuation', () => {
    const rows = buildPrepBoard(
      [material({ type: 'lesson', topic: ' تَرْكِيبُ الِاقْتِرَانَات — ' })],
      'تركيب الإقترانات',
    );
    assert.equal(rows.find(r => r.type === 'lesson-plan')?.done, true);
  });

  it('does not match a different lesson', () => {
    const rows = buildPrepBoard([material({ type: 'quiz', topic: 'المتجهات' })], TOPIC);
    assert.equal(prepSummary(rows).done, 0);
  });

  it('matches nothing when no lesson is picked', () => {
    assert.equal(sameTopic('', ''), false);
    const rows = buildPrepBoard([material({ type: 'quiz', topic: '' })], '');
    assert.equal(prepSummary(rows).done, 0);
  });

  it('points at the newest material of a type', () => {
    const rows = buildPrepBoard(
      [
        material({ id: 'old', type: 'worksheet', savedAt: '2026-09-01T10:00:00.000Z' }),
        material({ id: 'new', type: 'worksheet', savedAt: '2026-09-18T10:00:00.000Z' }),
      ],
      TOPIC,
    );
    const row = rows.find(r => r.type === 'worksheet');
    assert.equal(row?.material?.id, 'new');
    assert.equal(row?.count, 2);
  });
});

describe('normalizeTopic', () => {
  it('collapses whitespace and strips tatweel', () => {
    assert.equal(normalizeTopic('  الاقـــترانات   المركبة '), 'الاقترانات المركبه');
  });

  it('keeps distinct lessons distinct', () => {
    assert.notEqual(normalizeTopic('قانون الجيوب'), normalizeTopic('قانون جيب التمام'));
  });

  it('sorts a topic’s materials newest first', () => {
    const list = materialsForTopic(
      [
        material({ id: 'a', type: 'quiz', savedAt: '2026-09-02T00:00:00.000Z' }),
        material({ id: 'b', type: 'quiz', savedAt: '2026-09-09T00:00:00.000Z' }),
      ],
      TOPIC,
    );
    assert.deepEqual(list.map(m => m.id), ['b', 'a']);
  });
});
