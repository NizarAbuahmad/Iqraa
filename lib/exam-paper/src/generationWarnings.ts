/**
 * What `POST /evaluations/:id/generate` can say about a paper it made, as a
 * code and its parameters rather than as a sentence.
 *
 * The API wrote these as English sentences (later also Arabic ones) and the app
 * carried the sentence it picked through the `/evaluations/[id]` URL, so the
 * teacher read whatever language the sentence happened to be in — English
 * under an Arabic paper, on a build that predated the Arabic list. The app now
 * words each warning itself, from `services/i18n.ts`, at display time. The API
 * still sends its `warnings` / `warningsAr` sentences beside the codes, one for
 * one, for an app that predates them or a code it does not know.
 *
 * Parameters are data, never wording: counts, positions, question-type ids,
 * competency keys, and content that is already the teacher's (a question's own
 * stem, a book's title). A new warning needs an entry here, a key in both
 * languages of `services/i18n.ts` (`GEN_WARNING_KEYS` in
 * `artifacts/mobile/services/generationWarnings.ts`, a typed Record, so the
 * typechecker finds a missing one), and the producer that raises it.
 */

/** A book or guide page a live paper was written from. */
export interface GroundingSourceRef {
  title: string;
  page: number | string;
}

/** How many of each kind of library document hold real items for the units. */
export interface LibraryCounts {
  questionBanks: number;
  pastPapers: number;
  answerKeys: number;
  /** Documents that are a named teacher's own work, never to be copied word for word. */
  referenceOnly: number;
  /** All library documents for these units. */
  documents: number;
}

export type GenerationWarning =
  // The validator (`modules/assessment/validator.ts`).
  | { code: 'objectives_uncovered'; params: { count: number; ids: string[] } }
  | { code: 'competency_single'; params: { competency: string } }
  | { code: 'competency_missing'; params: { competency: string } }
  | { code: 'true_false_one_sided'; params: { count: number; total: number; value: boolean } }
  /** `position` is 0-based. */
  | { code: 'choice_position_bunched'; params: { count: number; total: number; position: number } }
  | { code: 'same_ask'; params: { count: number; total: number; example: string } }
  // Answer-key verification (`modules/assessment/keyVerification.ts`).
  | { code: 'keys_unlinked'; params: { count: number } }
  | { code: 'verifier_unreachable'; params: Record<string, never> }
  /**
   * `questions` are 1-based positions on the paper. `details` holds, per
   * question, what the verifier derived and what the key says — maths in Latin
   * notation, not wording.
   */
  | {
    code: 'keys_contradicted';
    params: { questions: number[]; details: { question: number; derived: string; key: string }[] };
  }
  // The template generator (`modules/assessment/mockGenerator.ts`).
  | { code: 'no_objectives'; params: Record<string, never> }
  | { code: 'no_type_producible'; params: Record<string, never> }
  | { code: 'types_skipped'; params: { types: string[] } }
  | { code: 'library_holds'; params: LibraryCounts }
  | { code: 'shortfall'; params: { made: number; requested: number } }
  | { code: 'restatements_skipped'; params: { count: number } }
  // The model generator (`modules/assessment/llmGenerator.ts`).
  | { code: 'model_discarded'; params: { count: number } }
  // The route (`modules/assessment/generationNotes.ts`).
  | { code: 'first_grade_types_dropped'; params: { used: string[]; dropped: string[] } }
  | { code: 'grounded_on'; params: { sources: GroundingSourceRef[] } }
  | { code: 'not_grounded'; params: Record<string, never> }
  | { code: 'model_surplus_trimmed'; params: { trimmed: number; asked: number } }
  | { code: 'book_items_drawn'; params: { count: number } }
  | { code: 'book_items_short'; params: { drawn: number; planned: number } }
  | { code: 'surplus_trimmed'; params: { surplus: number; requested: number } }
  | { code: 'no_key_checked'; params: Record<string, never> }
  // The teacher's chosen total (`modules/assessment/marksTotal.ts`).
  | { code: 'marks_shared_short'; params: { written: number; requested: number; marks: number; target: number } }
  | { code: 'marks_total_unreachable'; params: { target: number; questions: number; kept: number } };

export type GenerationWarningCode = GenerationWarning['code'];

/** Every code, once. A Record so that adding a code to the union without listing it here fails the typecheck. */
const CODES: Record<GenerationWarningCode, true> = {
  objectives_uncovered: true,
  competency_single: true,
  competency_missing: true,
  true_false_one_sided: true,
  choice_position_bunched: true,
  same_ask: true,
  keys_unlinked: true,
  verifier_unreachable: true,
  keys_contradicted: true,
  no_objectives: true,
  no_type_producible: true,
  types_skipped: true,
  library_holds: true,
  shortfall: true,
  restatements_skipped: true,
  model_discarded: true,
  first_grade_types_dropped: true,
  grounded_on: true,
  not_grounded: true,
  model_surplus_trimmed: true,
  book_items_drawn: true,
  book_items_short: true,
  surplus_trimmed: true,
  no_key_checked: true,
  marks_shared_short: true,
  marks_total_unreachable: true,
};

export const GENERATION_WARNING_CODES = Object.keys(CODES) as GenerationWarningCode[];

/**
 * True when `value` has a code this build knows and an object of parameters.
 * Says nothing about the parameters' shapes: whoever words a warning reads
 * them defensively, because they arrive over the network or through a URL.
 */
export function isGenerationWarning(value: unknown): value is GenerationWarning {
  if (typeof value !== 'object' || value === null) return false;
  const { code, params } = value as { code?: unknown; params?: unknown };
  return typeof code === 'string'
    && Object.prototype.hasOwnProperty.call(CODES, code)
    && typeof params === 'object' && params !== null && !Array.isArray(params);
}
