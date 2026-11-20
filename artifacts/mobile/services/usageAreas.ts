/**
 * Which area of the app a route belongs to, for the time-spent heartbeat
 * (hooks/useUsageHeartbeat.ts → POST /usage/heartbeat → `usage_minutes`).
 *
 * Only the area name leaves the device — never the path, an id or a query — so the admin
 * insights page can say "teachers spend most of their time in the quiz generator" without
 * holding a trail of which lesson or which student anyone opened.
 *
 * `USAGE_AREAS` must equal the API's list (artifacts/api-server/src/lib/usageAreas.ts); the
 * server stores anything it does not know as `other`, so `usageAreas.test.ts` reads that file
 * and compares. Append, never rename: a renamed area splits its history in two.
 *
 * Pure — no react-native import — so bare `node --test` can load it.
 */

export const USAGE_AREAS = [
  'today',
  'tools',
  'gen-quiz',
  'gen-worksheet',
  'gen-lesson-plan',
  'gen-activity',
  'gen-slides',
  'gen-other',
  'classroom',
  'chat',
  'curriculum',
  'corner-math',
  'corner-lab',
  'corner-quran',
  'corner-english',
  'play',
  'classes',
  'evaluations',
  'homework',
  'schedule',
  'teaching-plans',
  'workspace',
  'messaging',
  'school',
  'notifications',
  'profile',
  'admin',
  'other',
] as const;

export type UsageArea = (typeof USAGE_AREAS)[number];

/** The first path segment → area, for every segment that is a whole area on its own. */
const TOP: Record<string, UsageArea> = {
  'iqra': 'chat',
  'play': 'play',
  'live': 'play',
  'classes': 'classes',
  'evaluations': 'evaluations',
  'exam-review': 'evaluations',
  'take': 'evaluations',
  'my-exams': 'evaluations',
  'homework-project': 'homework',
  'homework-submissions': 'homework',
  'schedule': 'schedule',
  'calendar': 'schedule',
  'teaching-plans': 'teaching-plans',
  'workspace': 'workspace',
  // A material opened from its share link (app/m/[code].tsx) is the same screen as ملفاتي's.
  'm': 'workspace',
  'messaging': 'messaging',
  'school': 'school',
  'notifications': 'notifications',
  'profile': 'profile',
  'settings': 'profile',
  'setup-subjects': 'profile',
  'setup-grade': 'profile',
  'teacher-profile': 'profile',
  'onboarding': 'profile',
  'whats-new': 'profile',
  'faq': 'profile',
  'legal': 'profile',
  'suggest-feature': 'profile',
  'add-email': 'profile',
  'delete-account': 'profile',
  'admin': 'admin',
};

const GENERATORS: Record<string, UsageArea> = {
  'quiz': 'gen-quiz',
  'worksheet': 'gen-worksheet',
  'lesson-plan': 'gen-lesson-plan',
  'activity': 'gen-activity',
  'slides': 'gen-slides',
  'prompt-slides': 'gen-slides',
  'classroom': 'classroom',
  'whiteboard': 'classroom',
};

const CORNERS: Record<string, UsageArea> = {
  'math': 'corner-math',
  'lab': 'corner-lab',
  'quran': 'corner-quran',
  'english': 'corner-english',
};

/**
 * The area a pathname belongs to, or null for a screen that must never beat: the parent
 * consent page (`/guardian`), whose URL carries an approval token — the same exclusion
 * `shouldTrackScreen` makes for analytics.
 */
export function areaForPath(pathname: string): UsageArea | null {
  const clean = pathname.split(/[?#]/)[0] ?? '';
  const parts = clean.split('/').filter(Boolean);
  const [first, second] = parts;
  if (!first) return 'today';
  if (first === 'guardian') return null;
  if (first === 'ai-tools') return second ? (GENERATORS[second] ?? 'gen-other') : 'tools';
  if (first === 'curriculum') return (second && CORNERS[second]) || 'curriculum';
  return TOP[first] ?? 'other';
}
