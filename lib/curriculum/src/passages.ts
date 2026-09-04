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
import { LESSONS } from './catalog.ts';
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
function queryTerms(parts: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const part of parts) {
    for (const token of searchForm(part).split(/[\s,،.؛:()«»"'\-–—/]+/)) {
      if (token.length >= 4) seen.add(token);
    }
  }
  return [...seen].sort((a, b) => b.length - a.length);
}

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
  const objectives = getObjectivesForUnit(unitId);
  const terms = queryTerms([
    ...(query.terms ?? []),
    ...objectives.map(o => o.description),
    ...objectives.flatMap(o => o.skills ?? []),
  ]);
  if (!terms.length) return [];

  const sources: CurriculumSource[] = itemsForUnitTags(tags)
    .filter(s => !quotableOnly || usePolicy(s) === 'quotable')
    .filter(s => hasExtractedText(s.id));

  const scored: Passage[] = [];
  for (const source of sources) {
    const policy = usePolicy(source);
    for (const page of pagesFor(source.id)) {
      // Longer terms are rarer and so more informative: «المماس» locating a page
      // means more than «الشكل» does. Length is a cheap stand-in for IDF over a
      // corpus this small.
      let score = 0;
      let matched = 0;
      for (const term of terms) {
        if (page.search.includes(term)) {
          score += term.length;
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
