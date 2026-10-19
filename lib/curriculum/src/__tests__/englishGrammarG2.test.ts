/**
 * Grade 2 grammar sentences (spec: docs/superpowers/specs/2026-10-19-english-corner-grammar-g2-design.md).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grammarUnit, grammarUnitsForGrade, offeredGrammar, unitSentences } from '../englishGrammar.ts';
import { NOT_COVERED_G2 } from '../englishGrammarG2.ts';
import { hubLessonsForGrade } from '../englishHub.ts';
import { wordPicture } from '../englishPictures.ts';

const G2 = hubLessonsForGrade(2);
const order = new Map(G2.map((l, i) => [l.id, i]));
const UNITS = grammarUnitsForGrade(2);
const L = (sem: number, unit: number) => `kbl-g2-eng-s${sem}-nccd-u${unit}_l1`;
/** Mirrors `MAX_BUILD_TILES` in the app's games.ts: a longer sentence is silently dropped from Build the sentence. */
const MAX_BUILD_TILES = 7;

test('the hub has nine Grade 2 lessons; eight have grammar, and S1 U3 has none', () => {
  assert.equal(G2.length, 9);
  assert.equal(UNITS.length, 8);
  for (const u of UNITS) assert.ok(order.has(u.lessonId), u.lessonId);
  assert.equal(grammarUnit(L(1, 3)), undefined);
});

test('a slot names only words of its own lesson or an earlier Grade 2 lesson', () => {
  for (const u of UNITS) {
    const allowed = new Set(G2.slice(0, order.get(u.lessonId)! + 1).flatMap(l => l.words.map(w => w.en)));
    for (const [slot, words] of Object.entries(u.slots)) {
      for (const w of words) assert.ok(allowed.has(w), `${u.lessonId} ${slot}: ${w}`);
    }
  }
});

test('the generator produces the counted sentences, none longer than the Build cap', () => {
  const counts = new Map(UNITS.map(u => [u.lessonId, unitSentences(u).length]));
  assert.deepEqual([...counts], [
    [L(1, 0), 16], [L(1, 1), 26], [L(1, 2), 31], [L(1, 4), 10], [L(2, 5), 20], [L(2, 6), 56], [L(2, 7), 17], [L(2, 8), 36],
  ]);
  for (const u of UNITS) {
    for (const s of unitSentences(u)) assert.ok(s.tokens.length <= MAX_BUILD_TILES, `${s.text} (${s.tokens.length})`);
  }
});

test('every picture exists, a false picture is another word, and a slot or whole choice has a picture', () => {
  for (const u of UNITS) {
    for (const s of unitSentences(u)) {
      assert.equal(s.tokens.join(' '), s.text, s.key);
      if (s.picture) assert.ok(wordPicture(s.picture.word), s.key);
      if (s.falsePicture) {
        assert.ok(wordPicture(s.falsePicture), s.key);
        assert.notEqual(s.falsePicture, s.picture?.word, s.key);
      }
      if (s.choose && s.choose.kind !== 'phrase') assert.ok(s.picture, `${s.key}: a ${s.choose.kind} choice with no picture`);
      if (s.choose) {
        const blanked = s.tokens.slice(s.choose.start, s.choose.start + s.choose.length).join(' ').replace(/[.?!,]+$/, '');
        assert.equal(blanked, s.choose.right, s.key);
        assert.notEqual(s.choose.right, s.choose.wrong, s.key);
      }
    }
  }
});

test('Yes or No: only toys and food ask it; a match question names the picture, a marker follows its mark', () => {
  const byUnit = new Map(UNITS.map(u => [u.lessonId, unitSentences(u).filter(s => s.yesNo)]));
  assert.deepEqual(
    [...byUnit].filter(([, ss]) => ss.length).map(([id, ss]) => [id, ss.length]),
    [[L(1, 1), 12], [L(2, 6), 28]],
  );
  for (const s of byUnit.get(L(1, 1))!) {
    const y = s.yesNo!;
    assert.equal(y.kind, 'match');
    assert.equal(y.question, `Is it a ${s.picture!.word}?`, s.key);
    assert.ok(s.text.startsWith(y.question), s.key);
    const other = /^Is it an? (.+)\?$/.exec(y.otherQuestion!)![1];
    assert.notEqual(other, s.picture!.word, s.key);
    assert.ok(wordPicture(other), s.key);
    assert.equal(y.answer, true);
  }
  const likes = byUnit.get(L(2, 6))!;
  assert.equal(likes.filter(s => s.yesNo!.answer).length, 14);
  assert.equal(likes.filter(s => !s.yesNo!.answer).length, 14);
  for (const s of likes) {
    assert.equal(s.yesNo!.kind, 'marker');
    assert.equal(s.yesNo!.answer, s.marker === 'yes', s.key);
    assert.equal(s.choose, null, s.key);
    assert.equal(s.falsePicture, null, s.key);
    assert.ok(s.text.startsWith(s.yesNo!.question), s.key);
  }
});

test('left-out words are in no slot', () => {
  const slotWords = new Map(UNITS.map(u => [u.lessonId, new Set(Object.values(u.slots).flat())]));
  assert.ok(!slotWords.get(L(2, 6))!.has('orange'), 'orange: its only picture is the colour');
  assert.ok(!slotWords.get(L(2, 8))!.has('balcony'), 'balcony: «on the balcony»');
  for (const words of slotWords.values()) {
    for (const w of ['swing', 'slide']) assert.ok(!words.has(w), w);
  }
  assert.ok(slotWords.get(L(1, 0))!.has('orange'), 'the colour orange stays in the Welcome unit');
});

test('the sentences the book uses come out word for word, and the wrong forms do not', () => {
  const texts = new Set(UNITS.flatMap(u => unitSentences(u).map(s => s.text)));
  for (const t of [
    "What's this? It's an action figure.", "What's this? It's a car.", 'Is it a car? Yes, it is.',
    'This is my pencil case.', 'These are my scissors.', 'These are my shelves.', 'These are my books.',
    "Who's this? It's my granny.", "He's got blue eyes.", "She's got green eyes.",
    "What's this? It's a fish.", "What are these? They're fish.", "What are these? They're mice.",
    "What are these? They're tortoises.", 'I like potatoes.', 'I like tomatoes.', 'I like rice.', "I don't like eggs.",
    'Do you like cheese? Yes, I do.', "Do you like milk? No, I don't.",
    "What's the weather like? It's cloudy.", "I'm wearing shorts.", "I'm wearing a T-shirt.", "I'm wearing a jumper.",
    "Where's my dad? He's in the kitchen.", "Where's my mum? She's in the living room.",
    "What colour is it? It's pink.", "How old are you? I'm seven.",
  ]) assert.ok(texts.has(t), t);
  for (const bad of [
    'This is my scissors.', 'These are my scissorss.', 'I like rices.', 'I like eggss.', "What are these? They're mouses.",
    'I like tomatos.', 'I like oranges.', "Where's my mum? He's in the kitchen.", "Where's my dad? She's in the kitchen.",
    "I'm wearing a shorts.", "What's this? It's a action figure.", "Is it a swing? Yes, it is.",
  ]) assert.ok(!texts.has(bad), bad);
});

test('every Grade 2 unit ships unsigned, so none is offered', () => {
  for (const u of UNITS) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredGrammar(u.lessonId), null, u.lessonId);
  }
});

test('the not-covered table has an entry for every Grade 2 lesson and only for them', () => {
  assert.deepEqual(Object.keys(NOT_COVERED_G2).sort(), G2.map(l => l.id).sort());
  for (const [id, items] of Object.entries(NOT_COVERED_G2)) {
    assert.ok(items.length > 0, id);
    // The form wraps English runs in spans without escaping entities: no markup characters.
    for (const text of items) assert.ok(!/["&<>]/.test(text), `${id}: ${text}`);
  }
});
