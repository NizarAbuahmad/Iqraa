import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plannedCalls } from '../../scripts/pregenerate.ts';

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
