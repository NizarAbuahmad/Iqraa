/**
 * Which grades each /play game suits — shown on its hub card so a teacher
 * can tell at a glance whether to share it with their class.
 *
 * Judged against the Jordanian curriculum, not measured: + and − facts to 20
 * are Grade 1–3 work, times tables Grade 3–5, element symbols start in Grade 7
 * science and run through Grade 10 chemistry. The English corner covers the
 * books it has words for (G1–4 and G9–10). Keyed by the hub's game id, so a new
 * game without a band fails typecheck.
 */

export const PLAY_GAME_IDS = [
  'english', 'elements', 'flags', 'capitals', 'memory', 'colors', 'multiply', 'divide', 'add', 'subtract',
] as const;
export type PlayGameId = (typeof PLAY_GAME_IDS)[number];

/** Inclusive [from, to] grade range. */
export type GradeRange = readonly [number, number];

export const PLAY_GAME_GRADES: Record<PlayGameId, readonly GradeRange[]> = {
  english: [[1, 4], [9, 10]],
  elements: [[7, 10]],
  flags: [[3, 8]],
  capitals: [[4, 9]],
  memory: [[1, 3]],
  colors: [[1, 4]],
  multiply: [[3, 5]],
  divide: [[3, 5]],
  add: [[1, 3]],
  subtract: [[1, 3]],
};

/** U+2060 WORD JOINER around the dash: a narrow card wrapped «9–10» into «9–» / «10». */
const span = ([from, to]: GradeRange): string => (from === to ? `${from}` : `${from}\u2060–\u2060${to}`);

/** «الصفوف 7–10» / "Grades 7–10"; a single grade reads «الصف 7» / "Grade 7". */
export function gradeBandLabel(ranges: readonly GradeRange[], lang: 'ar' | 'en'): string {
  const single = ranges.length === 1 && ranges[0][0] === ranges[0][1];
  if (lang === 'ar') return `${single ? 'الصف' : 'الصفوف'} ${ranges.map(span).join(' و')}`;
  return `${single ? 'Grade' : 'Grades'} ${ranges.map(span).join(', ')}`;
}
