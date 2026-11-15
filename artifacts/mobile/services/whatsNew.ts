/**
 * «ما الجديد» — telling people who already use the app that something changed
 * (docs/superpowers/specs/2026-10-30-whats-new-design.md).
 *
 * `WHATS_NEW` is the list. A user-visible feature adds its entry here in the same
 * PR, dated the day it merges, so the note ships with the feature — the same web
 * deploy and over-the-air update — and can never arrive before it. A PR that adds
 * no entry for a visible change says why in its body.
 *
 * Who sees what is decided here, pure, so `node --test` can pin it
 * (services/__tests__/whatsNew.test.ts). The dialog is
 * components/whatsNew/WhatsNewHost.tsx, the Profile screen app/whats-new.tsx,
 * and the AsyncStorage I/O whatsNewStorage.ts.
 */
import type { TranslationKey } from './i18n.ts';
import { TOUR_MAX_AGE_DAYS, TOUR_SINCE, isTourHome, tourRoleOf, type TourRole, type TourUserLike } from './tour.ts';
import { needsGradeSetup, needsGuardianApproval, needsRosterClaim, needsTeacherSetup } from './routeGating.ts';

export type WhatsNewEntry = {
  /** Never reused or renamed: it is what a device remembers as seen. */
  id: string;
  /** The Amman calendar day the feature reached users, `YYYY-MM-DD`. A future day stays hidden until it comes. */
  date: string;
  roles: readonly TourRole[];
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  /** Where «جرّبها» goes. Must be a screen every role in `roles` may open — the test checks. */
  route?: string;
  /**
   * A tool in `services/toolCatalog.ts` that this entry announces: its card on the
   * Tools tab and in the chat "+" menu wears «جديد» (`newToolIds`). Tools are a
   * teacher's, so `roles` must include `teacher` — the test checks.
   */
  toolId?: string;
};

const ALL_ROLES: readonly TourRole[] = ['teacher', 'student', 'parent'];

/** Newest first. Append above the top entry; never edit an `id` that has shipped. */
export const WHATS_NEW: readonly WhatsNewEntry[] = [
  {
    id: 'g5-english-twelve-lessons',
    date: '2026-11-13',
    roles: ['teacher'],
    titleKey: 'whatsNewG5EnglishLessonsTitle',
    bodyKey: 'whatsNewG5EnglishLessonsBody',
    route: '/curriculum/browse',
  },
  {
    id: 'g10-vocational-curriculum',
    date: '2026-11-13',
    roles: ['teacher'],
    titleKey: 'whatsNewG10VocationalTitle',
    bodyKey: 'whatsNewG10VocationalBody',
    route: '/curriculum/browse',
  },
  {
    id: 'follow-us-social',
    date: '2026-11-13',
    roles: ALL_ROLES,
    titleKey: 'whatsNewFollowUsTitle',
    bodyKey: 'whatsNewFollowUsBody',
    route: '/profile',
  },
  {
    id: 'exam-drawn-figures',
    date: '2026-11-03',
    roles: ['teacher'],
    titleKey: 'whatsNewDrawnFiguresTitle',
    bodyKey: 'whatsNewDrawnFiguresBody',
    route: '/evaluations',
  },
  {
    id: 'exams-clearer-cards',
    date: '2026-11-01',
    roles: ['student', 'parent'],
    titleKey: 'whatsNewExamsTitle',
    bodyKey: 'whatsNewExamsBody',
    route: '/my-exams',
  },
  {
    id: 'play-spelling-game',
    date: '2026-11-01',
    roles: ALL_ROLES,
    titleKey: 'whatsNewSpellingTitle',
    bodyKey: 'whatsNewSpellingBody',
    route: '/play/spelling',
  },
  {
    id: 'play-games-upgrade',
    date: '2026-10-30',
    roles: ALL_ROLES,
    titleKey: 'whatsNewGamesUpgradeTitle',
    bodyKey: 'whatsNewGamesUpgradeBody',
    route: '/play',
  },
  {
    id: 'play-hub-filters',
    date: '2026-10-30',
    roles: ALL_ROLES,
    titleKey: 'whatsNewPlayTitle',
    bodyKey: 'whatsNewPlayBody',
    route: '/play',
  },
  {
    id: 'tour-replay',
    date: '2026-10-27',
    roles: ALL_ROLES,
    titleKey: 'whatsNewTourTitle',
    bodyKey: 'whatsNewTourBody',
    route: '/profile',
  },
];

/** An entry older than this is not shown on its own; Profile → «ما الجديد» still lists it. */
export const WHATS_NEW_MAX_AGE_DAYS = 45;
/** The dialog shows at most this many, newest first, once per session. The rest wait for the next launch, and Profile lists them all. */
export const WHATS_NEW_MAX_SHOWN = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight in Amman (a fixed UTC+3, as homework due dates use) of the entry's day. */
export function entryTime(date: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00+03:00`) : NaN;
}

/** Per account, on this device — the same reasoning as `tourDoneKey`. */
export function whatsNewSeenKey(userId: string): string {
  return `@iqra_whats_new_seen_v1:${userId}`;
}

/** What storage answered: the ids seen, or `'all'` when it could not be read (never nag). */
export type SeenIds = readonly string[] | 'all';

/** Every entry for a role whose day has come, newest first — the Profile screen's list. */
export function entriesFor(role: TourRole, now: number, entries: readonly WhatsNewEntry[] = WHATS_NEW): WhatsNewEntry[] {
  return entries
    .filter(e => e.roles.includes(role) && entryTime(e.date) <= now)
    .sort((a, b) => entryTime(b.date) - entryTime(a.date));
}

/**
 * What the dialog would show this account: its role's entries that arrived after
 * the account was made, are not too old, and have not been seen.
 */
export function unseenFor(opts: {
  role: TourRole;
  createdAt: number;
  seen: SeenIds;
  now: number;
  entries?: readonly WhatsNewEntry[];
}): WhatsNewEntry[] {
  const { role, createdAt, seen, now } = opts;
  if (seen === 'all') return [];
  return entriesFor(role, now, opts.entries)
    .filter(e => {
      const at = entryTime(e.date);
      return createdAt < at && now - at <= WHATS_NEW_MAX_AGE_DAYS * DAY_MS && !seen.includes(e.id);
    })
    .slice(0, WHATS_NEW_MAX_SHOWN);
}

// ─── «جديد» on a new tool's card ────────────────────────────────────────────

/** A tool's «جديد» goes this many days after its entry's day, or at its first open, whichever is sooner. */
export const NEW_TOOL_DAYS = 30;

/** Per account, on this device: the tools opened since they were announced. */
export function newToolOpenedKey(userId: string): string {
  return `@iqra_new_tool_opened_v1:${userId}`;
}

/**
 * The tools whose cards wear «جديد» for this account: announced by an entry for its
 * role, after the account was made (to a newer account nothing is new), within
 * `NEW_TOOL_DAYS`, and not opened since. `opened === 'all'` (unreadable storage)
 * shows none.
 */
export function newToolIds(opts: {
  role: TourRole;
  createdAt: number;
  opened: SeenIds;
  now: number;
  entries?: readonly WhatsNewEntry[];
}): Set<string> {
  const { role, createdAt, opened, now } = opts;
  const ids = new Set<string>();
  if (opened === 'all' || Number.isNaN(createdAt)) return ids;
  for (const e of entriesFor(role, now, opts.entries)) {
    if (!e.toolId) continue;
    const at = entryTime(e.date);
    if (createdAt < at && now - at <= NEW_TOOL_DAYS * DAY_MS && !opened.includes(e.toolId)) ids.add(e.toolId);
  }
  return ids;
}

/**
 * The tools a pathname belongs to — a tool's screen or anything under it
 * (`/ai-tools/classroom/builder` is the classroom). Opening it by any way in (its
 * card, a link from Today, a deep link) clears its «جديد». Two catalog entries can
 * share a screen, so this returns every match.
 */
export function toolIdsForPath(pathname: string, tools: readonly { id: string; route?: string }[]): string[] {
  return tools
    .filter(t => t.route && (pathname === t.route || pathname.startsWith(`${t.route}/`)))
    .map(t => t.id);
}

/**
 * The label a tool card wears, for the Tools tab and the chat "+" menu alike: a
 * tool's own fixed label (GeoGebra's) first, else «جديد» while it is new.
 */
export function toolBadgeKey(tool: { id: string; badgeKey?: string }, newTools: ReadonlySet<string>): string | undefined {
  return tool.badgeKey ?? (newTools.has(tool.id) ? 'whatsNewBadge' : undefined);
}

export type WhatsNewBlocker =
  | 'loading'
  | 'no-user'
  | 'no-role'
  | 'unread'
  | 'suppressed'
  | 'route'
  | 'gate'
  | 'tour'
  | 'no-created-at'
  | 'nothing-new';

export type WhatsNewInput = {
  user: TourUserLike | null | undefined;
  pathname: string;
  isLoading: boolean;
  gradeSetupSkipped: boolean | null;
  /** `null` until read. */
  seen: SeenIds | null;
  /** The tour's device-wide off switch (`TOUR_OFF_KEY`), `null` until read. */
  suppressed: boolean | null;
  /** This account's tour flag, `null` until read. */
  tourDone: boolean | null;
  /** A tour on screen, or a replay waiting for the home screen. */
  tourBusy: boolean;
  now: number;
  entries?: readonly WhatsNewEntry[];
};

/**
 * Why the dialog must not open now, or `null` when it may. It waits for the same
 * gates as the tour, and never competes with it: a young account that has not had
 * its tour gets the tour, not a list of changes to an app it has not seen.
 */
export function whatsNewBlocker(input: WhatsNewInput): WhatsNewBlocker | null {
  const { user, now } = input;
  if (input.isLoading) return 'loading';
  if (!user) return 'no-user';
  const role = tourRoleOf(user.role);
  if (!role) return 'no-role';
  if (input.seen === null || input.suppressed === null || input.tourDone === null) return 'unread';
  if (input.suppressed) return 'suppressed';
  if (input.tourBusy) return 'tour';
  if (!isTourHome(role, input.pathname)) return 'route';
  if (
    needsGuardianApproval(user) ||
    needsRosterClaim(user) ||
    needsTeacherSetup(user) ||
    needsGradeSetup(user, input.gradeSetupSkipped ?? false)
  ) {
    return 'gate';
  }

  const created = user.createdAt ? Date.parse(user.createdAt) : NaN;
  if (Number.isNaN(created)) return 'no-created-at';
  const tourAge = created >= Date.parse(TOUR_SINCE) && now - created <= TOUR_MAX_AGE_DAYS * DAY_MS;
  if (tourAge && !input.tourDone) return 'tour';

  return unseenFor({ role, createdAt: created, seen: input.seen, now, entries: input.entries }).length === 0
    ? 'nothing-new'
    : null;
}
