# /play games: feedback, explanations, best score and a governorates map — design

Date: 2026-10-30. Status: approved in chat ("go"), with these defaults: sound on, every game that shares
`TriviaBoard` included, the map credit line shown.

## Goal

The /play games are quiet and static: green or red, no reason why, no sound, no memory of how you did. Make them
feel like games and teach more, **without making the app heavier** (about 30 KB added in total) and **without a
native change** (no `app.json` version bump; it ships over the air).

## Scope

Every game on `TriviaBoard`: the six games added on 2026-10-29 (antonyms, plurals, numberType, fractions, matter,
governorates), flags, capitals, elements, and the two lesson-embedded games in `app/play/lesson/[lessonId].tsx`.
Not in scope: memory, colours and the four drills (they do not use `TriviaBoard`); background music; speech;
photographs; per-state drawings for the matter game; a "same round for the whole class" seed link.

## The five changes

1. **A one-line "why" after each answer.** `TextQuestion` gains `explanation?: string` and
   `explanationLtr?: string` (a pure number line, drawn in its own left-to-right `Text` because Arabic-Indic
   digits next to `=`/`≈` scramble inside Arabic text). Shown under the revealed answer through a new optional
   `TriviaBoard` prop `renderReveal(q, pickedId)`. Content:
   - which-number: computed ("٢٤ عدد زوجي لأنه يقبل القسمة على ٢"; "٧ عدد أولي: لا يقبل القسمة إلا على ١ وعلى نفسه";
     odd: "٩ عدد فردي: إذا قُسم على ٢ بقي ١"). No operators inside Arabic text.
   - fractions: computed decimals on their own LTR line ("٣/٤ = ٠٫٧٥    ٢/٣ ≈ ٠٫٦٧"); "=" when exact, "≈" when not.
   - matter: the substance, its state, and one definition per state (3 sentences × 2 languages).
   - opposites, plurals, governorates: a plain restatement of the key ("ضدّ «كبير» هو «صغير»"). No explanations
     are invented that cannot be checked.
2. **Sound and haptics, with a mute button.** A right answer plays the existing `correct.wav`; a wrong one plays one
   new quiet cue (`wrong.wav`, synthesised from plain tones, under 20 KB, no licence to track). Phones also get a
   light tap (right) or a soft warning (wrong) from `expo-haptics`. A speaker button in the `GameShell` header
   mutes sound and haptics together; the choice is kept on the device (`@iqra_play_sound_off_v1`). Default: on.
   `expo-audio` and `expo-haptics` are already installed and used, so there is no native change.
3. **Motion in code.** A wrong picked option shakes; the right option pops; a streak chip (flame icon, "٣ متتالية")
   appears at two right in a row. All of it off under `useReduceMotion()`. Theme tokens only (no literal font
   sizes: `designScale.test.ts` has no slack).
4. **Personal best and "retry the ones you missed".** The game-over screen shows "أفضل نتيجة: ٧ من ٨" (and "نتيجة
   جديدة!" when beaten), saved per game on the device (`@iqra_play_best_v1:<titleKey>`). If anything was missed, a
   button replays only those questions; a retry round never records a best.
5. **A Jordan map in the governorates game.** After the answer is revealed (never before: it would give the answer
   away) a map of the 12 governorates shows the right one lit in the game's accent and a wrong pick outlined in
   red. Drawn with `react-native-svg` from boundary data, about 10 KB. Source: geoBoundaries "Jordan ADM1,
   simplified" (12 features, 1,192 points), licence **CC BY 2.5** (derived from Wikimedia), data year 2006. The
   governorates have not changed since 2001. A credit line is shown under the map and recorded in the status log;
   the source GeoJSON and the build script are committed so the data can be regenerated and checked.

## Structure

- Pure, testable under `node --test`: `services/publicGames/kvStore.ts` (the `KeyValueStore` type),
  `feedbackPrefs.ts`, `bestScore.ts`, `streak.ts`, `jordanMapData.ts` (generated), and the explanation text in each
  game module. Storage is injected, so tests use an in-memory store.
- Bound to the device: `services/playStore.ts` (AsyncStorage), `services/playFeedback.ts` (expo-audio and
  expo-haptics, a mute store read with `useSyncExternalStore`), `assets/sounds/wrong.wav`
  (built by `scripts/make-wrong-cue.mjs`).
- UI: `components/publicGames/AnswerOption.tsx` (shake/pop), `JordanMap.tsx`, and edits to `TriviaGame.tsx`,
  `TextQuizGame.tsx`, `GameShell.tsx`.

## Verification

- Logic: every explanation is re-derived in the tests (prime/even/odd; decimals by division); the map data is
  regenerated from the committed GeoJSON and compared byte for byte, the 12 ids match `GOVERNORATES`, every
  coordinate lies inside the viewBox, and two orientation checks (Aqaba south of Ma'an, Irbid north of Amman)
  catch a flipped projection.
- Whole suite and typecheck at the end; the design-scale, accent, amber and corner-theme guard tests must stay green.
- Browser (Chromium via the `playwright` library): every changed game, light and dark, Arabic and English, phone and
  desktop width, looking at the screenshots. **Sound and haptics cannot be heard or felt there**; what is tested is
  that the code path runs without error and that the mute button changes and remembers its state.

## Risks and known limits

- Sound defaults on; a classroom may be surprised. The button is always visible.
- Web browsers block audio until a tap; answering is a tap, so the first cue plays.
- The map is simplified geometry from 2006 data; it is a learning aid, not a survey.
- Retry replays the same question objects (same option order), by design.
