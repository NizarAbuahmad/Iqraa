/**
 * KB context builder — pure TypeScript, no React Native dependencies.
 *
 * Exported so that both iqra.tsx (runtime) and unit tests can share the
 * exact same trimming logic without mocking any RN imports.
 */

import type { KBLesson } from './knowledgeBase.ts';
import { getBookForLesson, getUnitForLesson } from './knowledgeBase.ts';

// ─── Budget & trimming constants ─────────────────────────────────────────────

/**
 * Soft character budget for the combined KB context passed to the API.
 * Keeps the prompt well within the model's effective context window and
 * prevents silent answer truncation on broad multi-lesson queries.
 */
export const CONTEXT_CHAR_BUDGET = 3000;

/**
 * Content inclusion options for a single lesson block.
 * Trimming happens in priority order (lowest priority first):
 *   examples → terms → concepts (summary + rules are always kept).
 */
export interface BlockOpts {
  maxConcepts: number; // 0 = omit section
  maxTerms:    number; // 0 = omit section
  maxExamples: number; // 0 = omit section
}

/** Progressive trim tiers, applied until total chars fit within the budget. */
export const TRIM_TIERS: BlockOpts[] = [
  { maxConcepts: 4, maxTerms: 2, maxExamples: 2 }, // full fidelity
  { maxConcepts: 4, maxTerms: 2, maxExamples: 0 }, // drop examples
  { maxConcepts: 4, maxTerms: 0, maxExamples: 0 }, // drop terms
  { maxConcepts: 2, maxTerms: 0, maxExamples: 0 }, // halve concepts
  { maxConcepts: 0, maxTerms: 0, maxExamples: 0 }, // summary + rules only
];

// ─── Block builder ────────────────────────────────────────────────────────────

export function buildLessonBlock(
  lesson: KBLesson,
  idx: number,
  multiResult: boolean,
  isAr: boolean,
  opts: BlockOpts,
): string {
  const unit = getUnitForLesson(lesson);
  const book = getBookForLesson(lesson);

  const title     = isAr ? lesson.titleAr       : lesson.titleEn;
  const summary   = isAr ? lesson.summaryAr     : lesson.summaryEn;
  const concepts  = isAr ? lesson.keyConceptsAr : lesson.keyConceptsEn;
  const unitTitle = unit ? (isAr ? unit.titleAr : unit.titleEn) : '';
  const bookTitle = book ? (isAr ? book.titleAr : book.titleEn) : '';

  const lines: string[] = [];

  // Header — numbered when multiple results are present
  const prefix = multiResult
    ? (isAr ? `[مرجع ${idx + 1}] ` : `[Reference ${idx + 1}] `)
    : '';
  lines.push(`📚 **${prefix}${title}**`);
  if (unitTitle) lines.push(isAr ? `الوحدة: ${unitTitle}` : `Unit: ${unitTitle}`);
  lines.push('');

  // Summary (always included)
  lines.push(summary);
  lines.push('');

  // Key concepts
  if (opts.maxConcepts > 0 && concepts.length > 0) {
    lines.push(isAr ? '**المفاهيم الأساسية:**' : '**Key Concepts:**');
    concepts.slice(0, opts.maxConcepts).forEach(c => lines.push(`• ${c}`));
    lines.push('');
  }

  // Key terms
  if (opts.maxTerms > 0 && lesson.keyTerms.length > 0) {
    lines.push(isAr ? '**المصطلحات:**' : '**Key Terms:**');
    lesson.keyTerms.slice(0, opts.maxTerms).forEach(term => {
      const termName   = isAr ? term.ar           : term.en;
      const definition = isAr ? term.definitionAr : term.definitionEn;
      lines.push(`• **${termName}**: ${definition}`);
    });
    lines.push('');
  }

  // Rules & Formulas (always included)
  const rules = isAr ? lesson.rulesAr : lesson.rulesEn;
  if (rules && rules.length > 0) {
    lines.push(isAr ? '**القواعد والصيغ:**' : '**Rules & Formulas:**');
    rules.forEach(r => lines.push(`• ${r}`));
    lines.push('');
  }

  // Examples
  const examples = isAr ? lesson.examplesAr : lesson.examplesEn;
  if (opts.maxExamples > 0 && examples && examples.length > 0) {
    lines.push(isAr ? '**أمثلة:**' : '**Examples:**');
    examples.slice(0, opts.maxExamples).forEach(e => lines.push(`• ${e}`));
    lines.push('');
  }

  lines.push(isAr ? `📖 المصدر: ${bookTitle}` : `📖 Source: ${bookTitle}`);
  return lines.join('\n');
}

// ─── Response builder ─────────────────────────────────────────────────────────

/**
 * Build the KB context string sent to the API.
 * Uses up to 3 top-ranked results so multi-concept questions have full
 * textbook backing for both topics. Enforces a soft character budget by
 * progressively trimming lower-priority content sections (examples first,
 * then terms, then concepts) until the combined string fits within the
 * budget. Summary and rules are always kept.
 */
export function buildResponse(
  query: string,
  results: KBLesson[],
  lang: 'ar' | 'en',
  mode?: string,
): string {
  if (results.length === 0) return '';

  const isAr = lang === 'ar';
  const top = results.slice(0, 3);
  const multiResult = top.length > 1;

  // Try each trim tier until the combined context fits within the budget
  for (const opts of TRIM_TIERS) {
    const blocks = top.map((lesson, idx) =>
      buildLessonBlock(lesson, idx, multiResult, isAr, opts)
    );
    const combined = blocks.join('\n\n---\n\n');
    if (combined.length <= CONTEXT_CHAR_BUDGET) {
      return combined;
    }
  }

  // Absolute fallback: one-liner summaries only (should be unreachable in practice)
  const summaryLines = top.map((lesson, idx) => {
    const prefix = multiResult
      ? (isAr ? `[مرجع ${idx + 1}] ` : `[Reference ${idx + 1}] `)
      : '';
    const title   = isAr ? lesson.titleAr   : lesson.titleEn;
    const summary = isAr ? lesson.summaryAr : lesson.summaryEn;
    return `📚 **${prefix}${title}**\n${summary}`;
  });
  return summaryLines.join('\n\n---\n\n');
}
