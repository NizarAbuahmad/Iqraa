/**
 * The «sample content» notice is on every generator screen that has it, and
 * each screen keeps the record of ITS call — never `getLastGeneration()`, which
 * can be another call's (a chat reply during the offline delay; another of the
 * worksheet's three levels). Source checks: these screens import react-native
 * and cannot be loaded here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
const SCREENS = [
  { file: 'app/ai-tools/activity.tsx', kind: "'activity'" },
  { file: 'app/ai-tools/quiz.tsx', kind: "'quiz'" },
  { file: 'app/ai-tools/worksheet.tsx', kind: "isHomework ? 'homework' : 'worksheet'" },
  { file: 'app/ai-tools/lesson-plan.tsx', kind: "'lesson-plan'" },
];

describe('generator screens say when a result is sample content', () => {
  for (const { file, kind } of SCREENS) {
    const src = readFileSync(join(root, file), 'utf8');
    it(`${file}: mounts the notice for its own kind`, () => {
      assert.match(src, /<AiFallbackNotice\b/);
      assert.ok(src.includes(`aiFallbackNotice(DEMO_MODE, resultRecord, ${kind})`), 'decides through aiFallbackNotice');
    });
    it(`${file}: keeps its own call's record`, () => {
      assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /getLastGeneration\(\)/);
      assert.match(src, /provenanceOf\(/);
    });
    it(`${file}: a reopened material carries no record`, () => {
      assert.match(src, /setResultRecord\(null\);\s*\n\s*(?:try \{ )?setResult\(/);
    });
  }
});

// Slides Maker builds one deck from the book, a lesson plan and formative
// checks; each model call can fall back on its own, so its notice reads all of
// them. (The explanation call is strict, and Prompt Slides never falls back:
// `generatePromptSlides` is `strict: true` with no offline twin.)
describe('Slides Maker says when part of its deck is sample content', () => {
  const src = readFileSync(join(root, 'app/ai-tools/slides.tsx'), 'utf8');
  it('mounts the notice from the plan and the checks', () => {
    assert.match(src, /<AiFallbackNotice\b/);
    assert.match(src, /firstFallbackNotice\(DEMO_MODE, deckParts\)/);
    assert.match(src, /record: provenanceOf\(lessonPlan\), kind: 'lesson-plan'/);
    assert.match(src, /record: checksOut\.record, kind: 'classroom-activity'/);
    assert.doesNotMatch(src.replace(/\/\/.*$/gm, ''), /getLastGeneration\(\)/);
  });
  it('a reopened deck carries no record', () => {
    assert.match(src, /setDeckParts\(null\);\s*\n\s*setDeck\(loaded\)/);
  });
});
