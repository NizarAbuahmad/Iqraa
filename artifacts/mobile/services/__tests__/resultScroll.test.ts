// A finished paper opens at its TOP. Every generator screen used to call
// `scrollToEnd()` once the result was set, so a long worksheet or lesson plan
// landed the teacher on its last line and they had to scroll back up to read
// it. They now scroll to an anchor that sits just above the result.
//
// The runner cannot load react-native, so this reads the screens' source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, 'app', 'ai-tools', p), 'utf8');
/** Code only: a comment may say `scrollToEnd` to explain why it is not used. */
const code = (src: string) => src.split('\n').filter(l => !/^\s*(\/\/|\/?\*|\{\/\*)/.test(l)).join('\n');

const SCREENS = [
  'worksheet.tsx',
  'lesson-plan.tsx',
  'quiz.tsx',
  'activity.tsx',
  'slides.tsx',
  'game.tsx',
  'classroom/builder.tsx',
  'prompt-slides.tsx',
];

for (const file of SCREENS) {
  test(`${file}: a new result is scrolled to its top, not to the end of the page`, () => {
    const src = code(read(file));
    const ends = src.split('\n').filter(l => l.includes('scrollToEnd'));
    if (file === 'prompt-slides.tsx') {
      // The one exception: the clarifying questions asked BEFORE the deck is built.
      assert.equal(ends.length, 1, ends.join('\n'));
      const i = src.indexOf('scrollToEnd');
      assert.ok(src.slice(Math.max(0, i - 200), i).includes('setAsking(questions)'), 'only the questions step may scroll to the end');
    } else {
      assert.deepEqual(ends, []);
    }
    assert.match(src, /scrollTo\(\{ y: Math\.max\(0, \w+\.current - SPACE\.lg\)/, 'scrolls to an anchor above the result');
    assert.match(src, /onLayout=\{e => \{ \w+\.current = e\.nativeEvent\.layout\.y; \}\}/, 'records where the anchor sits');
  });
}
