# Science Lab («المختبر») in the Library — design

Status: approved in discussion 2026-10-06, awaiting spec review. Nothing is built.

## Problem

Teachers have no place in the app for science teaching tools: laws, instruments,
infographics, figures, videos and interactive experiments. The library
(`/curriculum/resources`, `artifacts/mobile/app/curriculum/resources.tsx`) is a
flat shelf of staff uploads, frozen practice sheets and ministry QR links. It
has no per-subject section and no inline viewer; tapping a row opens an external
link.

Constraints recorded in `STATUS.md`:

- **No lawfully embeddable simulation source exists.** PhET moved to CC BY-NC on
  2026-03-29; GeoGebra needs a commercial agreement. Interactives must be built
  in-house.
- **The book's 71 lab activities are parked.** Auto-parsing Arabic activity-book
  text into safety-critical lab cards is unsafe (the `pdf-parse` lam
  contamination). Vision extraction is the revisit path.
- **Biology has no curated external media.**

## Decisions

| Question | Decision |
| --- | --- |
| Audience | Teacher-led in class (a full-screen present mode). Students can reach it too. |
| Content source | Curated licensed media plus in-house interactives. |
| First slice | Reference core plus three flagship interactives, grade 10 chemistry and physics. |
| Build approach | React Native components on `react-native-svg` and `reanimated`, both already installed. No 3D, no WebView, no new native module. |
| Class attach | Present mode and a share link only. No `class_resources` change. |

## Design

### Placement

- A «المختبر» entry card on `/curriculum/resources` opens `/curriculum/lab`.
  `/curriculum/lab/[itemId]` is the present-mode view for one item.
- Both sit under the already-allowlisted `/curriculum` prefix, so no gating
  change is needed. `routeGating.test.ts` gets a pin for the new path, as it has
  for `/curriculum/resources`.
- It is not a new tab: a tab costs an allowlist entry, a role-gated tab, two
  icons and a locale pair.

### Data

- Curated JSON plus a typed loader in `lib/curriculum`, beside
  `external_resources.json` and `external.ts`.
- Item kinds: `law`, `instrument`, `infographic`, `figure`, `video`,
  `interactive`.
- Item kinds in phase 1: `interactive` (the three below), `law` (formula card)
  and `external` (a pointer to an entry in `external_resources.json`, so a
  licence is recorded in one place only). Book figures are not listed in the
  JSON; they are joined at render time from `figuresForLesson`, and are the
  phase-1 «infographics». An equipment glossary and hand-made infographics are
  deferred: the lesson vocabulary lists terms, not instruments.
- Each item carries: grade, subject and a `kbl-*` lesson id. First-party items
  (`interactive`, `law`) say `origin: "original"`; `external` items inherit the
  licence and `licenseCheckedAt` of the resource they point at.
- A law card holds the formula in latin, its quantities and units, and the
  lesson's own vocabulary terms verbatim (a test checks each term is in that
  lesson's `vocabulary`). It carries no Arabic prose written by us. A printed
  statement of the law is added only once it can be witnessed against the book.
- The lesson id comes from the grounding already resolved for the item, never
  from re-grounding a title (titles repeat across grades and drift under
  semantic search). Lookups pass a `KbScope`.
- There is no new DB table, so the content ships over the air and needs no
  production schema push.

### Reuse

- Book figures: `services/bookFigures.ts`, `components/ui/BookFiguresPanel.tsx`.
- Curated external shelf and licence policy: `lib/curriculum/src/external.ts`,
  `bank.ts`.
- Quick checks per item from `lib/math-practice/src/chemistry.ts`.
- Embed-only videos through `components/ui/LessonMediaPanel.tsx`.
- Subject-correct navigation through `lessonPickerParams` / `scopePickerParams`
  in `services/lessonPrep.ts`.

### The three interactives

1. **Periodic table explorer** (chemistry S1, `u2_l1` / `u2_l2`). Needs a new
   element dataset with Arabic names; no such data exists in the repo. Phase 1
   covers elements 1–20, and every Arabic name must appear in the printed
   textbook text (a witness test), not be written from memory.
2. **Mole and molar-mass calculator** (chemistry S2, `u4_l2`). Type a formula
   such as `Ca(OH)2`, get the molar mass, then convert between moles, grams and
   particles.
3. **Vector addition** (physics S1, `u1_l2`, the resultant-of-two-forces
   experiment's lesson). Two draggable vectors, resultant by components.

**Correction made while planning (2026-10-06).** The approved discussion named a
pH scale and an Ohm's-law circuit. The grade 10 catalog has no lesson for
either: grade 10 chemistry is atom, electron configuration, bonding, reactions,
the mole and energy; grade 10 physics is vectors, motion, Newton's laws, fluids
and waves. Acids/bases is grade 9 chemistry and no grade 9 or 10 physics lesson
covers circuits. They were swapped for interactives that match real grade 10
lessons, which is what the first slice was scoped to.

Structure: each interactive's logic is a pure module under
`artifacts/mobile/services/`, tested in `services/__tests__/`, and the component
is a separate file. The mobile test runner is bare `node --test` and cannot load
anything that imports `react-native` at module scope. Maths is computed in latin
and converted to Arabic digits / `س` only at display time.

### Guardrails

- Law cards and their worked examples are checked against the book text.
  Numeric examples are computed by code and tested.
- Nothing is labelled `verified` unless something verified it; the item's
  `source` field says how a statement was established.
- No licensed item is added from memory of what a provider "is". Every entry
  needs a live licence check and a `licenseCheckedAt`.
- Biology is a known content gap (no lab items, no curated media). Phase 1 is
  grade 10 chemistry and physics, so the gap is recorded in `STATUS.md` rather
  than shown in the UI.
- Interactive and law items show attribution wherever a licence requires it, on
  every render path.

## Out of scope (later phases)

Games, 3D models, experiment / lab cards (needs vision extraction), attaching
lab items to a class (a `class_resources` `lab` kind needs a schema change and
the manual production schema push), and AI-generated infographics.

## Verification plan

- `pnpm run typecheck` for the monorepo.
- `cd artifacts/mobile && pnpm test`: pure-logic tests for the three
  interactives, plus loader tests for licence, scope and lesson-id integrity.
- `pnpm run dev:mobile:web`, then open `/curriculum/lab` as a student and as a
  teacher and confirm present mode renders RTL. Dev web authenticates against
  production, so this step needs a person to sign in.

## Open questions

- Which grade 10 chemistry and physics lessons get the first law and instrument
  cards (a content list, to settle during planning).
- Whether the element dataset's source and licence are acceptable (facts are
  not copyrightable, but the Arabic names must match the textbook).
