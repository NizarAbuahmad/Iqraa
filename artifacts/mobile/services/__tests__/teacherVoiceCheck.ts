/**
 * The teacher-voice detector, shared by `lessonPlanTeacherVoice.test.ts` and
 * `lessonPlanVariants.test.ts` (an alternative wording must be in the same
 * voice as the first). Not a test file: the runner only globs `*.test.ts`.
 */

/** The imperative stems the plans used to open their instructions with, bare. */
const IMPERATIVES = [
  'اعرض', 'اسأل', 'فسر', 'صحح', 'اشرح', 'اقرأ', 'اكتب', 'اكتبها', 'اقرأها', 'اتل', 'ابدأ', 'قدم', 'اطرح',
  'استخرج', 'ناقش', 'ثبت', 'جه', 'اضغط', 'دع', 'سم', 'تجول', 'راقب', 'راجع', 'صنف', 'سجل', 'ميز',
  'وزع', 'اجمع', 'اطلب', 'اسحب', 'عالجها', 'اعطهم', 'اعلن', 'اربط', 'ابحث',
  'اكمل', 'احضره', 'شجع', 'انصت', 'استمع', 'اصنع', 'اضف', 'أجب', 'مارس', 'حدد',
  'كرر', 'احذف', 'قلل', 'انطق', 'تحقق', 'اوقف', 'اختم', 'استخدم', 'اختر', 'ارسم', 'ابن', 'اذكر',
  'لاحظ', 'قيم', 'حاور', 'انشئ', 'ابدأ', 'خذ', 'قارن', 'اجعل', 'اترك', 'اسمح', 'امنح', 'اشر',
  'تأكد', 'تاكد', 'اعتمد', 'اشرك', 'اعد', 'اطبع', 'اطلع', 'تابع', 'ساعد', 'اشجع', 'صوب', 'وضح',
  'اعمل', 'ركز', 'نبه', 'افتح', 'اغلق', 'اقترح', 'اكشف', 'انتقل', 'ارفع', 'امسح', 'اعلم',
];

/**
 * Diacritics and tatweel dropped. Hamza is NOT folded: «أسأل» (I ask) and «اسأل»
 * (ask!) differ only in that letter once the vowels are gone. For the same
 * reason the list above holds no form-IV imperative («أعلن», «أضف», «أكمل»…),
 * whose bare spelling is also the first-person verb this test wants.
 */
export const norm = (s: string) => s.replace(/[\u064B-\u0652\u0640]/g, '');

/** Teacher text with what is spoken to the students taken out. */
export const teacherOwn = (s: string) =>
  norm(s).replace(/«[^»]*»/g, ' ').replace(/“[^”]*”/g, ' ').replace(/"[^"]*"/g, ' ');

/** Words in `s` that are an imperative, with or without a leading و / ف. */
export function imperativesIn(s: string): string[] {
  const bare = new Set(IMPERATIVES.map(norm));
  const hits: string[] = [];
  for (const word of teacherOwn(s).split(/[\s•.،:؛()\-–—]+/)) {
    if (!word) continue;
    const w = word.replace(/^[وف]/, '');
    if (bare.has(word) || bare.has(w)) hits.push(word);
  }
  // «حلّ مثالًا» — `حل` alone is also the noun, so only the verb's own object counts.
  for (const m of teacherOwn(s).matchAll(/(^|\s)[وف]?حل (مثالا|المسالة|التمرين)/g)) hits.push(m[0].trim());
  // «أنت تتجوّل وتصحّح» — the teacher addressed as «you».
  for (const m of teacherOwn(s).matchAll(/(^|\s)(دورك|وأنت|وانت|أنت تتجول|انت تتجول)(\s|$)/g)) hits.push(m[0].trim());
  return hits;
}

export const FIRST_PERSON = /(^|[\s•\d.\-–(])[وف]?س[أن][^\s]/;

