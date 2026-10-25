/**
 * The grammar engine pieces Grade 2 added (spec: docs/superpowers/specs/2026-10-19-english-corner-grammar-g2-design.md):
 * word forms, the optional Choose, the `yesNo` pattern field, grade helpers and the spoken-string list.
 * The units here are inline, so these hold whatever data the grades carry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allGrammarSpoken, buildCap, comparativeOf, grammarUnitsForGrade, pastTense, pluralOf, presentParticiple, superlativeOf, thirdPerson, unitGrade, unitSentences,
  withArticle, type GrammarItem, type GrammarUnit,
} from '../englishGrammar.ts';

test('Grade 2 word forms: irregular plurals, words with no article, a/an', () => {
  for (const [word, plural] of [
    ['mouse', 'mice'], ['fish', 'fish'], ['potato', 'potatoes'], ['tomato', 'tomatoes'], ['shelf', 'shelves'],
    ['tortoise', 'tortoises'], ['cat', 'cats'], ['eggs', 'eggs'], ['scissors', 'scissors'], ['shoes', 'shoes'],
    ['shorts', 'shorts'], ['trousers', 'trousers'], ['rice', 'rice'], ['milk', 'milk'], ['pencil case', 'pencil cases'],
  ] as const) assert.equal(pluralOf(word), plural, word);
  for (const [word, phrase] of [
    ['action figure', 'an action figure'], ['T-shirt', 'a T-shirt'], ['mouse', 'a mouse'], ['fish', 'a fish'],
    ['rice', 'rice'], ['bread', 'bread'], ['cheese', 'cheese'], ['chicken', 'chicken'], ['juice', 'juice'],
    ['water', 'water'], ['scissors', 'scissors'], ['shorts', 'shorts'], ['trousers', 'trousers'], ['eggs', 'eggs'],
  ] as const) assert.equal(withArticle(word), phrase, word);
});

const MATCH_UNIT: GrammarUnit = {
  lessonId: 'kbl-g2-eng-s1-nccd-u1_l1',
  reviewedBy: null,
  patterns: [
    { id: 'is', text: 'Is it {a:p}? Yes, it is.', picture: 'p', yesNo: { kind: 'match', question: 'Is it {a:p}?', yes: 'Yes, it is.', no: "No, it isn't." } },
    { id: 'this', text: "What's this? It's {a:p}.", picture: 'p', choose: { kind: 'slot', slot: 'p' } },
  ],
  // robot's next pictured word skips «action figure» (no picture) and wraps to «car».
  slots: { p: ['car', 'plane', 'robot', 'action figure'] },
};

test('a match pattern asks about the picture, and its No question names the next pictured word', () => {
  const sentences = unitSentences(MATCH_UNIT).filter(s => s.patternId === 'is');
  const car = sentences.find(s => s.picture?.word === 'car')!;
  assert.equal(car.text, 'Is it a car? Yes, it is.');
  assert.deepEqual(car.yesNo, { kind: 'match', question: 'Is it a car?', otherQuestion: 'Is it a plane?', yes: 'Yes, it is.', no: "No, it isn't.", answer: true, hint: null });
  assert.equal(sentences.find(s => s.picture?.word === 'robot')!.yesNo!.otherQuestion, 'Is it a car?');
  // An unpictured word cannot be asked about: no yesNo, no picture.
  const figure = sentences.find(s => s.text.includes('action figure'))!;
  assert.equal(figure.text, 'Is it an action figure? Yes, it is.');
  assert.equal(figure.picture, null);
  assert.equal(figure.yesNo, null);
  for (const s of sentences) assert.ok(s.text.startsWith(s.yesNo?.question ?? s.text), s.key);
});

test('a pattern with yesNo gives no Choose and no True or false item; one without it still does', () => {
  for (const s of unitSentences(MATCH_UNIT).filter(x => x.patternId === 'is')) {
    assert.equal(s.choose, null, s.key);
    assert.equal(s.falsePicture, null, s.key);
  }
  const plain = unitSentences(MATCH_UNIT).filter(s => s.patternId === 'this' && s.picture);
  assert.ok(plain.length > 0);
  assert.ok(plain.every(s => s.choose && s.falsePicture && s.yesNo === null));
});

const MARKER_UNIT: GrammarUnit = {
  lessonId: 'kbl-g2-eng-s2-nccd-u6_l1',
  reviewedBy: null,
  patterns: [
    { id: 'ylike', text: 'Do you like {s:f}? Yes, I do.', picture: 'f', marker: 'yes', yesNo: { kind: 'marker', question: 'Do you like {s:f}?', yes: 'Yes, I do.', no: "No, I don't." } },
    { id: 'ydont', text: "Do you like {s:f}? No, I don't.", picture: 'f', marker: 'no', yesNo: { kind: 'marker', question: 'Do you like {s:f}?', yes: 'Yes, I do.', no: "No, I don't." } },
  ],
  slots: { f: ['apple', 'cheese', 'potato'] },
};

test('a marker pattern answers from its own ✅ / ❌', () => {
  const sentences = unitSentences(MARKER_UNIT);
  const yes = sentences.find(s => s.patternId === 'ylike' && s.picture?.word === 'potato')!;
  assert.equal(yes.text, 'Do you like potatoes? Yes, I do.');
  assert.deepEqual(yes.yesNo, { kind: 'marker', question: 'Do you like potatoes?', otherQuestion: null, yes: 'Yes, I do.', no: "No, I don't.", answer: true, hint: 'likes' });
  const no = sentences.find(s => s.patternId === 'ydont' && s.picture?.word === 'cheese')!;
  assert.equal(no.text, "Do you like cheese? No, I don't.");
  assert.equal(no.yesNo!.answer, false);
});

test('every spoken string of a yesNo sentence is listed: the question, the exchange, the No exchange', () => {
  const all = new Set(allGrammarSpoken());
  // The inline units are not in GRAMMAR_UNITS, so check the rule on the data that is.
  const withYesNo = grammarUnitsForGrade(2).flatMap(u => unitSentences(u)).filter(s => s.yesNo);
  for (const s of withYesNo) {
    assert.ok(all.has(s.text), s.text);
    assert.ok(all.has(s.yesNo!.question), s.yesNo!.question);
    if (s.yesNo!.otherQuestion) {
      assert.ok(all.has(s.yesNo!.otherQuestion), s.yesNo!.otherQuestion);
      assert.ok(all.has(`${s.yesNo!.otherQuestion} ${s.yesNo!.no}`), s.yesNo!.otherQuestion);
    }
  }
});

test('the grade helpers read the grade off the lesson', () => {
  assert.equal(unitGrade(MATCH_UNIT), 2);
  assert.equal(grammarUnitsForGrade(1).length, 9);
  assert.ok(grammarUnitsForGrade(1).every(u => unitGrade(u) === 1));
  assert.ok(grammarUnitsForGrade(5).every(u => unitGrade(u) === 5));
  assert.deepEqual(grammarUnitsForGrade(6), []);
});

test('Grade 3 word forms: -es and -ies plurals, plural-form words, uncountables', () => {
  for (const [word, plural] of [
    ['torch', 'torches'], ['mango', 'mangoes'], ['ice lolly', 'ice lollies'], ['dress', 'dresses'], ['monkey', 'monkeys'],
    ['kiwi', 'kiwis'], ['baseball cap', 'baseball caps'], ['sheep', 'sheep'], ['glasses', 'glasses'], ['sandals', 'sandals'],
    ['trainers', 'trainers'], ['pyjamas', 'pyjamas'], ['keys', 'keys'],
  ] as const) assert.equal(pluralOf(word), plural, word);
  for (const [word, phrase] of [
    ['glasses', 'glasses'], ['sandals', 'sandals'], ['trainers', 'trainers'], ['pyjamas', 'pyjamas'], ['keys', 'keys'],
    ['shampoo', 'shampoo'], ['toothpaste', 'toothpaste'], ['sunscreen', 'sunscreen'],
    ['ice lolly', 'an ice lolly'], ['television', 'a television'], ['armchair', 'an armchair'],
  ] as const) assert.equal(withArticle(word), phrase, word);
});

test('third person and -ing: the first word is inflected unless the whole phrase is listed', () => {
  for (const [phrase, third] of [
    ['play', 'plays'], ['watch TV', 'watches TV'], ['read books', 'reads books'], ['have breakfast', 'has breakfast'],
    ['go to school', 'goes to school'], ['do homework', 'does homework'], ['roller skate', 'roller skates'],
    ['skateboard', 'skateboards'], ['get up', 'gets up'], ['brush', 'brushes'], ['fix', 'fixes'], ['study', 'studies'],
    ['play with my friends', 'plays with my friends'],
  ] as const) assert.equal(thirdPerson(phrase), third, phrase);
  for (const [phrase, ing] of [
    ['brush the horses', 'brushing the horses'], ['clean the cage', 'cleaning the cage'], ['collect the eggs', 'collecting the eggs'],
    ['fix the gate', 'fixing the gate'], ['milk the cows', 'milking the cows'], ['sweep the barn', 'sweeping the barn'],
    ['make', 'making'], ['run', 'running'], ['die', 'dying'],
  ] as const) assert.equal(presentParticiple(phrase), ing, phrase);
});

const VERB_UNIT: GrammarUnit = {
  lessonId: 'kbl-g3-eng-s1-nccd-u4_l1',
  reviewedBy: null,
  patterns: [
    { id: 'he', text: 'He {3:act}.', choose: { kind: 'form', slot: 'act' } },
    { id: 'dont', text: "He doesn't {v:act}.", choose: { kind: 'phrase', right: "doesn't", wrong: "don't" } },
  ],
  slots: { act: ['watch TV', 'play tennis', 'roller skate', 'have lunch', 'skateboard'] },
};

test('a verb phrase is one tile per word, and the form Choose blanks the one word that changes', () => {
  const he = unitSentences(VERB_UNIT).filter(s => s.patternId === 'he');
  const by = (text: string) => he.find(s => s.text === text)!;
  assert.deepEqual(by('He watches TV.').tokens, ['He', 'watches', 'TV.']);
  assert.deepEqual(by('He watches TV.').choose, { kind: 'form', start: 1, length: 1, right: 'watches', wrong: 'watch' });
  assert.deepEqual(by('He has lunch.').choose, { kind: 'form', start: 1, length: 1, right: 'has', wrong: 'have' });
  assert.deepEqual(by('He roller skates.').tokens, ['He', 'roller', 'skates.']);
  assert.deepEqual(by('He roller skates.').choose, { kind: 'form', start: 2, length: 1, right: 'skates', wrong: 'skate' });
  // The verb last in the sentence: the full stop stays off the options.
  assert.deepEqual(by('He skateboards.').choose, { kind: 'form', start: 1, length: 1, right: 'skateboards', wrong: 'skateboard' });
  const dont = unitSentences(VERB_UNIT).find(s => s.patternId === 'dont' && s.text.includes('have'))!;
  assert.deepEqual(dont.tokens, ['He', "doesn't", 'have', 'lunch.']);
  for (const s of he) {
    const blanked = s.tokens.slice(s.choose!.start, s.choose!.start + s.choose!.length).join(' ').replace(/[.?!,]+$/, '');
    assert.equal(blanked, s.choose!.right, s.text);
    assert.notEqual(s.choose!.right, s.choose!.wrong, s.text);
  }
});

test('rows replace the cross-product, and a slot used twice takes the same value', () => {
  const unit: GrammarUnit = {
    lessonId: 'kbl-g3-eng-s1-nccd-u2_l1',
    reviewedBy: null,
    patterns: [{
      id: 'when',
      text: 'When do you {v:act}? We {v:act} {pre} {time}.',
      rows: [{ act: 'go home', pre: 'in the', time: 'afternoon' }, { act: 'go to bed', pre: 'at', time: 'night' }],
      choose: { kind: 'phrase', right: 'do', wrong: 'does' },
    }],
    slots: { act: ['go home', 'go to bed', 'get up'] },
  };
  assert.deepEqual(unitSentences(unit).map(s => s.text), [
    'When do you go home? We go home in the afternoon.',
    'When do you go to bed? We go to bed at night.',
  ]);
  assert.equal(new Set(unitSentences(unit).map(s => s.key)).size, 2);
});

const FACT_UNIT: GrammarUnit = {
  lessonId: 'kbl-g3-eng-s2-nccd-u10_l1',
  reviewedBy: null,
  patterns: [
    { id: 'y', text: 'Can {s:animal} {ability}? Yes, they can.', picture: 'animal', marker: 'many', rows: [{ animal: 'penguin', ability: 'swim' }],
      yesNo: { kind: 'fact', question: 'Can {s:animal} {ability}?', yes: 'Yes, they can.', no: "No, they can't.", answer: true } },
    { id: 'n', text: "Can {s:animal} {ability}? No, they can't.", picture: 'animal', marker: 'many', rows: [{ animal: 'penguin', ability: 'fly' }],
      yesNo: { kind: 'fact', question: 'Can {s:animal} {ability}?', yes: 'Yes, they can.', no: "No, they can't.", answer: false } },
    { id: 'there', text: 'Is there {a:food}? No, there isn\'t.', picture: 'food', marker: 'no', rows: [{ food: 'coconut' }],
      yesNo: { kind: 'marker', question: 'Is there {a:food}?', yes: 'Yes, there is.', no: "No, there isn't.", hint: 'there' } },
  ],
  slots: {},
};

test('a fact Yes or No answers from its own row, with no marker and no hint', () => {
  const [yes, no, there] = unitSentences(FACT_UNIT);
  assert.equal(yes.text, 'Can penguins swim? Yes, they can.');
  assert.deepEqual(yes.picture, { word: 'penguin', count: 2 });
  assert.deepEqual(yes.yesNo, { kind: 'fact', question: 'Can penguins swim?', otherQuestion: null, yes: 'Yes, they can.', no: "No, they can't.", answer: true, hint: null });
  assert.equal(no.yesNo!.answer, false);
  assert.equal(yes.choose, null);
  assert.equal(yes.falsePicture, null);
  assert.equal(there.yesNo!.hint, 'there');
  assert.equal(there.yesNo!.answer, false);
});

test('Build: a cap by grade; a long question-and-answer pair builds its answer half; nothing else is dropped silently', () => {
  assert.equal(buildCap(1), 7);
  assert.equal(buildCap(2), 7);
  assert.equal(buildCap(3), 9);
  const unit = (lessonId: string, texts: string[]): GrammarUnit => ({
    lessonId, reviewedBy: null, slots: {}, patterns: texts.map((text, i) => ({ id: `p${i}`, text })),
  });
  const g3 = unitSentences(unit('kbl-g3-eng-s1-nccd-u2_l1', [
    'When do you go home? We go home in the afternoon.',
    'We have dinner.',
    'I get up and I wash and I eat and I go to school now.',
    'Hello.',
  ]));
  assert.deepEqual(g3[0].build, { tokens: ['We', 'go', 'home', 'in', 'the', 'afternoon.'], text: 'We go home in the afternoon.', prompt: 'When do you go home?' });
  assert.deepEqual(g3[1].build, { tokens: ['We', 'have', 'dinner.'], text: 'We have dinner.', prompt: null });
  assert.equal(g3[2].build, null, 'over the cap with no question half');
  assert.equal(g3[3].build, null, 'one tile');
  // Grade 2 stays at 7: the same 8-token pair builds its answer half there.
  const g2 = unitSentences(unit('kbl-g2-eng-s1-nccd-u1_l1', ['Is it a plane or a car? No, it is a big red car.']));
  assert.equal(g2[0].build!.prompt, 'Is it a plane or a car?');
});

test('every spoken string of a Build prompt is listed', () => {
  const all = new Set(allGrammarSpoken());
  for (const s of grammarUnitsForGrade(2).flatMap(u => unitSentences(u))) {
    if (s.build?.prompt) assert.ok(all.has(s.build.prompt), s.build.prompt);
  }
});

test('comparatives and superlatives come from the explicit adjective table', () => {
  assert.equal(comparativeOf('high'), 'higher');
  assert.equal(superlativeOf('high'), 'highest');
  assert.equal(comparativeOf('wide'), 'wider');
  assert.equal(superlativeOf('deep'), 'deepest');
  assert.equal(comparativeOf('exciting'), 'more exciting');
  assert.equal(superlativeOf('dangerous'), 'most dangerous');
  assert.throws(() => comparativeOf('purple'), /no comparative/);
});

test('past tense: +ed, +d after e, doubling and irregulars by table, the verb is the first word', () => {
  assert.equal(pastTense('visit'), 'visited');
  assert.equal(pastTense('use'), 'used');
  assert.equal(pastTense('arrive'), 'arrived');
  assert.equal(pastTense('live'), 'lived');
  assert.equal(pastTense('stop'), 'stopped');
  assert.equal(pastTense('need'), 'needed');
  assert.equal(pastTense('work'), 'worked');
  assert.equal(pastTense('start'), 'started');
  assert.equal(pastTense('wear'), 'wore');
  assert.equal(pastTense('see'), 'saw');
  assert.equal(pastTense('get'), 'got');
  assert.equal(pastTense('go'), 'went');
  assert.equal(pastTense('carry'), 'carried');
  assert.equal(pastTense('visit the museum'), 'visited the museum');
});

const FORM_UNIT = (patterns: GrammarUnit['patterns'], slots: GrammarUnit['slots'] = {}): GrammarUnit =>
  ({ lessonId: 'kbl-g4-eng-s1-nccd-u4_l1', reviewedBy: null, patterns, slots });

test('a form Choose offers a real form: comparative against base, superlative against comparative, past against base, base against past', () => {
  const cmp = unitSentences(FORM_UNIT([{ id: 'c', text: 'The {big} is {cmp:adj} than the {small}.', rows: [{ big: 'mountain', small: 'hill', adj: 'high' }, { big: 'lion', small: 'rabbit', adj: 'dangerous' }], choose: { kind: 'form', slot: 'adj', wrong: 'base' } }]));
  assert.deepEqual(cmp.map(s => [s.text, s.choose!.right, s.choose!.wrong, s.choose!.start, s.choose!.length]), [
    ['The mountain is higher than the hill.', 'higher', 'high', 3, 1],
    ['The lion is more dangerous than the rabbit.', 'more dangerous', 'dangerous', 3, 2],
  ]);
  const sup = unitSentences(FORM_UNIT([{ id: 's', text: 'This is the {sup:adj} {n}.', rows: [{ adj: 'deep', n: 'lake' }], choose: { kind: 'form', slot: 'adj', wrong: 'comparative' } }]));
  assert.deepEqual([sup[0].choose!.right, sup[0].choose!.wrong], ['deepest', 'deeper']);
  const past = unitSentences(FORM_UNIT([
    { id: 'p', text: 'We {ed:verb} {o}.', rows: [{ verb: 'stop', o: 'there' }], choose: { kind: 'form', slot: 'verb', wrong: 'base' } },
    { id: 'n', text: "We didn't {v:verb} {o}.", rows: [{ verb: 'stop', o: 'there' }], choose: { kind: 'form', slot: 'verb', wrong: 'past' } },
  ]));
  assert.deepEqual([past[0].choose!.right, past[0].choose!.wrong], ['stopped', 'stop']);
  assert.deepEqual([past[1].choose!.right, past[1].choose!.wrong], ['stop', 'stopped']);
});

test('a form Choose without `wrong` is still the third-person diff, and a pattern with no form to choose throws', () => {
  const third = unitSentences(FORM_UNIT([{ id: 't', text: 'He {3:act}.', choose: { kind: 'form', slot: 'act' } }], { act: ['play tennis'] }));
  assert.deepEqual([third[0].text, third[0].choose!.right, third[0].choose!.wrong], ['He plays tennis.', 'plays', 'play']);
  assert.throws(() => unitSentences(FORM_UNIT([{ id: 'x', text: 'It is {adj}.', rows: [{ adj: 'high' }], choose: { kind: 'form', slot: 'adj', wrong: 'base' } }])), /no form of/);
});

test('a ranking row gives a true sentence, its swapped false twin, and a picture-free Yes or No fact', () => {
  const row = { big: 'mountain', small: 'hill', adj: 'high' };
  const unit = FORM_UNIT([
    { id: 'c', text: 'The {big} is {cmp:adj} than the {small}.', rows: [row], claim: { swap: ['big', 'small'] }, choose: { kind: 'form', slot: 'adj', wrong: 'base' } },
    { id: 'q', text: 'Is the {big} {cmp:adj} than the {small}? Yes, it is.', rows: [row], yesNo: { kind: 'fact', question: 'Is the {big} {cmp:adj} than the {small}?', yes: 'Yes, it is.', no: "No, it isn't.", answer: true } },
  ]);
  const [c, q] = unitSentences(unit);
  assert.equal(c.text, 'The mountain is higher than the hill.');
  assert.deepEqual(c.claim, { falseText: 'The hill is higher than the mountain.' });
  assert.equal(c.picture, null);
  assert.equal(c.falsePicture, null);
  assert.equal(q.picture, null);
  assert.deepEqual([q.yesNo!.kind, q.yesNo!.question, q.yesNo!.answer], ['fact', 'Is the mountain higher than the hill?', true]);
  assert.equal(q.claim, null);
  assert.ok(allGrammarSpoken().length > 0);
});

test('a pictured sentence has no claim, and a picture-free match Yes or No still needs a picture', () => {
  const g = unitSentences(FORM_UNIT([
    { id: 'm', text: 'Is it {a:thing}? Yes, it is.', yesNo: { kind: 'match', question: 'Is it {a:thing}?', yes: 'Yes, it is.', no: "No, it isn't." } },
  ], { thing: ['car'] }));
  assert.equal(g[0].yesNo, null);
  assert.equal(g[0].claim, null);
});

test('the Grade 9 adjectives have their forms', () => {
  for (const [adj, c, s] of [
    ['cheap', 'cheaper', 'cheapest'], ['healthy', 'healthier', 'healthiest'], ['tasty', 'tastier', 'tastiest'],
    ['expensive', 'more expensive', 'most expensive'], ['fattening', 'more fattening', 'most fattening'],
    ['filling', 'more filling', 'most filling'], ['nutritious', 'more nutritious', 'most nutritious'],
    ['popular', 'more popular', 'most popular'],
  ] as const) {
    assert.equal(comparativeOf(adj), c, adj);
    assert.equal(superlativeOf(adj), s, adj);
  }
});

test('a claim can swap two pairs of slots, so a capitalised first word swaps with its lower-case twin', () => {
  const [s] = unitSentences(FORM_UNIT([{
    id: 'c', text: '{bigC} are {cmp:adj} than {small}.',
    rows: [{ bigC: 'Carrots', big: 'carrots', smallC: 'Doughnuts', small: 'doughnuts', adj: 'healthy' }],
    claim: { swap: [['bigC', 'smallC'], ['big', 'small']] },
  }]));
  assert.equal(s.text, 'Carrots are healthier than doughnuts.');
  assert.deepEqual(s.claim, { falseText: 'Doughnuts are healthier than carrots.' });
});

// ─── Authored items (Grade 9; spec: docs/superpowers/specs/2026-10-23-english-corner-grammar-g9-lessons-design.md) ───

const itemUnit = (items: GrammarItem[]): GrammarUnit => ({ lessonId: 'kbl-g9-eng-s1-nccd-u1_l1', reviewedBy: null, patterns: [], slots: {}, items });
const anItem = (over: Partial<GrammarItem> = {}): GrammarItem => ({
  topic: 'now', text: 'Listen! The baby is crying.', answer: 'is crying', distractor: 'cries', kind: 'meaning', ...over,
});

test('an item becomes a picture-free sentence with a phrase Choose and a silent false twin', () => {
  const [s] = unitSentences(itemUnit([anItem()]));
  assert.equal(s.text, 'Listen! The baby is crying.');
  assert.equal(s.patternId, 'now');
  assert.equal(s.picture, null);
  assert.equal(s.yesNo, null);
  assert.equal(s.kind, 'meaning');
  assert.deepEqual(s.choose, { kind: 'phrase', start: 3, length: 2, right: 'is crying', wrong: 'cries' });
  assert.deepEqual(s.claim, { falseText: 'Listen! The baby cries.', voiced: false });
  assert.deepEqual(s.build, { tokens: ['Listen!', 'The', 'baby', 'is', 'crying.'], text: 'Listen! The baby is crying.', prompt: null });
});

test('an item keeps the sentence punctuation on the replaced words, mid-sentence and at the end', () => {
  const [mid, end] = unitSentences(itemUnit([
    anItem({ text: 'While I was walking, it started to rain.', answer: 'was walking', distractor: 'was walk', kind: 'form' }),
    anItem({ text: 'She enjoys reading.', answer: 'reading', distractor: 'to read', kind: 'form' }),
  ]));
  assert.equal(mid.claim!.falseText, 'While I was walk, it started to rain.');
  assert.equal(end.claim!.falseText, 'She enjoys to read.');
});

test('an item is refused when its answer is missing, repeated, or the same as its distractor', () => {
  assert.throws(() => unitSentences(itemUnit([anItem({ answer: 'is smiling' })])), /not in/);
  assert.throws(() => unitSentences(itemUnit([anItem({ text: 'It is a cat. It is a dog.', answer: 'is', distractor: 'was' })])), /more than once/);
  assert.throws(() => unitSentences(itemUnit([anItem({ distractor: 'is crying' })])), /differs/);
});

test('pattern sentences carry no kind and a voiced claim, so Grades 1–4 and Unit 4 are unchanged', () => {
  for (const grade of [2, 3, 4, 9]) for (const u of grammarUnitsForGrade(grade)) for (const s of unitSentences(u)) {
    if (u.items?.length) continue;
    assert.equal(s.kind, undefined, s.text);
    if (s.claim) assert.equal(s.claim.voiced, undefined, s.text);
  }
});
