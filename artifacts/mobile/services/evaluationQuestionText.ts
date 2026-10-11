/**
 * What the evaluation review screen (`app/evaluations/[id]/index.tsx`) prints
 * for each question. Kept out of the screen so it can be tested: screen files
 * import `react-native` and cannot be loaded by `node --test`.
 */
import type { EvaluationQuestion } from './evaluations.ts';
import { showBlanks } from './evaluationBlanks.ts';
import { isolateForeignRuns } from './mathRender.ts';
import { toArabicDigits } from './labFormat.ts';
import { optionLetter } from './optionLabels.ts';

/**
 * The one field worth showing per type, regardless of shape.
 *
 * Isolated here rather than at the render site because every branch below
 * returns model-written Arabic that can carry an equation, and an unisolated
 * «f(x) = 2x⁴ - x² + 3» comes out of the bidi algorithm reordered against the
 * Arabic around it — a wrong question, not just an ugly one.
 */
export function questionText(q: EvaluationQuestion, isAr: boolean): string {
  const body = q.body;
  const template = body['template'] as string | undefined;
  return isolateForeignRuns(
    withMatchingItems(q, body['stem'] as string | undefined, isAr)
    ?? (body['statement'] as string | undefined)
    ?? (template === undefined ? undefined : showBlanks(template))
    ?? (body['prompt'] as string | undefined)
    // A matching body has none of the four above, so it used to fall through
    // to '' and print as a dash — a teacher reviewing a paper could see that a
    // matching question existed but not what it asked. The left column is what
    // it asks about.
    ?? matchingLeftText(body['left'])
    // A read-aloud body keeps its text in `passage` and printed as «—».
    ?? (body['passage'] as string | undefined)
    // A dictation body has none of the above — the prompt is spoken, not
    // written. On the teacher's own screen the dictated text IS what the
    // question asks, and showing it here is what lets a teacher read the list
    // aloud to the class when there is no audio (which is the normal case, and
    // the only one that works on a native device).
    ?? dictationText(q)
    ?? '',
  );
}

function dictationText(q: EvaluationQuestion): string | undefined {
  if (q.type !== 'dictation') return undefined;
  if (q.body['mode'] === 'choice') {
    const options = Array.isArray(q.body['options']) ? q.body['options'] : [];
    const labels = options.map(o => (o as { text?: string })?.text).filter(Boolean);
    return labels.length > 0 ? labels.join(' · ') : undefined;
  }
  const text = q.expectedAnswer['text'];
  return typeof text === 'string' && text.trim() ? text.trim() : undefined;
}

function matchingLeftText(left: unknown): string | undefined {
  if (!Array.isArray(left)) return undefined;
  const labels = left.map(l => (l as { text?: string })?.text).filter(Boolean);
  return labels.length > 0 ? labels.join(' · ') : undefined;
}


/**
 * A matching question that carries a `stem` (a worksheet's «صِل» / «رتّب»)
 * printed only the stem once it had one, and the teacher reviewing the draft
 * saw «صِل كل سؤال…» with no problems and no answers. The stem comes first,
 * then the left column numbered and the right column lettered — the same two
 * blocks the projector shows, never paired rows (the right column is shuffled).
 */
function withMatchingItems(q: EvaluationQuestion, stem: string | undefined, isAr: boolean): string | undefined {
  if (stem === undefined || q.type !== 'matching') return stem;
  const texts = (side: unknown) => (Array.isArray(side) ? side : [])
    .map(x => (x as { text?: string })?.text)
    .filter((t): t is string => !!t);
  const left = texts(q.body['left']);
  const right = texts(q.body['right']);
  if (!left.length && !right.length) return stem;
  const num = (i: number) => (isAr ? toArabicDigits(String(i + 1)) : String(i + 1));
  return [
    stem,
    ...left.map((t, i) => `${num(i)}) ${t}`),
    '',
    ...right.map((t, i) => `${optionLetter(i, isAr)}) ${t}`),
  ].join('\n');
}
