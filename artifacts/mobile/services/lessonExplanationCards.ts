/**
 * Turns a stored `lesson-teaching` artifact into the cards the student screen
 * draws.
 *
 * Pure, with a type-only import, so it runs under bare `node --test` (the
 * screen itself cannot). The text is shown as stored, the same as the slide
 * deck shows it, except that a leading list marker on a point or a step is
 * removed (`stripMarker`). Anything blank is dropped here, so the screen never renders
 * an empty card; an artifact with nothing usable yields no cards and the
 * screen says so.
 */
import type { LessonTeachingOutput } from './ai/AIService.ts';

export type ExplanationCard =
  | { kind: 'hook'; text: string }
  | { kind: 'concept'; title: string; points: string[]; misconception?: string }
  | { kind: 'example'; problem: string; steps: string[]; answer: string }
  | { kind: 'practice'; problem: string; hint?: string; answer?: string };

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// A leading list marker: a bullet or dash followed by a space, or a number in
// Latin or Arabic-Indic digits written «1.» «1)» «(1)» followed by a space (or
// by nothing, for a line that is only a marker). The space is required, so
// «-3 + 5», «2.5 g» and «2 mol» are sentences, not lists. A bare «•» may touch
// its text. Up to two digits: «2024. …» is not a marker.
const DIGITS = '[0-9\\u0660-\\u0669\\u06F0-\\u06F9]{1,2}';
const MARKER = new RegExp(`^(?:•\\s*|(?:[-*–—]|${DIGITS}[.)]|\\(${DIGITS}\\))(?:\\s+|$))`, 'u');

// A dash, or a parenthesised number, can be a sign or a factor rather than a
// marker: «- 3x = 6», «– 5 °C», «(2) + (3) = 5». These are only markers when
// what follows is words, so they are left alone when the rest starts with a
// digit, a Latin letter, «(» or an operator. (The reviewer read the text before
// this strip; it must never change the maths.)
const AMBIGUOUS = /^(?:[-–—]|\([0-9\u0660-\u0669\u06F0-\u06F9]{1,2}\))(?:\s+|$)/u;
const LIST_NUMBER = new RegExp(`^${DIGITS}[.)]\\s`, 'u');
const MATHS_NEXT = /^[0-9\u0660-\u0669\u06F0-\u06F9A-Za-z(+\-−–—×÷*/=^]/u;

/**
 * Remove ONE leading list marker. The model sometimes writes its own bullet or
 * number, and the screen adds the number itself, which showed «1. 1. اقسم».
 * The slide deck strips bullets the same way (`usableTeaching`). A line that
 * is only a marker becomes empty, and the card builder drops it like a blank.
 */
export function stripMarker(text: string): string {
  const t = text.trim();
  const marker = MARKER.exec(t);
  if (!marker) return t;
  const rest = t.slice(marker[0].length).trim();
  // «- 1. اقسم»: what follows is itself a list number, not a quantity.
  if (AMBIGUOUS.test(t) && MATHS_NEXT.test(rest) && !LIST_NUMBER.test(rest)) return t;
  return rest;
}

const cleanList = (values: unknown): string[] =>
  Array.isArray(values) ? values.map(v => stripMarker(clean(v))).filter(Boolean) : [];

export function buildExplanationCards(content: LessonTeachingOutput | null | undefined): ExplanationCard[] {
  if (!content) return [];
  const cards: ExplanationCard[] = [];

  const hook = clean(content.hook?.question);
  if (hook) cards.push({ kind: 'hook', text: hook });

  for (const concept of Array.isArray(content.concepts) ? content.concepts : []) {
    const title = clean(concept?.title);
    if (!title) continue;
    const misconception = clean(concept.misconception);
    cards.push({
      kind: 'concept',
      title,
      points: cleanList(concept.points),
      ...(misconception ? { misconception } : {}),
    });
  }

  const example = content.workedExample;
  const exampleProblem = clean(example?.problem);
  if (exampleProblem) {
    cards.push({
      kind: 'example',
      problem: exampleProblem,
      steps: cleanList(example?.steps),
      answer: clean(example?.answer),
    });
  }

  const practice = content.practice;
  const practiceProblem = clean(practice?.problem);
  if (practiceProblem) {
    const hint = clean(practice?.hint);
    const answer = clean(practice?.answer);
    cards.push({
      kind: 'practice',
      problem: practiceProblem,
      ...(hint ? { hint } : {}),
      ...(answer ? { answer } : {}),
    });
  }

  return cards;
}
