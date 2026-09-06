/**
 * KB context builder — pure TypeScript, no React Native dependencies.
 *
 * Exported so that both iqra.tsx (runtime) and unit tests can share the
 * exact same trimming logic without mocking any RN imports.
 */

import type { KBLesson } from './knowledgeBase.ts';
import {
  getBookForLesson,
  getUnitForLesson,
  resolveGroundedKbLesson,
  searchKBRanked,
  searchKBSemantic,
} from './knowledgeBase.ts';
import {
  findNccdSem1LessonByKbId,
  findNccdSem1UnitByLessonKbId,
  isNccdSem1TitleOnlyTier,
} from './curriculumG10MathSem1.ts';
import {
  findNccdLessonByKbId,
  findNccdUnitByLessonKbId,
} from './curriculumG10MathSem2.ts';
import { figuresForLesson } from './bookFigures.ts';
import { buildSupportResourcesContext } from './mathSupportResources.ts';
import { isNccdUnitId } from '@workspace/curriculum';

// ─── Generator KB context ────────────────────────────────────────────────────

export type BuildGeneratorContextOptions = {
  /**
   * Teacher-typed objectives (optional field on lesson-plan screen).
   * When non-empty, these replace curriculum نتاجات in the context block.
   */
  teacherObjectives?: string;
};

export type GeneratorGrounding = {
  /** True only for exact / high-confidence title-aligned KB matches. */
  grounded: boolean;
  lesson: KBLesson | null;
  score: number;
  /** Compact textbook context; empty when ungrounded. */
  context: string;
  /**
   * Explicit note for the model when ungrounded — must not claim curriculum grounding.
   * Empty when grounded.
   */
  ungroundedNote: string;
};

function serializeLessonContext(
  lesson: KBLesson,
  lang: 'ar' | 'en',
  options?: BuildGeneratorContextOptions,
): string {
  const isAr   = lang === 'ar';
  const title    = isAr ? lesson.titleAr       : lesson.titleEn;
  const summary  = isAr ? lesson.summaryAr     : lesson.summaryEn;
  const concepts = isAr ? lesson.keyConceptsAr : lesson.keyConceptsEn;
  const rules    = isAr ? (lesson.rulesAr ?? []) : (lesson.rulesEn ?? []);

  const lines: string[] = [
    isAr ? `📚 الدرس: ${title}` : `📚 Lesson: ${title}`,
    '',
    summary,
  ];

  const teacherObj = options?.teacherObjectives?.trim();
  const nccdS2 = findNccdLessonByKbId(lesson.id);
  const nccdS1 = findNccdSem1LessonByKbId(lesson.id);
  const nccdS1Unit = findNccdSem1UnitByLessonKbId(lesson.id);
  const titleOnlyUnit =
    !!nccdS1Unit && isNccdSem1TitleOnlyTier(nccdS1Unit.data_tier);

  const curriculumObjectives = nccdS2?.objectives?.length
    ? nccdS2.objectives
    : nccdS1?.objectives?.length
      ? nccdS1.objectives
      : (lesson.objectives?.length ? lesson.objectives : []);
  const vocabulary = nccdS2?.vocabulary?.length
    ? nccdS2.vocabulary
    : nccdS1?.vocabulary?.length
      ? nccdS1.vocabulary
      : [];
  const unitObjectives = nccdS1Unit?.unit_objectives ?? [];

  // Teacher objectives are ADDITIVE, never a replacement.
  //
  // This used to be an `if/else if` against the curriculum outcomes, so typing
  // anything at all into the optional objectives box silently deleted the
  // official NCCD نتاجات from the prompt — while the screen still showed
  // «مرتبط بالمنهاج الأردني». A teacher adding one line ended up with a plan
  // that was *less* curriculum-grounded than if they had left the box empty,
  // and nothing said so. Both belong in the prompt: the curriculum defines
  // what must be taught, the teacher's line refines it.
  if (teacherObj) {
    lines.push('');
    lines.push(isAr ? 'النتاجات (من المعلم):' : 'Objectives (teacher):');
    teacherObj.split('\n').map(s => s.trim()).filter(Boolean).forEach(o => lines.push(`• ${o}`));
  }
  if (curriculumObjectives.length > 0) {
    lines.push('');
    lines.push(isAr ? 'النتاجات (من المنهاج الرسمي):' : 'Official curriculum outcomes:');
    curriculumObjectives.forEach(o => lines.push(`• ${o}`));
  } else if (titleOnlyUnit && unitObjectives.length > 0) {
    // Sem1 units 2–4: real lesson title, but outcomes are unit-level only
    const unitTitle = isAr ? nccdS1Unit!.title_ar : nccdS1Unit!.title_en;
    lines.push('');
    lines.push(
      isAr
        ? `النتاجات (على مستوى الوحدة «${unitTitle}» — ليست نتاجات درس محدد):`
        : `Unit-level outcomes for “${unitTitle}” (not lesson-specific):`,
    );
    unitObjectives.forEach(o => lines.push(`• ${o}`));
  }

  if (vocabulary.length > 0) {
    lines.push('');
    lines.push(isAr ? 'المصطلحات:' : 'Vocabulary:');
    vocabulary.forEach(v => lines.push(`• ${v}`));
  }

  if (concepts.length > 0) {
    lines.push('');
    lines.push(isAr ? 'المفاهيم الأساسية:' : 'Key Concepts:');
    concepts.slice(0, 5).forEach(c => lines.push(`• ${c}`));
  }

  if (rules.length > 0) {
    lines.push('');
    lines.push(isAr ? 'القواعد والصيغ:' : 'Rules & Formulas:');
    rules.forEach(r => lines.push(`• ${r}`));
  }

  const support = buildSupportResourcesContext(title, [lesson], lang, 3);
  if (support) {
    lines.push('');
    lines.push(support);
  }

  return lines.join('\n');
}

/**
 * Turn a teacher's free-text adaptation request into a prompt directive.
 *
 * The objectives box is labelled «الأهداف التعليمية», so what a teacher types
 * there is read by the prompt as «الأهداف المحددة» and comes back as the
 * lesson's objective, verbatim. Typing "tailor this plan for a student with
 * ADHD" produced a plan whose sole stated objective was that sentence, in
 * English, with nothing in the body adapted — the request was obeyed to the
 * letter and ignored in substance.
 *
 * An adaptation is an instruction about HOW to write every section, not a
 * thing the students should be able to do by the end. It needs its own field
 * and its own framing, pointed at the التمايز/differentiation slot the output
 * schema already has.
 *
 * Returns '' for empty input so callers can `.filter(Boolean)` it away.
 */
export function buildAdaptationsDirective(text: string, lang: 'ar' | 'en'): string {
  const body = text.trim();
  if (!body) return '';
  return lang === 'ar'
    ? `تعليمات المعلّم — طبّقها في كل أقسام الخطة (التمهيد، النشاط، التدريب، الختام، التقييم)، `
      + `وفصّلها صراحةً في حقل "التمايز". هذه تعليمات تنفيذ وليست نتاجات تعلّم، `
      + `فلا تُدرجها ضمن الأهداف:\n${body}`
    : `Teacher instructions — apply these across every section of the plan `
      + `(introduction, activity, practice, closure, assessment) and spell them out `
      + `in the "differentiation" field. These are delivery instructions, not learning `
      + `outcomes, so do not list them among the objectives:\n${body}`;
}

/**
 * One display line for the textbook pages a generation actually cites.
 *
 * `GroundedSource[]` (see `ai/AIService.ts`) is a level more specific than
 * `resolveGeneratorGrounding`'s `grounded` flag: the lesson can resolve while
 * the server still finds no extracted book passages for it — most lessons
 * today, since only six books are ingested. When sources *are* present, this
 * is the page a teacher can hold the printed book open to and check.
 *
 * Returns '' for an empty list so callers can render conditionally on truthiness.
 */
export function sourceCitationLine(
  sources: readonly { titleAr: string; page: number }[],
  isAr: boolean,
): string {
  if (!sources.length) return '';
  const arabicDigits = (n: number) => String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!);
  return sources
    .map(s => (isAr ? `${s.titleAr} · صفحة ${arabicDigits(s.page)}` : `${s.titleAr} · page ${s.page}`))
    .join(isAr ? '، ' : ', ');
}

/**
 * Resolve whether a topic is curriculum-grounded for generation.
 * Weak fuzzy hits are rejected — never silently substitute an unrelated lesson.
 */
export function resolveGeneratorGrounding(
  topic: string,
  lang: 'ar' | 'en',
  options?: BuildGeneratorContextOptions,
): GeneratorGrounding {
  const lesson = resolveGroundedKbLesson(topic, lang);
  if (!lesson) {
    const isAr = lang === 'ar';
    return {
      grounded: false,
      lesson: null,
      score: 0,
      context: '',
      ungroundedNote: isAr
        ? 'تنبيه: الموضوع غير موجود في المنهاج المتاح حالياً. أنشئ خطة عامة دون الادعاء أنها مبنية على نتاجات درس محدد من الكتاب.'
        : 'NOTE: topic not found in the available curriculum KB. Generate a generic plan; do not claim textbook grounding.',
    };
  }

  const ranked = searchKBRanked(topic, lang);
  const score = ranked.find(r => r.lesson.id === lesson.id)?.score ?? 0;
  return {
    grounded: true,
    lesson,
    score,
    context: serializeLessonContext(lesson, lang, options),
    ungroundedNote: '',
  };
}

/**
 * The curriculum context to send with a generation request.
 *
 * Returns the lesson's textbook context when the topic is grounded, and the
 * *ungrounded note* when it is not — never an empty string.
 *
 * It used to return `''` when ungrounded, "so callers can fall back to generic
 * generation". Every one of the seven callers then wrote
 * `buildGeneratorContext(...) || undefined`, so the note — the sentence that
 * tells the model not to claim textbook grounding it does not have — reached a
 * prompt from exactly none of them. `lesson-plan.tsx` and `worksheet.tsx` were
 * unaffected only because they bypass this function and read
 * `resolveGeneratorGrounding` themselves.
 *
 * Returning the note is what makes the fallback safe by default rather than by
 * remembering. A caller that genuinely wants nothing can read `.context` off
 * `resolveGeneratorGrounding`, which is explicit about what it is skipping.
 */
export function buildGeneratorContext(
  topic: string,
  lang: 'ar' | 'en',
  options?: BuildGeneratorContextOptions,
): string {
  const grounding = resolveGeneratorGrounding(topic, lang, options);
  return grounding.grounded ? grounding.context : grounding.ungroundedNote;
}

/**
 * The catalog unit a topic belongs to, for the server to fetch book pages with.
 *
 * The API resolves a unit from the free-text topic when this is absent, but a
 * title match can be ambiguous where the app's own lookup is not: the screen
 * knows which lesson the teacher picked. `null` when ungrounded, or when the
 * lesson is one of the legacy hardcoded rows whose unit ids (`kbu-chem-1`) are
 * not in the NCCD namespace the bank indexes by.
 */
export function generatorUnitId(topic: string, lang: 'ar' | 'en'): string | undefined {
  return nccdUnitId(resolveGeneratorGrounding(topic, lang).lesson?.unitId);
}

/**
 * The curriculum lesson id a topic grounds to, for the server to key the
 * shared artifact pool on.
 *
 * The id, not the title, because the pool is shared between teachers and a
 * title does not identify a lesson: CLAUDE.md records `searchKBSemantic(title)`
 * returning a *different* lesson for 16 of the picker's 63 («قانون الجيوب» →
 * «قانون جيب التمام»). Keying on a normalised title meant two lessons could
 * collide onto one key; before there was a pool that was a bad log line, and
 * with one it is teacher A being served teacher B's lesson.
 *
 * `undefined` when the topic is free-typed and grounds to nothing — the server
 * falls back to the normalised topic, which is a correct key for a lesson that
 * exists nowhere in the curriculum.
 */
export function generatorLessonId(topic: string, lang: 'ar' | 'en'): string | undefined {
  return resolveGeneratorGrounding(topic, lang).lesson?.id;
}

/**
 * How many student-book figures this topic's lesson has — the `AIRequest`
 * field of the same name.
 *
 * Sits beside `generatorLessonId` because it answers the same question from
 * the same grounding, and every screen that sends one should send the other:
 * the server uses it to decide whether the model may write «في الشكل
 * المجاور», and that is only true when the paper's appendix will carry a
 * figure to look at.
 *
 * Counts the index, not the bundle. `figuresForLesson` is the same lookup
 * `bookFigureRefsForLesson` starts from, minus the `react-native` asset
 * resolution — which this module must stay clear of, and which can only ever
 * *reduce* the count (an unbundled crop is dropped at render). Over-counting
 * by an unbundled figure would at worst permit a reference the appendix does
 * not honour, so the drift test on `bookFigureAssets.ts` is what keeps the two
 * in step; there is no cheap way to ask the bundler from here.
 */
export function generatorFigureCount(topic: string, lang: 'ar' | 'en'): number {
  return figuresForLesson(generatorLessonId(topic, lang)).length;
}

/**
 * A unit id the knowledge bank can index by, or `undefined`.
 *
 * The KB carries two unit-id namespaces: NCCD-derived lessons use
 * `kbu-math-s1-nccd-u2`, and the legacy hardcoded rows use `kbu-chem-1`. Only
 * the first is what `bankTagsForUnit()` maps onto bank tags, so sending the
 * second would just be a string the server cannot resolve. Filtering here
 * keeps that judgement in one place rather than in each screen.
 */
export function nccdUnitId(unitId: string | null | undefined): string | undefined {
  return isNccdUnitId(unitId) ? unitId ?? undefined : undefined;
}

/**
 * Unit-level "تعلمت سابقًا" / prior-knowledge concepts for a grounded lesson.
 * Returns [] when the unit has no `prior_knowledge` in NCCD JSON yet.
 * Does not fabricate content.
 */
export function getUnitPriorKnowledge(lessonKbId: string): string[] {
  const s1 = findNccdSem1UnitByLessonKbId(lessonKbId);
  if (s1?.prior_knowledge?.length) return [...s1.prior_knowledge];
  const s2 = findNccdUnitByLessonKbId(lessonKbId);
  if (s2?.prior_knowledge?.length) return [...s2.prior_knowledge];
  return [];
}

// ─── Subject ambiguity detection ─────────────────────────────────────────────

/**
 * Inspect the top-N KB results and return the distinct subject IDs found.
 * Returns `null` when all results belong to the same subject (no ambiguity).
 * Returns an array of 2+ subject IDs when results span multiple subjects —
 * the caller should ask the teacher to clarify before invoking the AI.
 *
 * We look at the top 5 results because `deduplicateByUnit` can reduce the
 * visible set; checking a wider window avoids missing cross-subject matches.
 */
export function detectSubjectAmbiguity(results: KBLesson[]): string[] | null {
  const top = results.slice(0, 5);
  const subjectIds = new Set<string>();
  for (const lesson of top) {
    const book = getBookForLesson(lesson);
    if (book) subjectIds.add(book.subjectId);
  }
  return subjectIds.size > 1 ? Array.from(subjectIds) : null;
}

/**
 * Filter a ranked KB results array to only lessons belonging to the given
 * subject. Used after the teacher selects a subject from a clarification chip.
 */
export function filterResultsBySubject(
  results: KBLesson[],
  subjectId: string,
): KBLesson[] {
  return results.filter(lesson => {
    const book = getBookForLesson(lesson);
    return book?.subjectId === subjectId;
  });
}

// ─── Unit deduplication ───────────────────────────────────────────────────────

/**
 * Given lessons ranked by relevance (highest score first), return up to
 * `maxResults` lessons ensuring **at most one lesson per curriculum unit**.
 *
 * Why: `searchKBSemantic` can return multiple lessons from the same unit (e.g.
 * kbl-math-2-1, kbl-math-2-2, kbl-math-2-3 for "explain derivatives"). Passing
 * three overlapping blocks wastes the character budget and causes the model to
 * repeat itself. Deduplicating by unit lets the budget serve genuinely distinct
 * topics while still honouring the relevance ranking within the kept slots.
 *
 * Algorithm: iterate the full ranked list; add each lesson only if its unit has
 * not been seen yet. Stop when `maxResults` distinct-unit lessons are collected.
 */
export function deduplicateByUnit(ranked: KBLesson[], maxResults = 3): KBLesson[] {
  const seenUnits = new Set<string>();
  const selected: KBLesson[] = [];
  for (const lesson of ranked) {
    if (selected.length >= maxResults) break;
    if (!seenUnits.has(lesson.unitId)) {
      seenUnits.add(lesson.unitId);
      selected.push(lesson);
    }
  }
  return selected;
}

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
  const supportBlock = buildSupportResourcesContext(query, top, lang, 4);

  // Try each trim tier until the combined context fits within the budget
  for (const opts of TRIM_TIERS) {
    const blocks = top.map((lesson, idx) =>
      buildLessonBlock(lesson, idx, multiResult, isAr, opts)
    );
    const combined = [blocks.join('\n\n---\n\n'), supportBlock].filter(Boolean).join('\n\n');
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
  const fallback = summaryLines.join('\n\n---\n\n');
  return supportBlock ? `${fallback}\n\n${supportBlock}` : fallback;
}
