# Adding a book (or any PDF) to Iqraa

There is no single "add a book" script. A book is up to five independent
artefacts with five id spaces, and nothing joins them automatically. This page
lists every step in order. Read the headers of `lib/curriculum/src/sources.ts`
and `lib/curriculum/src/curriculumIds.ts` for the reasoning behind the ids.

## The five tracks

| Track | What | Where | Committed? |
| --- | --- | --- | --- |
| A. Manifest | one row per PDF: kind, authority, status, extraction | `lib/curriculum/src/data/g10_sources.json` | yes |
| B. Page text | extracted text per page, used for grounding passages | `lib/curriculum/src/data/extracted/<sourceId>.json` | yes |
| C. Catalog | units / lessons / objectives | `lib/curriculum/src/data/iqra_curriculum_*.json` + `lib/curriculum/src/catalogs/*.ts` | yes |
| D. Figures | PNG crops + index + lesson map | `knowledge-base/<grade>-<subject>/figures/<sourceId>/`, `knowledge-base/figure-lesson-map.json` | PNGs and index yes, PDF no |
| E. Exercises | real «تمارين ص ٧٢» references | `knowledge-base/grade-10-math/exercises/<sourceId>/index.json` | yes |

Source PDFs are gitignored (`knowledge-base/**/support-pdfs/`, `knowledge-base/**/*.pdf`).

## The two buckets

There are two Cloudflare R2 buckets and they do completely different jobs.
Putting a book in one does nothing for the other.

| | `iqraa-media` | `iqraa-public` |
| --- | --- | --- |
| Purpose | what the **AI reads** | what the **teacher taps** |
| Who reads it | `extract-text.ts`, server-side, once | a teacher's browser, on every download |
| Access | private, needs `R2_*` credentials (anonymous reads answer 401, verified 2026-09-03) | anonymous, via `https://pub-d9ddd8f7….r2.dev/<filename>` |
| Key naming | **must** be `<sourceId>.pdf` — `ensureLocal()` fetches exactly that | any filename; the URL is pasted into the catalog verbatim |
| Where it is referenced | nowhere in code; the sourceId is the contract | a literal URL string on a `Book` row in `catalog.ts` |
| Produces | `extracted/<sourceId>.json` → passages → grounding in every generator and chat | a download chip in `app/curriculum/subjects.tsx` |
| Skip it when | the PDF is committed under `attached_assets/` and never needed elsewhere | NCCD already hosts the book — 12 of the 16 download URLs in `catalog.ts` point at `nccd.gov.jo`, only 4 at `r2.dev` |

**The distinction that matters:** `iqraa-public` is a file-hosting convenience,
nothing more. A PDF there is a link on a card. The model never opens it, no text
is extracted from it, and it grounds nothing. If you upload a book only to
`iqraa-public`, the app will offer teachers a download and will still know
nothing about the book's content.

For a book to influence what the AI writes, its text must go through
`iqraa-media` (or a committed local copy) and out the other side as
`extracted/<sourceId>.json`. Tracks A–C below are that path.

A book can legitimately need both: `iqraa-media` so generation is grounded in
it, and `iqraa-public` so teachers can download it when NCCD does not host it.
The two are independent — same PDF, two uploads, two different names.

## Vocabulary

- **Source**: one PDF. `kind` (student-book, teacher-guide, activity-book, ministry-support, worksheet, answer-key, summary, study-pack, question-bank, exam), `authority` (`nccd` is quotable; `teacher` and `third-party` are reference-only and never reproduced verbatim), `status` (`pending`, `ingested`, `duplicate`, `conflict`).
- **Lesson id**: `kbl-{subject}-s{n}-nccd-u{k}_l{m}` for Grade 10 (no grade segment, frozen because these strings sit in Postgres), `kbl-g9-math-s1-nccd-u2_l1` for any other grade. Mint only through `lessonKbId()`, `unitKbId()` and `objectiveId()` in `curriculumIds.ts`.
- **Passage**: one page of one source, ranked by term overlap against the unit. Only `nccd` sources are retrievable (`quotableOnly`).
- **unitTags**: the bank namespace (`s1-u2`, `chem-s1-u2`), not catalog ids. Derived by `bankTagsForParsedUnit()`.

## A. Register the PDF

1. Mint the `sourceId`. NCCD: `{subj}-s{n}-{kind}` (`chem-s1-student-book`). Teacher material: `{subj}-{topic}-{author}` (`math-ws-chords-1-alhindi`). Grade 9 and above: prefix `g9-`.
2. Put the PDF where extraction can see it: R2 as `<sourceId>.pdf` (set `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` in `.env`), or `attached_assets/knowledge-base-pending/<sourceId>.pdf`.
3. Add the row to `lib/curriculum/src/data/g10_sources.json`: `id`, `driveId`, `title` (verbatim filename), `bytes`, `filename`, `authorAr` (`null` for NCCD), `unitTags` (from `BANK_UNIT_TAGS` in `bank.ts`), `objectiveIds: []`, `keywords`, `subject`, `semester`, `kind`, `authority`, `status: "pending"`.
4. Add `'<sourceId>': '<repo-relative path>'` to `LOCAL_FILES` in `lib/curriculum/scripts/localSources.ts`. Extraction iterates this map and falls back to R2 for anything missing on disk.
5. A new **subject** also needs: `CurriculumSource['subject']` in `sources.ts`, `BANK_SUBJECT_IDS` and `SUBJECT_LABEL_AR/EN` in `bank.ts`, `SubjectSlug` and `UNIT_ID_RE` in `curriculumIds.ts`.

## B. Extract page text

6. `pnpm --filter @workspace/curriculum run extract-text` writes `src/data/extracted/<sourceId>.json`. It refuses, with a reason, PDFs with no text layer, a broken font cmap, reversed presentation-form Arabic, or Arabic whose letters are transposed past a threshold — either around the definite article (`الحركة` → `احلركة`) or inside common words (`في` → `يف`). A refusal falls back to rasterize-and-OCR automatically; if that is rejected too, leave `status: "pending"`.
   - Those thresholds decide *automatic* rejection and sit where the evidence is unambiguous, so a file can be poor without tripping one. When you have read it and judged it too poor to quote, `run extract-text --force --ocr <sourceId>` skips pdf-parse and rasterizes. It requires explicit sourceIds — it will not OCR the corpus — and its output is held to the same gates, so a bad OCR pass cannot overwrite what is on disk. Record the judgement in the manifest row's `notes`; the two Islamic teacher guides were done this way on 2026-09-05 at ~42% transposition.
7. By hand, flip the manifest row to `status: "ingested"` and paste the `extraction` block the script prints (`tool`, `extractedAt`, `pages`, `chars`, `localPath`, `sha256`). Nothing automates this; `extraction.test.ts` fails if the manifest and the file disagree.
8. Optional: `pnpm --filter @workspace/curriculum run upload-r2 <sourceId>` to back a local file up to R2.
9. `pnpm --filter @workspace/curriculum test`.

Stop here for support material (worksheets, exams, packs). The rest is for a
curriculum book with its own units and lessons.

## C. Catalog structure

10. Author `lib/curriculum/src/data/iqra_curriculum_<grade>_<subject>_sem<n>.json`. `validateCurriculum.ts` requires `meta.{grade,subject,curriculum_authority,schema_version}`; also fill `meta.semester_covered`, `meta.source_books`, `meta.known_gaps`. Units: `{id, number, title_ar, title_en, data_tier, total_periods, prior_knowledge, lessons[]}`. Lessons: `{id, order, title_ar, periods, objectives[], vocabulary[]}`.
11. Copy `lib/curriculum/src/catalogs/g9MathSem1.ts` to a new builder. Set `SCOPE: CurriculumIdScope`, export the book-id constants and both `build…Catalog()` (KB) and `build…BrowserCatalog()` (browser). Never interpolate an id prefix inline.
12. Add the subpath export in `lib/curriculum/package.json` `exports`. Do not star-export from `index.ts`.
13. Wire into `lib/curriculum/src/catalog.ts`: import the browser builder, add a `_xxxBrowser` const next to the others, spread into `UNITS` and `LESSONS`, add the `Book` row to `BOOKS` with `pdfUrl`, `guidePdfUrl` and `activityPdfUrl`.
14. **Append** (never insert) to `MVP_BOOK_IDS`, and to `MVP_GRADE_IDS` and `MVP_SUBJECT_IDS` for a new grade or subject. Picker indices are persisted as bare integers; `pickerOrder.test.ts` pins math / grade-10 at index 0.
15. Wire the KB builder into `artifacts/mobile/services/knowledgeBase.ts`: import, `const _xxx = build…Catalog()`, and a `KB_BOOKS` row.
16. `pnpm --filter @workspace/curriculum run verify` must report 0 errors (`--gaps` lists content debt). Then `pnpm --filter @workspace/curriculum test` and `pnpm run typecheck`. `objectives.test.ts` fails if a new objective-id shape is not matched by `DERIVED_OUTCOME_ID` in `objectives.ts`.

## D. Figures (student books)

17. Add the book to `BOOKS` and a unit range to `EXPECTED_UNITS` in `scripts/extract_book_figures.py`. Four existing entries point at absolute paths on the original machine; use a repo-relative or R2-fetched path for new ones.
18. `pip install pymupdf pillow`, then `python scripts/extract_book_figures.py`. Writes `p###.png`, `index.json`, and a `_review.png` contact sheet.
19. Open `_review.png` and delete bad crops. Delete **both** the PNG and its `index.json` entry.
20. Add entries to `knowledge-base/figure-lesson-map.json` joining `{sourceId, unit, lesson}` as the book prints them to a `kbLessonId`. Hand-check every one; `null` means the figures go unused. Never auto-fill from `candidates`.
21. Add the new `index.json` path to `scripts/gen_book_figure_assets.mjs` and the matching import in `artifacts/mobile/services/bookFigures.ts`. Both are hardcoded lists.
22. `node scripts/gen_book_figure_assets.mjs`. Commit the PNGs, `index.json`, the map, and the regenerated `artifacts/mobile/services/bookFigureAssets.ts`. `bookFigureAssets.test.ts` fails if it is stale.

## E. Exercises (exercise books)

23. Add to `BOOKS` in `scripts/extract_book_exercises.py`, run it, commit `index.json`, add the import in `artifacts/mobile/services/bookExercises.ts`.

## F. Public download link (only when NCCD does not host the book)

No credentials and no extraction. This is pure file hosting.

24. Upload the PDF to the `iqraa-public` bucket through the Cloudflare
    dashboard. Any filename works; the Arabic title is fine.
25. Copy its public URL: `https://pub-d9ddd8f74e734a21824518b812652124.r2.dev/<filename>`,
    URL-encoded. Confirm it serves before wiring it: `curl -sS -o /dev/null -w '%{http_code}' '<url>'`
    must print 200 (or 206 for a ranged request).
26. Put it on the book's row in `lib/curriculum/src/catalog.ts` as `pdfUrl`
    (student book), `guidePdfUrl` (teacher guide) or `activityPdfUrl`
    (activity book), and set `downloadNote` / `downloadNoteAr` to say where
    the copy came from. `book-english-10-s1` is the worked example.
27. Nothing else. `subjects.tsx` renders a chip per field that is present.

## Where each track shows up in the app

| Track | Consumed by |
| --- | --- |
| Manifest | bank search in chat and lesson context (titles only), exam papers, `/api/bank/*` |
| Page text | every server generator and chat, via `grounding.ts` appending up to 3 NCCD passages with page numbers to `additionalContext` |
| Catalog | curriculum browser, every picker, evaluations, objectives |
| Figures | slides deck and Start Class (2 slides), lesson plan / worksheet / quiz / activity panel and export appendix (up to 6, lesson-level, cited by page) |
| Exercises | practice references in lesson plans and decks |
| Public download link | a download chip on the book card in `app/curriculum/subjects.tsx`, and nothing else |
