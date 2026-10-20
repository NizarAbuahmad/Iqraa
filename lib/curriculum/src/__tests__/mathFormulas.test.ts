/**
 * The Grade 10 formula sheet (`mathFormulas.ts`).
 *
 * A formula on a teacher's projector that is wrong is wrong in every class, so
 * nothing here rests on memory. Every entry names the lesson it belongs to by
 * id and the printed page it was taken from, and this test reads the extracted
 * student books to check three things:
 *
 *  1. the lesson exists, and the page lies inside that lesson's printed range
 *     (found from the «الدرس» headings, not from a hand-kept table);
 *  2. the page prints the formula (the fragments in `source.contains`);
 *  3. an Arabic caption, when one is given, is printed in that lesson.
 *
 * Unit 1 is deliberately absent: the book's first unit has three lessons and
 * the catalog lists four, so a lesson id there cannot be tied to a page range.
 * The numeric identities are checked in the mobile suite, where the expression
 * engine lives.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MATH_FORMULAS, getMathFormula, mathFormulasForLesson } from '../mathFormulas.ts';
import { lessonKbId } from '../curriculumIds.ts';

type Page = { page: number; text: string };
type Book = { text: Page[] };
type CatalogLesson = { id: string; title_ar: string };
type CatalogUnit = { id: string; number: number; lessons: CatalogLesson[] };

const BOOKS = {
  s1: { book: 'math-s1-student-book.json', catalog: 'iqra_curriculum_g10_math_sem1.json', semester: 1 },
  s2: { book: 'math-s2-student-book.json', catalog: 'iqra_curriculum_g10_math_sem2.json', semester: 2 },
} as const;

const read = <T>(file: string): T => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), 'utf8')) as T;

/** Extraction leaves tashkeel and a stray damma (ُ) on Arabic; drop them. */
function stripMarks(s: string): string {
  return s.replace(/[ً-ْٰـُ]/g, '');
}
/**
 * The comparison form: marks gone, every dash one dash, compatibility forms
 * folded (NFKC turns the book's math-italic and bold-italic θ into a plain θ),
 * and no whitespace at all — the extraction breaks fractions across lines and
 * tabs, so layout cannot be compared, only the symbols in order.
 */
function squash(s: string): string {
  return stripMarks(s).normalize('NFKC').replace(/[–−]/g, '-').replace(/\s+/g, '');
}

interface BookIndex {
  pages: Map<number, string>;
  /** Unit number (from the catalog) → [first page, last page]. */
  unitRange: Map<number, [number, number]>;
  /** `kbl-…` lesson id → [first page, last page]. */
  lessonRange: Map<string, [number, number]>;
  lessonIds: Set<string>;
}

function headingKind(text: string): 'unit' | 'lesson' | null {
  const lines = stripMarks(text)
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (lines.includes('الوحدة')) return 'unit';
  if (lines.includes('الدرس')) return 'lesson';
  return null;
}

function indexBook(key: keyof typeof BOOKS): BookIndex {
  const cfg = BOOKS[key];
  const book = read<Book>(`extracted/${cfg.book}`);
  const catalog = read<{ units: CatalogUnit[] }>(cfg.catalog);
  const pages = new Map(book.text.map(p => [p.page, p.text] as const));
  const last = Math.max(...pages.keys());

  const unitStarts: number[] = [];
  for (const p of book.text) if (headingKind(p.text) === 'unit') unitStarts.push(p.page);
  unitStarts.sort((a, b) => a - b);

  const unitRange = new Map<number, [number, number]>();
  const lessonRange = new Map<string, [number, number]>();
  const lessonIds = new Set<string>();

  catalog.units.forEach((unit, i) => {
    const start = unitStarts[i];
    const end = (unitStarts[i + 1] ?? last + 1) - 1;
    unitRange.set(unit.number, [start, end]);
    const realLessons = unit.lessons.filter(l => !l.id.endsWith('_lab'));
    for (const l of realLessons) lessonIds.add(lessonKbId({ gradeId: 'grade-10', subject: 'math', semester: cfg.semester }, l.id));

    const heads = book.text
      .filter(p => p.page >= start && p.page <= end && headingKind(p.text) === 'lesson')
      .map(p => p.page)
      .sort((a, b) => a - b);
    // Only trust a unit whose printed lesson count matches the catalog. Unit 1
    // does not, which is why no formula is filed there.
    if (heads.length !== realLessons.length) return;
    realLessons.forEach((l, j) => {
      const id = lessonKbId({ gradeId: 'grade-10', subject: 'math', semester: cfg.semester }, l.id);
      lessonRange.set(id, [heads[j], (heads[j + 1] ?? end + 1) - 1]);
    });
  });
  return { pages, unitRange, lessonRange, lessonIds };
}

const INDEX = { s1: indexBook('s1'), s2: indexBook('s2') };

function lessonText(book: 's1' | 's2', range: [number, number]): string {
  let out = '';
  for (let p = range[0]; p <= range[1]; p++) out += INDEX[book].pages.get(p) ?? '';
  return squash(out);
}

describe('the manifest', () => {
  it('is not empty and every id is unique', () => {
    assert.ok(MATH_FORMULAS.length >= 30);
    const ids = MATH_FORMULAS.map(f => f.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('getMathFormula finds an entry and nothing for an unknown or inherited key', () => {
    assert.equal(getMathFormula(MATH_FORMULAS[0].id)?.id, MATH_FORMULAS[0].id);
    assert.equal(getMathFormula('nope'), undefined);
    assert.equal(getMathFormula('constructor'), undefined);
  });

  it('mathFormulasForLesson returns that lesson only, in manifest order', () => {
    const lessonId = MATH_FORMULAS[0].lessonId;
    const got = mathFormulasForLesson(lessonId);
    assert.ok(got.length >= 1);
    assert.ok(got.every(f => f.lessonId === lessonId));
    assert.deepEqual(mathFormulasForLesson(''), []);
    assert.deepEqual(mathFormulasForLesson('kbl-nope'), []);
  });

  it('has an English caption and a formula on every entry', () => {
    for (const f of MATH_FORMULAS) {
      assert.ok(f.captionEn.trim().length > 0, `${f.id} captionEn`);
      assert.ok(f.formula.trim().length > 0, `${f.id} formula`);
    }
  });

  it('every check lists at least two sides to compare', () => {
    for (const f of MATH_FORMULAS) {
      if (f.check) assert.ok(f.check.equal.length >= 2, f.id);
    }
  });
});

describe('the book index finds what it is meant to', () => {
  it('maps every lesson of units 2–8 (so a formula there can be placed)', () => {
    for (const [key, units] of [['s1', [2, 3, 4]], ['s2', [5, 6, 7, 8]]] as const) {
      const idx = INDEX[key];
      for (const id of idx.lessonIds) {
        const m = /_u(\d)_l/.exec(id) ?? /-u(\d)_l/.exec(id);
        const unit = Number(m?.[1]);
        if (!(units as readonly number[]).includes(unit)) continue;
        assert.ok(idx.lessonRange.has(id), `${id} has no printed page range`);
      }
    }
  });
  it('does not claim a range for unit 1, whose printed lessons disagree with the catalog', () => {
    for (const id of INDEX.s1.lessonRange.keys()) assert.doesNotMatch(id, /-u1_l/);
  });
});

describe('every formula is placed in its lesson and printed in the book', () => {
  for (const f of MATH_FORMULAS) {
    it(`${f.id}`, () => {
      const book = f.source.book;
      const idx = INDEX[book];

      assert.ok(idx.lessonIds.has(f.lessonId), `${f.lessonId} is not a Grade 10 maths lesson`);
      const range = idx.lessonRange.get(f.lessonId);
      assert.ok(range, `${f.lessonId} has no printed page range (is it in unit 1?)`);
      assert.ok(
        f.source.page >= range[0] && f.source.page <= range[1],
        `${f.id}: page ${f.source.page} is outside ${f.lessonId} (pages ${range[0]}–${range[1]})`,
      );

      // The sheet tells a teacher «صفحة N», so N has to be the number printed on
      // that page of the book, not just the extraction's index.
      const lines = stripMarks(idx.pages.get(f.source.page) ?? '')
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);
      assert.ok(
        [...lines.slice(0, 3), ...lines.slice(-3)].includes(String(f.source.page)),
        `${f.id}: page ${f.source.page} does not print its own number`,
      );

      const page = squash(idx.pages.get(f.source.page) ?? '');
      assert.ok(page.length > 0, `page ${f.source.page} is missing from the book text`);
      assert.ok(f.source.contains.length > 0, `${f.id} cites no printed fragment`);
      for (const frag of f.source.contains) {
        assert.ok(page.includes(squash(frag)), `${f.id}: page ${f.source.page} does not print «${frag}»`);
      }

      if (f.captionAr) {
        assert.ok(
          lessonText(book, range).includes(squash(f.captionAr)),
          `${f.id}: the caption «${f.captionAr}» is not printed in ${f.lessonId}`,
        );
      }
    });
  }
});

describe('unit 1 stays out', () => {
  it('no formula is filed on a unit 1 lesson', () => {
    for (const f of MATH_FORMULAS) assert.doesNotMatch(f.lessonId, /-u1_l/);
  });
});
