/**
 * Option lettering for exported material (PDF, print, share text).
 *
 * Two things were wrong in every Arabic export at once:
 *
 *  - Options were lettered with `String.fromCharCode(65 + i)`, so an Arabic
 *    worksheet handed to a Grade 10 class was labelled A/B/C/D. Teachers mark
 *    against أ/ب/ج/د, and a student answering "ج" against a paper printed with
 *    "C" is being asked to translate mid-exam.
 *  - Live AI usually returns options that *already* carry a marker
 *    ("أ) الوقت"), while the mock generator returns bare text. Lettering
 *    unconditionally produced "أ) الوقت A." — two markers, in two scripts, on
 *    one line. That is what made the printed paper look broken.
 *
 * So option text is normalised first and lettered second: whatever the model
 * did, the exported line carries exactly one marker, in the document's script.
 *
 * The marker is followed by `.` in both languages rather than `)`. A closing
 * parenthesis is a bidi-mirrored character — inside an RTL run the glyph flips,
 * so a literal "أ)" prints as "(أ".
 */

/**
 * أ ب ج د … — abjad order, which is how Arabic enumerates. It is not the
 * alphabetical order (أ ب ت ث), and using the latter is the classic tell that
 * a list was lettered by someone who does not read the language.
 */
const ABJAD = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح', 'ط', 'ي'];

/**
 * A marker the generator already baked into the option text. Deliberately
 * requires a delimiter: bare "و الوقت" is the word "and", not option (و), so
 * only "و." / "و)" / "و-" counts as lettering. Latin letters, western digits
 * and Arabic-indic digits are all covered because models mix all three.
 */
const BAKED_IN_MARKER =
  /^\s*(?:هـ|[A-Za-z]|[0-9٠-٩]{1,2}|[أابجدهوزحطي])\s*[).\-–—:]\s*/;

/** The letter for a zero-based option index, in the export's language. */
export function optionLetter(index: number, isAr: boolean): string {
  if (!isAr) return String.fromCharCode(65 + index);
  return ABJAD[index] ?? String(index + 1);
}

/**
 * Drop a marker the generator already wrote into the option text.
 *
 * Falls back to the original when stripping would empty the option — an option
 * whose entire text is "أ)" is malformed, but printing a blank line loses the
 * only evidence a teacher has that the generation went wrong.
 */
export function stripOptionPrefix(text: string): string {
  const stripped = text.replace(BAKED_IN_MARKER, '').trim();
  return stripped.length > 0 ? stripped : text.trim();
}

/** Marker + cleaned text, for a caller rendering them in separate elements. */
export function labelOption(
  text: string,
  index: number,
  isAr: boolean,
): { letter: string; text: string } {
  return { letter: `${optionLetter(index, isAr)}.`, text: stripOptionPrefix(text) };
}

/** Marker + cleaned text as one string, for plain-text and single-node exports. */
export function labelOptionLine(text: string, index: number, isAr: boolean): string {
  const { letter, text: body } = labelOption(text, index, isAr);
  return `${letter} ${body}`;
}

/**
 * The answer-key line for a question, lettered to match the printed paper.
 *
 * `correctAnswer` holds option *text*, and when the model baked a marker into
 * it that marker is the model's, not ours — options are lettered by position,
 * so a model that emitted its choices out of order leaves a key reading "أ)
 * الوقت" against a paper where الوقت prints as (ب). The letter is therefore
 * re-derived from where the answer actually sits in `options`.
 *
 * Falls back to the answer verbatim when there are no options (short answer) or
 * when it matches none of them — a key that quietly relabels an answer it could
 * not find is worse than one that shows what the generator produced.
 */
export function labelAnswer(
  options: string[] | undefined,
  correctAnswer: string,
  isAr: boolean,
): string {
  if (!options?.length) return correctAnswer;
  const target = stripOptionPrefix(correctAnswer);
  const index = options.findIndex(o => stripOptionPrefix(o) === target);
  return index >= 0 ? labelOptionLine(options[index], index, isAr) : correctAnswer;
}

/**
 * Strip generator-supplied markers from a question's options as it arrives, so
 * the marker lives in exactly one place — the renderer — for every surface.
 *
 * Doing this at the display layer alone is not enough: the quiz screen lets a
 * teacher edit option text, so an option displayed stripped but stored prefixed
 * would silently rewrite itself on the first edit. Cleaning on receipt keeps
 * the stored material and every view of it the same string.
 *
 * `correctAnswer` is carried across by position rather than re-stripped
 * independently: it holds option *text*, so an answer key that no longer
 * matches any option is a question with no correct choice — the exact failure
 * `quizEdits.ts` exists to prevent.
 */
export function normalizeQuestionOptions<
  T extends { options?: string[]; correctAnswer?: string },
>(question: T): T {
  if (!question.options?.length) return question;
  const options = question.options.map(stripOptionPrefix);
  const matched = question.options.findIndex(o => o === question.correctAnswer);
  const correctAnswer = matched >= 0
    ? options[matched]
    : question.correctAnswer === undefined
      ? question.correctAnswer
      : stripOptionPrefix(question.correctAnswer);
  return { ...question, options, correctAnswer };
}
