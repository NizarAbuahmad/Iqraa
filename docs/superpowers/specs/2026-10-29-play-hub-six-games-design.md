# Six new games for the public /play hub — design

Date: 2026-10-29. Status: approved; implemented on branch ccr-c35bc284-4ljn3c (PR #1345).

## Goal

The public, no-login `/play` hub has 10 games and nothing for Arabic language,
number sense beyond arithmetic, states of matter, or Jordan's own geography.
Add six games that fill those gaps, in the hub's existing pattern.

## The six games

| id | Title (AR) | Theme | Grades | Question | Answer source |
| --- | --- | --- | --- | --- | --- |
| `antonyms` | ضد الكلمة | Arabic | 1–4 | "What is the opposite of X?" | hand-written pairs (~40) |
| `plurals` | جمع الكلمة | Arabic | 2–5 | "What is the plural of X?" | hand-written singular/plural pairs (~30), incl. broken plurals |
| `numberType` | أيّ عدد؟ (زوجي، فردي، أولي) | Maths | 3–6 | "Which of these is even / odd / prime?" (four numbers) | computed in code |
| `fractions` | قارن الكسور | Maths | 4–7 | "Which fraction is larger / smaller?" | computed in code; the two values are always distinct |
| `matter` | صلب، سائل أم غاز؟ | Science | 3–7 | "Is X a solid, liquid or gas?" | hand-written list (~30 unambiguous substances) |
| `governorates` | محافظات الأردن | Geography | 4–9 | "Which governorate is this town or site in?" (Ramtha, Wadi Rum, Mu'ta…) | ~26 hand-written towns and sites across the 12 governorates, each checked against a published source |

Grade bands are judged against the curriculum, like the existing ones in
`gradeBands.ts`, not measured.

Revisions made while planning (2026-10-29): eleven of the twelve governorates
share their name with their centre (only Balqa → Salt differs), so a
"governorate → centre" question is near-trivial; the geography game asks which
governorate a town or site is in instead. The plurals game always shows Arabic
words and options (the question is about Arabic morphology), only its prompt
is localised. The fractions game asks "larger" and "smaller", so its title is
«قارن الكسور».

Items that are not unambiguous are left out (the Dead Sea spans governorates;
milk is a colloid). Ambiguous items make a bad answer key.

## Approach

One pure logic module per game in `artifacts/mobile/services/publicGames/`,
a thin component in `components/publicGames/`, and a route file in
`app/play/`. Every game runs on the existing `TriviaBoard` (scoring, reveal,
game-over, signup CTA via `GameShell`); only the round builder and prompt
renderer differ. Rejected: one config-driven `/play/[game]` route. It breaks the
file-per-route convention `routeGating.test.ts` and the accent tests assume.

## Logic modules

Each exports `buildXRound(lang, count, rng)` returning questions of shape
`{ options: TriviaOption[]; correctId: string; ... }`, deterministic for a
given seed via `rng.ts`.

- Maths is computed in latin; Arabic digits are applied only at display time.
  Use `forceLtr`/`displayLtr` from `services/mathCalc.ts` for any fraction
  or operator next to Arabic-Indic digits.
- `numberType`: a labelled-answer question ("is 7 even, odd or prime?") has two
  correct answers for 7 (odd and prime), so the question is instead "which of
  these four numbers is X?" for X in even / odd / prime. Each is unique by
  construction: even = one even among three odds; odd = one odd among three
  evens; prime = one prime among three composites. Numbers 4–60; 1 and 2 are
  never used (1 is not prime, 2 is both even and prime).
- `fractions`: proper fractions with denominators 2–12; equal values are
  re-drawn; the correct option is decided by cross-multiplication.
- Data-driven games (`antonyms`, `plurals`, `matter`, `governorates`) keep
  their tables as typed arrays with Arabic and English text. Distractors are
  drawn from the same table.

## Wiring (every game)

1. `PLAY_GAME_IDS` and `PLAY_GAME_GRADES` in `gradeBands.ts`.
2. `GAMES` in `app/play/index.tsx`, appended after the existing entries.
3. AR and EN `play<Name>Title/Desc/Prompt` strings in `services/i18n.ts`.
4. Route file `app/play/<id>.tsx`.
5. Route list in `routeGating.test.ts` (the `/play` prefix is already public).
6. A distinct accent that passes `gameAccents.test.ts` and `gameAmber.test.ts`
   (not amber, not within the colour-distance threshold of another game).
7. The game-name alternation in the app-help regex in `services/appHelp.ts`.

## Testing and verification

- New `services/__tests__/publicGamesBatch2.test.ts`, inside the existing
  glob. For every game: each question has exactly one correct option, no
  duplicate options, and the same seed gives the same round.
- Data invariants: no duplicate pair; no word is its own answer; a plural
  differs from its singular; every governorate appears once.
- Maths keys re-derived independently in the test.
- `pnpm run typecheck`, mobile `pnpm test`.
- Run `arabic-copy-reviewer` over all new Arabic; read generated questions
  and check each key by hand.
- Check the hub and each game in `pnpm run dev:mobile:web`: RTL, dark mode,
  phone width.

## Docs and delivery

Write-up at the TOP of `docs/status-log.md`; `STATUS.md` unchanged unless a
line in it stops being true. One branch (`ccr-c35bc284-4ljn3c`), one draft PR.

## Out of scope

Jordan landmarks, a spelling game (ة/ه, ض/ظ; the riskiest keys to author),
lesson-linked and live-class games.
