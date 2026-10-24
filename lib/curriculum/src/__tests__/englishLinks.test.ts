import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENGLISH_CORNER_GRADES,
  FREE_SITES,
  englishBooksForGrade,
  freeSitesForGrade,
} from '../englishLinks.ts';
import { ENGLISH_HUB_GRADES } from '../englishHub.ts';

test('the corner shows every grade from 1 to 10, in order', () => {
  assert.deepEqual([...ENGLISH_CORNER_GRADES], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('every grade with word games is also a corner grade', () => {
  for (const g of ENGLISH_HUB_GRADES) assert.ok((ENGLISH_CORNER_GRADES as readonly number[]).includes(g), `grade ${g}`);
});

test('every free site is https, has both languages and a sane grade band', () => {
  const ids = new Set<string>();
  for (const s of FREE_SITES) {
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`);
    ids.add(s.id);
    assert.match(s.url, /^https:\/\//, s.id);
    assert.ok(s.titleEn && s.titleAr && s.noteEn && s.noteAr, `${s.id} is missing text`);
    assert.ok(s.grades[0] >= 1 && s.grades[1] <= 10 && s.grades[0] <= s.grades[1], `${s.id} band`);
    assert.ok(s.skills.length > 0, `${s.id} has no skill`);
    assert.ok(/[؀-ۿ]/.test(s.titleAr) && /[؀-ۿ]/.test(s.noteAr), `${s.id} Arabic is not Arabic`);
  }
});

test('every grade has somewhere to listen and somewhere to read', () => {
  for (const g of ENGLISH_CORNER_GRADES) {
    const sites = freeSitesForGrade(g);
    assert.ok(sites.some(s => s.skills.includes('listen')), `grade ${g} has no listening site`);
    assert.ok(sites.some(s => s.skills.includes('read')), `grade ${g} has no reading site`);
  }
});

test('every grade has its official student book for both semesters', () => {
  for (const g of ENGLISH_CORNER_GRADES) {
    const books = englishBooksForGrade(g).filter(b => b.kind === 'student');
    assert.deepEqual(books.map(b => b.semester), [1, 2], `grade ${g}`);
    for (const b of books) assert.match(b.url, /^https:\/\//, b.bookId);
  }
});

test('books come semester by semester, the student book before its activity book', () => {
  const g10 = englishBooksForGrade(10);
  assert.deepEqual(g10.map(b => `${b.semester}${b.kind[0]}`), ['1s', '1a', '2s', '2a']);
});
