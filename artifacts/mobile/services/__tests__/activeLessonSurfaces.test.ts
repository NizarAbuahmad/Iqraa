// The sidebar's «الدرس الحالي» card, ⌘K, the chat's lesson strip and Today must
// name one lesson. They did not (found 2026-10-26): Today and the chat each
// ran `timetableWins` over the saved pick and the next period, and the tab
// layout — which feeds the sidebar, the lesson bar and the palette — ran
// neither, so a teacher with a timetable and a pick from an earlier day was told
// two different lessons at once. The rule now lives in `resolveActiveLesson`
// (services/lessonContext.ts). This pins that every surface goes through it and
// none re-implements it; the rule itself is tested in activeLesson.test.ts.
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
};

for (const [name, path] of Object.entries(SURFACES)) {
  test(`${name} names the lesson through resolveActiveLesson`, () => {
    assert.match(read(...path), /\bresolveActiveLesson\(/);
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
