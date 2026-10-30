# /play Games Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every `TriviaBoard` game a "why" line after each answer, sound + haptics with a mute button, answer motion and a streak chip, a saved personal best with "retry the ones you missed", and give the governorates game a Jordan map shown after the answer — adding about 30 KB and no native module.

**Architecture:** Pure, injectable-storage modules in `services/publicGames/` carry the logic and are tested under `node --test`; thin device bindings (`playStore.ts`, `playFeedback.ts`) wrap AsyncStorage / expo-audio / expo-haptics; `TriviaBoard` (`components/publicGames/TriviaGame.tsx`) gains optional props and small helper components. Each task ships one change and leaves every test green.

**Tech Stack:** TypeScript, Expo Router / React Native (+ web build), `react-native-svg`, `expo-audio`, `expo-haptics`, `node --test` with `--experimental-strip-types` (relative imports in `services/` and `scripts/` need an explicit `.ts` extension), pnpm.

**Spec:** `docs/superpowers/specs/2026-10-30-play-games-enhancements-design.md`

## Global Constraints

- Work in `/home/user/Iqraa` on branch `ccr-c35bc284-4ljn3c` (restarted from `main` at 25ab6ef). Never push to `main`. Implementers commit but do **not** push and do not touch any PR; the controller pushes.
- Run one test file with the package's own flags: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/<file>.test.ts`. Full suite: `cd /home/user/Iqraa/artifacts/mobile && pnpm test` (silent for minutes; not a hang). Typecheck: `cd /home/user/Iqraa && pnpm run typecheck`. Dependencies are installed; do not run `pnpm install`.
- **No native change.** `expo-audio`, `expo-haptics`, `react-native-svg`, `@react-native-async-storage/async-storage` are already dependencies. Do not add a dependency and do not touch `app.json`.
- **No literal `fontSize`, and no hand-written spacing/radius, in new or edited UI.** Use `TYPE`, `SPACE`, `RADIUS` from `@/constants/theme` and `ICON` from `@/constants/icons`. `services/__tests__/designScale.test.ts` pins a ceiling with no slack; moving a literal out of `TriviaGame.tsx` into a token only lowers the count — if that test is a ratchet that now demands a lower ceiling, lower it and say so in your report.
- Colours come from `useColors()`, never from `palette` (`cornerTheme.test.ts`). Text or a glyph in a game's accent colour on a card goes through `readableOn(accent, colors.card[, 3])` from `@/services/readableColor`. The right/wrong greens and reds already in `TriviaBoard` (`#16A34A`, `#DC2626`) stay.
- Icons: Ionicons, sizes from `ICON` (never a bare number), outline for actions and filled for status; never an emoji for a tick, cross, flame or speaker. State is declared with `aria-*` props, never `accessibilityState` (`ariaState.test.ts`).
- Maths is computed in latin and converted with `toArabicDigits` (`services/labFormat.ts`) only for display. Arabic-Indic digits next to `=`, `≈` or `/` go through `forceLtr` (`services/mathCalc.ts`) in their own `Text`; never put an operator inside a sentence of Arabic.
- Arabic is the product language; the Latin product name is **Iqrra** in copy. No `sed -i` / `perl -pi` on source; use the Edit tool. Commit with `git add <named paths>` only and check `git diff --cached --stat` (no `Bin N -> M bytes` on a text file).
- Every commit ends with exactly:
  ```
  Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VikuhbarCroqQZNf6E4KKf
  ```
- Sound and haptics cannot be heard or felt in this environment. Say so in reports; test the logic and that the code path runs.

## File Structure

Create (all under `artifacts/mobile/`):
- `services/publicGames/kvStore.ts` — the `KeyValueStore` type
- `services/publicGames/feedbackPrefs.ts` — mute preference, injectable store
- `services/publicGames/bestScore.ts` — personal best, injectable store
- `services/publicGames/answerMotion.ts` — motion constants + `nextStreak`
- `services/publicGames/jordanMapData.ts` — **generated** map data
- `services/playStore.ts` — AsyncStorage binding
- `services/playFeedback.ts` — sound + haptics + mute state
- `scripts/make-wrong-cue.ts`, `scripts/build-jordan-map.ts`, `scripts/data/jordan-adm1-geoboundaries.geojson`
- `assets/sounds/wrong.wav` — generated
- `components/publicGames/AnswerOption.tsx`, `components/publicGames/JordanMap.tsx`
- tests under `services/__tests__/`: `playGameExplanations`, `feedbackPrefs`, `wrongCue`, `playFeedbackWiring`, `answerMotion`, `bestScore`, `playBestWiring`, `jordanMapData`, `jordanMapWiring` (`.test.ts`)

Modify: `services/publicGames/textQuiz.ts`, `antonyms.ts`, `plurals.ts`, `numberType.ts`, `fractions.ts`, `matterStates.ts`, `governorates.ts`, `components/publicGames/TriviaGame.tsx`, `TextQuizGame.tsx`, `GameShell.tsx`, `app/play/governorates.tsx`, `services/gameSounds.ts`, `services/i18n.ts`, `docs/status-log.md`.

---

### Task 1: A one-line "why" after each answer

**Files:**
- Modify: `services/publicGames/{textQuiz,antonyms,plurals,numberType,fractions,matterStates,governorates}.ts`, `components/publicGames/TriviaGame.tsx`, `components/publicGames/TextQuizGame.tsx`
- Create: `services/__tests__/playGameExplanations.test.ts`

**Interfaces:**
- Produces: `TextQuestion.explanation?: string`, `TextQuestion.explanationLtr?: string`; `TriviaBoard` prop `renderReveal?: (question: Q, pickedId: string) => React.ReactNode`; `STATE_DEFINITION` exported from `matterStates.ts`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/playGameExplanations.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeRng } from '../publicGames/rng.ts';
import type { TextQuestion } from '../publicGames/textQuiz.ts';
import { buildAntonymRound } from '../publicGames/antonyms.ts';
import { buildPluralRound } from '../publicGames/plurals.ts';
import { buildNumberRound } from '../publicGames/numberType.ts';
import { buildFractionRound } from '../publicGames/fractions.ts';
import { buildMatterRound, STATE_DEFINITION, SUBSTANCES } from '../publicGames/matterStates.ts';
import { buildGovernorateRound } from '../publicGames/governorates.ts';
import { toArabicDigits } from '../labFormat.ts';

const seeds = Array.from({ length: 60 }, (_, i) => i + 1);
const langs = ['ar', 'en'] as const;
const answerLabel = (q: TextQuestion) => q.options.find(o => o.id === q.correctId)!.label;
const latin = (s: string) => s.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660)).replace(/٫/g, '.');

function eachQuestion(build: (lang: 'ar' | 'en', n: number, rng: () => number) => TextQuestion[], fn: (q: TextQuestion, lang: 'ar' | 'en') => void) {
  for (const lang of langs) for (const seed of seeds) for (const q of build(lang, 8, makeRng(seed))) fn(q, lang);
}

test('opposites, plurals and governorates explain by restating the key, naming the subject and the answer', () => {
  for (const build of [buildAntonymRound, buildPluralRound, buildGovernorateRound]) {
    eachQuestion(build, q => {
      assert.ok(q.explanation && q.explanation.length > 0);
      assert.ok(q.explanation.includes(q.subject!), `${q.explanation} lacks ${q.subject}`);
      assert.ok(q.explanation.includes(answerLabel(q)), `${q.explanation} lacks ${answerLabel(q)}`);
      assert.equal(q.explanationLtr, undefined);
    });
  }
});

test('states of matter: the line names the substance, its state and that state\'s definition', () => {
  const stateLabel = { solid: { ar: 'صلب', en: 'Solid' }, liquid: { ar: 'سائل', en: 'Liquid' }, gas: { ar: 'غاز', en: 'Gas' } };
  assert.equal(SUBSTANCES.length >= 20, true);
  eachQuestion(buildMatterRound, (q, lang) => {
    const state = q.correctId as 'solid' | 'liquid' | 'gas';
    assert.ok(q.explanation!.includes(q.subject!));
    assert.ok(q.explanation!.includes(stateLabel[state][lang]));
    assert.ok(q.explanation!.includes(STATE_DEFINITION[state][lang]));
  });
});

test('which number: the line carries the answer in the right digits and the right property', () => {
  const word = {
    playNumberEvenPrompt: { ar: 'زوجي', en: 'even' },
    playNumberOddPrompt: { ar: 'فردي', en: 'odd' },
    playNumberPrimePrompt: { ar: 'أولي', en: 'prime' },
  } as const;
  eachQuestion(buildNumberRound, (q, lang) => {
    const n = q.correctId;
    assert.ok(q.explanation!.includes(lang === 'ar' ? toArabicDigits(n) : n), q.explanation);
    assert.ok(q.explanation!.includes(word[q.promptKey as keyof typeof word][lang]), q.explanation);
    assert.equal(q.explanationLtr, undefined);
    // No operator inside a sentence of Arabic.
    assert.doesNotMatch(q.explanation!, /[=×÷+−≈]/);
  });
});

test('fractions: the LTR line gives both decimals, in option order, with = only when exact', () => {
  eachQuestion(buildFractionRound, (q, lang) => {
    assert.ok(q.explanation && q.explanation.length > 0);
    const line = q.explanationLtr!.replace(/[\u202D\u202C]/g, '');
    const parts = line.split('    ');
    assert.equal(parts.length, 2);
    parts.forEach((part, i) => {
      const m = /^([0-9٠-٩]+)\/([0-9٠-٩]+) (=|≈) ([0-9٠-٩]+[.٫][0-9٠-٩]+)$/.exec(part);
      assert.ok(m, `bad part «${part}»`);
      const [n, d] = [Number(latin(m[1]!)), Number(latin(m[2]!))];
      assert.equal(q.options[i]!.id, `${n}/${d}`, 'parts follow option order');
      const dec = Number(latin(m[4]!));
      assert.ok(Math.abs(dec - n / d) <= 0.005 + 1e-9, `${part}: ${dec} vs ${n / d}`);
      const exact = Number((n / d).toFixed(2)) === n / d;
      assert.equal(m[3], exact ? '=' : '≈', part);
      if (lang === 'ar') assert.doesNotMatch(part, /[0-9]/); // Arabic-Indic digits only
    });
  });
});

test('the board and the text-quiz renderer show a reveal', () => {
  const root = join(import.meta.dirname, '..', '..');
  const board = readFileSync(join(root, 'components', 'publicGames', 'TriviaGame.tsx'), 'utf8');
  const quiz = readFileSync(join(root, 'components', 'publicGames', 'TextQuizGame.tsx'), 'utf8');
  assert.match(board, /renderReveal\?:/);
  assert.match(board, /renderReveal\(question, selected\)/);
  assert.match(board, /ScrollView/);
  assert.match(quiz, /renderReveal=/);
  assert.match(quiz, /explanationLtr/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/playGameExplanations.test.ts`
Expected: FAIL — `STATE_DEFINITION` is not exported (and `explanation` is undefined).

- [ ] **Step 3: Extend `TextQuestion`**

In `services/publicGames/textQuiz.ts`, replace the `TextQuestion` interface with:

```ts
export interface TextQuestion {
  promptKey: TranslationKey;
  /** A word, number or place shown in a tile above the prompt. Absent when the options are the whole question. */
  subject?: string;
  options: TriviaOption[];
  correctId: string;
  /** One line shown under the revealed answer, already in the question's language. Never holds an operator next to Arabic-Indic digits. */
  explanation?: string;
  /** A pure number line (digits, `/`, `=`, `≈`), drawn in its own left-to-right Text. Already wrapped in `forceLtr`. */
  explanationLtr?: string;
}
```

- [ ] **Step 4: Add the explanations, game by game**

`antonyms.ts` — in `buildQuestion`, compute `const subjectLabel = lang === 'ar' ? shown.ar : shown.en;`, use it for `subject`, and add to the returned object:
```ts
explanation: lang === 'ar'
  ? `ضدّ «${subjectLabel}» هو «${correct.label}»`
  : `The opposite of "${subjectLabel}" is "${correct.label}"`,
```

`plurals.ts` — thread the language through: rename the currently unused `_lang` parameter of `buildPluralRound` to `lang`, change `buildQuestion(pair, rng)` to `buildQuestion(pair, lang, rng)` (and its caller to `.map(p => buildQuestion(p, lang, rng))`), and add to the returned object:
```ts
explanation: lang === 'ar'
  ? `جمع «${pair.ar}» هو «${pair.pluralAr}»`
  : `The plural of «${pair.ar}» is «${pair.pluralAr}»`,
```

`numberType.ts` — in `buildNumberQuestion`, after choosing `answer`, add (`label` is the existing display helper):
```ts
const shown = label(answer, lang);
const explanation = {
  even: lang === 'ar' ? `${shown} عدد زوجي لأنه يقبل القسمة على ${label(2, 'ar')}` : `${shown} is even because it divides by 2`,
  odd: lang === 'ar' ? `${shown} عدد فردي: إذا قُسم على ${label(2, 'ar')} بقي ${label(1, 'ar')}` : `${shown} is odd: dividing it by 2 leaves 1`,
  prime: lang === 'ar'
    ? `${shown} عدد أولي: لا يقبل القسمة إلا على ${label(1, 'ar')} وعلى نفسه`
    : `${shown} is prime: only 1 and ${shown} divide it`,
}[kind];
```
and add `explanation,` to the returned object. (`label(2, 'en')` would also work; the Arabic branches deliberately force Arabic digits.)

`fractions.ts` — change `questionFor` so the shuffled order is computed once and used for both the options and the explanation:
```ts
const decimal = (f: Fraction, lang: 'ar' | 'en') => {
  const value = f.n / f.d;
  const exact = Number(value.toFixed(2)) === value;
  const raw = id(f);
  const dec = value.toFixed(2);
  const shown = (s: string) => (lang === 'ar' ? toArabicDigits(s) : s);
  return `${shown(raw)} ${exact ? '=' : '≈'} ${shown(dec)}`;
};
```
In `questionFor`: `const ordered = shuffle([a, b], rng);` then `options: ordered.map(f => ({ id: id(f), label: label(f, lang) }))`, `explanation: lang === 'ar' ? 'حوّل كل كسر إلى عدد عشري لتقارن بينهما:' : 'Turn each fraction into a decimal to compare:'`, `explanationLtr: forceLtr(ordered.map(f => decimal(f, lang)).join('    '))`. (`shuffle` is called once as before, so seeded rounds stay deterministic.)

`matterStates.ts` — export the definitions and use them:
```ts
export const STATE_DEFINITION: Record<MatterState, { ar: string; en: string }> = {
  solid: { ar: 'الصلب له شكل ثابت', en: 'A solid keeps its own shape' },
  liquid: { ar: 'السائل يأخذ شكل الإناء الذي يوضع فيه', en: 'A liquid takes the shape of its container' },
  gas: { ar: 'الغاز ينتشر ليملأ المكان الذي يوجد فيه', en: 'A gas spreads out to fill the space it is in' },
};
```
and in `buildQuestion` add `explanation: \`${lang === 'ar' ? s.ar : s.en}: ${STATE_LABEL[s.state][lang]}. ${STATE_DEFINITION[s.state][lang]}\``.

`governorates.ts` — in `buildQuestion` add:
```ts
explanation: lang === 'ar'
  ? `«${place.ar}» ضمن محافظة ${home.ar}`
  : `${place.en} is in ${home.en} Governorate`,
```
(the Arabic is deliberately gender-neutral: «ضمن», not «تقع»/«يقع».)

- [ ] **Step 5: Show it — the board and the renderer**

`components/publicGames/TriviaGame.tsx`:
- import `ScrollView`: `import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';`
- add to the `TriviaBoard` props type `renderReveal?: (question: Q, pickedId: string) => React.ReactNode;` (document it: "shown under the options once an answer is picked") and to the destructuring list.
- replace `<View style={{ flex: 1, padding: 20, gap: 20 }}>` … its closing `</View>` (the one just before `</GameShell>`) with `<ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, padding: 20, gap: 20 }}>` … `</ScrollView>`, so a long reveal can never push the Next button off a small phone.
- immediately after the options-grid `</View>` add: `{selected && renderReveal ? renderReveal(question, selected) : null}`.

`components/publicGames/TextQuizGame.tsx`: read `isRTL` from `useLanguage()` (`const { t, isRTL } = useLanguage();`), add `RADIUS` to the theme import (already imports `SPACE`, `TYPE`), and add:

```tsx
  const renderReveal = (q: TextQuestion) =>
    q.explanation || q.explanationLtr ? (
      <View style={[styles.reveal, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {q.explanation ? (
          <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.body, textAlign: isRTL ? 'right' : 'left' }}>
            {q.explanation}
          </Text>
        ) : null}
        {q.explanationLtr ? (
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg, textAlign: 'center' }}>
            {q.explanationLtr}
          </Text>
        ) : null}
      </View>
    ) : null;
```
pass `renderReveal={renderReveal}` to `<TriviaBoard …/>`, and add to `StyleSheet.create`: `reveal: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACE.md, gap: SPACE.sm },`.

- [ ] **Step 6: Run the tests and typecheck**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/playGameExplanations.test.ts services/__tests__/playGameAntonyms.test.ts services/__tests__/playGamePlurals.test.ts services/__tests__/playGameNumberType.test.ts services/__tests__/playGameFractions.test.ts services/__tests__/playGameMatter.test.ts services/__tests__/playGameGovernorates.test.ts services/__tests__/designScale.test.ts services/__tests__/cornerTheme.test.ts services/__tests__/gameAccents.test.ts services/__tests__/gameAmber.test.ts`
Expected: all PASS (the old per-game tests, including seeded-determinism ones, still pass). Then `cd /home/user/Iqraa && pnpm run typecheck` — Expected: clean.

- [ ] **Step 7: Read the output yourself**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --input-type=module -e "import {buildNumberRound} from './services/publicGames/numberType.ts'; import {buildFractionRound} from './services/publicGames/fractions.ts'; import {buildMatterRound} from './services/publicGames/matterStates.ts'; import {buildGovernorateRound} from './services/publicGames/governorates.ts'; import {makeRng} from './services/publicGames/rng.ts'; for (const [n,b] of [['num',buildNumberRound],['frac',buildFractionRound],['matter',buildMatterRound],['gov',buildGovernorateRound]]) for (const lang of ['ar','en']) for (const q of b(lang,3,makeRng(3))) console.log(n, lang, '|', q.explanation, '|', (q.explanationLtr||'').replace(/[\u202D\u202C]/g,''))"`
Read every line: each must be true (a prime really prime, decimals right, a state right) and read as natural Arabic / English.

- [ ] **Step 8: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/publicGames/textQuiz.ts artifacts/mobile/services/publicGames/antonyms.ts artifacts/mobile/services/publicGames/plurals.ts artifacts/mobile/services/publicGames/numberType.ts artifacts/mobile/services/publicGames/fractions.ts artifacts/mobile/services/publicGames/matterStates.ts artifacts/mobile/services/publicGames/governorates.ts artifacts/mobile/components/publicGames/TriviaGame.tsx artifacts/mobile/components/publicGames/TextQuizGame.tsx artifacts/mobile/services/__tests__/playGameExplanations.test.ts
git diff --cached --stat
git commit -m "Play hub: a one-line why under every revealed answer" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbarCroqQZNf6E4KKf"
```

---

### Task 2: Sound, haptics and a mute button

**Files:**
- Create: `services/publicGames/kvStore.ts`, `services/publicGames/feedbackPrefs.ts`, `services/playStore.ts`, `services/playFeedback.ts`, `scripts/make-wrong-cue.ts`, `assets/sounds/wrong.wav` (generated), `services/__tests__/{feedbackPrefs,wrongCue,playFeedbackWiring}.test.ts`
- Modify: `services/gameSounds.ts`, `components/publicGames/GameShell.tsx`, `components/publicGames/TriviaGame.tsx`, `services/i18n.ts`

**Interfaces:**
- Produces: `KeyValueStore` (`getItem(key): Promise<string | null>`, `setItem(key, value): Promise<void>`); `SOUND_OFF_KEY`, `loadSoundOn(store): Promise<boolean>`, `saveSoundOn(store, on): Promise<void>`; `playStore: KeyValueStore`; `answerFeedback(correct: boolean): void`, `setSoundOn(on: boolean): void`, `useSoundOn(): boolean`; `GameCue` gains `'wrong'`; `GameShell` prop `showSoundToggle?: boolean`; `makeWrongCue(): Buffer`.

- [ ] **Step 1: Write the failing tests**

`services/__tests__/feedbackPrefs.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_OFF_KEY, loadSoundOn, saveSoundOn } from '../publicGames/feedbackPrefs.ts';
import type { KeyValueStore } from '../publicGames/kvStore.ts';

const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: async k => data.get(k) ?? null, setItem: async (k, v) => { data.set(k, v); } };
};
const broken: KeyValueStore = {
  getItem: async () => { throw new Error('storage unavailable'); },
  setItem: async () => { throw new Error('storage unavailable'); },
};

test('sound is on until someone turns it off', async () => {
  const store = memory();
  assert.equal(await loadSoundOn(store), true);
  await saveSoundOn(store, false);
  assert.equal(store.data.get(SOUND_OFF_KEY), '1');
  assert.equal(await loadSoundOn(store), false);
  await saveSoundOn(store, true);
  assert.equal(await loadSoundOn(store), true);
});

test('a storage that fails leaves sound on and never throws', async () => {
  assert.equal(await loadSoundOn(broken), true);
  await assert.doesNotReject(() => saveSoundOn(broken, false));
});
```

`services/__tests__/wrongCue.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeWrongCue } from '../../scripts/make-wrong-cue.ts';

const file = readFileSync(join(import.meta.dirname, '..', '..', 'assets', 'sounds', 'wrong.wav'));

test('wrong.wav is exactly what the script generates (no hand edits)', () => {
  assert.ok(file.equals(makeWrongCue()));
});

test('wrong.wav is a small, quiet, click-free 16-bit mono PCM clip', () => {
  assert.equal(file.toString('ascii', 0, 4), 'RIFF');
  assert.equal(file.toString('ascii', 8, 12), 'WAVE');
  assert.equal(file.readUInt16LE(20), 1); // PCM
  assert.equal(file.readUInt16LE(22), 1); // mono
  assert.equal(file.readUInt16LE(34), 16);
  assert.ok(file.length < 20_000, `${file.length} bytes`);
  const samples = (file.length - 44) / 2;
  let peak = 0;
  for (let i = 0; i < samples; i++) peak = Math.max(peak, Math.abs(file.readInt16LE(44 + i * 2)));
  assert.ok(peak > 3000 && peak <= 0.31 * 32767, `peak ${peak}`);
  assert.ok(Math.abs(file.readInt16LE(44)) < 200, 'starts at silence');
  assert.ok(Math.abs(file.readInt16LE(44 + (samples - 1) * 2)) < 200, 'ends at silence');
});
```

`services/__tests__/playFeedbackWiring.test.ts` (source-reading, the repo's pattern for files that import native modules):

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

test('the board gives feedback on every answer and asks the shell for the toggle', () => {
  const board = read('components', 'publicGames', 'TriviaGame.tsx');
  assert.match(board, /answerFeedback\(optionId === question\.correctId\)/);
  assert.match(board, /showSoundToggle/);
});

test('the shell draws a mute button that declares its state with aria-pressed', () => {
  const shell = read('components', 'publicGames', 'GameShell.tsx');
  assert.match(shell, /showSoundToggle\?: boolean/);
  assert.match(shell, /aria-pressed=\{!soundOn\}/);
  assert.match(shell, /volume-high-outline/);
  assert.match(shell, /volume-mute-outline/);
  assert.doesNotMatch(shell, /accessibilityState/);
});

test('the wrong cue is registered and the feedback service honours the mute', () => {
  assert.match(read('services', 'gameSounds.ts'), /'wrong'/);
  assert.match(read('services', 'gameSounds.ts'), /wrong\.wav/);
  const fb = read('services', 'playFeedback.ts');
  assert.match(fb, /if \(!soundOn\) return/);
  assert.match(fb, /Platform\.OS !== 'web'/);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/feedbackPrefs.test.ts services/__tests__/wrongCue.test.ts services/__tests__/playFeedbackWiring.test.ts`
Expected: FAIL — modules/files missing.

- [ ] **Step 3: Pure modules**

`services/publicGames/kvStore.ts`:
```ts
/** The two calls the /play games need from a key-value store. AsyncStorage satisfies it; tests pass a Map. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
```

`services/publicGames/feedbackPrefs.ts`:
```ts
/**
 * Whether the /play games make sound. On until someone turns it off; kept on
 * the device, for every game at once. Best-effort: a store that fails leaves
 * sound on and never throws into a game.
 */
import type { KeyValueStore } from './kvStore.ts';

export const SOUND_OFF_KEY = '@iqra_play_sound_off_v1';

export async function loadSoundOn(store: KeyValueStore): Promise<boolean> {
  try {
    return (await store.getItem(SOUND_OFF_KEY)) !== '1';
  } catch {
    return true;
  }
}

export async function saveSoundOn(store: KeyValueStore, on: boolean): Promise<void> {
  try {
    await store.setItem(SOUND_OFF_KEY, on ? '0' : '1');
  } catch {
    // nothing to do
  }
}
```

- [ ] **Step 4: The wrong cue**

`scripts/make-wrong-cue.ts`:
```ts
/**
 * Builds assets/sounds/wrong.wav: two soft descending tones (G4 then D4), 16-bit
 * mono PCM at 22.05 kHz, about 15 KB, peak at 30% so it is quieter than the
 * correct cue, with a 5 ms attack and a 10 ms release so it never clicks.
 * Synthesised, so there is no licence to track. Regenerate with:
 *   cd artifacts/mobile && node --experimental-strip-types scripts/make-wrong-cue.ts
 * wrongCue.test.ts fails if the committed file differs from this output.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RATE = 22050;
const TONES = [{ hz: 392, ms: 150 }, { hz: 294, ms: 190 }];

export function makeWrongCue(): Buffer {
  const samples: number[] = [];
  for (const { hz, ms } of TONES) {
    const n = Math.round((RATE * ms) / 1000);
    for (let i = 0; i < n; i++) {
      const t = i / RATE;
      const attack = Math.min(1, i / (RATE * 0.005));
      const release = Math.min(1, (n - 1 - i) / (RATE * 0.01));
      const decay = Math.exp(-t * 14);
      samples.push(Math.round(0.3 * 32767 * attack * release * decay * Math.sin(2 * Math.PI * hz * t)));
    }
  }
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(s, i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = fileURLToPath(new URL('../assets/sounds/wrong.wav', import.meta.url));
  writeFileSync(out, makeWrongCue());
  console.log('wrote', out);
}
```
Run `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types scripts/make-wrong-cue.ts` to create `assets/sounds/wrong.wav`. (If TypeScript objects to `Buffer` or `import.meta`, fix the script's types, not the test.)

- [ ] **Step 5: Device bindings**

`services/playStore.ts`:
```ts
/** AsyncStorage as a KeyValueStore, for the /play games' small local settings. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from './publicGames/kvStore';

export const playStore: KeyValueStore = {
  getItem: key => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
};
```

`services/gameSounds.ts`: change `export type GameCue = 'correct' | 'timeup' | 'podium';` to include `| 'wrong'` and add `wrong: require('../assets/sounds/wrong.wav'),` to `SOURCES`; update the header comment to mention the cue.

`services/playFeedback.ts`:
```ts
/**
 * Sound and haptics for the /play answer boards, behind one mute. A right answer
 * plays the Class Challenge's «correct» chime, a wrong one a quieter «wrong» cue
 * (services/gameSounds.ts); phones also get a light tap or a soft warning. The
 * mute covers both. Best-effort throughout: a cue or a buzz that cannot play is
 * silent, never an error. On the web the first tap is what lets audio play, and
 * answering is a tap.
 */
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { playGameCue } from './gameSounds';
import { loadSoundOn, saveSoundOn } from './publicGames/feedbackPrefs';
import { playStore } from './playStore';

let soundOn = true;
let touched = false; // the user chose before the saved value came back
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

void loadSoundOn(playStore).then(saved => {
  if (touched) return;
  soundOn = saved;
  emit();
});

export function setSoundOn(on: boolean): void {
  touched = true;
  soundOn = on;
  emit();
  void saveSoundOn(playStore, on);
}

export function useSoundOn(): boolean {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => soundOn,
    () => true,
  );
}

export function answerFeedback(correct: boolean): void {
  if (!soundOn) return;
  playGameCue(correct ? 'correct' : 'wrong');
  if (Platform.OS !== 'web') {
    const buzz = correct
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    void buzz.catch(() => {});
  }
}
```

- [ ] **Step 6: The button and the call**

`components/publicGames/GameShell.tsx`: add imports `import { ICON } from '@/constants/icons';` and `import { setSoundOn, useSoundOn } from '@/services/playFeedback';`; add the prop `showSoundToggle?: boolean;` (doc: "A speaker button that mutes the answer cues; only boards that make sound ask for it") to the destructuring and the props type; call `const soundOn = useSoundOn();` next to the other hooks; and in the header, between the title `Text` and the score badge, add:
```tsx
{showSoundToggle ? (
  <Pressable
    onPress={() => setSoundOn(!soundOn)}
    style={styles.backBtn}
    hitSlop={10}
    accessibilityRole="button"
    accessibilityLabel={t(soundOn ? 'playSoundMute' : 'playSoundUnmute')}
    aria-pressed={!soundOn}
  >
    <Ionicons name={soundOn ? 'volume-high-outline' : 'volume-mute-outline'} size={ICON.xl} color="#fff" />
  </Pressable>
) : null}
```
`components/publicGames/TriviaGame.tsx`: `import { answerFeedback } from '@/services/playFeedback';`, in `pick` after `setSelected(optionId)` add `answerFeedback(optionId === question.correctId);`, and pass `showSoundToggle` to `<GameShell …>`.

`services/i18n.ts` — add after the `playSubtractDesc` line in each block:
AR: `playSoundMute: 'كتم الصوت',` `playSoundUnmute: 'تشغيل الصوت',`
EN: `playSoundMute: 'Mute sound',` `playSoundUnmute: 'Turn sound on',`

- [ ] **Step 7: Run tests and typecheck**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/feedbackPrefs.test.ts services/__tests__/wrongCue.test.ts services/__tests__/playFeedbackWiring.test.ts services/__tests__/i18n.test.ts services/__tests__/iconSystem.test.ts services/__tests__/ariaState.test.ts services/__tests__/designScale.test.ts services/__tests__/cornerTheme.test.ts services/__tests__/gameShellBack.test.ts services/__tests__/gameAccents.test.ts services/__tests__/gameAmber.test.ts` — Expected: PASS. Then `cd /home/user/Iqraa && pnpm run typecheck` — Expected: clean.

- [ ] **Step 8: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/publicGames/kvStore.ts artifacts/mobile/services/publicGames/feedbackPrefs.ts artifacts/mobile/services/playStore.ts artifacts/mobile/services/playFeedback.ts artifacts/mobile/services/gameSounds.ts artifacts/mobile/scripts/make-wrong-cue.ts artifacts/mobile/assets/sounds/wrong.wav artifacts/mobile/components/publicGames/GameShell.tsx artifacts/mobile/components/publicGames/TriviaGame.tsx artifacts/mobile/services/i18n.ts artifacts/mobile/services/__tests__/feedbackPrefs.test.ts artifacts/mobile/services/__tests__/wrongCue.test.ts artifacts/mobile/services/__tests__/playFeedbackWiring.test.ts
git diff --cached --stat
git commit -m "Play hub: answer sound and haptics with a remembered mute button" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbarCroqQZNf6E4KKf"
```

---

### Task 3: Answer motion and a streak chip

**Files:**
- Create: `services/publicGames/answerMotion.ts`, `components/publicGames/AnswerOption.tsx`, `services/__tests__/answerMotion.test.ts`
- Modify: `components/publicGames/TriviaGame.tsx`, `services/i18n.ts`

**Interfaces:**
- Produces: `ANSWER_MOTION` (`shake: readonly number[]`, `shakeStepMs`, `popScale`, `popMs`), `STREAK_SHOW_AT`, `nextStreak(current, correct)`, `showStreak(n)`; `AnswerOption({ label, revealed, isCorrect, isPicked, onPress })`; i18n `playStreak: (n: number) => string`.

- [ ] **Step 1: Write the failing test**

`services/__tests__/answerMotion.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ANSWER_MOTION, STREAK_SHOW_AT, nextStreak, showStreak } from '../publicGames/answerMotion.ts';

test('a streak counts right answers in a row and a wrong one ends it', () => {
  let s = 0;
  for (const correct of [true, true, true, false, true]) s = nextStreak(s, correct);
  assert.equal(s, 1);
  assert.equal(nextStreak(5, false), 0);
  assert.equal(nextStreak(0, true), 1);
});

test('the chip shows from two in a row', () => {
  assert.equal(STREAK_SHOW_AT, 2);
  assert.equal(showStreak(1), false);
  assert.equal(showStreak(2), true);
  assert.equal(showStreak(9), true);
});

test('the shake settles back to rest, and the pop is small and quick', () => {
  assert.equal(ANSWER_MOTION.shake[ANSWER_MOTION.shake.length - 1], 0);
  assert.ok(ANSWER_MOTION.shake.every(v => Math.abs(v) <= 8));
  assert.ok(ANSWER_MOTION.popScale > 1 && ANSWER_MOTION.popScale <= 1.08);
  assert.ok(ANSWER_MOTION.shakeStepMs * ANSWER_MOTION.shake.length <= 400);
});

test('the option animates only when motion is allowed, and the board shows the chip', () => {
  const root = join(import.meta.dirname, '..', '..', 'components', 'publicGames');
  const option = readFileSync(join(root, 'AnswerOption.tsx'), 'utf8');
  assert.match(option, /useReduceMotion\(\)/);
  assert.match(option, /NATIVE_DRIVER/);
  assert.doesNotMatch(option, /fontSize:\s*\d/);
  const board = readFileSync(join(root, 'TriviaGame.tsx'), 'utf8');
  assert.match(board, /<AnswerOption/);
  assert.match(board, /nextStreak\(/);
  assert.match(board, /name="flame"/);
});
```

- [ ] **Step 2: Run to verify it fails**, then **Step 3: write the pure module**

`services/publicGames/answerMotion.ts`:
```ts
/** Timings for the answer boards' feedback, and the streak rule. Pure, so node --test can read it. */
export const ANSWER_MOTION = {
  /** translateX keyframes of a wrong pick's shake, ending at rest. */
  shake: [-6, 6, -4, 4, 0],
  shakeStepMs: 45,
  /** How far the right option swells, and how long each half takes. */
  popScale: 1.05,
  popMs: 120,
} as const;

export const STREAK_SHOW_AT = 2;
export const nextStreak = (current: number, correct: boolean): number => (correct ? current + 1 : 0);
export const showStreak = (streak: number): boolean => streak >= STREAK_SHOW_AT;
```

- [ ] **Step 4: The option component**

`components/publicGames/AnswerOption.tsx` — one answer button; the colours and icons are those `TriviaBoard` draws today (move that JSX here, replacing `fontSize: 15` by `TYPE.body` and the literal paddings/radius by tokens), plus the motion:
```tsx
/**
 * One answer button of a TriviaBoard. Before an answer it is a plain card; after,
 * the right option is green with a tick (and swells once), a wrong pick is red
 * with a cross (and shakes once). Nothing moves under reduced motion.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { NATIVE_DRIVER } from '@/constants/animation';
import { ICON } from '@/constants/icons';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { ANSWER_MOTION } from '@/services/publicGames/answerMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AnswerOption({
  label, revealed, isCorrect, isPicked, onPress,
}: {
  label: string;
  revealed: boolean;
  isCorrect: boolean;
  isPicked: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const reduced = useReduceMotion();
  const x = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!revealed || reduced) return;
    if (isPicked && !isCorrect) {
      Animated.sequence(
        ANSWER_MOTION.shake.map(v => Animated.timing(x, { toValue: v, duration: ANSWER_MOTION.shakeStepMs, useNativeDriver: NATIVE_DRIVER })),
      ).start();
    } else if (isCorrect) {
      Animated.sequence([
        Animated.timing(scale, { toValue: ANSWER_MOTION.popScale, duration: ANSWER_MOTION.popMs, useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(scale, { toValue: 1, duration: ANSWER_MOTION.popMs, useNativeDriver: NATIVE_DRIVER }),
      ]).start();
    }
    // Once per reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  const bg = !revealed ? colors.card : isCorrect ? '#16A34A22' : isPicked ? '#DC262622' : colors.card;
  const border = !revealed ? colors.border : isCorrect ? '#16A34A' : isPicked ? '#DC2626' : colors.border;
  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.option, { backgroundColor: bg, borderColor: border, transform: [{ translateX: x }, { scale }] }]}
    >
      <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.body, textAlign: 'center' }}>{label}</Text>
      {revealed && isCorrect && <Ionicons name="checkmark-circle" size={ICON.xl} color="#16A34A" style={styles.icon} />}
      {revealed && isPicked && !isCorrect && <Ionicons name="close-circle" size={ICON.xl} color="#DC2626" style={styles.icon} />}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  option: {
    flexBasis: '47%', flexGrow: 1, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACE.lg, paddingHorizontal: SPACE.md,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: SPACE.sm,
  },
  icon: { marginTop: -SPACE.xxs },
});
```
(The old icons were `size={20}`; `ICON.xl` is 24. If `iconSystem.test.ts` or the browser check shows the cross/tick too large, use `ICON.lg` (20), which is on the scale too.)

- [ ] **Step 5: Use it in the board; add the chip**

`components/publicGames/TriviaGame.tsx`:
- import `AnswerOption`, `nextStreak, showStreak` from `@/services/publicGames/answerMotion`, `readableOn` from `@/services/readableColor`, `ICON` from `@/constants/icons`, `RADIUS, SPACE, TYPE` from `@/constants/theme`.
- state `const [streak, setStreak] = useState(0);`; in `pick`, after the feedback call: `setStreak(s => nextStreak(s, optionId === question.correctId));`; in `replay`: `setStreak(0);`.
- replace the `question.options.map(o => { … <Pressable …>…</Pressable> })` body with `<AnswerOption key={o.id} label={o.label} revealed={selected !== null} isCorrect={o.id === question.correctId} isPicked={o.id === selected} onPress={() => pick(o.id)} />`; delete the now-unused `styles.option` / `styles.optionIcon` entries.
- replace the progress `Text` with a row:
```tsx
<View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' }}>
  <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption, textAlign: isRTL ? 'right' : 'left' }}>
    {t('playQuestionProgress', index + 1, questions.length)}
  </Text>
  {showStreak(streak) ? (
    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.pill, backgroundColor: `${accent}1a` }}>
      <Ionicons name="flame" size={ICON.md} color={readableOn(accent, colors.card, 3)} />
      <Text style={{ color: readableOn(accent, colors.card), fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.caption }}>{t('playStreak', streak)}</Text>
    </View>
  ) : null}
</View>
```
`services/i18n.ts` — add after `playSubtractDesc`: AR `playStreak: (n: number) => \`${n} متتالية\`,` EN `playStreak: (n: number) => \`${n} in a row\`,`.

- [ ] **Step 6: Tests, typecheck, commit**

Run the new test, the other `playGame*` tests, `i18n`, `designScale`, `iconSystem`, `cornerTheme`, `gameAccents`, `gameAmber`, then `pnpm run typecheck`. Expected: all green. Commit `answerMotion.ts`, `AnswerOption.tsx`, `TriviaGame.tsx`, `i18n.ts`, `answerMotion.test.ts` with the message `Play hub: answer motion and a streak chip` and the standard trailers.

---

### Task 4: Personal best and "retry the ones you missed"

**Files:**
- Create: `services/publicGames/bestScore.ts`, `services/__tests__/{bestScore,playBestWiring}.test.ts`
- Modify: `components/publicGames/TriviaGame.tsx`, `components/publicGames/GameShell.tsx`, `services/i18n.ts`

**Interfaces:**
- Consumes: `KeyValueStore` (Task 2), `playStore` (Task 2).
- Produces: `Best`, `BestResult`, `bestKey(gameKey)`, `isBetter(next, prev)`, `loadBest(store, gameKey)`, `recordBest(store, gameKey, result)`; `GameShell` prop `secondaryAction?: { label: string; onPress: () => void }`; i18n `playBestScore(score, total)`, `playNewBest`, `playRetryMissed(n)`.

- [ ] **Step 1: Write the failing tests**

`services/__tests__/bestScore.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestKey, isBetter, loadBest, recordBest } from '../publicGames/bestScore.ts';
import type { KeyValueStore } from '../publicGames/kvStore.ts';

const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: async k => data.get(k) ?? null, setItem: async (k, v) => { data.set(k, v); } };
};
const broken: KeyValueStore = {
  getItem: async () => { throw new Error('x'); },
  setItem: async () => { throw new Error('x'); },
};

test('better compares the share right, so rounds of different length are fair', () => {
  assert.equal(isBetter({ score: 6, total: 8 }, { score: 5, total: 8 }), true);
  assert.equal(isBetter({ score: 3, total: 4 }, { score: 5, total: 8 }), true); // 75% vs 62.5%
  assert.equal(isBetter({ score: 4, total: 8 }, { score: 2, total: 4 }), false); // equal
  assert.equal(isBetter({ score: 1, total: 8 }, { score: 5, total: 8 }), false);
});

test('the first play sets the best but is not a "new best"', async () => {
  const store = memory();
  const r = await recordBest(store, 'playFlagsTitle', { score: 5, total: 8 });
  assert.deepEqual(r, { best: { score: 5, total: 8 }, previous: null, isNewBest: false });
  assert.deepEqual(await loadBest(store, 'playFlagsTitle'), { score: 5, total: 8 });
});

test('a better round replaces the best; an equal or worse one keeps it', async () => {
  const store = memory();
  await recordBest(store, 'g', { score: 5, total: 8 });
  const up = await recordBest(store, 'g', { score: 7, total: 8 });
  assert.equal(up.isNewBest, true);
  assert.deepEqual(up.best, { score: 7, total: 8 });
  const same = await recordBest(store, 'g', { score: 7, total: 8 });
  assert.equal(same.isNewBest, false);
  const down = await recordBest(store, 'g', { score: 2, total: 8 });
  assert.equal(down.isNewBest, false);
  assert.deepEqual(down.best, { score: 7, total: 8 });
  assert.deepEqual(await loadBest(store, 'g'), { score: 7, total: 8 });
});

test('games keep separate bests', async () => {
  const store = memory();
  await recordBest(store, 'a', { score: 8, total: 8 });
  assert.equal(await loadBest(store, 'b'), null);
  assert.equal(bestKey('a'), '@iqra_play_best_v1:a');
});

test('a corrupt entry is ignored, and a failing store never throws', async () => {
  const store = memory();
  store.data.set(bestKey('g'), '{"score":9,"total":8}');
  assert.equal(await loadBest(store, 'g'), null);
  store.data.set(bestKey('g'), 'not json');
  assert.equal(await loadBest(store, 'g'), null);
  const r = await recordBest(broken, 'g', { score: 3, total: 8 });
  assert.deepEqual(r, { best: { score: 3, total: 8 }, previous: null, isNewBest: false });
});

test('an empty round (total 0) is never recorded', async () => {
  const store = memory();
  const r = await recordBest(store, 'g', { score: 0, total: 0 });
  assert.equal(store.data.size, 0);
  assert.equal(r.isNewBest, false);
});
```

`services/__tests__/playBestWiring.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..', 'components', 'publicGames');
const board = readFileSync(join(root, 'TriviaGame.tsx'), 'utf8');
const shell = readFileSync(join(root, 'GameShell.tsx'), 'utf8');

test('a full round records the best, a retry round does not', () => {
  assert.match(board, /recordBest\(playStore, titleKey/);
  assert.match(board, /if \(!gameOver \|\| retryQuestions\) return/);
});

test('missed questions are collected and offered back through the shell', () => {
  assert.match(board, /setMissed\(/);
  assert.match(board, /secondaryAction=/);
  assert.match(shell, /secondaryAction\?:/);
  assert.match(shell, /secondaryAction\.onPress/);
});
```

- [ ] **Step 2: Run to verify they fail**, then **Step 3: write `bestScore.ts`**

```ts
/**
 * A personal best per /play game, kept on the device. Compared by share right,
 * so a retry-length round and a full one are measured fairly (the board still
 * records full rounds only). The first play sets the best without calling it new.
 * Best-effort: a store that fails never throws into a game.
 */
import type { KeyValueStore } from './kvStore.ts';

export interface Best {
  score: number;
  total: number;
}
export interface BestResult {
  best: Best;
  previous: Best | null;
  isNewBest: boolean;
}

export const bestKey = (gameKey: string): string => `@iqra_play_best_v1:${gameKey}`;

const valid = (b: unknown): b is Best =>
  typeof b === 'object' && b !== null &&
  Number.isInteger((b as Best).score) && Number.isInteger((b as Best).total) &&
  (b as Best).total > 0 && (b as Best).score >= 0 && (b as Best).score <= (b as Best).total;

/** `next` has a strictly larger share right than `prev`. */
export const isBetter = (next: Best, prev: Best): boolean => next.score * prev.total > prev.score * next.total;

export async function loadBest(store: KeyValueStore, gameKey: string): Promise<Best | null> {
  try {
    const raw = await store.getItem(bestKey(gameKey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return valid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function recordBest(store: KeyValueStore, gameKey: string, result: Best): Promise<BestResult> {
  const previous = await loadBest(store, gameKey);
  if (!valid(result)) return { best: previous ?? result, previous, isNewBest: false };
  const better = previous === null || isBetter(result, previous);
  if (better) {
    try {
      await store.setItem(bestKey(gameKey), JSON.stringify(result));
    } catch {
      // the best is lost, the game is not
    }
  }
  return { best: better ? result : previous!, previous, isNewBest: previous !== null && better };
}
```

- [ ] **Step 4: The shell's second button**

`components/publicGames/GameShell.tsx`: add prop `secondaryAction?: { label: string; onPress: () => void };` (doc: "An extra button between Play again and Back, e.g. «retry the ones you missed»") and, in the game-over panel right after the Play-again `<Button …/>`, render `{secondaryAction ? <Button label={secondaryAction.label} onPress={secondaryAction.onPress} variant="secondary" fullWidth /> : null}`.

- [ ] **Step 5: The board**

`components/publicGames/TriviaGame.tsx`:
- imports: `useEffect` from react; `recordBest, type BestResult` from `@/services/publicGames/bestScore`; `playStore` from `@/services/playStore`.
- state: `const [missed, setMissed] = useState<Q[]>([]);`, `const [retryQuestions, setRetryQuestions] = useState<Q[] | null>(null);`, `const [bestInfo, setBestInfo] = useState<BestResult | null>(null);`.
- rename the existing `questions` memo to `built` and add `const questions: Q[] = retryQuestions ?? built;` (everything after uses `questions`).
- in `pick`, when wrong: `if (optionId !== question.correctId) setMissed(m => [...m, question]);`.
- `replay` also does `setRetryQuestions(null); setMissed([]); setBestInfo(null);`.
- add `const retryMissed = () => { setRetryQuestions(missed); setMissed([]); setBestInfo(null); setIndex(0); setScore(0); setSelected(null); setStreak(0); setGameOver(false); };`
- add the effect:
```tsx
useEffect(() => {
  if (!gameOver || retryQuestions) return;
  let alive = true;
  void recordBest(playStore, titleKey, { score, total: questions.length }).then(r => { if (alive) setBestInfo(r); });
  return () => { alive = false; };
  // Once per finished full round.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [gameOver]);
```
- to `<GameShell …>` add `secondaryAction={missed.length > 0 ? { label: t('playRetryMissed', missed.length), onPress: retryMissed } : undefined}`, `analytics={retryQuestions ? { ...analytics, retry: '1' } : analytics}`, and replace `footer={footer}` by
```tsx
footer={
  <>
    {bestInfo ? (
      <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.label, textAlign: 'center' }}>
        {t('playBestScore', bestInfo.best.score, bestInfo.best.total)}{bestInfo.isNewBest ? `  ·  ${t('playNewBest')}` : ''}
      </Text>
    ) : null}
    {footer}
  </>
}
```
`services/i18n.ts` — after `playSubtractDesc`: AR `playBestScore: (score: number, total: number) => \`أفضل نتيجة: ${score} من ${total}\`,` `playNewBest: 'نتيجة جديدة!',` `playRetryMissed: (n: number) => \`أعد الأسئلة التي أخطأت فيها (${n})\`,`; EN `playBestScore: (score: number, total: number) => \`Best: ${score} of ${total}\`,` `playNewBest: 'New best!',` `playRetryMissed: (n: number) => \`Retry the ones you missed (${n})\`,`.

- [ ] **Step 6: Tests, typecheck, commit**

Run the two new tests, the other `playGame*` tests, `i18n`, `designScale`, `iconSystem`, `cornerTheme`, `gameShellBack`, `gameAccents`, `gameAmber`; then typecheck. Commit `bestScore.ts`, `TriviaGame.tsx`, `GameShell.tsx`, `i18n.ts`, both tests with the message `Play hub: personal best and retry the questions you missed` and the standard trailers.

---

### Task 5: The Jordan map in the governorates game

**Files:**
- Create: `scripts/build-jordan-map.ts`, `scripts/data/jordan-adm1-geoboundaries.geojson`, `services/publicGames/jordanMapData.ts` (generated), `components/publicGames/JordanMap.tsx`, `services/__tests__/{jordanMapData,jordanMapWiring}.test.ts`
- Modify: `components/publicGames/TextQuizGame.tsx`, `app/play/governorates.tsx`, `services/i18n.ts`

**Interfaces:**
- Consumes: `GOVERNORATES` (ids) from `services/publicGames/governorates.ts`.
- Produces: `JORDAN_MAP: { viewBox: string; paths: Record<string, string> }` keyed by governorate id; `buildJordanMap(geojson)`, `renderJordanMapModule(geojson)`; `JordanMap({ correctId, pickedId, accent })`; `TextQuizGame` prop `reveal?: (q: TextQuestion, pickedId: string, accent: string) => React.ReactNode`; i18n `playMapCredit`.

- [ ] **Step 1: The source data**

Copy the downloaded boundary file into the repo: `cp /tmp/claude-0/-home-user-Iqraa/f5b0398e-0b3f-5cb3-9ddd-4ecffb74892a/scratchpad/geo/jor.geojson artifacts/mobile/scripts/data/jordan-adm1-geoboundaries.geojson`. If that file is missing, re-download it: `curl -sSL "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/JOR/ADM1/geoBoundaries-JOR-ADM1_simplified.geojson" -o artifacts/mobile/scripts/data/jordan-adm1-geoboundaries.geojson`. It must be a `FeatureCollection` of 12 features (54,979 bytes) whose `properties.shapeISO` values are `JO-MN, JO-KA, JO-MD, JO-BA, JO-JA, JO-AJ, JO-IR, JO-MA, JO-AT, JO-AQ, JO-AM, JO-AZ`. Source: geoBoundaries gbOpen JOR ADM1 (simplified), licence Creative Commons Attribution 2.5 (derived from Wikimedia Commons), data year 2006.

- [ ] **Step 2: Write the failing tests**

`services/__tests__/jordanMapData.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JORDAN_MAP } from '../publicGames/jordanMapData.ts';
import { GOVERNORATES } from '../publicGames/governorates.ts';
import { buildJordanMap, renderJordanMapModule } from '../../scripts/build-jordan-map.ts';

const root = join(import.meta.dirname, '..', '..');
const geojson = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'jordan-adm1-geoboundaries.geojson'), 'utf8'));

test('the committed data is exactly what the script builds from the committed source', () => {
  const committed = readFileSync(join(root, 'services', 'publicGames', 'jordanMapData.ts'), 'utf8');
  assert.equal(committed, renderJordanMapModule(geojson));
});

test('there is one non-empty path per governorate, under the same ids as the game', () => {
  assert.deepEqual(Object.keys(JORDAN_MAP.paths).sort(), GOVERNORATES.map(g => g.id).sort());
  for (const d of Object.values(JORDAN_MAP.paths)) assert.match(d, /^M[-0-9. LMZ]+Z$/);
});

test('every coordinate lies inside the viewBox, and the data stays small', () => {
  const [, , w, h] = JORDAN_MAP.viewBox.split(' ').map(Number) as [number, number, number, number];
  for (const d of Object.values(JORDAN_MAP.paths)) {
    for (const [x, y] of [...d.matchAll(/(-?[0-9.]+) (-?[0-9.]+)/g)].map(m => [Number(m[1]), Number(m[2])] as const)) {
      assert.ok(x >= 0 && x <= w && y >= 0 && y <= h, `${x},${y} outside ${w}x${h}`);
    }
  }
  assert.ok(JSON.stringify(JORDAN_MAP).length < 16_000, `${JSON.stringify(JORDAN_MAP).length} bytes`);
});

test('north is up and east is right (a flipped projection would fail these)', () => {
  const centre = (id: string) => {
    const pts = [...JORDAN_MAP.paths[id]!.matchAll(/(-?[0-9.]+) (-?[0-9.]+)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
    return { x: pts.reduce((s, p) => s + p[0], 0) / pts.length, y: pts.reduce((s, p) => s + p[1], 0) / pts.length };
  };
  assert.ok(centre('aqaba').y > centre('maan').y, 'Aqaba is south of Ma\'an');
  assert.ok(centre('maan').y > centre('karak').y, 'Ma\'an is south of Karak');
  assert.ok(centre('irbid').y < centre('amman').y, 'Irbid is north of Amman');
  assert.ok(centre('mafraq').x > centre('jerash').x, 'Mafraq is east of Jerash');
  assert.ok(centre('tafilah').y < centre('aqaba').y, 'Tafilah is north of Aqaba');
});

test('building twice gives the same result', () => {
  assert.deepEqual(buildJordanMap(geojson), buildJordanMap(geojson));
});
```

`services/__tests__/jordanMapWiring.test.ts`:
```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

test('the map shows only through the reveal, with the accent passed in, in the governorates game', () => {
  const route = read('app', 'play', 'governorates.tsx');
  assert.match(route, /accent="#1E3A8A"/);
  assert.match(route, /reveal=\{/);
  assert.match(route, /<JordanMap correctId=\{q\.correctId\} pickedId=\{picked\} accent=\{accent\}/);
  const quiz = read('components', 'publicGames', 'TextQuizGame.tsx');
  assert.match(quiz, /reveal\?:/);
  assert.match(quiz, /reveal\(q, pickedId, accent\)/);
});

test('the map is decorative for screen readers, takes colours from the theme and credits its source', () => {
  const map = read('components', 'publicGames', 'JordanMap.tsx');
  assert.match(map, /accessible=\{false\}/);
  assert.match(map, /useColors\(\)/);
  assert.doesNotMatch(map, /palette/);
  assert.doesNotMatch(map, /fontSize:\s*\d/);
  assert.match(map, /playMapCredit/);
});
```

- [ ] **Step 3: Run to verify they fail**, then **Step 4: the build script**

`scripts/build-jordan-map.ts`:
```ts
/**
 * Builds services/publicGames/jordanMapData.ts from the committed boundary file.
 *
 * Source: geoBoundaries gbOpen, Jordan ADM1 (simplified), 12 governorates, data
 * year 2006, licence Creative Commons Attribution 2.5 (derived from Wikimedia
 * Commons). The game shows the credit. Regenerate with:
 *   cd artifacts/mobile && node --experimental-strip-types scripts/build-jordan-map.ts
 * jordanMapData.test.ts fails if the committed module differs from this output.
 *
 * Projection: equirectangular with the longitude scaled by cos(mean latitude),
 * north up, 200 units wide, coordinates rounded to one decimal.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ISO_TO_ID: Record<string, string> = {
  'JO-AM': 'amman', 'JO-AZ': 'zarqa', 'JO-IR': 'irbid', 'JO-MA': 'mafraq', 'JO-BA': 'balqa', 'JO-JA': 'jerash',
  'JO-AJ': 'ajloun', 'JO-MD': 'madaba', 'JO-KA': 'karak', 'JO-AT': 'tafilah', 'JO-MN': 'maan', 'JO-AQ': 'aqaba',
};

type Ring = [number, number][];
type Feature = { properties: { shapeISO: string }; geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } };

const rings = (f: Feature): Ring[] =>
  (f.geometry.type === 'Polygon' ? [f.geometry.coordinates as Ring[]] : (f.geometry.coordinates as Ring[][])).flat();

export function buildJordanMap(geojson: { features: Feature[] }): { viewBox: string; paths: Record<string, string> } {
  const all = geojson.features.flatMap(f => rings(f).flat());
  const lons = all.map(p => p[0]);
  const lats = all.map(p => p[1]);
  const [lon0, lat0] = [Math.min(...lons), Math.max(...lats)];
  const k = Math.cos((((Math.min(...lats) + Math.max(...lats)) / 2) * Math.PI) / 180);
  const width = (Math.max(...lons) - lon0) * k;
  const scale = 200 / width;
  const project = ([lon, lat]: [number, number]): [number, number] => [
    Math.round((lon - lon0) * k * scale * 10) / 10,
    Math.round((lat0 - lat) * scale * 10) / 10,
  ];
  const height = Math.ceil((lat0 - Math.min(...lats)) * scale);
  const paths: Record<string, string> = {};
  for (const f of geojson.features) {
    const id = ISO_TO_ID[f.properties.shapeISO];
    if (!id) throw new Error(`unknown governorate ${f.properties.shapeISO}`);
    paths[id] = rings(f)
      .map(r => {
        const pts = r.slice(0, r[0]![0] === r[r.length - 1]![0] && r[0]![1] === r[r.length - 1]![1] ? -1 : undefined).map(project);
        return `M${pts.map(p => `${p[0]} ${p[1]}`).join('L')}Z`;
      })
      .join('');
  }
  if (Object.keys(paths).length !== 12) throw new Error(`expected 12 governorates, got ${Object.keys(paths).length}`);
  return { viewBox: `0 0 200 ${height}`, paths };
}

export function renderJordanMapModule(geojson: { features: Feature[] }): string {
  const { viewBox, paths } = buildJordanMap(geojson);
  const sorted = Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b)));
  return `/**
 * GENERATED by scripts/build-jordan-map.ts — do not edit by hand.
 * Source: geoBoundaries gbOpen, Jordan ADM1 (simplified), data year 2006,
 * licence Creative Commons Attribution 2.5 (derived from Wikimedia Commons).
 */
export const JORDAN_MAP: { viewBox: string; paths: Record<string, string> } = ${JSON.stringify({ viewBox, paths: sorted }, null, 2)};
`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const src = fileURLToPath(new URL('./data/jordan-adm1-geoboundaries.geojson', import.meta.url));
  const out = fileURLToPath(new URL('../services/publicGames/jordanMapData.ts', import.meta.url));
  writeFileSync(out, renderJordanMapModule(JSON.parse(readFileSync(src, 'utf8'))));
  console.log('wrote', out);
}
```
Run it: `cd /home/user/Iqraa/artifacts/mobile && node --experimental-strip-types scripts/build-jordan-map.ts`. Check `wc -c services/publicGames/jordanMapData.ts` is under 16 KB. (If the closing-point test `r[0]![0] === …` mis-types, fix the types in the script, not the test. The orientation test compares vertex means, so if one comparison fails because of a governorate's odd shape, check the picture rather than loosening the test.)

- [ ] **Step 5: The component and the wiring**

`components/publicGames/JordanMap.tsx`:
```tsx
/**
 * The 12 governorates of Jordan, drawn from services/publicGames/jordanMapData.ts.
 * Shown only after an answer: the right governorate is filled in the game's
 * accent, a wrong pick is outlined in red. Decorative for screen readers (the
 * explanation line says the same thing in words).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { readableOn } from '@/services/readableColor';
import { SPACE, TYPE } from '@/constants/theme';
import { JORDAN_MAP } from '@/services/publicGames/jordanMapData';

const WRONG = '#DC2626';
const MAP_HEIGHT = 200 + SPACE.xl; // tall enough for the map's 200-unit width at phone size; Svg scales to fit

export function JordanMap({ correctId, pickedId, accent }: { correctId: string; pickedId: string; accent: string }) {
  const colors = useColors();
  const { t } = useLanguage();
  const lit = readableOn(accent, colors.card, 3);
  const wrong = pickedId !== correctId ? pickedId : null;
  // Draw the wrong pick, then the right one, last, so their outlines sit on top.
  const order = [...Object.keys(JORDAN_MAP.paths).filter(id => id !== wrong && id !== correctId), ...(wrong ? [wrong] : []), correctId];
  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={MAP_HEIGHT} viewBox={JORDAN_MAP.viewBox} accessible={false}>
        {order.map(id => (
          <Path
            key={id}
            d={JORDAN_MAP.paths[id]}
            fillRule="evenodd"
            fill={id === correctId ? lit : colors.card}
            stroke={id === wrong ? WRONG : colors.border}
            strokeWidth={id === wrong ? 2.5 : 0.8}
            strokeLinejoin="round"
          />
        ))}
      </Svg>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.micro, textAlign: 'center' }}>
        {t('playMapCredit')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'stretch', gap: SPACE.xs } });
```
(If `MAP_HEIGHT` computed from `SPACE` reads strangely, use a plain named constant `220` — it is a size of a drawing, not typography or spacing — and say so in your report.)

`components/publicGames/TextQuizGame.tsx`: add prop `reveal?: (q: TextQuestion, pickedId: string, accent: string) => React.ReactNode;` (doc: "Extra content under the explanation once an answer is picked, e.g. a map") and change the board's reveal to compose both:
```tsx
renderReveal={(q, pickedId) => (
  <>
    {renderReveal(q)}
    {reveal ? reveal(q, pickedId, accent) : null}
  </>
)}
```
`app/play/governorates.tsx`:
```tsx
import React from 'react';
import { TextQuizGame } from '@/components/publicGames/TextQuizGame';
import { JordanMap } from '@/components/publicGames/JordanMap';
import { buildGovernorateRound } from '@/services/publicGames/governorates';

export default function GovernoratesGameScreen() {
  return (
    <TextQuizGame
      titleKey="playGovernoratesTitle"
      accent="#1E3A8A"
      build={buildGovernorateRound}
      reveal={(q, picked, accent) => <JordanMap correctId={q.correctId} pickedId={picked} accent={accent} />}
    />
  );
}
```
`services/i18n.ts` — after `playSubtractDesc`: AR `playMapCredit: 'الخريطة: geoBoundaries (CC BY 2.5)',` EN `playMapCredit: 'Map: geoBoundaries (CC BY 2.5)',`.

- [ ] **Step 6: Tests, typecheck, commit**

Run `jordanMapData`, `jordanMapWiring`, the other `playGame*`, `i18n`, `designScale`, `cornerTheme`, `iconSystem`, `gameAccents`, `gameAmber`, `routeGating`; then typecheck. Commit `build-jordan-map.ts`, `data/jordan-adm1-geoboundaries.geojson`, `jordanMapData.ts`, `JordanMap.tsx`, `TextQuizGame.tsx`, `governorates.tsx`, `i18n.ts` and both tests with the message `Play hub: a Jordan map after each governorates answer` and the standard trailers (body: name the source and licence).

---

### Task 6: Browser check, docs, full verification

**Files:**
- Modify: `docs/status-log.md`
- Create (scratchpad only, not the repo): a Playwright script under `/tmp/claude-0/-home-user-Iqraa/f5b0398e-0b3f-5cb3-9ddd-4ecffb74892a/scratchpad/`

- [ ] **Step 1: Full verification**

Run, in order, and record the output tails: `cd /home/user/Iqraa && pnpm run typecheck`, then `cd /home/user/Iqraa/artifacts/mobile && pnpm test` (silent for minutes — wait for it). Both must be green. Fix anything that is not with the systematic-debugging approach; never edit a guard test to pass.

- [ ] **Step 2: Look at it in a browser**

The Playwright MCP tools have no Chrome here. Use the `playwright` node library directly (`require('playwright')` works from any directory; `chromium.launch()` needs no options; do not run `playwright install`). Start the web app in the background: `cd /home/user/Iqraa && pnpm run dev:mobile:web` (port 8081; do **not** set `CI=1`), wait until `/play` answers. `/play` is public (no login). For these games — governorates, fractions, numberType, matter, antonyms, flags — at phone 390×844 and desktop 1280×800, light and dark (`colorScheme`), Arabic (default) and one English run: play a question, answer right and answer wrong, and take screenshots of: the unanswered question, the revealed answer (explanation visible, map for governorates), a streak of 3 (chip visible), and the game-over screen after at least one miss (best line + "retry the ones you missed"; press it and confirm it replays only the misses and does not change the best). Save the screenshots in the scratchpad and **look at them** (Read the PNGs). Specifically check: the explanation and the map never push Next off the screen (the board now scrolls), the flame chip and the speaker icon are readable in dark mode, the map's lit governorate is clearly visible in dark mode, fractions' decimal line reads left-to-right and is not mirrored in Arabic, the mute button toggles its icon and survives a reload (`localStorage` key `@iqra_play_sound_off_v1`), and no console errors. Sound and haptics cannot be heard or felt: confirm only that answering does not throw and that the audio code path runs (a console check that an `Audio`/media request for `correct`/`wrong` is made is enough). Report honestly what you saw, per game. Fix any real defect with a failing test first when it is pure logic.

- [ ] **Step 3: Write the status-log entry**

Read the top ~40 lines of `docs/status-log.md` to copy the entry format, then add a new entry at the TOP titled «/play games: a why line, sound and haptics, motion, personal best with retry, and a Jordan map — 2026-10-30». Be truthful: what was built (five changes, which games get which), size added (measure: the wav, `wc -c jordanMapData.ts`, git diff --stat), **what was and was not verified** (tests and browser as in Step 2; sound and haptics were not heard or felt; nothing on a device or native build), the attribution for the map data (geoBoundaries gbOpen JOR ADM1, CC BY 2.5, derived from Wikimedia Commons, data year 2006, simplified, governorates unchanged since 2001), known limits (sound defaults on; the board is now scrollable, which changes the layout of every `TriviaBoard` game; best is per game and per device, lesson games share one best across lessons; the retry replays the same option order), and deviations from the spec. Do not touch `STATUS.md` unless a line in it stopped being true (`grep -n -i "game" STATUS.md`).

- [ ] **Step 4: Commit (no push, no PR)**

`git add docs/status-log.md` plus anything the browser check made you fix (named paths only), then commit with the message `Play hub: status-log entry for the games enhancements` and the standard trailers.
