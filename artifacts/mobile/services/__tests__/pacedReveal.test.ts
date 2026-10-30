/**
 * What this guards: «one point at a time» in the presenter. The presenter draws
 * a slide's bullets, steps and cards inside `Reveal`, each with an index; this
 * says which indices a slide has, so Next can show them one by one before it
 * moves on.
 *
 * The failure that matters is a point that never appears. If this list and the
 * renderer disagree, `revealThreshold` must still show everything once the list
 * is used up — a teacher pressing Next can never be left with hidden content.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pacedBeats, pacedNext, revealThreshold } from '../pacedReveal.ts';
import type { ActivitySlide } from '../ai/AIService.ts';

const slide = (over: Partial<ActivitySlide>): ActivitySlide => ({
  slideNumber: 3, type: 'intro', title: 'فكرة', content: '', durationSeconds: 0, ...over,
});

describe('pacedBeats', () => {
  it('is the line index of each bullet, as the slide body numbers them', () => {
    // A plain line between bullets keeps its index and is always shown.
    const s = slide({ content: '• أول\nسطر عادي\n• ثانٍ\n\n• ثالث' });
    assert.deepEqual(pacedBeats(s), [0, 2, 3]);
  });

  it('paces summary slides too', () => {
    assert.deepEqual(pacedBeats(slide({ type: 'summary', content: '• أ\n• ب' })), [0, 1]);
  });

  it('is one beat per item for the item layouts', () => {
    const steps = slide({ layout: 'steps', content: '• اكتب\n• عوّض\n• احسب' });
    assert.deepEqual(pacedBeats(steps), [0, 1, 2]);
    const flow = slide({ layout: 'flow', content: 'دورة', flow: { steps: ['تبخر', 'تكاثف', 'هطول'], cycle: true } });
    assert.deepEqual(pacedBeats(flow), [0, 1, 2]);
    const compare = slide({
      layout: 'compare', content: 'x',
      compare: { leftTitle: 'قبل', left: ['أ'], rightTitle: 'بعد', right: ['ب'] },
    });
    assert.deepEqual(pacedBeats(compare), [0, 1]);
  });

  it('has nothing to pace on a single bullet, a statement, the cover or a question', () => {
    assert.deepEqual(pacedBeats(slide({ content: '• وحيد' })), []);
    assert.deepEqual(pacedBeats(slide({ layout: 'statement', content: 'سؤال كبير؟' })), []);
    assert.deepEqual(pacedBeats(slide({ slideNumber: 1, content: '• أ\n• ب' })), []);
    for (const type of ['question', 'challenge', 'divider', 'media', 'graph'] as const) {
      assert.deepEqual(pacedBeats(slide({ type, content: '• أ\n• ب' })), [], type);
    }
  });

  it('falls back to the bullets when a layout is too thin to draw', () => {
    // A one-event timeline is refused by the layout gate and drawn as bullets.
    const s = slide({ layout: 'timeline', content: '• حدث\n• آخر', timeline: [{ label: '1900', text: 'x' }] });
    assert.deepEqual(pacedBeats(s), [0, 1]);
  });
});

describe('revealThreshold', () => {
  const beats = [0, 2, 3];
  it('shows nothing before the first press, then up to and including each beat', () => {
    assert.equal(revealThreshold(beats, 0), 0);
    assert.equal(revealThreshold(beats, 1), 1);
    assert.equal(revealThreshold(beats, 2), 3);
  });

  it('shows everything once every beat is out — whatever the renderer numbered', () => {
    assert.equal(revealThreshold(beats, 3), Infinity);
    assert.equal(revealThreshold([], 0), Infinity);
  });
});

describe('pacedNext', () => {
  it('reveals the next beat until there are none, then moves on', () => {
    assert.equal(pacedNext([0, 1], 0), 1);
    assert.equal(pacedNext([0, 1], 1), 2);
    assert.equal(pacedNext([0, 1], 2), 'advance');
    assert.equal(pacedNext([], 0), 'advance');
  });
});

describe('the presenter uses it', () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'ai-tools', 'classroom', 'presentation.tsx'),
    'utf8',
  );

  it('sends the Next button and the clicker through the same paced step', () => {
    assert.match(src, /if \(action === 'next'\) stepForward\(\);/);
    assert.match(src, /onPress=\{stepForward\}/);
    assert.doesNotMatch(src, /onPress=\{\(\) => goToSlide\(slideIndex \+ 1\)\}/);
  });

  it('is off until the teacher turns it on, and shows everything when off', () => {
    assert.match(src, /const \[paced, setPaced\] = useState\(false\);/);
    assert.match(src, /threshold: pacing \? revealThreshold\(beatsHere, shown\) : Infinity/);
  });

  it('is not offered on a phone, and a choice remembered elsewhere does not pace one', () => {
    assert.match(src, /const pacing = paced && !compactBar;/);
    assert.match(src, /const beatsHere = pacing && slideHere/);
    assert.match(src, /\{!compactBar && \(\s*<Pressable\s+onPress=\{togglePaced\}/);
  });

  it('never hides what is on screen: switching on and stepping back show the whole slide', () => {
    const toggle = src.slice(src.indexOf('const togglePaced'), src.indexOf('const [penOn'));
    assert.match(toggle, /setShown\(Infinity\)/);
    assert.match(src, /const restore = idx < slideIndex \? Infinity : idx === slideIndex \? shown : null;/);
  });
});
