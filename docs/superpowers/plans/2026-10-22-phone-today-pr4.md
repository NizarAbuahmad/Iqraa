# Phone Today (PR 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teachers on a phone land on a Today screen: the lesson, what is
missing, Start class, quick tools and Ask Iqraa. Empty lists become friendly
cards, and the Tools tab becomes a coloured two-column grid on phones.

**Architecture:**
- Tab visibility and the lesson-bar rule move into a pure, tested function.
- The desktop Today's lesson logic moves unchanged into a hook,
  `useTodayLesson()`.
- A new `PhoneToday` layout reads the same hook, so phone and desktop always
  name the same lesson.
- `EmptyState` and the Tools cards adopt PR 3's `useSurface()` /
  `PressableScale`.

**Tech Stack:** Expo SDK 54, React Native 0.81.5 (new architecture),
react-native-web 0.21, expo-router tabs, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-22-phone-today-design.md`

## Global Constraints

- **Where to run things.** App commands run in `artifacts/mobile`. Tests:
  `pnpm test` there (bare `node --test` over
  `services/__tests__/**/*.test.ts`). Typecheck: `pnpm run typecheck` from the
  repo root.
- **Test imports.** A file loaded by `node --test` must not import
  `react-native` or `expo-*`, and its relative imports need an explicit `.ts`
  extension.
- **RTL first.** Layout direction is per component
  (`flexDirection: isRTL ? 'row-reverse' : 'row'`, `textAlign: isRTL ? 'right'
  : 'left'`), as the surrounding code does.
- **Colour.**
  - Every text/background pair is at least 4.5:1.
  - Text on a `primary` fill is `primaryForeground`.
  - Amber (`palette.live`) is only for «ابدأ الحصة» and the "period now" pill.
- **Shared pieces from PR 3.** Use `useSurface()` / `Surface`,
  `PressableScale`, `Entrance` and `Band` (all in `components/ui`).
  - A card taking `useSurface()` loses its own `borderWidth: 1`.
  - No `overflow: 'hidden'` on a surface.
  - Every `Animated` call uses `NATIVE_DRIVER`.
  - Reduced motion means nothing moves.
- **Scale.** New styles use `TYPE` / `SPACE` / `RADIUS` (`constants/theme.ts`).
  `designScale.test.ts` must keep passing. Do not raise its ceilings.
- **Lessons.**
  - Anything opening a generator uses the hook's `toolParams` (which come from
    `lessonPickerParams` / `scopePickerParams`), never a bare `topic`.
  - Start class passes the lesson's own subject (the existing `buildClassDeck`
    call).
- **Tab screens and the status bar.** A tab screen that has the lesson bar
  above it must not add `insets.top`. A tab screen with no bar above it (iqra
  today, phone Today after this PR) must pay `insets.top` itself.
- **Commits.** Messages end with exactly these two lines, and no model name
  appears anywhere else:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
  ```

---

### Task 1: Tab visibility and the greeting, as pure tested functions

**Files:**
- Create: `artifacts/mobile/services/tabVisibility.ts`
- Create: `artifacts/mobile/services/greeting.ts`
- Test: create `artifacts/mobile/services/__tests__/tabVisibility.test.ts`
- Test: create `artifacts/mobile/services/__tests__/greeting.test.ts`

**Interfaces:**
- Produces:
  - `type TabName = 'index' | 'iqra' | 'school' | 'curriculum' | 'ai-tools' | 'notifications' | 'profile'`
  - `type NavContext = { isTeacher: boolean; isDesktop: boolean }`
  - `tabVisible(name: TabName, ctx: NavContext): boolean`
  - `isHomePath(pathname: string): boolean`
  - `showLessonBar(pathname: string, ctx: NavContext): boolean`
  - `type GreetingKey = 'homeGreetMorning' | 'homeGreetAfternoon' | 'homeGreetEvening'`
  - `greetingKey(hour: number): GreetingKey`

  Nothing uses these yet. Task 3 wires them.

- [ ] **Step 1: Write the failing tests**

`artifacts/mobile/services/__tests__/tabVisibility.test.ts`:

```ts
// Pins which tabs each user sees on each device, and where the lesson bar shows
// (docs/superpowers/specs/2026-10-22-phone-today-design.md).
import { test } from 'node:test';
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
```

`artifacts/mobile/services/__tests__/greeting.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { greetingKey } from '../greeting.ts';

test('morning until noon, afternoon until five, evening after', () => {
  assert.equal(greetingKey(5), 'homeGreetMorning');
  assert.equal(greetingKey(11), 'homeGreetMorning');
  assert.equal(greetingKey(12), 'homeGreetAfternoon');
  assert.equal(greetingKey(16), 'homeGreetAfternoon');
  assert.equal(greetingKey(17), 'homeGreetEvening');
  assert.equal(greetingKey(23), 'homeGreetEvening');
});

test('the small hours are evening, not morning', () => {
  assert.equal(greetingKey(0), 'homeGreetEvening');
  assert.equal(greetingKey(4), 'homeGreetEvening');
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd artifacts/mobile && node --test services/__tests__/tabVisibility.test.ts services/__tests__/greeting.test.ts`

Expected: both fail, with "Cannot find module '../tabVisibility.ts'" and
"Cannot find module '../greeting.ts'".

- [ ] **Step 3: Implement**

`artifacts/mobile/services/tabVisibility.ts`:

```ts
/**
 * Which tabs a user sees, and where the lesson bar shows. Pure, so
 * `node --test` can pin it (services/__tests__/tabVisibility.test.ts);
 * `(tabs)/_layout.tsx` reads it for both the phone tab bar and the desktop
 * sidebar, so the two cannot drift.
 *
 * Since 2026-10-22 a teacher's phone opens on Today, not the chat, and the
 * chat leaves the phone tab bar. Its route stays registered (hidden), so every
 * `router.push('/iqra')` still lands; Today's ask card is the way in. Desktop
 * keeps the chat in the sidebar beside Today.
 */
export type TabName = 'index' | 'iqra' | 'school' | 'curriculum' | 'ai-tools' | 'notifications' | 'profile';
export type NavContext = { isTeacher: boolean; isDesktop: boolean };

export function tabVisible(name: TabName, { isTeacher, isDesktop }: NavContext): boolean {
  switch (name) {
    case 'index': return isTeacher;
    case 'iqra': return isTeacher && isDesktop;
    case 'school': return !isTeacher;
    case 'ai-tools': return isTeacher;
    case 'curriculum':
    case 'notifications':
    case 'profile':
      return true;
  }
}

/** The landing route, under either spelling expo-router reports. */
export function isHomePath(pathname: string): boolean {
  return pathname === '/' || pathname === '/index';
}

/**
 * The lesson bar is for teachers, everywhere except the two screens that carry
 * the lesson themselves: Today (its lesson card) and the chat
 * (CurrentLessonCard). A second copy stacked above either is the same line twice.
 */
export function showLessonBar(pathname: string, { isTeacher }: NavContext): boolean {
  return isTeacher && !isHomePath(pathname) && !pathname.startsWith('/iqra');
}
```

`artifacts/mobile/services/greeting.ts`:

```ts
/**
 * Today's greeting by the hour on the device. The small hours count as evening:
 * «صباح الخير» at 2 a.m. reads as a bug. Cosmetic, so the device clock is fine
 * here; anything that decides a DAY uses `ammanToday()` instead.
 */
export type GreetingKey = 'homeGreetMorning' | 'homeGreetAfternoon' | 'homeGreetEvening';

export function greetingKey(hour: number): GreetingKey {
  if (hour >= 5 && hour < 12) return 'homeGreetMorning';
  if (hour >= 12 && hour < 17) return 'homeGreetAfternoon';
  return 'homeGreetEvening';
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `cd artifacts/mobile && node --test services/__tests__/tabVisibility.test.ts services/__tests__/greeting.test.ts`

Expected: all pass. Then run `pnpm test` (in `artifacts/mobile`) once:
everything passes.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/tabVisibility.ts artifacts/mobile/services/greeting.ts artifacts/mobile/services/__tests__/tabVisibility.test.ts artifacts/mobile/services/__tests__/greeting.test.ts
git commit -m "$(cat <<'EOF'
Today: tab visibility, the lesson-bar rule and the greeting as pure functions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
EOF
)"
```

---

### Task 2: Move the desktop Today's logic into `useTodayLesson()`, unchanged

**Files:**
- Create: `artifacts/mobile/hooks/useTodayLesson.ts`
- Modify: `artifacts/mobile/app/(tabs)/index.tsx` (`LessonWorkspace`, lines
  ~99-298, and `suggestionsFor`, lines ~571-582)

**Interfaces:**
- Produces: `useTodayLesson(source: 'workspace' | 'today_phone'): TodayLesson`,
  where:

```ts
export type TodayLesson = {
  /** '' when there is no lesson. */
  topic: string;
  /** The resolved lesson: today's pick, else the timetable's, else an older pick, else the chat's default. */
  active: { topic: string; lessonId: string | null; gradeId?: string | null; subjectId?: string | null } | null;
  /** «الحصة القادمة · العاشر ب · 10:15», or '' when the card is not showing that period's lesson. */
  periodLine: string;
  next: NextPeriodLesson | null;
  setup: TimetableSetupStep | null;
  nudgeDismissed: boolean;
  dismissNudge: () => void;
  classes: ClassGroup[];
  board: PrepRow[];
  summary: { done: number; total: number };
  toggleSkip: (row: PrepRow) => void;
  gradeLabel: string;
  subjectLabel: string;
  /** Params that open a generator on this lesson's own grade and subject. */
  toolParams: Record<string, string>;
  quickTools: ToolDef[];
  /** Up to three asks for what the board says is missing. */
  suggestions: string[];
  startingClass: boolean;
  startClassError: string;
  startClass: () => Promise<void>;
  openLessonPicker: () => void;
  /** Opens the chat with `text` already sent. Does nothing for blank text. */
  ask: (text: string) => void;
};
```

  Copy the exact types the current code uses (`NextPeriodLesson`,
  `TimetableSetupStep`, `ClassGroup`, `PrepRow`, `ToolDef`). If
  `prepSummary`'s return type or `active`'s gradeId/subjectId types differ
  from the sketch above, use the real types and say so in the report.
- Consumes: everything `LessonWorkspace` already imports.

This is a move, not a rewrite. The desktop must behave and render exactly as
before.

- [ ] **Step 1: Create the hook by moving code**

Create `artifacts/mobile/hooks/useTodayLesson.ts`. Move into it, unchanged
and with their existing comments, everything in `LessonWorkspace` from
`const [pick, setPick] = useState…` down to `const quickTools = …`:
- the state;
- the `reload` callback and its effects;
- `fallback`, `scheduled`, `fromSchedule`, `active` and `periodLine`;
- `topic`, `skipKey`, the skips state and its effect, and `toggleSkip`;
- `board` and `summary`;
- the grade and subject labels;
- `toolParams`, `openLessonPicker` and `handleStartClass` (renamed
  `startClass` in the returned object);
- the `params.startClass` nonce effect, with its eslint comment;
- `quickTools`;
- `suggestionsFor`, as a module-level function in the hook file.

Then make these changes inside the hook:
- `handleStartClass` calls `trackEvent('class_started', { source, deck: … })`,
  where `source` is the hook's parameter. Desktop passes `'workspace'`, which
  is what it sends today.
- Add `dismissNudge`:
  `() => { setNudgeDismissed(true); void dismissSetupNudge(); }`. This is the
  same as the inline handler.
- Add `ask(text)`, which is the body of `sendAsk` without the `ask` state:
  trim the text, return if it is empty, then
  `router.push({ pathname: '/iqra', params: { initialMessage: text, askId: String(Date.now()) } })`.
- Native has no `window.focus`, so also reload when the screen gains focus.
  Use `useFocusEffect` from `expo-router` with `useCallback(() => { reload(); }, [reload])`.
  Keep the existing web `window` focus listener.
- `suggestions = useMemo(() => suggestionsFor(board, topic, isAr), [board, topic, isAr])`.
- Return the `TodayLesson` object.

Header comment for the hook file:

```ts
/**
 * Today's lesson and everything hung on it: which lesson, the prep board, the
 * tools' params, Start class, the next period, the setup nudge. Moved out of
 * the desktop workspace (app/(tabs)/index.tsx) on 2026-10-22 so the phone
 * Today (components/today/PhoneToday.tsx) reads the same logic: two layouts
 * over one hook can never name two different lessons.
 *
 * Reloads saved materials, classes and the timetable on mount, on screen focus
 * (native) and on window focus (web): generating a worksheet leaves Today and
 * comes back, and a board that still says "missing" is worse than none.
 */
```

- [ ] **Step 2: Make `LessonWorkspace` read the hook**

In `artifacts/mobile/app/(tabs)/index.tsx`:
- Start `LessonWorkspace` with:
  `const today = useTodayLesson('workspace');`
- Keep the local `ask` input state for its composer, plus
  `sendAsk = () => { today.ask(ask); setAsk(''); }`.
- Replace each use of a moved name with `today.<name>`, or destructure the
  names it needs.
  - `handleStartClass` becomes `today.startClass`.
  - `suggestionsFor(board, topic, isAr)` becomes `today.suggestions`.
  - The nudge close handler becomes `today.dismissNudge`.
- Delete the moved code and every import that becomes unused. Keep
  `START_CLASS_COLOR`, `SIDE_PANEL_WIDTH`, the JSX and the styles. The
  rendered output must not change.

- [ ] **Step 3: Verify**

Run `pnpm run typecheck` (repo root). Expected: clean.

Run `cd artifacts/mobile && pnpm test`. Expected: all pass. There is no
behaviour change, and the existing `lessonBoard` / `lessonContext` /
`lessonPrep` tests cover the pure parts.

Run `git diff --stat`. Expected: only the two files.

Re-read the diff of `index.tsx`. Every JSX line outside the moved block
should be unchanged, apart from the `today.` prefixes.

- [ ] **Step 4: Commit**

```bash
git add artifacts/mobile/hooks/useTodayLesson.ts "artifacts/mobile/app/(tabs)/index.tsx"
git commit -m "$(cat <<'EOF'
Today: move the desktop workspace's lesson logic into useTodayLesson()

No behaviour change on desktop; the hook also reloads on screen focus so a
native screen picks up a just-made material.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
EOF
)"
```

---

### Task 3: The phone Today, and the tab bar that opens on it

**Files:**
- Create: `artifacts/mobile/components/today/PhoneToday.tsx`
- Modify: `artifacts/mobile/app/(tabs)/index.tsx` (the `Index` router at
  lines ~71-97)
- Modify: `artifacts/mobile/app/(tabs)/_layout.tsx`:
  - `buildTabEntries`, lines 64-167;
  - the bar logic, lines ~315-378;
  - the comment above the tab list, lines ~289-296.
- Modify: `artifacts/mobile/components/ui/NotificationBell.tsx` (add `onDark`)
- Modify: `artifacts/mobile/services/i18n.ts` (greeting keys, in both `ar` and
  `en`)
- Test: modify `artifacts/mobile/services/__tests__/tabVisibility.test.ts`

**Interfaces:**
- Consumes:
  - `useTodayLesson('today_phone')` (Task 2)
  - `tabVisible`, `showLessonBar`, `isHomePath`, `TabName` (Task 1)
  - `greetingKey` (Task 1)
  - `Band`, `BRAND_MOTIF_OPACITY`, `Surface`/`useSurface`, `PressableScale`,
    `Entrance` (PR 3)
  - `LessonPrepBoard`, `AiSourceBadge`, `JordanFlag`, `IqraaMark` (existing)
- Produces:
  - `PhoneToday` (default-free named export)
  - `NotificationBell({ size?, onDark? })`
  - i18n keys `homeGreetMorning`, `homeGreetAfternoon` and `homeGreetEvening`,
    each `(name: string) => string`

- [ ] **Step 1: Write the failing test**

Append to `artifacts/mobile/services/__tests__/tabVisibility.test.ts`. Add
`import { readFileSync } from 'node:fs'; import { dirname, join } from
'node:path'; import { fileURLToPath } from 'node:url';` to its imports, then:

```ts
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
```

Run: `cd artifacts/mobile && node --test services/__tests__/tabVisibility.test.ts`

Expected: the two new tests fail ("index.tsx still forwards a phone teacher to
/iqra"; "_layout.tsx does not import tabVisibility").

- [ ] **Step 2: Add the greeting strings and the bell's `onDark`**

In `services/i18n.ts`, add next to `tabToday` in the Arabic table:

```ts
    homeGreetMorning: (name: string) => (name ? `صباح الخير، ${name}` : 'صباح الخير'),
    homeGreetAfternoon: (name: string) => (name ? `مساء الخير، ${name}` : 'مساء الخير'),
    homeGreetEvening: (name: string) => (name ? `مساء الخير، ${name}` : 'مساء الخير'),
```

Add next to `tabToday` in the English table:

```ts
    homeGreetMorning: (name: string) => (name ? `Good morning, ${name}` : 'Good morning'),
    homeGreetAfternoon: (name: string) => (name ? `Good afternoon, ${name}` : 'Good afternoon'),
    homeGreetEvening: (name: string) => (name ? `Good evening, ${name}` : 'Good evening'),
```

Arabic has no separate "good afternoon" in everyday use: «مساء الخير» covers
both afternoon and evening. If the i18n file's type requires the two tables to
have identical keys, it already does by construction.

In `components/ui/NotificationBell.tsx`:
- Change the signature to
  `export function NotificationBell({ size = 22, onDark = false }: { size?: number; onDark?: boolean })`.
- The icon colour becomes
  `onDark ? '#FFFFFF' : unread > 0 ? colors.primary : colors.foreground`.
  The filled icon still marks unread.
- Add one line to its doc comment: "`onDark` draws it in white for a dark
  header band (phone Today)."

- [ ] **Step 3: Create `PhoneToday`**

Create `artifacts/mobile/components/today/PhoneToday.tsx`, exporting
`PhoneToday()`. It reads `useTodayLesson('today_phone')`, `useColors()`,
`useLanguage()`, `useAuth()` (for `user.firstName`) and
`useSafeAreaInsets()`. Layout, top to bottom, inside one `ScrollView`
(`contentContainerStyle={{ paddingBottom: 120 }}`, which leaves room above the
absolute tab bar, as Profile does):

1. **`Band`** with `color={colors.ink}`, `motif="leaf"`,
   `motifOpacity={BRAND_MOTIF_OPACITY}` and
   `style={{ paddingTop: insets.top + SPACE.md, paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xl, gap: SPACE.md }}`.
   It contains:
   - **A top row** (`flexDirection` per RTL, `justifyContent: 'space-between'`):
     - start side: `todayLabel(lang)` in `rgba(255,255,255,0.78)`, `TYPE.caption`;
     - beside it, `<AiSourceBadge onDark isRTL={isRTL} />`;
     - end side: `<NotificationBell onDark />`.
   - **The greeting:**
     `t(greetingKey(new Date().getHours()), user?.firstName ?? '')` in white,
     `ReadexPro_700Bold`, `TYPE.headline`.
   - **The lesson panel:** a `View` with
     `backgroundColor: 'rgba(255,255,255,0.08)'`,
     `borderColor: 'rgba(255,255,255,0.16)'`, `borderWidth: 1`,
     `borderRadius: RADIUS.lg`, `padding: SPACE.lg`, `gap: SPACE.sm`. It holds:
     - if `periodLine`, a pill with `backgroundColor: colors.accent`, an
       `Ionicons` (`next?.happeningNow ? 'radio-button-on' : 'time-outline'`)
       and `periodLine`, both in `colors.accentForeground`, as the desktop draws
       it;
     - a row with `<JordanFlag width={17} />` and `[subjectLabel, gradeLabel]`
       joined by ' • ', in `rgba(255,255,255,0.78)`, `TYPE.caption`;
     - the lesson title, `topic || t('homeNoLesson')`, in white,
       `ReadexPro_700Bold`, `TYPE.title`;
     - when there is no topic, `t('homeNoLessonHint')` in
       `rgba(255,255,255,0.78)`;
     - a button row (`gap: SPACE.sm`), with two buttons:
       - **«ابدأ الحصة»:** a `PressableScale` with
         `backgroundColor: palette.live`. `palette` is the global import from
         `@/constants/colors`. That is allowed here, because this is not a corner
         file, and the desktop does the same. It has `flex: 1`, `minHeight: 44`
         and `borderRadius: RADIUS.md`, and holds `tv-outline` plus
         `t('startClass')` in white `ReadexPro_600SemiBold`, or an
         `ActivityIndicator` while `startingClass`. It is disabled with
         `opacity: 0.45` when `!topic`, and its `onPress` is `startClass`.
       - **«تغيير الدرس»:** a `PressableScale` ghost button with
         `borderWidth: 1`, `borderColor: 'rgba(255,255,255,0.28)'` and
         `backgroundColor: 'rgba(255,255,255,0.06)'`. It holds `swap-horizontal`
         plus `t('changeLesson')` in white, and its `onPress` is
         `openLessonPicker`.
2. **A content column** (`padding: SPACE.lg`, `gap: SPACE.lg`). Each section
   is wrapped in `<Entrance index={i}>`, `i` counting from 0:
   - **The setup nudge.** The same condition and content as the desktop:
     `setup && !nudgeDismissed && classes.length > 0`, with the
     `homeSetupTimetable` / `homeSetupPlan` text and button and the close
     button calling `dismissNudge`. Draw it on `colors.secondary` with
     `borderRadius: RADIUS.md`. Copy the routes exactly from the desktop:
     `/schedule`, or `/teaching-plans` with `classId`/`subjectId`.
   - **The start error.** The same as the desktop, when `startClassError`.
   - **The prep card.** A `<Surface style={{ padding: SPACE.lg }}>` around
     `LessonPrepBoard`, with exactly the desktop's props. Copy the whole prop
     list from `index.tsx`, including `onOpen`, `onMake` (using `toolParams`),
     `onToggleSkip`, `classLabelFor` and `onOpenAll`.
   - **Quick tools.** A heading, `t('homeQuickTools')`, then a row of the four
     `quickTools`. Each is a `PressableScale` with `[styles.tool, surface]`
     (`flex: 1`, `alignItems: 'center'`, `gap: SPACE.sm`,
     `paddingVertical: SPACE.md`, `paddingHorizontal: SPACE.xs`) and
     `onPress={() => router.push({ pathname: tool.route as never, params: toolParams as never })}`.
     It holds an icon tile (`tool.color + '1A'` background, `tool.icon` in
     `tool.color`) and `t(tool.titleKey as never)` with `numberOfLines={2}`,
     centred, `TYPE.caption`.
   - **The ask card.** A `<Surface style={{ padding: SPACE.lg, gap: SPACE.md }}>`
     containing:
     - a row with `<IqraaMark size={28} tone="soft" />`, `t('homeAssistant')`
       and, below it, the hint
       `topic ? t('homeAssistantTiedToLesson') : t('homeNoLesson')`;
     - up to two `suggestions` as `PressableScale` chips (background
       `colors.background`, `borderRadius: RADIUS.md`), each calling `ask(sug)`;
     - a composer row: a `TextInput` (local state, `placeholder`
       `t('homeAskPlaceholder')`, `onSubmitEditing` sends) and a send button
       (`colors.primary` fill with a `primaryForeground` arrow when there is
       text, else `colors.muted` with a `mutedForeground` arrow). Sending calls
       `ask(text)` and clears the input;
     - `«افتح المحادثة»` (`t('homeOpenChat')`) in `colors.primary`, calling
       `router.push('/iqra')`.
   - **Classes.** The heading `t('homeMyClasses')`, then either
     `t('homeNoClasses')` or up to six class chips, the same as the desktop,
     going to `/classes/[id]`.

Write a short header comment saying what the screen is, that it shares
`useTodayLesson` with the desktop, that it pays `insets.top` because Today has
no lesson bar above it, and that amber is only on Start class and the
period-now pill.

All styles use `TYPE`/`SPACE`/`RADIUS`. Use no hard-coded colour except the
white and translucent-white text on the navy band, and `palette.live`.

- [ ] **Step 4: Wire the router and the tab layout**

In `app/(tabs)/index.tsx`, change the teacher branch to:

```tsx
  if (isTeacherRole(user.role)) {
    return isDesktop ? <LessonWorkspace /> : <PhoneToday />;
  }
```

Import `PhoneToday` from `@/components/today/PhoneToday`, and drop
`Redirect` from the import only if nothing else uses it. The non-teacher
`<Redirect>` below still does. Update the comment above `LessonWorkspace` if it
says a phone teacher goes to the chat.

In `app/(tabs)/_layout.tsx`:
- **`buildTabEntries`.** Import `tabVisible`, `showLessonBar` and `type
  TabName` from `@/services/tabVisibility`. Type each entry's `name` as
  `TabName` and set
  `visible: tabVisible('<name>', { isTeacher, isDesktop })` for every entry.
  - Keep the entries' order. On a phone it gives Today, Library, Tools,
    Messages, Profile for a teacher.
  - Update the `index` entry's comment: Today is now the teacher's landing on
    both sizes.
  - Update the `iqra` entry's comment: desktop sidebar only; on phones the
    route stays (hidden) and Today's ask card opens it.
- **The comment above `tabEntries.map`** (the "Landing" block). Say that
  `index` is Today for a teacher on any size, and forwards a parent or student
  (see `index.tsx`).
- **The desktop bar** becomes
  `const bar = showLessonBar(pathname, { isTeacher, isDesktop }) ? (<GlobalLessonBar … />) : null;`
  This replaces `onWorkspaceHome` and the inline condition. Delete
  `onWorkspaceHome`.
- **The phone bar.** For a teacher:
  `showLessonBar(pathname, { isTeacher, isDesktop }) ? <GlobalLessonBar layout="bar" topInset={insets.top} trailing={bell} {...lessonProps} /> : null`.
  The parent/student slim header is unchanged. Update the comments that say
  "Not on iQra itself" to "Not on iQra or Today".

- [ ] **Step 5: Verify**

Run: `cd artifacts/mobile && node --test services/__tests__/tabVisibility.test.ts`
Expected: all pass.

Run `pnpm test` (in `artifacts/mobile`) and `pnpm run typecheck` (repo root).
Expected: all pass and clean. Fix any `designScale` regression by using scale
values.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/components/today/PhoneToday.tsx "artifacts/mobile/app/(tabs)/index.tsx" "artifacts/mobile/app/(tabs)/_layout.tsx" artifacts/mobile/components/ui/NotificationBell.tsx artifacts/mobile/services/i18n.ts artifacts/mobile/services/__tests__/tabVisibility.test.ts
git commit -m "$(cat <<'EOF'
Today on phones: teachers open on the lesson, prep and Start class

A phone teacher lands on Today: a navy leaf band with the greeting and the
lesson (amber Start class, Change lesson), the prep checklist, quick tools,
an ask card that opens the chat with the question sent, and their classes.
The chat leaves the phone tab bar (its route stays); the lesson bar steps
aside on Today; the bell moves into Today's band.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
EOF
)"
```

---

### Task 4: Friendlier empty states

**Files:**
- Modify: `artifacts/mobile/components/ui/EmptyState.tsx`
- Modify: `artifacts/mobile/app/(tabs)/school.tsx`:
  - the `hwEmpty` block, lines ~297-309;
  - the `empty` block, lines ~405-417;
  - the styles `hwEmpty`, `empty` and `emptyIcon`.
- Test: create `artifacts/mobile/services/__tests__/emptyState.test.ts`

**Interfaces:**
- Consumes: `useSurface` (PR 3).
- Produces:
  `EmptyState({ icon, title, body?, action?, style? })`. `style` is optional
  and applies to the outer wrapper. The other props are unchanged, so the five
  existing callers compile untouched.

- [ ] **Step 1: Write the failing test**

`artifacts/mobile/services/__tests__/emptyState.test.ts`:

```ts
// The empty state is one shared card; School's hand-drawn ones moved onto it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

test('EmptyState is a lifted surface with its icon on a tinted circle', () => {
  const src = read('components', 'ui', 'EmptyState.tsx');
  assert.match(src, /\buseSurface\(/, 'EmptyState is not a surface');
  assert.match(src, /colors\.secondary/, 'the icon does not sit on the secondary tint');
});

test('School draws its empty homework and empty timetable with EmptyState', () => {
  const src = read('app', '(tabs)', 'school.tsx');
  assert.equal((src.match(/<EmptyState\b/g) ?? []).length, 2, 'school.tsx should use EmptyState for both empty sections');
  assert.doesNotMatch(src, /styles\.emptyIcon/, 'school.tsx still draws its own empty icon');
});
```

Run: `cd artifacts/mobile && node --test services/__tests__/emptyState.test.ts`
Expected: FAIL ("EmptyState is not a surface").

- [ ] **Step 2: Rebuild `EmptyState`**

```tsx
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { useSurface } from './Surface';
import { Button } from './Button';

/**
 * What a list says when it has nothing in it yet: a lifted card with the icon
 * on a tinted circle, one line on what is missing, one on what it is for, and —
 * when there is one — the action that fills it.
 *
 * Four screens drew this with the same three hand-copied styles, and none of
 * them offered the action until the 2026-10-08 review added a button to each
 * by hand. A new list starts here instead. Since 2026-10-22 it is a card
 * (useSurface) rather than bare text on the page, and School's two hand-drawn
 * empties use it too.
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  /** The outer wrapper: a screen that already pads its section passes `{ paddingTop: 0, paddingHorizontal: 0 }`. */
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const surface = useSurface();
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.card, surface]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
          <Ionicons name={icon} size={30} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {body ? <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text> : null}
        {action ? <Button label={action.label} onPress={action.onPress} style={{ marginTop: SPACE.sm }} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: SPACE.section, paddingHorizontal: SPACE.lg, alignItems: 'center' },
  card: { width: '100%', maxWidth: 420, alignItems: 'center', gap: SPACE.sm, paddingVertical: SPACE.xxl, paddingHorizontal: SPACE.xl },
  iconCircle: { width: 64, height: 64, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center', marginBottom: SPACE.xs },
  title: { fontSize: TYPE.bodyLg, fontFamily: 'ReadexPro_600SemiBold', textAlign: 'center' },
  body: { fontSize: TYPE.body, lineHeight: 24, maxWidth: 300, fontFamily: 'Almarai_400Regular', textAlign: 'center' },
});
```

Check `colors.primary` on `colors.secondary` against `cornerTheme.test.ts`.
The corner tokens are measured there, and the global teal pair is
`#006D65`/the palette's `secondary`. If you can, compute the palette's pair:
it must be at least 3:1 for an icon. Report the ratio, and if it is short use
`colors.secondaryForeground` for the icon.

- [ ] **Step 3: Move School's two empties onto it**

In `app/(tabs)/school.tsx`:
- Replace the `hwEmpty ? (<View style={styles.hwEmpty}>…</View>) : null`
  block with:
  `hwEmpty ? <EmptyState icon="book-outline" title={t('hwEmptyTitle')} body={t(isParent ? 'hwEmptyDescParent' : 'hwEmptyDesc')} style={{ paddingTop: 0, paddingHorizontal: 0 }} /> : null`
- Replace the `empty ? (<View style={styles.empty}>…</View>) : null` block
  with:
  `empty ? <EmptyState icon="calendar-outline" title={t('schoolEmptyTitle')} body={t(isParent ? 'schoolEmptyDescParent' : 'schoolEmptyDesc')} style={{ paddingTop: 0, paddingHorizontal: 0 }} /> : null`
- Import `EmptyState` from `@/components/ui/EmptyState`. Delete the
  `hwEmpty`, `empty` and `emptyIcon` styles, and any import that becomes
  unused (perhaps `ACCENT` or `Ionicons`; check before removing).

- [ ] **Step 4: Verify**

Run: `cd artifacts/mobile && node --test services/__tests__/emptyState.test.ts`
Expected: PASS.

Run `pnpm test` and `pnpm run typecheck`. Expected: all pass and clean.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/components/ui/EmptyState.tsx "artifacts/mobile/app/(tabs)/school.tsx" artifacts/mobile/services/__tests__/emptyState.test.ts
git commit -m "$(cat <<'EOF'
Empty states are a lifted card with the icon on a tinted circle

EmptyState becomes a surface; School's empty homework and empty timetable
use it instead of drawing their own.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
EOF
)"
```

---

### Task 5: A coloured two-column Tools grid on phones, and the docs

**Files:**
- Modify: `artifacts/mobile/app/(tabs)/ai-tools.tsx`:
  - `ToolCard`, around lines 60-170;
  - the list, around lines 213-219;
  - the styles.
- Modify: `STATUS.md`. Add a section after "Cards lift, presses give, screens
  arrive — 2026-10-21", and correct the line around 18221 that says
  `(tabs)/index.tsx` is a `<Redirect href="/iqra">`. Leave the history, but add
  "(until 2026-10-22: a phone teacher now lands on Today)".
- Modify: `CLAUDE.md`. Append one sentence to the "Cards, presses, entry
  motion and bands are shared pieces" bullet.
- Test: create `artifacts/mobile/services/__tests__/toolsGrid.test.ts`

**Interfaces:**
- Consumes: `useSurface`, `PressableScale` (PR 3).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

`artifacts/mobile/services/__tests__/toolsGrid.test.ts`:

```ts
// The Tools tab is one grid of lifted, coloured cards on every size, with no section headings
// (dropped on purpose on 2026-09-25).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(root, 'app', '(tabs)', 'ai-tools.tsx'), 'utf8');

test('the tools are lifted cards that give when pressed', () => {
  assert.match(src, /<PressableScale\b/, 'ToolCard is not PressableScale');
  assert.match(src, /\buseSurface\(/, 'ToolCard does not take useSurface()');
});

test('phones get the grid card too, not the old row', () => {
  assert.doesNotMatch(src, /grid=\{isDesktop\}/, 'the grid card is still desktop-only');
});

test('no section headings came back', () => {
  assert.doesNotMatch(src, /toolsBeforeClass|toolsDuringClass|toolsAfterClass/, 'the before/during/after headings were dropped on purpose');
});
```

Run: `cd artifacts/mobile && node --test services/__tests__/toolsGrid.test.ts`
Expected: FAIL ("ToolCard is not PressableScale").

- [ ] **Step 2: Make the grid card the only card**

In `app/(tabs)/ai-tools.tsx`:
- **`ToolCard`.** Render the grid card (the existing `if (grid)` branch) for
  every tool, and delete the row branch and the `grid`/`compact` props if
  nothing else uses them. Check the whole file before deleting.
  - Its `Pressable` becomes `PressableScale`, with a plain style array
    `[styles.gridCard, surface]` (no callback).
  - Call `const surface = useSurface();` at the top of `ToolCard`.
  - Delete `borderWidth`, `borderColor`, any inline `borderRadius` and the
    pressed opacity from the card. Delete `borderWidth: 1` and `borderRadius`
    from `styles.gridCard`.
  - Keep every existing prop and handler: `onPress` → `runToolAction`,
    accessibility props, the badge and the desc.
- **The list.** Pass no `grid` prop. The list always uses the grid layout:
  - phone: two columns. Each card's wrapper or card gets `flexBasis: '46%'`,
    `flexGrow: 1`, with the list `flexDirection` per RTL, `flexWrap: 'wrap'`
    and `gap: SPACE.md`;
  - desktop: the current `listGrid` columns.

  Use the existing `styles.listGrid` for desktop and add a phone variant (for
  example `listGridPhone`). Keep `TAB_TOOLS` order.
- Leave the header and the `DEMO_MODE` note unchanged.

- [ ] **Step 3: Docs**

`CLAUDE.md`: append to the end of the "Cards, presses, entry motion and bands
are shared pieces" bullet, before its "Amber" sentence:

```markdown
  A teacher's phone lands on Today (`components/today/PhoneToday.tsx`), which
  shares `useTodayLesson()` with the desktop workspace — change the lesson
  logic there, never in one layout; tab visibility and the lesson-bar rule live
  in `services/tabVisibility.ts`.
```

`STATUS.md`: after the "Cards lift, presses give, screens arrive —
2026-10-21" section, at the same heading level, add:

```markdown
## Teachers' phones open on Today — 2026-10-22

- **Today on phones.** A teacher on a phone now lands on Today instead of the
  chat. It has a navy leaf band with the date, the bell, a greeting and the
  lesson (amber «ابدأ الحصة», «تغيير الدرس»), then the prep checklist, four
  quick tools, an ask card that opens the chat with the question already sent,
  and their classes.
- **One logic, two layouts.** The desktop workspace and the phone Today share
  `useTodayLesson()`, so they always name the same lesson.
- **Tab bar.** The phone tab bar is Today, Library, Tools, Messages, Profile.
  The chat leaves it, but its route stays, and the desktop sidebar keeps it
  (`services/tabVisibility.ts`).
- **No lesson bar on Today.** The lesson bar is hidden on Today (both sizes),
  as on the chat.
- **Empty states.** `EmptyState` is a lifted card with the icon on a tinted
  circle; School's two empties use it.
- **Tools.** The Tools tab is a two-column grid of coloured, lifted cards on
  phones, with no section headings.
```

Then correct the old line around 18221. It says `(tabs)/index.tsx` is now a
`<Redirect href="/iqra">`. Append " (until 2026-10-22, when a phone teacher
started landing on Today)" so the history stays true.

- [ ] **Step 4: Verify**

Run: `cd artifacts/mobile && node --test services/__tests__/toolsGrid.test.ts`
Expected: PASS.

Run `pnpm test` and `pnpm run typecheck`. Expected: all pass and clean.

- [ ] **Step 5: Commit**

```bash
git add "artifacts/mobile/app/(tabs)/ai-tools.tsx" artifacts/mobile/services/__tests__/toolsGrid.test.ts CLAUDE.md STATUS.md
git commit -m "$(cat <<'EOF'
Tools: a coloured two-column grid of lifted cards on phones; document Today

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
EOF
)"
```

---

## After the tasks (controller)

- **Screenshot pass.**
  - Phone Today and desktop Today, light and dark. The desktop must look as
    before.
  - The Tools tab, phone and desktop.
  - School empty, as a stubbed student.
  - Classes and evaluations empty.

  Extend `e2e/screens.mjs` with `today` (`/`), `tools` (`/ai-tools`),
  `classes` (`/classes`) and `evaluations` (`/evaluations`). Stubbed lists are
  already `[]`.
- **Final review.** Run a whole-branch review, then open the PR.
