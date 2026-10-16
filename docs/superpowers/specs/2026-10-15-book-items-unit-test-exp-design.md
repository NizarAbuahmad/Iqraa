# Unit-test items 3–5 (teacher guide p.47) — design addendum

Status: approved 2026-10-15 ("extract guide p.47 items 3-5"). Extends
`2026-10-12-book-items-unit-test-open-design.md`. Items 1–2 (already served) and 6–11
(served, five `verified`) are on the same page.

## What the page holds (real text layer, 2026-10-15)

Three multiple-choice questions whose maths the text layer cannot structure by rule:

| Item | Raw text (as extracted) | Reading |
| --- | --- | --- |
| 3 | `3 5x × 9y = 27` / `5` / `3x × 5y = 25`; options `(-1, -1) (1, 1) (-1, 1) (1, -1)` | 3^(5x) × 9^y = 27 and 5^(3x) × 5^y = 25 (the lone `5` line is the second equation's base) |
| 4 | "which exponential equation has x = -1 as a solution": `5 2x+1 = 25`, `3⏎1+x = 81`, `7 3-2x = 49`, `42-x = 64` | 5^(2x+1)=25, 3^(1+x)=81, 7^(3−2x)=49, 4^(2−x)=64 |
| 5 | "the expression to put in the empty square": `8x2 y3⏎□ = (2y⏎x )2`; options `2x4y`, `4x4y2`, `2xy`, `x2y2` | 8x²y³ / □ = (2y/x)², options 2x⁴y, 4x⁴y², 2xy, x²y² |

Which digits are exponents (`9y` is 9^y, `42-x` is 4^(2−x), `x4y` is x⁴y) and where the
fraction bars were are **not recoverable by a rule** from this text: the extractor's
normaliser rightly rejects all three (`broken_fraction_or_exponent`, `ambiguous_spacing`).
The MCQ answers for items 1–5 are not on this page (they are in the answer appendix, which
is not extracted), so none of these can be `verified`.

## Decisions

1. **A hand-written, validated reading per item** (a new table, `READINGS`, in
   `scripts/extract_book_items.py`), not a looser normaliser. The reading is the stem lines
   and options with exponent and fraction structure added. It is accepted only when
   (a) **it contains exactly the page's characters**: with whitespace and the structure
   characters `^ ( ) /` removed, the reading equals the page block (so no digit, letter or
   operator, `×` included, can be added, dropped or changed - only structure), and each of the
   page's own bracket pairs stays in the same two places and matched to each other, and (b) **exactly one option is correct
   under it** (SymPy). Either failing fails the build with the reason; nothing falls back.
2. **Why the reading is believed, and what is not claimed.** A wrong placement of exponents
   would almost never leave exactly one correct option: the tests record, for each item,
   rival readings (no exponents; bars elsewhere) that leave none or several. That is
   evidence, not proof, and no page image has been compared. So these are `computed`
   (`verificationSource: "sympy"`), labelled «الحل محسوب من نص السؤال», never `verified`,
   and go on the PR's "compare with the printed books" list with the reading stated.
3. **Lessons.** Unit 1 has curriculum lessons `u1_l3` «تبسيط المقادير الأسية» and `u1_l4`
   «حل المعادلة الأسية» (book lessons 4 and 5, via the existing `curriculum_lesson_id`).
   Items 3 and 4 → `u1_l4`; item 5 → `u1_l3`.
4. **Kind `unit-test-mcq`** (they are multiple choice), tier `medium`, `tierSource: "default"`,
   our own Arabic instruction (never the scrambled line): item 3 the existing pair
   instruction; item 4 «أي المعادلات الأسية الآتية يكون العدد الآتي حلا لها؟» with stem
   `x = -1`; item 5 «ما المقدار الجبري الذي يجب وضعه في المربع الفارغ ليتحقق التساوي؟».
5. **Display.** `displayMath` turns `^2` into `²` but leaves `^(2x+1)` as `5^(2x+1)`. That is
   readable Latin maths and is kept (no new Unicode letters); the limit is stated in STATUS.
   The `□` and `/` are kept as written.
6. **Item 5's layout is the weakest reading** (the vinculum and the position of `□` are
   inferred from line order). It is included, with that stated, because the same
   uniqueness test applies and a teacher compares it before the flag is turned on; if the
   review of the extractor finds the reading unsupportable, quarantine it with
   `ambiguous_layout` instead.

## Consequences

- Served items 30 → 33 (28 `computed` + 5 `verified`), if all three pass their gates; the script's
  `report.json` is the count, not this line.
- Pool-dependent tests (plan sizes, minimum counts) move for the two lessons; re-derive,
  do not loosen.
- "No page image compared" now covers 28 `computed` items (25 today + these three).

## Not decided here

Items 12 and the answer appendix; the other unit-test items on p.48 (13–30, mixed
exponent and word problems); promoting item 8 (needs the PDF).

## Amendment after independent review (same day)

The first version ignored the page's `×` and checked bracket positions without pairing; a reviewer
showed `3^(5x) / 9^y` (serves (1, 1)) and `(2y/(x)^2)` (serves option b) passing both gates. Both are
closed (`×` is meaning; brackets are compared as matched pairs) and pinned by tests. Item 3's stem is
stored with the page's `×`.
