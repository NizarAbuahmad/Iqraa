/**
 * What kind of lesson a subject teaches — the part of a lesson plan that is NOT
 * about the teaching style.
 *
 * Every plan used to be built from one maths template: «اشرح «X» مع مثال محلول
 * واضح», «بطاقة المثال المحلول لكل طالب», «ماذا نفعل أولًا؟», «بيّن خطوات الحل
 * كاملة». For a Quran lesson that is a worked-example routine with nothing to
 * solve; for physical education it names no skill, no drill and no safety; for
 * science it contains no observation. (Measured on 2026-10-01: all 103 sampled
 * plans, whatever the subject, were the same skeleton with the title swapped.)
 *
 * The teaching STYLE (direct / inquiry / collaborative) still decides the
 * shape of a lesson; the KIND decides what the work in that shape is made of —
 * a recitation, an observation, a source, a drill, a piece being made.
 */

export type LessonKind =
  | 'calc'        // mathematics: worked examples, solved step by step
  | 'science'     // science, biology, earth science, physics, chemistry: observe, explain, test
  | 'recitation'  // Islamic education: read, recite, understand, live by it
  | 'arabic'      // Arabic language: text, vocabulary, the four skills
  | 'english'     // English language: present, practise, produce
  | 'social'      // social studies, history, geography, civics, financial literacy: sources and cases
  | 'movement'    // physical education: skill, drill, game, safety
  | 'making';     // arts, vocational, digital: demonstrate, make, review

const KIND_BY_SUBJECT: Record<string, LessonKind> = {
  mathematics: 'calc',
  science: 'science',
  biology: 'science',
  'earth-science': 'science',
  physics: 'science',
  chemistry: 'science',
  islamic: 'recitation',
  arabic: 'arabic',
  english: 'english',
  social: 'social',
  history: 'social',
  geography: 'social',
  'civic-education': 'social',
  'financial-literacy': 'social',
  'physical-education': 'movement',
  'creative-arts': 'making',
  'vocational-education': 'making',
  'digital-literacy': 'making',
};

/**
 * An unknown or missing subject keeps the plan it always had (`calc`), so an
 * ungrounded free-typed topic does not change behaviour by accident.
 */
export function lessonKindFor(subjectId: string | undefined): LessonKind {
  return (subjectId && KIND_BY_SUBJECT[subjectId]) || 'calc';
}

/** Subjects whose lessons carry calculations a science plan should still work through. */
export function sciencePlanHasCalculations(subjectId: string | undefined): boolean {
  return subjectId === 'physics' || subjectId === 'chemistry';
}

/**
 * Does a lesson of this subject have a problem to work step by step? A deck's
 * «أمثلة محلولة» chip (and its example slides) is offered only then: maths,
 * physics and chemistry, and a subject we cannot place. Same rule as the API's
 * `usesWorkedExample` (`artifacts/api-server/src/lib/lessonKinds.ts`) — both
 * places move together, or a live and an offline paper disagree.
 */
export function usesWorkedExample(subjectId: string | undefined): boolean {
  const kind = lessonKindFor(subjectId);
  return kind === 'calc' || sciencePlanHasCalculations(subjectId);
}

/**
 * «لـ» + «التحويل» is «للتحويل», «بـ» + «التصنيف» is «بالتصنيف». The plan
 * strings used to glue the prefix on with a tatweel («لـالتَّحْويلُ»), which is
 * not how either is written.
 */
export function arPrefixed(prefix: 'ل' | 'ب', word: string): string {
  const w = word.trim();
  if (w.startsWith('ال')) return prefix === 'ل' ? `لل${w.slice(2)}` : `بال${w.slice(2)}`;
  return `${prefix}${w}`;
}
