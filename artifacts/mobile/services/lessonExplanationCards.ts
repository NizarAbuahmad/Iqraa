/**
 * Turns a stored `lesson-teaching` artifact into the cards the student screen
 * draws.
 *
 * Pure, with a type-only import, so it runs under bare `node --test` (the
 * screen itself cannot). The text is shown as stored, the same as the slide
 * deck shows it. Anything blank is dropped here, so the screen never renders
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
const cleanList = (values: unknown): string[] =>
  Array.isArray(values) ? values.map(clean).filter(Boolean) : [];

export function buildExplanationCards(content: LessonTeachingOutput | null | undefined): ExplanationCard[] {
  if (!content) return [];
  const cards: ExplanationCard[] = [];

  const hook = clean(content.hook?.question);
  if (hook) cards.push({ kind: 'hook', text: hook });

  for (const concept of content.concepts ?? []) {
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
