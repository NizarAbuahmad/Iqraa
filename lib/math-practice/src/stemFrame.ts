/**
 * The sentence a question is written in, with its numbers and symbols taken out.
 *
 * Two stems with one frame ask the same thing of different numbers: «حلّ
 * المعادلة x² + 3x − 18 = 0 بالتحليل» and «… x² − 11x + 28 = 0 …» are two
 * questions to a checker that compares text, and one question to a teacher
 * reading the paper. Measured 2026-10-15, one frame was on average 58% of an
 * offline maths quiz — so the topic generators spread their draws over frames
 * (`makeTopicItem`), and the evaluation validator warns when one frame
 * dominates a paper (`dominantFrame`).
 *
 * Word by word: a word with a digit or a maths symbol in it, or a single
 * letter (a variable), becomes `#`; any other word keeps its letters. That
 * keeps English stems readable («Solve #»), where stripping every Latin letter
 * would reduce them all to the same frame. Arabic-notation maths («ق(س) = ٢س»)
 * keeps its letter names, so it can only be under-counted, never merged with a
 * different ask.
 */

/** Text after the stem that is not part of the ask: a true/false item's
 *  proposed answer and the answer space a worksheet prints. */
const PADDING = /\n\n(?:الإجابة المقترحة|Proposed answer|الإجابة|Answer|مساحة العمل|Work space):[\s\S]*$/u;

const DIACRITICS = /[ً-ْٰـ]/gu;
const DIGIT = /[0-9٠-٩۰-۹²³¹⁰-⁹₀-₉½¼¾]/u;
const MATH = /[=+\-−–×÷*/^√∛π∞°′″≤≥<>≠≈±|()[\]{}·∑∫θ→⇌⟶]/u;
const LETTERS = /[^\p{L}]/gu;

export function stemFrame(text: string): string {
  const words = text.replace(PADDING, '').replace(DIACRITICS, '').split(/\s+/u);
  const out: string[] = [];
  for (const word of words) {
    if (!word) continue;
    const letters = word.replace(LETTERS, '');
    const token = DIGIT.test(word) || MATH.test(word) || letters.length <= 1 ? '#' : letters.toLowerCase();
    if (token === '#' && out[out.length - 1] === '#') continue;
    out.push(token);
  }
  return out.join(' ');
}
