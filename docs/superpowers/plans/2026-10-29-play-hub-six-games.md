# Six New /play Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add six games to the public, no-login `/play` hub: opposites, plurals, which-number, compare-fractions, solid/liquid/gas, and Jordan's governorates.

**Architecture:** Every game is a pure question builder in `artifacts/mobile/services/publicGames/` (deterministic from the seeded `rng.ts`) rendered by one shared `TextQuizGame` component on top of the existing `TriviaBoard` mechanic. A game is: logic module + test + 6-line route file + hub tile + grade band + AR/EN strings. Each task ships one game end to end and leaves every test green.

**Tech Stack:** TypeScript, Expo Router / React Native (web build too), `node --test` with `--experimental-strip-types` (so relative imports in `services/` need an explicit `.ts` extension), pnpm.

**Spec:** `docs/superpowers/specs/2026-10-29-play-hub-six-games-design.md`

## Global Constraints

- Work in `/home/user/Iqraa`, on branch `ccr-c35bc284-4ljn3c` (draft PR #1345). Never push to `main`.
- Tests: `cd /home/user/Iqraa/artifacts/mobile && pnpm test`. A test outside `services/__tests__/**/*.test.ts` never runs. The suite prints nothing until it finishes (minutes); that is not a hang. To run one file: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/<file>.test.ts`.
- Typecheck: `cd /home/user/Iqraa && pnpm run typecheck`.
- Arabic is the product language, UI is RTL-first. Latin product name is **Iqrra** (two r's) in copy; Arabic brand is «إقرأ». Never write «اقرأ» as the brand.
- Maths is computed in latin and converted to Arabic digits only at display time (`toArabicDigits` from `services/labFormat.ts`). Any text with Arabic-Indic digits next to an operator or slash goes through `forceLtr` (`services/mathCalc.ts`).
- **No `sed -i` / `perl -pi` on source.** Use the Edit tool (files hold Arabic and `${…}`). A `git diff --stat` line `Bin N -> M bytes` for a text file means corruption.
- Game accents: white text at ≥ 4.5:1, not amber (hue 25–50° at saturation > 0.6, or within ΔE2000 3 of `#B45309`/`#B54708`), and ≥ ΔE2000 8 from every other hub tile, except the two known-close pairs already listed in `gameAmber.test.ts`. The six accents below were pre-checked against all 10 existing tiles and each other with the repo's own `deltaE2000`; do not change them.
- Corner code takes colours from `useColors()`, never from `palette` (`cornerTheme.test.ts`). Text in the game's accent colour on a card goes through `readableOn(accent, colors.card)`.
- Do not add a `KeyboardAvoidingView`; these games have no text input.
- Commit with `git add <named paths>` (never `-A`/`.`), check `git diff --cached --stat` first. End every commit message with:
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VikuhbarCroqQZNf6E4KKf
  ```
- Hub order is append-only: new tiles go after the existing ten, in this order: antonyms, plurals, numberType, fractions, matter, governorates.

| id | route | accent | grades | icon |
| --- | --- | --- | --- | --- |
| `antonyms` | `/play/antonyms` | `#A21CAF` | `[[1, 4]]` | `swap-horizontal-outline` |
| `plurals` | `/play/plurals` | `#334155` | `[[2, 5]]` | `copy-outline` |
| `numberType` | `/play/numberType` | `#4D7C0F` | `[[3, 6]]` | `keypad-outline` |
| `fractions` | `/play/fractions` | `#B91C1C` | `[[4, 7]]` | `contrast-outline` |
| `matter` | `/play/matter` | `#0E7490` | `[[3, 7]]` | `water-outline` |
| `governorates` | `/play/governorates` | `#1E3A8A` | `[[4, 9]]` | `map-outline` |

## File Structure

Create:
- `artifacts/mobile/services/publicGames/textQuiz.ts` — `TextQuestion` type, `withDistractors`, `pickOne` (shared by all six)
- `artifacts/mobile/services/publicGames/antonyms.ts`, `plurals.ts`, `numberType.ts`, `fractions.ts`, `matterStates.ts`, `governorates.ts` — data + `build…Round`
- `artifacts/mobile/components/publicGames/TextQuizGame.tsx` — shared renderer on `TriviaBoard`
- `artifacts/mobile/app/play/{antonyms,plurals,numberType,fractions,matter,governorates}.tsx` — routes
- `artifacts/mobile/services/__tests__/playQuizAsserts.ts` — shared assertion helper (not a test file)
- `artifacts/mobile/services/__tests__/playGame{Antonyms,Plurals,NumberType,Fractions,Matter,Governorates}.test.ts`

Modify (each task appends; none reorders):
- `artifacts/mobile/services/publicGames/gradeBands.ts` — `PLAY_GAME_IDS`, `PLAY_GAME_GRADES`
- `artifacts/mobile/app/play/index.tsx` — `GAMES`
- `artifacts/mobile/services/i18n.ts` — AR block and EN block (anchor: the `playSubtractDesc` line in each)
- `artifacts/mobile/services/__tests__/{gameAccents,gameAmber,routeGating}.test.ts`
- `artifacts/mobile/services/appHelp.ts` + its test (Task 7)
- `docs/status-log.md` (Task 7)

---

### Task 1: Shared plumbing + Opposites («ضد الكلمة»)

**Files:**
- Create: `artifacts/mobile/services/publicGames/textQuiz.ts`, `artifacts/mobile/services/publicGames/antonyms.ts`, `artifacts/mobile/components/publicGames/TextQuizGame.tsx`, `artifacts/mobile/app/play/antonyms.tsx`, `artifacts/mobile/services/__tests__/playQuizAsserts.ts`, `artifacts/mobile/services/__tests__/playGameAntonyms.test.ts`
- Modify: `gradeBands.ts`, `app/play/index.tsx`, `i18n.ts`, `gameAccents.test.ts`, `gameAmber.test.ts`, `routeGating.test.ts`

**Interfaces:**
- Produces (used by Tasks 2–6):
  - `services/publicGames/textQuiz.ts`: `interface TextQuestion { promptKey: TranslationKey; subject?: string; options: TriviaOption[]; correctId: string }`; `withDistractors(correct: TriviaOption, pool: TriviaOption[], n: number, rng?: () => number): TriviaOption[]` (returns correct + up to `n` distinct distractors, shuffled); `pickOne<T>(items: T[], rng?: () => number): T`.
  - `components/publicGames/TextQuizGame.tsx`: `TextQuizGame({ titleKey: TranslationKey; accent: string; build: (lang: 'ar' | 'en', count: number, rng?: () => number) => TextQuestion[] })`. `build` must be a module-level function (stable identity).
  - `services/__tests__/playQuizAsserts.ts`: `assertWellFormed(q: TextQuestion, minOptions?: number)`.
  - `build…Round(lang, count, rng)` convention for every game.

- [ ] **Step 1: Write the shared assertion helper**

Create `artifacts/mobile/services/__tests__/playQuizAsserts.ts`:

```ts
import assert from 'node:assert/strict';
import type { TextQuestion } from '../publicGames/textQuiz.ts';

/** A playable question: enough distinct options and exactly one that is correct. */
export function assertWellFormed(q: TextQuestion, minOptions = 2): void {
  assert.ok(q.options.length >= minOptions, `only ${q.options.length} options`);
  assert.equal(new Set(q.options.map(o => o.id)).size, q.options.length, 'duplicate option id');
  assert.equal(new Set(q.options.map(o => o.label)).size, q.options.length, 'duplicate option label');
  assert.equal(q.options.filter(o => o.id === q.correctId).length, 1, 'correct answer must appear exactly once');
}
```

- [ ] **Step 2: Write the failing test for the shared builder and the antonym game**

Create `artifacts/mobile/services/__tests__/playGameAntonyms.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../publicGames/rng.ts';
import { withDistractors } from '../publicGames/textQuiz.ts';
import { ANTONYM_PAIRS, buildAntonymRound } from '../publicGames/antonyms.ts';
import { assertWellFormed } from './playQuizAsserts.ts';

test('withDistractors: the correct option once, distinct distractors, never a duplicate label', () => {
  const pool = [
    { id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' },
    { id: 'd', label: 'D' }, { id: 'a2', label: 'A' }, // same label as the correct one
  ];
  const out = withDistractors({ id: 'a', label: 'A' }, pool, 3, makeRng(3));
  assert.equal(out.length, 4);
  assert.equal(new Set(out.map(o => o.label)).size, 4);
  assert.equal(out.filter(o => o.id === 'a').length, 1);
});

test('withDistractors returns fewer options than asked rather than repeating one', () => {
  const out = withDistractors({ id: 'a', label: 'A' }, [{ id: 'b', label: 'B' }], 3, makeRng(1));
  assert.equal(out.length, 2);
});

test('antonym data: every Arabic and English word appears once in the whole table', () => {
  const ar = ANTONYM_PAIRS.flatMap(p => [p.ar, p.oppAr]);
  const en = ANTONYM_PAIRS.flatMap(p => [p.en, p.oppEn]);
  assert.equal(new Set(ar).size, ar.length, 'a word repeats in Arabic');
  assert.equal(new Set(en).size, en.length, 'a word repeats in English');
  assert.ok(ANTONYM_PAIRS.length >= 20);
});

test('antonym round: 8 questions on 8 different pairs, each well formed, in both languages', () => {
  for (const lang of ['ar', 'en'] as const) {
    for (let seed = 1; seed <= 100; seed++) {
      const round = buildAntonymRound(lang, 8, makeRng(seed));
      assert.equal(round.length, 8);
      assert.equal(new Set(round.map(q => q.subject)).size, 8, 'a pair repeats within a round');
      for (const q of round) {
        assertWellFormed(q, 4);
        assert.equal(q.promptKey, 'playAntonymsPrompt');
      }
    }
  }
});

test('antonym round: the marked answer really is the opposite of the subject', () => {
  const byAr = new Map<string, string>();
  const byEn = new Map<string, string>();
  for (const p of ANTONYM_PAIRS) {
    byAr.set(p.ar, p.oppAr); byAr.set(p.oppAr, p.ar);
    byEn.set(p.en, p.oppEn); byEn.set(p.oppEn, p.en);
  }
  for (const lang of ['ar', 'en'] as const) {
    const map = lang === 'ar' ? byAr : byEn;
    for (let seed = 1; seed <= 100; seed++) {
      for (const q of buildAntonymRound(lang, 8, makeRng(seed))) {
        const answer = q.options.find(o => o.id === q.correctId)!;
        assert.equal(map.get(q.subject!), answer.label, `${q.subject} -> ${answer.label}`);
      }
    }
  }
});

test('antonym round is deterministic for a seed', () => {
  assert.deepEqual(buildAntonymRound('ar', 8, makeRng(9)), buildAntonymRound('ar', 8, makeRng(9)));
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameAntonyms.test.ts`
Expected: FAIL — `Cannot find module '../publicGames/textQuiz.ts'`.

- [ ] **Step 4: Write `textQuiz.ts`**

Create `artifacts/mobile/services/publicGames/textQuiz.ts`:

```ts
/**
 * Shared shape and helpers for the text-prompt /play games (opposites,
 * plurals, which-number, compare-fractions, states of matter, governorates).
 * They all run on TriviaBoard: a question is a prompt (an i18n key, plus an
 * optional word or place shown in a tile) and a set of options with exactly
 * one correct id.
 */
import { shuffle } from './rng.ts';
import type { TriviaOption } from './countries.ts';
import type { TranslationKey } from '../i18n.ts';

export interface TextQuestion {
  promptKey: TranslationKey;
  /** A word, number or place shown in a tile above the prompt. Absent when the options are the whole question. */
  subject?: string;
  options: TriviaOption[];
  correctId: string;
}

/** One random item. Throws on an empty list: a game with no data is a bug, not an empty round. */
export function pickOne<T>(items: T[], rng: () => number = Math.random): T {
  if (items.length === 0) throw new Error('pickOne: empty list');
  return items[Math.floor(rng() * items.length)]!;
}

/**
 * The correct option plus up to `n` distractors from `pool`, shuffled. A pool
 * entry is skipped when its id or label matches the correct option or one
 * already chosen, so two options can never read the same.
 */
export function withDistractors(
  correct: TriviaOption,
  pool: TriviaOption[],
  n: number,
  rng: () => number = Math.random,
): TriviaOption[] {
  const ids = new Set([correct.id]);
  const labels = new Set([correct.label]);
  const chosen: TriviaOption[] = [];
  for (const o of shuffle(pool, rng)) {
    if (chosen.length >= n) break;
    if (ids.has(o.id) || labels.has(o.label)) continue;
    ids.add(o.id);
    labels.add(o.label);
    chosen.push(o);
  }
  return shuffle([correct, ...chosen], rng);
}
```

- [ ] **Step 5: Write `antonyms.ts`**

Create `artifacts/mobile/services/publicGames/antonyms.ts`:

```ts
/**
 * Opposites (/play/antonyms) — pick the opposite of a word. Grades 1–4.
 *
 * Every word in the table appears exactly once, on either side of one pair
 * (antonyms.test checks it), so a distractor drawn from another pair can never
 * be the answer. Pairs were chosen so that no two share a sense (no
 * «واسع/ضيّق» next to «كبير/صغير», no «صيف/شتاء» next to «حارّ/بارد»): a
 * distractor that is also a defensible opposite makes a bad answer key.
 */
import { sample, shuffle } from './rng.ts';
import { withDistractors, type TextQuestion } from './textQuiz.ts';

export interface AntonymPair {
  ar: string;
  en: string;
  oppAr: string;
  oppEn: string;
}

export const ANTONYM_PAIRS: AntonymPair[] = [
  { ar: 'كبير', en: 'big', oppAr: 'صغير', oppEn: 'small' },
  { ar: 'طويل', en: 'tall', oppAr: 'قصير', oppEn: 'short' },
  { ar: 'سريع', en: 'fast', oppAr: 'بطيء', oppEn: 'slow' },
  { ar: 'ثقيل', en: 'heavy', oppAr: 'خفيف', oppEn: 'light' },
  { ar: 'حارّ', en: 'hot', oppAr: 'بارد', oppEn: 'cold' },
  { ar: 'جديد', en: 'new', oppAr: 'قديم', oppEn: 'old' },
  { ar: 'قريب', en: 'near', oppAr: 'بعيد', oppEn: 'far' },
  { ar: 'فوق', en: 'above', oppAr: 'تحت', oppEn: 'below' },
  { ar: 'داخل', en: 'inside', oppAr: 'خارج', oppEn: 'outside' },
  { ar: 'ليل', en: 'night', oppAr: 'نهار', oppEn: 'day' },
  { ar: 'أبيض', en: 'white', oppAr: 'أسود', oppEn: 'black' },
  { ar: 'سعيد', en: 'happy', oppAr: 'حزين', oppEn: 'sad' },
  { ar: 'نظيف', en: 'clean', oppAr: 'متّسخ', oppEn: 'dirty' },
  { ar: 'غنيّ', en: 'rich', oppAr: 'فقير', oppEn: 'poor' },
  { ar: 'سهل', en: 'easy', oppAr: 'صعب', oppEn: 'hard' },
  { ar: 'قويّ', en: 'strong', oppAr: 'ضعيف', oppEn: 'weak' },
  { ar: 'ممتلئ', en: 'full', oppAr: 'فارغ', oppEn: 'empty' },
  { ar: 'مفتوح', en: 'open', oppAr: 'مغلق', oppEn: 'closed' },
  { ar: 'حلو', en: 'sweet', oppAr: 'مرّ', oppEn: 'bitter' },
  { ar: 'مبلّل', en: 'wet', oppAr: 'جافّ', oppEn: 'dry' },
  { ar: 'شجاع', en: 'brave', oppAr: 'جبان', oppEn: 'cowardly' },
  { ar: 'صادق', en: 'honest', oppAr: 'كاذب', oppEn: 'dishonest' },
  { ar: 'أمام', en: 'in front', oppAr: 'خلف', oppEn: 'behind' },
  { ar: 'يمين', en: 'right', oppAr: 'يسار', oppEn: 'left' },
  { ar: 'بداية', en: 'start', oppAr: 'نهاية', oppEn: 'end' },
  { ar: 'حيّ', en: 'alive', oppAr: 'ميّت', oppEn: 'dead' },
  { ar: 'مبكّر', en: 'early', oppAr: 'متأخّر', oppEn: 'late' },
];

/** Both sides of every pair as options. The id is the Arabic word, so it is the same in either language. */
const ALL_WORDS = (lang: 'ar' | 'en') =>
  ANTONYM_PAIRS.flatMap(p => [
    { id: p.ar, label: lang === 'ar' ? p.ar : p.en },
    { id: p.oppAr, label: lang === 'ar' ? p.oppAr : p.oppEn },
  ]);

function buildQuestion(pair: AntonymPair, lang: 'ar' | 'en', rng: () => number): TextQuestion {
  const flip = rng() < 0.5; // ask about the second word half of the time
  const shown = flip ? { ar: pair.oppAr, en: pair.oppEn } : { ar: pair.ar, en: pair.en };
  const answer = flip ? { ar: pair.ar, en: pair.en } : { ar: pair.oppAr, en: pair.oppEn };
  const correct = { id: answer.ar, label: lang === 'ar' ? answer.ar : answer.en };
  const others = ALL_WORDS(lang).filter(o => o.id !== pair.ar && o.id !== pair.oppAr);
  return {
    promptKey: 'playAntonymsPrompt',
    subject: lang === 'ar' ? shown.ar : shown.en,
    options: withDistractors(correct, others, 3, rng),
    correctId: correct.id,
  };
}

/** `count` questions, each on a different pair. */
export function buildAntonymRound(lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  return shuffle(sample(ANTONYM_PAIRS, count, rng), rng).map(p => buildQuestion(p, lang, rng));
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameAntonyms.test.ts`
Expected: PASS (all 6 tests). `playAntonymsPrompt` is a type error under `tsc` until Step 8 but not under strip-types.

- [ ] **Step 7: Register the game id and grade band**

In `artifacts/mobile/services/publicGames/gradeBands.ts`, Edit:
- old `'english', 'elements', 'flags', 'capitals', 'memory', 'colors', 'multiply', 'divide', 'add', 'subtract',\n] as const;` → new `'english', 'elements', 'flags', 'capitals', 'memory', 'colors', 'multiply', 'divide', 'add', 'subtract',\n  'antonyms',\n] as const;`
- old `  subtract: [[1, 3]],\n};` → new `  subtract: [[1, 3]],\n  antonyms: [[1, 4]],\n};`

- [ ] **Step 8: Add the strings (AR and EN)**

In `artifacts/mobile/services/i18n.ts`, Edit the Arabic line
`    playSubtractDesc: 'كم مسألة طرح تحلّ قبل انتهاء الوقت؟',`
to itself followed by:
```ts
    playAntonymsTitle: 'ضد الكلمة',
    playAntonymsDesc: 'اختر ضدّ كل كلمة تظهر أمامك',
    playAntonymsPrompt: 'ما ضدّ هذه الكلمة؟',
```
and the English line
`    playSubtractDesc: 'How many subtractions can you solve before time runs out?',`
to itself followed by:
```ts
    playAntonymsTitle: 'Opposites',
    playAntonymsDesc: 'Pick the opposite of each word',
    playAntonymsPrompt: 'What is the opposite of this word?',
```

- [ ] **Step 9: Write the shared component**

Create `artifacts/mobile/components/publicGames/TextQuizGame.tsx`:

```tsx
/**
 * The renderer for the text-prompt /play games: a TriviaBoard whose prompt is
 * an optional subject tile (a word, a place) over a one-line question. Each
 * game is a route file that hands this a `build` function from
 * services/publicGames/. Logic lives there; this file has none.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { readableOn } from '@/services/readableColor';
import { TriviaBoard, QUESTION_COUNT } from './TriviaGame';
import type { TextQuestion } from '@/services/publicGames/textQuiz';
import type { TranslationKey } from '@/services/i18n';

export function TextQuizGame({
  titleKey, accent, build,
}: {
  titleKey: TranslationKey;
  accent: string;
  /** Module-level (stable identity): a new function reshuffles the round. */
  build: (lang: 'ar' | 'en', count: number, rng?: () => number) => TextQuestion[];
}) {
  const colors = useColors();
  const { t } = useLanguage();
  const buildRound = React.useCallback((lang: 'ar' | 'en') => build(lang, QUESTION_COUNT), [build]);
  const ink = readableOn(accent, colors.card);

  const renderPrompt = (q: TextQuestion) => (
    <View style={{ alignItems: 'center', gap: 14 }}>
      {q.subject ? (
        <View style={[styles.tile, { borderColor: accent, backgroundColor: `${accent}14` }]}>
          <Text style={{ color: ink, fontFamily: 'ReadexPro_700Bold', fontSize: 30, textAlign: 'center' }}>
            {q.subject}
          </Text>
        </View>
      ) : null}
      <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_700Bold', fontSize: 18, textAlign: 'center' }}>
        {t(q.promptKey)}
      </Text>
    </View>
  );

  return <TriviaBoard titleKey={titleKey} accent={accent} buildRound={buildRound} renderPrompt={renderPrompt} />;
}

const styles = StyleSheet.create({
  tile: {
    minWidth: 140, minHeight: 90, paddingHorizontal: 22, paddingVertical: 12, borderWidth: 2, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
});
```

- [ ] **Step 10: Write the route**

Create `artifacts/mobile/app/play/antonyms.tsx`:

```tsx
import React from 'react';
import { TextQuizGame } from '@/components/publicGames/TextQuizGame';
import { buildAntonymRound } from '@/services/publicGames/antonyms';

export default function AntonymsGameScreen() {
  return <TextQuizGame titleKey="playAntonymsTitle" accent="#A21CAF" build={buildAntonymRound} />;
}
```

- [ ] **Step 11: Add the hub tile**

In `artifacts/mobile/app/play/index.tsx`, Edit old `];\n\nexport default function PlayHubScreen()` → new
```
  { id: 'antonyms', route: '/play/antonyms', icon: 'swap-horizontal-outline', color: '#A21CAF', titleKey: 'playAntonymsTitle', descKey: 'playAntonymsDesc' },
];

export default function PlayHubScreen()
```

- [ ] **Step 12: Teach the guard tests about the new game**

- `services/__tests__/routeGating.test.ts`: old `'/play/subtract']` → new `'/play/subtract', '/play/antonyms']`.
- `services/__tests__/gameAccents.test.ts`: old `  ['app', 'play', 'flags.tsx'],\n` → new `  ['app', 'play', 'flags.tsx'],\n  ['app', 'play', 'antonyms.tsx'],\n`.
- `services/__tests__/gameAmber.test.ts`:
  - old `['app', 'play', 'capitals.tsx'], ['app', 'play', 'flags.tsx'],` → new `['app', 'play', 'capitals.tsx'], ['app', 'play', 'flags.tsx'],\n    ['app', 'play', 'antonyms.tsx'],`
  - old `  assert.equal(Object.keys(hubAccents()).length, 10, 'the hub lists ten games');` → new `  assert.equal(Object.keys(hubAccents()).length, PLAY_GAME_IDS.length, 'every registered game has a hub tile');`
  - add the import after the `CORNERS` import: `import { PLAY_GAME_IDS } from '../publicGames/gradeBands.ts';`

- [ ] **Step 13: Run the affected tests, then typecheck**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameAntonyms.test.ts services/__tests__/gameAccents.test.ts services/__tests__/gameAmber.test.ts services/__tests__/routeGating.test.ts services/__tests__/publicGamesGrades.test.ts services/__tests__/i18n.test.ts services/__tests__/cornerTheme.test.ts`
Expected: all PASS. If `gameAmber` reports the accent ΔE against a neighbour, the colour table in *Global Constraints* was edited by mistake — restore it.
Run: `cd /home/user/Iqraa && pnpm run typecheck` — Expected: no errors (this also proves `'playAntonymsPrompt'` is a valid `TranslationKey` and `'swap-horizontal-outline'` is a real Ionicons name).

- [ ] **Step 14: Read the generated questions yourself**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --input-type=module -e "import {buildAntonymRound} from './services/publicGames/antonyms.ts'; import {makeRng} from './services/publicGames/rng.ts'; for (const q of buildAntonymRound('ar',8,makeRng(7))) console.log(q.subject, '->', q.options.map(o=>(o.id===q.correctId?'*':'')+o.label).join(' | '))"`
Read all 8 lines. Every `*` must be a true opposite and no other option may be a defensible opposite. If one is, remove that pair from `ANTONYM_PAIRS` (and rerun Step 6).

- [ ] **Step 15: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/publicGames/textQuiz.ts artifacts/mobile/services/publicGames/antonyms.ts artifacts/mobile/services/publicGames/gradeBands.ts artifacts/mobile/components/publicGames/TextQuizGame.tsx artifacts/mobile/app/play/antonyms.tsx artifacts/mobile/app/play/index.tsx artifacts/mobile/services/i18n.ts artifacts/mobile/services/__tests__/playQuizAsserts.ts artifacts/mobile/services/__tests__/playGameAntonyms.test.ts artifacts/mobile/services/__tests__/gameAccents.test.ts artifacts/mobile/services/__tests__/gameAmber.test.ts artifacts/mobile/services/__tests__/routeGating.test.ts
git diff --cached --stat
git commit -m "Play hub: Opposites game (ضد الكلمة) and the shared text-quiz plumbing" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbarCroqQZNf6E4KKf"
```

---

### Task 2: Plurals («جمع الكلمة»)

**Files:**
- Create: `services/publicGames/plurals.ts`, `app/play/plurals.tsx`, `services/__tests__/playGamePlurals.test.ts` (all under `artifacts/mobile/`)
- Modify: `gradeBands.ts`, `app/play/index.tsx`, `i18n.ts`, `gameAccents.test.ts`, `gameAmber.test.ts`, `routeGating.test.ts`

**Interfaces:**
- Consumes: `TextQuestion`, `withDistractors` (Task 1); `assertWellFormed`.
- Produces: `PLURAL_PAIRS: PluralPair[]` (`{ ar: string; pluralAr: string }`), `buildPluralRound(lang, count, rng)`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/playGamePlurals.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../publicGames/rng.ts';
import { PLURAL_PAIRS, buildPluralRound } from '../publicGames/plurals.ts';
import { assertWellFormed } from './playQuizAsserts.ts';

test('plural data: no word repeats across singulars and plurals, and a plural differs from its singular', () => {
  const all = PLURAL_PAIRS.flatMap(p => [p.ar, p.pluralAr]);
  assert.equal(new Set(all).size, all.length);
  for (const p of PLURAL_PAIRS) assert.notEqual(p.ar, p.pluralAr);
  assert.ok(PLURAL_PAIRS.length >= 25);
});

test('plural round: 8 questions on 8 different words, Arabic options in both UI languages', () => {
  for (const lang of ['ar', 'en'] as const) {
    for (let seed = 1; seed <= 100; seed++) {
      const round = buildPluralRound(lang, 8, makeRng(seed));
      assert.equal(round.length, 8);
      assert.equal(new Set(round.map(q => q.subject)).size, 8);
      for (const q of round) {
        assertWellFormed(q, 4);
        assert.equal(q.promptKey, 'playPluralsPrompt');
        assert.match(q.subject!, /^\p{Script=Arabic}+$/u);
        for (const o of q.options) assert.match(o.label, /^\p{Script=Arabic}+$/u);
      }
    }
  }
});

test('plural round: the marked answer is the table plural of the subject', () => {
  const plural = new Map(PLURAL_PAIRS.map(p => [p.ar, p.pluralAr]));
  for (let seed = 1; seed <= 100; seed++) {
    for (const q of buildPluralRound('ar', 8, makeRng(seed))) {
      assert.equal(q.options.find(o => o.id === q.correctId)!.label, plural.get(q.subject!));
    }
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGamePlurals.test.ts`
Expected: FAIL — cannot find `../publicGames/plurals.ts`.

- [ ] **Step 3: Write `plurals.ts`**

Create `artifacts/mobile/services/publicGames/plurals.ts`:

```ts
/**
 * Plurals (/play/plurals) — pick the plural of an Arabic word. Grades 2–5.
 *
 * The question is about Arabic morphology, so the word and the options are
 * Arabic whatever the UI language is; only the prompt is localised. Only words
 * with ONE common plural are used (no «بيت» — بيوت/أبيات — and no «عين» —
 * عيون/أعين); the options are the plurals of other words in the table, never a
 * made-up form, so no distractor is a malformed or a second valid plural.
 */
import { sample, shuffle } from './rng.ts';
import { withDistractors, type TextQuestion } from './textQuiz.ts';

export interface PluralPair {
  ar: string;
  pluralAr: string;
}

export const PLURAL_PAIRS: PluralPair[] = [
  { ar: 'كتاب', pluralAr: 'كتب' },
  { ar: 'قلم', pluralAr: 'أقلام' },
  { ar: 'ولد', pluralAr: 'أولاد' },
  { ar: 'بنت', pluralAr: 'بنات' },
  { ar: 'مدرسة', pluralAr: 'مدارس' },
  { ar: 'شجرة', pluralAr: 'أشجار' },
  { ar: 'رجل', pluralAr: 'رجال' },
  { ar: 'طالب', pluralAr: 'طلّاب' },
  { ar: 'باب', pluralAr: 'أبواب' },
  { ar: 'نهر', pluralAr: 'أنهار' },
  { ar: 'جبل', pluralAr: 'جبال' },
  { ar: 'ملعب', pluralAr: 'ملاعب' },
  { ar: 'مفتاح', pluralAr: 'مفاتيح' },
  { ar: 'سيف', pluralAr: 'سيوف' },
  { ar: 'ورقة', pluralAr: 'أوراق' },
  { ar: 'طائر', pluralAr: 'طيور' },
  { ar: 'سمكة', pluralAr: 'أسماك' },
  { ar: 'كوكب', pluralAr: 'كواكب' },
  { ar: 'قلب', pluralAr: 'قلوب' },
  { ar: 'صديق', pluralAr: 'أصدقاء' },
  { ar: 'مدينة', pluralAr: 'مدن' },
  { ar: 'دولة', pluralAr: 'دول' },
  { ar: 'سيّارة', pluralAr: 'سيّارات' },
  { ar: 'لغة', pluralAr: 'لغات' },
  { ar: 'نافذة', pluralAr: 'نوافذ' },
  { ar: 'كرسي', pluralAr: 'كراسي' },
  { ar: 'حقيبة', pluralAr: 'حقائب' },
  { ar: 'حديقة', pluralAr: 'حدائق' },
  { ar: 'قصّة', pluralAr: 'قصص' },
  { ar: 'معلّم', pluralAr: 'معلّمون' },
];

const ALL_PLURALS = PLURAL_PAIRS.map(p => ({ id: p.pluralAr, label: p.pluralAr }));

function buildQuestion(pair: PluralPair, rng: () => number): TextQuestion {
  const correct = { id: pair.pluralAr, label: pair.pluralAr };
  return {
    promptKey: 'playPluralsPrompt',
    subject: pair.ar,
    options: withDistractors(correct, ALL_PLURALS.filter(o => o.id !== pair.pluralAr), 3, rng),
    correctId: correct.id,
  };
}

/** `count` questions, each on a different word. `lang` is accepted for the shared game signature; the content is always Arabic. */
export function buildPluralRound(_lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  return shuffle(sample(PLURAL_PAIRS, count, rng), rng).map(p => buildQuestion(p, rng));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGamePlurals.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire it up**

- `gradeBands.ts`: Edit old `  'antonyms',\n] as const;` → `  'antonyms', 'plurals',\n] as const;`; Edit old `  antonyms: [[1, 4]],\n};` → `  antonyms: [[1, 4]],\n  plurals: [[2, 5]],\n};`.
- `i18n.ts` AR: after the `playSubtractDesc` line add
  ```ts
      playPluralsTitle: 'جمع الكلمة',
      playPluralsDesc: 'اختر الجمع الصحيح للكلمة',
      playPluralsPrompt: 'ما جمع هذه الكلمة؟',
  ```
  EN: after the `playSubtractDesc` line add
  ```ts
      playPluralsTitle: 'Arabic Plurals',
      playPluralsDesc: 'Pick the correct plural of each Arabic word',
      playPluralsPrompt: 'What is the plural of this word?',
  ```
- Create `app/play/plurals.tsx`:
  ```tsx
  import React from 'react';
  import { TextQuizGame } from '@/components/publicGames/TextQuizGame';
  import { buildPluralRound } from '@/services/publicGames/plurals';

  export default function PluralsGameScreen() {
    return <TextQuizGame titleKey="playPluralsTitle" accent="#334155" build={buildPluralRound} />;
  }
  ```
- `app/play/index.tsx`: Edit old `];\n\nexport default function PlayHubScreen()` → new
  ```
    { id: 'plurals', route: '/play/plurals', icon: 'copy-outline', color: '#334155', titleKey: 'playPluralsTitle', descKey: 'playPluralsDesc' },
  ];

  export default function PlayHubScreen()
  ```
- `routeGating.test.ts`: old `'/play/antonyms']` → `'/play/antonyms', '/play/plurals']`.
- `gameAccents.test.ts`: old `  ['app', 'play', 'antonyms.tsx'],\n` → add `  ['app', 'play', 'plurals.tsx'],\n` after it.
- `gameAmber.test.ts`: old `['app', 'play', 'antonyms.tsx'],` → `['app', 'play', 'antonyms.tsx'], ['app', 'play', 'plurals.tsx'],`.

- [ ] **Step 6: Run the guard tests and typecheck**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGamePlurals.test.ts services/__tests__/gameAccents.test.ts services/__tests__/gameAmber.test.ts services/__tests__/routeGating.test.ts services/__tests__/publicGamesGrades.test.ts services/__tests__/i18n.test.ts` — Expected: PASS.
Run: `cd /home/user/Iqraa && pnpm run typecheck` — Expected: no errors.

- [ ] **Step 7: Read the generated questions**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --input-type=module -e "import {buildPluralRound} from './services/publicGames/plurals.ts'; import {makeRng} from './services/publicGames/rng.ts'; for (const q of buildPluralRound('ar',8,makeRng(5))) console.log(q.subject, '->', q.options.map(o=>(o.id===q.correctId?'*':'')+o.label).join(' | '))"`
Check every `*` against what you know of Arabic morphology and that no other option is also a plural of the subject.

- [ ] **Step 8: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/publicGames/plurals.ts artifacts/mobile/services/publicGames/gradeBands.ts artifacts/mobile/app/play/plurals.tsx artifacts/mobile/app/play/index.tsx artifacts/mobile/services/i18n.ts artifacts/mobile/services/__tests__/playGamePlurals.test.ts artifacts/mobile/services/__tests__/gameAccents.test.ts artifacts/mobile/services/__tests__/gameAmber.test.ts artifacts/mobile/services/__tests__/routeGating.test.ts
git diff --cached --stat
git commit -m "Play hub: Arabic plurals game (جمع الكلمة)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbarCroqQZNf6E4KKf"
```

---

### Task 3: Which number? («أيّ عدد؟»)

**Files:** Create `services/publicGames/numberType.ts`, `app/play/numberType.tsx`, `services/__tests__/playGameNumberType.test.ts`. Modify the same shared files as Task 2.

**Interfaces:**
- Consumes: `TextQuestion`, `pickOne` (Task 1); `toArabicDigits` from `services/labFormat.ts`.
- Produces: `type NumberKind = 'even' | 'odd' | 'prime'`; `isPrime(n: number): boolean`; `NUMBER_MIN = 4`, `NUMBER_MAX = 60`; `buildNumberQuestion(kind, lang, rng, used?: Set<number>): TextQuestion`; `buildNumberRound(lang, count, rng)`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/playGameNumberType.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../publicGames/rng.ts';
import { NUMBER_MAX, NUMBER_MIN, buildNumberQuestion, buildNumberRound, isPrime, type NumberKind } from '../publicGames/numberType.ts';
import { assertWellFormed } from './playQuizAsserts.ts';

// Independent of the implementation: count divisors the slow way.
const naivePrime = (n: number) => {
  let divisors = 0;
  for (let d = 1; d <= n; d++) if (n % d === 0) divisors++;
  return divisors === 2;
};
const PREDICATE: Record<NumberKind, (n: number) => boolean> = {
  even: n => n % 2 === 0,
  odd: n => n % 2 === 1,
  prime: naivePrime,
};
const PROMPT: Record<NumberKind, string> = {
  even: 'playNumberEvenPrompt', odd: 'playNumberOddPrompt', prime: 'playNumberPrimePrompt',
};

test('isPrime agrees with a divisor count over the whole range', () => {
  for (let n = 1; n <= NUMBER_MAX; n++) assert.equal(isPrime(n), naivePrime(n), String(n));
});

test('exactly one option has the asked property, and it is the marked one (all kinds, both languages, many seeds)', () => {
  for (const lang of ['ar', 'en'] as const) {
    for (const kind of ['even', 'odd', 'prime'] as const) {
      for (let seed = 1; seed <= 200; seed++) {
        const q = buildNumberQuestion(kind, lang, makeRng(seed));
        assertWellFormed(q, 4);
        assert.equal(q.options.length, 4);
        assert.equal(q.promptKey, PROMPT[kind]);
        assert.equal(q.subject, undefined);
        const matching = q.options.filter(o => PREDICATE[kind](Number(o.id)));
        assert.deepEqual(matching.map(o => o.id), [q.correctId], `${kind} seed ${seed}`);
        for (const o of q.options) {
          const n = Number(o.id);
          assert.ok(n >= NUMBER_MIN && n <= NUMBER_MAX, `${n} out of range`);
        }
      }
    }
  }
});

test('labels use Arabic-Indic digits in Arabic and latin digits in English', () => {
  const ar = buildNumberQuestion('even', 'ar', makeRng(1));
  assert.ok(ar.options.every(o => /^[٠-٩]+$/.test(o.label)));
  const en = buildNumberQuestion('even', 'en', makeRng(1));
  assert.ok(en.options.every(o => /^[0-9]+$/.test(o.label)));
});

test('a round mixes the three kinds and never asks about the same answer twice', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const round = buildNumberRound('ar', 8, makeRng(seed));
    assert.equal(round.length, 8);
    assert.equal(new Set(round.map(q => q.promptKey)).size, 3);
    assert.equal(new Set(round.map(q => q.correctId)).size, 8);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameNumberType.test.ts`
Expected: FAIL — cannot find `../publicGames/numberType.ts`.

- [ ] **Step 3: Write `numberType.ts`**

Create `artifacts/mobile/services/publicGames/numberType.ts`:

```ts
/**
 * Which number? (/play/numberType) — find the even, odd or prime number among
 * four. Grades 3–6. Every answer is computed, never typed in.
 *
 * It is "which of these four is X", not "is N even, odd or prime": 7 is both
 * odd and prime, so a three-label question would have two correct answers.
 * Here each kind is unique by construction — one even among three odds, one
 * odd among three evens, one prime among three composites. The range starts at
 * 4 and stops at 60: 1 is not prime, and 2 is both even and prime.
 */
import { sample, shuffle } from './rng.ts';
import { pickOne, type TextQuestion } from './textQuiz.ts';
import { toArabicDigits } from '../labFormat.ts';
import type { TranslationKey } from '../i18n.ts';

export type NumberKind = 'even' | 'odd' | 'prime';

export const NUMBER_MIN = 4;
export const NUMBER_MAX = 60;

export function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
}

const RANGE = Array.from({ length: NUMBER_MAX - NUMBER_MIN + 1 }, (_, i) => NUMBER_MIN + i);
const EVENS = RANGE.filter(n => n % 2 === 0);
const ODDS = RANGE.filter(n => n % 2 === 1);
const PRIMES = RANGE.filter(isPrime);
const COMPOSITES = RANGE.filter(n => !isPrime(n));

const ANSWERS: Record<NumberKind, number[]> = { even: EVENS, odd: ODDS, prime: PRIMES };
const WRONG: Record<NumberKind, number[]> = { even: ODDS, odd: EVENS, prime: COMPOSITES };
const PROMPT: Record<NumberKind, TranslationKey> = {
  even: 'playNumberEvenPrompt',
  odd: 'playNumberOddPrompt',
  prime: 'playNumberPrimePrompt',
};
const KINDS: NumberKind[] = ['even', 'odd', 'prime'];

const label = (n: number, lang: 'ar' | 'en') => (lang === 'ar' ? toArabicDigits(String(n)) : String(n));

/** `used` holds answers already asked this round, so a number is not the answer twice. */
export function buildNumberQuestion(
  kind: NumberKind,
  lang: 'ar' | 'en',
  rng: () => number = Math.random,
  used: Set<number> = new Set(),
): TextQuestion {
  const fresh = ANSWERS[kind].filter(n => !used.has(n));
  const answer = pickOne(fresh.length > 0 ? fresh : ANSWERS[kind], rng);
  used.add(answer);
  const wrong = sample(WRONG[kind], 3, rng);
  return {
    promptKey: PROMPT[kind],
    options: shuffle([answer, ...wrong].map(n => ({ id: String(n), label: label(n, lang) })), rng),
    correctId: String(answer),
  };
}

/** `count` questions cycling through the three kinds, in random order. */
export function buildNumberRound(lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  const kinds = shuffle(Array.from({ length: count }, (_, i) => KINDS[i % KINDS.length]!), rng);
  const used = new Set<number>();
  return kinds.map(kind => buildNumberQuestion(kind, lang, rng, used));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameNumberType.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire it up**

- `gradeBands.ts`: old `  'antonyms', 'plurals',\n] as const;` → `  'antonyms', 'plurals', 'numberType',\n] as const;`; old `  plurals: [[2, 5]],\n};` → `  plurals: [[2, 5]],\n  numberType: [[3, 6]],\n};`.
- `i18n.ts` AR (after the `playSubtractDesc` line):
  ```ts
      playNumberTypeTitle: 'أيّ عدد؟',
      playNumberTypeDesc: 'اعثر على العدد الزوجي أو الفردي أو الأولي',
      playNumberEvenPrompt: 'أيّ هذه الأعداد زوجي؟',
      playNumberOddPrompt: 'أيّ هذه الأعداد فردي؟',
      playNumberPrimePrompt: 'أيّ هذه الأعداد أوّلي؟',
  ```
  EN:
  ```ts
      playNumberTypeTitle: 'Which Number?',
      playNumberTypeDesc: 'Find the even, odd or prime number',
      playNumberEvenPrompt: 'Which of these numbers is even?',
      playNumberOddPrompt: 'Which of these numbers is odd?',
      playNumberPrimePrompt: 'Which of these numbers is prime?',
  ```
- Create `app/play/numberType.tsx` (same shape as `plurals.tsx`): `import { buildNumberRound } from '@/services/publicGames/numberType';` and `<TextQuizGame titleKey="playNumberTypeTitle" accent="#4D7C0F" build={buildNumberRound} />`, component name `NumberTypeGameScreen`.
- `app/play/index.tsx` new entry before `];`: `  { id: 'numberType', route: '/play/numberType', icon: 'keypad-outline', color: '#4D7C0F', titleKey: 'playNumberTypeTitle', descKey: 'playNumberTypeDesc' },`
- `routeGating.test.ts`: old `'/play/plurals']` → `'/play/plurals', '/play/numberType']`.
- `gameAccents.test.ts`: add `  ['app', 'play', 'numberType.tsx'],\n` after the `plurals.tsx` line.
- `gameAmber.test.ts`: old `['app', 'play', 'plurals.tsx'],` → `['app', 'play', 'plurals.tsx'], ['app', 'play', 'numberType.tsx'],`.

- [ ] **Step 6: Run guard tests, typecheck, read output**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameNumberType.test.ts services/__tests__/gameAccents.test.ts services/__tests__/gameAmber.test.ts services/__tests__/routeGating.test.ts services/__tests__/publicGamesGrades.test.ts services/__tests__/i18n.test.ts services/__tests__/i18nTerminology.test.ts` — Expected: PASS. Then `cd /home/user/Iqraa && pnpm run typecheck` — Expected: clean.
Read one round: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --input-type=module -e "import {buildNumberRound} from './services/publicGames/numberType.ts'; import {makeRng} from './services/publicGames/rng.ts'; for (const q of buildNumberRound('en',8,makeRng(2))) console.log(q.promptKey, q.options.map(o=>(o.id===q.correctId?'*':'')+o.label).join(' | '))"` and confirm each `*` by hand.

- [ ] **Step 7: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/publicGames/numberType.ts artifacts/mobile/services/publicGames/gradeBands.ts artifacts/mobile/app/play/numberType.tsx artifacts/mobile/app/play/index.tsx artifacts/mobile/services/i18n.ts artifacts/mobile/services/__tests__/playGameNumberType.test.ts artifacts/mobile/services/__tests__/gameAccents.test.ts artifacts/mobile/services/__tests__/gameAmber.test.ts artifacts/mobile/services/__tests__/routeGating.test.ts
git diff --cached --stat
git commit -m "Play hub: which-number game (even, odd, prime)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbarCroqQZNf6E4KKf"
```

---

### Task 4: Compare fractions («قارن الكسور»)

**Files:** Create `services/publicGames/fractions.ts`, `app/play/fractions.tsx`, `services/__tests__/playGameFractions.test.ts`. Modify the same shared files.

**Interfaces:**
- Consumes: `TextQuestion` (Task 1); `toArabicDigits` (`labFormat.ts`); `forceLtr` (`mathCalc.ts`).
- Produces: `FRACTIONS: Array<{ n: number; d: number }>` (reduced proper fractions, denominators 2–12); `buildFractionQuestion(kind: 'larger' | 'smaller', lang, rng)`; `buildFractionRound(lang, count, rng)`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/playGameFractions.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../publicGames/rng.ts';
import { FRACTIONS, buildFractionQuestion, buildFractionRound } from '../publicGames/fractions.ts';
import { assertWellFormed } from './playQuizAsserts.ts';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const value = (id: string) => { const [n, d] = id.split('/').map(Number); return n! / d!; };

test('fraction data: proper, reduced, denominators 2–12, so no two have the same value', () => {
  for (const { n, d } of FRACTIONS) {
    assert.ok(n >= 1 && n < d && d >= 2 && d <= 12, `${n}/${d}`);
    assert.equal(gcd(n, d), 1, `${n}/${d} is not reduced`);
  }
  const values = FRACTIONS.map(f => f.n / f.d);
  assert.equal(new Set(values).size, values.length);
});

test('exactly the larger (or smaller) of the two options is marked, over many seeds', () => {
  for (const lang of ['ar', 'en'] as const) {
    for (const kind of ['larger', 'smaller'] as const) {
      for (let seed = 1; seed <= 200; seed++) {
        const q = buildFractionQuestion(kind, lang, makeRng(seed));
        assertWellFormed(q, 2);
        assert.equal(q.options.length, 2);
        assert.equal(q.promptKey, kind === 'larger' ? 'playFractionLargerPrompt' : 'playFractionSmallerPrompt');
        const [a, b] = q.options.map(o => value(o.id)) as [number, number];
        assert.notEqual(a, b);
        const wanted = kind === 'larger' ? Math.max(a, b) : Math.min(a, b);
        assert.equal(value(q.correctId), wanted, `${kind} seed ${seed}`);
      }
    }
  }
});

test('labels are wrapped in a left-to-right override, with Arabic-Indic digits in Arabic', () => {
  const ar = buildFractionQuestion('larger', 'ar', makeRng(1));
  for (const o of ar.options) assert.match(o.label, /^‭[٠-٩]+\/[٠-٩]+‬$/);
  const en = buildFractionQuestion('larger', 'en', makeRng(1));
  for (const o of en.options) assert.match(o.label, /^‭[0-9]+\/[0-9]+‬$/);
});

test('a round has no repeated pair', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const round = buildFractionRound('en', 8, makeRng(seed));
    assert.equal(round.length, 8);
    const pairs = round.map(q => q.options.map(o => o.id).sort().join('|'));
    assert.equal(new Set(pairs).size, 8);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameFractions.test.ts`
Expected: FAIL — cannot find `../publicGames/fractions.ts`.

- [ ] **Step 3: Write `fractions.ts`**

Create `artifacts/mobile/services/publicGames/fractions.ts`:

```ts
/**
 * Compare fractions (/play/fractions) — which of two fractions is larger (or
 * smaller)? Grades 4–7. Computed, not authored.
 *
 * Only reduced proper fractions are used, so two different ones never have the
 * same value and "which is larger" always has one answer. The answer is
 * decided by cross-multiplication, so no floating point is compared.
 * Labels are wrapped in a left-to-right override (`forceLtr`): Arabic-Indic
 * digits around a slash otherwise print in the wrong order on the web.
 */
import { shuffle } from './rng.ts';
import { pickOne, type TextQuestion } from './textQuiz.ts';
import { toArabicDigits } from '../labFormat.ts';
import { forceLtr } from '../mathCalc.ts';

export interface Fraction {
  n: number;
  d: number;
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export const FRACTIONS: Fraction[] = Array.from({ length: 11 }, (_, i) => i + 2).flatMap(d =>
  Array.from({ length: d - 1 }, (_, j) => j + 1)
    .filter(n => gcd(n, d) === 1)
    .map(n => ({ n, d })),
);

export type FractionKind = 'larger' | 'smaller';

const id = (f: Fraction) => `${f.n}/${f.d}`;
const label = (f: Fraction, lang: 'ar' | 'en') => forceLtr(lang === 'ar' ? toArabicDigits(id(f)) : id(f));
/** a > b without division. */
const greater = (a: Fraction, b: Fraction) => a.n * b.d > b.n * a.d;

function pickPair(rng: () => number): [Fraction, Fraction] {
  const a = pickOne(FRACTIONS, rng);
  const b = pickOne(FRACTIONS.filter(f => id(f) !== id(a)), rng);
  return [a, b];
}

function questionFor(kind: FractionKind, lang: 'ar' | 'en', a: Fraction, b: Fraction, rng: () => number): TextQuestion {
  const winner = (kind === 'larger') === greater(a, b) ? a : b;
  return {
    promptKey: kind === 'larger' ? 'playFractionLargerPrompt' : 'playFractionSmallerPrompt',
    options: shuffle([a, b].map(f => ({ id: id(f), label: label(f, lang) })), rng),
    correctId: id(winner),
  };
}

export function buildFractionQuestion(kind: FractionKind, lang: 'ar' | 'en', rng: () => number = Math.random): TextQuestion {
  const [a, b] = pickPair(rng);
  return questionFor(kind, lang, a, b, rng);
}

/** `count` questions, alternating larger/smaller in random order, never the same pair twice. */
export function buildFractionRound(lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  const kinds = shuffle(Array.from({ length: count }, (_, i): FractionKind => (i % 2 === 0 ? 'larger' : 'smaller')), rng);
  const seen = new Set<string>();
  return kinds.map(kind => {
    let a: Fraction, b: Fraction, key: string;
    do {
      [a, b] = pickPair(rng);
      key = [id(a), id(b)].sort().join('|');
    } while (seen.has(key));
    seen.add(key);
    return questionFor(kind, lang, a, b, rng);
  });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameFractions.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire it up**

- `gradeBands.ts`: old `  'antonyms', 'plurals', 'numberType',\n] as const;` → `  'antonyms', 'plurals', 'numberType', 'fractions',\n] as const;`; old `  numberType: [[3, 6]],\n};` → `  numberType: [[3, 6]],\n  fractions: [[4, 7]],\n};`.
- `i18n.ts` AR:
  ```ts
      playFractionsTitle: 'قارن الكسور',
      playFractionsDesc: 'أيّ الكسرين أكبر وأيّهما أصغر؟',
      playFractionLargerPrompt: 'أيّ الكسرين أكبر؟',
      playFractionSmallerPrompt: 'أيّ الكسرين أصغر؟',
  ```
  EN:
  ```ts
      playFractionsTitle: 'Compare Fractions',
      playFractionsDesc: 'Which fraction is larger, and which is smaller?',
      playFractionLargerPrompt: 'Which fraction is larger?',
      playFractionSmallerPrompt: 'Which fraction is smaller?',
  ```
- `app/play/fractions.tsx` (`FractionsGameScreen`): `build={buildFractionRound}` from `@/services/publicGames/fractions`, `titleKey="playFractionsTitle"`, `accent="#B91C1C"`.
- `app/play/index.tsx` entry: `  { id: 'fractions', route: '/play/fractions', icon: 'contrast-outline', color: '#B91C1C', titleKey: 'playFractionsTitle', descKey: 'playFractionsDesc' },`
- `routeGating.test.ts`: old `'/play/numberType']` → `'/play/numberType', '/play/fractions']`.
- `gameAccents.test.ts`: add `  ['app', 'play', 'fractions.tsx'],\n` after the `numberType.tsx` line. `gameAmber.test.ts`: old `['app', 'play', 'numberType.tsx'],` → `['app', 'play', 'numberType.tsx'], ['app', 'play', 'fractions.tsx'],`.

- [ ] **Step 6: Run guard tests, typecheck, read output**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameFractions.test.ts services/__tests__/gameAccents.test.ts services/__tests__/gameAmber.test.ts services/__tests__/routeGating.test.ts services/__tests__/publicGamesGrades.test.ts services/__tests__/i18n.test.ts services/__tests__/i18nTerminology.test.ts services/__tests__/iconSystem.test.ts` — Expected: PASS. Then `pnpm run typecheck` from the repo root — Expected: clean.
Read: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --input-type=module -e "import {buildFractionRound} from './services/publicGames/fractions.ts'; import {makeRng} from './services/publicGames/rng.ts'; for (const q of buildFractionRound('en',8,makeRng(4))) console.log(q.promptKey, q.options.map(o=>(o.id===q.correctId?'*':'')+o.id).join(' | '))"`; check each `*` by hand.

- [ ] **Step 7: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/publicGames/fractions.ts artifacts/mobile/services/publicGames/gradeBands.ts artifacts/mobile/app/play/fractions.tsx artifacts/mobile/app/play/index.tsx artifacts/mobile/services/i18n.ts artifacts/mobile/services/__tests__/playGameFractions.test.ts artifacts/mobile/services/__tests__/gameAccents.test.ts artifacts/mobile/services/__tests__/gameAmber.test.ts artifacts/mobile/services/__tests__/routeGating.test.ts
git diff --cached --stat
git commit -m "Play hub: compare-fractions game (قارن الكسور)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbarCroqQZNf6E4KKf"
```

---

### Task 5: Solid, liquid or gas? («صلب، سائل أم غاز؟»)

**Files:** Create `services/publicGames/matterStates.ts`, `app/play/matter.tsx`, `services/__tests__/playGameMatter.test.ts`. Modify the same shared files.

**Interfaces:**
- Consumes: `TextQuestion` (Task 1).
- Produces: `type MatterState = 'solid' | 'liquid' | 'gas'`; `SUBSTANCES: Substance[]` (`{ id: string; ar: string; en: string; state: MatterState }`); `buildMatterRound(lang, count, rng)`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/playGameMatter.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../publicGames/rng.ts';
import { SUBSTANCES, buildMatterRound } from '../publicGames/matterStates.ts';
import { assertWellFormed } from './playQuizAsserts.ts';

test('substance data: unique ids and names, a valid state each, at least 5 of every state', () => {
  assert.equal(new Set(SUBSTANCES.map(s => s.id)).size, SUBSTANCES.length);
  assert.equal(new Set(SUBSTANCES.map(s => s.ar)).size, SUBSTANCES.length);
  assert.equal(new Set(SUBSTANCES.map(s => s.en)).size, SUBSTANCES.length);
  for (const state of ['solid', 'liquid', 'gas'] as const) {
    assert.ok(SUBSTANCES.filter(s => s.state === state).length >= 5, state);
  }
  for (const s of SUBSTANCES) assert.ok(['solid', 'liquid', 'gas'].includes(s.state), s.id);
});

test('matter round: three state options, the marked one is the substance\'s state, no substance twice', () => {
  const byName = (lang: 'ar' | 'en') => new Map(SUBSTANCES.map(s => [lang === 'ar' ? s.ar : s.en, s.state]));
  for (const lang of ['ar', 'en'] as const) {
    const state = byName(lang);
    for (let seed = 1; seed <= 100; seed++) {
      const round = buildMatterRound(lang, 8, makeRng(seed));
      assert.equal(round.length, 8);
      assert.equal(new Set(round.map(q => q.subject)).size, 8);
      for (const q of round) {
        assertWellFormed(q, 3);
        assert.equal(q.options.length, 3);
        assert.equal(q.promptKey, 'playMatterPrompt');
        assert.equal(q.correctId, state.get(q.subject!));
        assert.deepEqual(q.options.map(o => o.id).sort(), ['gas', 'liquid', 'solid']);
      }
    }
  }
});

test('a round is not all one state', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const states = new Set(buildMatterRound('ar', 8, makeRng(seed)).map(q => q.correctId));
    assert.ok(states.size >= 2);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameMatter.test.ts`
Expected: FAIL — cannot find `../publicGames/matterStates.ts`.

- [ ] **Step 3: Write `matterStates.ts`**

Create `artifacts/mobile/services/publicGames/matterStates.ts`:

```ts
/**
 * Solid, liquid or gas? (/play/matter) — name the state of an everyday
 * substance at room temperature. Grades 3–7.
 *
 * Only unambiguous substances: no milk or mayonnaise (colloids), no honey or
 * toothpaste (arguable), no "air" (a mixture), no mercury (a liquid metal that
 * contradicts the child's "metals are solid" rule). Salt and sugar are
 * granular solids, not powders-that-pour, and are listed as solids on purpose.
 */
import { sample, shuffle } from './rng.ts';
import type { TextQuestion } from './textQuiz.ts';

export type MatterState = 'solid' | 'liquid' | 'gas';

export interface Substance {
  id: string;
  ar: string;
  en: string;
  state: MatterState;
}

export const SUBSTANCES: Substance[] = [
  { id: 'wood', ar: 'خشب', en: 'Wood', state: 'solid' },
  { id: 'iron', ar: 'حديد', en: 'Iron', state: 'solid' },
  { id: 'ice', ar: 'ثلج', en: 'Ice', state: 'solid' },
  { id: 'glass', ar: 'زجاج', en: 'Glass', state: 'solid' },
  { id: 'stone', ar: 'حجر', en: 'Stone', state: 'solid' },
  { id: 'gold', ar: 'ذهب', en: 'Gold', state: 'solid' },
  { id: 'salt', ar: 'ملح', en: 'Salt', state: 'solid' },
  { id: 'sugar', ar: 'سكّر', en: 'Sugar', state: 'solid' },
  { id: 'water', ar: 'ماء', en: 'Water', state: 'liquid' },
  { id: 'olive-oil', ar: 'زيت الزيتون', en: 'Olive oil', state: 'liquid' },
  { id: 'orange-juice', ar: 'عصير البرتقال', en: 'Orange juice', state: 'liquid' },
  { id: 'vinegar', ar: 'خلّ', en: 'Vinegar', state: 'liquid' },
  { id: 'seawater', ar: 'ماء البحر', en: 'Seawater', state: 'liquid' },
  { id: 'rose-water', ar: 'ماء الورد', en: 'Rose water', state: 'liquid' },
  { id: 'oxygen', ar: 'الأكسجين', en: 'Oxygen', state: 'gas' },
  { id: 'carbon-dioxide', ar: 'ثاني أكسيد الكربون', en: 'Carbon dioxide', state: 'gas' },
  { id: 'hydrogen', ar: 'الهيدروجين', en: 'Hydrogen', state: 'gas' },
  { id: 'helium', ar: 'الهيليوم', en: 'Helium', state: 'gas' },
  { id: 'nitrogen', ar: 'النيتروجين', en: 'Nitrogen', state: 'gas' },
  { id: 'water-vapour', ar: 'بخار الماء', en: 'Water vapour', state: 'gas' },
];

const STATE_LABEL: Record<MatterState, { ar: string; en: string }> = {
  solid: { ar: 'صلب', en: 'Solid' },
  liquid: { ar: 'سائل', en: 'Liquid' },
  gas: { ar: 'غاز', en: 'Gas' },
};

const STATES: MatterState[] = ['solid', 'liquid', 'gas'];

function buildQuestion(s: Substance, lang: 'ar' | 'en', rng: () => number): TextQuestion {
  return {
    promptKey: 'playMatterPrompt',
    subject: lang === 'ar' ? s.ar : s.en,
    options: shuffle(STATES.map(st => ({ id: st, label: STATE_LABEL[st][lang] })), rng),
    correctId: s.state,
  };
}

/**
 * `count` different substances. The sample is redrawn until it holds at least
 * two states, so a round is never "all gases" by luck.
 */
export function buildMatterRound(lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  let picked: Substance[];
  do {
    picked = sample(SUBSTANCES, count, rng);
  } while (new Set(picked.map(s => s.state)).size < 2);
  return picked.map(s => buildQuestion(s, lang, rng));
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameMatter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire it up**

- `gradeBands.ts`: old `  'antonyms', 'plurals', 'numberType', 'fractions',\n] as const;` → `  'antonyms', 'plurals', 'numberType', 'fractions', 'matter',\n] as const;`; old `  fractions: [[4, 7]],\n};` → `  fractions: [[4, 7]],\n  matter: [[3, 7]],\n};`.
- `i18n.ts` AR:
  ```ts
      playMatterTitle: 'صلب، سائل أم غاز؟',
      playMatterDesc: 'صنّف المواد من حولك حسب حالتها',
      playMatterPrompt: 'ما حالة هذه المادة؟',
  ```
  EN:
  ```ts
      playMatterTitle: 'Solid, Liquid or Gas?',
      playMatterDesc: 'Sort everyday things by their state',
      playMatterPrompt: 'What state is this in?',
  ```
- `app/play/matter.tsx` (`MatterGameScreen`): `build={buildMatterRound}` from `@/services/publicGames/matterStates`, `titleKey="playMatterTitle"`, `accent="#0E7490"`.
- `app/play/index.tsx` entry: `  { id: 'matter', route: '/play/matter', icon: 'water-outline', color: '#0E7490', titleKey: 'playMatterTitle', descKey: 'playMatterDesc' },`
- `routeGating.test.ts`: old `'/play/fractions']` → `'/play/fractions', '/play/matter']`.
- `gameAccents.test.ts`: add `  ['app', 'play', 'matter.tsx'],\n` after the `fractions.tsx` line. `gameAmber.test.ts`: old `['app', 'play', 'fractions.tsx'],` → `['app', 'play', 'fractions.tsx'], ['app', 'play', 'matter.tsx'],`.

- [ ] **Step 6: Run guard tests, typecheck, read output**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameMatter.test.ts services/__tests__/gameAccents.test.ts services/__tests__/gameAmber.test.ts services/__tests__/routeGating.test.ts services/__tests__/publicGamesGrades.test.ts services/__tests__/i18n.test.ts services/__tests__/i18nTerminology.test.ts` — Expected: PASS. Then `pnpm run typecheck` from the repo root — Expected: clean.
Read all 20 substances against their state once more (the table above is the whole answer key).

- [ ] **Step 7: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/publicGames/matterStates.ts artifacts/mobile/services/publicGames/gradeBands.ts artifacts/mobile/app/play/matter.tsx artifacts/mobile/app/play/index.tsx artifacts/mobile/services/i18n.ts artifacts/mobile/services/__tests__/playGameMatter.test.ts artifacts/mobile/services/__tests__/gameAccents.test.ts artifacts/mobile/services/__tests__/gameAmber.test.ts artifacts/mobile/services/__tests__/routeGating.test.ts
git diff --cached --stat
git commit -m "Play hub: states-of-matter game (صلب، سائل أم غاز؟)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbarCroqQZNf6E4KKf"
```

---

### Task 6: Jordan's governorates («محافظات الأردن»)

**Files:** Create `services/publicGames/governorates.ts`, `app/play/governorates.tsx`, `services/__tests__/playGameGovernorates.test.ts`. Modify the same shared files.

**Interfaces:**
- Consumes: `TextQuestion`, `withDistractors` (Task 1).
- Produces: `GOVERNORATES: Governorate[]` (`{ id; ar; en }`, 12 entries); `PLACES: Place[]` (`{ ar; en; gov: string }`); `buildGovernorateRound(lang, count, rng)`.

- [ ] **Step 1: Verify the answer key against a published source (before writing any code)**

The table in Step 3 is from memory. Check every place → governorate row against a published source (the Wikipedia article for each governorate lists its districts and towns; the Department of Statistics / Ministry of Interior sites are authoritative). Use `WebSearch`/`WebFetch`. If a row cannot be confirmed, delete it from the table; a governorate may end up with a single place but the test requires at least one. Record the source(s) you used in the commit message body.

- [ ] **Step 2: Write the failing test**

Create `artifacts/mobile/services/__tests__/playGameGovernorates.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../publicGames/rng.ts';
import { GOVERNORATES, PLACES, buildGovernorateRound } from '../publicGames/governorates.ts';
import { assertWellFormed } from './playQuizAsserts.ts';

test('there are 12 governorates with unique ids and names', () => {
  assert.equal(GOVERNORATES.length, 12);
  for (const key of ['id', 'ar', 'en'] as const) {
    assert.equal(new Set(GOVERNORATES.map(g => g[key])).size, 12, key);
  }
});

test('place data: unique names, every place points at a real governorate, every governorate has a place', () => {
  assert.equal(new Set(PLACES.map(p => p.ar)).size, PLACES.length);
  assert.equal(new Set(PLACES.map(p => p.en)).size, PLACES.length);
  const ids = new Set(GOVERNORATES.map(g => g.id));
  for (const p of PLACES) assert.ok(ids.has(p.gov), `${p.ar} -> ${p.gov}`);
  for (const g of GOVERNORATES) assert.ok(PLACES.some(p => p.gov === g.id), `${g.ar} has no place`);
  assert.ok(PLACES.length >= 20);
});

test('no place is named after its own governorate (that question answers itself)', () => {
  const byId = new Map(GOVERNORATES.map(g => [g.id, g]));
  for (const p of PLACES) {
    assert.notEqual(p.ar, byId.get(p.gov)!.ar);
    assert.notEqual(p.en, byId.get(p.gov)!.en);
  }
});

test('governorate round: 8 different places, four distinct governorates each, the marked one is the place\'s', () => {
  for (const lang of ['ar', 'en'] as const) {
    const home = new Map(PLACES.map(p => [lang === 'ar' ? p.ar : p.en, p.gov]));
    for (let seed = 1; seed <= 100; seed++) {
      const round = buildGovernorateRound(lang, 8, makeRng(seed));
      assert.equal(round.length, 8);
      assert.equal(new Set(round.map(q => q.subject)).size, 8);
      for (const q of round) {
        assertWellFormed(q, 4);
        assert.equal(q.options.length, 4);
        assert.equal(q.promptKey, 'playGovernoratesPrompt');
        assert.equal(q.correctId, home.get(q.subject!));
      }
    }
  }
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameGovernorates.test.ts`
Expected: FAIL — cannot find `../publicGames/governorates.ts`.

- [ ] **Step 4: Write `governorates.ts`**

Create `artifacts/mobile/services/publicGames/governorates.ts` (drop any row Step 1 could not confirm):

```ts
/**
 * Jordan's governorates (/play/governorates) — which governorate is this town
 * or site in? Grades 4–9.
 *
 * Eleven of the twelve governorates share their name with their centre (only
 * Balqa → Salt differs), so "governorate → centre" would be near-trivial. The
 * question is the other way round, about towns and sites that carry a
 * different name. Every row was checked against a published source before it
 * was added (see the commit that introduced it); a place whose governorate is
 * arguable (the Dead Sea spans several) is deliberately absent.
 */
import { sample } from './rng.ts';
import { withDistractors, type TextQuestion } from './textQuiz.ts';

export interface Governorate {
  id: string;
  ar: string;
  en: string;
}

export interface Place {
  ar: string;
  en: string;
  /** A `Governorate.id`. */
  gov: string;
}

export const GOVERNORATES: Governorate[] = [
  { id: 'amman', ar: 'عمّان', en: 'Amman' },
  { id: 'zarqa', ar: 'الزرقاء', en: 'Zarqa' },
  { id: 'irbid', ar: 'إربد', en: 'Irbid' },
  { id: 'mafraq', ar: 'المفرق', en: 'Mafraq' },
  { id: 'balqa', ar: 'البلقاء', en: 'Balqa' },
  { id: 'jerash', ar: 'جرش', en: 'Jerash' },
  { id: 'ajloun', ar: 'عجلون', en: 'Ajloun' },
  { id: 'madaba', ar: 'مأدبا', en: 'Madaba' },
  { id: 'karak', ar: 'الكرك', en: 'Karak' },
  { id: 'tafilah', ar: 'الطفيلة', en: 'Tafilah' },
  { id: 'maan', ar: 'معان', en: "Ma'an" },
  { id: 'aqaba', ar: 'العقبة', en: 'Aqaba' },
];

export const PLACES: Place[] = [
  { ar: 'سحاب', en: 'Sahab', gov: 'amman' },
  { ar: 'ماركا', en: 'Marka', gov: 'amman' },
  { ar: 'ناعور', en: 'Naur', gov: 'amman' },
  { ar: 'الرصيفة', en: 'Russeifa', gov: 'zarqa' },
  { ar: 'الأزرق', en: 'Azraq', gov: 'zarqa' },
  { ar: 'الرمثا', en: 'Ramtha', gov: 'irbid' },
  { ar: 'أم قيس', en: 'Umm Qais', gov: 'irbid' },
  { ar: 'بيت راس', en: 'Beit Ras', gov: 'irbid' },
  { ar: 'الرويشد', en: 'Ruwaished', gov: 'mafraq' },
  { ar: 'أم الجمال', en: 'Umm al-Jimal', gov: 'mafraq' },
  { ar: 'السلط', en: 'Salt', gov: 'balqa' },
  { ar: 'فحيص', en: 'Fuheis', gov: 'balqa' },
  { ar: 'دير علا', en: 'Deir Alla', gov: 'balqa' },
  { ar: 'سوف', en: 'Souf', gov: 'jerash' },
  { ar: 'كفرنجة', en: 'Kufranjah', gov: 'ajloun' },
  { ar: 'عنجرة', en: 'Anjara', gov: 'ajloun' },
  { ar: 'ذيبان', en: 'Dhiban', gov: 'madaba' },
  { ar: 'جبل نيبو', en: 'Mount Nebo', gov: 'madaba' },
  { ar: 'مؤتة', en: "Mu'ta", gov: 'karak' },
  { ar: 'الصافي', en: 'Safi', gov: 'karak' },
  { ar: 'دانا', en: 'Dana', gov: 'tafilah' },
  { ar: 'بصيرا', en: 'Busayra', gov: 'tafilah' },
  { ar: 'وادي موسى (البتراء)', en: 'Wadi Musa (Petra)', gov: 'maan' },
  { ar: 'الشوبك', en: 'Shobak', gov: 'maan' },
  { ar: 'وادي رم', en: 'Wadi Rum', gov: 'aqaba' },
  { ar: 'القويرة', en: 'Quweira', gov: 'aqaba' },
];

const optionFor = (g: Governorate, lang: 'ar' | 'en') => ({ id: g.id, label: lang === 'ar' ? g.ar : g.en });

function buildQuestion(place: Place, lang: 'ar' | 'en', rng: () => number): TextQuestion {
  const home = GOVERNORATES.find(g => g.id === place.gov)!;
  const others = GOVERNORATES.filter(g => g.id !== home.id).map(g => optionFor(g, lang));
  return {
    promptKey: 'playGovernoratesPrompt',
    subject: lang === 'ar' ? place.ar : place.en,
    options: withDistractors(optionFor(home, lang), others, 3, rng),
    correctId: home.id,
  };
}

/** `count` questions, each on a different place. */
export function buildGovernorateRound(lang: 'ar' | 'en', count: number, rng: () => number = Math.random): TextQuestion[] {
  return sample(PLACES, count, rng).map(p => buildQuestion(p, lang, rng));
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameGovernorates.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Wire it up**

- `gradeBands.ts`: old `  'antonyms', 'plurals', 'numberType', 'fractions', 'matter',\n] as const;` → `  'antonyms', 'plurals', 'numberType', 'fractions', 'matter', 'governorates',\n] as const;`; old `  matter: [[3, 7]],\n};` → `  matter: [[3, 7]],\n  governorates: [[4, 9]],\n};`.
- `i18n.ts` AR:
  ```ts
      playGovernoratesTitle: 'محافظات الأردن',
      playGovernoratesDesc: 'اربط كل مدينة ومعلم بمحافظته',
      playGovernoratesPrompt: 'في أيّ محافظة يقع هذا المكان؟',
  ```
  EN:
  ```ts
      playGovernoratesTitle: "Jordan's Governorates",
      playGovernoratesDesc: 'Match each town and site to its governorate',
      playGovernoratesPrompt: 'Which governorate is this place in?',
  ```
- `app/play/governorates.tsx` (`GovernoratesGameScreen`): `build={buildGovernorateRound}` from `@/services/publicGames/governorates`, `titleKey="playGovernoratesTitle"`, `accent="#1E3A8A"`.
- `app/play/index.tsx` entry: `  { id: 'governorates', route: '/play/governorates', icon: 'map-outline', color: '#1E3A8A', titleKey: 'playGovernoratesTitle', descKey: 'playGovernoratesDesc' },`
- `routeGating.test.ts`: old `'/play/matter']` → `'/play/matter', '/play/governorates']`.
- `gameAccents.test.ts`: add `  ['app', 'play', 'governorates.tsx'],\n` after the `matter.tsx` line. `gameAmber.test.ts`: old `['app', 'play', 'matter.tsx'],` → `['app', 'play', 'matter.tsx'], ['app', 'play', 'governorates.tsx'],`.

- [ ] **Step 7: Run guard tests, typecheck, read output**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types --test services/__tests__/playGameGovernorates.test.ts services/__tests__/gameAccents.test.ts services/__tests__/gameAmber.test.ts services/__tests__/routeGating.test.ts services/__tests__/publicGamesGrades.test.ts services/__tests__/i18n.test.ts services/__tests__/i18nTerminology.test.ts` — Expected: PASS. Then `pnpm run typecheck` from the repo root — Expected: clean.

- [ ] **Step 8: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/publicGames/governorates.ts artifacts/mobile/services/publicGames/gradeBands.ts artifacts/mobile/app/play/governorates.tsx artifacts/mobile/app/play/index.tsx artifacts/mobile/services/i18n.ts artifacts/mobile/services/__tests__/playGameGovernorates.test.ts artifacts/mobile/services/__tests__/gameAccents.test.ts artifacts/mobile/services/__tests__/gameAmber.test.ts artifacts/mobile/services/__tests__/routeGating.test.ts
git diff --cached --stat
git commit -m "Play hub: Jordan's governorates game (محافظات الأردن)" -m "Answer key checked against: <list the sources you used in Step 1>

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbarCroqQZNf6E4KKf"
```

---

### Task 7: Chat help, Arabic review, browser check, docs, PR

**Files:** Modify `artifacts/mobile/services/appHelp.ts` (+ its test), `docs/status-log.md`; no new code files.

**Interfaces:**
- Consumes: all six games from Tasks 1–6.

- [ ] **Step 1: Teach the chat assistant the new game names**

In `artifacts/mobile/services/appHelp.ts` (the `tool:games` rule, near line 1990):
- English: Edit old `(?:memory|colou?rs?|flags?|capitals?|elements?|times\s+tables?|multiplication|division|addition|subtraction)\s+(?:game|challenge)` → new `(?:memory|colou?rs?|flags?|capitals?|elements?|times\s+tables?|multiplication|division|addition|subtraction|opposites?|antonyms?|plurals?|fractions?|governorates?|states\s+of\s+matter|(?:even|odd|prime)\s+numbers?)\s+(?:game|challenge)`.
- Arabic (text is normalised: ة→ه, أ/إ→ا, diacritics stripped): Edit old `(?:ذاكره|الوان|اعلام|عواصم|رموز\s+(?:ال)?عناصر|جدول\s+(?:ال)?ضرب|جمع|طرح|ضرب|قسمه)` → new `(?:ذاكره|الوان|اعلام|عواصم|رموز\s+(?:ال)?عناصر|جدول\s+(?:ال)?ضرب|جمع|طرح|ضرب|قسمه|اضداد|ضد\s+(?:ال)?كلمه|كسور|محافظات|حالات\s+(?:ال)?ماده)`; keep `جمع` as is (it already means the addition game, so «لعبة جمع الكلمة» is deliberately not matched).
- Read `services/__tests__/` for the file that exercises `tool:games` (`grep -ln "tool:games" services/__tests__/*.ts`) and add one English and one Arabic positive case next to the existing ones, in the same style (e.g. «play the fractions game», «العب لعبة محافظات»), and one negative case (a sentence that mentions fractions without play/open/start must not match).
- Run that test file; Expected: PASS. If the file does not exist, say so in the PR body and skip the test (do not invent one).

- [ ] **Step 2: Arabic copy review**

Invoke the `anthropic-skills:arabic-copy-reviewer` skill over every new Arabic string: the `play…Title/Desc/Prompt` keys added to `i18n.ts`, and the words in `antonyms.ts`, `plurals.ts`, `matterStates.ts`, `governorates.ts`. Apply only fixes that are plainly correct (spelling, hamza, shadda, a wrong plural). Any change to an answer-key word reruns that game's test file. Note the brand rule: none of these strings may contain the brand «اقرأ» in quotes-form; the verb «اقرأ» is allowed.

- [ ] **Step 3: Full verification**

Run, in this order, and record the output tails:
```bash
cd /home/user/Iqraa && pnpm run typecheck
cd /home/user/Iqraa/artifacts/mobile && pnpm test
```
Expected: typecheck clean; mobile suite all green (it prints nothing until it finishes, which takes minutes). If anything fails, use the systematic-debugging skill; do not edit a failing guard test to pass.

- [ ] **Step 4: Browser check**

Run the web build: `cd /home/user/Iqraa && pnpm run dev:mobile:web` (port 8081), open `/play` with the Playwright MCP tools. Check, at phone width (390×844) and desktop width:
1. The hub shows 16 tiles; the six new ones have the right icon, colour and grade chip (`gradeBandLabel`).
2. Open each game, answer a question right and one wrong: the green/red reveal, the score, and the final screen with the teacher-signup CTA all appear.
3. Arabic (RTL): the subject tile and options read correctly, fractions print as «٣/٤» in the left-to-right order typed, not mirrored.
4. Dark mode (`prefers-color-scheme`): the subject text in each tile is readable.
5. English UI: the prompts are English, the plurals game still shows Arabic words.
Take one screenshot of the hub and one of a fractions question; save them under the scratchpad, not the repo. If any of 1–5 fails, fix it with the same TDD loop (a pure-logic bug gets a failing test first).

- [ ] **Step 5: Write the status-log entry**

Read the top 40 lines of `docs/status-log.md` to copy the entry format, then add a new entry at the TOP titled «Six new /play games: opposites, plurals, which-number, compare-fractions, states of matter, governorates — 2026-10-29». It must state what was built, **what was and was not verified** (the test counts; that the answer keys for opposites/plurals/matter/governorates are hand-written and were read by the author and reviewed with the Arabic-copy skill, not machine-verified; that governorate rows were checked against the sources named in the commit; that maths keys are computed and re-derived independently in the tests), the known limits (plurals show Arabic in the English UI; no sound/analytics beyond `GameShell`'s own `game_finished` event; ~27/30/20/26 items per data table so a round repeats across plays), and the deviations from the spec (governorates asks about towns not centres; fractions titled «قارن الكسور»). Do not touch `STATUS.md` unless a line in it stopped being true (check its "games" lines: `grep -n -i "game" STATUS.md`).

- [ ] **Step 6: Commit, push, update the PR**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/appHelp.ts docs/status-log.md docs/superpowers/plans/2026-10-29-play-hub-six-games.md docs/superpowers/specs/2026-10-29-play-hub-six-games-design.md
# also add the appHelp test file you edited in Step 1, and any Arabic fixes from Step 2, by name
git diff --cached --stat
git commit -m "Play hub: chat help knows the new games; status-log entry" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbarCroqQZNf6E4KKf"
git push -u origin ccr-c35bc284-4ljn3c
```
Then update PR #1345 with `mcp__github__update_pull_request`: retitle to «Six new /play games: opposites, plurals, which-number, compare-fractions, states of matter, governorates», and rewrite the body to describe the games, the verification actually run (paste the test and typecheck tails), the spec deviations, and the draft status; end the body with the two attribution lines (`🤖 Generated with [Claude Code](https://claude.com/claude-code)` and the session URL). Leave it a draft. Do not merge.
