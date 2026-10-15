/**
 * Every Grade 7–10 maths lesson has an English title with no Arabic in it.
 *
 * These catalogs have no English lesson titles of their own: each builder used to copy
 * `title_ar` into `titleEn`, so an English plan, worksheet or export for any of 122 lessons
 * carried an Arabic title. The English titles now live in the catalog JSON as `title_en`.
 * Check the knowledge base the app reads, not the builders, so a lesson that is taken from
 * somewhere else (Grade 10 has hand-written English for most of its lessons) is covered too.
 *
 * What this cannot say is whether a title is the Ministry's English wording — the titles
 * were written without the English edition at hand and need a teacher's read.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { KB_LESSONS } from '../knowledgeBase.ts';

const ARABIC = /[؀-ۿ]/;
const MATHS = /^kbl-(?:g[789]-math-s[12]|math-s[12])-nccd-/;

const maths = KB_LESSONS.filter(l => MATHS.test(l.id));

describe('Grade 7–10 maths lesson titles in English', () => {
  it('covers all four grades', () => {
    // 147 lessons when written (G7 43, G8 37, G9 31, G10 36); a lower count means the pattern stopped matching.
    assert.ok(maths.length >= 147, `only ${maths.length} lessons matched`);
    for (const prefix of ['kbl-g7-', 'kbl-g8-', 'kbl-g9-', 'kbl-math-s']) {
      assert.ok(maths.some(l => l.id.startsWith(prefix)), `${prefix} matched nothing`);
    }
  });

  it('no lesson has Arabic in its English title', () => {
    const bad = maths.filter(l => ARABIC.test(l.titleEn)).map(l => `${l.id}: ${l.titleEn}`);
    assert.deepEqual(bad, []);
  });

  it('no lesson has an empty or copied English title', () => {
    const bad = maths.filter(l => !l.titleEn.trim() || l.titleEn === l.titleAr).map(l => l.id);
    assert.deepEqual(bad, []);
  });

  it('a lesson title is not repeated inside one unit', () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const l of maths) {
      const key = `${l.unitId}|${l.titleEn.toLowerCase()}`;
      if (seen.has(key)) dup.push(`${seen.get(key)} / ${l.id}: ${l.titleEn}`);
      else seen.set(key, l.id);
    }
    assert.deepEqual(dup, []);
  });
});
