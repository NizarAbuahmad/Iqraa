/**
 * Scaffold blank CQV Markdown reports for every Grade 10 Math lesson × artifact.
 *
 * Usage (from repo root):
 *   pnpm --filter @workspace/mobile run cqv:scaffold
 *
 * Writes under: <repo>/cqv-reports/grade-10-math/
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(mobileRoot, '../..');
const outRoot = path.join(repoRoot, 'cqv-reports', 'grade-10-math');

const ARTIFACTS = [
  ['lesson-plan', 'Lesson Plan', 'خطة درس'],
  ['worksheet', 'Worksheet', 'ورقة عمل'],
  ['quiz', 'Quiz', 'اختبار'],
  ['homework', 'Homework', 'واجب منزلي'],
  ['classroom-activity', 'Classroom Activity', 'نشاط صفي'],
  ['interactive-lesson', 'Interactive Lesson', 'درس تفاعلي'],
  ['assessment', 'Assessment', 'تقييم'],
  ['answer-key', 'Answer Key', 'مفتاح الإجابة'],
];

/** Keep in sync with services/cqv/catalog (MVP books only). */
const LESSONS = [
  // Semester 1
  { id: 'lesson-math-1', semester: 1, unit: 'Functions', unitAr: 'الاقترانات', name: 'Polynomial Functions', nameAr: 'كثيرات الحدود وخصائصها' },
  { id: 'lesson-math-2', semester: 1, unit: 'Functions', unitAr: 'الاقترانات', name: 'Rational Functions', nameAr: 'الاقترانات النسبية' },
  { id: 'lesson-math-3', semester: 1, unit: 'Functions', unitAr: 'الاقترانات', name: 'Function Composition and Inverse Functions', nameAr: 'تركيب الاقترانات والاقتران العكسي' },
  { id: 'lesson-math-8-1', semester: 1, unit: 'Probability', unitAr: 'الاحتمال', name: 'Basic Probability Concepts', nameAr: 'مفاهيم الاحتمال الأساسية' },
  { id: 'lesson-math-8-2', semester: 1, unit: 'Probability', unitAr: 'الاحتمال', name: 'Mutually Exclusive and Non-Exclusive Events', nameAr: 'الحوادث المتنافية وغير المتنافية' },
  // Semester 2
  { id: 'lesson-math-s2-1-1', semester: 2, unit: 'Equations', unitAr: 'المعادلات', name: 'Solving Special Equations', nameAr: 'حل معادلات خاصة' },
  { id: 'lesson-math-s2-1-2', semester: 2, unit: 'Equations', unitAr: 'المعادلات', name: 'Solving a System: Linear and Quadratic Equations', nameAr: 'حل نظام مكون من معادلة خطية ومعادلة تربيعية' },
  { id: 'lesson-math-s2-1-3', semester: 2, unit: 'Equations', unitAr: 'المعادلات', name: 'Solving a System of Two Quadratic Equations', nameAr: 'حل نظام مكون من معادلتين تربيعيتين' },
  { id: 'lesson-math-s2-2-1', semester: 2, unit: 'The Circle', unitAr: 'الدائرة', name: 'Chords and Tangents', nameAr: 'الأوتار والمماسات' },
  { id: 'lesson-math-s2-2-2', semester: 2, unit: 'The Circle', unitAr: 'الدائرة', name: 'Arcs and Sectors', nameAr: 'الأقواس والقطاعات' },
  { id: 'lesson-math-s2-2-3', semester: 2, unit: 'The Circle', unitAr: 'الدائرة', name: 'Circle Angles', nameAr: 'زوايا الدائرة' },
  { id: 'lesson-math-s2-2-4', semester: 2, unit: 'The Circle', unitAr: 'الدائرة', name: 'Equation of a Circle', nameAr: 'معادلة الدائرة' },
  { id: 'lesson-math-s2-3-1', semester: 2, unit: 'Trigonometry', unitAr: 'حساب المثلثات', name: 'Trigonometric Ratios', nameAr: 'النسب المثلثية' },
  { id: 'lesson-math-s2-3-2', semester: 2, unit: 'Trigonometry', unitAr: 'حساب المثلثات', name: 'Angles in a Rotation', nameAr: 'الزوايا في الدورة الكاملة' },
  { id: 'lesson-math-s2-3-3', semester: 2, unit: 'Trigonometry', unitAr: 'حساب المثلثات', name: 'Trig Graphs', nameAr: 'التمثيل البياني للاقترانات المثلثية' },
  { id: 'lesson-math-s2-3-4', semester: 2, unit: 'Trigonometry', unitAr: 'حساب المثلثات', name: 'Trig Equations', nameAr: 'المعادلات المثلثية' },
  { id: 'lesson-math-s2-4-1', semester: 2, unit: 'Applications of Trigonometry', unitAr: 'تطبيقات المثلثات', name: 'Bearing (Direction from North)', nameAr: 'الاتجاه من الشمال' },
  { id: 'lesson-math-s2-4-2', semester: 2, unit: 'Applications of Trigonometry', unitAr: 'تطبيقات المثلثات', name: 'The Law of Sines', nameAr: 'قانون الجيوب' },
  { id: 'lesson-math-s2-4-3', semester: 2, unit: 'Applications of Trigonometry', unitAr: 'تطبيقات المثلثات', name: 'The Law of Cosines', nameAr: 'قانون جيوب التمام' },
  { id: 'lesson-math-s2-4-4', semester: 2, unit: 'Applications of Trigonometry', unitAr: 'تطبيقات المثلثات', name: 'Area of a Triangle Using Sine', nameAr: 'مساحة المثلث باستعمال جيب الزاوية' },
];

function blankReport(lesson, artifact) {
  const [id, label, labelAr] = artifact;
  return `# CQV Report — ${lesson.nameAr}

## Scope
- **Curriculum:** Jordan Curriculum
- **Grade:** 10
- **Subject:** Mathematics / الرياضيات
- **Semester:** ${lesson.semester}
- **Unit:** ${lesson.unitAr} (${lesson.unit})
- **Lesson:** ${lesson.nameAr}
- **Lesson ID:** \`${lesson.id}\`
- **Artifact:** ${labelAr} / ${label} (\`${id}\`)

## Verdict
- **Pass / Fail:** **PENDING**
- **Reviewed at:** _not reviewed_
- **Updated at:** _scaffold_

## Scores (1–10)
- **Educational Quality:** _not scored_
- **Arabic Language:** _not scored_
- **Curriculum Alignment:** _not scored_
- **Teacher Usability:** _not scored_
- **Formatting:** _not scored_
- **Teacher Trust:** _not scored_

## Notes
_None_

## Recommended improvements
_None_

---
_Scaffolded by \`pnpm --filter @workspace/mobile run cqv:scaffold\`. Fill via CQV UI or edit this file._
`;
}

mkdirSync(outRoot, { recursive: true });

let written = 0;
for (const lesson of LESSONS) {
  const dir = path.join(outRoot, `s${lesson.semester}`, lesson.id);
  mkdirSync(dir, { recursive: true });
  for (const artifact of ARTIFACTS) {
    const file = path.join(dir, `${artifact[0]}.md`);
    if (existsSync(file)) continue; // never overwrite filled reports
    writeFileSync(file, blankReport(lesson, artifact), 'utf8');
    written += 1;
  }
}

const indexMd = `# Grade 10 Mathematics — CQV Reports

Jordan Curriculum · Grade 10 · Mathematics · Semesters 1 & 2

## How to use

1. Run the app: \`pnpm run dev:mobile:web\`
2. Sign in, then open **http://localhost:8081/dev/cqv**
3. For each lesson, generate every artifact and score the report in the UI
4. Export Markdown from the UI (downloads) **or** fill these scaffold files

Scaffold skips files that already exist so filled reports are never overwritten.

## Lessons (${LESSONS.length})

${LESSONS.map(l => `- [ ] **S${l.semester}** \`${l.id}\` — ${l.nameAr}`).join('\n')}
`;

writeFileSync(path.join(outRoot, 'README.md'), indexMd, 'utf8');

console.log(`[cqv:scaffold] wrote ${written} new templates under ${outRoot}`);
console.log(`[cqv:scaffold] lessons=${LESSONS.length} artifacts=${ARTIFACTS.length}`);
