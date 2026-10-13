import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertReviewFileFree,
  hashContent,
  plannedCalls,
  plannedTeachingCalls,
  reviewEntry,
  verifyReviewEntries,
  type Call,
  type ReviewEntry,
} from '../../scripts/pregenerate.ts';

// A pre-generated copy only helps if it is the copy a teacher's default form
// asks for. These pin the bits of the body that decide whether the pool matches.
test('pregenerate plans a worksheet and a lesson plan per lesson, in the default form', () => {
  const calls = plannedCalls();
  assert.ok(calls.length >= 20, `expected a real lesson list, got ${calls.length}`);
  assert.equal(calls.filter(c => c.kind === 'worksheet').length, calls.filter(c => c.kind === 'lesson-plan').length);

  for (const c of calls) {
    const b = c.body as Record<string, unknown>;
    assert.equal(b.contextSource, 'curriculum', c.lesson);
    assert.equal(b.language, 'arabic');
    assert.equal(b.subject, 'Mathematics');
    assert.equal(b.grade, 'الصف العاشر');
    assert.ok(b.lessonId, `no lessonId for ${c.lesson}`);
    assert.ok(b.additionalContext, `no curriculum context for ${c.lesson}`);
    assert.equal(b.topic, c.lesson);
    if (c.kind === 'worksheet') {
      assert.equal(b.numQuestions, 10);
      assert.deepEqual(b.questionTypes, ['multiple_choice', 'short_answer']);
      assert.equal(b.difficulty, 'easy');
    } else {
      assert.equal(b.duration, 45);
      assert.equal(b.teachingStyle, 'direct');
    }
  }
});

import { getLessonById as getBrowserLessonById } from '../curriculumData.ts';
import { resolveGeneratorGrounding } from '../kbContext.ts';

test('the lesson-teaching prefill sends the lesson\'s own id, once per lesson, in both subjects', () => {
  const calls = plannedTeachingCalls();
  // Ambiguous titles are skipped on purpose, so this is a floor, not a count.
  assert.ok(calls.length >= 30, `expected maths and chemistry lessons, got ${calls.length}`);
  assert.deepEqual(
    [...new Set(calls.map(c => (c.body as Record<string, unknown>).subject))].sort(),
    ['Chemistry', 'Mathematics'],
  );

  const ids = new Set<string>();
  for (const c of calls) {
    const b = c.body as Record<string, unknown>;
    assert.equal(c.kind, 'lesson-teaching');
    assert.equal(b.contextSource, 'curriculum', c.lesson);
    assert.equal(b.language, 'arabic');
    assert.equal(b.grade, 'الصف العاشر');
    assert.equal(b.topic, c.lesson);
    assert.ok(b.additionalContext, `no curriculum context for ${c.lesson}`);
    // The id is the grounding's, never a re-derivation from the title.
    assert.equal(b.lessonId, resolveGeneratorGrounding(c.lesson, 'ar').lesson?.id, c.lesson);
    assert.equal(getBrowserLessonById(b.lessonId as string)?.id, b.lessonId, c.lesson);
    assert.ok(!ids.has(b.lessonId as string), `duplicate lesson id ${String(b.lessonId)}`);
    ids.add(b.lessonId as string);
  }
});

test('plannedCalls is unchanged: maths worksheet + lesson plan only', () => {
  const kinds = new Set(plannedCalls().map(c => c.kind));
  assert.deepEqual([...kinds].sort(), ['lesson-plan', 'worksheet']);
});

test('reviewEntry shows what a student would read, and nothing else', () => {
  const call: Call = { kind: 'lesson-teaching', lesson: 'المول', body: { lessonId: 'kbl-x' } };
  const entry = reviewEntry(call, {
    hook: { question: 'ما المول؟', teacherNote: 'ابدأ بسؤال' },
    concepts: [{ title: 'المول', points: ['a'], teacherNote: 'اشرح' }],
    sources: [{ titleAr: 'كتاب', page: 3 }],
    servedReason: 'budget',
    variantId: 'v-1',
  });
  const content = { hook: { question: 'ما المول؟' }, concepts: [{ title: 'المول', points: ['a'] }] };
  assert.deepEqual(entry, {
    variantId: 'v-1',
    lessonId: 'kbl-x',
    lesson: 'المول',
    contentHash: hashContent(content),
    content,
  });
});

test('reviewEntry\'s contentHash is the hash of the content it carries', () => {
  const call: Call = { kind: 'lesson-teaching', lesson: 'المول', body: { lessonId: 'kbl-x' } };
  const entry = reviewEntry(call, { hook: { question: 'q', teacherNote: 'n' }, variantId: 'v-1' });
  assert.ok(entry);
  assert.equal(entry.contentHash, hashContent(entry.content));
});

test('reviewEntry returns null for a result that was never pooled', () => {
  const call: Call = { kind: 'lesson-teaching', lesson: 'المول', body: { lessonId: 'kbl-x' } };
  assert.equal(reviewEntry(call, { hook: { question: 'q' } }), null);
  assert.equal(reviewEntry(call, null), null);
  assert.equal(reviewEntry({ ...call, body: {} }, { variantId: 'v-1' }), null);
});

test('hashContent is stable and changes when the content does', () => {
  const a = { hook: { question: 'ما المول؟' }, concepts: [{ title: 'المول', points: ['a', 'b'] }] };
  assert.equal(hashContent(a), hashContent(structuredClone(a)));
  assert.match(hashContent(a), /^[0-9a-f]{64}$/);
  assert.notEqual(hashContent(a), hashContent({ ...a, hook: { question: 'ما المول' } }));
  assert.notEqual(hashContent(a), hashContent({ ...a, concepts: [{ title: 'المول', points: ['a'] }] }));
});

function entryFor(id: string, content: unknown): ReviewEntry {
  return { variantId: id, lessonId: `kbl-${id}`, lesson: `درس ${id}`, contentHash: hashContent(content), content };
}

test('verifyReviewEntries separates what may be approved from what was edited or is malformed', () => {
  const good = entryFor('v-1', { hook: { question: 'q' } });
  const edited: ReviewEntry = { ...entryFor('v-2', { hook: { question: 'q2' } }), content: { hook: { question: 'changed' } } };
  const noHash = { variantId: 'v-3', lessonId: 'kbl-3', lesson: 'x', content: {} };
  const badId = { ...entryFor('v-4', {}), variantId: 4 };

  const result = verifyReviewEntries([good, edited, noHash, badId, 'nope', null]);
  assert.deepEqual(result.approvable, [good]);
  assert.deepEqual(result.edited, [edited]);
  assert.equal(result.malformed, 4);
});

test('verifyReviewEntries treats a file that is not an array as one malformed entry', () => {
  for (const input of [{}, 'x', null, undefined, 3]) {
    assert.deepEqual(verifyReviewEntries(input), { approvable: [], edited: [], malformed: 1 });
  }
  assert.deepEqual(verifyReviewEntries([]), { approvable: [], edited: [], malformed: 0 });
});

test('a review file that already exists is not overwritten without --force', () => {
  assert.throws(() => assertReviewFileFree(true, false, 'pregen-review.json'), /pregen-review\.json.*--approve.*--review=.*--force/s);
  assert.doesNotThrow(() => assertReviewFileFree(true, true, 'pregen-review.json'));
  assert.doesNotThrow(() => assertReviewFileFree(false, false, 'pregen-review.json'));
});
