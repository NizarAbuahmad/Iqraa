import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGLISH_HUB_LESSONS,
  MIN_HUB_WORDS,
  allHubWords,
  audioSlug,
  hubLessonsForGrade,
  isDrillableWord,
} from '../englishHub.ts';
import { LESSONS } from '../catalog.ts';

test('every grade 1–4 has hub lessons', () => {
  for (const g of [1, 2, 3, 4]) assert.ok(hubLessonsForGrade(g).length > 0, `grade ${g}`);
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
