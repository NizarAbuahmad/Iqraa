// The sidebar's «الدرس الحالي» card, ⌘K, the chat's lesson strip, Today and the
// Tools tab's prefill must name one lesson. They did not (found 2026-10-26):
// Today and the chat each ran `timetableWins` over the saved pick and the next
// period, and the tab layout — which feeds the sidebar, the lesson bar and the
// palette — ran neither, so a teacher with a timetable and a pick from an
// earlier day was told two different lessons at once. The rule now lives in
// `resolveCurrentLesson` (services/lessonContext.ts). This pins that every
// surface goes through it and none re-implements it; the rule itself is tested
// in activeLesson.test.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

const SURFACES: Record<string, string[]> = {
  'tab layout (sidebar, lesson bar, ⌘K)': ['app', '(tabs)', '_layout.tsx'],
  'Today (phone and desktop)': ['hooks', 'useTodayLesson.ts'],
  'chat (lesson strip)': ['app', '(tabs)', 'iqra.tsx'],
  'Tools tab (what a tool opens on)': ['app', '(tabs)', 'ai-tools.tsx'],
};

for (const [name, path] of Object.entries(SURFACES)) {
  test(`${name} names the lesson through resolveCurrentLesson`, () => {
    const src = read(...path);
    assert.match(src, /\bresolveCurrentLesson\(/);
    // `lessonCopilot` and `teachingAssistant` each export a `resolveActiveLesson`
    // that answers another question; the call must be the one from lessonContext.
    assert.match(
      src,
      /import\s*\{[^}]*\bresolveCurrentLesson\b[^}]*\}\s*from\s*'@\/services\/lessonContext'/,
      'resolveCurrentLesson must be imported from @/services/lessonContext',
    );
  });

  test(`${name} does not carry its own copy of the timetable-versus-pick rule`, () => {
    // `timetableWins(` is the rule's building block: calling it here means the
    // surface decides for itself again, which is how the sidebar drifted.
    assert.doesNotMatch(read(...path), /\btimetableWins\(/);
  });
}

test('the tab layout reads the timetable, or the sidebar cannot know the period\'s lesson', () => {
  const layout = read('app', '(tabs)', '_layout.tsx');
  assert.match(layout, /\buseNextPeriod\(|\bloadNextPeriod\(|\bloadTimetable\(/);
});

test('the Tools tab does not prefill a tool from the raw saved pick', () => {
  // A generator opened from the hub must open on the lesson the bar above it names.
  const tools = read('app', '(tabs)', 'ai-tools.tsx');
  assert.doesNotMatch(tools, /pickPrefillParams\(\s*pick\b/);
});
