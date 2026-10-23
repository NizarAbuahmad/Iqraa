/**
 * Grade 9 grammar pilot, S1 U4 (spec: docs/superpowers/specs/2026-10-23-english-corner-grammar-g9-pilot-design.md).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ADJECTIVE_FORMS, allGrammarSpoken, grammarUnit, grammarUnitsForGrade, offeredGrammar, unitSentences,
} from '../englishGrammar.ts';
import { hubLessonsForGrade } from '../englishHub.ts';
import { G9_TABLES } from '../englishGrammarG9.ts';

const L = (unit: number, lesson: number) => `kbl-g9-eng-s1-nccd-u${unit}_l${lesson}`;
/** The pilot's two lessons; the thirteen authored lessons are tested in englishGrammarG9Items.test.ts. */
const UNITS = grammarUnitsForGrade(9).filter(u => /-u4_l[13]$/.test(u.lessonId));
const G9 = hubLessonsForGrade(9);
const order = new Map(G9.map((l, i) => [l.id, i]));
/** Slots that hold written row text, not hub words: checked on the teacher's form instead. */
const FREE_SLOTS = new Set(['big', 'small', 'bigC', 'smallC', 'x', 'n', 'where', 'a', 'b', 'be']);

test('S1 U4 has two units, comparatives and quantifiers, both unsigned, neither offered', () => {
  assert.deepEqual(UNITS.map(u => u.lessonId), [L(4, 1), L(4, 3)]);
  for (const u of UNITS) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredGrammar(u.lessonId), null, u.lessonId);
    assert.ok(grammarUnit(u.lessonId));
  }
});

test('slot words come from this lesson, an earlier Grade 9 lesson, or Grades 1–4; rows too, bar the written-text slots', () => {
  const earlier = new Set([1, 2, 3, 4].flatMap(g => hubLessonsForGrade(g)).flatMap(l => l.words.map(w => w.en)));
  for (const u of UNITS) {
    const allowed = new Set([...earlier, ...G9.slice(0, order.get(u.lessonId)! + 1).flatMap(l => l.words.map(w => w.en))]);
    for (const [slot, words] of Object.entries(u.slots)) for (const w of words) assert.ok(allowed.has(w), `${u.lessonId} ${slot}: ${w}`);
    for (const p of u.patterns) for (const row of p.rows ?? []) {
      for (const [slot, w] of Object.entries(row)) if (!FREE_SLOTS.has(slot)) assert.ok(allowed.has(w), `${u.lessonId} ${p.id} row ${slot}: ${w}`);
    }
  }
});

test('every sentence can be built within nine tiles, and no unit prints one sentence twice; nothing is pictured', () => {
  for (const u of UNITS) {
    const s = unitSentences(u);
    for (const x of s) {
      assert.ok(x.build, `${x.text} (${x.tokens.length} tiles)`);
      assert.equal(x.picture, null, x.text);
    }
    assert.equal(new Set(s.map(x => x.text)).size, s.length, u.lessonId);
  }
});

test('comparisons: a true sentence, its swapped false twin with the verb still agreeing, and picture-free Yes or No facts', () => {
  const s = unitSentences(grammarUnit(L(4, 1))!);
  const by = (id: string) => s.filter(x => x.patternId === id);
  const cmp = [...by('cmppl'), ...by('cmpmass')];
  assert.equal(cmp.length, 10);
  const trueTexts = new Set(cmp.map(x => x.text));
  for (const x of cmp) {
    assert.ok(x.claim && x.claim.falseText !== x.text, x.text);
    assert.ok(!trueTexts.has(x.claim!.falseText), `${x.text}: the twin is also a true row`);
  }
  assert.deepEqual(by('cmppl')[0].claim, { falseText: 'Doughnuts are healthier than carrots.' });
  assert.deepEqual(by('cmpmass')[0].claim, { falseText: 'Bread is more expensive than salmon.' });
  for (const id of ['ypl', 'ymass']) for (const x of by(id)) {
    assert.ok(x.yesNo!.kind === 'fact' && x.yesNo!.answer && x.picture === null, x.text);
  }
  for (const id of ['npl', 'nmass']) for (const x of by(id)) {
    assert.ok(x.yesNo!.kind === 'fact' && !x.yesNo!.answer && x.picture === null, x.text);
  }
  const yes = new Set([...by('ypl'), ...by('ymass')].map(x => x.yesNo!.question));
  for (const x of [...by('npl'), ...by('nmass')]) assert.ok(!yes.has(x.yesNo!.question), `${x.yesNo!.question} is asked as both yes and no`);
  assert.ok(s.some(x => x.text === 'Are croissants more fattening than melons? Yes, they are.'));
  assert.ok(s.some(x => x.text === "Is bread more expensive than salmon? No, it isn't."));
});

test('the opinion rows are never judged; the superlatives and the comparisons offer real forms', () => {
  const s = unitSentences(grammarUnit(L(4, 1))!);
  for (const x of s.filter(y => y.patternId === 'opinion')) assert.ok(x.claim === null && x.yesNo === null, x.text);
  const pair = (text: string) => { const x = s.find(y => y.text === text)!; return [x.choose!.right, x.choose!.wrong]; };
  assert.deepEqual(pair('Carrots are healthier than doughnuts.'), ['healthier', 'healthy']);
  assert.deepEqual(pair('Salmon is more expensive than bread.'), ['more expensive', 'expensive']);
  assert.deepEqual(pair('Pancakes are tastier than porridge.'), ['tastier', 'tasty']);
  assert.deepEqual(pair('Water is the cheapest drink in the café.'), ['cheapest', 'cheaper']);
  for (const x of s.filter(y => y.choose?.kind === 'form')) assert.notEqual(x.choose!.right, x.choose!.wrong, x.text);
  for (const p of grammarUnit(L(4, 1))!.patterns) for (const row of p.rows ?? []) if (row.adj) assert.ok(ADJECTIVE_FORMS[row.adj], row.adj);
});

test('quantifiers: the noun decides many / much and a few / a little; each food is in one class', () => {
  const s = unitSentences(grammarUnit(L(4, 3))!);
  assert.deepEqual(s.map(x => x.patternId).filter((id, i, a) => a.indexOf(id) === i), [
    'howmany', 'howmuch', 'notmany', 'notmuch', 'toomany', 'toomuch', 'qmany', 'qmuch', 'afew', 'alittle',
  ]);
  const pair = (text: string) => { const x = s.find(y => y.text === text)!; return [x.choose!.right, x.choose!.wrong]; };
  assert.deepEqual(pair('How many mushrooms are there?'), ['many', 'much']);
  assert.deepEqual(pair('How much cream is there?'), ['much', 'many']);
  assert.deepEqual(pair("I'd like a few grapes, please."), ['a few', 'a little']);
  assert.deepEqual(pair("I'd like a little honey, please."), ['a little', 'a few']);
  assert.ok(!s.some(x => /many (cream|honey|jam|salt|sugar|porridge|milk|rice)\b/.test(x.text)));
  assert.ok(!s.some(x => /much (grapes|olives|mushrooms|pancakes|doughnuts|croissants|muffins|carrots)\b/.test(x.text)));
  const all = [...G9_TABLES.foodCount, ...G9_TABLES.foodMass];
  assert.equal(new Set(all).size, all.length, 'a food is in two classes');
});

test('the false twin of every comparison is voiced', () => {
  const spoken = new Set(allGrammarSpoken());
  for (const x of unitSentences(grammarUnit(L(4, 1))!).filter(y => y.claim)) assert.ok(spoken.has(x.claim!.falseText), x.claim!.falseText);
});

test('the generator produces the designed sentences: 122 in all', () => {
  const counts = new Map(UNITS.map(u => [u.lessonId, unitSentences(u).length]));
  assert.deepEqual([...counts], [[L(4, 1), 42], [L(4, 3), 80]]);
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), 122);
  const longest = Math.max(...UNITS.flatMap(u => unitSentences(u)).map(x => x.tokens.length));
  assert.ok(longest <= 9, `the longest sentence is ${longest} words, over the Build cap`);
});

const docs = new URL('../../../../docs/', import.meta.url);

test('the Grade 9 form lists every sentence once (the pilot\'s 122 and the 520 authored), a data page for Unit 4, and a note per lesson', async () => {
  const { renderGrammarReviewHtml } = await import('../englishGrammarReview.ts');
  const html = renderGrammarReviewHtml(9);
  assert.equal((html.match(/<td class="sentence" dir="ltr">/g) ?? []).length, 122 + 520);
  assert.equal((html.match(/<section class="unit"/g) ?? []).length, 2 + 13);
  assert.equal((html.match(/<section class="data"/g) ?? []).length, 1);
  assert.equal((html.match(/<table class="data-table"/g) ?? []).length, 4);
  assert.ok(html.includes('مراجعة قواعد الصف التاسع'));
  for (const text of ['healthier', 'more expensive', 'cheapest', 'cream', 'rice', 'Pancakes are tastier than porridge.', 'Carrots are healthier than doughnuts.', 'Doughnuts are healthier than carrots.']) {
    assert.ok(html.includes(text), `the form lacks «${text}»`);
  }
  assert.ok(html.includes('<span class="yn yn-no" dir="ltr">Doughnuts are healthier than carrots.</span>'));
  assert.ok(html.includes('<span class="yn yn-yes" dir="ltr">Are carrots healthier than doughnuts? → Yes, they are.</span>'));
  // A note under each of the 15 unit pages, and one block for the book topics the hub has no lesson for.
  assert.equal((html.match(/class="not-covered"/g) ?? []).length, 2 + 13 + 1);
  // Grade 9's data page lists Grade 9's adjectives only, and Grade 4's lists its own.
  assert.ok(!html.includes('more colourful'));
});

test('the committed Grade 9 sheet and form are exactly what the generators produce; Grades 1-4 and the reading forms are untouched', async () => {
  const { renderGrammarSheet } = await import('../englishGrammar.ts');
  const { renderGrammarReviewHtml } = await import('../englishGrammarReview.ts');
  const { renderReadingReviewHtml } = await import('../englishReadingReview.ts');
  const read = (f: string) => readFileSync(new URL(f, docs), 'utf8');
  assert.equal(read('english-grammar-g9-sheet.md'), renderGrammarSheet(9), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
  assert.equal(read('english-grammar-g9-review.html'), renderGrammarReviewHtml(9), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
  for (const g of [1, 2, 3, 4]) {
    assert.equal(read(`english-grammar-g${g}-sheet.md`), renderGrammarSheet(g), `Grade ${g} sheet changed`);
    assert.equal(read(`english-grammar-g${g}-review.html`), renderGrammarReviewHtml(g), `Grade ${g} form changed`);
    assert.equal(read(`english-reading-g${g}-review.html`), renderReadingReviewHtml(g), `Grade ${g} reading form changed`);
  }
});
