// Pins the first-run tour: who gets which steps, who is eligible to be shown it
// and when, and how a tour moves (docs/superpowers/specs/2026-10-26-first-run-tour-design.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUR_MAX_AGE_DAYS,
  TOUR_OFF_KEY,
  TOUR_SINCE,
  dropCurrent,
  homeHrefFor,
  homeRouteFor,
  isTourHome,
  startTour,
  stepBack,
  stepForward,
  stepsFor,
  tourBlocker,
  tourDoneKey,
  tourRoleOf,
  type TourEligibilityInput,
} from '../tour.ts';
import translations from '../i18n.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse(TOUR_SINCE) + 3 * DAY;
const fresh = new Date(NOW - 1 * DAY).toISOString();

const teacher = { id: 't1', role: 'teacher', createdAt: fresh, gradeIds: ['g10'], subjectIds: ['math'] };
const student = { id: 's1', role: 'student', createdAt: fresh, gradeIds: ['g10'], hasRosterLink: true };
const parent = { id: 'p1', role: 'parent', createdAt: fresh, gradeIds: ['g10'], hasRosterLink: true };

const ok = (over: Partial<TourEligibilityInput> = {}): TourEligibilityInput => ({
  user: teacher,
  pathname: '/',
  layout: 'phone',
  isLoading: false,
  gradeSetupSkipped: false,
  done: false,
  suppressed: false,
  now: NOW,
  ...over,
});

// ─── roles and routes ───────────────────────────────────────────────────────

test('only a teacher, student or parent has a tour — an admin has none', () => {
  assert.equal(tourRoleOf('teacher'), 'teacher');
  assert.equal(tourRoleOf('student'), 'student');
  assert.equal(tourRoleOf('parent'), 'parent');
  assert.equal(tourRoleOf('school_admin'), null);
  assert.equal(tourRoleOf('system_admin'), null);
  assert.equal(tourRoleOf(undefined), null);
  assert.equal(tourRoleOf('nonsense'), null);
});

test('each role starts where the app lands it', () => {
  assert.equal(homeRouteFor('teacher'), '/');
  assert.equal(homeRouteFor('student'), '/curriculum');
  assert.equal(homeRouteFor('parent'), '/notifications');
});

test('the home route is recognised under both of Today’s spellings, and only for its own role', () => {
  assert.equal(isTourHome('teacher', '/'), true);
  assert.equal(isTourHome('teacher', '/index'), true);
  assert.equal(isTourHome('teacher', '/classes'), false);
  assert.equal(isTourHome('student', '/curriculum'), true);
  assert.equal(isTourHome('student', '/'), false);
  assert.equal(isTourHome('parent', '/notifications'), true);
  assert.equal(isTourHome('parent', '/curriculum'), false);
});

test('replay goes to the home tab by the href the app’s own redirects use', () => {
  assert.equal(homeHrefFor('teacher'), '/(tabs)');
  assert.equal(homeHrefFor('student'), '/(tabs)/curriculum');
  assert.equal(homeHrefFor('parent'), '/(tabs)/notifications');
});

// ─── steps ──────────────────────────────────────────────────────────────────

const ids =(role: Parameters<typeof stepsFor>[0], layout: Parameters<typeof stepsFor>[1]) =>
  stepsFor(role, layout).map(s => s.targetId);

test('teacher phone: welcome, the lesson, the prep board, the ask card, then two tabs', () => {
  assert.deepEqual(ids('teacher', 'phone'), [null, 'today-lesson', 'today-prep', 'today-ask', 'tab-ai-tools', 'tab-profile']);
});

test('teacher desktop: the same story pointed at the sidebar, not the tab bar', () => {
  assert.deepEqual(ids('teacher', 'desktop'), [null, 'today-lesson', 'today-prep', 'nav-iqra', 'nav-ai-tools', 'nav-profile']);
});

test('student and parent point at their tabs (phone) or sidebar rows (desktop)', () => {
  assert.deepEqual(ids('student', 'phone'), [null, 'tab-curriculum', 'tab-school', 'tab-notifications', 'tab-profile']);
  assert.deepEqual(ids('student', 'desktop'), [null, 'nav-curriculum', 'nav-school', 'nav-notifications', 'nav-profile']);
  assert.deepEqual(ids('parent', 'phone'), [null, 'tab-school', 'tab-notifications', 'tab-profile']);
  assert.deepEqual(ids('parent', 'desktop'), [null, 'nav-school', 'nav-notifications', 'nav-profile']);
});

test('every tour opens with a welcome that points at nothing, and has at most six steps', () => {
  for (const role of ['teacher', 'student', 'parent'] as const) {
    for (const layout of ['phone', 'desktop'] as const) {
      const steps = stepsFor(role, layout);
      assert.equal(steps[0].targetId, null, `${role}/${layout} welcome`);
      assert.ok(steps.length <= 6, `${role}/${layout} has ${steps.length} steps`);
      assert.equal(new Set(steps.map(s => s.id)).size, steps.length, `${role}/${layout} step ids are unique`);
    }
  }
});

test('every step names copy that exists in both languages', () => {
  for (const role of ['teacher', 'student', 'parent'] as const) {
    for (const layout of ['phone', 'desktop'] as const) {
      for (const s of stepsFor(role, layout)) {
        for (const key of [s.titleKey, s.bodyKey]) {
          for (const lang of ['ar', 'en'] as const) {
            const table = translations[lang] as Record<string, unknown>;
            assert.ok(typeof table[key] === 'string' && (table[key] as string).length > 0, `${lang}.${key} (${role}/${layout}/${s.id})`);
          }
        }
      }
    }
  }
});

// ─── eligibility ────────────────────────────────────────────────────────────

test('a new account on its home screen, nothing pending, is eligible', () => {
  assert.equal(tourBlocker(ok()), null);
  assert.equal(tourBlocker(ok({ user: student, pathname: '/curriculum' })), null);
  assert.equal(tourBlocker(ok({ user: parent, pathname: '/notifications' })), null);
});

test('the landing route is accepted under either spelling expo-router reports', () => {
  assert.equal(tourBlocker(ok({ pathname: '/index' })), null);
});

test('not while loading, signed out, or with no tour for the role', () => {
  assert.equal(tourBlocker(ok({ isLoading: true })), 'loading');
  assert.equal(tourBlocker(ok({ user: null })), 'no-user');
  assert.equal(tourBlocker(ok({ user: { ...teacher, role: 'school_admin' } })), 'no-steps');
});

test('not until the done flag and the suppress switch have been read, and not once either says no', () => {
  assert.equal(tourBlocker(ok({ done: null })), 'unread');
  assert.equal(tourBlocker(ok({ suppressed: null })), 'unread');
  assert.equal(tourBlocker(ok({ done: true })), 'done');
  assert.equal(tourBlocker(ok({ suppressed: true })), 'suppressed');
});

test('only on the role’s own home route, so a redirect in flight never starts it', () => {
  assert.equal(tourBlocker(ok({ pathname: '/setup-subjects' })), 'route');
  assert.equal(tourBlocker(ok({ pathname: '/classes' })), 'route');
  assert.equal(tourBlocker(ok({ user: student, pathname: '/' })), 'route');
  assert.equal(tourBlocker(ok({ user: parent, pathname: '/curriculum' })), 'route');
});

test('not while a setup or approval gate is still ahead of the account', () => {
  assert.equal(tourBlocker(ok({ user: { ...teacher, gradeIds: [], subjectIds: [] } })), 'gate');
  assert.equal(tourBlocker(ok({ user: { ...parent, hasRosterLink: false }, pathname: '/notifications' })), 'gate');
  assert.equal(tourBlocker(ok({ user: { ...student, gradeIds: [] }, pathname: '/curriculum' })), 'gate');
  assert.equal(tourBlocker(ok({ user: { ...student, guardianStatus: 'waiting' }, pathname: '/curriculum' })), 'gate');
});

test('a student who skipped the class picker is not held at the gate — but one whose skip is unread is', () => {
  const noGrades = { ...student, gradeIds: [] };
  assert.equal(tourBlocker(ok({ user: noGrades, pathname: '/curriculum', gradeSetupSkipped: true })), null);
  assert.equal(tourBlocker(ok({ user: noGrades, pathname: '/curriculum', gradeSetupSkipped: null })), 'gate');
});

test('only an account made since launch and within the last two weeks', () => {
  assert.equal(TOUR_MAX_AGE_DAYS, 14);
  // Well after launch, so "too old" and "before launch" are not the same account.
  const later = Date.parse(TOUR_SINCE) + 40 * DAY;
  const old = new Date(later - 15 * DAY).toISOString();
  assert.equal(tourBlocker(ok({ user: { ...teacher, createdAt: old }, now: later })), 'too-old');
  const justInside = new Date(later - 14 * DAY + 1000).toISOString();
  assert.equal(tourBlocker(ok({ user: { ...teacher, createdAt: justInside }, now: later })), null);
  // Signed up a week before it shipped: young, but not for this tour.
  const beforeLaunch = new Date(Date.parse(TOUR_SINCE) - 1000).toISOString();
  assert.equal(tourBlocker(ok({ user: { ...teacher, createdAt: beforeLaunch }, now: NOW })), 'before-launch');
});

test('an account with no usable creation date is never shown it by surprise', () => {
  assert.equal(tourBlocker(ok({ user: { ...teacher, createdAt: undefined } })), 'no-created-at');
  assert.equal(tourBlocker(ok({ user: { ...teacher, createdAt: 'not a date' } })), 'no-created-at');
});

// ─── storage keys ───────────────────────────────────────────────────────────

test('the done flag is per account, and the suppress switch is per device', () => {
  assert.equal(tourDoneKey('u-1'), '@iqra_tour_done_v1:u-1');
  assert.notEqual(tourDoneKey('u-1'), tourDoneKey('u-2'));
  assert.equal(TOUR_OFF_KEY, '@iqra_tour_off_v1');
});

// ─── moving through a tour ──────────────────────────────────────────────────

const three = stepsFor('parent', 'phone').slice(0, 3);

test('a tour starts on its first step', () => {
  assert.deepEqual(startTour(three), { steps: three, index: 0 });
  assert.equal(startTour([]), null);
});

test('forward moves one step and ends the tour (null) after the last', () => {
  const s0 = startTour(three)!;
  const s1 = stepForward(s0)!;
  assert.equal(s1.index, 1);
  assert.equal(stepForward(stepForward(s1)!), null);
});

test('back moves one step and stops at the first', () => {
  const s1 = stepForward(startTour(three)!)!;
  assert.equal(stepBack(s1).index, 0);
  assert.equal(stepBack(stepBack(s1)).index, 0);
});

test('dropping a step whose target never showed up moves on in the direction of travel', () => {
  const s1 = stepForward(startTour(three)!)!;
  const forward = dropCurrent(s1, 1)!;
  assert.equal(forward.steps.length, 2);
  assert.equal(forward.steps[forward.index].id, three[2].id);
  const backward = dropCurrent(s1, -1)!;
  assert.equal(backward.steps.length, 2);
  assert.equal(backward.steps[backward.index].id, three[0].id);
});

test('dropping the last step going forward, or the only one left, ends the tour', () => {
  const last = stepForward(stepForward(startTour(three)!)!)!;
  assert.equal(dropCurrent(last, 1), null);
  assert.equal(dropCurrent({ steps: [three[0]], index: 0 }, 1), null);
});

test('dropping the first step going backward stays on the new first step', () => {
  const s0 = startTour(three)!;
  const back = dropCurrent(s0, -1)!;
  assert.equal(back.index, 0);
  assert.equal(back.steps[0].id, three[1].id);
});
