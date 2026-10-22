// Pins which tabs each user sees on each device, and where the lesson bar shows
// (docs/superpowers/specs/2026-10-22-phone-today-design.md).
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { isHomePath, showLessonBar, tabVisible, type NavContext, type TabName } from '../tabVisibility.ts';

const ALL: TabName[] = ['index', 'iqra', 'school', 'curriculum', 'ai-tools', 'notifications', 'profile'];
const shown = (ctx: NavContext) => ALL.filter(n => tabVisible(n, ctx));

test('a teacher on a phone: Today, Library, Tools, Messages, Profile — the chat leaves the bar', () => {
  assert.deepEqual(shown({ isTeacher: true, isDesktop: false }), ['index', 'curriculum', 'ai-tools', 'notifications', 'profile']);
});

test('a teacher on desktop keeps the chat in the sidebar beside Today', () => {
  assert.deepEqual(shown({ isTeacher: true, isDesktop: true }), ['index', 'iqra', 'curriculum', 'ai-tools', 'notifications', 'profile']);
});

test('a parent or student sees School, Library, Messages, Profile on any device', () => {
  for (const isDesktop of [false, true]) {
    assert.deepEqual(shown({ isTeacher: false, isDesktop }), ['school', 'curriculum', 'notifications', 'profile']);
  }
});

test('the landing page is home under either spelling the router reports', () => {
  assert.equal(isHomePath('/'), true);
  assert.equal(isHomePath('/index'), true);
  assert.equal(isHomePath('/iqra'), false);
  assert.equal(isHomePath('/indexes'), false);
});

test('the lesson bar is a teacher thing, and not on Today or the chat, which carry the lesson themselves', () => {
  for (const isDesktop of [false, true]) {
    const teacher = { isTeacher: true, isDesktop };
    assert.equal(showLessonBar('/', teacher), false);
    assert.equal(showLessonBar('/index', teacher), false);
    assert.equal(showLessonBar('/iqra', teacher), false);
    assert.equal(showLessonBar('/curriculum', teacher), true);
    assert.equal(showLessonBar('/ai-tools', teacher), true);
    assert.equal(showLessonBar('/curriculum', { isTeacher: false, isDesktop }), false);
  }
});

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

test('a teacher on a phone is shown Today, not forwarded to the chat', () => {
  const index = read('app', '(tabs)', 'index.tsx');
  assert.doesNotMatch(index, /<Redirect\s+href="\/iqra"/, 'index.tsx still forwards a phone teacher to /iqra');
  assert.match(index, /<PhoneToday\b/, 'index.tsx does not render PhoneToday');
});

test('the tab layout takes visibility and the lesson bar from tabVisibility', () => {
  const layout = read('app', '(tabs)', '_layout.tsx');
  assert.match(layout, /from '@\/services\/tabVisibility'/, '_layout.tsx does not import tabVisibility');
  assert.match(layout, /\btabVisible\(/, 'buildTabEntries does not use tabVisible');
  assert.match(layout, /\bshowLessonBar\(/, 'the lesson bar does not use showLessonBar');
});
