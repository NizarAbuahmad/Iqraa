import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGLISH_HUB_GRADES,
  ENGLISH_HUB_LESSONS,
  MIN_HUB_WORDS,
  allHubWords,
  audioSlug,
  hubLessonsForGrade,
  hubWordFromBook,
  isDrillableWord,
} from '../englishHub.ts';
import { LESSONS } from '../catalog.ts';
import { ENGLISH_VOCABULARY } from '../vocabulary.ts';
import glossesRaw from '../data/english_vocabulary_ar.json' with { type: 'json' };

const GLOSSES = glossesRaw as Record<string, string>;

test('every grade 1–4 has hub lessons', () => {
  for (const g of [1, 2, 3, 4]) assert.ok(hubLessonsForGrade(g).length > 0, `grade ${g}`);
});

test('grades 9 and 10 have hub lessons, built from the vocabulary list', () => {
  for (const g of [9, 10]) assert.ok(hubLessonsForGrade(g).length > 0, `grade ${g}`);
  const vocabLessons = new Set(ENGLISH_VOCABULARY.map(w => w.lessonId));
  for (const l of [...hubLessonsForGrade(9), ...hubLessonsForGrade(10)]) {
    assert.ok(vocabLessons.has(l.id), l.id);
    assert.ok(l.unitNumber > 0 && l.unitTitle && l.unitTitleAr, `${l.id}: unit not resolved`);
  }
});

test('grade tabs only ever append — the selected grade is a URL param', () => {
  assert.deepEqual([...ENGLISH_HUB_GRADES], [1, 2, 3, 4, 9, 10]);
});

test('every drillable 9–10 word has a gloss, and every gloss names a real word', () => {
  const words = new Set(ENGLISH_VOCABULARY.map(w => w.word.trim()).filter(w => hubWordFromBook(w)));
  for (const w of words) assert.ok(GLOSSES[w]?.trim(), `${w} has no Arabic`);
  for (const [en, ar] of Object.entries(GLOSSES)) {
    assert.ok(words.has(en), `gloss for ${en}, which is in no lesson`);
    assert.doesNotMatch(ar, /[A-Za-z]/, `${en}: gloss is not Arabic`);
  }
});

test('every hub lesson resolves in the browser catalog', () => {
  const ids = new Set(LESSONS.map(l => l.id));
  for (const l of ENGLISH_HUB_LESSONS) assert.ok(ids.has(l.id), l.id);
});

test('every word is glossed, drillable and unique within its lesson', () => {
  for (const l of ENGLISH_HUB_LESSONS) {
    assert.ok(l.words.length >= MIN_HUB_WORDS, l.id);
    const seen = new Set<string>();
    for (const w of l.words) {
      assert.ok(w.ar.trim(), `${l.id}: ${w.en} has no Arabic`);
      assert.ok(isDrillableWord(w.en), w.en);
      assert.ok(!seen.has(w.en.toLowerCase()), `${l.id}: ${w.en} twice`);
      seen.add(w.en.toLowerCase());
    }
  }
});

test("the book's annotations never reach a student", () => {
  assert.equal(hubWordFromBook('eager (phr)'), 'eager');
  assert.equal(hubWordFromBook('twin (n, adj)'), 'twin');
  assert.equal(hubWordFromBook('get on (well) with somebody'), 'get on with somebody');
  assert.equal(hubWordFromBook('or learnt'), null);
  assert.equal(hubWordFromBook('full-time/part-time'), null);
  for (const l of ENGLISH_HUB_LESSONS) for (const w of l.words) assert.doesNotMatch(w.en, /[()]/, `${l.id}: ${w.en}`);
});

test('no two words in a lesson share a meaning — Match would have two identical cards', () => {
  for (const l of ENGLISH_HUB_LESSONS) {
    const seen = new Map<string, string>();
    for (const w of l.words) {
      const prev = seen.get(w.ar);
      assert.ok(!prev, `${l.id}: ${prev} and ${w.en} are both «${w.ar}»`);
      seen.set(w.ar, w.en);
    }
  }
});

test('topic labels are not drillable words', () => {
  assert.equal(isDrillableWord('Numbers 11-20'), false);
  assert.equal(isDrillableWord('fair/brown/red/black hair'), false);
  assert.equal(isDrillableWord('ordinal numbers: first-thirty-first'), false);
  assert.equal(isDrillableWord('pencil case'), true);
});

test('audio slugs are readable and never collide', () => {
  assert.equal(audioSlug('pencil case'), 'pencil-case');
  assert.equal(audioSlug('T-shirt'), 't-shirt');
  const bySlug = new Map<string, string>();
  for (const w of allHubWords()) {
    const s = audioSlug(w);
    assert.match(s, /^[a-z]+(-[a-z]+)*$/, w);
    const prev = bySlug.get(s);
    // Case-only twins ("Jordan"/"jordan") may share a file; different words may not.
    assert.ok(!prev || prev.toLowerCase() === w.toLowerCase(), `${prev} and ${w} share ${s}`);
    bySlug.set(s, w);
  }
});

test('allHubWords is distinct', () => {
  const words = allHubWords();
  assert.equal(new Set(words).size, words.length);
  assert.ok(words.length > 400);
});
