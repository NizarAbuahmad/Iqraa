/**
 * The English hub's word lists — Grades 1–4 straight from the lesson JSON,
 * Grades 9–10 from `vocabulary.ts`.
 *
 * Separate subpath, like `vocabulary.ts`: the answers are public on purpose
 * (practice records nothing), so this must never become the source of an exam.
 *
 * The 1–4 books print bare words, glossed into Arabic by hand. The 9–10 books
 * print words with IPA but no Arabic, so their glosses live apart in
 * `data/english_vocabulary_ar.json`, keyed by the word as the book prints it —
 * one sense per word, chosen against the book's own sentence where it has one.
 * Those were drafted, not taken from the book; correct them there.
 * Entries that are topic labels rather than words ("Numbers 11-20",
 * "fair/brown/red/black hair") are dropped here: you cannot hear, spell or
 * match a range.
 */
import type { NccdCurriculumFile } from './catalogs/nccdCatalog.ts';
import { nccdG1EnglishSem1, g1EnglishSem1LessonKbId } from './catalogs/g1EnglishSem1.ts';
import { nccdG1EnglishSem2, g1EnglishSem2LessonKbId } from './catalogs/g1EnglishSem2.ts';
import { nccdG2EnglishSem1, g2EnglishSem1LessonKbId } from './catalogs/g2EnglishSem1.ts';
import { nccdG2EnglishSem2, g2EnglishSem2LessonKbId } from './catalogs/g2EnglishSem2.ts';
import { nccdG3EnglishSem1, g3EnglishSem1LessonKbId } from './catalogs/g3EnglishSem1.ts';
import { nccdG3EnglishSem2, g3EnglishSem2LessonKbId } from './catalogs/g3EnglishSem2.ts';
import { nccdG4EnglishSem1, g4EnglishSem1LessonKbId } from './catalogs/g4EnglishSem1.ts';
import { nccdG4EnglishSem2, g4EnglishSem2LessonKbId } from './catalogs/g4EnglishSem2.ts';
import { buildG9EngSem1BrowserCatalog } from './catalogs/g9EngSem1.ts';
import { buildG9EngSem2BrowserCatalog } from './catalogs/g9EngSem2.ts';
import { buildEngSem1BrowserCatalog } from './catalogs/g10EnglishSem1.ts';
import { buildEngSem2BrowserCatalog } from './catalogs/g10EnglishSem2.ts';
import { ENGLISH_VOCABULARY } from './vocabulary.ts';
import glossesRaw from './data/english_vocabulary_ar.json' with { type: 'json' };

export interface HubWord {
  en: string;
  ar: string;
}

export interface HubLesson {
  /** Same id the curriculum browser uses, so lesson-detail can link here. */
  id: string;
  grade: number;
  semester: 1 | 2;
  unitNumber: number;
  unitTitle: string;
  unitTitleAr: string;
  title: string;
  titleAr: string;
  words: HubWord[];
}

/** Below this there is nothing to choose between — same floor as the 9–10 drill. */
export const MIN_HUB_WORDS = 4;

const BOOKS: [number, 1 | 2, NccdCurriculumFile, (id: string) => string][] = [
  [1, 1, nccdG1EnglishSem1, g1EnglishSem1LessonKbId],
  [1, 2, nccdG1EnglishSem2, g1EnglishSem2LessonKbId],
  [2, 1, nccdG2EnglishSem1, g2EnglishSem1LessonKbId],
  [2, 2, nccdG2EnglishSem2, g2EnglishSem2LessonKbId],
  [3, 1, nccdG3EnglishSem1, g3EnglishSem1LessonKbId],
  [3, 2, nccdG3EnglishSem2, g3EnglishSem2LessonKbId],
  [4, 1, nccdG4EnglishSem1, g4EnglishSem1LessonKbId],
  [4, 2, nccdG4EnglishSem2, g4EnglishSem2LessonKbId],
];

/** A topic label, not a word: digits, ranges, slashes, "ordinal numbers: …". */
export function isDrillableWord(en: string): boolean {
  return !!en.trim() && !/[\d:/]/.test(en);
}

const GLOSSES = glossesRaw as Record<string, string>;

/**
 * The word a student sees, from the word as the 9–10 list prints it — or null.
 *
 * The list carries the book's annotations: "eager (phr)", "twin (n, adj)",
 * "wash up (the dishes)". A parenthesis is never something to hear or spell,
 * so it goes, contents and all. "or learnt" is the second half of an
 * irregular-verb pair, not a word on its own.
 */
export function hubWordFromBook(printed: string): string | null {
  const en = printed.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  if (/^or\s/i.test(en) || !isDrillableWord(en)) return null;
  return en;
}

/** The slice of a browser catalog the 9–10 lessons need — both builder shapes satisfy it. */
interface BrowserBook {
  units: { id: string; name: string; nameAr: string; order: number }[];
  lessons: { id: string; unitId: string; title: string; titleAr: string }[];
}

/** Grade 10 semester 2 has no vocabulary extracted yet, so it contributes no lessons. */
const VOCAB_BOOKS: [number, 1 | 2, BrowserBook][] = [
  [9, 1, buildG9EngSem1BrowserCatalog()],
  [9, 2, buildG9EngSem2BrowserCatalog()],
  [10, 1, buildEngSem1BrowserCatalog()],
  [10, 2, buildEngSem2BrowserCatalog()],
];

function buildFromVocabulary(): HubLesson[] {
  const out: HubLesson[] = [];
  for (const [grade, semester, book] of VOCAB_BOOKS) {
    const units = new Map(book.units.map(u => [u.id, u]));
    for (const l of book.lessons) {
      const u = units.get(l.unitId);
      if (!u) continue;
      const seen = new Set<string>();
      const words: HubWord[] = [];
      for (const v of ENGLISH_VOCABULARY) {
        if (v.lessonId !== l.id) continue;
        const en = hubWordFromBook(v.word);
        const ar = GLOSSES[v.word.trim()];
        if (!en || !ar) continue;
        const key = en.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        words.push({ en, ar });
      }
      if (words.length < MIN_HUB_WORDS) continue;
      out.push({
        id: l.id,
        grade,
        semester,
        unitNumber: u.order,
        unitTitle: u.name,
        unitTitleAr: u.nameAr,
        title: l.title,
        titleAr: l.titleAr,
        words,
      });
    }
  }
  return out;
}

function build(): HubLesson[] {
  const out: HubLesson[] = [];
  for (const [grade, semester, book, kbId] of BOOKS) {
    for (const u of book.units) {
      for (const l of u.lessons) {
        const seen = new Set<string>();
        const words: HubWord[] = [];
        for (const v of l.vocabulary ?? []) {
          const key = v.en.toLowerCase();
          if (!isDrillableWord(v.en) || !v.ar || seen.has(key)) continue;
          seen.add(key);
          words.push({ en: v.en, ar: v.ar });
        }
        if (words.length < MIN_HUB_WORDS) continue;
        out.push({
          id: kbId(l.id),
          grade,
          semester,
          unitNumber: u.number,
          unitTitle: u.title_en,
          unitTitleAr: u.title_ar,
          title: l.title_en,
          titleAr: l.title_ar,
          words,
        });
      }
    }
  }
  return out;
}

export const ENGLISH_HUB_LESSONS: HubLesson[] = [...build(), ...buildFromVocabulary()];

/** Tab order. Append only — the picked grade is carried as a value in the URL, but keep the habit. */
export const ENGLISH_HUB_GRADES = [1, 2, 3, 4, 9, 10] as const;

export function hubLessonsForGrade(grade: number): HubLesson[] {
  return ENGLISH_HUB_LESSONS.filter(l => l.grade === grade);
}

export function hubLesson(id: string): HubLesson | undefined {
  return ENGLISH_HUB_LESSONS.find(l => l.id === id);
}

/**
 * The R2 object name for a word's recording, without prefix or extension.
 *
 * A readable slug rather than a hash: the app has no `crypto` on native, and
 * `pencil-case.mp3` is something a person can check in the bucket. Editing a
 * word's spelling changes its slug, so the script voices it afresh.
 */
export function audioSlug(en: string): string {
  return en.toLowerCase().trim().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
}

/** Every distinct word across the hub — what the audio script voices. */
export function allHubWords(): string[] {
  return [...new Set(ENGLISH_HUB_LESSONS.flatMap(l => l.words.map(w => w.en)))];
}
