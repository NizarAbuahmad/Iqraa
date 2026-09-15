/**
 * The English books' own Word Lists, turned into practice vocabulary.
 *
 * Every NCCD English student book prints a Word List at the back: the lesson's
 * new words with part of speech and IPA, grouped under `WL<unit>.<lesson>`
 * markers that map straight onto curriculum lesson ids. Nothing read them until
 * this script, while the only English practice content in the product was three
 * VOA passages and thirteen questions on six lessons.
 *
 * Output is checked in rather than parsed at runtime, for two reasons. The
 * parse is heuristic and a human should be able to read its result — the same
 * posture `figure-lesson-map.json` takes. And `passages.ts` keeps the extracted
 * corpus server-only by design, so a client could not parse it anyway.
 *
 * ## What the page layout does to a naive parse
 *
 * Every one of these cost a silent zero while this was being written, so they
 * are guarded rather than described:
 *
 *  - **The contents page says "Word List"** too, with its page number. Testing
 *    `/Word List/` anywhere in a page stops the scan on page 2. The section
 *    itself *opens* with it, hence `^\s*Word List`.
 *  - **The books are set in narrow columns**, so nothing is one line: IPA wraps
 *    (`at the moment /ˌæt ðə` + `ˈməʊmənt/`) and so does prose. Word entries are
 *    rejoined until the IPA closes; sentences need the whole page flattened
 *    first and split afterwards.
 *  - **Headwords contain slashes** (`close/good friend`, `take photos/photographs`)
 *    and IPA is slash-delimited, so "split on the first slash" mangles them. The
 *    IPA is the trailing run: walk slashes backwards while what would be left
 *    behind still holds phonetic characters.
 *  - **Gap-fill exercises have their answer already removed** from the printed
 *    text — page 20 of the G10 book reads "the water is too strong" where
 *    `pressure` belongs. Mining those produces sentences that cannot teach the
 *    word they were chosen for, so exercise lines are filtered out and only
 *    prose is kept.
 *  - **Grade 9 semester 2 numbers its units 6–10**, matching the curriculum.
 *    Checked rather than assumed; a 1–5 assumption files every word five units
 *    off, which is the same silent mis-join `bookFigures.ts` warns about.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LESSONS } from '../src/catalog.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXTRACTED = path.resolve(HERE, '../src/data/extracted');
const OUT = path.resolve(HERE, '../src/data/english_vocabulary.json');

/**
 * `eng-s2-student-book` is deliberately absent: it was extracted by OCR and no
 * `WL` marker survives, so it yields nothing. Listing it would make an empty
 * result look like a parser regression rather than a source problem.
 */
const BOOKS: { sourceId: string; lessonId: (unit: number, lesson: number) => string }[] = [
  { sourceId: 'eng-s1-student-book', lessonId: (u, l) => `kbl-eng-s1-nccd-u${u}_l${l}` },
  { sourceId: 'g9-english-s1-student-book', lessonId: (u, l) => `kbl-g9-eng-s1-nccd-u${u}_l${l}` },
  { sourceId: 'g9-english-s2-student-book', lessonId: (u, l) => `kbl-g9-eng-s2-nccd-u${u}_l${l}` },
];

/** Stress marks and length — what a headword must NOT contain. */
const PHONETIC_MARK = /[ˈˌː]/;
/** Enough of the IPA inventory to recognise a transcription run. */
const PHONETIC_CHAR = /[ˈˌːəɪʊɒæɜɑɔʌθðʃʒŋɡ]/;
const POS = /\((v|n|adj|adv|prep|pl|phr v)\)/;
/** A headword after the POS marker is stripped: letters, spaces, and the
 *  punctuation the books actually print inside one. */
const HEADWORD = /^[A-Za-z][A-Za-z '’\-/().,]*$/;
/** Longest real headword in these books is a short phrase — "keep in touch",
 *  "share photos with somebody". Anything longer is the Grammar Reference. */
const MAX_HEADWORD_WORDS = 6;
const MAX_HEADWORD_CHARS = 40;

/**
 * The Grammar Reference sits in the same back matter and survives the join.
 *
 * It has no phonetic marks to give it away, and its rows are letters and
 * apostrophes like any headword — "They do not (don't) like milk. He/She/It
 * likes milk." passes every character test. What separates them is shape: a
 * headword is a word or a short phrase, never a sentence.
 */
function looksLikeGrammarTable(head: string): boolean {
  if (head.length > MAX_HEADWORD_CHARS) return true;
  if (head.split(/\s+/).length > MAX_HEADWORD_WORDS) return true;
  if (/[.!?]/.test(head)) return true;
  // "He/She/It", "Yes/No" — a capital mid-phrase is a table cell, not a word.
  if (/[a-z][A-Z]/.test(head) || /\s[A-Z]/.test(head.slice(1))) return true;
  // A lone conjugation-table pronoun. These books never teach "He" as vocabulary,
  // and as a drill answer it is indistinguishable from the three distractors.
  if (PRONOUN_CELL.has(head.toLowerCase())) return true;
  // The irregular-verbs table: "spread /spred/ spread /spred/ spread". Its IPA
  // carries no stress mark, so the phonetic filter lets it through. A real
  // alternate headword writes the slash tight — "close/good friend".
  if (/\s\//.test(head)) return true;
  return false;
}

const PRONOUN_CELL = new Set([
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'yes', 'no',
]);

interface Row {
  lessonId: string;
  word: string;
  pos: string | null;
  ipa: string;
  sentence?: string;
  sentencePage?: number;
}

type Page = { page: number; text: string };

function pagesOf(sourceId: string): Page[] {
  const file = path.join(EXTRACTED, `${sourceId}.json`);
  if (!fs.existsSync(file)) throw new Error(`no extraction for ${sourceId}`);
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as { text: Page[] }).text;
}

/**
 * Where the Word List section starts.
 *
 * Keyed on the `WL<unit>.<lesson>` marker rather than the words "Word List",
 * because the title is not a reliable signal in either direction: the CONTENTS
 * page prints it in a table (so matching it anywhere stops a scan on page 4),
 * and only one of the three books actually opens the section with it — the
 * other two start `UNIT 1` and `LESSON 1A`. The marker appears nowhere else in
 * the book.
 */
const isWordListPage = (p: Page) => /\bWL\s*\d+\.\d+/.test(p.text);

function wordsFrom(book: (typeof BOOKS)[number]): Row[] {
  const out: Row[] = [];
  let marker: { unit: number; lesson: number } | null = null;
  let inSection = false;

  for (const page of pagesOf(book.sourceId)) {
    if (isWordListPage(page)) inSection = true;
    if (!inSection) continue;

    let buf = '';
    for (const line of page.text.split('\n').map(s => s.trim()).filter(Boolean)) {
      const wl = line.match(/^WL\s*(\d+)\.(\d+)/);
      if (wl) {
        marker = { unit: Number(wl[1]), lesson: Number(wl[2]) };
        buf = '';
        continue;
      }
      // Section headings carry no slash; a real entry always closes an IPA run.
      if (!line.includes('/') && /^(Word List|LESSON|VOCABULARY|GRAMMAR|AND|READING|WRITING|LISTENING|SPEAKING|UNIT|\d+$)/i.test(line)) {
        buf = '';
        continue;
      }

      buf = buf ? `${buf} ${line}` : line;
      // Complete when the IPA closes. `endsWith(' /')` catches the wrap where a
      // long headword pushes the opening slash onto the previous line.
      const closed = buf.endsWith('/') && !buf.endsWith(' /') && (buf.match(/\//g) ?? []).length >= 2;
      if (!closed) continue;

      let cut = buf.lastIndexOf('/', buf.length - 2);
      while (cut > 0) {
        const prev = buf.lastIndexOf('/', cut - 1);
        if (prev < 0 || !PHONETIC_CHAR.test(buf.slice(prev, cut))) break;
        cut = prev;
      }
      const ipa = buf.slice(cut).trim();
      let head = buf.slice(0, cut).trim();
      const pos = head.match(POS)?.[1] ?? null;
      head = head.replace(new RegExp(POS.source, 'g'), ' ').replace(/\s+/g, ' ').trim();
      buf = '';

      // The irregular-verbs table and the Grammar Reference sit in these pages
      // too and survive the join. Both are useful later; neither is a headword,
      // and both are recognisable by the phonetic marks they drag along.
      if (!head || !marker) continue;
      if (PHONETIC_MARK.test(head) || !HEADWORD.test(head)) continue;
      if (looksLikeGrammarTable(head)) continue;

      out.push({ lessonId: book.lessonId(marker.unit, marker.lesson), word: head, pos, ipa });
    }
  }
  return out;
}

/**
 * Sentences from the book's prose, for gap-fill.
 *
 * Flattened per page and split afterwards, because a column-wrapped line is
 * never a sentence and joining until punctuation yields whole paragraphs.
 */
function sentencesFrom(sourceId: string): { page: number; text: string }[] {
  const out: { page: number; text: string }[] = [];
  for (const page of pagesOf(sourceId)) {
    if (isWordListPage(page)) break;
    const flat = page.text
      .split('\n')
      .map(s => s.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' ');

    for (const raw of flat.split(/(?<=[.!?])\s+/)) {
      const s = raw.trim().replace(/^\d{1,2}\s+/, '').replace(/^[a-h]\)\s+/, '').trim();
      if (s.length < 40 || s.length > 150) continue;
      if (!/^[A-Z]/.test(s) || !/[.!?]$/.test(s)) continue;
      if (/□|▶|●|■/.test(s)) continue;
      // The "I can…" lines are lesson objectives, printed on every page.
      if (/\bI can\b/.test(s)) continue;
      // Exercise instructions teach nothing about the word they contain.
      if (/^(LESSON|UNIT|Listen|Complete|Discuss|Match|Choose|Write|Work in|In pairs|Look at|Read the|Answer|Then in pairs)/i.test(s)) continue;
      const letters = (s.match(/[A-Za-z]/g) ?? []).length;
      if (letters / s.length < 0.78) continue;
      if ((s.match(/\d/g) ?? []).length > 2) continue;
      if (s.split(' ').length < 7) continue;
      // A gap-fill item that slipped the instruction filter: the removed answer
      // leaves a space before the punctuation ("tasks which require .").
      if (/\s[.,!?]/.test(s)) continue;
      // pdf-parse splits the fi/fl ligatures ("fi ngerprint", "fi nd"), which
      // would be shown to a student as the book's own spelling.
      if (/\b(fi|fl|ff|ffi)\s[a-z]/.test(s)) continue;
      out.push({ page: page.page, text: s });
    }
  }
  return out;
}

const escape = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function main(): void {
  const lessonIds = new Set(LESSONS.map(l => l.id));
  const rows: Row[] = [];
  const orphans: string[] = [];
  // A word printed twice under one lesson is a parse artifact, not two words —
  // and as a drill it would offer the same answer twice in one set of options.
  const taken = new Set<string>();

  for (const book of BOOKS) {
    const words = wordsFrom(book);
    const sentences = sentencesFrom(book.sourceId);
    let withSentence = 0;

    for (const row of words) {
      if (!lessonIds.has(row.lessonId)) {
        orphans.push(`${book.sourceId}: ${row.word} -> ${row.lessonId}`);
        continue;
      }
      const key = `${row.lessonId}|${row.word.toLowerCase()}`;
      if (taken.has(key)) continue;
      taken.add(key);
      // Alternates ("close/good friend") cannot be blanked as one span.
      if (!/[/()]/.test(row.word)) {
        const re = new RegExp(`\\b${escape(row.word)}\\b`, 'i');
        const hit = sentences.find(s => re.test(s.text));
        if (hit) {
          row.sentence = hit.text;
          row.sentencePage = hit.page;
          withSentence += 1;
        }
      }
      rows.push(row);
    }
    process.stdout.write(
      `${book.sourceId.padEnd(30)} ${String(words.length).padStart(4)} words  ` +
        `${String(sentences.length).padStart(4)} sentences  ${String(withSentence).padStart(3)} with a sentence\n`,
    );
  }

  if (orphans.length) {
    process.stdout.write(`\nREFUSED — ${orphans.length} words name no lesson:\n`);
    for (const o of orphans.slice(0, 10)) process.stdout.write(`  ${o}\n`);
    process.exitCode = 1;
    return;
  }

  const lessons = new Set(rows.map(r => r.lessonId));
  fs.writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        note:
          "The English books' own Word Lists, per lesson. Generated by " +
          'scripts/extract-english-vocabulary.ts — do not hand-edit; re-run it. ' +
          'Read that file before changing the parse: the layout traps it guards ' +
          'against each produced a silent zero rather than an error.',
        sentenceRule:
          'A sentence is verbatim book prose that contains the word. Exercise ' +
          'lines are excluded on purpose — the book prints its gap-fill items ' +
          'with the answer already removed, so they cannot teach the word they ' +
          'were chosen for.',
        generatedAt: new Date().toISOString().slice(0, 10),
        words: rows,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  process.stdout.write(
    `\n${rows.length} words across ${lessons.size} lessons, ` +
      `${rows.filter(r => r.sentence).length} with a sentence -> ${path.relative(process.cwd(), OUT)}\n`,
  );
}

main();
