/**
 * Book text for a lesson — the retrieval half of the knowledge bank.
 *
 * **Server-only.** This reads `data/extracted/*.json` from disk with `node:fs`,
 * which is both the point and the guard: the corpus is ~2.1 MB and the mobile
 * app imports `@workspace/curriculum`, so a module that could be bundled would
 * eventually be bundled. It is exported from the `./passages` subpath and
 * deliberately **not** from `index.ts`; `__tests__/extraction.test.ts` fails if
 * anything else in `src/` reaches for the corpus.
 *
 * ## Why lexical and not embeddings
 *
 * There is no vector store in this project and adding one is a large new
 * dependency for a corpus of six books. Scoping already works: the bank tags
 * every document to a unit, `bankTagsForUnit()` maps a catalog unit onto those
 * tags, and that narrows a query to one book before a single page is scored.
 * What is left is ranking a few hundred pages, which term overlap does well
 * enough to be worth measuring before anything cleverer is bought.
 *
 * ## Why the text is repaired before it is matched, but not before it is read
 *
 * `pdf-parse` returns readable Arabic with two systematic defects: the lam-alef
 * ligature decomposes, so «الاقتران» arrives as «االقتران», and tashkeel is
 * interleaved. Those break string matching and not comprehension — a model
 * reads the raw text without trouble.
 *
 * So `Passage.text` is **raw**, exactly as extracted, because that is what goes
 * to a model and re-spelling a textbook on the way to a prompt would be a
 * silent edit of a source document. Matching runs over a repaired, normalised
 * copy that is never stored and never shown.
 *
 * `repairExtractionArtifacts` is separate from `normalizeArabic` on purpose:
 * one fixes a PDF text layer, the other folds orthography a human might vary.
 * A student typing an answer never produces «االقتران», so that repair has no
 * business in the grading path.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeArabic } from './arabic.ts';
import { bankTagsForUnit, itemsForUnitTags, usePolicy, type BankUsePolicy } from './bank.ts';
import { getObjectivesForUnit } from './objectives.ts';
import { LESSONS, UNITS } from './catalog.ts';
import { objectivesFromTeacherGuide } from './catalogs/nccdCatalog.ts';
import type { CurriculumSource, SourceAuthority } from './sources.ts';

const extractedDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'data',
  'extracted',
);

/**
 * Undo the two systematic defects of the extracted text layer.
 *
 * Never stored. Applied to the search index, and to the passage text served
 * into prompts — see `Passage.text`. Kept out of the grading path, which is
 * what it must never touch: a student typing an answer never produces the
 * defect, so repairing their input would fold two different things together.
 */
export function repairExtractionArtifacts(input: string): string {
  return input
    // «االقتران» → «الاقتران». The ligature decomposes into its two letters in
    // the wrong order, which reads as a doubled alef after the definite article.
    .replace(/اال/g, 'الا')
    // The same collision mid-word, where a doubled alef is otherwise unheard of.
    .replace(/(\S)اا/g, '$1ا')
    // «الألوان» stored as «األلوان». The same reversal as above, for the three
    // hamza-carrying ligatures (لأ لإ لآ) rather than the bare لا — and the one the
    // two rules above miss entirely, which is 26,626 words of the corpus, every
    // document affected. An alef followed by a hamza-carrying alef is not a
    // sequence Arabic orthography produces, so this needs no dictionary to be
    // safe; 97.4% of them are followed by the ل this puts back in front.
    //
    // Runs last on purpose: collapsing a doubled alef above can leave a fresh
    // اأ adjacency behind it, 39 of them across the corpus.
    .replace(/ا([أإآ])ل/g, 'ال$1');
}

/**
 * A word as the text layer spells it when a lam-alef inside it came out reversed:
 * «صلاة» → «صالة», «مبطلات» → «مبطالت», «أخلاق» → «أخالق».
 *
 * The same ligature defect `repairExtractionArtifacts` undoes after the article,
 * but mid-word it cannot be undone on the page: «صالة» and «سؤال» are real words,
 * so rewriting «ال» to «لا» would corrupt them. It is undone on the query
 * instead, and only in a book that never spells the term correctly — that
 * absence is the defect's signature. Without that guard «ثلاث» would also match
 * «ثالث» on every «الدرس الثالث». A final «لا» is left alone («ولا» → «وال» is on
 * most pages). Found 2026-11-13 in the Grade 4 Islamic books, where «صلاة»
 * appears 0 times and «صالة» 44, so no prayer lesson found its own pages.
 *
 * The variant is repaired like a page is, so «الإسلام» → «االسالم» is compared
 * as the «الاسالم» a page would hold; `null` when there is no distinct variant.
 */
function withReversedLamAlef(term: string): string | null {
  if (term.length < 3) return null;
  const variant = repairExtractionArtifacts(term[0] + term.slice(1).replace(/لا(?!$)/g, 'ال'));
  return variant === term ? null : variant;
}

/** The form everything is compared in. Repair first, then fold. */
export function searchForm(input: string): string {
  return normalizeArabic(repairExtractionArtifacts(input));
}

export interface Passage {
  sourceId: string;
  /** 1-based page in the source document, for a citation a teacher can check. */
  page: number;
  /**
   * Page text with the extraction's reversed ligatures repaired, and nothing
   * else done to it — not normalised, not folded. `repairExtractionArtifacts`
   * is safe to show because it only rewrites sequences Arabic orthography
   * cannot produce; `normalizeArabic` is not, and stays out of here.
   */
  text: string;
  /** Higher is a better match. Comparable only within one query. */
  score: number;
  /** Whether this text may be quoted or only inform generation. */
  usePolicy: BankUsePolicy;
  authority: SourceAuthority;
}

type ExtractedDoc = { sourceId: string; text: Array<{ page: number; text: string }> };

/** Parsed once per process. Six files, ~2.1 MB — cheap to hold, wasteful to re-read. */
const cache = new Map<string, Array<{ page: number; raw: string; search: string }> | null>();

function pagesFor(sourceId: string): Array<{ page: number; raw: string; search: string }> {
  const hit = cache.get(sourceId);
  if (hit !== undefined) return hit ?? [];

  const file = path.join(extractedDir, `${sourceId}.json`);
  if (!existsSync(file)) {
    cache.set(sourceId, null);
    return [];
  }
  const doc = JSON.parse(readFileSync(file, 'utf8')) as ExtractedDoc;
  const pages = doc.text.map(p => ({ page: p.page, raw: p.text, search: searchForm(p.text) }));
  cache.set(sourceId, pages);
  return pages;
}

/**
 * A page that lists lessons rather than teaching one — the contents page, a
 * unit opener's «دروس الوحدة». It prints many lesson titles, so a search made
 * of lesson titles ranks it first for every unit, though it teaches nothing.
 * A lesson counts as listed when most of its title's terms are on the page
 * (OCR mangles some), and three listed lessons make a listing page: a lesson's
 * own pages name it, and now and then one neighbour.
 */
function isListingPage(search: string, bookTitleTerms: readonly string[][]): boolean {
  let listed = 0;
  for (const terms of bookTitleTerms) {
    if (!terms.length) continue;
    const found = terms.filter(t => search.includes(t)).length;
    if (found / terms.length >= 0.6 && ++listed >= 3) return true;
  }
  return false;
}

/**
 * What keeps a search made of lesson titles inside its own unit.
 *
 * The units of one book repeat lesson types — every Grade 9 Islamic unit has a
 * «سورة الإسراء» lesson and a «التلاوة والتجويد» one — so a page about unit 4's
 * recitation also matches unit 1's titles. A page is kept only when this unit's
 * titles describe it better than any sibling unit's do, never when it is a
 * listing page, and never when it comes before the contents page ends (the
 * introduction names every topic of the book). Only terms no sibling unit's
 * titles share count, and a page needs two of them. Measured 2026-11-13
 * against the unit page ranges on each book's contents page: Grade 9 Islamic
 * S1/S2, 28 of 31 returned pages in the right unit (without the guards about
 * half were); Grade 10 geography S1, every page in order inside its unit; a
 * Grade 6 Arabic unit whose titles are the same skill names as its siblings'
 * gets no pages rather than another unit's.
 */
interface TitleGuards {
  /** Per unit, the title terms no sibling unit's titles share. */
  termsByUnit: Map<string, string[]>;
  /** Each lesson's title terms, for the listing-page test. */
  allTitleTerms: string[][];
  firstPageBySource: Map<string, number>;
}

// The catalog never changes at run time, so one build per book is enough.
const guardsByBook = new Map<string, TitleGuards>();

function titleGuardsFor(unitId: string): TitleGuards | null {
  const bookId = UNITS.find(u => u.id === unitId)?.bookId;
  if (!bookId) return null;
  const hit = guardsByBook.get(bookId);
  if (hit) return hit;
  const units = UNITS.filter(u => u.bookId === bookId);
  const lessonsByUnit = units.map(u => LESSONS.filter(l => l.unitId === u.id));
  const allTitleTerms = lessonsByUnit.flat().map(l => queryTerms([l.titleAr]));
  const unitTerms = lessonsByUnit.map(ls => new Set(ls.flatMap(l => queryTerms([l.titleAr]))));
  // Only the terms no other unit's titles use: «الاستماع» heads every unit of
  // an Arabic book and says nothing about which unit a page belongs to.
  const distinctive = unitTerms.map((mine, i) =>
    [...mine].filter(t => unitTerms.every((other, j) => j === i || !other.has(t))));
  const guards: TitleGuards = {
    termsByUnit: new Map(units.map((u, i) => [u.id, distinctive[i]!])),
    allTitleTerms,
    firstPageBySource: new Map(),
  };
  guardsByBook.set(bookId, guards);
  return guards;
}

function titleScore(search: string, terms: readonly string[]): number {
  let score = 0;
  for (const t of terms) if (search.includes(t)) score += t.length;
  return score;
}

/**
 * The first page after the front matter: the page after the contents page,
 * found as the first listing page in the opening 15% of the book. 0 (nothing
 * skipped) when no contents page is recognised.
 */
function firstLessonPage(guards: TitleGuards, sourceId: string): number {
  const hit = guards.firstPageBySource.get(sourceId);
  if (hit !== undefined) return hit;
  const pages = pagesFor(sourceId);
  const window = Math.ceil(pages.length * 0.15);
  const contents = pages.slice(0, window).find(p => isListingPage(p.search, guards.allTitleTerms));
  const first = contents ? contents.page + 1 : 0;
  guards.firstPageBySource.set(sourceId, first);
  return first;
}

function pageBelongsToUnit(guards: TitleGuards, unitId: string, sourceId: string, page: { page: number; search: string }): boolean {
  if (page.page < firstLessonPage(guards, sourceId)) return false;
  if (isListingPage(page.search, guards.allTitleTerms)) return false;
  const own = guards.termsByUnit.get(unitId) ?? [];
  // Two of this unit's own terms, as the main search asks two of its terms: one
  // shared word is a coincidence, and none is no evidence the page is this unit's.
  if (own.filter(t => page.search.includes(t)).length < 2) return false;
  const mine = titleScore(page.search, own);
  for (const [id, terms] of guards.termsByUnit) {
    if (id !== unitId && titleScore(page.search, terms) >= mine) return false;
  }
  return true;
}

/** Whether any text has been extracted for a source. */
export function hasExtractedText(sourceId: string): boolean {
  return pagesFor(sourceId).length > 0;
}

/**
 * Terms worth matching on, longest first.
 *
 * Short tokens are dropped: «في» and «من» appear on every page and would rank
 * the index. Four characters is generous for Arabic, where the definite article
 * is already two of them.
 */
function queryTerms(parts: readonly string[], minLength = 4): string[] {
  const seen = new Set<string>();
  for (const part of parts) {
    for (const token of searchForm(part).split(/[\s,،.؛:()«»"'\-–—/]+/)) {
      if (token.length < minLength) continue;
      if (token.length === 3 && SHORT_STOPWORDS.has(token)) continue;
      seen.add(token);
    }
  }
  return [...seen].sort((a, b) => b.length - a.length);
}

/**
 * Three-letter words that say nothing about a page, in search form.
 *
 * Only a lesson's own title is read down to three letters (`queryTerms(…, 3)`): a
 * title is a handful of content words, and the one that names the lesson is
 * often a bare three-letter root — «طرح», «جمع», «ضرب» — which the four-letter
 * floor used to drop, leaving «طَرْحُ الأَعْدادِ» to be found by «الاعداد» alone.
 */
const SHORT_STOPWORDS: ReadonlySet<string> = new Set(
  ['على', 'إلى', 'الى', 'هذا', 'هذه', 'ذلك', 'تلك', 'بين', 'عند', 'غير', 'بعض', 'كيف',
    'ولا', 'فلا', 'بلا', 'فيه', 'عنه', 'كان', 'بعد', 'قبل', 'حول', 'فوق', 'رضي', 'صلي']
    .map(w => searchForm(w)),
);

export interface PassageQuery {
  /** Catalog unit id, e.g. `kbu-math-s1-nccd-u2`. Scopes which books are read. */
  unitId: string;
  /** Extra terms — a lesson title, a teacher's own phrasing. */
  terms?: readonly string[];
  /** Default 4. A prompt has a budget; a whole book does not fit in it. */
  limit?: number;
  /**
   * Restrict to material that may be quoted. Set this on any path that puts
   * text in front of a teacher verbatim.
   */
  quotableOnly?: boolean;
  /**
   * The lesson asked about, when the caller knows it. Its own title, key terms
   * and outcomes then outrank the rest of the unit's — see `LESSON_WEIGHT`.
   * Ignored unless the lesson belongs to `unitId`. When absent, a term that is
   * exactly the title of one lesson in the unit identifies it the same way.
   */
  lessonId?: string;
}

/**
 * How much more a lesson's own term counts than a unit-wide one.
 *
 * Without it every lesson of a unit got the same pages: the unit's objectives
 * are many and long and the lesson title is one or two words, so the unit
 * opener and the guide's unit overview outscored the lesson's own pages. Measured
 * 2026-11-13 on the 242 Grade 4 lessons whose page range is known, one of their
 * own student-book pages reached the top four for 83 before this and 146 after
 * (all grades: 363 → 523 of 2176; 4 gave 137, 16 gave 147) — weight alone,
 * before the three-letter titles and the lam-alef variant. See the log,
 * «Grade 4 review».
 */
const LESSON_WEIGHT = 8;

/** The catalog lesson a query is about, if it can be told without guessing. */
function queryLesson(query: PassageQuery) {
  // An id outside the unit (or a legacy id the catalog does not carry) falls
  // through to the title, rather than switching the lesson weighting off.
  const byId = query.lessonId ? LESSONS.find(l => l.id === query.lessonId) : undefined;
  if (byId?.unitId === query.unitId) return byId;
  const inUnit = LESSONS.filter(l => l.unitId === query.unitId);
  const titles = new Set((query.terms ?? []).map(searchForm));
  const named = inUnit.filter(l => titles.has(searchForm(l.titleAr)));
  return named.length === 1 ? named[0] : undefined;
}

/**
 * The best pages for a unit, ranked.
 *
 * Empty is a real answer: a unit whose sources have no extracted text yet — the
 * common case, since only six of 78 documents have been read — returns nothing
 * rather than something loosely related from elsewhere in the book.
 */
export function passagesForUnit(query: PassageQuery): Passage[] {
  const { unitId, limit = 4, quotableOnly = false } = query;

  const tags = bankTagsForUnit(unitId);
  if (!tags.length) return [];

  // Objectives and vocabulary are what the catalog knows about this unit, and
  // they are the strongest available description of what its pages say.
  // Objectives copied from a teacher guide are the guide's own wording, which
  // it reprints on the outcome page, the teaching notes and every unit plan:
  // searching with them finds the guide, not the lesson's student-book pages
  // (Grade 5 Islamic, 27 → 3 of 37 lessons). Such a unit is searched as it was
  // before it had objectives. See `objectivesFromTeacherGuide`.
  const guideObjectives = objectivesFromTeacherGuide(unitId);
  const objectives = guideObjectives ? [] : getObjectivesForUnit(unitId);
  // Some books print no learning outcomes at all (Grade 9 Islamic Studies,
  // history, geography, civics, PE), so their units have no objectives. A
  // caller that passes no `terms` and no lesson — a unit/semester/book paper,
  // the exam generator — then searched with nothing and got no pages, even for
  // a book whose text is extracted. The unit's own lesson titles are what is
  // left to describe it. Only as a fallback: where objectives exist they are
  // the stronger description, and adding titles would re-rank every other unit.
  const lessonTitles = objectives.length || query.terms?.length || query.lessonId
    ? []
    : LESSONS.filter(l => l.unitId === unitId).map(l => l.titleAr);
  const unitTerms = queryTerms([
    ...(query.terms ?? []),
    ...objectives.map(o => o.description),
    ...objectives.flatMap(o => o.skills ?? []),
    ...lessonTitles,
  ]);
  // Only the title fallback needs these; the other paths are left as they were.
  const fallback = lessonTitles.length ? titleGuardsFor(unitId) : null;
  // The lesson's own words: its title, its key terms (the book's vocabulary
  // box) and its own outcomes. For the many lessons whose book prints no
  // outcomes these are the only terms there are, and a one-word title alone
  // can never reach the two matches a page needs.
  const lesson = queryLesson(query);
  const lessonTerms = lesson
    ? [
      ...queryTerms([lesson.titleAr], 3),
      ...queryTerms([
        ...lesson.keywordsAr,
        ...(guideObjectives ? [] : [
          ...lesson.objectivesAr,
          ...lesson.outcomes.flatMap(o => [o.descriptionAr, ...(o.skills ?? [])]),
        ]),
      ]),
    ]
    : [];
  const weight = new Map<string, number>(unitTerms.map(t => [t, 1]));
  for (const t of lessonTerms) weight.set(t, LESSON_WEIGHT);
  const terms = [...weight.keys()];
  if (!terms.length) return [];

  const sources: CurriculumSource[] = itemsForUnitTags(tags)
    .filter(s => !quotableOnly || usePolicy(s) === 'quotable')
    .filter(s => hasExtractedText(s.id));

  const variants = new Map<string, string>();
  for (const t of terms) {
    const r = withReversedLamAlef(t);
    if (r) variants.set(t, r);
  }

  const scored: Passage[] = [];
  for (const source of sources) {
    const policy = usePolicy(source);
    const pages = pagesFor(source.id);
    // Per book, because the defect is per book: the Grade 4 Islamic student
    // book never spells «صلاة» right while its teacher guide does.
    const reversedLamAlef = new Map<string, string>();
    for (const [t, r] of variants) {
      if (!pages.some(p => p.search.includes(t))) reversedLamAlef.set(t, r);
    }
    for (const page of pages) {
      if (fallback && !pageBelongsToUnit(fallback, unitId, source.id, page)) continue;
      // Longer terms are rarer and so more informative: «المماس» locating a page
      // means more than «الشكل» does. Length is a cheap stand-in for IDF over a
      // corpus this small.
      let score = 0;
      let matched = 0;
      for (const term of terms) {
        const reversed = reversedLamAlef.get(term);
        if (page.search.includes(term) || (reversed !== undefined && page.search.includes(reversed))) {
          score += term.length * weight.get(term)!;
          matched += 1;
        }
      }
      // One incidental term is noise. Two is a page about the topic.
      if (matched < 2) continue;
      scored.push({
        sourceId: source.id,
        page: page.page,
        // Repaired, not raw. This text goes into a prompt that tells the model
        // to take its wording and terminology from it, so shipping a reversed
        // ligature invites the model to reproduce «األلوان» in front of a
        // teacher. The repair keys on a sequence Arabic does not produce, and
        // the page a citation sends the teacher to prints the word correctly —
        // the defect is in the extraction, not the book, so this moves the
        // passage toward the source rather than away from it.
        text: repairExtractionArtifacts(page.raw),
        score,
        usePolicy: policy,
        authority: source.authority,
      });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.sourceId.localeCompare(b.sourceId) || a.page - b.page)
    .slice(0, limit);
}

/**
 * Find the unit a free-text topic belongs to.
 *
 * The generation endpoints receive a `topic` string — an Arabic lesson title
 * the teacher picked — and no ids, so the unit has to be recovered from it.
 * Exact normalised title first; a containment match only when it is
 * unambiguous, because a topic matching two lessons is a topic we have not
 * identified, and guessing here would attach the wrong book pages to a prompt.
 */
export function resolveUnitByTopic(topic: string): { unitId: string; lessonId: string } | null {
  const needle = searchForm(topic);
  if (needle.length < 3) return null;

  const exact = LESSONS.filter(l => searchForm(l.titleAr) === needle);
  if (exact.length === 1) return { unitId: exact[0]!.unitId, lessonId: exact[0]!.id };
  if (exact.length > 1) return null;

  const contained = LESSONS.filter(l => {
    const t = searchForm(l.titleAr);
    return t.length >= 6 && (t.includes(needle) || needle.includes(t));
  });
  // Two lessons in the same unit is still an answer about the unit.
  const units = new Set(contained.map(l => l.unitId));
  if (units.size === 1) return { unitId: contained[0]!.unitId, lessonId: contained[0]!.id };
  return null;
}
