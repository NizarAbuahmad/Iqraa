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

// Slides Maker draws a concept with a `shape` and its prompt asks for the points
// to be a two-line summary of it. A student sees only the points, so without the
// shape's own words a «دورة الماء» card would show a summary and lose its stages.
test('a concept with a cycle shows its stages after the summary', () => {
  const [card] = buildExplanationCards({
    concepts: [{
      title: 'الماء يدور بين الأرض والجو',
      points: ['الماء يتبخر ثم يعود مطرًا', 'وتتكرر الدورة'],
      shape: { layout: 'cycle', cycle: { stages: [{ label: 'تبخر', note: 'بفعل الحرارة' }, { label: 'تكاثف' }, { label: 'هطول' }] } },
    }],
  });
  assert.deepEqual(card, {
    kind: 'concept',
    title: 'الماء يدور بين الأرض والجو',
    points: ['الماء يتبخر ثم يعود مطرًا', 'وتتكرر الدورة', 'تبخر — بفعل الحرارة', 'تكاثف', 'هطول'],
  });
});

test('every shape the gate draws adds its words, and the points stay first', () => {
  const shapes: Record<string, [Record<string, unknown>, string[]]> = {
    compare: [{ layout: 'compare', compare: { leftTitle: 'ذرة', left: ['متعادلة'], rightTitle: 'أيون', right: ['مشحون'] } }, ['ذرة: متعادلة', 'أيون: مشحون']],
    table: [{ layout: 'table', table: { headers: ['س', 'ص'], rows: [['١', '٢'], ['٣', '٤']] } }, ['س: ١ — ص: ٢', 'س: ٣ — ص: ٤']],
    flow: [{ layout: 'flow', flow: { steps: ['أ', 'ب', 'ج'] } }, ['أ', 'ب', 'ج']],
    timeline: [{ layout: 'timeline', timeline: [{ label: '١', text: 'أول' }, { label: '٢', text: 'ثان' }, { label: '٣', text: 'ثالث' }] }, ['١ — أول', '٢ — ثان', '٣ — ثالث']],
    stat: [{ layout: 'stat', stat: { value: '6.022×10²³', label: 'عدد أفوجادرو' } }, ['6.022×10²³ — عدد أفوجادرو']],
    tree: [{ layout: 'tree', tree: { root: 'المادة', branches: [{ label: 'نقية', leaves: ['عنصر'] }, { label: 'مخلوط', leaves: null }] } }, ['المادة', 'نقية — عنصر', 'مخلوط']],
    venn: [{ layout: 'venn', venn: { sets: [{ label: 'فلزات', only: ['موصلة'] }, { label: 'لافلزات', only: [] }], shared: ['عناصر'] } }, ['فلزات — موصلة', 'لافلزات', 'عناصر']],
    mindmap: [{ layout: 'mindmap', mindmap: { center: 'التلوث', nodes: [{ text: 'مصانع', role: 'cause' }, { text: 'أمراض', role: 'effect' }, { text: 'حلول' }] } }, ['التلوث', 'مصانع', 'أمراض', 'حلول']],
  };
  for (const [name, [shape, words]] of Object.entries(shapes)) {
    const [card] = buildExplanationCards({ concepts: [{ title: 'فكرة', points: ['ملخص'], shape }] });
    assert.deepEqual(card, { kind: 'concept', title: 'فكرة', points: ['ملخص', ...words] }, name);
  }
});

test('a refused or unknown shape adds nothing: the card is just its points', () => {
  const bad: Record<string, unknown>[] = [
    { layout: 'cycle', cycle: { stages: [{ label: 'أ' }, { label: 'ب' }] } },                                  // too few stages
    { layout: 'cycle', cycle: { stages: [{ label: 'أ' }, { label: 'أ' }, { label: 'ب' }] } },                  // repeated label
    { layout: 'tree', tree: { root: 'ر', branches: [{ label: 'أ' }] } },                                       // one branch
    { layout: 'bogus', bogus: ['x', 'y', 'z'] },                                                               // not a layout
    { layout: 'statement', statement: 'x' },                                                                   // a layout, but not one a concept may take
    { layout: 'cycle' },                                                                                       // no payload
  ];
  for (const shape of bad) {
    const [card] = buildExplanationCards({ concepts: [{ title: 'فكرة', points: ['ملخص'], shape }] });
    assert.deepEqual(card, { kind: 'concept', title: 'فكرة', points: ['ملخص'] }, JSON.stringify(shape));
  }
  for (const shape of [null, 'cycle', 7, []] as never[]) {
    const [card] = buildExplanationCards({ concepts: [{ title: 'فكرة', points: ['ملخص'], shape }] });
    assert.deepEqual(card, { kind: 'concept', title: 'فكرة', points: ['ملخص'] });
  }
});

test('numbers inside a shape do not throw and are not lost', () => {
  const card = (shape: Record<string, unknown>) =>
    buildExplanationCards({ concepts: [{ title: 'فكرة', points: ['ملخص'], shape }] } as never)[0];
  assert.deepEqual(card({ layout: 'stat', stat: { value: 5, label: 'قوانين' } }), { kind: 'concept', title: 'فكرة', points: ['ملخص', '5 — قوانين'] });
  assert.deepEqual(
    card({ layout: 'compare', compare: { leftTitle: 1, left: ['أ'], rightTitle: 2, right: ['ب'] } }),
    { kind: 'concept', title: 'فكرة', points: ['ملخص', '1: أ', '2: ب'] },
  );
  assert.deepEqual(
    card({ layout: 'table', table: { headers: ['س', 'ص'], rows: [[1, 2], [3, 4]] } }),
    { kind: 'concept', title: 'فكرة', points: ['ملخص', 'س: 1 — ص: 2', 'س: 3 — ص: 4'] },
  );
  assert.deepEqual(
    card({ layout: 'timeline', timeline: [{ label: 1948, text: 'أ' }, { label: 1967, text: 'ب' }, { label: 1994, text: 'ج' }] }),
    { kind: 'concept', title: 'فكرة', points: ['ملخص', '1948 — أ', '1967 — ب', '1994 — ج'] },
  );
});

test('a shape that makes the gate throw leaves the card as its points, not a crash', () => {
  // A getter that throws stands in for any future quirk in the gate.
  const shape = { layout: 'cycle', get cycle(): never { throw new Error('boom'); } };
  assert.deepEqual(
    buildExplanationCards({ concepts: [{ title: 'فكرة', points: ['ملخص'], shape }] } as never),
    [{ kind: 'concept', title: 'فكرة', points: ['ملخص'] }],
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

// A dash or a parenthesised number in front of maths is part of the maths:
// stripping it after review would change what a student reads. Only strip when
// what follows is plain words (an Arabic letter, say).
test('stripMarker keeps a dash or «(N)» that belongs to the maths after it', () => {
  for (const t of ['- 3x = 6', '– 5 °C', '— 7 = x', '(2) + (3) = 5', '(2) × (3)', '- x = 4', '- (x + 1)', '- + 3', '(1) = 1', '- 2 mol', '(2)(3)', '(2) ^ 2', '- /2', '- ÷ 2', '- − 3']) {
    assert.equal(stripMarker(t), t, t);
  }
});

test('stripMarker still removes a dash or «(N)» in front of words', () => {
  assert.equal(stripMarker('- اقسم الطرفين'), 'اقسم الطرفين');
  assert.equal(stripMarker('(1) اقسم'), 'اقسم');
  assert.equal(stripMarker('– المول وحدة عدّ'), 'المول وحدة عدّ');
  assert.equal(stripMarker('— اجمع'), 'اجمع');
  assert.equal(stripMarker('(٢) اضرب'), 'اضرب');
});

test('bullets and «N.» / «N)» markers keep their behaviour in front of maths', () => {
  assert.equal(stripMarker('• 3x = 6'), '3x = 6');
  assert.equal(stripMarker('* x = 4'), 'x = 4');
  assert.equal(stripMarker('1. 3x = 6'), '3x = 6');
  assert.equal(stripMarker('2) x = 4'), 'x = 4');
});
