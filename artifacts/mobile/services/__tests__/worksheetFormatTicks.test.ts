import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatTicks, sanitizeQuestionTypes, DEFAULT_QUESTION_TYPES } from '../worksheetFormatTicks.ts';

const all = { match: true, order: true, spot_error: true, graph: true };
const some = { match: true, order: false, spot_error: true, graph: false };

describe('formatTicks', () => {
  it('shows all four, none greyed, when the lesson supports them', () => {
    const r = formatTicks({ isHomework: false, availability: all });
    assert.deepEqual(r.shown, ['match', 'order', 'spot_error', 'graph']);
    assert.deepEqual(r.greyed, []);
  });
  it('greys the unsupported ones and keeps them listed', () => {
    const r = formatTicks({ isHomework: false, availability: some });
    assert.deepEqual(r.shown, ['match', 'order', 'spot_error', 'graph']);
    assert.deepEqual(r.greyed, ['order', 'graph']);
  });
  it('shows none for homework — its generator never builds formats', () => {
    const r = formatTicks({ isHomework: true, availability: all });
    assert.deepEqual(r.shown, []);
    assert.deepEqual(r.greyed, []);
  });
});

describe('sanitizeQuestionTypes', () => {
  it('removes a greyed format from the selection', () => {
    const out = sanitizeQuestionTypes(new Set(['short_answer', 'order', 'match']), { isHomework: false, availability: some });
    assert.deepEqual([...out], ['short_answer', 'match']);
  });
  it('strips every format from a homework request, however it got selected', () => {
    const out = sanitizeQuestionTypes(new Set(['short_answer', 'match', 'graph']), { isHomework: true, availability: all });
    assert.deepEqual([...out], ['short_answer']);
  });
  it('never returns an empty selection', () => {
    const out = sanitizeQuestionTypes(new Set(['order', 'graph']), { isHomework: false, availability: some });
    assert.deepEqual([...out], [...DEFAULT_QUESTION_TYPES]);
  });
  it('returns the same set object when nothing changes', () => {
    const s = new Set(['short_answer', 'match']);
    assert.equal(sanitizeQuestionTypes(s, { isHomework: false, availability: some }), s);
  });
  it('keeps order of the rest', () => {
    const out = sanitizeQuestionTypes(new Set(['multiple_choice', 'graph', 'true_false']), { isHomework: false, availability: some });
    assert.deepEqual([...out], ['multiple_choice', 'true_false']);
  });
});
