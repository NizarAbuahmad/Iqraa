# Celebrations (PR 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four moments of real progress get a short, non-blocking
celebration:
- a student hands in an exam;
- a game ends (bigger for a perfect score);
- a student ticks their last homework;
- a teacher's prep checklist reaches all ready.

**Architecture:**
- **Pure helpers** in `services/celebration.ts`:
  - `justCompleted` (fire on the crossing, per subject);
  - `confettiPieces` (a seeded layout);
  - `CONFETTI_COLORS`;
  - `allTrackedDone` in `services/homework.ts`.
- **One RN overlay**, `components/ui/Celebrate.tsx`.
- **Each moment** keeps its own small "celebrate" state and mounts the overlay.

**Tech Stack:** Expo SDK 54, React Native 0.81.5, react-native-web 0.21,
`expo-haptics` (already a dependency), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-22-celebrations-design.md`

## Global Constraints

- **Running checks.**
  - App commands run in `artifacts/mobile`.
  - Tests: `pnpm test` there.
  - Typecheck: `pnpm run typecheck` from the repo root.
  - A file loaded by `node --test` must not import `react-native` or `expo-*`.
  - Relative imports in such a file need an explicit `.ts` extension.
  - `services/homework.ts` takes no imports at all.
- **RTL first.** Use `flexDirection: isRTL ? 'row-reverse' : 'row'` and
  `textAlign` per `isRTL`.
- **Contrast.**
  - Every text/background pair is at least 4.5:1.
  - Text on a `primary` fill is `primaryForeground`.
  - Amber (`palette.live`) is never a confetti colour.
- **Motion.**
  - Every `Animated` call passes `useNativeDriver: NATIVE_DRIVER`
    (`constants/animation.ts`).
  - Reduced motion (`useReduceMotion()` in `hooks/useReduceMotion.ts`) means no
    confetti and no scaling; a fade is allowed.
- **Shared pieces.**
  - Use `Surface` / `useSurface` from `components/ui/Surface.tsx`.
  - Never set `overflow: 'hidden'` on a surface.
  - New styles use `TYPE` / `SPACE` / `RADIUS` (`constants/theme.ts`).
  - `designScale.test.ts` must keep passing without raising its ceilings.
- **The overlay never blocks input.** It is `pointerEvents="none"`, absolute
  fill and on top.
- **Commits.** Messages end with exactly these two lines:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
  ```

---

### Task 1: The pure helpers

**Files:**
- Create: `artifacts/mobile/services/celebration.ts`
- Modify: `artifacts/mobile/services/homework.ts` (add `allTrackedDone` after
  `applyDone`)
- Test: create `artifacts/mobile/services/__tests__/celebration.test.ts`
- Test: modify `artifacts/mobile/services/__tests__/homework.test.ts`

**Interfaces:**
- Produces:
  - `type Progress = { key: string; complete: boolean }`
  - `justCompleted(prev: Progress | null, next: Progress): boolean`
  - `type ConfettiPiece = { x: number; delay: number; drift: number; spin: number; size: number; color: string }`
  - `confettiPieces(count: number, seed: number, colors?: readonly string[]): ConfettiPiece[]`
  - `CONFETTI_COLORS: readonly string[]`
  - `allTrackedDone(items: FamilyHomework[]): boolean`

- [ ] **Step 1: Write the failing tests**

`artifacts/mobile/services/__tests__/celebration.test.ts`:

```ts
// Pins when a celebration fires and how its confetti is laid out
// (docs/superpowers/specs/2026-10-22-celebrations-design.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFETTI_COLORS, confettiPieces, justCompleted } from '../celebration.ts';
import { CORNERS, CORNER_IDS } from '../../constants/corners.ts';

test('fires on the crossing from not-done to done, for the same subject', () => {
  assert.equal(justCompleted({ key: 'lesson-a', complete: false }, { key: 'lesson-a', complete: true }), true);
});

test('never on the first measurement: opening a screen that is already complete is not a moment', () => {
  assert.equal(justCompleted(null, { key: 'lesson-a', complete: true }), false);
});

test('never when the subject changed: switching to a lesson that is already complete is not a moment', () => {
  assert.equal(justCompleted({ key: 'lesson-a', complete: false }, { key: 'lesson-b', complete: true }), false);
});

test('never while it stays complete, and never on the way back down', () => {
  assert.equal(justCompleted({ key: 'a', complete: true }, { key: 'a', complete: true }), false);
  assert.equal(justCompleted({ key: 'a', complete: true }, { key: 'a', complete: false }), false);
  assert.equal(justCompleted({ key: 'a', complete: false }, { key: 'a', complete: false }), false);
});

test('the same seed lays out the same confetti; another seed does not', () => {
  assert.deepEqual(confettiPieces(24, 7), confettiPieces(24, 7));
  assert.notDeepEqual(confettiPieces(24, 7), confettiPieces(24, 8));
});

test('pieces stay on screen, start within the first third of a second, and come in the asked number', () => {
  const pieces = confettiPieces(24, 3);
  assert.equal(pieces.length, 24);
  for (const p of pieces) {
    assert.ok(p.x >= 0 && p.x <= 1, `x ${p.x}`);
    assert.ok(p.delay >= 0 && p.delay <= 300, `delay ${p.delay}`);
    assert.ok(Math.abs(p.drift) <= 60, `drift ${p.drift}`);
    assert.ok(p.size >= 6 && p.size <= 12, `size ${p.size}`);
    assert.ok(CONFETTI_COLORS.includes(p.color), `color ${p.color}`);
  }
});

test('the confetti wears the brand teal and every corner, and never amber, which means "now"', () => {
  assert.ok(CONFETTI_COLORS.includes('#006D65'));
  for (const id of CORNER_IDS) assert.ok(CONFETTI_COLORS.includes(CORNERS[id].light.primary), `${id} missing`);
  assert.ok(!CONFETTI_COLORS.includes('#B45309'));
});
```

Append to `artifacts/mobile/services/__tests__/homework.test.ts`. Add
`allTrackedDone` to its import list from `../homework.ts`. Read the file first
and build items the way its existing tests do. If a helper exists, use it;
otherwise build minimal items as literals with every `FamilyHomework` field
filled.

```ts
test('allTrackedDone: every item that can be ticked is done', () => {
  const item = (id: string, done: boolean, canTrack = true) => ({
    id, title: id, instructions: '', dueDate: '2026-10-22', className: '', teacherName: '',
    done, state: done ? 'done' as const : 'open' as const, examTitle: null, resources: [], canTrack,
  });
  assert.equal(allTrackedDone([item('a', true), item('b', true)]), true);
  assert.equal(allTrackedDone([item('a', true), item('b', false)]), false);
  // An item nobody can tick does not hold the celebration back, and does not count as done either.
  assert.equal(allTrackedDone([item('a', true), item('b', false, false)]), true);
  // Nothing trackable is not "all done".
  assert.equal(allTrackedDone([item('b', false, false)]), false);
  assert.equal(allTrackedDone([]), false);
});
```

If `HomeworkState` does not include `'open'` or `'done'`, use the real member
names from `services/homework.ts`.

- [ ] **Step 2: Run them to see them fail**

Run:
`cd artifacts/mobile && node --test services/__tests__/celebration.test.ts services/__tests__/homework.test.ts`

Expected: `celebration.test.ts` fails because it cannot find
`../celebration.ts`, and `homework.test.ts` fails because `allTrackedDone` is
not exported.

- [ ] **Step 3: Implement**

`artifacts/mobile/services/celebration.ts`:

```ts
/**
 * When a moment of real progress is celebrated, and how its confetti falls.
 * Pure, so `node --test` pins it (services/__tests__/celebration.test.ts);
 * components/ui/Celebrate.tsx draws it.
 *
 * A celebration fires on the CROSSING, never on the state: opening Today at
 * 5 of 5, switching to a lesson that is already ready, or reloading a finished
 * homework list is not a moment. The subject (`key`) must be the same on both
 * sides, so a change of lesson, child or round cannot read as a crossing.
 */
import { CORNERS, CORNER_IDS } from '../constants/corners.ts';

export type Progress = { key: string; complete: boolean };

export function justCompleted(prev: Progress | null, next: Progress): boolean {
  return prev !== null && prev.key === next.key && !prev.complete && next.complete;
}

/** Brand teal and each corner's light primary. Never amber: amber means "now". */
export const CONFETTI_COLORS: readonly string[] = ['#006D65', ...CORNER_IDS.map(id => CORNERS[id].light.primary)];

export type ConfettiPiece = {
  /** Start position across the screen, 0–1. */
  x: number;
  /** ms before it starts falling. */
  delay: number;
  /** Sideways travel while falling, px (signed). */
  drift: number;
  /** Turns while falling (signed). */
  spin: number;
  /** Edge length, px. */
  size: number;
  color: string;
};

/** mulberry32: a tiny seeded PRNG, so a burst's layout is reproducible in tests. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function confettiPieces(count: number, seed: number, colors: readonly string[] = CONFETTI_COLORS): ConfettiPiece[] {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => ({
    x: r(),
    delay: Math.round(r() * 300),
    drift: Math.round((r() - 0.5) * 120),
    spin: Math.round((r() - 0.5) * 4 * 10) / 10,
    size: 6 + Math.round(r() * 6),
    color: colors[i % colors.length],
  }));
}
```

Check that `constants/corners.ts` can be imported by `node --test`.
`cornerTheme.test.ts` already imports it with a `.ts` extension, so it can.
App code imports `services/celebration.ts` through esbuild/metro. If metro
rejects the `.ts` extension in the import, see how other services files that
the app and the tests both load import `constants/corners`, and copy that
pattern. Report what you did.

In `services/homework.ts`, after `applyDone`:

```ts
/**
 * Whether every item that can be ticked is done: the moment School celebrates
 * («أنجزت كل واجباتك»). An item nobody can tick (`canTrack: false`) neither
 * holds it back nor counts toward it, and a list with nothing trackable is
 * never "all done".
 */
export function allTrackedDone(items: FamilyHomework[]): boolean {
  const tracked = items.filter(h => h.canTrack);
  return tracked.length > 0 && tracked.every(h => h.done);
}
```

- [ ] **Step 4: Run them to see them pass**

Run the same `node --test` command. Expected: PASS. Then run `pnpm test`.
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/celebration.ts artifacts/mobile/services/homework.ts artifacts/mobile/services/__tests__/celebration.test.ts artifacts/mobile/services/__tests__/homework.test.ts
git commit -m "$(cat <<'EOF'
Celebrations: fire on the crossing, seeded confetti, and all-homework-done

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
EOF
)"
```

---

### Task 2: The overlay, the exam hand-in and the games

**Files:**
- Create: `artifacts/mobile/components/ui/Celebrate.tsx`
- Modify: `artifacts/mobile/services/i18n.ts` (five keys in both tables, next
  to `tabToday`)
- Modify: `artifacts/mobile/app/take/[code].tsx` (`handIn` around line 376,
  and the `phase === 'done'` render around line 438)
- Modify: `artifacts/mobile/components/publicGames/GameShell.tsx`
- Modify: `artifacts/mobile/components/publicGames/TriviaGame.tsx:103`
- Modify: `artifacts/mobile/components/publicGames/MathDrillGame.tsx:77`
- Test: create `artifacts/mobile/services/__tests__/celebrateMoments.test.ts`

**Interfaces:**
- Consumes (Task 1): `confettiPieces`. Also `useReduceMotion`, `useSurface`,
  `NATIVE_DRIVER` and `MOTION` (`services/motion.ts`, if useful).
- Produces:
  - `Celebrate({ visible, message, size = 'small', onDone }: { visible: boolean; message: string; size?: 'small' | 'big'; onDone: () => void })`
  - i18n keys, all plain strings:
    - `celebrateHandedIn`
    - `celebrateGameOver`
    - `celebrateGamePerfect`
    - `celebrateHomeworkAll`
    - `celebratePrepReady`
  - `GameShell`'s `gameOver` becomes `{ message: string; perfect?: boolean } | null`.

- [ ] **Step 1: Write the failing test**

`artifacts/mobile/services/__tests__/celebrateMoments.test.ts`:

```ts
// Each of the four moments mounts the shared Celebrate overlay
// (docs/superpowers/specs/2026-10-22-celebrations-design.md). The firing rule
// itself is pinned in celebration.test.ts; these pin that each screen uses it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

test('the overlay never blocks a tap and respects reduced motion', () => {
  const src = read('components', 'ui', 'Celebrate.tsx');
  assert.match(src, /pointerEvents="none"/);
  assert.match(src, /useReduceMotion\(/);
  assert.match(src, /NATIVE_DRIVER/);
  assert.doesNotMatch(src, /useNativeDriver:\s*(true|false)/, 'pass NATIVE_DRIVER, never a literal');
});

test('an exam handed in during this sitting is celebrated', () => {
  const src = read('app', 'take', '[code].tsx');
  assert.match(src, /<Celebrate\b/);
  assert.match(src, /celebrateHandedIn/);
});

test('a finished game is celebrated, louder for a perfect score', () => {
  const src = read('components', 'publicGames', 'GameShell.tsx');
  assert.match(src, /<Celebrate\b/);
  assert.match(src, /justCompleted\(/);
  assert.match(src, /celebrateGamePerfect/);
  assert.match(read('components', 'publicGames', 'TriviaGame.tsx'), /perfect:/);
  assert.match(read('components', 'publicGames', 'MathDrillGame.tsx'), /perfect:/);
});
```

Task 3 appends the homework and Today checks to this file.

Run:
`cd artifacts/mobile && node --test services/__tests__/celebrateMoments.test.ts`

Expected: FAIL, with ENOENT on `components/ui/Celebrate.tsx`.

- [ ] **Step 2: i18n**

In both tables of `services/i18n.ts`, next to `tabToday`:
- Arabic:
  - `celebrateHandedIn: 'أحسنت! سُلّمت ورقتك'`
  - `celebrateGameOver: 'أحسنت!'`
  - `celebrateGamePerfect: 'علامة كاملة!'`
  - `celebrateHomeworkAll: 'أنجزت كل واجباتك'`
  - `celebratePrepReady: 'الدرس جاهز'`
- English:
  - `celebrateHandedIn: 'Well done — handed in!'`
  - `celebrateGameOver: 'Well played!'`
  - `celebrateGamePerfect: 'Perfect score!'`
  - `celebrateHomeworkAll: 'All your homework is done'`
  - `celebratePrepReady: 'Lesson ready'`

- [ ] **Step 3: Create `Celebrate`**

Create `artifacts/mobile/components/ui/Celebrate.tsx`. It renders nothing
unless `visible`. When `visible` turns true:
1. **Announce and buzz.** Call `AccessibilityInfo.announceForAccessibility(message)`.
   On native (`Platform.OS !== 'web'`) also call
   `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` and
   ignore any error.
2. **Pick the pieces once per burst.** Use
   `confettiPieces(size === 'big' ? 24 : 12, seed)`, with `seed` taken from
   `Date.now()` at the moment it becomes visible and held in a ref.
3. **Animate.**
   - Without reduced motion: one `Animated.Value` per piece runs 0→1 over
     1200ms with the piece's `delay` (`Easing.in(Easing.quad)`). Each piece is
     an absolutely positioned `Animated.View` with:
     - `left: x * width`, `top: -20`, and `width`/`height: size`;
     - `backgroundColor: color` and `borderRadius: RADIUS.xs`;
     - `transform`: `translateY` 0 → `0.6 * height`, `translateX` 0 → `drift`,
       and `rotate` 0 → `${spin * 360}deg`;
     - `opacity` 1 → 0 over the last third (inputRange `[0, 0.66, 1]`,
       outputRange `[1, 1, 0]`).

     `width` and `height` come from `useWindowDimensions()`.
   - The badge: in the centre of the screen, a `Surface`
     (`padding: SPACE.lg`, `gap: SPACE.sm`, `alignItems: 'center'`,
     `minWidth: 200`) with `checkmark-circle` (size 44, `colors.primary`) and
     the message (`colors.foreground`, `ReadexPro_700Bold`, `TYPE.title`,
     centred).
     - Without reduced motion: it pops from scale 0.85 → 1 and opacity 0 → 1
       over `MOTION.enterMs`.
     - With reduced motion: opacity only, and no pieces at all.
4. **Hide and report.** After 1800ms (`size === 'small'`) or 2200ms (`big`),
   the badge fades out over `MOTION.enterMs`, then `onDone()` is called.
   Clear the timers and stop the animations on unmount.

The root view is `[StyleSheet.absoluteFill, { zIndex: 1000 }]`,
`pointerEvents="none"`. Every `Animated` call passes
`useNativeDriver: NATIVE_DRIVER`. Write a header comment that names the four
moments, says it fires on the crossing (`justCompleted`), says it never blocks
input, and says what reduced motion does.

- [ ] **Step 4: The exam hand-in**

In `app/take/[code].tsx`:
- Add `const [celebrating, setCelebrating] = useState(false);` beside the
  other state.
- In the hand-in function, right after `await submitStudentExam(token);` and
  before `setPhase('done')`, call `setCelebrating(true)`. Do **not** set it in
  the `already_submitted` branch, nor where an existing `submittedAt` puts the
  phase in `'done'`: those are not this sitting's hand-in.
- In the `phase === 'done'` render, wrap the existing centred view so the
  overlay can sit over it. The outer `View` has `{ flex: 1 }`, then the
  existing view, then
  `<Celebrate visible={celebrating} size="big" message={t('celebrateHandedIn')} onDone={() => setCelebrating(false)} />`.
  Do not change the existing done content: it still never shows a score by
  default.

- [ ] **Step 5: The games**

In `components/publicGames/GameShell.tsx`:
- Type `gameOver` as `{ message: string; perfect?: boolean } | null`.
- Track the round with a ref:
  `const prev = useRef<Progress | null>(null)`. On each render compute
  `next = { key: titleKey, complete: !!gameOver }`. Then, in an effect keyed
  on `!!gameOver`: if `justCompleted(prev.current, next)`, set state
  `celebrate = gameOver?.perfect ? 'big' : 'small'`. Finally set
  `prev.current = next`.

  A replay sets `gameOver` back to null, so the next finish fires again.
- Render
  `<Celebrate visible={celebrate !== null} size={celebrate ?? 'small'} message={t(celebrate === 'big' ? 'celebrateGamePerfect' : 'celebrateGameOver')} onDone={() => setCelebrate(null)} />`
  as the last child of the shell's root view.

The games:
- `TriviaGame.tsx`:
  `gameOver={gameOver ? { message: t('playScoreLabel', score, questions.length), perfect: score === questions.length } : null}`
- `MathDrillGame.tsx`:
  `gameOver={phase === 'over' ? { message: t('playDrillResult', result.correct, result.attempted), perfect: result.attempted > 0 && result.correct === result.attempted } : null}`
- `MemoryGame.tsx` and `ColorSpotGame.tsx` are unchanged. They have no
  "perfect", so they celebrate small.

- [ ] **Step 6: Verify**

Run:
`cd artifacts/mobile && node --test services/__tests__/celebrateMoments.test.ts`
Expected: PASS.

Run `pnpm test` (in `artifacts/mobile`) and `pnpm run typecheck` (repo root).
Expected: all pass, clean.

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile/components/ui/Celebrate.tsx artifacts/mobile/services/i18n.ts "artifacts/mobile/app/take/[code].tsx" artifacts/mobile/components/publicGames artifacts/mobile/services/__tests__/celebrateMoments.test.ts
git commit -m "$(cat <<'EOF'
Celebrate: a confetti burst when an exam is handed in and when a game ends

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
EOF
)"
```

---

### Task 3: Homework, the prep checklist, and the docs

**Files:**
- Modify: `artifacts/mobile/app/(tabs)/school.tsx` (`toggleDone` around line
  165, and the root view around line 211)
- Modify: `artifacts/mobile/hooks/useTodayLesson.ts` (add `prepJustReady` /
  `clearPrepJustReady`)
- Modify: `artifacts/mobile/components/today/PhoneToday.tsx` (mount the
  overlay)
- Modify: `artifacts/mobile/app/(tabs)/index.tsx` (`LessonWorkspace`: mount
  the overlay)
- Modify: `docs/status-log.md`: a section at the **top**, directly under its
  header. Also `STATUS.md`: one line in «Recent changes», plus the log's
  section count.
- Modify: `CLAUDE.md`: one sentence in the shared-pieces bullet.
- Test: modify `artifacts/mobile/services/__tests__/celebrateMoments.test.ts`

**Interfaces:**
- Consumes:
  - `justCompleted`, `type Progress` (Task 1);
  - `allTrackedDone` (Task 1);
  - `Celebrate` (Task 2).
- Produces: `useTodayLesson()` returns two more fields,
  `prepJustReady: boolean` and `clearPrepJustReady: () => void`.

- [ ] **Step 1: Write the failing test**

Append to `celebrateMoments.test.ts`:

```ts
test('ticking off the last homework is celebrated, after the save succeeds', () => {
  const src = read('app', '(tabs)', 'school.tsx');
  assert.match(src, /<Celebrate\b/);
  assert.match(src, /allTrackedDone\(/);
  assert.match(src, /celebrateHomeworkAll/);
});

test('a prep checklist reaching all ready is celebrated, on the phone and on desktop', () => {
  const hook = read('hooks', 'useTodayLesson.ts');
  assert.match(hook, /justCompleted\(/, 'the hook does not decide the crossing with justCompleted');
  assert.match(hook, /prepJustReady/);
  for (const f of [['components', 'today', 'PhoneToday.tsx'], ['app', '(tabs)', 'index.tsx']]) {
    const src = read(...f);
    assert.match(src, /<Celebrate\b/, `${f.join('/')} does not mount Celebrate`);
    assert.match(src, /celebratePrepReady/, `${f.join('/')} does not say «الدرس جاهز»`);
  }
});
```

Run:
`cd artifacts/mobile && node --test services/__tests__/celebrateMoments.test.ts`

Expected: the two new tests fail.

- [ ] **Step 2: Homework**

In `app/(tabs)/school.tsx`:
- Add `const [celebrateHw, setCelebrateHw] = useState(false);`.
- In `toggleDone`, capture the child's list before the optimistic patch:
  `const before = homework?.find(k => k.key === childKey)?.homework ?? [];`
  (or read it from inside the `setHomework` updater, which is better if it
  avoids a stale closure).

  Then, after `await setHomeworkDone(item.id, next);` succeeds (inside the
  `try`, after the await):

  ```ts
  if (next && justCompleted(
    { key: childKey, complete: allTrackedDone(before) },
    { key: childKey, complete: allTrackedDone(applyDone(before, item.id, true)) },
  )) setCelebrateHw(true);
  ```

  The celebration fires only after the save succeeds, and only for a tick.
- Add `<Celebrate visible={celebrateHw} size="small" message={t('celebrateHomeworkAll')} onDone={() => setCelebrateHw(false)} />`
  as the last child of the root `View`.
- Import `justCompleted` from `@/services/celebration`, `allTrackedDone` with
  the other homework imports, and `Celebrate` from
  `@/components/ui/Celebrate`.

- [ ] **Step 3: The prep checklist (the hook)**

In `hooks/useTodayLesson.ts`:
- `const prepComplete = summary.total > 0 && summary.done >= summary.total;`
- Track the crossing per lesson, only after materials have loaded once:
  - `const [loaded, setLoaded] = useState(false)`, set to `true` inside
    `reload` once `getAllItems()` resolves (also on failure, so a failed load
    does not block forever). `reload` runs from `useFocusEffect` (on mount and
    on refocus) and from the web `window` focus listener; there is no separate
    mount call;
  - `const prevPrep = useRef<Progress | null>(null)`;
  - `const [prepJustReady, setPrepJustReady] = useState(false)`.

  Then:

  ```ts
  useEffect(() => {
    if (!loaded || !topic) return;
    const next = { key: skipKey, complete: prepComplete };
    if (justCompleted(prevPrep.current, next)) setPrepJustReady(true);
    prevPrep.current = next;
  }, [loaded, topic, skipKey, prepComplete]);
  ```

  `skipKey` is the lesson's key. A lesson change resets the comparison through
  `justCompleted`'s key check.
- Return `prepJustReady` and
  `clearPrepJustReady: () => setPrepJustReady(false)`. Add both to the
  `TodayLesson` type with one-line doc comments.

- [ ] **Step 4: The prep checklist (the two layouts)**

- **`components/today/PhoneToday.tsx`.** The root is a `ScrollView`. Wrap it
  in `<View style={{ flex: 1 }}>…</View>` and add
  `<Celebrate visible={prepJustReady} size="small" message={t('celebratePrepReady')} onDone={clearPrepJustReady} />`
  after the `ScrollView`.
- **`app/(tabs)/index.tsx` (`LessonWorkspace`).** Add the same `Celebrate`,
  with `today.prepJustReady` and `today.clearPrepJustReady`, as the last child
  of its root `View`.

- [ ] **Step 5: Docs**

`CLAUDE.md`: in the "Cards, presses, entry motion and bands are shared pieces"
bullet, before its «Amber» sentence, add:

```markdown
  Progress is celebrated by `Celebrate` (`components/ui/Celebrate.tsx`) at four
  moments only — exam handed in, game over, last homework ticked, prep checklist
  all ready — and only on the crossing (`justCompleted` in
  `services/celebration.ts`), never on opening a screen that is already done.
```

`docs/status-log.md`: put a new section at the **top**, directly under the
header and above "## Teachers' phones open on Today — 2026-10-22". Title it
"## Progress is celebrated — 2026-10-22". It has five bullets:
- the four moments, as in the CLAUDE.md sentence, and that each fires only on
  the crossing;
- how it looks: a confetti burst, a badge, a haptic and a screen-reader
  announcement; with reduced motion only the badge fades;
- that the classroom presentation keeps its own celebration;
- **Verified:** tests and typecheck;
- **Not verified:** the haptic and the screen-reader announcement on a device.

`STATUS.md`:
- In «Recent changes», add `- 2026-10-22 — Progress is celebrated` as the
  first entry. Delete the last entry so the list keeps exactly 30.
- In «Finding older detail», raise «The log has N sections» by one.

- [ ] **Step 6: Verify**

Run:
`cd artifacts/mobile && node --test services/__tests__/celebrateMoments.test.ts`
Expected: PASS.

Run `pnpm test` (in `artifacts/mobile`) and `pnpm run typecheck` (repo root).
Expected: all pass, clean.

- [ ] **Step 7: Commit**

```bash
git add "artifacts/mobile/app/(tabs)/school.tsx" artifacts/mobile/hooks/useTodayLesson.ts artifacts/mobile/components/today/PhoneToday.tsx "artifacts/mobile/app/(tabs)/index.tsx" artifacts/mobile/services/__tests__/celebrateMoments.test.ts CLAUDE.md STATUS.md docs/status-log.md
git commit -m "$(cat <<'EOF'
Celebrate the last homework ticked and a prep checklist reaching all ready

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
EOF
)"
```

---

## After the tasks (controller)

- **Screenshots.** Take the overlay mid-burst: a dev-only route or a
  Playwright run that triggers a game end, for example the memory game. Cover
  light and dark, and reduced motion (badge only).
- **Final review.** Run a whole-branch review, then open the PR, then merge
  it if it is green. The user has said to merge when ready.
