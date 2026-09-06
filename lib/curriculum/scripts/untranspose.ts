/**
 * Puts the definite article back where the page has it.
 *
 * `pdf-parse` reads these NCCD books' glyphs correctly and orders them
 * wrongly: the ل of ال lands one position late, so «الإنسان» is stored as
 * «اإلنسان». Every character is right, which is why the text survives a
 * reader's eye and why nothing downstream notices — and it is also why the
 * defect is repairable rather than merely detectable, unlike an OCR
 * misreading, which invents a letter that was never there.
 *
 * `textQuality.ts` measures this and rejects above 40%. That gate is a floor
 * against unusable text, not a guarantee of clean text: measured across the
 * 74 pdf-parse extractions on file, **every one carrying meaningful Arabic is
 * affected**, at 24,000 occurrences in total, all of it under the threshold
 * and all of it marked `ingested`. Detection was never the missing piece.
 *
 * Three classes, and they are not equally safe:
 *
 *   1. ا + hamza-carrier (أ إ آ) + ل  — 17,849 occurrences. No Arabic word
 *      begins with a bare alef followed by a hamza carrier, so this sequence
 *      can only be the defect. Repaired unconditionally.
 *   2. ا + ا + ل — 4,033. «الاقتران» stored as «االقتران». No word begins
 *      with two alefs either. Repaired unconditionally.
 *   3. ا + consonant + ل — 2,320. Ambiguous, and this is where a blind rule
 *      does damage: «اسلوب» would become «السوب». Repaired only when the
 *      resulting stem is attested elsewhere in the same document.
 *
 * Class 3's guard reads the document rather than a bundled wordlist because
 * a word that is not preceded by the article is untouched by the defect, so
 * the document's own un-prefixed vocabulary is clean evidence and needs
 * nothing shipped alongside it. Scoring against the whole corpus instead
 * would repair 84.3% of class 3 rather than 62.9% — 479 more occurrences out
 * of ~24,000, which is not worth making the repair of one file depend on the
 * other seventy-three.
 *
 * What it deliberately does not do: «ازلبػ» and friends come from a broken
 * font cmap, not from this defect, and the class-3 guard declines them
 * because no stem of theirs is attested anywhere. They are a different
 * failure with a different fix, and quietly rewriting them here would hide
 * it.
 */

/** Alef-with-hamza forms. A bare alef is never legitimately followed by one. */
const HAMZA_CARRIERS = new Set(['أ', 'إ', 'آ']);
const ALEF = 'ا';
const LAM = 'ل';

/** Tashkeel, superscript alef and tatweel — marks that hang off a letter. */
const MARK = /[ً-ْٰـ]/;
const ARABIC_RUN = /[؀-ۿ]+/g;

/**
 * One base letter plus whatever marks trail it, so a swap carries a letter's
 * vowel with it instead of stranding it on the letter that moved into place.
 *
 * 211 of the 21,927 unambiguous instances carry a mark inside the three
 * letters the swap touches («اُألُردن»), which is few enough to miss by eye
 * and quite enough to corrupt.
 */
interface Unit {
  base: string;
  marks: string;
}

function toUnits(word: string): { lead: string; units: Unit[] } {
  const units: Unit[] = [];
  let lead = '';
  for (const ch of word) {
    if (MARK.test(ch)) {
      if (units.length === 0) lead += ch;
      else units[units.length - 1].marks += ch;
    } else {
      units.push({ base: ch, marks: '' });
    }
  }
  return { lead, units };
}

function render(lead: string, units: Unit[]): string {
  return lead + units.map(u => u.base + u.marks).join('');
}

/** Move the article's ل from position 2 back to position 1, marks and all. */
function swapArticle(units: Unit[]): Unit[] {
  const out = units.slice();
  const displaced = out[1];
  out[1] = out[2];
  out[2] = displaced;
  return out;
}

/**
 * «الله» does not come through as a one-place shift.
 *
 * Its bases arrive as ا ه ل ل where the page reads ا ل ل ه — the ه travels to
 * the front rather than the ل travelling back, because what the PDF holds is
 * the ﷲ ligature and not four letters. The generic swap would produce
 * «الهل», so this is matched first and rotated rather than swapped. 82
 * occurrences.
 */
function isAllah(units: Unit[]): boolean {
  return units.length >= 4
    && units[0].base === ALEF
    && units[1].base === 'ه'
    && units[2].base === LAM
    && units[3].base === LAM;
}

function fixAllah(units: Unit[]): Unit[] {
  const [alef, haa, lam1, lam2, ...rest] = units;
  return [alef, lam1, lam2, haa, ...rest];
}

/**
 * Single-letter proclitics that can sit in front of the article.
 *
 * The article is not always word-initial — «والأرض», «بالحركة» — and 2,612
 * occurrences on file sit behind one of these, 12% on top of the 21,927 that
 * start the word. Only the genuine proclitics are listed: و ف (conjunctions)
 * and ب ك (prepositions), stacked at most two deep («وبال»).
 *
 * ل is deliberately absent. It assimilates into the article («للإنسان», not
 * «لالإنسان»), so a ل before this pattern is not the case this repairs.
 *
 * The scan stops there rather than accepting any prefix, because the same
 * measurement turned up «مج», «تص» and «ناإلنسا» in front of the pattern.
 * Those are scrambled words from a different failure, and stretching the rule
 * to cover them would rewrite corruption into plausible-looking text.
 */
const PROCLITICS = new Set(['و', 'ف', 'ب', 'ك']);
const MAX_PROCLITICS = 2;

/**
 * Shortest stem that counts as evidence in class 3.
 *
 * Without this the guard is worthless: «اطلب» offers the stem «طب» and
 * «اقل» offers «ق», and a one- or two-letter string appears in any Arabic
 * document by accident, so everything matched and «اطلب» (I request) was
 * being rewritten to «الطب» (medicine).
 *
 * Three is measured, not guessed — see the note on `articleAt`.
 */
const MIN_STEM = 3;

/**
 * Where the article starts, or -1 if this word does not carry the defect.
 *
 * `allowProclitic` is false for class 3 and true for the unambiguous classes,
 * and that asymmetry is the whole safety story. Combining a proclitic with an
 * ambiguous body reads «كامل» as ك + «امل» and turns it into «كالم» — two
 * real words, silently swapped. Restricting class 3 to word-initial removes
 * that entire family.
 *
 * Both knobs were chosen against a control: the eight OCR extractions do not
 * carry this defect, so any class-3 repair made in them is a false positive.
 * Sweeping the two settings over the corpus:
 *
 *   proclitic  min stem | pdf-parse repairs   OCR false positives
 *   yes        none     |            2265                     142
 *   yes        3        |            1478                      14
 *   yes        4        |            1316                       0
 *   no         2        |            1482                      20
 *   **no       3**      |          **1330**                   **0**
 *
 * Word-initial with a three-letter stem is the highest yield that costs
 * nothing: every other setting either corrupts real words or repairs less.
 */
function articleAt(units: readonly Unit[], allowProclitic: boolean): number {
  const limit = allowProclitic ? MAX_PROCLITICS : 0;
  for (let i = 0; i <= limit && i + 2 < units.length; i++) {
    if (units[i].base === ALEF) return i;
    if (!PROCLITICS.has(units[i].base)) return -1;
  }
  return -1;
}

/**
 * Repair one word. `isAttested` decides class 3 and is never consulted for
 * classes 1 and 2, which need no evidence.
 */
export function untransposeWord(word: string, isAttested: (stem: string) => boolean): string {
  const { lead, units } = toUnits(word);
  if (units.length < 3) return word;

  const at = articleAt(units, true);
  if (at < 0) return word;

  const body = units.slice(at);
  if (isAllah(body)) {
    return render(lead, [...units.slice(0, at), ...fixAllah(body)]);
  }
  if (body.length < 3 || body[2].base !== LAM) return word;

  const second = body[1].base;
  if (second === LAM) return word; // already «ال», nothing displaced

  const repaired = (): string =>
    render(lead, [...units.slice(0, at), ...swapArticle(body)]);

  // Classes 1 and 2 are unambiguous wherever they sit, proclitic or not.
  if (HAMZA_CARRIERS.has(second) || second === ALEF) return repaired();

  // Class 3 is ambiguous, so it gets neither the proclitic nor a short stem.
  if (at !== 0) return word;
  const stem = body[1].base + body.slice(3).map(u => u.base).join('');
  if (stem.length < MIN_STEM) return word;
  return isAttested(stem) ? repaired() : word;
}

/** Base letters only — the form the attestation index is keyed on. */
function bareLetters(word: string): string {
  let out = '';
  for (const ch of word) if (!MARK.test(ch)) out += ch;
  return out;
}

/**
 * Repair a whole document, one page of text per entry.
 *
 * Takes every page at once because class 3's evidence is the document's
 * vocabulary: a stem attested on page 4 has to be usable when repairing page
 * 90, and repairing pages independently would make the result depend on
 * where in the book a word happened to fall.
 */
export function untransposeDocument(pages: readonly string[]): string[] {
  const vocabulary = new Set<string>();
  for (const page of pages) {
    for (const word of page.match(ARABIC_RUN) ?? []) vocabulary.add(bareLetters(word));
  }
  const isAttested = (stem: string): boolean =>
    vocabulary.has(stem) || vocabulary.has(ALEF + LAM + stem);

  return pages.map(page =>
    page.replace(ARABIC_RUN, word => untransposeWord(word, isAttested)),
  );
}

/** Single-string convenience; the document is its own vocabulary. */
export function untransposeText(text: string): string {
  return untransposeDocument([text])[0];
}

/**
 * How many words the repair changed. Reported at extraction time so a run
 * says what it did rather than silently rewriting a book.
 */
export function countRepairs(before: readonly string[], after: readonly string[]): number {
  let n = 0;
  for (let i = 0; i < before.length; i++) {
    const a = before[i].match(ARABIC_RUN) ?? [];
    const b = after[i].match(ARABIC_RUN) ?? [];
    for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) n++;
  }
  return n;
}
