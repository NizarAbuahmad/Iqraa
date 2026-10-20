import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertApproveAlone,
  assertReviewFileFree,
  hashContent,
  parseOnly,
  plannedCalls,
  plannedTeachingCalls,
  readCredentials,
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

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';
const V3 = '33333333-3333-4333-8333-333333333333';
const V4 = '44444444-4444-4444-8444-444444444444';

test('reviewEntry shows what a student would read, and nothing else', () => {
  const call: Call = { kind: 'lesson-teaching', lesson: 'المول', body: { lessonId: 'kbl-x' } };
  const entry = reviewEntry(call, {
    hook: { question: 'ما المول؟', teacherNote: 'ابدأ بسؤال' },
    concepts: [{ title: 'المول', points: ['a'], teacherNote: 'اشرح' }],
    sources: [{ titleAr: 'كتاب', page: 3 }],
    servedReason: 'budget',
    variantId: V1,
  });
  const content = { hook: { question: 'ما المول؟' }, concepts: [{ title: 'المول', points: ['a'] }] };
  assert.deepEqual(entry, {
    variantId: V1,
    lessonId: 'kbl-x',
    lesson: 'المول',
    contentHash: hashContent(V1, 'kbl-x', content),
    content,
  });
});

test('reviewEntry\'s contentHash is the hash of the content it carries', () => {
  const call: Call = { kind: 'lesson-teaching', lesson: 'المول', body: { lessonId: 'kbl-x' } };
  const entry = reviewEntry(call, { hook: { question: 'q', teacherNote: 'n' }, variantId: V1 });
  assert.ok(entry);
  assert.equal(entry.contentHash, hashContent(entry.variantId, entry.lessonId, entry.content));
});

test('reviewEntry returns null for a result that was never pooled', () => {
  const call: Call = { kind: 'lesson-teaching', lesson: 'المول', body: { lessonId: 'kbl-x' } };
  assert.equal(reviewEntry(call, { hook: { question: 'q' } }), null);
  assert.equal(reviewEntry(call, null), null);
  assert.equal(reviewEntry({ ...call, body: {} }, { variantId: V1 }), null);
});

test('hashContent is stable and changes when the content or either id does', () => {
  const a = { hook: { question: 'ما المول؟' }, concepts: [{ title: 'المول', points: ['a', 'b'] }] };
  assert.equal(hashContent(V1, 'kbl-x', a), hashContent(V1, 'kbl-x', structuredClone(a)));
  assert.match(hashContent(V1, 'kbl-x', a), /^[0-9a-f]{64}$/);
  assert.notEqual(hashContent(V1, 'kbl-x', a), hashContent(V1, 'kbl-x', { ...a, hook: { question: 'ما المول' } }));
  assert.notEqual(hashContent(V1, 'kbl-x', a), hashContent(V1, 'kbl-x', { ...a, concepts: [{ title: 'المول', points: ['a'] }] }));
  assert.notEqual(hashContent(V1, 'kbl-x', a), hashContent(V2, 'kbl-x', a));
  assert.notEqual(hashContent(V1, 'kbl-x', a), hashContent(V1, 'kbl-y', a));
});

test('hashContent cannot be fooled by moving text between the ids and the content', () => {
  // A canonical JSON object, not a concatenation: ('ab','c') and ('a','bc') differ.
  assert.notEqual(hashContent(V1, 'ab', 'c'), hashContent(V1, 'a', 'bc'));
});

function entryFor(id: string, content: unknown): ReviewEntry {
  return { variantId: id, lessonId: `kbl-${id.slice(0, 2)}`, lesson: `درس ${id.slice(0, 2)}`, contentHash: hashContent(id, `kbl-${id.slice(0, 2)}`, content), content };
}

test('verifyReviewEntries separates what may be approved from what was edited or is malformed', () => {
  const good = entryFor(V1, { hook: { question: 'q' } });
  const edited: ReviewEntry = { ...entryFor(V2, { hook: { question: 'q2' } }), content: { hook: { question: 'changed' } } };
  const noHash = { variantId: V3, lessonId: 'kbl-3', lesson: 'x', content: {} };
  const badId = { ...entryFor(V4, {}), variantId: 4 };

  const result = verifyReviewEntries([good, edited, noHash, badId, 'nope', null]);
  assert.deepEqual(result.approvable, [good]);
  assert.deepEqual(result.edited, [edited]);
  assert.equal(result.malformed, 4);
});

test('an entry whose variantId or lessonId was changed in the file is an edit', () => {
  const good = entryFor(V1, { hook: { question: 'q' } });
  const otherVariant: ReviewEntry = { ...good, variantId: V2 };
  const otherLesson: ReviewEntry = { ...good, lessonId: 'kbl-other' };
  const result = verifyReviewEntries([good, otherVariant, otherLesson]);
  assert.deepEqual(result.approvable, [good]);
  assert.deepEqual(result.edited, [otherVariant, otherLesson]);
  assert.equal(result.malformed, 0);
});

test('a variantId that is not a uuid is malformed, even with a matching hash', () => {
  const content = { hook: { question: 'q' } };
  const bad: ReviewEntry = { variantId: 'v-1', lessonId: 'kbl-x', lesson: 'x', contentHash: hashContent('v-1', 'kbl-x', content), content };
  const trailing: ReviewEntry = { ...bad, variantId: `${V1} `, contentHash: hashContent(`${V1} `, 'kbl-x', content) };
  assert.deepEqual(verifyReviewEntries([bad, trailing]), { approvable: [], edited: [], malformed: 2 });
  // Upper-case uuids are fine: the server lower-cases them.
  const upper = entryFor(V1.toUpperCase(), content);
  assert.equal(verifyReviewEntries([upper]).approvable.length, 1);
});

test('an entry with no content key is malformed, not a TypeError', () => {
  const noContent = { variantId: V1, lessonId: 'kbl-x', lesson: 'x', contentHash: 'abc' };
  assert.doesNotThrow(() => verifyReviewEntries([noContent]));
  assert.deepEqual(verifyReviewEntries([noContent]), { approvable: [], edited: [], malformed: 1 });
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

test('--approve refuses to be combined with flags it would silently ignore', () => {
  for (const other of ['--go', '--force', '--only=lesson-teaching', '--review=x.json', '--only', '--review']) {
    assert.throws(
      () => assertApproveAlone(['--approve=pregen-review.json', other]),
      new RegExp(`--approve.*${other.split('=')[0]}`),
      other,
    );
  }
  // Order does not matter.
  assert.throws(() => assertApproveAlone(['--go', '--approve=f.json']), /--approve.*--go/);
});

test('--approve alone, or no --approve, is allowed; --cap is not a conflict', () => {
  assert.doesNotThrow(() => assertApproveAlone(['--approve=pregen-review.json']));
  assert.doesNotThrow(() => assertApproveAlone(['--go', '--only=lesson-teaching', '--force']));
  assert.doesNotThrow(() => assertApproveAlone([]));
});

test('--approve with no file is an error, not a silent dry run', () => {
  assert.throws(() => assertApproveAlone(['--approve']), /--approve needs a file/);
  assert.throws(() => assertApproveAlone(['--approve=']), /--approve needs a file/);
});

test('--only accepts the three kinds and nothing else', () => {
  assert.equal(parseOnly([]), undefined);
  assert.equal(parseOnly(['--go']), undefined);
  assert.equal(parseOnly(['--only=worksheet']), 'worksheet');
  assert.equal(parseOnly(['--only=lesson-plan']), 'lesson-plan');
  assert.equal(parseOnly(['--go', '--only=lesson-teaching']), 'lesson-teaching');
  for (const bad of ['--only=lesson-teachin', '--only=', '--only=Worksheet', '--only', '--only=teaching']) {
    assert.throws(() => parseOnly([bad]), /--only.*worksheet.*lesson-plan.*lesson-teaching/s, bad);
  }
});

test('credentials: an email and password, or a session token for an account with no password', () => {
  const base = { PREGEN_API_BASE: 'https://api.example/' };
  assert.deepEqual(
    readCredentials({ ...base, PREGEN_EMAIL: 'a@b.c', PREGEN_PASSWORD: 'pw' }),
    { base: 'https://api.example', email: 'a@b.c', password: 'pw' },
  );
  assert.deepEqual(
    readCredentials({ ...base, PREGEN_TOKEN: ' tok ' }),
    { base: 'https://api.example', token: 'tok' },
  );
  // A token wins when both are set: someone who pasted one meant it.
  assert.deepEqual(
    readCredentials({ ...base, PREGEN_EMAIL: 'a@b.c', PREGEN_PASSWORD: 'pw', PREGEN_TOKEN: 'tok' }),
    { base: 'https://api.example', token: 'tok' },
  );
  assert.throws(() => readCredentials({ PREGEN_TOKEN: 'tok' }), /PREGEN_API_BASE/);
  assert.throws(() => readCredentials({ ...base, PREGEN_EMAIL: 'a@b.c' }), /PREGEN_PASSWORD.*PREGEN_TOKEN/s);
  assert.throws(() => readCredentials(base), /PREGEN_EMAIL.*PREGEN_TOKEN/s);
});
