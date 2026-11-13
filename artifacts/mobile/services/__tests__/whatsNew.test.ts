// Pins «ما الجديد»: who is shown which entries and when, and that every entry in
// the list is well-formed (docs/superpowers/specs/2026-10-30-whats-new-design.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  NEW_TOOL_DAYS,
  WHATS_NEW,
  WHATS_NEW_MAX_AGE_DAYS,
  WHATS_NEW_MAX_SHOWN,
  entriesFor,
  entryTime,
  newToolIds,
  newToolOpenedKey,
  toolBadgeKey,
  toolIdsForPath,
  unseenFor,
  whatsNewBlocker,
  whatsNewSeenKey,
  type WhatsNewEntry,
  type WhatsNewInput,
} from '../whatsNew.ts';
import { TOUR_MAX_AGE_DAYS, TOUR_SINCE, tourDoneKey } from '../tour.ts';
import {
  getSessionSeen,
  getSessionToolsOpened,
  noteSeen,
  noteToolsOpened,
  resetSessionSeen,
  withSessionSeen,
} from '../whatsNewSession.ts';
import { ALL_TOOLS } from '../toolCatalog.ts';
import { isNonTeacherRoute, isPublicRoute } from '../routeGating.ts';
import translations from '../i18n.ts';

const DAY = 24 * 60 * 60 * 1000;

const entry = (id: string, date: string, roles: WhatsNewEntry['roles'] = ['teacher', 'student', 'parent']): WhatsNewEntry => ({
  id,
  date,
  roles,
  titleKey: 'whatsNewTitle',
  bodyKey: 'whatsNewSubtitle',
});

const LIST = [
  entry('c', '2026-11-20'),
  entry('b', '2026-11-10', ['teacher']),
  entry('a', '2026-11-01'),
];
const NOW = entryTime('2026-11-21') + 10 * 60 * 1000;
const OLD_ACCOUNT = entryTime('2026-09-01');

// ─── unseenFor ──────────────────────────────────────────────────────────────

test('an account sees its role’s unseen entries, newest first', () => {
  const ids = (role: 'teacher' | 'student') =>
    unseenFor({ role, createdAt: OLD_ACCOUNT, seen: [], now: NOW, entries: LIST }).map(e => e.id);
  assert.deepEqual(ids('teacher'), ['c', 'b', 'a']);
  assert.deepEqual(ids('student'), ['c', 'a']);
});

test('an entry already seen is not shown again', () => {
  const got = unseenFor({ role: 'teacher', createdAt: OLD_ACCOUNT, seen: ['c', 'a'], now: NOW, entries: LIST });
  assert.deepEqual(got.map(e => e.id), ['b']);
});

test('storage that could not be read counts as all seen — it never nags', () => {
  assert.deepEqual(unseenFor({ role: 'teacher', createdAt: OLD_ACCOUNT, seen: 'all', now: NOW, entries: LIST }), []);
});

test('an account made after an entry’s day met the feature already, and is not told about it', () => {
  const created = entryTime('2026-11-05');
  const got = unseenFor({ role: 'teacher', createdAt: created, seen: [], now: NOW, entries: LIST });
  assert.deepEqual(got.map(e => e.id), ['c', 'b']);
});

test('a future-dated entry stays hidden until its Amman day begins', () => {
  const list = [entry('soon', '2026-11-22')];
  const before = entryTime('2026-11-22') - 1;
  assert.deepEqual(unseenFor({ role: 'teacher', createdAt: OLD_ACCOUNT, seen: [], now: before, entries: list }), []);
  assert.equal(unseenFor({ role: 'teacher', createdAt: OLD_ACCOUNT, seen: [], now: before + 1, entries: list }).length, 1);
  // Midnight in Amman is 21:00 UTC the day before.
  assert.equal(new Date(entryTime('2026-11-22')).toISOString(), '2026-11-21T21:00:00.000Z');
});

test('an entry older than the age limit is not shown on its own, but stays in the full list', () => {
  const list = [entry('old', '2026-09-01')];
  const now = entryTime('2026-09-01') + (WHATS_NEW_MAX_AGE_DAYS + 1) * DAY;
  const created = entryTime('2026-08-01');
  assert.deepEqual(unseenFor({ role: 'parent', createdAt: created, seen: [], now, entries: list }), []);
  assert.deepEqual(entriesFor('parent', now, list).map(e => e.id), ['old']);
});

test('the dialog shows at most a few, the newest', () => {
  const list = Array.from({ length: WHATS_NEW_MAX_SHOWN + 2 }, (_, i) => entry(`e${i}`, `2026-11-${String(10 + i).padStart(2, '0')}`));
  const got = unseenFor({ role: 'teacher', createdAt: OLD_ACCOUNT, seen: [], now: NOW, entries: list });
  assert.equal(got.length, WHATS_NEW_MAX_SHOWN);
  assert.equal(got[0].id, `e${WHATS_NEW_MAX_SHOWN + 1}`);
});

test('the seen key is per account and not the tour’s', () => {
  assert.equal(whatsNewSeenKey('u1'), '@iqra_whats_new_seen_v1:u1');
  assert.notEqual(whatsNewSeenKey('u1'), whatsNewSeenKey('u2'));
  assert.notEqual(whatsNewSeenKey('u1'), tourDoneKey('u1'));
});

// ─── whatsNewBlocker ────────────────────────────────────────────────────────

const teacher = {
  id: 't1',
  role: 'teacher',
  createdAt: new Date(OLD_ACCOUNT).toISOString(),
  gradeIds: ['g10'],
  subjectIds: ['math'],
};

const ok = (over: Partial<WhatsNewInput> = {}): WhatsNewInput => ({
  user: teacher,
  pathname: '/',
  isLoading: false,
  gradeSetupSkipped: false,
  seen: [],
  suppressed: false,
  tourDone: true,
  tourBusy: false,
  now: NOW,
  entries: LIST,
  ...over,
});

test('a settled teacher on Today with something new may be shown it', () => {
  assert.equal(whatsNewBlocker(ok()), null);
});

test('it waits for every read, and an admin has no list', () => {
  assert.equal(whatsNewBlocker(ok({ isLoading: true })), 'loading');
  assert.equal(whatsNewBlocker(ok({ user: null })), 'no-user');
  assert.equal(whatsNewBlocker(ok({ user: { ...teacher, role: 'system_admin' } })), 'no-role');
  assert.equal(whatsNewBlocker(ok({ seen: null })), 'unread');
  assert.equal(whatsNewBlocker(ok({ suppressed: null })), 'unread');
  assert.equal(whatsNewBlocker(ok({ tourDone: null })), 'unread');
});

test('the tour’s device-wide off switch also turns this off (the e2e sets it)', () => {
  assert.equal(whatsNewBlocker(ok({ suppressed: true })), 'suppressed');
});

test('only on the role’s home screen, and not before the setup gates', () => {
  assert.equal(whatsNewBlocker(ok({ pathname: '/ai-tools' })), 'route');
  assert.equal(whatsNewBlocker(ok({ user: { ...teacher, gradeIds: [], subjectIds: [] } })), 'gate');
  const student = { id: 's1', role: 'student', createdAt: teacher.createdAt, gradeIds: ['g10'], hasRosterLink: true };
  assert.equal(whatsNewBlocker(ok({ user: student, pathname: '/curriculum' })), null);
  assert.equal(whatsNewBlocker(ok({ user: student, pathname: '/' })), 'route');
});

test('never on top of the tour', () => {
  assert.equal(whatsNewBlocker(ok({ tourBusy: true })), 'tour');

  // A young account that has not had its tour yet gets the tour first…
  const now = Date.parse(TOUR_SINCE) + 30 * DAY;
  const list = [entry('fresh', new Date(now - 2 * DAY + 3 * 60 * 60 * 1000).toISOString().slice(0, 10))];
  const young = { ...teacher, createdAt: new Date(now - 5 * DAY).toISOString() };
  assert.equal(whatsNewBlocker(ok({ user: young, now, entries: list, tourDone: false })), 'tour');
  // …and the list once it has.
  assert.equal(whatsNewBlocker(ok({ user: young, now, entries: list, tourDone: true })), null);
  // An account past the tour's window is never held for a tour it will not get.
  const older = { ...teacher, createdAt: new Date(now - (TOUR_MAX_AGE_DAYS + 1) * DAY).toISOString() };
  assert.equal(whatsNewBlocker(ok({ user: older, now, entries: list, tourDone: false })), null);
});

test('without a creation date there is no telling what is new to the account', () => {
  assert.equal(whatsNewBlocker(ok({ user: { ...teacher, createdAt: undefined } })), 'no-created-at');
});

test('nothing unseen, nothing shown', () => {
  assert.equal(whatsNewBlocker(ok({ seen: ['a', 'b', 'c'] })), 'nothing-new');
  assert.equal(whatsNewBlocker(ok({ seen: 'all' })), 'nothing-new');
});

// ─── the real list ──────────────────────────────────────────────────────────

test('every entry has a unique id, a real day, and at least one role', () => {
  const ids = new Set<string>();
  for (const e of WHATS_NEW) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    assert.ok(/^[a-z0-9-]+$/.test(e.id), `id ${e.id} is not kebab-case`);
    assert.ok(!Number.isNaN(entryTime(e.date)), `${e.id}: date ${e.date} is not YYYY-MM-DD`);
    assert.equal(new Date(entryTime(e.date) + 3 * 60 * 60 * 1000).toISOString().slice(0, 10), e.date, `${e.id}: ${e.date} is not a calendar day`);
    assert.ok(e.roles.length > 0, `${e.id} names no role`);
  }
});

test('the list is written newest first', () => {
  for (let i = 1; i < WHATS_NEW.length; i++) {
    assert.ok(entryTime(WHATS_NEW[i - 1].date) >= entryTime(WHATS_NEW[i].date), `${WHATS_NEW[i].id} is above an older entry`);
  }
});

test('every entry has its words in both languages', () => {
  for (const lang of ['ar', 'en'] as const) {
    const table = translations[lang] as Record<string, unknown>;
    for (const e of WHATS_NEW) {
      for (const key of [e.titleKey, e.bodyKey]) {
        assert.equal(typeof table[key], 'string', `${lang}.${key} (${e.id})`);
        assert.ok((table[key] as string).trim().length > 0, `${lang}.${key} is empty`);
      }
    }
  }
});

test('an entry’s route is a real screen that each of its roles may open', () => {
  const appDir = join(import.meta.dirname, '..', '..', 'app');
  for (const e of WHATS_NEW) {
    if (!e.route) continue;
    const path = e.route.split('?')[0];
    const rel = path.replace(/^\//, '');
    const candidates = [
      `${rel}.tsx`,
      join(rel, 'index.tsx'),
      join('(tabs)', `${rel}.tsx`),
      join('(tabs)', rel, 'index.tsx'),
    ];
    assert.ok(candidates.some(c => existsSync(join(appDir, c))), `${e.id}: no screen at ${path}`);
    if (e.roles.some(r => r !== 'teacher')) {
      assert.ok(isPublicRoute(path) || isNonTeacherRoute(path), `${e.id}: a student or parent is bounced from ${path}`);
    }
  }
});

test('the «ما الجديد» screen itself is reachable for a student or parent', () => {
  assert.equal(isNonTeacherRoute('/whats-new'), true);
});

// ─── seen this session (whatsNewSession.ts) ─────────────────────────────────

test('a note read on the Profile screen is not offered again by the dialog in the same session', () => {
  resetSessionSeen();
  const stored: string[] = [];
  noteSeen('t1', ['c', 'b', 'a']);
  const seen = withSessionSeen(stored, getSessionSeen(), 't1');
  assert.equal(whatsNewBlocker(ok({ seen })), 'nothing-new');
});

test('the session store belongs to one account: another one signed in starts empty', () => {
  resetSessionSeen();
  noteSeen('t1', ['c']);
  assert.deepEqual(withSessionSeen(['x'], getSessionSeen(), 't2'), ['x']);
  noteSeen('t2', ['b']);
  assert.deepEqual(getSessionSeen(), { userId: 't2', ids: ['b'] });
});

test('the session store passes unread and unreadable storage through, and keeps its snapshot stable', () => {
  resetSessionSeen();
  noteSeen('t1', ['a']);
  assert.equal(withSessionSeen(null, getSessionSeen(), 't1'), null);
  assert.equal(withSessionSeen('all', getSessionSeen(), 't1'), 'all');
  const before = getSessionSeen();
  noteSeen('t1', ['a']);
  assert.equal(getSessionSeen(), before, 'nothing new seen, same snapshot');
  const stored = ['a'];
  assert.equal(withSessionSeen(stored, getSessionSeen(), 't1'), stored, 'nothing to add, same array');
});

// ─── «جديد» on a new tool's card ────────────────────────────────────────────

const toolEntry = (id: string, date: string, toolId: string, roles: WhatsNewEntry['roles'] = ['teacher']): WhatsNewEntry => ({
  ...entry(id, date, roles),
  toolId,
});
const TOOL_LIST = [
  toolEntry('t-quiz', '2026-11-15', 'quiz'),
  toolEntry('t-slides', '2026-11-01', 'slides'),
  entry('no-tool', '2026-11-18'),
];

test('a tool announced after the account was made wears «جديد» until it is opened', () => {
  const ids = newToolIds({ role: 'teacher', createdAt: OLD_ACCOUNT, opened: [], now: NOW, entries: TOOL_LIST });
  assert.deepEqual([...ids].sort(), ['quiz', 'slides']);
  const afterOpen = newToolIds({ role: 'teacher', createdAt: OLD_ACCOUNT, opened: ['quiz'], now: NOW, entries: TOOL_LIST });
  assert.deepEqual([...afterOpen], ['slides']);
});

test('the badge goes after its days, even unopened', () => {
  const list = [toolEntry('t', '2026-11-01', 'quiz')];
  const at = entryTime('2026-11-01');
  const still = newToolIds({ role: 'teacher', createdAt: OLD_ACCOUNT, opened: [], now: at + NEW_TOOL_DAYS * DAY, entries: list });
  assert.equal(still.has('quiz'), true);
  const gone = newToolIds({ role: 'teacher', createdAt: OLD_ACCOUNT, opened: [], now: at + NEW_TOOL_DAYS * DAY + 1, entries: list });
  assert.equal(gone.size, 0);
});

test('to a newer account, a student or parent, or unreadable storage, no tool is new', () => {
  const created = entryTime('2026-11-02');
  assert.deepEqual([...newToolIds({ role: 'teacher', createdAt: created, opened: [], now: NOW, entries: TOOL_LIST })], ['quiz']);
  assert.equal(newToolIds({ role: 'student', createdAt: OLD_ACCOUNT, opened: [], now: NOW, entries: TOOL_LIST }).size, 0);
  assert.equal(newToolIds({ role: 'teacher', createdAt: OLD_ACCOUNT, opened: 'all', now: NOW, entries: TOOL_LIST }).size, 0);
  assert.equal(newToolIds({ role: 'teacher', createdAt: NaN, opened: [], now: NOW, entries: TOOL_LIST }).size, 0);
  // Not before its day.
  const early = entryTime('2026-11-15') - 1;
  assert.equal(newToolIds({ role: 'teacher', createdAt: OLD_ACCOUNT, opened: [], now: early, entries: TOOL_LIST }).has('quiz'), false);
});

test('a tool is opened by its screen or anything under it, never by a look-alike path', () => {
  const tools = [
    { id: 'classroom', route: '/ai-tools/classroom' },
    { id: 'worksheet', route: '/ai-tools/worksheet' },
    { id: 'homework', route: '/ai-tools/worksheet' },
    { id: 'geogebra' },
  ];
  assert.deepEqual(toolIdsForPath('/ai-tools/classroom/builder', tools), ['classroom']);
  assert.deepEqual(toolIdsForPath('/ai-tools/classroom', tools), ['classroom']);
  assert.deepEqual(toolIdsForPath('/ai-tools/classroomx', tools), []);
  assert.deepEqual(toolIdsForPath('/ai-tools/worksheet', tools), ['worksheet', 'homework']);
  assert.deepEqual(toolIdsForPath('/', tools), []);
});

test('a fixed label wins over «جديد», which shows only while the tool is new', () => {
  const fresh = new Set(['quiz', 'geogebra']);
  assert.equal(toolBadgeKey({ id: 'quiz' }, fresh), 'whatsNewBadge');
  assert.equal(toolBadgeKey({ id: 'geogebra', badgeKey: 'toolGeogebraBadge' }, fresh), 'toolGeogebraBadge');
  assert.equal(toolBadgeKey({ id: 'slides' }, fresh), undefined);
  for (const lang of ['ar', 'en'] as const) {
    assert.equal(typeof (translations[lang] as Record<string, unknown>).whatsNewBadge, 'string');
  }
  assert.equal(translations.ar.whatsNewBadge, 'جديد');
});

test('a tool opened this session loses its badge at once, per account', () => {
  resetSessionSeen();
  noteToolsOpened('t1', ['quiz']);
  const opened = withSessionSeen([], getSessionToolsOpened(), 't1');
  assert.ok(opened !== null);
  assert.equal(newToolIds({ role: 'teacher', createdAt: OLD_ACCOUNT, opened, now: NOW, entries: TOOL_LIST }).has('quiz'), false);
  // The seen-notes list is a separate thing.
  assert.deepEqual(getSessionSeen().ids, []);
  assert.deepEqual(withSessionSeen([], getSessionToolsOpened(), 't2'), []);
});

test('the opened-tools key is per account and not the seen key', () => {
  assert.equal(newToolOpenedKey('u1'), '@iqra_new_tool_opened_v1:u1');
  assert.notEqual(newToolOpenedKey('u1'), whatsNewSeenKey('u1'));
});

test('every real entry’s toolId is a tool in the catalog, announced to teachers', () => {
  const ids = new Set(ALL_TOOLS.map(t => t.id));
  for (const e of WHATS_NEW) {
    if (!e.toolId) continue;
    assert.ok(ids.has(e.toolId), `${e.id}: no tool ${e.toolId} in toolCatalog.ts`);
    assert.ok(e.roles.includes('teacher'), `${e.id} announces a tool but not to teachers`);
  }
});
