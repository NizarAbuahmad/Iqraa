/**
 * Grade 1 grammar sentences, generated from the book's patterns and the
 * lessons' own words (spec: docs/superpowers/specs/2026-10-16-english-corner-grammar-g1-design.md).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  GRAMMAR_UNITS, allGrammarSentences, grammarUnit, offeredGrammar, pluralOf, renderGrammarSheet, unitSentences, withArticle,
} from '../englishGrammar.ts';
import { allHubWords, audioSlug, hubLessonsForGrade } from '../englishHub.ts';
import { wordPicture } from '../englishPictures.ts';

const G1 = hubLessonsForGrade(1);
const order = new Map(G1.map((l, i) => [l.id, i]));

test('every grammar unit is a Grade 1 lesson, and not Semester 1 Unit 0', () => {
  for (const u of GRAMMAR_UNITS) {
    assert.ok(order.has(u.lessonId), u.lessonId);
    assert.ok(!u.lessonId.endsWith('-s1-nccd-u0_l1'), u.lessonId);
  }
  assert.equal(GRAMMAR_UNITS.length, 9);
});

test('a slot names only words of its own lesson or an earlier Grade 1 lesson', () => {
  for (const u of GRAMMAR_UNITS) {
    const allowed = new Set(G1.slice(0, order.get(u.lessonId)! + 1).flatMap(l => l.words.map(w => w.en)));
    for (const [slot, words] of Object.entries(u.slots)) {
      for (const w of words) assert.ok(allowed.has(w), `${u.lessonId} ${slot}: ${w}`);
    }
  }
});

test('a/an and plurals', () => {
  assert.equal(withArticle('eraser'), 'an eraser');
  assert.equal(withArticle('pen'), 'a pen');
  assert.equal(withArticle('T-shirt'), 'a T-shirt');
  assert.equal(withArticle('boots'), 'boots');
  assert.equal(pluralOf('frog'), 'frogs');
  assert.equal(pluralOf('pencil case'), 'pencil cases');
  assert.equal(pluralOf('apples'), 'apples');
});

test('every sentence re-joins from its tiles, and every Choose has one right option shown at its blank', () => {
  let chooses = 0;
  for (const u of GRAMMAR_UNITS) {
    for (const s of unitSentences(u)) {
      assert.equal(s.tokens.join(' '), s.text, s.key);
      if (!s.choose) continue;
      chooses += 1;
      assert.notEqual(s.choose.right, s.choose.wrong, s.key);
      const blanked = s.tokens.slice(s.choose.start, s.choose.start + s.choose.length).join(' ').replace(/[.?!,]+$/, '');
      assert.equal(blanked, s.choose.right, s.key);
    }
  }
  assert.ok(chooses > 50, `${chooses}`);
});

test('the pictures a sentence uses all exist, and a false picture is another word', () => {
  for (const u of GRAMMAR_UNITS) {
    for (const s of unitSentences(u)) {
      if (s.picture) assert.ok(wordPicture(s.picture.word), s.key);
      if (s.falsePicture) {
        assert.ok(wordPicture(s.falsePicture), s.key);
        assert.notEqual(s.falsePicture, s.picture?.word, s.key);
      }
      // A slot or whole choice is decided by the picture, so it must have one.
      if (s.choose && s.choose.kind !== 'phrase') assert.ok(s.picture, `${s.key}: a ${s.choose.kind} choice with no picture`);
    }
  }
});

test('the sentences the book uses as its own examples come out word for word', () => {
  const texts = new Set(GRAMMAR_UNITS.flatMap(u => unitSentences(u).map(s => s.text)));
  for (const t of [
    "I've got a pen.", "I haven't got an eraser.", 'The book is on the chair.', 'The pens are on the floor.',
    "What are these? They're tigers.", 'I like cakes.', "I don't like lemons.", "He's got two arms.",
    "Who's this? This is my mum.", "I'm wearing boots.", "Where's my jacket? It's on the chair.",
    "What's your favourite toy? It's my robot.", "I'm happy.",
  ]) assert.ok(texts.has(t), t);
  for (const bad of ["I'm wearing a boots.", "Where's my boots? It's on the chair.", "Who's this? This is my cat."]) {
    assert.ok(!texts.has(bad), bad);
  }
});

test('an unreviewed unit is offered to nobody', () => {
  for (const u of GRAMMAR_UNITS) {
    assert.deepEqual(offeredGrammar(u.lessonId), u.reviewedBy ? unitSentences(u) : null);
  }
  assert.equal(offeredGrammar('kbl-g1-eng-s1-nccd-u0_l1'), null);
  assert.equal(grammarUnit('nope'), undefined);
});

test('every sentence has its own recording key, shared with no other sentence or word', () => {
  // `playWord(sentence)` plays `<audioSlug>.mp3`; a collision would play another sentence.
  const words = new Set(allHubWords().map(audioSlug));
  const seen = new Map<string, string>();
  for (const text of allGrammarSentences()) {
    const slug = audioSlug(text);
    assert.ok(!words.has(slug), `${text} → ${slug} is a word's recording`);
    assert.equal(seen.get(slug) ?? text, text, `${text} and ${seen.get(slug)} share ${slug}`);
    seen.set(slug, text);
  }
});

test("the committed teacher's sheet is exactly what the generator produces", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const committed = readFileSync(path.join(here, '..', '..', '..', '..', 'docs', 'english-grammar-g1-sheet.md'), 'utf8');
  assert.equal(committed, renderGrammarSheet(), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
});

test("the teacher's printable review form lists every sentence once, and the committed copy is current", async () => {
  const { renderGrammarReviewHtml, sentenceCountAr } = await import('../englishGrammarReview.ts');
  const html = renderGrammarReviewHtml();
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // A sentence can belong to two units (S2 Unit 0 reuses Unit 2's): once per unit, then.
  const all = GRAMMAR_UNITS.flatMap(u => unitSentences(u).map(s => s.text));
  for (const text of new Set(all)) {
    const cell = `<td class="sentence" dir="ltr">${esc(text)}</td>`;
    assert.equal(html.split(cell).length - 1, all.filter(t => t === text).length, text);
  }
  assert.equal((html.match(/<td class="sentence"/g) ?? []).length, GRAMMAR_UNITS.reduce((n, u) => n + unitSentences(u).length, 0));
  // Arabic counting: 3–10 take the plural, everything else the singular.
  assert.equal(sentenceCountAr(5), '٥ جمل');
  assert.equal(sentenceCountAr(10), '١٠ جمل');
  assert.equal(sentenceCountAr(16), '١٦ جملة');
  const here = path.dirname(fileURLToPath(import.meta.url));
  const committed = readFileSync(path.join(here, '..', '..', '..', '..', 'docs', 'english-grammar-g1-review.html'), 'utf8');
  assert.equal(committed, html, 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
});
