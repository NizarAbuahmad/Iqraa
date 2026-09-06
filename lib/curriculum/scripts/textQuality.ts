/**
 * Checks that decide whether extracted text is quotable, split out of
 * `extract-text.ts` for the same reason `localSources.ts` was: that file ends
 * in a top-level `await main()`, so importing anything from it runs a full
 * extraction as a side effect. A test that wants to exercise one predicate
 * must not have to pay for that.
 */

/**
 * Word-start pairs that tell a transposed definite article from a real word.
 *
 * One real failure mode moves the article's ل behind the letter that follows
 * it: «الحركة» extracts as «احلركة», «الميكانيكا» as «امليكانيكا». A reader can
 * decode it; a citation cannot survive it, and neither can a model asked to
 * quote the page.
 *
 * A generic ا + consonant + ل probe does not work — Arabic satisfies it
 * honestly all the time (أعلم، اكتمل)، giving every clean file a 10-15% floor
 * and no usable threshold. These four pairs separate because the left member
 * begins a great many words (المعلم، الحركة) while the right member is very
 * nearly a non-word.
 */
const LAM_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['الم', 'امل'],
  ['الح', 'احل'],
  ['الج', 'اجل'],
  ['الخ', 'اخل'],
];

/**
 * The share of definite-article word-starts that came out transposed.
 *
 * Returns `null` under 100 samples rather than a number: an English or
 * figure-heavy PDF is not evidence either way, and letting one stray word
 * condemn a document would be worse than staying silent.
 *
 * Measured across the 49 extracted documents on file when this was written,
 * the clean ones sat at or below 12.7% and the corrupted ones at or above
 * 42.9%, with nothing in between — which is where `LAM_TRANSPOSITION_LIMIT`
 * comes from. Anything that narrows that gap means the threshold needs
 * revisiting.
 */
export function lamTranspositionRate(text: string): number | null {
  const words = text.replace(/[ً-ْٰـ]/g, '').split(/\s+/);
  let good = 0;
  let bad = 0;
  for (const w of words) {
    for (const [ok, swapped] of LAM_PAIRS) {
      if (w.startsWith(ok)) good++;
      else if (w.startsWith(swapped)) bad++;
    }
  }
  if (good + bad < 100) return null;
  return bad / (good + bad);
}

/** Above this share of transposed article-starts, the text is not quotable. */
export const LAM_TRANSPOSITION_LIMIT = 0.4;

/**
 * Whole words that transpose into very nearly non-words.
 *
 * `LAM_PAIRS` above probes the *start* of a word, which catches the article
 * being moved but nothing else. A file can transpose adjacent letters far
 * more widely than that: `islamic-s2-student-book` renders «في» as «يف»,
 * «على» as «عىل» and «الله» as «اهلل» throughout, and scored **18%** on
 * `lamTranspositionRate` — comfortably under its 40% limit — because only
 * «الله»→«اهلل» is an article at all and even that pair is not in the four.
 * It was marked `ingested` off the back of that pass.
 *
 * These three separate for the same reason the article pairs do, only harder:
 * في/على/الله are among the commonest words in Arabic, while يف/عىل/اهلل are
 * words in neither Arabic nor anything else. Matched as whole words, not
 * prefixes, so «يفعل» and «عىلاء» cannot be mistaken for evidence.
 */
const TRANSPOSED_WORDS: ReadonlyArray<readonly [string, string]> = [
  ['في', 'يف'],
  ['على', 'عىل'],
  ['الله', 'اهلل'],
];

/**
 * The share of those three words that came out transposed, or `null` under
 * 100 samples — same reasoning as `lamTranspositionRate`.
 */
export function wordTranspositionRate(text: string): number | null {
  let good = 0;
  let bad = 0;
  for (const w of text.replace(/[ً-ْٰـ]/g, '').split(/\s+/)) {
    for (const [ok, swapped] of TRANSPOSED_WORDS) {
      if (w === ok) good++;
      else if (w === swapped) bad++;
    }
  }
  if (good + bad < 100) return null;
  return bad / (good + bad);
}

/**
 * Above this share, the text is not quotable.
 *
 * Deliberately looser than `LAM_TRANSPOSITION_LIMIT`. Measured across all 80
 * extracted documents on file: every one a human has read and trusted sits at
 * or below 12.3%, then history-s2 at 18.0%, the two Arabic exercise books at
 * ~29%, the two Islamic teacher guides at ~42%, and then nothing at all until
 * `islamic-s2-student-book` at **98.8%**.
 *
 * 0.5 sits in that empty stretch with a wide margin on both sides. It is not
 * 0.4, which would also condemn the two Islamic teacher guides — those are
 * partly transposed and genuinely a grade below clean, but they are the source
 * of a curriculum already shipped, and re-extracting them is its own change
 * with its own verification rather than a side effect of this one. Their rate
 * is recorded in `g10_sources.json` so the decision is visible rather than
 * implied by a threshold.
 */
export const WORD_TRANSPOSITION_LIMIT = 0.5;

const CONTROL_CHAR_RE = /[\x00-\x08\x0e-\x1f]/g;
const ARABIC_PRESENTATION_FORMS_RE = /[ﭐ-﷿ﹰ-﻿]/g;
const BASIC_ARABIC_RE = /[؀-ۿ]/g;

/**
 * Whichever of the five quality gates the text fails, or `null` when it
 * passes all of them. Shared between `extract-text.ts`'s pdf-parse attempt
 * and its OCR fallback so both are held to the same bar — OCR output that
 * happens to be garbage gets rejected exactly like a broken font cmap would
 * be.
 */
export function rejectReason(allText: string): string | null {
  if (!allText.trim()) {
    return 'no text layer';
  }
  // pdf-parse decoding a PDF's embedded font against the wrong cmap does not
  // throw — it returns text, just not text. Found on two real files: 28-37%
  // of the "extracted" characters were C0 control codes (\x00-\x1F), which
  // essentially never appear in real prose. A silent pass here would have
  // shipped noise into a teacher's prompt labelled as a citable page.
  const controlChars = (allText.match(CONTROL_CHAR_RE) ?? []).length;
  if (controlChars / allText.length > 0.05) {
    return 'decoded to mostly non-printable control characters (font cmap likely broken)';
  }
  // Found on three files from the same author: real Arabic, but the PDF
  // encodes it as Arabic Presentation Forms (isolated per-glyph shapes,
  // U+FB50-FEFF) instead of the base Arabic block, and pdf-parse returns
  // them unshaped and with each word's letters in reverse order. Technically
  // decodable by a person turning the page sideways; unusable as a citation
  // or as text handed to a model.
  const presentationForms = (allText.match(ARABIC_PRESENTATION_FORMS_RE) ?? []).length;
  const basicArabic = (allText.match(BASIC_ARABIC_RE) ?? []).length;
  if (presentationForms > basicArabic) {
    return 'Arabic in reversed presentation-form glyphs, not the base Arabic block — unusable without un-shaping';
  }
  // Subtler than the two checks above, and it slips past both: the text is
  // real base-block Arabic with no control characters, only with the
  // definite article’s ل moved one letter right. Found on the physics S1
  // teacher guide after 391,551 characters of it had been extracted, marked
  // `ingested`, and trusted — caught only when a human read a line of it.
  const lamRate = lamTranspositionRate(allText);
  if (lamRate !== null && lamRate > LAM_TRANSPOSITION_LIMIT) {
    return `Arabic with the definite article transposed (الحركة ← احلركة) in ${(lamRate * 100).toFixed(0)}% of samples — readable by eye, not quotable`;
  }
  // The same corruption, wider than the article: this file moves letters in
  // pairs the four article probes never look at. Caught only after
  // `islamic-s2-student-book` passed every gate above at 18% and was marked
  // `ingested` with 98.8% of its في/على/الله transposed.
  const wordRate = wordTranspositionRate(allText);
  if (wordRate !== null && wordRate > WORD_TRANSPOSITION_LIMIT) {
    return `Arabic with letters transposed inside common words (في ← يف) in ${(wordRate * 100).toFixed(0)}% of samples — readable by eye, not quotable`;
  }
  return null;
}
