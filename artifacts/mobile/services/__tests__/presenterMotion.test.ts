/**
 * The presenter's entrance motion lives in a React Native file the bare
 * `node --test` runner cannot load, so these read its source for the three
 * properties that, if lost, fail silently on a teacher's projector:
 *
 *  - an item with nothing to wait for must not stay invisible: the reduced-motion
 *    read has a `.catch` that shows it, and a reduced-motion device skips the
 *    animation outright;
 *  - the animation plays on mount, so the slide has to be re-mounted per slide —
 *    without the `key`, slide 2's bullets would never animate after slide 1's;
 *  - it is native-driven (opacity and transform only), so it cannot stall the
 *    JS thread that is also running the lesson timer.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/presenterMotion.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'ai-tools', 'classroom', 'presentation.tsx'),
  'utf8',
);
const reveal = src.slice(src.indexOf('function Reveal('), src.indexOf('function LayoutHeading('));

describe('the presenter’s entrance motion', () => {
  it('the Reveal component was found', () => {
    assert.ok(reveal.length > 200, 'Reveal source not located');
  });

  it('shows the item at once on a reduced-motion device, and when the setting cannot be read', () => {
    assert.match(reveal, /isReduceMotionEnabled\(\)/);
    assert.match(reveal, /if \(reduce\) \{ progress\.setValue\(1\); return; \}/);
    assert.match(reveal, /\.catch\(\(\) => progress\.setValue\(1\)\)/);
  });

  it('is native-driven and caps the stagger', () => {
    assert.match(reveal, /useNativeDriver: NATIVE_DRIVER/);
    assert.match(reveal, /Math\.min\(index, 8\)/);
    // opacity + translate only — a layout property would force the JS thread
    assert.doesNotMatch(reveal, /\b(width|height|margin|padding|top|left)\s*:/);
  });

  it('the ordinary slide is re-mounted per slide so the motion replays', () => {
    assert.match(src, /<SlideView key=\{`slide-\$\{slideIndex\}`\}/);
  });

  it('the slide and the ink layer never share a key — the slides piled up when they did', () => {
    // Siblings in one ScrollView. Both were `key={slideIndex}` (2026-10-18 to
    // 10-20): React kept every slide it had shown, so slide 3 drew 2 and 3 stacked.
    assert.doesNotMatch(src, /<\w+ key=\{slideIndex\}/);
    assert.match(src, /<PenCanvas key=\{`ink-\$\{slideIndex\}`\}/);
  });

  it('the bullets, cards, steps, boxes and columns use it', () => {
    const uses = src.match(/<Reveal\b/g) ?? [];
    // bullet card, step row, compare column, timeline column + row, stats card, concept card, flow node
    assert.ok(uses.length >= 8, `expected the item lists to be wrapped, found ${uses.length}`);
  });
});
