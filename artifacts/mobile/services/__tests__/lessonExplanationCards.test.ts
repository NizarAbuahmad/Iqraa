import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExplanationCards, stripMarker } from '../lessonExplanationCards.ts';

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

test('stripMarker removes one leading bullet or dash marker', () => {
  for (const marker of ['• ', '- ', '* ', '– ', '— ']) {
    assert.equal(stripMarker(`${marker}المول وحدة عدّ`), 'المول وحدة عدّ', marker);
  }
  assert.equal(stripMarker('•المول وحدة عدّ'), 'المول وحدة عدّ');
  assert.equal(stripMarker('  -   اقسم على 12  '), 'اقسم على 12');
});

test('stripMarker removes a leading number marker, Latin or Arabic-Indic', () => {
  assert.equal(stripMarker('1. اقسم'), 'اقسم');
  assert.equal(stripMarker('2) اضرب'), 'اضرب');
  assert.equal(stripMarker('(3) اجمع'), 'اجمع');
  assert.equal(stripMarker('١. اقسم'), 'اقسم');
  assert.equal(stripMarker('٢) اضرب'), 'اضرب');
  assert.equal(stripMarker('(٣) اجمع'), 'اجمع');
  assert.equal(stripMarker('۴. اقسم'), 'اقسم');
  assert.equal(stripMarker('12. اقسم'), 'اقسم');
});

test('stripMarker removes only ONE marker', () => {
  assert.equal(stripMarker('- 1. اقسم'), '1. اقسم');
  assert.equal(stripMarker('1. 2. اقسم'), '2. اقسم');
});

test('stripMarker leaves text with no marker alone', () => {
  for (const t of ['المول وحدة عدّ', 'n = m / M', 'x - 3 = 0', 'a * b', 'عدد * ثابت']) {
    assert.equal(stripMarker(t), t);
  }
  assert.equal(stripMarker(''), '');
  assert.equal(stripMarker('   '), '');
});

test('stripMarker keeps a number that is part of the sentence', () => {
  for (const t of ['2 mol من الكربون', '2.5 g من الماء', '2.5 g', '12 g من الكربون', '٢ مول من الماء', '1.5 مول', '10²³ جسيمًا', '2024. سنة', '2x + 1 = 5']) {
    assert.equal(stripMarker(t), t, t);
  }
});

test('stripMarker keeps a negative number or a sign glued to its operand', () => {
  for (const t of ['-3 + 5 = 2', '−3 + 5 = 2', '-x = 4', '*x', '–5 °C', '(2x + 1)(x - 3)', '(3)(x + 1)']) {
    assert.equal(stripMarker(t), t, t);
  }
});

test('a line that is only a marker becomes empty', () => {
  for (const t of ['-', '•', '1.', '(2)', '١)']) assert.equal(stripMarker(t), '', t);
});

test('points and steps lose a leading marker; a step already numbered is not numbered twice', () => {
  const [concept, example] = buildExplanationCards({
    concepts: [{ title: 'المول', points: ['• المول وحدة عدّ', '- الكتلة المولية', '2.5 g من الماء', '١. نقطة'] }],
    workedExample: { problem: 'مسألة', steps: ['1. اقسم', '2) اضرب', '- اجمع', 'n = 24 / 12', '2 mol'], answer: '2 mol' },
  } as never);
  assert.deepEqual((concept as { points: string[] }).points, ['المول وحدة عدّ', 'الكتلة المولية', '2.5 g من الماء', 'نقطة']);
  assert.deepEqual((example as { steps: string[] }).steps, ['اقسم', 'اضرب', 'اجمع', 'n = 24 / 12', '2 mol']);
});

test('a point or step that is only a marker is dropped like a blank', () => {
  const cards = buildExplanationCards({
    concepts: [{ title: 'ت', points: ['• ', 'نص'] }],
    workedExample: { problem: 'م', steps: ['1. ', 'خطوة'], answer: 'a' },
  } as never);
  assert.deepEqual((cards[0] as { points: string[] }).points, ['نص']);
  assert.deepEqual((cards[1] as { steps: string[] }).steps, ['خطوة']);
});

test('a hook, a problem, a hint, an answer and a misconception are shown as stored', () => {
  const cards = buildExplanationCards({
    hook: { question: '- ما المول؟' },
    concepts: [{ title: 'المول', points: ['a'], misconception: '1. ليس كتلة' }],
    workedExample: { problem: '1. كم مولًا؟', steps: ['x'], answer: '- 2 mol' },
    practice: { problem: '2) كم؟', hint: '- اقسم', answer: '3. 3 mol' },
  } as never);
  assert.deepEqual(cards, [
    { kind: 'hook', text: '- ما المول؟' },
    { kind: 'concept', title: 'المول', points: ['a'], misconception: '1. ليس كتلة' },
    { kind: 'example', problem: '1. كم مولًا؟', steps: ['x'], answer: '- 2 mol' },
    { kind: 'practice', problem: '2) كم؟', hint: '- اقسم', answer: '3. 3 mol' },
  ]);
});
