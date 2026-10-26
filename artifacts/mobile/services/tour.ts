/**
 * The first-run tour: which steps each role gets, who may be shown it and when,
 * and how a tour moves. Pure, so `node --test` can pin it
 * (services/__tests__/tour.test.ts); the overlay that draws it is
 * components/tour/TourHost.tsx, and the AsyncStorage I/O is tourStorage.ts.
 *
 * A step points at a *target id*. The screens mark their own elements with it
 * (`useTourTarget` / `TourTarget`), and `tour.test.ts` fails a step whose target
 * nothing registers. A step whose target is not on screen when the tour reaches
 * it is dropped, not shown with a hole around nothing.
 */
import type { TranslationKey } from './i18n.ts';
import { isHomePath } from './tabVisibility.ts';
import {
  needsGradeSetup,
  needsGuardianApproval,
  needsRosterClaim,
  needsTeacherSetup,
} from './routeGating.ts';
import type { GuardianUserLike } from './guardianApproval.ts';

export type TourRole = 'teacher' | 'student' | 'parent';
/** `desktop` is web at DESKTOP_BREAKPOINT or wider: a sidebar instead of the tab bar. */
export type TourLayout = 'phone' | 'desktop';

export type TourStep = {
  id: string;
  /** What to ring. `null` is a welcome card in the middle of the screen. */
  targetId: string | null;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
};

/**
 * Account must have been created on or after this to be shown the tour on its
 * own, so someone who signed up a week before it shipped is not ambushed in
 * the middle of using the app. They can still open it from Profile.
 */
export const TOUR_SINCE = '2026-10-26T00:00:00.000Z';
export const TOUR_MAX_AGE_DAYS = 14;

/** Per account, on this device — see `gradeSetupSkipKey` for why not on the server. */
export function tourDoneKey(userId: string): string {
  return `@iqra_tour_done_v1:${userId}`;
}

/** Per device: set to '1' and no account is shown the tour on its own (the e2e does). */
export const TOUR_OFF_KEY = '@iqra_tour_off_v1';

/** An admin has no tour: their screens are not the ones it describes. */
export function tourRoleOf(role: string | null | undefined): TourRole | null {
  return role === 'teacher' || role === 'student' || role === 'parent' ? role : null;
}

/**
 * Where the app lands this role (app/(tabs)/index.tsx): Today for a teacher, the
 * library for a student, Messages for a parent. expo-router reports Today as '/'.
 */
export function homeRouteFor(role: TourRole): string {
  switch (role) {
    case 'teacher': return '/';
    case 'student': return '/curriculum';
    case 'parent': return '/notifications';
  }
}

/** Whether `pathname` is this role's home screen — also what ends a tour a deep link navigated away from. */
export function isTourHome(role: TourRole, pathname: string): boolean {
  const home = homeRouteFor(role);
  return home === '/' ? isHomePath(pathname) : pathname === home;
}

/**
 * The href to navigate to for a replay: the one `app/(tabs)/index.tsx` itself
 * redirects each role with, which resolves to the tab and not to a same-named
 * route outside it (`/curriculum` is also a folder of screens).
 */
export function homeHrefFor(role: TourRole): string {
  switch (role) {
    case 'teacher': return '/(tabs)';
    case 'student': return '/(tabs)/curriculum';
    case 'parent': return '/(tabs)/notifications';
  }
}

// ─── steps ──────────────────────────────────────────────────────────────────

const step =(id: string, targetId: string | null, titleKey: TranslationKey, bodyKey: TranslationKey): TourStep => ({
  id,
  targetId,
  titleKey,
  bodyKey,
});

/** `tab-x` on a phone, `nav-x` on the desktop sidebar: the same destination, a different element. */
const nav = (layout: TourLayout, name: string) => `${layout === 'phone' ? 'tab' : 'nav'}-${name}`;

export function stepsFor(role: TourRole, layout: TourLayout): TourStep[] {
  switch (role) {
    case 'teacher':
      return [
        step('welcome', null, 'tourWelcomeTitle', 'tourWelcomeTeacherBody'),
        step('lesson', 'today-lesson', 'tourLessonTitle', 'tourLessonBody'),
        step('prep', 'today-prep', 'tourPrepTitle', 'tourPrepBody'),
        // Phone: the ask card sits on Today, below the fold. Desktop: it is the sidebar's chat.
        step('ask', layout === 'phone' ? 'today-ask' : 'nav-iqra', 'tourAskTitle', 'tourAskBody'),
        step('tools', nav(layout, 'ai-tools'), 'tourToolsTitle', 'tourToolsBody'),
        step('profile', nav(layout, 'profile'), 'tourProfileTitle', 'tourProfileBody'),
      ];
    case 'student':
      return [
        step('welcome', null, 'tourWelcomeTitle', 'tourWelcomeStudentBody'),
        step('library', nav(layout, 'curriculum'), 'tourLibraryTitle', 'tourLibraryBody'),
        step('school', nav(layout, 'school'), 'tourSchoolTitle', 'tourSchoolStudentBody'),
        step('messages', nav(layout, 'notifications'), 'tourMessagesTitle', 'tourMessagesBody'),
        step('profile', nav(layout, 'profile'), 'tourProfileTitle', 'tourProfileBody'),
      ];
    case 'parent':
      return [
        step('welcome', null, 'tourWelcomeTitle', 'tourWelcomeParentBody'),
        step('school', nav(layout, 'school'), 'tourSchoolTitle', 'tourSchoolParentBody'),
        step('messages', nav(layout, 'notifications'), 'tourMessagesTitle', 'tourMessagesBody'),
        step('profile', nav(layout, 'profile'), 'tourProfileTitle', 'tourProfileBody'),
      ];
  }
}

// ─── who is shown it, and when ──────────────────────────────────────────────

export type TourBlocker =
  | 'loading'
  | 'no-user'
  | 'no-steps'
  | 'unread'
  | 'done'
  | 'suppressed'
  | 'route'
  | 'gate'
  | 'no-created-at'
  | 'before-launch'
  | 'too-old';

export type TourUserLike = GuardianUserLike & {
  id: string;
  role: string;
  createdAt?: string;
  hasRosterLink?: boolean;
  gradeIds?: string[];
  subjectIds?: string[];
};

export type TourEligibilityInput = {
  user: TourUserLike | null | undefined;
  pathname: string;
  layout: TourLayout;
  isLoading: boolean;
  /** `AuthContext.gradeSetupSkipped`: `null` until the device has been asked. */
  gradeSetupSkipped: boolean | null;
  /** This account's done flag, `null` until read. */
  done: boolean | null;
  /** The device-wide switch, `null` until read. */
  suppressed: boolean | null;
  now: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Why the tour must not start now, or `null` when it may. The gates are the
 * root layout's own (routeGating.ts), not copies of them: a tour that started
 * on the home route a moment before the app redirected to the class picker
 * would be drawn over a screen the user is about to leave.
 */
export function tourBlocker(input: TourEligibilityInput): TourBlocker | null {
  const { user, pathname, layout, now } = input;
  if (input.isLoading) return 'loading';
  if (!user) return 'no-user';
  const role = tourRoleOf(user.role);
  if (!role || stepsFor(role, layout).length === 0) return 'no-steps';
  if (input.done === null || input.suppressed === null) return 'unread';
  if (input.done) return 'done';
  if (input.suppressed) return 'suppressed';

  if (!isTourHome(role, pathname)) return 'route';

  // An unread skip flag counts as "not skipped": the picker may still be ahead.
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
  if (created < Date.parse(TOUR_SINCE)) return 'before-launch';
  if (now - created > TOUR_MAX_AGE_DAYS * DAY_MS) return 'too-old';
  return null;
}

// ─── moving through a tour ──────────────────────────────────────────────────

export type TourState = { steps: TourStep[]; index: number };

export function startTour(steps: TourStep[]): TourState | null {
  return steps.length === 0 ? null : { steps, index: 0 };
}

/** The next step, or `null` once the last one has been passed: the tour is over. */
export function stepForward(state: TourState): TourState | null {
  return state.index + 1 >= state.steps.length ? null : { ...state, index: state.index + 1 };
}

export function stepBack(state: TourState): TourState {
  return state.index === 0 ? state : { ...state, index: state.index - 1 };
}

/**
 * Removes the current step — its target never appeared — and lands on whatever
 * is next in the direction the user was travelling. `null` when nothing is left
 * that way and the tour is over.
 */
export function dropCurrent(state: TourState, direction: 1 | -1): TourState | null {
  const steps = state.steps.filter((_, i) => i !== state.index);
  if (steps.length === 0) return null;
  if (direction === 1) return state.index >= steps.length ? null : { steps, index: state.index };
  return { steps, index: Math.max(0, state.index - 1) };
}
