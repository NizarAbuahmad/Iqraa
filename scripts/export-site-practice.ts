/**
 * Export the practice the app's bank holds for a few Grade 10 maths lessons
 * into the snapshot iqrra.com renders as lesson pages (the Site_Iqra repo's
 * `data/practice-grade10-math.json`).
 *
 *   node --experimental-strip-types scripts/export-site-practice.ts ../Site_Iqra/data/practice-grade10-math.json
 *
 * Then, in Site_Iqra, `node tools-build-curriculum.mjs` and commit what it
 * writes — same flow as `lib/curriculum/scripts/export-site-snapshot.ts`.
 *
 * It lives here and not beside that script because it reads two packages
 * (`lib/curriculum` and `lib/math-practice`): imported across their project
 * boundary from inside either, `tsc` fails on `rootDir`. This folder is under
 * no project's `rootDir`, so nothing typechecks it — run it, and read the
 * output, after any change to the bank or the catalog.
 *
 * ## Why an allowlist and not "every lesson the bank matches"
 *
 * The bank is organised by FAMILY, not by lesson. 25 of the 36 Grade 10 maths
 * lessons match a family with solved working, but the match is too coarse to
 * publish: four derivative lessons share one family (the same 22 items would
 * print under all four titles), the statistics family holds mean, median and a
 * dice question under lessons about mutually exclusive and independent events,
 * and the "functions" family contains an arithmetic-sequence item. A page whose
 * practice is not about its title is worse than no page, and duplicate pages
 * are the thin-content pattern the site's own builder refuses to publish.
 *
 * So a lesson is exported only when ALL of these hold, and the script throws
 * (rather than quietly skipping) when one stops holding:
 *   1. it is on the list below, by lesson id, with the title we expect;
 *   2. `matchMathFamily` still maps it to the family we expect;
 *   3. no OTHER Grade 10 maths lesson maps to that family — the family is this
 *      lesson's alone, which is what makes every item in it about the lesson;
 *   4. the family has enough items with authored working.
 * Adding a lesson means adding a row AND reading the family's items. Lessons
 * that share a family need an item-by-item mapping reviewed by a person who
 * teaches the course; that is a separate change.
 *
 * Nothing here says the answers were verified. The items are the bank's own,
 * authored with their working (`stepsFor`); `verified` means the SymPy service
 * confirmed it, and this export does not call that service.
 */
import { writeFileSync } from 'node:fs';

import {
  getBooksForSubjectGrade,
  getLessonsForUnit,
  getSemesterLabel,
  getUnitsForBook,
} from '../lib/curriculum/src/catalog.ts';
import {
  MATH_BANK,
  itemStem,
  matchMathFamily,
  stepsFor,
  type ConcreteItem,
  type DiffTier,
} from '../lib/math-practice/src/index.ts';

interface Row {
  lessonId: string;
  /** URL segment under /manhaj/grade-10-mathematics/. Latin, as the site's other slugs. */
  slug: string;
  titleAr: string;
  family: string;
  /**
   * Items of the family that are not about THIS lesson, with why. A family is
   * the lesson's alone (guard 3) but can still hold an item its outcomes do not
   * cover; each is read against the lesson's official outcomes, by hand.
   */
  exclude?: Record<string, string>;
}

const LESSONS: Row[] = [
  { lessonId: 'kbl-math-s1-nccd-u1_l1', slug: 'linear-quadratic-system', titleAr: 'حل نظام مكوَّن من معادلة خطية ومعادلة تربيعية', family: 'linear_quad' },
  {
    lessonId: 'kbl-math-s1-nccd-u1_l2',
    slug: 'two-quadratics-system',
    titleAr: 'حل نظام مكوَّن من معادلتين تربيعيتين',
    family: 'quad_system',
    exclude: { 'qq-v1': 'y = x² with y = x + 2 is a linear-and-quadratic system: the other lesson' },
  },
  { lessonId: 'kbl-math-s1-nccd-u1_l3', slug: 'simplify-exponential-expressions', titleAr: 'تبسيط المقادير الأسية', family: 'simplify_exp' },
  { lessonId: 'kbl-math-s1-nccd-u1_l4', slug: 'exponential-equations', titleAr: 'حل المعادلة الأسية', family: 'exp_eq' },
  {
    lessonId: 'kbl-math-s2-nccd-u5_l5',
    slug: 'sequences',
    titleAr: 'المتتاليات',
    family: 'sequences',
    exclude: {
      'q-m2': 'geometric sequence; the outcomes cover linear, quadratic and cubic general terms',
      'q-h2': 'geometric sequence; the outcomes cover linear, quadratic and cubic general terms',
      'q-m3': 'sum of terms; not among the lesson outcomes',
    },
  },
];

/** The worked example plus this many questions to try. */
const PRACTICE_COUNT = 5;
/** Below this the lesson has too little to be a page worth reading. */
const MIN_SOLVED = 4;

const TIERS: DiffTier[] = ['easy', 'medium', 'hard'];

interface Lesson {
  id: string;
  titleAr: string;
  objectivesAr: string[];
}
interface Placed extends Lesson {
  unitAr: string;
  semesterAr: string;
}

function gradeTenLessons(): Placed[] {
  const out: Placed[] = [];
  for (const book of getBooksForSubjectGrade('mathematics', 'grade-10')) {
    for (const unit of getUnitsForBook(book.id)) {
      for (const l of getLessonsForUnit(unit.id)) {
        out.push({
          id: l.id,
          titleAr: l.titleAr,
          objectivesAr: l.objectivesAr,
          unitAr: unit.nameAr,
          semesterAr: getSemesterLabel(book, 'ar'),
        });
      }
    }
  }
  return out;
}

const familyOf = (l: Lesson): string | null =>
  matchMathFamily(l.titleAr, {
    id: l.id,
    titleAr: l.titleAr,
    titleEn: '',
    objectives: l.objectivesAr,
    keyConceptsAr: [],
    keyConceptsEn: [],
  });

/** Round-robin over the tiers, easy first, in bank order — deterministic, so a re-export diffs cleanly. */
function pickPractice(pool: ConcreteItem[], n: number): ConcreteItem[] {
  const byTier = TIERS.map((t) => pool.filter((i) => i.diff === t));
  const picked: ConcreteItem[] = [];
  while (picked.length < n && byTier.some((q) => q.length)) {
    for (const q of byTier) {
      const next = q.shift();
      if (next && picked.length < n) picked.push(next);
    }
  }
  return picked;
}

const shape = (item: ConcreteItem) => {
  const steps = stepsFor(item.id)!.ar;
  // steps-types.ts promises the last line states the answer verbatim, so a
  // worked solution and its key can never disagree. Hold it to that here.
  if (!steps.at(-1)?.includes(item.answer)) {
    throw new Error(`item ${item.id}: last working line does not state the answer "${item.answer}"`);
  }
  return { id: item.id, diff: item.diff, problem: itemStem(item, true), steps, answer: item.answer };
};

const all = gradeTenLessons();
const lessons = LESSONS.map((row) => {
  const lesson = all.find((l) => l.id === row.lessonId);
  if (!lesson) throw new Error(`lesson ${row.lessonId} is not in the Grade 10 maths catalog`);
  if (lesson.titleAr !== row.titleAr) {
    throw new Error(`lesson ${row.lessonId} is now titled "${lesson.titleAr}", expected "${row.titleAr}"`);
  }
  if (familyOf(lesson) !== row.family) {
    throw new Error(`lesson ${row.lessonId} no longer maps to family ${row.family} (now ${familyOf(lesson)})`);
  }
  const sharing = all.filter((l) => l.id !== row.lessonId && familyOf(l) === row.family);
  if (sharing.length) {
    throw new Error(
      `family ${row.family} is also matched by ${sharing.map((l) => l.titleAr).join(' / ')} — its items are not this lesson's alone`,
    );
  }

  const inFamily = MATH_BANK.filter((i) => i.family === row.family);
  for (const id of Object.keys(row.exclude ?? {})) {
    if (!inFamily.some((i) => i.id === id)) throw new Error(`lesson ${row.lessonId} excludes ${id}, which is not in family ${row.family}`);
  }
  const solved = inFamily.filter((i) => stepsFor(i.id) && !(row.exclude && i.id in row.exclude));
  if (solved.length < MIN_SOLVED) {
    throw new Error(`family ${row.family} has ${solved.length} solved items, need ${MIN_SOLVED}`);
  }
  const worked = solved.find((i) => i.diff === 'easy') ?? solved[0]!;
  const practice = pickPractice(solved.filter((i) => i.id !== worked.id), PRACTICE_COUNT);

  return {
    lessonId: row.lessonId,
    slug: row.slug,
    titleAr: lesson.titleAr,
    unitAr: lesson.unitAr,
    semesterAr: lesson.semesterAr,
    objectivesAr: lesson.objectivesAr,
    worked: shape(worked),
    practice: practice.map(shape),
  };
});

const target = process.argv[2] ?? 'site-practice.json';
writeFileSync(target, JSON.stringify({ lessons }, null, 1) + '\n');
console.log(`${lessons.length} lessons → ${target}`);
for (const l of lessons) console.log(`  ${l.slug}: 1 worked + ${l.practice.length} practice`);
