/**
 * Regenerate the wordlists the two evidence-based repairs consult.
 *
 * Run: node --experimental-strip-types scripts/build-repair-wordlists.ts
 *
 * Both repairs need to know something the shape of a word cannot tell them,
 * and both get it from the OCR extractions, which read a rendered page and so
 * never carry pdf-parse's ordering defects.
 *
 * ---- the لا ligature ----
 *
 *   correct  — words containing لا, seen at least twice. Licenses a repair.
 *   attested — words containing an internal ال. Blocks one, because the ال
 *              spelling is a real word too and the swap would be a guess.
 *
 * Without the blocking half «الثالث» becomes «الثلاث» and «مثال» — 651
 * occurrences — becomes «مثلا».
 *
 * ---- the standalone negation ----
 *
 * «لا» (not) arrives as «ال» (the), 5,239 times. A blanket swap is not
 * available: some of those really are articles that came away from their noun,
 * and turning one into "not" inverts the sentence it sits in. So this emits a
 * decision list rather than a rule — the specific following words after which
 * a preceding «ال» has been established to be the negation:
 *
 *   negationBefore — word W such that «ال W» should read «لا W».
 *
 * A word earns a place two ways, and is disqualified by one:
 *
 *   - it was seen at least twice directly after a real negation in OCR text
 *     («يمكن», «يجوز», «يوجد» — the imperfect verbs the negation governs); or
 *   - it looks like an imperfect verb (ي ت ن أ prefix) and the OCR books use
 *     it as a word, since **the definite article never precedes a verb**, so
 *     an ال in front of one cannot be an article;
 *   - unless «ال»+W is itself an attested word, in which case the ال is a
 *     detached article and must be left alone. That check reads both corpora:
 *     the pdf-parse side is now spelled correctly and is four times the size,
 *     and it is what stops «ال تعليم», «ال نظام» and «ال أرض».
 *
 * Emitting the list rather than the rule is deliberate. These are the only
 * edits in the pipeline that can reverse an author's meaning, so the set of
 * them should be reviewable by eye in a diff, not recomputed from a heuristic
 * at every run.
 *
 * Regenerate whenever OCR extractions are added; the lists only know the
 * vocabulary of the books read when they were built.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const extractedDir = path.join(here, '..', 'src', 'data', 'extracted');
const outFile = path.join(here, '..', 'src', 'data', 'repair-wordlists.json');

const WORD = /[ء-ٰٟ-ۓۺ-ۿ]+/gu;
const MARK = /[ً-ْٰـ]/gu;
const ALEF = 'ا';
const LAM = 'ل';
const MIN_SIGHTINGS = 2;
/** The imperfect prefixes. A proxy for "this is a verb", and only a proxy. */
const VERB_PREFIX = ['ي', 'ت', 'ن', 'أ'];
const NEGATION = new Set(['لا', 'ولا', 'فلا']);
const BROKEN_NEGATION = new Set(['ال', 'وال', 'فال']);

const bare = (w: string): string => w.replace(MARK, '');

function internalArticlePositions(word: string): number[] {
  const out: number[] = [];
  for (let i = 1; i < word.length - 1; i++) {
    if (word[i] === ALEF && word[i + 1] === LAM) out.push(i);
  }
  return out;
}

const ocrCounts = new Map<string, number>();
const pdfCounts = new Map<string, number>();
/** Word seen directly after a real negation, in text that spells it correctly. */
const afterNegation = new Map<string, number>();
/** Word seen directly after a standalone «ال» in pdf-parse — the cases in play. */
const afterBroken = new Set<string>();
let ocrDocs = 0;

for (const file of readdirSync(extractedDir).filter(f => f.endsWith('.json'))) {
  const doc = JSON.parse(readFileSync(path.join(extractedDir, file), 'utf8'));
  if (!Array.isArray(doc.text)) continue;
  const isOcr = String(doc.tool ?? '').includes('tesseract');
  if (isOcr) ocrDocs++;
  const counts = isOcr ? ocrCounts : pdfCounts;

  for (const page of doc.text) {
    const words = (String(page.text ?? '').match(WORD) ?? []).map(bare);
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
    for (let i = 0; i < words.length - 1; i++) {
      if (isOcr && NEGATION.has(words[i])) {
        afterNegation.set(words[i + 1], (afterNegation.get(words[i + 1]) ?? 0) + 1);
      }
      if (!isOcr && BROKEN_NEGATION.has(words[i])) afterBroken.add(words[i + 1]);
    }
  }
}

/**
 * Can the article attach to this word? Then a preceding «ال» is an article.
 *
 * The two corpora are not equal witnesses and must not be weighted as if they
 * were. OCR spells the article correctly, so one sighting of «ال»+W there
 * settles it. The pdf-parse side still contains run-together wreckage, and
 * treating that as evidence let three junk occurrences of «اليمكن» outvote
 * **42** sightings of «يمكن» directly after a real negation — excluding one of
 * the commonest negations in the language on the strength of corruption.
 *
 * So the pdf side only blocks when it outweighs the negation evidence it is
 * arguing against, and never on fewer than two sightings.
 */
function articleAttaches(w: string, negationEvidence: number): boolean {
  const joined = ALEF + LAM + w;
  if (ocrCounts.has(joined)) return true;
  return (pdfCounts.get(joined) ?? 0) > Math.max(negationEvidence, MIN_SIGHTINGS);
}

const correct: string[] = [];
const attested: string[] = [];
for (const [word, n] of ocrCounts) {
  if (word.includes(LAM + ALEF) && n >= MIN_SIGHTINGS) correct.push(word);
  if (internalArticlePositions(word).length > 0) attested.push(word);
}

const negationBefore: string[] = [];
for (const w of afterBroken) {
  if (w.length < 3) continue;              // single letters are wreckage
  const seenAfterNegation = afterNegation.get(w) ?? 0;
  if (articleAttaches(w, seenAfterNegation)) continue;
  const byEvidence = seenAfterNegation >= MIN_SIGHTINGS;
  const byVerbShape = VERB_PREFIX.some(p => w.startsWith(p)) && (ocrCounts.get(w) ?? 0) >= MIN_SIGHTINGS;
  if (byEvidence || byVerbShape) negationBefore.push(w);
}

correct.sort();
attested.sort();
negationBefore.sort();

writeFileSync(
  outFile,
  JSON.stringify({
    note:
      'Generated by scripts/build-repair-wordlists.ts. `correct`/`attested` decide the لا '
      + 'ligature repair; `negationBefore` lists the words after which a standalone «ال» is '
      + 'the negation «لا». Do not hand-edit; regenerate.',
    generatedAt: new Date().toISOString().slice(0, 10),
    ocrDocuments: ocrDocs,
    minSightings: MIN_SIGHTINGS,
    correct,
    attested,
    negationBefore,
  }, null, 1) + '\n',
  'utf8',
);

console.log(`read ${ocrDocs} OCR extractions`);
console.log(`  correct        (licenses a ligature repair): ${correct.length}`);
console.log(`  attested       (blocks one)                : ${attested.length}`);
console.log(`  negationBefore (licenses a negation repair): ${negationBefore.length}`);
console.log(`wrote ${path.relative(process.cwd(), outFile)}`);
