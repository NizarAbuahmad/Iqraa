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
      assert.match(src, /provenanceOf\(|generationSince\(/);
    });
    it(`${file}: a reopened material carries no record`, () => {
      assert.match(src, /setResultRecord\(null\);\s*\n\s*try \{ setResult\(/);
    });
  }
});
