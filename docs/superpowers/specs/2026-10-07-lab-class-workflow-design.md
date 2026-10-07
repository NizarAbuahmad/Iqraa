# Science Lab in the class workflow — design

Status: approved in discussion 2026-10-07, awaiting spec review. Nothing is built.
Follows `2026-10-06-science-lab-design.md` (phase 1, merged in #886). This is the
first slice of "phase 2": make the lab part of how a teacher already works.

## Problem

Lab items can be opened from the library and shared by link, but a teacher cannot
**put one in front of a class**, and cannot **put one in a deck**. Phase 1 recorded
both as out of scope. The class shelf (the «الموارد» tab on a class) holds only
Library items, and the deck builder (`app/ai-tools/slides.tsx`) only inserts
lesson-scoped attachments.

## Decisions

| Question | Decision |
| --- | --- |
| Slice | Class shelf takes lab items, and lab items can be inserted into a deck. |
| Database | **No DDL.** `class_resources.kind` is plain `text` with no CHECK or enum, so `kind='lab'` rows are legal against production today. |
| Interactive items in a deck | A `media` slide of kind `document` carrying the item's title and share link. No new slide kind, no QR (a QR link slide is still on the STATUS to-do list). |
| Where the deck picker gets items | The lab items filed on the lesson being built (`labItemsForLesson(groundedLessonId)`), not the class shelf. |
| Who sees the shelf rows | Teachers only, as today. Student accounts are disabled in v1 and no student shelf endpoint exists. |

## Correction to earlier records

The phase 1 spec and `STATUS.md` say attaching a lab item to a class "needs a
schema change and the manual production schema push". That was wrong, and was
written before the shelf's validation was read. Only **code** rejects a lab row
today (`classResource.ts:75`, `:77`, `roster.ts:735`); the table does not. The
same PR that ships this must correct both statements.

## Design

### Part 1 — class shelf takes lab items

- **Where a teacher adds one.** A new «المختبر» section in the class screen's add
  sheet, beside the Library picker, listing lab items narrowed to the class's grade
  and subject (`filterLabItems`). Items already on the shelf show «مضاف», as the
  Library picker does.
- **What a row is.** `kind = 'lab'`, `library_source = null`, `library_native_id =
  <lab item id>`, `media_kind = 'lab'`, `url = null`, `title` = the item's title
  written **by the server** from the lab catalogue. A client cannot choose the
  title. The api-server already imports `@workspace/curriculum`, so it can import
  `@workspace/curriculum/lab`.
- **Opening a row.** A new open target that navigates in-app to
  `labItemPath(id)` (`/curriculum/lab/<id>`) instead of opening an external URL.
- **Unavailable.** If the id is no longer in the catalogue, the row is reported
  `unavailable` (greyed, not openable), the way a deleted staff upload is.
- **Duplicates.** The route checks for an existing `lab` row for the same class
  and item and answers 409 `already_added`. There is deliberately **no new unique
  index**: that is DDL, which `verify-schema` would then require in production by
  name, failing the deploy until someone applies it by hand. The accepted cost is
  that two near-simultaneous taps can create two rows.
- **Exhaustive maps.** `ResourceKind` gains `lab`, so `RESOURCE_KIND_ICON` and
  `RESOURCE_KIND_LABEL` (typed `Record<ResourceKind, …>`) each need an entry: a flask
  icon and a new «مختبر» label in both language blocks. The picker's and shelf's
  `ResourceItem`/`ResourceSource` assumptions need a lab-aware path, not a union
  tweak.

Files, by role: server validation `artifacts/api-server/src/lib/classResource.ts`
and its test; routes `artifacts/api-server/src/routes/roster.ts`; mobile types and
pure logic `artifacts/mobile/services/classResources.ts` and its test;
`constants/resourceKind.ts`; `components/classes/ClassResourceRow.tsx` and the
picker; `app/classes/[id].tsx` (`onOpenResource`, `onAddResource`); i18n.

### Part 2 — lab items become slides

A new pure module builds slides; a new section on the slides screen picks them.

- **Picker.** A «من المختبر» section next to `LessonResources` and
  `LessonAttachments`, listing `labItemsForLesson(groundedLessonId)`. Like
  `includeAttachments` it is off by default.
- **Insertion.** Client-side, after the model returns, before the first `challenge`
  slide (else before `summary`, else at the end), never at slide 0 — HTML and PPTX
  always render slide 0 as the title slide. This keeps the invariant in STATUS that
  attachments never enter `AIRequest`, so the shared artifact pool cannot be
  affected. Regenerate rebuilds the deck and drops hand-inserted slides unless the
  include switch is on, same as attachments.
- **Law → ordinary slide.** Type `intro`, no new kind. `title` is the law title;
  `content` has the formula as an equation line, one line per quantity, and the
  lesson terms. This renders in all three paths today.
- **External image → media slide.** `buildMediaSlide` with `mediaKind: 'image'` and
  the resource's `fetchUrl` (a stable public Wikimedia URL), **not** the one-hour
  presigned `/media/external/:id` link, which would break a saved deck. The
  attribution goes in **both** `content` (the presenter shows credit from content)
  and `mediaCaption` (the PDF and PPTX paths show it from there).
- **External video → media slide.** `mediaKind: 'video'` with the source watch URL
  and the same attribution in both fields.
- **Interactive → link slide.** `media` slide, `mediaKind: 'document'`,
  `mediaUrl = labShareUrl(id)`, caption = the item's title. The presenter shows a
  tap target; the exports print the caption and the bare URL.

New files: `artifacts/mobile/services/labSlides.ts` (pure, tested) and a small
picker component. Changed: `app/ai-tools/slides.tsx` (state, merge, insertion call)
and `services/classMedia.ts` (an `insertLabSlides` that shares the placement rule
with `insertLessonResources` rather than copying it).

## Guardrails

- **Formula lines go through the deck's real helpers in tests.** `looksLikeEquation`
  and `hasRenderableMath` (`services/deckText.ts`, `mathRender.ts`) decide how a
  line is drawn. Checked on current code: a line containing `m/s²` is parsed as a
  stacked fraction, and `Nₐ` falls outside the right-to-left isolation
  (`FOREIGN_CHAR` includes only `₀–₉`). A test must run **every shipped law slide**
  through those helpers and fail if any line is misparsed, so a new law cannot
  regress it silently. The layout choice (how units are written on a slide) is made
  to satisfy that test, not by hand.
- **A slide never carries unlicensed or uncredited media.** An external item with no
  attribution, or a licence the catalogue marks reference-only, produces no slide.
- **Credits survive the three render paths.** Tests assert the attribution string
  is present in the built slide's `content` and `mediaCaption`.
- **The server owns the title and the validity of a lab id.** A request for an
  unknown id is a 400, not a stored row.
- **No new native module and no `app.json` version bump.** No new dependency.
- Anything not seen in a browser is labelled so in the PR and `STATUS.md`.

## Known limits, recorded rather than fixed here

- The slide editor's `applyMediaEdit` (`classMedia.ts:134-151`) only classifies
  image and video URLs, so editing an audio or document media slide is blocked, and
  editing an image or video slide with a blank caption can delete its licence
  credit. Lab slides inherit this. It is a pre-existing bug, outside this slice.
- Image media slides use `object-fit: cover` in the HTML and PPTX exports, so
  labelled diagrams can be cropped there (the presenter uses `contain`).
- The PPTX export names Cairo and Almarai but cannot embed them, and `ₐ` may not
  be in Cairo. Unverified.
- PDF and PowerPoint output of lab slides has not been seen by a person.
- A deck's lab slides do not update if the lab item changes after the deck is saved.

## Out of scope

Student-facing shelf and endpoint; a new slide kind or QR code; inserting a slide at
a chosen position; lesson-plan and chat integration (no consumer of class
resources exists there today); games, 3D, experiment cards, biology content.

## Verification plan

- `pnpm run typecheck`; `pnpm --filter @workspace/curriculum test`; mobile tests
  (new: `labSlides.test.ts`, `classResources.test.ts` extension); api-server
  `classResource.test.ts` extension, then `pnpm build && pnpm test` there.
- The formula-misparse test above is the main correctness gate for law slides.
- A person opens a class, adds a lab item, taps it; builds a deck for a chemistry
  lesson with «من المختبر» on, presents it, exports PDF and PPTX, and checks credits
  and formulas. Subagents cannot sign in, so this is the human step.
- `schema-push: n/a` in the PR (no change under `lib/db/src/schema`). If the
  implementation ends up touching that directory, stop: the design assumes it
  does not.

## Open questions

- Which unit notation reads correctly in a deck line (settled by the misparse test
  during planning, not by preference).
- Whether the add-to-class action should also appear on the lab present page
  (needs a class picker). Not needed for this slice.
