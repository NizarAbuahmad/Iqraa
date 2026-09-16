/**
 * Pre-made practice sheets — generated once, offline, and then frozen.
 *
 * Browsing one costs no AI call and no network: the content sits in
 * `data/premade_worksheets.json` and ships in the bundle. Three reasons, none
 * of them incidental:
 *
 * - The media API answers 503 in production today, so anything served from the
 *   database would render an empty library there and look like a working
 *   screen with nothing in it.
 * - Two teachers opening "the same" sheet must get the same paper. A generator
 *   invoked at browse time cannot promise that.
 * - A sheet a teacher is about to print should not depend on a model call
 *   succeeding while thirty students wait.
 *
 * The cost of freezing is that a defect here is served until someone
 * regenerates the entry by hand, which is why `scripts/build-premade-sheets.ts`
 * prints a review report and the manifest diff is read before it is committed —
 * the same gate `external_resources.json` gets.
 *
 * NOT re-exported from `index.ts`. Unlike `external.ts`, which is metadata
 * small enough to carry everywhere, this is content and grows with the
 * curriculum. Import it by subpath, the way `passages.ts` is imported:
 *
 *   import { premadeForLesson } from '@workspace/curriculum/premade';
 *
 * `PremadeWorksheetContent` mirrors `WorksheetOutput`
 * (`artifacts/mobile/services/ai/AIService.ts`) structurally, because `lib/`
 * may not import from `artifacts/`. That duplication is load-bearing — the
 * sheets are rendered by `buildWorksheetHTML`, which takes a `WorksheetOutput`
 * — so `artifacts/mobile/services/__tests__/premadeSheets.test.ts` holds a
 * compile-time assignability guard. If the two shapes drift, that guard fails
 * rather than the printing silently losing a field.
 */
import raw from './data/premade_worksheets.json' with { type: 'json' };

/**
 * Difficulty band, index-aligned with the worksheet generator's own `Level`.
 * Exported as a value so callers can validate without restating the union.
 */
export const PREMADE_LEVELS = ['easy', 'medium', 'hard'] as const;

export type PremadeLevel = (typeof PREMADE_LEVELS)[number];

/**
 * How one answer key was established. Three states, kept apart on purpose.
 *
 * - `'symbolic'` — the SymPy verifier proved it. Only this may show a badge.
 * - `'bank'` — the question and its key were produced together from the
 *   question bank, so the key is as sound as the template that wrote it. No
 *   verifier saw it. This is the same word the app's own `verifiedBy` uses.
 * - `'none'` — nothing established it. A key a model asserted and nothing
 *   checked is exactly this.
 *
 * `'bank'` exists because folding it into either neighbour would lie in one
 * direction or the other: calling it verified claims a proof nobody ran,
 * calling it `'none'` throws away the fact that the answer was computed rather
 * than guessed.
 */
export type VerificationSource = 'symbolic' | 'bank' | 'none';

export const VERIFICATION_SOURCES: readonly VerificationSource[] = [
  'symbolic',
  'bank',
  'none',
];

export interface KeyVerification {
  num: number;
  verificationSource: VerificationSource;
}

export interface PremadeWorksheetQuestion {
  text: string;
  options?: string[];
  answer?: string;
  points: number;
}

export interface PremadeWorksheetSection {
  type:
    | 'multiple_choice'
    | 'short_answer'
    | 'fill_blank'
    | 'true_false'
    | 'word_problem'
    | 'mixed';
  title: string;
  questions: PremadeWorksheetQuestion[];
}

/** Structural mirror of `WorksheetOutput`. See the module docblock. */
export interface PremadeWorksheetContent {
  title: string;
  instructions: string;
  sections: PremadeWorksheetSection[];
  answerKey: Array<{ num: number; answer: string }>;
  sources?: Array<{ sourceId: string; titleAr: string; page: number }>;
  variantId?: string;
}

export interface PremadeWorksheet {
  /**
   * `pw-<lessonId>-<level>`. Derivable on purpose, so no screen, route or
   * saved row has to persist a mapping from lesson to sheet.
   */
  id: string;
  /**
   * KB lesson id (`kbl-…`). An id, never a title: titles re-resolve to a
   * different lesson for 16 of the picker's 63 lessons.
   */
  lessonId: string;
  gradeId: string;
  subjectId: string;
  level: PremadeLevel;
  titleAr: string;
  titleEn: string;
  content: PremadeWorksheetContent;
  /** One entry per answer key, same length and numbering. */
  keyVerification: KeyVerification[];
  /** ISO timestamp of the offline run that produced this sheet. */
  generatedAt: string;
  promptVersion: string;
  model: string;
}

interface PremadeManifest {
  version: number;
  sheets: PremadeWorksheet[];
}

const MANIFEST = raw as PremadeManifest;

/** Every sheet in the manifest, in committed order (sorted by id). */
export function allPremade(): PremadeWorksheet[] {
  return MANIFEST.sheets;
}

/** The sheets for one lesson — usually one per level, often just `medium`. */
export function premadeForLesson(lessonId: string): PremadeWorksheet[] {
  return MANIFEST.sheets.filter(sheet => sheet.lessonId === lessonId);
}

/** Everything published for a grade and subject, for the resources tab. */
export function premadeForGradeSubject(
  gradeId: string,
  subjectId: string,
): PremadeWorksheet[] {
  return MANIFEST.sheets.filter(
    sheet => sheet.gradeId === gradeId && sheet.subjectId === subjectId,
  );
}
