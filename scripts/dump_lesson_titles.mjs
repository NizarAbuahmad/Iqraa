/**
 * Writes the curriculum's books, units and lessons (ids and Arabic titles, in
 * book order) for the subjects `map_lesson_pages.py` handles, as JSON.
 *
 *   node --experimental-strip-types scripts/dump_lesson_titles.mjs <out.json> [--all]
 *
 * Kept out of the Python script because the lesson list lives in TypeScript
 * (`artifacts/mobile/services/knowledgeBase.ts`); a title is the join key
 * between the curriculum and the page it opens on.
 */
import { writeFileSync } from 'node:fs';
import { KB_BOOKS, KB_UNITS, KB_LESSONS } from '../artifacts/mobile/services/knowledgeBase.ts';

const SUBJECTS = new Set(['arabic', 'islamic', 'physical-education', 'digital-literacy', 'civic-education']);
const ALL = process.argv[3] === '--all';
const books = KB_BOOKS.filter(b => ALL || SUBJECTS.has(b.subjectId)).map(b => ({
  id: b.id,
  gradeId: b.gradeId,
  subjectId: b.subjectId,
  semester: b.semester ?? null,
  units: KB_UNITS.filter(u => u.bookId === b.id).map(u => ({
    id: u.id,
    titleAr: u.titleAr,
    lessons: KB_LESSONS.filter(l => l.unitId === u.id)
      .sort((a, c) => a.order - c.order)
      .map(l => ({ id: l.id, titleAr: l.titleAr })),
  })),
}));
writeFileSync(process.argv[2], JSON.stringify(books, null, 1));
console.log(`${books.length} books, ${books.reduce((n, b) => n + b.units.reduce((m, u) => m + u.lessons.length, 0), 0)} lessons`);
