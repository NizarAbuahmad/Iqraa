/**
 * The «sample content» notice reads the record of the call that made the
 * result on screen — never the last generation, which can be another call's: a
 * fallback is recorded before the offline generator's 1–2 s delay, so a chat
 * reply in that window became "last" and hid the notice; and the worksheet's
 * three-level mode runs three generations at once. Source checks: these
 * screens import react-native and cannot be loaded here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const code = (src: string) => src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

describe('the notice is given its record, not the last generation', () => {
  it('AiFallbackNotice takes records and does not read the last generation', () => {
    const src = code(read('components/ui/AiFallbackNotice.tsx'));
    assert.match(src, /records: readonly \(AiGenerationRecord \| null\)\[\]/);
    assert.doesNotMatch(src, /useLastGeneration|getLastGeneration/);
  });

  const SCREENS = [
    'app/ai-tools/activity.tsx',
    'app/ai-tools/quiz.tsx',
    'app/ai-tools/worksheet.tsx',
    'app/ai-tools/lesson-plan.tsx',
  ];
  for (const file of SCREENS) {
    const src = read(file);
    it(`${file}: passes the record of its own call`, () => {
      assert.match(src, /<AiFallbackNotice[^>]*records=\{\[resultRecord\]\}/);
      assert.match(src, /setResultRecord\(provenanceOf\(/);
      assert.doesNotMatch(code(src), /getLastGeneration\(\)/);
    });
    it(`${file}: a reopened material carries no record`, () => {
      assert.match(src, /setResultRecord\(null\);\s*\n\s*(?:try \{ )?setResult\(/);
    });
  }

  // One deck, from the book plus a lesson plan and formative checks; each of the
  // two model calls can fall back on its own. (Its explanation call is strict,
  // and Prompt Slides never falls back: `generatePromptSlides` is `strict: true`
  // with no offline twin.)
  it('Slides Maker passes the records of its plan and its checks', () => {
    const src = read('app/ai-tools/slides.tsx');
    assert.match(src, /<AiFallbackNotice[^>]*kinds=\{\['lesson-plan', 'classroom-activity'\]\}[^>]*records=\{deckRecords\}/);
    assert.match(src, /setDeckRecords\(\[provenanceOf\(lessonPlan\), checksOut\.record\]\)/);
    assert.match(src, /setDeckRecords\(null\);\s*\n\s*setDeck\(loaded\)/);
  });
});
