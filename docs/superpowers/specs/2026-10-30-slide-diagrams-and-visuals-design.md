# Slide diagrams and visuals — design

2026-10-30. Approved in chat section by section (diagrams; generators). This file is
the written form for review before the implementation plan.

## Goal

Teacher-generated decks — both Slides Maker (curriculum lesson decks) and Prompt
Slides (free description) — show a picture of the idea when the idea has a shape:
a drawn cycle, tree, Venn or mind map, a chart from real numbers, an icon, or a
photo of a real scene. Bullets remain only where the content really is a list.

## Where we start (checked 2026-10-30)

- Layouts exist: `statement`, `stat`, `compare`, `steps`, `timeline`, `stats`,
  `table`, `flow`, `quote`, `photo`, `concepts` (`SLIDE_LAYOUTS`,
  `artifacts/mobile/services/slideLayout.ts`). One gate, `resolveSlideLayout`,
  decides whether a payload is drawable; a refusal falls back to the slide's own
  words (`payloadLines`).
- Three renderers draw them: the presenter
  (`app/ai-tools/classroom/presentation.tsx`, `SlideView`), the PDF/HTML
  (`services/deckSlidesHtml.ts`) and PowerPoint (`services/exportPptx.ts`).
- Prompt Slides' model already chooses layouts, icons, bar/pie charts (real numbers
  only) and three photos (`promptSlidesPrompt.ts`; `sanitizeDeckStructure`;
  `promptSlidesPolish.ts`; photos via `promptSlidesMedia.ts`).
- Slides Maker's generated explanation slides (`lessonTeachingPrompt.ts` →
  `usableTeaching` → `buildLessonDeck`) are always title + bullets: no layout, icon,
  chart or photo. Its pictures are book figures (4 of 16 subjects), a cover photo
  and unit-break photos.
- No renderer can draw a cycle (a `flow` with `cycle: true` is a row of boxes plus a
  caption), a tree, a Venn or a mind map.

## 1. Four new diagram layouts

Added to `SLIDE_LAYOUTS` and to the API's copy `DECK_LAYOUT_NAMES`
(`promptSlidesPrompt.test.ts` already fails if the two differ). Each is a slide
`layout` with its own payload field on `ActivitySlide`:

| Layout | Payload | Gate (refuse the whole layout otherwise) |
|---|---|---|
| `cycle` | `cycle: { stages: { label: string; note?: string }[] }` | 3–6 stages; label 1–24 chars; note ≤ 60 chars; labels distinct |
| `tree` | `tree: { root: string; branches: { label: string; leaves?: string[] }[] }` | root 1–32 chars; 2–4 branches; label 1–24 chars; 0–4 leaves each, 1–24 chars; no empty or repeated sibling |
| `venn` | `venn: { sets: { label: string; only: string[] }[]; shared: string[] }` | 2 or 3 sets; set label 1–24 chars; `only` and `shared` 0–4 items each, 1–32 chars; at least one item somewhere |
| `mindmap` | `mindmap: { center: string; nodes: { text: string; role?: 'cause' \| 'effect' }[] }` | center 1–40 chars; 3–6 nodes, 1–40 chars; role, when present, one of the two |

Rules shared with the existing layouts:

- `resolveSlideLayout` returns a resolved shape or `null`; it never repairs. A
  refusal draws the ordinary slide, and `polishDeck`/`payloadLines` put the
  payload's words in as bullets (up to six) so nothing is lost.
- Only on prose slides (`intro`, `summary`); the server already deletes a layout on
  any other type.
- A three-set Venn with `shared` means "in all three"; pairwise overlaps are not
  modelled (three circles of pairwise lists do not fit a projector legibly).

### Geometry, once

A new pure module, `services/diagramGeometry.ts`, takes a resolved diagram and a
box (width, height, `rtl`) and returns positioned primitives: circles/ellipses,
rounded boxes, straight connectors with an arrowhead flag, and text anchors (x, y,
max width, alignment). All three renderers draw from it, so a diagram looks the
same projected, printed and in PowerPoint.

- `cycle`: stages evenly on a circle starting at 12 o'clock, clockwise in LTR and
  counter-clockwise in RTL; a straight arrow from each stage box to the next, the
  last back to the first.
- `tree`: root box on top, branches in one row, leaves stacked under each branch;
  branch order follows reading direction.
- `venn`: two or three overlapping circles; `only` items inside each circle's
  exclusive area, `shared` in the common area.
- `mindmap`: centre ellipse; nodes on a ring around it; connector from centre to
  node, arrow pointing into the centre for `cause` and out to the node for
  `effect`, plain line otherwise.

Text is never rasterised: renderers place real text at the anchors (presenter:
React Native `Text` over an `Svg` of shapes, so web bidi handling — `isolateForeignRuns`,
`forceLtr` — still applies; PDF: HTML text positioned over inline SVG; PowerPoint:
text boxes). Colours come from the deck theme (`resolveDeckTheme`): stage/branch
fills use the theme's accent tints, text uses theme text colours, and
`cornerTheme`-style contrast checks are added for diagram text on its fill.

### Renderers

- **Presenter.** One `DiagramView` per kind inside `SlideView`'s layout branch,
  each item wrapped in `Reveal` with an index, so «نقطة بنقطة» paces stages,
  branches or nodes. `pacedBeats` (`services/pacedReveal.ts`) learns the four kinds.
- **PDF.** `deckSlidesHtml.ts` draws the same primitives as inline SVG shapes plus
  absolutely positioned text.
- **PowerPoint.** `exportPptx.ts` draws ellipses, rounded rectangles and lines
  (with arrowheads) as native shapes and labels as text boxes, so a teacher can
  edit them. Curves are not drawn anywhere: cycle connectors are straight.

## 2. The generators

### Prompt Slides

`promptSlidesPrompt.ts` (Arabic and English) describes the four layouts with their
JSON shape and when each fits (stages returning to the start → `cycle`; a
classification or breakdown → `tree`; shared vs. distinct properties → `venn`;
causes/effects or sub-ideas around one idea → `mindmap`), and the existing limit
holds: at most half the explanation slides wear a special shape. `checkDeck` gains
`*_incomplete` warnings for the four, like the existing layouts.

### Slides Maker

`lessonTeachingPrompt.ts` lets each concept carry, all optional:

- `shape`: `{ layout, ...payload }` for one of `steps`, `compare`, `table`, `flow`,
  `timeline`, `stat`, `statement`, `cycle`, `tree`, `venn`, `mindmap`;
- `icon`: one name from `DECK_ICON_NAMES`, for that concept's own idea;
- `chart`: `{ kind: 'chart', chartType: 'bar' | 'pie', categories, values }`, only
  from figures present in the book text supplied; never invented;
- `photo`: a 2–5 word English search phrase for a real scene (place, experiment,
  phenomenon), never on a maths rule; the prompt asks for at most three per section.

`usableTeaching` keeps each extra only if it passes the same gates the renderers use
(`resolveSlideLayout` on a probe slide, `isSectionIconName`, `usableChartVisual`, a
Latin-only query); a failing extra is dropped alone and the concept's points remain.
`buildLessonDeck` copies them onto the concept slide: layout + payload, `icon`,
`visual` (a chart and a layout never share a slide — the layout wins, as in
`polishDeck`), and `mediaPrompt`.

Photos: at most three per deck **including** the cover; never on a slide that
already carries a book figure (`sideImageUrl`). They are fetched by the Prompt Slides
path (`searchDeckMedia` / `attachSearchedMedia` in `promptSlidesMedia.ts`) after the
deck is built, with the same Unsplash credit. A failed fetch leaves the slide without
a photo.

The pool: `PROMPT_VERSION_BY_KIND['lesson-teaching']` moves to `2026-10-31.1`
(`generationKey.ts`); other kinds and students' approved explanations are unaffected.
The student explanation cards (`lessonExplanationCards.ts`) ignore `shape`, `icon`,
`chart` and `photo`: none of them is wrong content, so nothing new is stripped, and
drawing them for students is out of scope.

### Measuring

- Prompt Slides: the existing engagement log line already counts `laidOut`.
- Slides Maker: `/generate/lesson-teaching` logs at `info`, per section, how many
  concepts carried a shape, icon, chart or photo
  («lesson-teaching visuals»). The client's drop-backs are not logged.

## 3. Verification

- Unit tests: every gate (sizes, empties, duplicates, wrong types); geometry
  (positions inside the box, RTL mirrors LTR, no two boxes overlap for the maximum
  sizes); `usableTeaching` dropping each bad extra alone; photo cap including the
  cover and skipping book-figure slides; `pacedBeats` for the four kinds; prompt text
  pins in both languages; the API/app layout list parity.
- PDF: render a fixture deck with all four diagrams (and the maximum sizes) in
  Arabic and English, light and dark, and look at it.
- PowerPoint: run the real exporter in Node with native modules stubbed, inspect the
  XML (shape counts, text boxes, mirrored order in Arabic).
- Presenter: Playwright on the built web bundle with the fixture deck loaded through
  a stubbed saved-deck read, screenshots at desktop and phone widths.

**Not verifiable here:** how a live model chooses and fills these (the session's
OpenAI key lacks `model.request`); the PowerPoint file's appearance in PowerPoint;
native devices.

## Out of scope

Curved connectors; pairwise three-set Venn regions; labelled-parts diagrams over
an image; AI-generated images (the image model is not enabled on the OpenAI
project); drawing diagrams on the student explanation cards.
