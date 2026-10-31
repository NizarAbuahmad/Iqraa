/**
 * «One point at a time» — the presenter's paced reveal.
 *
 * A slide's bullets, steps and cards arrive by themselves a beat apart (`Reveal`
 * in `presentation.tsx`), the whole slide within a second. Students read ahead
 * of the teacher, and «what comes next?» has no answer to wait for. With the
 * presenter's toggle on, Next shows the slide's next point instead, and moves
 * to the next slide only when every point is out.
 *
 * Only explanation slides are paced (`intro` and `summary`, not the cover):
 * a question and a challenge have their own reveal, and a divider or a photo
 * has one thing to show. A slide with fewer than two points has nothing to wait
 * for.
 *
 * `pacedBeats` mirrors the indices the presenter gives its `Reveal`s. If the two
 * ever disagree, `revealThreshold` still shows everything once the beats run
 * out, so the cost of a mismatch is a slide that reveals early — never a point
 * that stays hidden.
 *
 * Pure, so the bare `node --test` runner can load it.
 */
import type { ActivitySlide } from './ai/AIService.ts';
import { diagramBeats, isDiagram } from './diagramGeometry.ts';
import { isBulletLine } from './deckText.ts';
import { resolveSlideLayout } from './slideLayout.ts';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** The `Reveal` indices on this slide, in order; [] when it is not paced. */
export function pacedBeats(slide: ActivitySlide): number[] {
  if (slide.type !== 'intro' && slide.type !== 'summary') return [];
  if (slide.slideNumber === 1) return [];
  const beats = beatsFor(slide);
  return beats.length >= 2 ? beats : [];
}

function beatsFor(slide: ActivitySlide): number[] {
  const layout = resolveSlideLayout(slide);
  if (layout) {
    if (isDiagram(layout)) return range(diagramBeats(layout));
    switch (layout.kind) {
      case 'compare': return [0, 1];
      case 'steps': return range(layout.steps.length);
      case 'timeline': return range(layout.events.length);
      case 'stats': return range(layout.items.length);
      case 'concepts': return range(layout.items.length);
      case 'flow': return range(layout.nodes.length);
      default: return [];
    }
  }
  // The ordinary body: `SlideView` splits `content` the same way and wraps each
  // bullet line, keyed by its position among all the lines.
  const lines = slide.content.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.flatMap((line, i) => (isBulletLine(line) ? [i] : []));
}

/** A `Reveal` whose index is below this is shown. */
export function revealThreshold(beats: readonly number[], shown: number): number {
  if (shown >= beats.length) return Infinity;
  return shown === 0 ? 0 : beats[shown - 1]! + 1;
}

/** What Next does: show one more beat (the new count), or move to the next slide. */
export function pacedNext(beats: readonly number[], shown: number): number | 'advance' {
  return shown < beats.length ? shown + 1 : 'advance';
}
