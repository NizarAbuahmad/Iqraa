# Book-figure explanations on physics slides — design

2026-11-27. Approved section by section in chat. Sub-project 3 of three that answer a Grade 10
physics teacher's review of the generated material:
- sub-project 1, key-terms coverage: NizarAbuahmad/Iqraa#1422;
- sub-project 2, drawn physics figures: NizarAbuahmad/Iqraa#1443, #1467 and #1506.

## Why

The review's fix report asks to «إعادة شرح الشرائح التي تعتمد على صور الكتاب فقط، وربط كل صورة بالمفهوم
الفيزيائي المقصود». Four lessons' class slides were marked weak for showing book pictures with no
explanation:

| Lesson | Finding |
|---|---|
| U1 L2 جمع وطرح المتجهات | «ضعيف جدًا لاعتماده على صور الكتاب من دون شرح» |
| U2 L3 قوانين الحركة لنيوتن | slide 10: an Air Track photo with no word on how it relates to gravity |
| تجربة: الكتلة والوزن | «ضعيف جدًا لاعتماده على صور الكتاب من دون شرح» |
| U4 L2 القوة المركزية | «ضعيف جدًا لاعتماده على صور الكتاب من دون شرح» |

## Where we start (checked 2026-11-25)

- **What the app knows about a book figure.**
  - `knowledge-base/<grade>-<subject>/figures/<sourceId>/index.json` lists each figure: `file`,
    `sourceId`, `pdfPage`, `rect`, `unit`, `lesson`, `lessonStartPage`.
  - `knowledge-base/figure-lesson-map.json` maps a book lesson to a KB lesson.
  - Nothing describes what a figure shows. Grade 10 physics has 97 figures: 32 in S1, 65 in S2.
- **The book's text layer cannot supply a caption.**
  - The extracted page text (`lib/curriculum/src/data/extracted/phys-s1-student-book.json`) is
    bidi-scrambled.
  - Captions such as «الشكل (4)» cannot be read off it reliably.
- **Where a figure reaches a slide** (`artifacts/mobile/services/lessonSlides.ts`):
  - **`bookFigureSlides`**: one media slide per figure, titled «من كتاب الطالب», whose only text is the
    citation from `bookFigureCaption` («كتاب الطالب · الفصل الأول · صفحة ١١»). Used by
    `buildLessonDeck` and by `classDeck.ts` (quiz and worksheet decks in class mode).
  - **The lesson deck's «القاعدة» slide**: takes the first figure as `sideImageUrl`, with the citation as
    `sideImageCaption`.
  - **The revision deck** (`unitFigures`): puts up to two figures beside a unit's outcomes and terms, as
    side images with the citation.
- **Slides already carry the fields needed.**
  - A slide has `content`, `mediaCaption` and `sideImageCaption`.
  - It also has a `teacher` block (`teachingTips`, `expectedAnswer`), never projected.
  - Every renderer reads these fields: the presenter, the slides editor, `deckSlidesHtml.ts`
    (HTML/PDF) and `exportPptx.ts`.

## Decisions (made in chat)

1. The explanation is written once per figure and checked by a person, not generated live.
2. Scope: all 97 Grade 10 physics figures, both semesters.
3. A teacher reviews the drafts. Only approved notes reach a slide; until then a figure slide is
   exactly as today.
4. Approach A: notes live in a file beside each book's figure list, and are reviewed on a shared page.

## 1. The note and where it lives

- **One file per physics book**, beside the figure list:
  - `knowledge-base/grade-10-physics/figures/phys-s1-student-book/notes.json`;
  - `knowledge-base/grade-10-physics/figures/phys-s2-student-book/notes.json`.
- **Keyed by the figure's `file` name** (`p011.png`), the same name `index.json` and the app use:

```jsonc
{
  "sourceId": "phys-s1-student-book",
  "notes": {
    "p011.png": {
      "status": "draft",                // "draft" | "approved" | "needs-fix" | "skip"
      "ar": { "caption": "…", "teacher": "…" },
      "en": { "caption": "…", "teacher": "…" },
      "reviewedBy": "…",                 // set on approval
      "reviewedAt": "2026-12-01",        // set on approval, YYYY-MM-DD
      "skipReason": "…",                 // only with status "skip"
      "comment": "…"                     // the reviewer's comment on a "needs-fix"
    }
  }
}
```

- **The two text fields:**
  - **`caption`**: shown on the projected slide. One or two short sentences, at most 140 characters
    in each language. It says what the figure shows and which idea of the lesson it illustrates.
  - **`teacher`**: the speaker note, never projected. It says what to point at, plus one question to
    ask the class.
- **Writing rules:**
  - Describe only what the figure shows and what the lesson teaches. No number, value or claim that
    is neither in the figure nor in the lesson.
  - Use the book's own terms.
  - Name what is there instead of saying «في الصورة» / "in the picture".
  - Numbers and units in Latin, as the book prints them.
- **`skip`** is for a figure with no physics idea to explain (decoration, a photo of a place). It
  carries a `skipReason`, and the slide stays as today.
- **A figure with no entry**, including a re-crop saved under a new name (`p011-v2.png`), shows as
  today until a note for it is written and approved.

## 2. How slides use the notes

- **One reader:** `figureNote(figure: BookFigure, isAr: boolean): { caption: string; teacher: string } | null`
  in a new `artifacts/mobile/services/bookFigureNotes.ts`.
  - It imports the two notes files as `bookFigures.ts` imports the figure lists
    (`with { type: 'json' }`).
  - It returns a value only for `status: "approved"`. A note in any other status, a figure with no
    entry, or a figure of any other book returns `null`.
  - Nothing else reads the notes files.
- **A figure slide of its own** (`bookFigureSlides`, which serves both the lesson deck and the
  class-mode quiz and worksheet decks), when the figure has an approved note:
  - `content` becomes the note's caption;
  - `mediaCaption` stays the citation;
  - `teacher.teachingTips` is the note's teacher text.
- **A side figure** (the rule slide's figure, the revision deck's unit figures), when it has an
  approved note:
  - `sideImageCaption` becomes the caption, a line break, then the citation;
  - the teacher text is appended to the slide's `teacher.teachingTips`, after any tips already there.
- **No approved note:** every slide is byte for byte what it is today.
- **No renderer changes.** All of them already show `content`, the caption fields and the teacher
  block. A by-eye check confirms that a two-line caption wraps cleanly in each renderer.

## 3. Drafting, review and getting approvals back

- **Drafting**, by the implementer, in a working session:
  - For each figure, look at the image (`knowledge-base/grade-10-physics/figures/<sourceId>/<file>`),
    its book page, and its KB lesson's concepts, rules and key terms.
  - Write the four fields. Every entry starts as `draft`, or as `skip` with a reason.
- **A second pass**, by a separate agent: it checks each draft against its image and lesson, and
  flags any of:
  - a claim the figure does not show;
  - a term the lesson does not use;
  - a caption over length;
  - «في الصورة».

  The flags are fixed before review.
- **The review page**: a private Artifact page that the owner shares with the physics teacher.
  - **What it shows:** one card per figure, grouped by unit. Each card has the image, its lesson and
    book page, and the four fields, each editable in place.
  - **What the teacher does:** marks each card **Approve** or **Needs a fix**, with a comment box.
  - **Saving and access:** verdicts and edits are saved in the page's shared store as they are made,
    and a counter shows progress. No app account is needed.
  - **Images:** the 97 crops are uploaded to the page's asset store. They are crops of the ministry's
    public student book.
- **Getting approvals back:**
  - **The script.** `artifacts/mobile/scripts/applyFigureReviews.ts` reads an export of the saved
    verdicts and writes them into the two notes files.
  - **What it writes:** the status, the teacher's edited text where it changed, `reviewedBy`,
    `reviewedAt` and `comment`.
  - **What it refuses:** a verdict for a figure that is not in `index.json`, an approval with an empty
    field, and a caption over length.
  - **It is idempotent:** running it twice changes nothing.
  - **"Needs a fix" cards** are redrafted from the comment and go round again on the same page.
- **Delivery, two draft PRs, both on branches from `main`:**
  1. **`claude/figure-notes-1`, the code:**
     - the two notes files with every entry `draft` or `skip`;
     - `bookFigureNotes.ts`;
     - the slide wiring;
     - the review script;
     - the tests.

     No user-visible change, and no «ما الجديد».
  2. **`claude/figure-notes-2`, the approved notes:** the review's verdicts written into the notes
     files, plus a «ما الجديد» entry for teachers («شرح لصور الكتاب في عروض الفيزياء»), dated the
     merge day.

## 4. Testing, checks and limits

**Tests** (mobile `services/__tests__`, bare `node --test`):
- **The notes files:**
  - every key names a figure in its book's `index.json`;
  - `status` is one of the four values;
  - an `approved` entry has `ar` and `en` with both fields filled, a caption of at most 140
    characters, `reviewedBy`, and a real `reviewedAt` day;
  - a `skip` entry has a `skipReason`;
  - no Arabic caption contains «في الصورة» and no English caption "in the picture".
- **`figureNote`:**
  - returns the note for `approved`, and `null` for `draft`, `needs-fix` and `skip`;
  - returns `null` for a figure with no entry and for a figure of another book;
  - picks the right language.
- **Slides:**
  - a figure slide with an approved note gets the caption as `content`, keeps the citation as
    `mediaCaption`, and has the teacher text in `teacher.teachingTips`;
  - a side figure gets the caption, then the citation, and its teacher text is appended to existing
    tips;
  - with no approved note, every deck is unchanged. This is checked by building the lesson deck,
    and the class-mode quiz and worksheet decks, for every Grade 10 physics lesson, in both
    languages, against the same decks built with the reader returning `null`.
- **The review script:**
  - approve, edited text and needs-fix are each written correctly;
  - an unknown figure is refused;
  - running it twice is idempotent.

**Checks by eye before PR 2:**
- one physics lesson deck with approved notes, in the presenter, the PDF export and PowerPoint, in
  Arabic and English;
- the four lessons the review flagged, opened one by one.

**Limits, stated in both PRs:**
- **Who wrote the drafts.** The implementer writes them by looking at the images. Only the teacher's
  approval makes a note true, which is why drafts never show.
- **Coverage.** Grade 10 physics only; every other subject's figures show as today.
- **Re-crops.** A re-cropped figure loses its note until it is re-approved.
- **Where notes appear.** On slides only, not on the figure list printed with worksheets and quizzes
  (`bookFigureUri.ts`).
- **Not done here:**
  - moving a figure next to the concept slide it illustrates;
  - live AI writing notes;
  - other subjects.

## Trust rules (short)

1. A note reaches a slide only after a person approves it.
2. Without an approved note, a slide is exactly what it is today.
3. A note says only what the figure shows and what the lesson teaches.
4. The book citation stays on every figure, so a teacher can check it against the printed page.
