/**
 * The teacher newsletter's draft (docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md).
 *
 * Built here, in the app, because the «ما الجديد» notes and their translations live here
 * (services/whatsNew.ts, services/i18n.ts). It only fills the admin's form
 * (app/admin/newsletter.tsx): nothing is stored or sent from a draft, and the admin edits
 * it freely before the test copy.
 *
 * The body is plain text, which the API turns into email HTML (api-server lib/siteMail.ts,
 * `renderBroadcastBody`): a blank line starts a paragraph, a bare URL becomes a link, and
 * each paragraph takes its own direction — so the Arabic block reads right to left and the
 * English block under it left to right.
 *
 * Pure, and loaded by bare `node --test`: type-only imports, nothing from react-native.
 */
import type { WhatsNewEntry } from './whatsNew.ts';

export const NEWSLETTER_APP_URL = 'https://app.iqrra.com';
/** How far the first issue looks back, when there is no last issue to start from. */
export const NEWSLETTER_FIRST_WINDOW_DAYS = 31;
export const NEWSLETTER_SUBJECT = "جديد إقرأ هذا الشهر · What's new in Iqrra";

const INTRO_AR = 'هذه رسالة إقرأ الشهرية للمعلّمين: ما الجديد في التطبيق. لإيقافها اضغط «إلغاء الاشتراك» أسفل الرسالة.';
const INTRO_EN = "This is Iqrra's monthly email for teachers: what is new in the app. To stop it, press Unsubscribe at the bottom.";

/** `days` before a `YYYY-MM-DD`, as a `YYYY-MM-DD`. */
function daysBefore(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!) - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function buildNewsletterDraft(input: {
  entries: readonly WhatsNewEntry[];
  /** Amman day of the last sent issue, or null when none was ever sent. */
  since: string | null;
  /** Today in Amman. */
  today: string;
  ar: (key: string) => string;
  en: (key: string) => string;
}): { subject: string; body: string; count: number } {
  const first = input.since === null;
  // "Dated after `since`": with no issue yet, 31 days before today is the last day left out.
  const after = input.since ?? daysBefore(input.today, NEWSLETTER_FIRST_WINDOW_DAYS);
  // ISO days compare as strings. Newest first, whatever order the list is in.
  const picked = input.entries
    .filter((e) => e.roles.includes('teacher') && e.date > after && e.date <= input.today)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (picked.length === 0) return { subject: NEWSLETTER_SUBJECT, body: '', count: 0 };

  const block = (t: (key: string) => string) =>
    picked.map((e) => [t(e.titleKey), t(e.bodyKey), ...(e.route ? [`${NEWSLETTER_APP_URL}${e.route}`] : [])].join('\n'));
  const body = [...(first ? [INTRO_AR] : []), ...block(input.ar), ...(first ? [INTRO_EN] : []), ...block(input.en)].join('\n\n');
  return { subject: NEWSLETTER_SUBJECT, body, count: picked.length };
}
