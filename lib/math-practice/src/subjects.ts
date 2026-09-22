/**
 * Subject NAME → subject id.
 *
 * Matched, not imported: this package has no dependency on
 * `@workspace/curriculum`, and duplicating the subject list is cheaper than
 * adding one for a single lookup. The names mirror `Subject.name`/`.nameAr`
 * in `lib/curriculum/src/catalog.ts` — keep them in step when a subject is
 * added there.
 *
 * This replaces a `KNOWN_NON_MATH_SUBJECT` regex that listed eleven of the
 * nineteen subjects. Geography, history, digital skills, civic education,
 * physical education, creative arts, vocational education and earth science
 * were all missing, so passing any of their names said nothing and the
 * decision fell through to a keyword heuristic over the lesson text.
 *
 * Lives in its own module because both `index.ts` and `chemistry.ts` need it
 * and `index.ts` already imports values from `chemistry.ts` — importing back
 * the other way would be a cycle.
 */

/** Arabic diacritics and the tatweel, so a vowelled name still matches. */
const DIACRITICS = /[ً-ٟـٰ]/g;

function normalize(name: string): string {
  return name.replace(DIACRITICS, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** `[subjectId, ...names]`, English and Arabic as the catalog spells them. */
const SUBJECTS: ReadonlyArray<readonly [string, ...string[]]> = [
  ['mathematics', 'Mathematics', 'Math', 'الرياضيات'],
  ['arabic', 'Arabic', 'اللغة العربية'],
  ['english', 'English', 'اللغة الإنجليزية'],
  ['science', 'Science', 'العلوم'],
  ['physics', 'Physics', 'الفيزياء'],
  ['chemistry', 'Chemistry', 'الكيمياء'],
  ['biology', 'Biology', 'الأحياء'],
  ['islamic', 'Islamic Studies', 'التربية الإسلامية'],
  ['social', 'Social Studies', 'الدراسات الاجتماعية'],
  ['computer', 'Computer', 'الحاسوب'],
  ['digital-literacy', 'Digital Skills', 'المهارات الرقمية'],
  ['financial-literacy', 'Financial Literacy', 'الثقافة المالية'],
  ['earth-science', 'Earth and Environmental Science', 'علوم الأرض والبيئة'],
  ['geography', 'Geography', 'الجغرافيا'],
  ['history', 'History', 'التاريخ'],
  ['civic-education', 'National and Civic Education', 'التربية الوطنية والمدنية'],
  ['physical-education', 'Physical Education', 'التربية الرياضية'],
  ['creative-arts', 'Art, Music and Drama Education', 'التربية الفنية والموسيقية والمسرحية'],
  ['vocational-education', 'Vocational Education', 'التربية المهنية'],
];

const BY_NAME = new Map<string, string>();
for (const [id, ...names] of SUBJECTS) {
  for (const name of names) BY_NAME.set(normalize(name), id);
}

/**
 * The subject id a caller's subject NAME refers to, or null when the string is
 * not one we recognise.
 *
 * Null means "no opinion", not "not maths" — an unrecognised string must leave
 * the decision to the lesson, exactly as before.
 */
export function subjectIdFromName(subject?: string): string | null {
  if (!subject) return null;
  return BY_NAME.get(normalize(subject)) ?? null;
}
