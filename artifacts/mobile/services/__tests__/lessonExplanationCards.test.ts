import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExplanationCards } from '../lessonExplanationCards.ts';

const full = {
  hook: { question: ' ما الذي يربط عدد الجسيمات بالكتلة؟ ' },
  concepts: [
    { title: 'المول وحدة عدّ', points: ['المول = 6.022×10²³ جسيمًا', ' ', 'مثال: 12 g من الكربون'], misconception: 'المول ليس كتلة' },
    { title: 'الكتلة المولية', points: ['كتلة مول واحد بالغرام'] },
  ],
  workedExample: { problem: 'كم مولًا في 24 g من الكربون؟', steps: ['n = m / M', 'n = 24 / 12'], answer: '2 mol' },
  practice: { problem: 'كم مولًا في 36 g من الكربون؟', hint: 'اقسم على 12', answer: '3 mol' },
};

test('a full artifact becomes hook, concepts, example and practice, in that order', () => {
  const cards = buildExplanationCards(full);
  assert.deepEqual(cards.map(c => c.kind), ['hook', 'concept', 'concept', 'example', 'practice']);
  assert.deepEqual(cards[0], { kind: 'hook', text: 'ما الذي يربط عدد الجسيمات بالكتلة؟' });
});

test('blank points are dropped and a misconception is kept only when present', () => {
  const [, first, second] = buildExplanationCards(full);
  assert.deepEqual(first, {
    kind: 'concept',
    title: 'المول وحدة عدّ',
    points: ['المول = 6.022×10²³ جسيمًا', 'مثال: 12 g من الكربون'],
    misconception: 'المول ليس كتلة',
  });
  assert.equal('misconception' in second!, false);
});

test('an artifact with no worked example simply has no example card', () => {
  const cards = buildExplanationCards({ ...full, workedExample: undefined });
  assert.deepEqual(cards.map(c => c.kind), ['hook', 'concept', 'concept', 'practice']);
});

test('practice keeps hint and answer only when they exist', () => {
  const cards = buildExplanationCards({ practice: { problem: 'مسألة', hint: '  ', answer: undefined } });
  assert.deepEqual(cards, [{ kind: 'practice', problem: 'مسألة' }]);
});

test('nothing usable gives no cards, so the screen can say so instead of rendering blank', () => {
  assert.deepEqual(buildExplanationCards(null), []);
  assert.deepEqual(buildExplanationCards({}), []);
  assert.deepEqual(buildExplanationCards({ concepts: [], hook: { question: '   ' } }), []);
  // A concept with no title is not a card: a title is the idea itself.
  assert.deepEqual(buildExplanationCards({ concepts: [{ points: ['x'] }] }), []);
});

test('malformed stored content is skipped, not thrown on, and valid siblings survive', () => {
  // The artifact is JSON read back from storage, not a shape the compiler checked.
  const hook = { question: 'سؤال' };
  assert.deepEqual(buildExplanationCards({ hook, concepts: { title: 'ليس قائمة' } } as never), [{ kind: 'hook', text: 'سؤال' }]);
  assert.deepEqual(buildExplanationCards({ hook, concepts: 7 } as never), [{ kind: 'hook', text: 'سؤال' }]);
  // A null entry is skipped; the valid concept beside it is kept.
  assert.deepEqual(
    buildExplanationCards({ concepts: [null, { title: 'مفهوم', points: ['نقطة'] }] } as never),
    [{ kind: 'concept', title: 'مفهوم', points: ['نقطة'] }],
  );
  // Non-string points are dropped; the string point is kept.
  assert.deepEqual(
    buildExplanationCards({ concepts: [{ title: 'مفهوم', points: [null, 3, { a: 1 }, 'نقطة'] }] } as never),
    [{ kind: 'concept', title: 'مفهوم', points: ['نقطة'] }],
  );
});
