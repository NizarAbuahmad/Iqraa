/**
 * Grade 3 grammar sentences (spec: docs/superpowers/specs/2026-10-21-english-corner-grammar-g3-design.md).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { grammarUnit, grammarUnitsForGrade, offeredGrammar, renderGrammarSheet, unitSentences } from '../englishGrammar.ts';
import { NOT_COVERED_G3 } from '../englishGrammarG3.ts';
import { hubLessonsForGrade } from '../englishHub.ts';
import { wordPicture } from '../englishPictures.ts';

const G3 = hubLessonsForGrade(3);
const UNITS = grammarUnitsForGrade(3);
const L = (sem: number, unit: number) => `kbl-g3-eng-s${sem}-nccd-u${unit}_l1`;
const order = new Map(G3.map((l, i) => [l.id, i]));
/** Slots that hold free text from the book's examples, not hub words: checked on the teacher's form instead. */
const FREE_SLOTS = new Set(['ability', 'pre', 'poss']);

test('the 8 Grade 3 hub lessons have a unit each, all unsigned, none offered', () => {
  assert.equal(G3.length, 8);
  assert.deepEqual(UNITS.map(u => u.lessonId), G3.map(l => l.id));
  for (const u of UNITS) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredGrammar(u.lessonId), null, u.lessonId);
    assert.ok(grammarUnit(u.lessonId));
  }
});

test('the generator produces the designed sentences: 324 in all', () => {
  const counts = new Map(UNITS.map(u => [u.lessonId, unitSentences(u).length]));
  assert.deepEqual([...counts], [
    [L(1, 2), 40], [L(1, 3), 34], [L(1, 4), 52], [L(1, 5), 22], [L(2, 7), 24], [L(2, 8), 54], [L(2, 9), 60], [L(2, 10), 38],
  ]);
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), 324);
});

test('slot words come from this lesson, an earlier Grade 3 lesson, or Grades 1–2; rows too, bar the free-text slots', () => {
  const earlier = new Set(hubLessonsForGrade(1).concat(hubLessonsForGrade(2)).flatMap(l => l.words.map(w => w.en)));
  for (const u of UNITS) {
    const allowed = new Set([...earlier, ...G3.slice(0, order.get(u.lessonId)! + 1).flatMap(l => l.words.map(w => w.en))]);
    for (const [slot, words] of Object.entries(u.slots)) for (const w of words) assert.ok(allowed.has(w), `${u.lessonId} ${slot}: ${w}`);
    for (const p of u.patterns) {
      for (const row of p.rows ?? []) {
        for (const [slot, w] of Object.entries(row)) if (!FREE_SLOTS.has(slot)) assert.ok(allowed.has(w), `${u.lessonId} ${p.id} row ${slot}: ${w}`);
      }
    }
  }
});

test('every sentence can be built, and none is dropped for length', () => {
  for (const u of UNITS) for (const s of unitSentences(u)) assert.ok(s.build, `${s.text} (${s.tokens.length} tiles)`);
});

test('a long question-and-answer pair builds its answer half, with the question as the prompt', () => {
  const routine = unitSentences(grammarUnit(L(1, 2))!).find(s => s.text === 'When do you go home? We go home in the afternoon.')!;
  assert.deepEqual(routine.build, { tokens: ['We', 'go', 'home', 'in', 'the', 'afternoon.'], text: 'We go home in the afternoon.', prompt: 'When do you go home?' });
  const halves = UNITS.flatMap(u => unitSentences(u)).filter(s => s.build?.prompt);
  assert.ok(halves.length > 10);
});

test('pictures only where the sentence is shown by them; Yes or No only on S2 U9 and U10', () => {
  for (const id of [L(1, 2), L(1, 4), L(2, 7), L(2, 8)]) {
    for (const s of unitSentences(grammarUnit(id)!)) {
      assert.equal(s.picture, null, `${id} ${s.text}`);
      assert.equal(s.yesNo, null, `${id} ${s.text}`);
    }
  }
  const withYesNo = UNITS.filter(u => unitSentences(u).some(s => s.yesNo)).map(u => u.lessonId);
  assert.deepEqual(withYesNo, [L(2, 9), L(2, 10)]);
  for (const u of UNITS) for (const s of unitSentences(u)) if (s.picture) assert.ok(wordPicture(s.picture.word), s.text);
});

test('the verb lessons ask for a verb form, and Choose has evidence in the sentence', () => {
  const kinds = (id: string) => new Set(unitSentences(grammarUnit(id)!).map(s => s.choose?.kind ?? 'none'));
  assert.ok(kinds(L(1, 4)).has('form'));
  const plays = unitSentences(grammarUnit(L(1, 4))!).find(s => s.text === 'He plays badminton.' || s.text === 'He plays tennis.')!;
  assert.deepEqual([plays.choose!.right, plays.choose!.wrong], ['plays', 'play']);
  for (const u of UNITS) for (const s of unitSentences(u)) {
    if (s.choose) assert.notEqual(s.choose.right, s.choose.wrong, s.text);
    if (s.choose) {
      const blanked = s.tokens.slice(s.choose.start, s.choose.start + s.choose.length).join(' ').replace(/[.?!,]+$/, '');
      assert.equal(blanked, s.choose.right, s.text);
    }
  }
});

test('the animal facts are exactly the ones the teacher is asked to check', () => {
  const facts = unitSentences(grammarUnit(L(2, 10))!).filter(s => s.yesNo?.kind === 'fact').map(s => s.text).sort();
  assert.deepEqual(facts, [
    "Can crocodiles fly? No, they can't.", 'Can crocodiles swim? Yes, they can.', "Can eagles fly? Yes, they can.",
    "Can elephants fly? No, they can't.", "Can elephants jump? No, they can't.", "Can giraffes fly? No, they can't.",
    "Can hippos fly? No, they can't.", "Can hippos jump? No, they can't.", 'Can hippos swim? Yes, they can.',
    'Can kangaroos jump? Yes, they can.', "Can monkeys climb? Yes, they can.", "Can monkeys fly? No, they can't.",
    "Can penguins fly? No, they can't.", 'Can penguins swim? Yes, they can.', 'Can tigers run? Yes, they can.',
    'Can zebras run? Yes, they can.',
  ].sort());
});

test('the not-covered table has an entry for every Grade 3 lesson and only for them, in form-safe text', () => {
  assert.deepEqual(Object.keys(NOT_COVERED_G3).sort(), G3.map(l => l.id).sort());
  for (const [id, items] of Object.entries(NOT_COVERED_G3)) {
    assert.ok(items.length > 0, id);
    for (const text of items) assert.ok(!/["&<>]/.test(text), `${id}: ${text}`);
  }
});

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'docs');

test("the Grade 3 teacher's form lists every sentence once, shows the Build half, and has a not-covered block per lesson", async () => {
  const { renderGrammarReviewHtml } = await import('../englishGrammarReview.ts');
  const html = renderGrammarReviewHtml(3);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const all = UNITS.flatMap(u => unitSentences(u));
  assert.equal(all.length, 324);
  assert.equal((html.match(/<td class="sentence"/g) ?? []).length, 324);
  for (const s of all) assert.ok(html.includes(esc(s.text)), s.text);
  assert.equal((html.match(/class="not-covered"/g) ?? []).length, 8);
  assert.equal((html.match(/<th>«نعم أم لا»/g) ?? []).length, 2, 'toys-like Yes or No columns: S2 U9 and U10');
  assert.equal((html.match(/class="build-half"/g) ?? []).length, all.filter(s => s.build?.prompt).length);
  assert.ok(html.includes('مراجعة قواعد الصف الثالث'));
  assert.ok(html.includes('Can penguins swim?'));
});

test('the committed Grade 3 sheet and form are exactly what the generators produce', async () => {
  const { renderGrammarReviewHtml } = await import('../englishGrammarReview.ts');
  assert.equal(readFileSync(path.join(docs, 'english-grammar-g3-sheet.md'), 'utf8'), renderGrammarSheet(3), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
  assert.equal(readFileSync(path.join(docs, 'english-grammar-g3-review.html'), 'utf8'), renderGrammarReviewHtml(3), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
});

test('a slot Choose offers whole phrases: «glasses» against «a dress», never against a bare article', () => {
  const wear = unitSentences(grammarUnit(L(1, 3))!).find(s => s.text === "You're wearing glasses." && s.patternId === 'you')!;
  assert.deepEqual([wear.choose!.right, wear.choose!.wrong], ['glasses', 'a dress']);
  for (const u of UNITS) for (const s of unitSentences(u)) {
    if (s.choose?.kind === 'slot') assert.ok(!/^(a|an)$/.test(s.choose.wrong), `${s.text}: ${s.choose.right} / ${s.choose.wrong}`);
  }
});
