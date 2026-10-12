# Unit-test items 6–11 (teacher guide p.47) — design addendum

Status: approved 2026-10-12 (user: "extract items 6-11 from guide p.47"). Extends
`2026-10-12-book-items-design.md`; this is the first slice that can produce
`verified` items.

## What the page holds (read from the committed text layer, 2026-10-12)

Guide S1 p.47 («اختبار نهاية الوحدة», unit 1). Items 1–5 are multiple choice (1–2
already extracted). Items 6–12 are open questions, and the page prints their
answers inline in a block after item 12, **in an order that does not follow the
item order** (the text layer places them as it likes):

| Item | Stem | Printed answer (as the text layer gives it) | SymPy |
| --- | --- | --- | --- |
| 6 | `y = 4x ; y = 5 − x²` | `(1, 4), (-5, -20)` | same |
| 7 | `y − x = 15 ; x² + y² = 64` | «لا يوجد حل» (presentation forms) | no real solution |
| 8 | `y = x² − 4x + 5 ; y = −x² + 5` | `(0, 5), (2. 1)` — **a typo or a text-layer artefact** | `(0, 5), (2, 1)` |
| 9 | `y = −x² − x + 12 ; y = x² + 7x + 12` | `(0, 12), (-4, 0)` | same |
| 10 | `x − 2y = 1 ; x² − y² = c`, with `c = 8` | `(3, 1), ( - 11⏎3 , - 7⏎3 )` (fractions split across lines) | `(3, 1), (-11/3, -7/3)` |
| 11 | same system; find every `c` for which it has no solution | `c < - 1⏎3` | `c < -1/3` |
| 12 | inequality `3 − 7x < 6x²` via a system | «أنظر ملحق الإجابات» (appendix) | out of scope |

Items 10 and 11 share one printed stem with a parameter `c`.

## Decisions

1. **Pair by value, not by position.** Position in the answer block is not item
   order, so an answer is attached to an item only when it equals what SymPy
   computes for that item's stem, compared with all whitespace removed on both
   sides (this is what makes the split fractions comparable: `( - 11⏎3` flattens
   to `-113`, the same as our `-11/3` rendered flat). Each printed entry is used
   at most once. A stem that was misread cannot match a printed entry, so the
   check is a real cross-check of the stem as well as the key; what it cannot
   detect is the book itself pairing answers with the wrong items.
2. **States.** Matched → `verified` (`verificationSource: "sympy+book"`,
   `printedAnswer` = the entry as printed). Not matched → `computed` as before,
   with the entry left unmatched listed in `report.json` under
   `unmatchedPrinted` and the item's reason under `notes`. **Item 8 is expected to
   land here** (`2. 1` ≠ `2, 1`): no tolerance is added for it, because whether the
   printed page has a comma cannot be seen without the PDF. A person can promote it
   after looking at the page.
3. **A new kind, `unit-test`** (short answer from a unit test). `exercise` would
   print «كتاب التمارين ص…» for a guide item. Citation: «اختبار نهاية الوحدة ١، س ٦»
   (same as the multiple-choice ones). Competency/marks on the live path:
   application / 3 marks (`SLOT`); the mock path's per-slot values are unchanged.
   It is drawn when the paper wants short answers (`wantShort`), alongside
   `exercise`.
4. **Item 7 is served with the answer «لا يوجد حل»** (the book prints it). The
   exercise-book rule that quarantines `no_real_solution` stays for exercise
   items; this table row opts in (`allow_none`).
5. **Item 10** is stored with `c` replaced by 8 and our standard instruction
   «أحل نظام المعادلتين الآتي». **Item 11** keeps `c` and carries our own
   instruction «أجد جميع قيم c التي لا يكون للنظام الآتي أي حل» with answer
   `c < -1/3`, solved with SymPy (eliminate, discriminant < 0).
6. **Lessons:** items 6, 7, 10, 11 are linear–quadratic systems (curriculum lesson
   `kbl-math-s1-nccd-u1_l1`, as item 1); 8, 9 are quadratic–quadratic
   (`…u1_l2`, as item 2). Tier `medium`, `tierSource: "default"`.
7. **Segmentation** of this page is by hand-written anchors for this page only
   (numbers followed by a space, not a tab; the c-items in the middle of Arabic
   prose). Anything not found exactly → quarantined with a reason; nothing is
   guessed.

## Consequences to handle

- Served items go from 24 to 30; the pools of the two lessons grow (4 → 8 and
  … ), so tests that pin pool-dependent numbers (plan sizes) move and must be
  re-derived, not loosened.
- Five items become `verified`, so "none is verified" in STATUS, CLAUDE.md, the
  PR body and `bookItems.ts` comments stops being true. "No stem has been compared
  with a page image" still holds for the other 25.
- `verified` book items still carry `check: null` (the verifier has no topic for
  systems) and show no key label.

## Not decided here

Item 12; items 3–5 (exponential equations with broken fractions); the answer
appendix; promoting item 8 (needs a person with the PDF).
