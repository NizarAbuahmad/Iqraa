// Each of the five moments mounts the shared Celebrate overlay
// (docs/superpowers/specs/2026-10-22-celebrations-design.md; the fifth, a
// homework project handed in on time, since 2026-10-30). The firing rules
// are pinned in celebration.test.ts and homeworkProject.test.ts; these pin
// that each screen uses them. A sixth moment needs a test here, and every
// screen that mounts Celebrate must be one of the listed moments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

test('the overlay never blocks a tap and respects reduced motion', () => {
  const src = read('components', 'ui', 'Celebrate.tsx');
  assert.match(src, /pointerEvents="none"/);
  assert.match(src, /useReduceMotion\(/);
  assert.match(src, /NATIVE_DRIVER/);
  assert.match(src, /importantForAccessibility="no-hide-descendants"/, 'the message is announced, so the overlay is hidden from the tree');
  assert.doesNotMatch(src, /useNativeDriver:\s*(true|false)/, 'pass NATIVE_DRIVER, never a literal');
});

test('an exam is celebrated only for a hand-in the student made, after the server accepted it', () => {
  const src = read('app', 'take', '[code].tsx');
  assert.match(src, /<Celebrate\b/);
  assert.match(src, /celebrateHandedIn/);
  // Every setCelebrating(true) sits after the submit call and behind the not-forced guard.
  const calls = [...src.matchAll(/setCelebrating\(true\)/g)];
  assert.equal(calls.length, 1, 'exactly one place starts the exam celebration');
  assert.match(
    src,
    /await submitStudentExam\(token\);[^]*?if \(!opts\?\.force\) setCelebrating\(true\);/,
    'celebrate after submitStudentExam resolves, and not on the forced path (time up / exam closed)',
  );
  assert.match(src, /void hand\(\{ force: true \}\)/, 'the forced hand-in this guards still exists');
});

test('a finished game is celebrated, louder for a perfect score', () => {
  const src = read('components', 'publicGames', 'GameShell.tsx');
  assert.match(src, /<Celebrate\b/);
  assert.match(src, /justCompleted\(/);
  assert.match(src, /celebrateGamePerfect/);
  assert.match(src, /showBadge=/, 'the shell has its own heading, so only a perfect score shows the badge');
  assert.match(read('components', 'publicGames', 'TriviaGame.tsx'), /perfect:/);
  assert.match(read('components', 'publicGames', 'MathDrillGame.tsx'), /perfect:/);
});

test('ticking off the last homework is celebrated, after the save succeeds and nothing else is in flight', () => {
  const src = read('app', '(tabs)', 'school.tsx');
  assert.match(src, /<Celebrate\b/);
  assert.match(src, /allTrackedDone\(/);
  assert.match(src, /celebrateHomeworkAll/);
  const calls = [...src.matchAll(/setCelebrateHw\(true\)/g)];
  assert.equal(calls.length, 1, 'exactly one place starts the homework celebration');
  // Order: the awaited save, then the other-saves check, then the tick guard and the crossing.
  const save = src.indexOf('await setHomeworkDone(');
  const others = src.search(/hwInFlight\.current\]\.some\(id => id !== item\.id\)/);
  const fire = src.indexOf('setCelebrateHw(true)');
  assert.ok(save > 0 && others > save && fire > others, 'save, then in-flight check, then the celebration');
  assert.match(
    src,
    /if \(next && !othersInFlight && justCompleted\([^]*?\)\) setCelebrateHw\(true\)/,
    'only a tick (not an untick), with no other save in flight, that justCompleted the list',
  );
  // The rollback path must not celebrate.
  assert.doesNotMatch(src.slice(src.indexOf('} catch (e) {', save), src.indexOf('} finally {', save)), /setCelebrateHw/);
});

test('a homework project handed in on time is celebrated, after the server accepted it, on the crossing', () => {
  const src = read('app', 'homework-project', '[id].tsx');
  assert.match(src, /<Celebrate\b/);
  assert.match(src, /projectHandedIn/);
  const calls = [...src.matchAll(/setCelebrate\(true\)/g)];
  assert.equal(calls.length, 1, 'exactly one place starts the project celebration');
  assert.match(
    src,
    /await homeworkSubmissionApi\.handIn\([^]*?if \(celebratesHandIn\(before\.status, next\.status\)\) setCelebrate\(true\)/,
    'celebrate after handIn resolves, and only on the none → submitted crossing (never late, never again)',
  );
  // The failure path must not celebrate.
  const fire = src.indexOf('setCelebrate(true)');
  assert.doesNotMatch(src.slice(src.indexOf('} catch (e) {', fire), src.indexOf('} finally {', fire)), /setCelebrate\(true\)/);
});

test('every screen that mounts Celebrate is one of the five moments', () => {
  const MOMENTS = [
    'app/take/[code].tsx',
    'components/publicGames/GameShell.tsx',
    'app/(tabs)/school.tsx',
    'app/(tabs)/index.tsx',
    'components/today/PhoneToday.tsx',
    'app/homework-project/[id].tsx',
  ];
  const mounts: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(root, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(root, rel)).isDirectory()) walk(rel);
      else if (rel.endsWith('.tsx') && rel !== 'components/ui/Celebrate.tsx' && /<Celebrate\b/.test(read(rel))) mounts.push(rel);
    }
  };
  for (const dir of ['app', 'components']) walk(dir);
  assert.deepEqual(mounts.sort(), [...MOMENTS].sort(), 'a new celebration is a design decision: add it to CLAUDE.md, the celebrations spec and this file');
});

test('a prep checklist reaching all ready is celebrated, on the phone and on desktop', () => {
  const hook = read('hooks', 'useTodayLesson.ts');
  assert.match(hook, /prepCrossing\(/, 'the hook decides the crossing with prepCrossing');
  assert.doesNotMatch(hook, /justCompleted\(/, 'the hook must not re-implement the decision');
  assert.match(hook, /getAllItemsChecked\(\)/, 'the board reads materials with the checked read, not getAllItems');
  assert.doesNotMatch(hook, /\bgetAllItems\(/);
  assert.match(hook, /authoritative: loaded/, 'only an authoritative read is judged');
  assert.match(hook, /if \(!fromServer\) prevPrep\.current = null/, 'a degraded read drops the baseline');
  assert.match(hook, /setLoaded\(fromServer\)/);
  assert.match(hook, /prepJustReady/);
  assert.match(hook, /screenFocused\.current\) reload\(\)/, 'the web window-focus reload only runs while Today is focused');
  assert.match(hook, /skipKeyNow\.current === skipKey/, 'a skip save that resolves after a lesson change is ignored');
  for (const f of [['components', 'today', 'PhoneToday.tsx'], ['app', '(tabs)', 'index.tsx']]) {
    const src = read(...f);
    assert.match(src, /<Celebrate\b/, `${f.join('/')} does not mount Celebrate`);
    assert.match(src, /celebratePrepReady/, `${f.join('/')} does not say «الدرس جاهز»`);
  }
});
