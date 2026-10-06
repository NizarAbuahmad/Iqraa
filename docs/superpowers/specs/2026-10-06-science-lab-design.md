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
- Each item carries: grade, subject, a `kbl-*` lesson id, a licence and
  `licenseCheckedAt` (closed licence set that fails closed, as in `bank.ts`),
  and a source.
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

1. **Periodic table explorer.** Needs a new element dataset with Arabic names;
   no such data exists in the repo. Names and groupings are checked against the
   grade 10 chemistry textbook, not written from memory.
2. **pH scale.** A slider over concentration showing colour and the
   acid / base / neutral classification.
3. **Ohm's law circuit.** Sliders for V and R, with I computed.

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
- Biology is a known content gap and is flagged in the UI shelf, not hidden.
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
