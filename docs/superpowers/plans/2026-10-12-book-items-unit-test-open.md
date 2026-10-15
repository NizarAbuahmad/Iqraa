# Unit-test items 6–11 (guide p.47) — implementation plan

> Use subagent-driven-development; TDD. Spec:
> `docs/superpowers/specs/2026-10-12-book-items-unit-test-open-design.md` (read it first —
> it has the page's content and every decision).

**Goal:** extract guide S1 p.47 items 6–11 into the committed item store, pair their printed
answers by value, serve them (five become `verified`), and make every consumer handle the new
kind `unit-test`.

**Global constraints:** no schema/native/mobile-UI/`app.json` changes. Flag and live-path
behaviour unchanged. Nothing is guessed: item 8's printed `(2. 1)` must NOT be tolerated.
Do not narrow test globs. Python: `cd artifacts/math-verifier && python -X utf8
../../scripts/test_extract_book_items.py`; sympy pinned 1.14.0. Implementers commit locally
(two attribution trailers) and do not push.

## Task 1 — the kind `unit-test`, end to end, with no data yet

Add `'unit-test'` to `BookItemKind` (`lib/curriculum/src/bookItems.ts`); `bookCitation` gives it
the unit-test citation (same text as `unit-test-mcq`); update the header comment. Everywhere a
kind is switched on, handle it: `mockGenerator.ts` `bookQuestion` (drawn when `wantShort`, with
`exercise`; built as a `short_answer` like an exercise — read `buildBookQuestion`),
`bookQuestions.ts` (`SLOT` map: application; `liveSlot` signature; eligibility in `planBook`:
`unit-test` counts like `exercise`), `services/bookItemNote.ts` if it keys on kind (read it),
and anywhere `grep -rn "unit-test-mcq"` shows a kind switch (api-server, curriculum, mobile).
TDD with synthetic items injected through the existing test seams (do not add data): citation
text; `takeBookItem({kind:'unit-test'})`; `bookQuestion` builds a short answer with the
citation and `bookStatus`; the live slot for it is application/3 marks; `planBook` eligibility.
Deliverable: all suites unchanged in count except new tests; typecheck clean.

## Task 2 — the extractor: segmentation, solvers, value-matched printed answers, regenerate

In `scripts/extract_book_items.py` (+ `scripts/test_extract_book_items.py`):
- `Entry` gets optional `numbers: tuple[int, ...]`, `allow_none: bool`; new family `unit_open`
  with rows for l2 (items 6, 7, 10, 11) and l3 (items 8, 9) of S1 unit 1, page 47.
- Page-47 segmentation by explicit anchors (spec decision 7): items 6–9 are lines
  `^N <stem line 1>` + next line; the c-system is the two Latin lines between the Arabic
  header ending `…c` and the `c = 8` line; 10 uses `c = 8` substituted; 11 keeps `c`.
  Missing/ambiguous anchor → `Reject('item_not_found')`. Arabic never reaches SymPy.
- Solvers: reuse `solve_system` with `allow_none` returning `لا يوجد حل` when there is no real
  solution; new `solve_param_no_solution(stem, 'c')` (eliminate the linear variable,
  discriminant < 0 via `solve_univariate_inequality`) returning `c < -1/3`.
- Answer block: lines after the last item stem up to the first line equal to `الوحدة`; entries
  start at a line beginning `(` or `c ` or the no-solution phrase (NFKC-normalise the Arabic
  presentation forms first), all other lines continue the previous entry; the "see appendix"
  entry is recognised and ignored.
- Matching: `flat(s)` = all whitespace removed. For each item in number order find the unused
  entry with `flat(entry) == flat(computed)` (computed rendered with fractions as `n/d`,
  flattened — document in a comment that `-11/3` flattens to `-113`, identical to the split
  printed form, and why a collision with a different true answer is not a practical risk).
  Match → `assign_state(computed, printed, judged=False)` gives `verified`; no match →
  `computed`, `printedAnswer: null`. `report.json` gains `unmatchedPrinted` (entries not
  consumed, as printed) and `notes` (per item id that stayed `computed` although the guide
  prints an answer on the page). Output stays deterministic.
- Expected result (verify, do not assume): 6, 7, 9, 10, 11 verified; 8 computed with
  `(0, 5), (2. 1)` in `unmatchedPrinted`. Counts report: 30 served = 5 verified + 25 computed.
- Python tests (red first): normalisation of the NFKC phrase; entry splitting on the real
  page text (golden: 6 entries + the appendix marker); value matching incl. the split
  fractions; item 7 `allow_none`; item 11 solver; the mutation guard (corrupt one printed
  entry in a fixture → that item is `computed`, never `verified`, and the entry is
  reported); item 8 stays computed (pins "no tolerance"); determinism (two runs identical);
  existing 23 tests untouched.
- Regenerate `lib/curriculum/src/data/book-items/*.json` and `report.json`; commit them with
  the script (CI fails on drift).
- Then fix every test that pins pool-dependent numbers (curriculum `bookItems.test.ts` minimum
  counts and "no verified without printedAnswer" style invariants, api-server bookQuestions /
  mockGenerator tests such as the plan sizes for u1_l1 / u1_l2). Re-derive each expected
  value from the data and say in the report which moved and why; never loosen an assertion
  to make it pass. The curriculum test "stems pass isLatinMath" must accept `c < -1/3`
  answers and the new kind.

## Task 3 — docs and handover

STATUS.md (book-items sections: counts 30 served / 5 verified / 25 computed, what verified
means here — pairing by value, item 8's unmatched entry and how to promote it, the 14
quarantined unchanged, "no stem compared with a page image" now true of 25), CLAUDE.md
(book-items note: `verified` now exists; pairing by value), `docs/adding-a-book.md` section E2
(the `unit_open` family and the answer-block rule), `bookItems.ts` header comment, PR body is
updated by the controller. Verify each claim against the code and the regenerated JSON.
