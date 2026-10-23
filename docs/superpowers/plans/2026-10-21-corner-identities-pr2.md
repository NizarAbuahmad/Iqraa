# Corner Identities — PR 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the English corner (coral orange, speech bubbles) and the games hub (magenta, confetti) onto the corner system that PR 1 (#1167) built for Math, Lab and Quran, and close the items PR 1 carried over.

**Architecture:** There is no new mechanism. A `_layout.tsx` per directory mounts `CornerThemeProvider`, and the screens move onto `CornerFrame`/`CornerGrid`. `CornerFrame` gains four small optional props, because these screens need them: a line above the title, a custom back action, no back button, and keyboard taps that persist. The two non-tiled motifs become tiled patterns, as the math wave did in PR 1. The PR 1 leftovers close here: the shims are deleted, `CornerTokens` is pinned to the palette's keys, the palette-import guard is loosened and extended, and the English library tile gets its colour.

**Tech Stack:** Expo Router (nested `Stack`), React Native + react-native-web, `react-native-svg` 15, `node --test` with `--experimental-strip-types`, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-10-21-corner-identities-design.md` (Sections 4–5 and 7–8, PR 2 row). PR 1's merged state is on `main` at `0596eea`.

## Global Constraints

- Every text/background pair must measure ≥ 4.5:1 (`contrast()` in `services/readableColor.ts`). `cornerTheme.test.ts` already measures every corner's tokens in both schemes, including English (`hero` `#9A3412` light and dark) and play.
- **Text on a `colors.primary` fill is `colors.primaryForeground`, never `'#fff'`.** In dark mode a corner's primary is a light 300-level shade with navy text on it. White on English's dark primary `#FDBA74` is about 1.9:1. The same pair already fails today on the teal dark primary `#2DD4BF`, so this fix is overdue anyway.
- Corner code takes colours from `useColors()`, never from the global `palette`. That applies whether `palette` is read at module scope or inside render.
- Files that `node --test` reads import nothing from `react-native`, `expo-*` or `constants/colors.ts`. Relative imports in tests carry `.ts`.
- New styles use only `TYPE`/`SPACE`/`RADIUS` (`designScale.test.ts` is a ratchet: it must not grow, and moving a literal onto the scale lowers it, which is fine).
- Arabic UI, RTL-first: `isRTL` decides between `row` and `row-reverse` and sets `textAlign`.
- No native module changes, so no `app.json` `version` bump.
- The library (`/curriculum/resources`) and the browser stay teal. Only their English entry points borrow English's colour.
- The per-game colours stay: the `GAMES[].color` icons on the games grid, and each game's own `ACCENT`/`GameShell` band inside `/play/<game>`. Only the hub's band and the hub's own chrome take the play hue.
- Commit after every task. Each message ends with the session's two attribution lines (`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` then the `Claude-Session:` line). Before every commit, run `pnpm typecheck` and `pnpm test` from `artifacts/mobile`.

---

### Task 1: `CornerFrame` grows four props; motifs tile; tokens pinned; shims gone

**Files:**
- Modify: `artifacts/mobile/components/corners/CornerFrame.tsx`
- Modify: `artifacts/mobile/components/corners/CornerMotif.tsx` (`bubbles`, `confetti`)
- Modify: `artifacts/mobile/hooks/useColors.ts`
- Delete: `artifacts/mobile/components/math/MathFrame.tsx`, `artifacts/mobile/components/lab/LabFrame.tsx`

**Interfaces:**
- Produces: `CornerFrame({ title, subtitle?, eyebrow?, onBack?, hideBack?, keyboardShouldPersistTaps?, bandChildren?, children })`. All existing props and behaviour are unchanged when the new props are omitted.

- [ ] **Step 1: Confirm the shims are dead before deleting them**

Run (from `artifacts/mobile`): `grep -rn "components/math/MathFrame\|components/lab/LabFrame\|from './MathFrame'\|from './LabFrame'" app components services | grep -v "^components/math/MathFrame.tsx\|^components/lab/LabFrame.tsx"`
Expected: no output. If anything prints, re-point it to `@/components/corners/CornerFrame` first.

- [ ] **Step 2: Delete both shims**

```bash
git rm artifacts/mobile/components/math/MathFrame.tsx artifacts/mobile/components/lab/LabFrame.tsx
```

- [ ] **Step 3: Add the four props to `CornerFrame`**

In `components/corners/CornerFrame.tsx`, replace the `Props` type and the function signature with:

```tsx
type Props = {
  title: string;
  subtitle?: string;
  /** A short line above the title — the English lesson's «grade · unit». */
  eyebrow?: string;
  /** Replaces the back button's default (`goBack()`, which falls back to `/`). Public pages need their own fallback. */
  onBack?: () => void;
  /** The games hub is an entry point with nowhere to go back to. */
  hideBack?: boolean;
  /** Pass `'handled'` on screens with text inputs, so a tap on a button does not first just close the keyboard. */
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  /** Rendered inside the band under the subtitle — a streak line, a switch. */
  bandChildren?: React.ReactNode;
  children: React.ReactNode;
};

export function CornerFrame({ title, subtitle, eyebrow, onBack, hideBack, keyboardShouldPersistTaps, bandChildren, children }: Props) {
```

Inside `heroInner`, replace the `BackButton` line and the title `Text` with:

```tsx
          {hideBack ? null : (
            <BackButton color="#fff" onPress={onBack} style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: SPACE.sm }} />
          )}
          {eyebrow ? (
            <Text style={[styles.eyebrow, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>{eyebrow}</Text>
          ) : null}
          <Text style={[styles.title, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>{title}</Text>
```

On the `ScrollView`, add `keyboardShouldPersistTaps={keyboardShouldPersistTaps}`. In `styles`, add after `title`:

```ts
  eyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: TYPE.caption, marginBottom: SPACE.xs },
```

The eyebrow uses the same 0.85 white as the subtitle, and `cornerTheme.test.ts` already measures that pair on every hero.

- [ ] **Step 4: Tile the bubbles and the confetti**

In `components/corners/CornerMotif.tsx`, replace the `bubbles` and `confetti` entries. Both become one 420-wide tile repeated across the band, as the math wave did, so a 1366px band is not bunched at one end:

```tsx
  // Tiled like the math wave: one 420×170 tile repeated, so a wide band is
  // covered evenly instead of bunched at its left end.
  bubbles: id => (
    <>
      <Defs>
        <Pattern id={id} width={420} height={170} patternUnits="userSpaceOnUse">
          <G fill="none" stroke="#fff" strokeWidth={2}>
            <Rect x={20} y={30} width={90} height={46} rx={14} />
            <Path d="M40 76 l-8 14 l22 -14" />
            <Rect x={250} y={95} width={110} height={50} rx={16} />
            <Path d="M340 145 l8 14 l-22 -14" />
            <Rect x={150} y={10} width={70} height={36} rx={12} />
          </G>
          <SvgText x={55} y={63} fill="#fff" fontFamily="ReadexPro_700Bold" fontSize={22}>Hi!</SvgText>
          <SvgText x={275} y={130} fill="#fff" fontFamily="ReadexPro_700Bold" fontSize={22}>Hello</SvgText>
          <SvgText x={165} y={36} fill="#fff" fontFamily="ReadexPro_700Bold" fontSize={18}>ABC</SvgText>
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </>
  ),
```

```tsx
  confetti: id => (
    <>
      <Defs>
        <Pattern id={id} width={420} height={170} patternUnits="userSpaceOnUse">
          <G fill="#fff">
            <Circle cx={30} cy={40} r={5} />
            <Circle cx={90} cy={120} r={4} />
            <Circle cx={330} cy={30} r={6} />
            <Circle cx={280} cy={140} r={4} />
            <Rect x={150} y={20} width={10} height={10} transform="rotate(20 155 25)" />
            <Rect x={230} y={90} width={9} height={9} transform="rotate(-15 234 94)" />
            <Rect x={60} y={150} width={8} height={8} transform="rotate(35 64 154)" />
            <Path d="M350 100 l6 12 l13 2 l-9 9 l2 13 l-12 -6 l-12 6 l2 -13 l-9 -9 l13 -2z" />
            <Path d="M190 130 l5 10 l11 2 l-8 8 l2 11 l-10 -5 l-10 5 l2 -11 l-8 -8 l11 -2z" />
            <Path d="M110 60 l4 8 l9 1 l-6 6 l1 9 l-8 -4 l-8 4 l1 -9 l-6 -6 l9 -1z" />
          </G>
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </>
  ),
```

- [ ] **Step 5: Pin `CornerTokens` to the palette's keys**

In `hooks/useColors.ts`, add these lines below the imports. They are compile-time only, with no runtime cost:

```ts
import type { CornerTokens } from '@/constants/corners';
import type { Palette } from '@/constants/colors';

// `CornerTokens` is spelled out in constants/corners.ts (it cannot import
// constants/colors.ts, which `node --test` cannot load). This fails the
// typecheck if a palette key it overrides is ever renamed, instead of the
// corner silently spreading a stray key.
const _cornerKeysArePaletteKeys: Pick<Palette, keyof CornerTokens> = {} as CornerTokens;
void _cornerKeysArePaletteKeys;
```

- [ ] **Step 6: Typecheck and test**

Run: `pnpm typecheck && pnpm test 2>&1 | grep -E "cornerTheme|designScale|^# (pass|fail)"`
Expected: clean, `# fail 0`. Nothing is wired newly yet. Math, Lab and Quran look unchanged because they pass none of the new props.

- [ ] **Step 7: Commit**

```bash
git add -A artifacts/mobile/components/corners artifacts/mobile/hooks/useColors.ts artifacts/mobile/components/math artifacts/mobile/components/lab
git commit -m "feat(corners): CornerFrame takes an eyebrow, a back action and no-back; bubbles and confetti tile; shims removed"
```

---

### Task 2: The English corner in coral

**Files:**
- Create: `artifacts/mobile/app/curriculum/english/_layout.tsx`
- Modify: `artifacts/mobile/app/_layout.tsx` (lines 210–211)
- Modify: `artifacts/mobile/app/curriculum/english/index.tsx`
- Modify: `artifacts/mobile/app/curriculum/english/[lessonId].tsx`
- Modify: `artifacts/mobile/components/englishHub/Activities.tsx`, `artifacts/mobile/components/englishHub/GrammarActivities.tsx` (`primaryText` colour)
- Modify: `artifacts/mobile/app/curriculum/resources.tsx` (English tile), `artifacts/mobile/app/curriculum/browse.tsx` (English banner)
- Test: `artifacts/mobile/services/__tests__/cornerTheme.test.ts`

**Interfaces:**
- Consumes: `CornerFrame` with `eyebrow`/`onBack`/`keyboardShouldPersistTaps`/`bandChildren` (Task 1), `CornerGrid`, `CornerThemeProvider`.

- [ ] **Step 1: Make the tests ask for English**

In `cornerTheme.test.ts`:
1. Set `WIRED` to `['math', 'lab', 'quran', 'english']`, with the comment `/** Corners wired so far. Task 3 adds 'play'. */`.
2. In the import-guard test's `dirs`, add `join(root, 'components', 'englishHub')`.
3. In the library-tiles test, iterate `['english', 'lab', 'math', 'quran']` and expect **2** `ACCENT + '1F'` occurrences. Update the comment and message to «only the curriculum tile and the student/parent «my exams» tile keep the teal icon tint».

Add this test after the library-tiles test:

```ts
test('text on a primary fill in the English corner is primaryForeground, not white', () => {
  // In dark mode a corner's primary is a light 300-level shade with navy text on it;
  // white there is ~1.9:1 on English's #FDBA74.
  const dirs = [routeDir('english'), join(root, 'components', 'englishHub')];
  for (const d of dirs) {
    for (const f of files(d)) {
      const src = readFileSync(f, 'utf8');
      assert.doesNotMatch(src, /primaryText:\s*\{[^}]*color:\s*'#fff'/, `${f}: primaryText is white; use colors.primaryForeground`);
      assert.doesNotMatch(src, /color:\s*on\s*\?\s*'#fff'/, `${f}: a selected chip's text is white; use colors.primaryForeground`);
    }
  }
});
```

- [ ] **Step 2: Run to see it fail**

Run: `pnpm test 2>&1 | grep -E "not ok|missing|white|teal" | head`
Expected: the test fails on `english: …/_layout.tsx missing` and on the white-text test. The tiles test fails on `english tile does not read its corner look`.

- [ ] **Step 3: Add the layout and collapse the root entries**

```tsx
// artifacts/mobile/app/curriculum/english/_layout.tsx
import { Stack } from 'expo-router';
import { CornerThemeProvider } from '@/context/CornerTheme';

/** Every screen under /curriculum/english takes the English corner's hue (constants/corners.ts). */
export default function EnglishCornerLayout() {
  return (
    <CornerThemeProvider corner="english">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </CornerThemeProvider>
  );
}
```

In `app/_layout.tsx`, replace the two lines

```tsx
      <Stack.Screen name="curriculum/english/index" options={{ headerShown: false }} />
      <Stack.Screen name="curriculum/english/[lessonId]" options={{ headerShown: false }} />
```

with

```tsx
      <Stack.Screen name="curriculum/english" options={{ headerShown: false }} />
```

The directory is now a nested navigator, so its screens are the layout's children. The root sees one route named `curriculum/english`.

- [ ] **Step 4: The hub onto `CornerFrame` + `CornerGrid`**

In `app/curriculum/english/index.tsx`, replace everything from `return (` to the end of the component (the closing `);` before `}`) with:

```tsx
  return (
    <CornerFrame
      title={t('hubTitle')}
      subtitle={t('hubIntro')}
      // Public page: with no history, `goBack()`'s fallback is `/`, which sends a
      // visitor with no account to the login screen. `/play` is where they came from.
      onBack={() => (router.canGoBack() ? goBack() : router.replace('/play' as never))}
      bandChildren={
        <>
          {streak > 0 ? <Text style={[styles.streak, { textAlign: align }]}>{t('hubStreak', streak)}</Text> : null}
          <View style={[styles.goalRow, { flexDirection: row }]}>
            <Ionicons name={practicedToday ? 'checkmark-circle' : 'ellipse-outline'} size={16} color="#fff" />
            <Text style={styles.bandText}>{t(practicedToday ? 'hubDailyGoalDone' : 'hubDailyGoalTodo')}</Text>
          </View>
          {Platform.OS !== 'web' ? (
            <View style={[styles.goalRow, { flexDirection: row }]}>
              <Switch value={reminderOn} onValueChange={v => void toggleReminder(v)} trackColor={{ false: 'rgba(255,255,255,0.3)', true: '#fff' }} thumbColor={colors.hero} />
              <Text style={[styles.bandText, { flexShrink: 1 }]}>{t('hubRemindMe')}</Text>
            </View>
          ) : null}
        </>
      }
    >
      {/* Only badges already earned show — an empty row for a brand-new student
          would read as "here are seven things you haven't done", not encouragement. */}
      {earned.size > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.badgeRow, { flexDirection: row }]}>
          {BADGE_IDS.filter(b => earned.has(b)).map(b => (
            <View key={b} style={[styles.badge, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name={BADGE_META[b].icon} size={16} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 12 }}>{t(BADGE_META[b].label)}</Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.chips, { flexDirection: row }]}>
        {ENGLISH_HUB_GRADES.map(g => {
          const on = g === grade;
          return (
            <Pressable
              key={g}
              onPress={() => setGrade(g)}
              accessibilityRole="button"
              aria-selected={on}
              style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : colors.card }]}
            >
              <Text style={{ color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>
                {t('hubGrade', g)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <CornerGrid>
        {lessons.map(l => {
          const stars = lessonStars(progress, l.id);
          const names = unitNames({ name: l.unitTitle, nameAr: l.unitTitleAr }, 'english', lang);
          return (
            // Titled by unit, not lesson: every Grade 1–4 hub lesson is the
            // unit's "Vocabulary & Grammar" one, so the lesson title tells a
            // child nothing and the unit title ("Look at my toys!") does —
            // in English, as the book prints it (`unitNames`).
            <Pressable
              key={l.id}
              onPress={() => router.push({ pathname: '/curriculum/english/[lessonId]', params: { lessonId: l.id } } as never)}
              style={({ pressed }) => [
                styles.card,
                { flexDirection: row, backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.unit, { color: colors.mutedForeground, textAlign: align }]}>{t('hubUnit', l.unitNumber)}
                  {(perUnit.get(unitKey(l)) ?? 0) > 1 ? ` · ${lang === 'ar' ? l.titleAr || l.title : l.title}` : ''}
                </Text>
                <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: align }} numberOfLines={2}>
                  {names.title}
                </Text>
                {names.gloss ? (
                  <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }} numberOfLines={1}>
                    {names.gloss}
                  </Text>
                ) : null}
                <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
                  {t('hubWords', l.words.length)} · {l.words.slice(0, 4).map(w => w.en).join(', ')}…
                </Text>
              </View>
              {stars > 0 ? (
                <Text style={{ fontSize: TYPE.caption, color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }}>⭐ {stars}</Text>
              ) : null}
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />
            </Pressable>
          );
        })}
      </CornerGrid>
    </CornerFrame>
  );
```

Replace `styles` with:

```ts
const styles = StyleSheet.create({
  streak: { color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, marginTop: SPACE.sm },
  goalRow: { alignItems: 'center', gap: 6, marginTop: SPACE.sm },
  bandText: { color: '#fff', fontFamily: 'Almarai_400Regular', fontSize: TYPE.body },
  badgeRow: { gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACE.md, paddingVertical: 6 },
  chips: { flexWrap: 'wrap', gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingTop: SPACE.md },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 7 },
  unit: { fontFamily: 'ReadexPro_600SemiBold', fontSize: 12 },
  card: { alignItems: 'center', gap: 10, borderWidth: 1, padding: 14, flexGrow: 1 },
});
```

The literals kept here (`6`, `7`, `10`, `12`, `14`) were already in the file, so the design-scale count does not rise. Imports:
- Add `import { CornerFrame } from '@/components/corners/CornerFrame';`, `import { CornerGrid } from '@/components/corners/CornerGrid';` and `import { RADIUS, SPACE, TYPE } from '@/constants/theme';`.
- Remove the now-unused `useSafeAreaInsets` import and its `insets` line, and the `BackButton` import.

- [ ] **Step 5: The lesson screen onto `CornerFrame`**

In `app/curriculum/english/[lessonId].tsx`, replace the final `return (` … `);` of the component (the one rendering `styles.header`) with:

```tsx
  return (
    <CornerFrame
      eyebrow={`${t('hubGrade', lesson.grade)} · ${t('hubUnit', lesson.unitNumber)}`}
      title={activity ? t(META[activity].title) : unitNames({ name: lesson.unitTitle, nameAr: lesson.unitTitleAr }, 'english', lang).title}
      onBack={back}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.body}>{body()}</View>
    </CornerFrame>
  );
```

In `styles`:
- Delete `header`, `backBtn`, `eyebrow` and `title`.
- Add `body: { padding: SPACE.xl },`.
- Change `primaryText` to `primaryText: { fontFamily: 'ReadexPro_700Bold', fontSize: 16 },`.
- At its single use, `<Text style={styles.primaryText}>`, make it `<Text style={[styles.primaryText, { color: colors.primaryForeground }]}>`.

Imports:
- Add `CornerFrame` and `import { SPACE } from '@/constants/theme';`.
- Remove `useSafeAreaInsets`/`insets` and `ScrollView` if they are no longer used.

The not-found branch (`if (!lesson)`) stays as it is.

- [ ] **Step 6: White on primary → `primaryForeground` in the activities**

In `components/englishHub/Activities.tsx` and `components/englishHub/GrammarActivities.tsx`:
- Remove `color: '#fff'` from `styles.primaryText`.
- At every `<Text style={styles.primaryText}>`, make the style `[styles.primaryText, { color: colors.primaryForeground }]`. `colors` is already in scope in each component that renders it. If one is not, add `const colors = useColors();` at the top of that component.
- Leave `Activities.tsx`'s mic icon (`'#fff'` on the red `WRONG` while recording) as it is: that is white on red, not on primary.

- [ ] **Step 7: The English tile and the browse banner**

In `app/curriculum/resources.tsx`, in the English tile:
- Delete the comment line `{/* The English corner is not themed until PR 2, … */}`.
- Replace `<View style={[styles.tileIcon, { backgroundColor: ACCENT + '1F' }]}>` with `<View style={[styles.tileIcon, { backgroundColor: cornerLook('english').secondary }]}>`.
- Replace `<Ionicons name="headset" size={26} color={ACCENT} />` with `<Ionicons name="headset" size={26} color={cornerLook('english').primary} />`.

In `app/curriculum/browse.tsx`:
- Add `import { scheme } from '@/constants/colors';` and `import { CORNERS } from '@/constants/corners';`.
- In the `styles.hubBanner` pressable, replace `backgroundColor: colors.hero` with `backgroundColor: CORNERS.english[scheme].hero`.

The browser is not a corner. Only this banner, which opens the English corner, takes its colour, the same way the library tiles do.

Leave the «open in the English corner» link in `app/curriculum/lesson-detail.tsx` on its subject colour (`colorFill`). It sits inside a lesson page already painted in that subject's colour, and a coral button there would compete with the page's own header. Task 5 amends the spec's Section 5 to match.

- [ ] **Step 8: Typecheck and test**

Run: `pnpm typecheck && pnpm test 2>&1 | grep -E "cornerTheme|designScale|^# (pass|fail)"`
Expected: clean, `# fail 0`.

- [ ] **Step 9: Commit**

```bash
git add -A artifacts/mobile/app/curriculum/english artifacts/mobile/app/_layout.tsx artifacts/mobile/components/englishHub artifacts/mobile/app/curriculum/resources.tsx artifacts/mobile/app/curriculum/browse.tsx artifacts/mobile/services/__tests__/cornerTheme.test.ts
git commit -m "feat(english-corner): coral identity — provider layout, CornerFrame, hub grid; primary text readable in dark mode"
```

---

### Task 3: The games hub in magenta

**Files:**
- Create: `artifacts/mobile/app/play/_layout.tsx`
- Modify: `artifacts/mobile/app/play/index.tsx`
- Test: `artifacts/mobile/services/__tests__/cornerTheme.test.ts`

- [ ] **Step 1: Make the tests ask for play, and loosen the guard**

In `cornerTheme.test.ts`:
- Set `WIRED` to `CORNER_IDS`, with the comment `/** Every corner is wired. */`. That makes the explicit list unnecessary. Keep the name `WIRED` so the tests still read naturally.
- In the import-guard test's `dirs`, add `join(root, 'components', 'publicGames')`.
- Replace its regex with `/import[^;]*\bpalette\b[^;]*from\s*['"]@\/constants\/colors['"]/`. The old regex missed `import colors, { palette } from …` and double quotes.

- [ ] **Step 2: Run to see it fail**

Run: `pnpm test 2>&1 | grep -E "not ok|missing|palette" | head`
Expected: the test fails on `play: …/app/play/_layout.tsx missing` and on `app/play/index.tsx imports the global palette`.

- [ ] **Step 3: Add the layout**

```tsx
// artifacts/mobile/app/play/_layout.tsx
import { Stack } from 'expo-router';
import { CornerThemeProvider } from '@/context/CornerTheme';

/**
 * Every screen under /play takes the games hub's hue (constants/corners.ts).
 * Each game keeps its own colour inside `GameShell`: only the hub's band and
 * chrome are magenta.
 */
export default function PlayLayout() {
  return (
    <CornerThemeProvider corner="play">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </CornerThemeProvider>
  );
}
```

- [ ] **Step 4: The hub onto `CornerFrame`**

In `app/play/index.tsx`:
- Delete `import { palette } from '@/constants/colors';`, `const ACCENT = palette.primary;`, the `ACCENT_FILL` comment and `const ACCENT_FILL = palette.hero;`.
- Add `import { CORNERS } from '@/constants/corners';`.
- In `GAMES`, change the English entry's `color: '#006D65'` to `color: CORNERS.english.light.primary`, with the comment `// The English corner's own colour, as on the library tile.` above it. This is a module-scope read of the *table*, not the palette, so it is allowed. `readableOn` already adapts it for the dark card.
- Replace the component's `return (` … `);` with the block below. Keep the `GAMES.map` card body and the CTA card exactly as they are; only the wrapper and the header change.

```tsx
  return (
    <CornerFrame title={t('playHubTitle')} subtitle={t('playHubSubtitle')} hideBack>
      <View style={styles.grid}>
        {GAMES.map(g => (
          /* the existing card Pressable, unchanged */
        ))}
      </View>

      {!user && (
        /* the existing CTA card, unchanged */
      )}
    </CornerFrame>
  );
```

The two comments above stand for the existing JSX. Move it in verbatim, and do not leave the comments in the file.

- Delete `styles.header`.
- Remove the now-unused `useSafeAreaInsets`/`insets`/`topPad`, `ScrollView` and `CONTENT_MAX_WIDTH` imports, if they are unused.
- Add `import { CornerFrame } from '@/components/corners/CornerFrame';`.

The hub's band changes from a centred title with rounded bottom corners to the same start-aligned band as every other corner. That is the point: one app, five rooms.

- [ ] **Step 5: Typecheck and test**

Run: `pnpm typecheck && pnpm test 2>&1 | grep -E "cornerTheme|designScale|^# (pass|fail)"`
Expected: clean, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add -A artifacts/mobile/app/play artifacts/mobile/services/__tests__/cornerTheme.test.ts
git commit -m "feat(play): magenta games hub on CornerFrame; palette guard covers every corner"
```

---

### Task 4: Look at it

**Files:**
- Modify: `e2e/screens.mjs` (`ROUTES`)

- [ ] **Step 1: Add the new inner screens**

In `ROUTES`, after `['english-hub', …]`, add `['english-lesson', '/curriculum/english/kbl-g1-eng-s1-nccd-u0_l1']`, the first Grade 1 lesson (`hubLessonsForGrade(1)[0].id`, checked 2026-10-21). After `['play-hub', '/play']`, add `['play-flags', '/play/flags']`.

- [ ] **Step 2: Build, shoot, look**

```bash
cd artifacts/mobile && EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web
cd ../../e2e && (node serve.mjs > /tmp/serve.log 2>&1 &) ; sleep 2
OUT=<scratchpad>/pr2-shots node screens.mjs
```

Build the four contact sheets with `montage`, as PR 1's Task 10 did.

Expected: every shot reports OK, with no SPLASH and no FAILED. Check each of these:
- the English band is deep coral (`#9A3412`) with speech bubbles tiled across a desktop band, and its streak or goal line reads in white;
- the English grade chips and buttons are coral, and in dark mode the selected chip's text is navy, not white;
- the games band is magenta with confetti tiled across, with no back button, and each game card keeps its own colour;
- `/play/flags` keeps its own blue band;
- the library's English tile is coral;
- Math, Lab and Quran look exactly as in PR 1.

- [ ] **Step 3: Commit**

```bash
git add e2e/screens.mjs
git commit -m "chore(e2e): screens.mjs shoots an English lesson and a game"
```

---

### Task 5: Docs

**Files:**
- Modify: `STATUS.md` (the «Each corner has its own colour and band, 2026-10-21» section)
- Modify: `CLAUDE.md` (the corner bullet)
- Modify: `docs/superpowers/specs/2026-10-21-corner-identities-design.md` (Section 3 props)

- [ ] **Step 1: STATUS.md**

- Retitle the section `## Each corner has its own colour and band, 2026-10-21`. Drop `(PR 1 of 2)`.
- In «What changed», add one sentence: «Since PR 2 the English corner is coral with speech bubbles and the games hub magenta with confetti; each game keeps its own colour once opened.»
- Rewrite «Not yet.»:
  - Remove the English/Games, `app/play` and `WIRED` sentences.
  - Keep the dark-mode and grapher sentences.
  - Add: «Text on a primary fill must be `primaryForeground`: the English corner and its activities used white, which a corner's light dark-mode primary cannot carry; `cornerTheme.test.ts` now fails white `primaryText` and white selected-chip text there. Other screens outside the corners still carry the same white-on-teal pair in dark mode — not fixed here.»

- [ ] **Step 2: CLAUDE.md**

In the corner bullet:
- Change `the `_layout.tsx` of a corner directory` to `the `_layout.tsx` of a corner directory — all five: math, lab, quran, english, play`.
- Change `` `components/{math,lab,quran,corners}` `` to `` `components/{math,lab,quran,corners,englishHub,publicGames}` ``.
- After the module-scope sentence, add «Text on a `colors.primary` fill is `colors.primaryForeground`, never `'#fff'`: in dark mode a corner's primary is light.»

- [ ] **Step 3: The spec**

In Section 3's `Props` block, add the four props from Task 1 with their one-line comments, and note «added in PR 2 for the English lesson (eyebrow, back action, persisting taps) and the games hub (no back)». Delete the `layout?: 'list' | 'hub'` line if it is still there. In Section 5, drop «and the link in `lesson-detail.tsx`» from the browser-banner bullet and add: «The lesson page's own link keeps the lesson's subject colour, because it sits on a page already painted in it.»

- [ ] **Step 4: Whole check, commit**

Run (from `artifacts/mobile`): `pnpm typecheck && pnpm test 2>&1 | tail -8`. Then run from the repo root: `pnpm run typecheck`.

```bash
git add STATUS.md CLAUDE.md docs/superpowers/specs/2026-10-21-corner-identities-design.md
git commit -m "docs: corner identities PR 2 in STATUS, CLAUDE and the spec"
```
