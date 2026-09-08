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

import wordlists from '../src/data/repair-wordlists.json' with { type: 'json' };

/** Alef-with-hamza forms. A bare alef is never legitimately followed by one. */
const HAMZA_CARRIERS = new Set(['أ', 'إ', 'آ']);
const ALEF = 'ا';
const LAM = 'ل';

/** Tashkeel, superscript alef and tatweel — marks that hang off a letter. */
const MARK = /[ً-ْٰـ]/;

/**
 * A run of Arabic letters and the marks that sit on them — and nothing else.
 *
 * The obvious class, `[؀-ۿ]`, is the whole Arabic block, which also
 * holds the comma (U+060C), the semicolon, the question mark and the
 * Arabic-Indic digits. Tokenising with it glues punctuation onto the word:
 * 52,135 tokens, 7.1% of the corpus, arrive as «املناهج،» rather than
 * «املناهج». Nothing matches a wordlist entry after that, so every repair
 * that needs a lookup silently skipped one token in fourteen.
 */
const ARABIC_RUN = /[\u0621-\u065F\u0670-\u06D3\u06FA-\u06FF]+/gu;

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
 * A combining mark separated from its letter by whitespace, put back.
 *
 * The same extractor that displaces the article also emits case endings as
 * free-standing tokens: «فرضياتُ نظريةِ بور» arrives as «فرضيات ُ نظرية ِ
 * بور». It is the larger of the two defects by volume — 7,044 of 22,494
 * tokens in the chemistry student book alone, 31% — and it is why a page of
 * this text looks shattered even where every letter is right.
 *
 * Unlike the article, this needs no evidence and no guard. A combining mark
 * has no meaning without a base, and whitespace cannot be one, so a mark
 * preceded by a space is always an artifact and there is exactly one letter
 * it can belong to: the one before the space. The `\S` is what keeps it
 * honest — a mark with nothing before it at all is left where it is rather
 * than pulled onto the end of the previous page.
 */
const ORPHAN_MARK = /(\S)\s+([ً-ْٰ]+)/gu;

export function reattachMarks(text: string): string {
  return text.replace(ORPHAN_MARK, '$1$2');
}

/**
 * The same displacement again, at the لا ligature inside a word.
 *
 * «السلام» is stored «السالم», «الصلاة» is stored «الصالة». Identical
 * mechanism to the article — a lam one place to the right — but it happens
 * mid-word, where `untransposeWord` does not look.
 *
 * This one cannot be decided from the shape of the word, and that is the whole
 * difficulty. «العالم» (the world, 120 occurrences) carries an internal «ال»
 * honestly; «الصالة» (the hall) and «صالة» are real words that a book might
 * mean. Nor can the corpus supply its own evidence the way it did for the
 * article's ambiguous class: pdf-parse never emits a correct لا anywhere —
 * «السلام», «الصلاة» and «الإسلام» occur zero times in 735,365 words of it.
 *
 * So the evidence comes from the OCR extractions, which read a rendered page
 * and carry the correct spellings, via a generated wordlist. Two conditions,
 * and the repair needs both:
 *
 *   - the swapped form is in `correct` — the لا spelling is a real word here;
 *   - the original is NOT in `attested` — the ال spelling is not, so it is
 *     the broken form rather than a word the book meant.
 *
 * The second condition blocks 42 forms that the first alone would rewrite,
 * including «الثالث» → «الثلاث» and «مثال» → «مثلا». Dropping it would corrupt
 * 651 occurrences of «مثال» on its own.
 *
 * Coverage is bounded by what the OCR books happen to say: 257 forms and 3,741
 * occurrences at the time of writing. A word neither list has seen is left
 * alone, which is the right way for this to fail.
 */
const LIGATURE_CORRECT: ReadonlySet<string> = new Set(wordlists.correct);
const LIGATURE_ATTESTED: ReadonlySet<string> = new Set(wordlists.attested);

/** Indexes of an internal «ال». Index 0 is the article, repaired elsewhere. */
function internalArticlePositions(word: string): number[] {
  const out: number[] = [];
  for (let i = 1; i < word.length - 1; i++) {
    if (word[i] === ALEF && word[i + 1] === LAM) out.push(i);
  }
  return out;
}

/**
 * Proclitics to try removing before consulting the list.
 *
 * The wordlist holds whole forms, so «والسلامة» is only found if the OCR books
 * happened to use that exact prefixed form twice — «السلامة» appears 38 times
 * and «والسلامة» not at all, leaving «والسالمة» unrepaired for want of a و.
 * Retrying without one or two leading proclitics recovers 106 forms and 453
 * occurrences.
 *
 * ل is included here, unlike in the article repair: nothing assimilates in a
 * plain lookup, and «لل» is a real two-letter prefix.
 */
const LIGATURE_PROCLITICS = new Set(['و', 'ف', 'ب', 'ك', 'ل']);

/** The lookup keys to try: the whole word, then it minus 1-2 proclitics. */
function lookupForms(bases: string): string[] {
  const forms = [bases];
  for (let k = 1; k <= 2 && k < bases.length; k++) {
    if (!LIGATURE_PROCLITICS.has(bases[k - 1])) break;
    forms.push(bases.slice(k));
  }
  return forms;
}

export function repairLigatureWord(word: string): string {
  const { lead, units } = toUnits(word);
  const bases = units.map(u => u.base).join('');

  for (const form of lookupForms(bases)) {
    // The block condition is checked per form: a prefix-stripped body the OCR
    // books attest is just as much a real word as the whole one.
    if (LIGATURE_ATTESTED.has(form)) return word;
    const offset = bases.length - form.length;
    for (const i of internalArticlePositions(form)) {
      const swapped = form.slice(0, i) + LAM + ALEF + form.slice(i + 2);
      if (LIGATURE_CORRECT.has(swapped)) {
        const at = i + offset;
        const out = units.slice();
        const alef = out[at];
        out[at] = out[at + 1];
        out[at + 1] = alef;
        return render(lead, out);
      }
    }
  }
  return word;
}

export function repairLigatures(pages: readonly string[]): string[] {
  return pages.map(page => page.replace(ARABIC_RUN, w => repairLigatureWord(w)));
}

/**
 * The negation «لا» restored where it arrived as the article «ال».
 *
 * The same displacement as everything else here, on a two-letter word: «لا
 * يمكن» is stored «ال يمكن». It is the largest single defect left — 5,239
 * standalone occurrences — and the only repair in this file that can reverse
 * an author's meaning, because a definite article that came away from its noun
 * looks exactly the same, and turning one into "not" negates a sentence that
 * asserted something.
 *
 * So nothing here is decided by shape. `negationBefore` is a generated list of
 * the specific words after which a preceding «ال» has been established to be
 * the negation — imperfect verbs, overwhelmingly, because the article never
 * precedes a verb. A word not on that list keeps its «ال». That is why this
 * repairs 717 of the 5,239 rather than all of them: the rest are either
 * genuine detached articles, or contexts no evidence covers, and both are
 * better left wrong than confidently reversed.
 *
 * The proclitic travels with the word: «وال يبتعد» becomes «ولا يبتعد».
 */
const NEGATION_BEFORE: ReadonlySet<string> = new Set(wordlists.negationBefore);
const BROKEN_NEGATION: ReadonlyMap<string, string> = new Map([
  ['ال', 'لا'],
  ['وال', 'ولا'],
  ['فال', 'فلا'],
]);

export function repairNegations(pages: readonly string[]): string[] {
  return pages.map(page => {
    // Split on whitespace but keep it, so the page is reassembled byte-for-byte
    // apart from the words actually changed.
    const parts = page.split(/(\s+)/);
    for (let i = 0; i < parts.length; i++) {
      const fixed = BROKEN_NEGATION.get(bareLetters(parts[i]));
      if (fixed === undefined) continue;
      let j = i + 1;
      while (j < parts.length && parts[j].trim() === '') j++;
      if (j >= parts.length) continue;
      const next = bareLetters(parts[j].replace(/[^ء-ۿ]/gu, ''));
      if (NEGATION_BEFORE.has(next)) parts[i] = fixed;
    }
    return parts.join('');
  });
}

/**
 * Every pdf-parse ordering artifact, in the order they must be undone.
 *
 * Marks first, so the later rules see whole words rather than fragments. The
 * article before the ligature, because a word can carry both — «اإلسالم» needs
 * the article put back to become «الإسالم» before the ligature rule can
 * recognise it and finish the job as «الإسلام». The negation last, since it
 * reads the word *after* the one it changes and wants that word already
 * repaired before deciding.
 */
export function repairExtraction(pages: readonly string[]): string[] {
  return repairNegations(repairLigatures(untransposeDocument(pages.map(reattachMarks))));
}

/**
 * How many words the article repair changed.
 *
 * Compares word by word at the same index, which is only meaningful when both
 * sides tokenise the same way — so pass it text that has already had its
 * marks reattached, never raw against fully-repaired. Reattaching merges an
 * orphan mark into the word before it, and every index past the first merge
 * then shifts by one: comparing across that boundary reported 882,943
 * "repairs" over a corpus of 734,990 words, which is how the mistake announces
 * itself if it is ever made again.
 */
export function countRepairs(before: readonly string[], after: readonly string[]): number {
  let n = 0;
  for (let i = 0; i < before.length; i++) {
    const a = before[i].match(ARABIC_RUN) ?? [];
    const b = after[i].match(ARABIC_RUN) ?? [];
    if (a.length !== b.length) continue; // tokenisation moved; not comparable
    for (let j = 0; j < a.length; j++) if (a[j] !== b[j]) n++;
  }
  return n;
}

/** How many case endings are sitting apart from their letter. */
export function countDetachedMarks(pages: readonly string[]): number {
  let n = 0;
  for (const page of pages) n += (page.match(ORPHAN_MARK) ?? []).length;
  return n;
}

/** Each repair with its own count, since they are separately reversible. */
export function repairWithCounts(pages: readonly string[]): {
  pages: string[];
  marks: number;
  articles: number;
  ligatures: number;
  negations: number;
} {
  const marks = countDetachedMarks(pages);
  const attached = pages.map(reattachMarks);
  const articled = untransposeDocument(attached);
  const ligatured = repairLigatures(articled);
  const negated = repairNegations(ligatured);
  return {
    pages: negated,
    marks,
    // Each counted against text that tokenises identically to its input: none
    // of the article, ligature or negation swaps changes a word boundary,
    // unlike reattaching marks. See the note on `countRepairs`.
    articles: countRepairs(attached, articled),
    ligatures: countRepairs(articled, ligatured),
    negations: countRepairs(ligatured, negated),
  };
}
