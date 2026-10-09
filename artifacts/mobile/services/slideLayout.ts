/**
 * Which shape a slide should be drawn in, resolved once for all three
 * renderers.
 *
 * Until now every teaching slide in every deck rendered identically: a title
 * and a column of bullet lines. Two tools generating genuinely different
 * content still produced decks that looked the same, because the difference
 * never reached the eye — there was only one layout to reach it through.
 *
 * `ActivitySlide.layout` is a HINT, not a type. It decorates the existing
 * types rather than joining them, because `type` drives behaviour all over the
 * app — timers, answer keys, where a video gets inserted, which accent colour
 * is used — and a new member of that union would have to be audited against
 * every one of those. A layout changes only how the slide is drawn, so a
 * renderer that has never heard of one simply ignores it.
 *
 * This module is the single place that decides whether a layout's data is good
 * enough to draw. It fails to `null` — meaning "render it the ordinary way" —
 * rather than letting a renderer draw half a comparison or a statistic with no
 * number in it. A slide that quietly falls back looks unremarkable; a slide
 * that half-renders looks broken, and it does so on a wall in front of a class.
 *
 * Pure and react-free so it can be tested by the bare `node --test` runner.
 */
import type { ActivitySlide } from './ai/AIService.ts';
import { isBulletLine, stripBullet } from './deckText.ts';

export type ResolvedLayout =
  | { kind: 'statement'; text: string }
  | { kind: 'stat'; value: string; label: string; source?: string }
  | { kind: 'compare'; leftTitle: string; left: string[]; rightTitle: string; right: string[] }
  | { kind: 'steps'; steps: string[] };

/**
 * A statement is one sentence, not a paragraph with the bullets removed.
 * Past this length it stops reading as a statement on a projector and starts
 * reading as a wall of text set in display type, which is worse than the
 * ordinary layout it replaced.
 */
export const MAX_STATEMENT_CHARS = 140;

/** A figure has to stay legible at display size. */
export const MAX_STAT_VALUE_CHARS = 12;

/** Two steps are a pair, not a process; below this the numbering is noise. */
const MIN_STEPS = 2;

function lines(content: string | undefined): string[] {
  return (content ?? '').split('\n').map(l => l.trim()).filter(Boolean);
}

function cleanList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return items
    .map(i => (typeof i === 'string' ? stripBullet(i).trim() : ''))
    .filter(Boolean);
}

/**
 * The layout this slide should be drawn in, or `null` for the ordinary one.
 *
 * Callers render `null` exactly as they always have — that is the contract
 * that lets a layout be added to one renderer at a time without any renderer
 * ever showing an empty slide.
 */
export function resolveSlideLayout(slide: ActivitySlide): ResolvedLayout | null {
  switch (slide.layout) {
    case 'statement': {
      const body = lines(slide.content);
      // More than one line is a list wearing a statement's clothes.
      if (body.length !== 1) return null;
      const text = stripBullet(body[0]!);
      if (!text || text.length > MAX_STATEMENT_CHARS) return null;
      return { kind: 'statement', text };
    }

    case 'stat': {
      const value = (slide.stat?.value ?? '').trim();
      const label = (slide.stat?.label ?? '').trim();
      // A stat slide with no figure is just a heading set very large.
      if (!value || value.length > MAX_STAT_VALUE_CHARS) return null;
      if (!label) return null;
      const source = (slide.stat?.source ?? '').trim();
      return { kind: 'stat', value, label, ...(source ? { source } : {}) };
    }

    case 'compare': {
      const leftTitle = (slide.compare?.leftTitle ?? '').trim();
      const rightTitle = (slide.compare?.rightTitle ?? '').trim();
      const left = cleanList(slide.compare?.left);
      const right = cleanList(slide.compare?.right);
      // Both columns must stand up. One empty side is not a comparison, and
      // renders as a lopsided slide with a heading over nothing.
      if (!leftTitle || !rightTitle || left.length === 0 || right.length === 0) return null;
      return { kind: 'compare', leftTitle, left, rightTitle, right };
    }

    case 'steps': {
      const body = lines(slide.content);
      const steps = body.filter(isBulletLine).map(stripBullet).filter(Boolean);
      // Fall back rather than numbering prose that was never a sequence.
      if (steps.length < MIN_STEPS) return null;
      return { kind: 'steps', steps };
    }

    default:
      return null;
  }
}

/** Arabic-Indic digits to a number, so «١) … ٢)» numbers like «1) … 2)». */
function markerValue(raw: string): number {
  return Number(raw.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))));
}

/** The longest lead-in («الخطوات:») that is a label rather than a first step. */
const MAX_STEPS_LEAD_CHARS = 24;

/** Three is a process; two numbered clauses are just a sentence with a list in it. */
const MIN_INLINE_STEPS = 3;

/**
 * A procedure the book wrote on ONE line — «الخطوات: 1) عزل y 2) تعويضه
 * 3) حل المعادلة» — as its steps, or `null` when the line is not one.
 *
 * Strict on purpose, because the answer to "no" is the ordinary rendering and
 * the answer to a wrong "yes" is a slide numbered wrongly in front of a class:
 * the markers must count 1, 2, 3… in order with nothing skipped, there must be
 * at least three, every step must have text, and anything before the first
 * marker must be a short label. A marker is a number and `)` or `.` standing
 * after whitespace or a colon and followed by whitespace, so «13.6 / n²» and
 * «f(2) = 5» are not read as steps.
 */
export function inlineSteps(text: string): string[] | null {
  const line = stripBullet(text ?? '');
  const markers = [...line.matchAll(/(?:^|[\s:：])([0-9٠-٩]{1,2})\s*[).](?=\s)/g)];
  if (markers.length < MIN_INLINE_STEPS) return null;
  if (!markers.every((m, i) => markerValue(m[1]!) === i + 1)) return null;

  // The match may have eaten the whitespace or colon before the digits, so the
  // number's own position is found inside it; a step's text runs from the end
  // of its marker to where the next number begins.
  const numberAt = markers.map(m => m.index! + m[0].indexOf(m[1]!));
  const lead = line.slice(0, numberAt[0]!).replace(/[:：\s]+$/, '').trim();
  if (lead.length > MAX_STEPS_LEAD_CHARS) return null;

  const steps = markers.map((m, i) => {
    const from = m.index! + m[0].length;
    const to = i + 1 < numberAt.length ? numberAt[i + 1]! : line.length;
    return line.slice(from, to).replace(/[\s;,،؛]+$/, '').trim();
  });
  return steps.every(Boolean) ? steps : null;
}

/** Every layout a generator may ask for — the prompt and the tests share this. */
export const SLIDE_LAYOUTS = ['statement', 'stat', 'compare', 'steps'] as const;
