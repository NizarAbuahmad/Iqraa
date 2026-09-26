/**
 * Export the curriculum the app shows into the snapshot iqrra.com renders at
 * /manhaj (the Site_Iqra repo's `data/curriculum.json`).
 *
 *   node --experimental-strip-types lib/curriculum/scripts/export-site-snapshot.ts ../Site_Iqra/data/curriculum.json
 *
 * Then, in Site_Iqra, `node tools-build-curriculum.mjs` and commit what it
 * writes. The site has no build step on deploy, so the snapshot only moves
 * when someone runs this — which is how the site sat on Grades 6–10 for a
 * week after Grades 1–5 shipped in the app.
 *
 * A grade/subject whose lessons carry neither objectives nor key terms is
 * dropped here: a page of bare lesson titles is the thin page the site's own
 * builder refuses to publish, so there is no point shipping it the data.
 */
import { writeFileSync } from 'node:fs';

import {
  getBooksForSubjectGrade,
  getLessonsForUnit,
  getSemesterLabel,
  getSubjectsForGrade,
  getUnitsForBook,
  getVisibleGrades,
} from '../src/catalog.ts';

const out = [];
const grades = [...getVisibleGrades()].sort((a, b) => b.level - a.level);
for (const grade of grades) {
  for (const subject of getSubjectsForGrade(grade.id)) {
    const books = getBooksForSubjectGrade(subject.id, grade.id).map((b) => ({
      id: b.id,
      semester: getSemesterLabel(b, 'ar'),
      units: getUnitsForBook(b.id).map((u) => ({
        nameAr: u.nameAr,
        descriptionAr: u.descriptionAr,
        lessons: getLessonsForUnit(u.id).map((l) => ({
          titleAr: l.titleAr,
          objectivesAr: l.objectivesAr,
          keywordsAr: l.keywordsAr,
        })),
      })),
    }));
    const units = books.flatMap((b) => b.units);
    const lessons = units.flatMap((u) => u.lessons);
    if (!lessons.some((l) => l.objectivesAr.length || l.keywordsAr.length)) continue;
    out.push({
      gradeId: grade.id,
      gradeAr: grade.nameAr,
      subjectId: subject.id,
      subjectAr: subject.nameAr,
      books,
      counts: { units: units.length, lessons: lessons.length },
    });
  }
}

const target = process.argv[2] ?? 'site-curriculum.json';
writeFileSync(target, JSON.stringify(out));
console.log(`${out.length} grade/subject pages → ${target}`);
