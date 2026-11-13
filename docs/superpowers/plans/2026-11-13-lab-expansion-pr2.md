# Lab expansion PR 2: physics formula cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nine physics formula cards («قانون») join the Science Lab — seven for Grade 9 (work, power, the lever, fluid pressure, refractive index, the law of refraction, the critical angle) and two for Grade 10 (buoyant force, horizontal range) — and the Lab's type chips follow the chosen grade and subject, so Grade 9 does not offer types it has none of.

**Architecture:** Data only for the cards: nine `law` rows appended to `lib/curriculum/src/data/lab_items.json`, checked by the tests that already guard law cards (`lab.test.ts`: lesson exists, subject and grade agree, every Arabic term is the lesson's own vocabulary; `labSlides.test.ts`: every shipped law renders as a deck slide). Grade 9 physics joins the test's catalog table. The type-chip fix extends the pure `services/labFilters.ts` the same way PR 1 did for subjects, and the screen wires it.

**Tech Stack:** TypeScript, JSON curriculum data, `node:test`, Expo / React Native (web build for the visual check).

**Spec:** `docs/superpowers/specs/2026-11-13-lab-expansion-design.md` §3 (law cards), *Scope and order* item 2. Builds on PR 1 (`docs/superpowers/plans/2026-11-13-lab-expansion-pr1.md`, PR NizarAbuahmad/Iqraa#1447).

## Global Constraints

- **Prerequisite:** PR 1 (#1447) is merged to `main`. Start from the latest `origin/main`. If the session's branch is `claude/beautiful-euler-8qadld` and #1447 has merged, restart that branch from `origin/main` (CLAUDE.md / harness rule) — PR 2 is a new pull request, not more commits on #1447.
- A law card's `titleAr` is one of its own `termsAr`, and every entry of `termsAr` is copied **verbatim, diacritics included,** from the lesson's `vocabulary[].ar` (`validateLabItems`, `lab.test.ts` "only shows a law term the lesson itself lists"). No other Arabic appears on a card.
- Formulas are Latin, in the **book's own notation**, read from `lib/curriculum/src/data/extracted/<book>.json` (PDF page numbers below). A fraction is written with `÷` (as `law-molar-mass` does); several equations on one card are joined with `" ,  "` (space, comma, two spaces), which `lawFormulaLines` splits on. No subscript letters (`ₐ` etc.): write `P0`, `θc`, `ρf`, `v0`.
- Units are plain text; a unit with a slash (`m/s²`, `kg/m³`) stays as written in the JSON — `unitForSlide` turns it into a negative power for decks. A quantity with no unit says `no unit`; an angle's unit is `°`.
- Existing lab item ids never change; new rows are appended.
- Lessons are carried as `kbl-*` ids, never titles. Grade 9 ids carry a `g9-` segment (`kbl-g9-phys-s1-nccd-u3_l1`); Grade 10 ids carry none (`kbl-phys-s2-nccd-u5_l1`).
- Corner screens take colours from `useColors()`, never `palette`.
- Mobile tests live in `artifacts/mobile/services/__tests__/` and import no `react-native`/`expo-*`.
- No `sed -i` / `perl -pi` on source or data; edit with the Edit tool and read the `git diff`. A `Bin N -> M bytes` line for a text file means corruption.
- «ما الجديد» copy is dated the Amman day the PR merges.

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `lib/curriculum/src/__tests__/lab.test.ts` | Modify | `FILES` gains the two Grade 9 physics catalogs |
| `lib/curriculum/src/data/lab_items.json` | Modify | Nine `law` rows appended |
| `docs/superpowers/specs/2026-11-13-lab-expansion-design.md` | Modify | §3 table in the book's notation as shipped; `g` follows each book (correction) |
| `artifacts/mobile/services/labFilters.ts` | Modify | `labKindIds`, `keepLabKind` |
| `artifacts/mobile/services/__tests__/labFilters.test.ts` | Modify | Tests for the two |
| `artifacts/mobile/app/curriculum/lab/index.tsx` | Modify | Type chips follow grade and subject; resets on tap |
| `artifacts/mobile/services/whatsNew.ts`, `services/i18n.ts` | Modify | One «ما الجديد» entry |
| `docs/status-log.md` | Modify | Top entry |

---

### Task 1: The nine formula cards

**Files:**
- Modify: `lib/curriculum/src/__tests__/lab.test.ts` (the `FILES` table)
- Modify: `lib/curriculum/src/data/lab_items.json` (append nine rows)
- Modify: `docs/superpowers/specs/2026-11-13-lab-expansion-design.md` (§3 table and the two `g = 10` sentences)

**Interfaces:**
- Consumes: `lessonIndex()`/`FILES` in `lab.test.ts` (PR 1: rows are `{ file, gradeId, subject, semester }`).
- Produces: law ids `law-work`, `law-power`, `law-lever`, `law-fluid-pressure`, `law-refractive-index`, `law-snell`, `law-critical-angle`, `law-buoyant-force`, `law-projectile-range`. Task 2's grade-9 tests rely on Grade 9 having only `law` items.

- [ ] **Step 1: Write the evidence file before touching data**

The formulas below were read in the books' text layer on 2026-11-13. Re-read them, so the report carries the evidence. Save as `/tmp/law_evidence.py` (outside the repo) with the Write tool and run `python3 /tmp/law_evidence.py` from the repo root; paste its output into your report:

```python
import json, re
CHECKS = [
    ('g9-physics-s1-student-book.json', 66, r'WF = F d'),
    ('g9-physics-s1-student-book.json', 69, r'P = WF'),
    ('g9-physics-s1-student-book.json', 79, r'F1 d1 = F2 d2'),
    ('g9-physics-s1-student-book.json', 80, r'MA = load'),
    ('g9-physics-s1-student-book.json', 81, r'MA = d2'),
    ('g9-physics-s2-student-book.json', 14, r'P = P0 \+ ρhg'),
    ('g9-physics-s2-student-book.json', 37, r'n ='),
    ('g9-physics-s2-student-book.json', 41, r'n1 sin θ1 = n2 sin θ2'),
    ('g9-physics-s2-student-book.json', 46, r'sin θc = n2'),
    ('phys-s2-student-book.json', 63, r'FB = '),
    ('phys-s1-student-book.json', 59, r'R = T × v0 cos θ'),
]
for f, page, pat in CHECKS:
    d = json.load(open('lib/curriculum/src/data/extracted/' + f, encoding='utf-8'))
    text = next(p['text'] for p in d['text'] if p['page'] == page)
    m = re.search(pat, text)
    print(f, 'p.' + str(page), pat, '->', 'FOUND' if m else 'MISSING', repr(text[m.start():m.start() + 60]) if m else '')
```

Expected: every line `FOUND`. If one is `MISSING`, search the neighbouring pages before concluding; if the book truly does not print it, stop and report — do not invent a formula. Delete the script afterwards.

Two readings are settled already and must be kept: on PDF p.79–81 the book defines `d1` as the load (resistance) arm and `d2` as the effort arm, with `F1` the load (worked example: `m1 = 25 kg` at `d1 = 20 cm` balances `m2 = 10 kg` at `d2 = 50 cm`, `MA = d2 / d1 = 2.5`). On p.37–38 the text layer shows the speed in the medium as `ν`; the card writes Latin `v`, as the Grade 10 books do — list this in the PR body for a physics teacher to confirm against the printed page.

- [ ] **Step 2: Add Grade 9 physics to the test's catalog table**

In `lib/curriculum/src/__tests__/lab.test.ts`, in `FILES`, after the `iqra_curriculum_g10_earth_sem2.json` row add:

```ts
  { file: 'iqra_curriculum_g9_phys_sem1.json', gradeId: 'grade-9', subject: 'phys', semester: 1 },
  { file: 'iqra_curriculum_g9_phys_sem2.json', gradeId: 'grade-9', subject: 'phys', semester: 2 },
```

Run: `pnpm --filter @workspace/curriculum test`
Expected: unchanged — every test passes except the known environmental `r2.test.ts` failure in a container with R2 configured.

- [ ] **Step 3: Append the nine rows**

With the Edit tool, find the end of `lib/curriculum/src/data/lab_items.json`. After PR 1 it is the row `lab-ext-commons-g5-weather-station`, ending

```
      "titleEn": "Weather station with anemometer and rain gauge"
    }
  ]
}
```

(if `main` has appended rows since, the last row is whatever precedes `  ]`). Add a comma after that last row's closing `}` and insert this block before `  ]`:

```json
    {
      "id": "law-work",
      "kind": "law",
      "origin": "original",
      "gradeId": "grade-9",
      "subjectId": "physics",
      "lessonId": "kbl-g9-phys-s1-nccd-u3_l1",
      "titleAr": "الشغلُ",
      "titleEn": "Work",
      "formula": "WF = F d",
      "quantities": [
        { "symbol": "WF", "nameEn": "Work done by the force", "unit": "J" },
        { "symbol": "F", "nameEn": "Force", "unit": "N" },
        { "symbol": "d", "nameEn": "Displacement in the direction of the force", "unit": "m" }
      ],
      "termsAr": ["الشغلُ"]
    },
    {
      "id": "law-power",
      "kind": "law",
      "origin": "original",
      "gradeId": "grade-9",
      "subjectId": "physics",
      "lessonId": "kbl-g9-phys-s1-nccd-u3_l1",
      "titleAr": "القُدرةُ",
      "titleEn": "Power",
      "formula": "P = WF ÷ Δt",
      "quantities": [
        { "symbol": "P", "nameEn": "Power", "unit": "W" },
        { "symbol": "WF", "nameEn": "Work done", "unit": "J" },
        { "symbol": "Δt", "nameEn": "Time taken", "unit": "s" }
      ],
      "termsAr": ["القُدرةُ", "الشغلُ"]
    },
    {
      "id": "law-lever",
      "kind": "law",
      "origin": "original",
      "gradeId": "grade-9",
      "subjectId": "physics",
      "lessonId": "kbl-g9-phys-s1-nccd-u3_l2",
      "titleAr": "الرافعةُ",
      "titleEn": "The Lever",
      "formula": "F1 d1 = F2 d2 ,  MA = d2 ÷ d1",
      "quantities": [
        { "symbol": "F1", "nameEn": "Load (resistance)", "unit": "N" },
        { "symbol": "d1", "nameEn": "Load arm from the fulcrum", "unit": "m" },
        { "symbol": "F2", "nameEn": "Effort force", "unit": "N" },
        { "symbol": "d2", "nameEn": "Effort arm from the fulcrum", "unit": "m" },
        { "symbol": "MA", "nameEn": "Mechanical advantage", "unit": "no unit" }
      ],
      "termsAr": ["الرافعةُ"]
    },
    {
      "id": "law-fluid-pressure",
      "kind": "law",
      "origin": "original",
      "gradeId": "grade-9",
      "subjectId": "physics",
      "lessonId": "kbl-g9-phys-s2-nccd-u4_l1",
      "titleAr": "ضغطُ المائعِ",
      "titleEn": "Fluid Pressure",
      "formula": "P = P0 + ρ h g",
      "quantities": [
        { "symbol": "P", "nameEn": "Total pressure at depth h", "unit": "Pa" },
        { "symbol": "P0", "nameEn": "Atmospheric pressure at the surface", "unit": "Pa" },
        { "symbol": "ρ", "nameEn": "Density of the fluid", "unit": "kg/m³" },
        { "symbol": "h", "nameEn": "Depth below the surface", "unit": "m" },
        { "symbol": "g", "nameEn": "Free-fall acceleration", "unit": "m/s²" }
      ],
      "termsAr": ["ضغطُ المائعِ", "المائعُ"]
    },
    {
      "id": "law-refractive-index",
      "kind": "law",
      "origin": "original",
      "gradeId": "grade-9",
      "subjectId": "physics",
      "lessonId": "kbl-g9-phys-s2-nccd-u5_l1",
      "titleAr": "معاملُ الانكسارِ",
      "titleEn": "Refractive Index",
      "formula": "n = c ÷ v",
      "quantities": [
        { "symbol": "n", "nameEn": "Refractive index of the medium", "unit": "no unit" },
        { "symbol": "c", "nameEn": "Speed of light in a vacuum", "unit": "m/s" },
        { "symbol": "v", "nameEn": "Speed of light in the medium", "unit": "m/s" }
      ],
      "termsAr": ["معاملُ الانكسارِ"]
    },
    {
      "id": "law-snell",
      "kind": "law",
      "origin": "original",
      "gradeId": "grade-9",
      "subjectId": "physics",
      "lessonId": "kbl-g9-phys-s2-nccd-u5_l1",
      "titleAr": "الانكسارُ",
      "titleEn": "Law of Refraction",
      "formula": "n1 sin θ1 = n2 sin θ2",
      "quantities": [
        { "symbol": "n1", "nameEn": "Refractive index of the first medium", "unit": "no unit" },
        { "symbol": "θ1", "nameEn": "Angle of incidence", "unit": "°" },
        { "symbol": "n2", "nameEn": "Refractive index of the second medium", "unit": "no unit" },
        { "symbol": "θ2", "nameEn": "Angle of refraction", "unit": "°" }
      ],
      "termsAr": ["الانكسارُ", "زاويةُ السقوطِ", "زاويةُ الانكسارِ"]
    },
    {
      "id": "law-critical-angle",
      "kind": "law",
      "origin": "original",
      "gradeId": "grade-9",
      "subjectId": "physics",
      "lessonId": "kbl-g9-phys-s2-nccd-u5_l2",
      "titleAr": "زاويةٌ حَرجةٌ",
      "titleEn": "Critical Angle",
      "formula": "sin θc = n2 ÷ n1",
      "quantities": [
        { "symbol": "θc", "nameEn": "Critical angle", "unit": "°" },
        { "symbol": "n1", "nameEn": "Refractive index of the denser medium", "unit": "no unit" },
        { "symbol": "n2", "nameEn": "Refractive index of the less dense medium", "unit": "no unit" }
      ],
      "termsAr": ["زاويةٌ حَرجةٌ", "انعكاسٌ كلّيٌّ داخليٌّ"]
    },
    {
      "id": "law-buoyant-force",
      "kind": "law",
      "origin": "original",
      "gradeId": "grade-10",
      "subjectId": "physics",
      "lessonId": "kbl-phys-s2-nccd-u5_l1",
      "titleAr": "قوة الطفو",
      "titleEn": "Buoyant Force",
      "formula": "FB = ρf Vf g",
      "quantities": [
        { "symbol": "FB", "nameEn": "Buoyant force", "unit": "N" },
        { "symbol": "ρf", "nameEn": "Density of the fluid", "unit": "kg/m³" },
        { "symbol": "Vf", "nameEn": "Volume of fluid displaced", "unit": "m³" },
        { "symbol": "g", "nameEn": "Free-fall acceleration", "unit": "m/s²" }
      ],
      "termsAr": ["قوة الطفو", "قاعدة أرخميدس"]
    },
    {
      "id": "law-projectile-range",
      "kind": "law",
      "origin": "original",
      "gradeId": "grade-10",
      "subjectId": "physics",
      "lessonId": "kbl-phys-s1-nccd-u2_l2",
      "titleAr": "المدى الأفقي",
      "titleEn": "Horizontal Range",
      "formula": "R = T × v0 cos θ",
      "quantities": [
        { "symbol": "R", "nameEn": "Horizontal range", "unit": "m" },
        { "symbol": "T", "nameEn": "Time of flight", "unit": "s" },
        { "symbol": "v0", "nameEn": "Launch speed", "unit": "m/s" },
        { "symbol": "θ", "nameEn": "Launch angle above the horizontal", "unit": "°" }
      ],
      "termsAr": ["المدى الأفقي", "زمن التحليق", "المقذوفات"]
    }
```

Do not retype the Arabic: copy it from this block, and if a test then says a term is not in the lesson's vocabulary, print the lesson's vocabulary from the catalog JSON (`python3 -c` reading `lib/curriculum/src/data/iqra_curriculum_g9_phys_sem1.json` etc.) and copy the exact string from there. Never edit the catalog JSON to match.

Check the diff: `git diff --stat lib/curriculum/src/data/lab_items.json` — text, about 150 insertions, 1 deletion (the previous last item's `}` gaining a comma), no `Bin`.

- [ ] **Step 4: Run the curriculum suite**

Run: `pnpm --filter @workspace/curriculum test && pnpm --filter @workspace/curriculum run verify`
Expected: PASS (except the known `r2.test.ts` environmental failure). The checks that matter: "names a lesson that exists, in the item's own subject", "files every item under its own lesson's grade", "only shows a law term the lesson itself lists", and `validateLabItems` ("titleAr must be one of termsAr").

- [ ] **Step 5: Run the deck guards and the app lesson check**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labSlides.test.ts services/__tests__/labLessons.test.ts`
Expected: PASS. `labSlides.test.ts` runs every shipped law, in Arabic and English, through the deck's real formula helpers: each equation line must be drawn as one isolated equation, every unit must stay plain text, and no subscript letter may appear. If a new card fails there, change the card's notation (never the guard) — for example a symbol the isolate splits — and record the change and why in your report. `labLessons.test.ts` must resolve all nine Grade 9/10 lessons through `getLessonById`; if a Grade 9 lesson is hidden by the MVP gate, stop and report.

- [ ] **Step 6: Bring the spec in line with what shipped**

In `docs/superpowers/specs/2026-11-13-lab-expansion-design.md` §3, replace the Formula column of the table with the formulas exactly as in the JSON above (`WF = F d`, `P = WF ÷ Δt`, `F1 d1 = F2 d2 ,  MA = d2 ÷ d1`, `P = P0 + ρ h g`, `n = c ÷ v`, `n1 sin θ1 = n2 sin θ2`, `sin θc = n2 ÷ n1`, `FB = ρf Vf g`, `R = T × v0 cos θ`) and the Source column for the first row to `g9-physics-s1 p.66` (the lesson page; p.12 is the units table). Then fix two sentences that are wrong:
- "Symbols follow the book: `g = 10 m/s²`, …" → "Symbols follow the book: `P0` for atmospheric pressure, `WF` for work, `ρf`/`Vf` for the displaced fluid, …" (drop the `g` claim; a law card states no value of `g`).
- In §4, "`g = 10 m/s²` everywhere, as the books use." → "`g` is the value the tool's own book uses in that lesson's worked examples — the Grade 9 book uses 10 m/s²; the Grade 10 projectile example (phys-s1 p.60) uses 9.8 m/s² and the Grade 10 fluids examples (phys-s2 p.64–65) use 10 m/s². Each pure module takes `g` from its lesson, and its tests pin the book's worked example with that value."

- [ ] **Step 7: Commit**

```bash
git add lib/curriculum/src/__tests__/lab.test.ts lib/curriculum/src/data/lab_items.json docs/superpowers/specs/2026-11-13-lab-expansion-design.md
git diff --cached --stat
git commit -m "feat(lab): nine physics formula cards for Grades 9 and 10"
```

---

### Task 2: Type chips follow the grade and subject

With Grade 9 in the Lab, Grade 9 has only formula cards, yet the type row still offers «نموذج تفاعلي» and «مصدر خارجي», which lead to the empty state (the same gap PR 1 left for Grade 5, recorded under *Not done*). Type chips get the treatment PR 1 gave subject chips.

**Files:**
- Modify: `artifacts/mobile/services/labFilters.ts`
- Test: `artifacts/mobile/services/__tests__/labFilters.test.ts`
- Modify: `artifacts/mobile/app/curriculum/lab/index.tsx`
- Modify: `docs/superpowers/specs/2026-11-13-lab-expansion-design.md` (§1)

**Interfaces:**
- Consumes: `labSubjectIds`, `keepLabSubject` (PR 1, `services/labFilters.ts`); `LabItem`, `LabItemKind` from `@workspace/curriculum/lab`.
- Produces:
  - `labKindIds(items: readonly LabItem[], gradeId: string | null, subjectId: string | null): LabItemKind[]`
  - `keepLabKind(kind: LabItemKind | null, available: readonly LabItemKind[]): LabItemKind | null`

- [ ] **Step 1: Write the failing tests**

Append to `artifacts/mobile/services/__tests__/labFilters.test.ts` (it already defines `item(id, gradeId, subjectId)` building an `external` item and `ITEMS`). Change the import line to:

```ts
import { initialLabGrade, keepLabKind, keepLabSubject, labGradeIds, labKindIds, labSubjectIds } from '../labFilters.ts';
```

and add:

```ts
const law = (id: string, gradeId: string, subjectId: string): LabItem => ({
  id,
  kind: 'law',
  origin: 'original',
  gradeId,
  subjectId,
  lessonId: `kbl-${id}`,
  titleAr: id,
  titleEn: id,
  formula: 'F = m × a',
  quantities: [{ symbol: 'F', nameEn: 'Force', unit: 'N' }],
  termsAr: [id],
});

const MIXED: LabItem[] = [
  law('g9-law', 'grade-9', 'physics'),
  item('g10-ext', 'grade-10', 'physics'),
  law('g10-law', 'grade-10', 'chemistry'),
];

describe('labKindIds', () => {
  it('offers only the kinds the grade has', () => {
    assert.deepEqual(labKindIds(MIXED, 'grade-9', null), ['law']);
  });
  it('narrows by subject inside the grade', () => {
    assert.deepEqual(labKindIds(MIXED, 'grade-10', 'physics'), ['external']);
    assert.deepEqual(labKindIds(MIXED, 'grade-10', null), ['external', 'law']);
  });
  it('offers every kind, once each, in manifest order, for all grades and subjects', () => {
    assert.deepEqual(labKindIds(MIXED, null, null), ['law', 'external']);
  });
  it('is empty for a grade with no items', () => {
    assert.deepEqual(labKindIds(MIXED, 'grade-5', null), []);
  });
});

describe('keepLabKind', () => {
  it('keeps a kind still offered', () => {
    assert.equal(keepLabKind('law', ['law', 'external']), 'law');
  });
  it('falls back to all kinds when it is no longer offered', () => {
    assert.equal(keepLabKind('interactive', ['law']), null);
  });
  it('keeps all kinds as all kinds', () => {
    assert.equal(keepLabKind(null, ['law']), null);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labFilters.test.ts`
Expected: FAIL — `labKindIds` / `keepLabKind` are not exported.

- [ ] **Step 3: Implement**

In `artifacts/mobile/services/labFilters.ts`, change the import to

```ts
import type { LabItem, LabItemKind } from '@workspace/curriculum/lab';
```

and append:

```ts
/**
 * Kinds with items in `gradeId` and `subjectId` (`null` = every grade / every
 * subject), each once, in manifest order — so a grade that has only formula
 * cards is not offered «نموذج تفاعلي» that leads to the empty state.
 */
export function labKindIds(items: readonly LabItem[], gradeId: string | null, subjectId: string | null): LabItemKind[] {
  const out: LabItemKind[] = [];
  for (const i of items) {
    if (gradeId !== null && i.gradeId !== gradeId) continue;
    if (subjectId !== null && i.subjectId !== subjectId) continue;
    if (!out.includes(i.kind)) out.push(i.kind);
  }
  return out;
}

/** The picked kind if still offered, else `null` (all kinds). */
export function keepLabKind(kind: LabItemKind | null, available: readonly LabItemKind[]): LabItemKind | null {
  return kind !== null && available.includes(kind) ? kind : null;
}
```

- [ ] **Step 4: Run them to see them pass**

Run the same command. Expected: PASS (the 11 PR 1 tests plus 7 new).

- [ ] **Step 5: Wire the screen**

In `artifacts/mobile/app/curriculum/lab/index.tsx`:

1. Import: change
```ts
import { initialLabGrade, keepLabSubject, labGradeIds, labSubjectIds } from '@/services/labFilters';
```
to
```ts
import { initialLabGrade, keepLabKind, keepLabSubject, labGradeIds, labKindIds, labSubjectIds } from '@/services/labFilters';
```
2. Delete the module constant `const KINDS = [...new Set(LAB_ITEMS.map(i => i.kind))] as LabItemKind[];` (and its comment line if it only explains `KINDS`; keep the comment if it also covers `VISIBLE_GRADES`).
3. Replace
```ts
  const [kind, setKind] = useState<LabItemKind | null>(null);
```
with
```ts
  const [pickedKind, setKind] = useState<LabItemKind | null>(null);
```
4. Replace the block from `  const subjectIds = labSubjectIds(LAB_ITEMS, gradeId);` through the end of `pickGrade` (`  };`) with:
```ts
  const subjectIds = labSubjectIds(LAB_ITEMS, gradeId);
  const subjectId = keepLabSubject(pickedSubject, subjectIds);
  const kindIds = labKindIds(LAB_ITEMS, gradeId, subjectId);
  const kind = keepLabKind(pickedKind, kindIds);
  // A grade or subject change resets a subject or type the new choice does not
  // offer (spec §1), so a pick hidden under one choice cannot resurface later.
  const pickGrade = (id: string | null) => {
    const nextSubject = keepLabSubject(subjectId, labSubjectIds(LAB_ITEMS, id));
    setPickedGrade(id);
    setSubjectId(nextSubject);
    setKind(keepLabKind(kind, labKindIds(LAB_ITEMS, id, nextSubject)));
  };
  const pickSubject = (id: string | null) => {
    setSubjectId(id);
    setKind(keepLabKind(kind, labKindIds(LAB_ITEMS, gradeId, id)));
  };
```
5. In the subject chip row, change both `onPress={() => setSubjectId(null)}` and `onPress={() => setSubjectId(id)}` to `pickSubject(null)` and `pickSubject(id)`.
6. In the type chip row, change `{KINDS.map(k => (` to `{kindIds.map(k => (`. Leave `filterLabItems({ … kind: kind ?? undefined })` as it is — `kind` is now the kept value.

- [ ] **Step 6: Spec §1**

In the spec's §1 list, after the bullet about subject chips, add: "- Type chips (`labKindIds`) show only types that have items in the selected grade and subject, and reset the same way when a grade or subject change leaves the picked type with nothing. (Added in PR 2: Grade 9 has only formula cards.)"

- [ ] **Step 7: Typecheck, suite, browser**

Run: root `pnpm run typecheck`, then `cd artifacts/mobile && pnpm test` (prints nothing for minutes; not a hang). Expected: PASS.

Browser check (same recipe as PR 1 Task 4: throwaway Postgres from `/usr/lib/postgresql/16/bin`, `migrate -- --from-env`, API with `AI_LIVE_MODE=false`, `pnpm run dev:mobile:web` without `CI=1`, throwaway teacher; never read `.env`). As a teacher whose grades are 9 and 10:
- opens on «الصف العاشر» (first in visible-grade order);
- «الصف التاسع» shows 7 rows, subject «الفيزياء» only, and the type row offers only «قانون»;
- pick «قانون» under Grade 10, tap «الصف الخامس»: the type resets to «كل الأنواع» and Grade 5's rows show;
- open `law-snell` and `law-lever`: the formula reads left-to-right, the quantities show their units, and the Arabic terms match the lesson.
Screenshots (deviceScaleFactor 2) to the scratchpad: the Grade 9 list (phone, light) and `law-lever` (phone, dark). Stop every server and the cluster.

- [ ] **Step 8: Commit**

```bash
git add artifacts/mobile/services/labFilters.ts artifacts/mobile/services/__tests__/labFilters.test.ts artifacts/mobile/app/curriculum/lab/index.tsx docs/superpowers/specs/2026-11-13-lab-expansion-design.md
git diff --cached --stat
git commit -m "feat(lab): type chips follow the grade and subject"
```

---

### Task 3: «ما الجديد», status log, checks

**Files:**
- Modify: `artifacts/mobile/services/whatsNew.ts`, `artifacts/mobile/services/i18n.ts`
- Modify: `docs/status-log.md`
- Modify: `docs/superpowers/specs/2026-11-13-lab-expansion-design.md` (status line)

- [ ] **Step 1: The entry**

At the top of `WHATS_NEW`. `date` is today's Amman date: run `TZ=Asia/Amman date +%F` and use its output (the PR body asks for the merge day if the merge is later). If `main` already has an entry dated later than that, put this one directly above the newest entry whose date is not later, so the list stays newest first (`whatsNew.test.ts` checks the order).

```ts
  {
    id: 'lab-physics-laws',
    date: '2026-11-14', // replace with the output of: TZ=Asia/Amman date +%F
    roles: ['teacher', 'student'],
    titleKey: 'whatsNewLabLawsTitle',
    bodyKey: 'whatsNewLabLawsBody',
    route: '/curriculum/lab',
  },
```

`ar` block, beside the other `whatsNew*` keys:

```ts
    whatsNewLabLawsTitle: 'قوانين الفيزياء في «المختبر»',
    whatsNewLabLawsBody: 'أضفنا إلى «المختبر» بطاقات قوانين لفيزياء الصف التاسع: الشغل والقدرة، والرافعة، وضغط المائع، والانكسار والزاوية الحرجة، وللصف العاشر: قوة الطفو والمدى الأفقي. اعرضها في الحصة أو أضفها إلى عرض الدرس.',
```

`en` block:

```ts
    whatsNewLabLawsTitle: 'Physics formulas in the Lab',
    whatsNewLabLawsBody: 'The Science Lab now has formula cards for Grade 9 physics (work and power, the lever, fluid pressure, refraction and the critical angle) and for Grade 10 (buoyant force and horizontal range). Show them in class or add them to the lesson deck.',
```

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whatsNew.test.ts` — Expected: PASS.

- [ ] **Step 2: Status log and spec status**

At the top of `docs/status-log.md`, directly under the header paragraph:

```markdown
## Science Lab: physics formula cards for Grades 9 and 10 — 2026-11-14

PR 2 of `docs/superpowers/specs/2026-11-13-lab-expansion-design.md`.

**What changed.**
- Nine `law` cards: Grade 9 — work (`WF = F d`), power (`P = WF ÷ Δt`), the lever (`F1 d1 = F2 d2 ,  MA = d2 ÷ d1`),
  fluid pressure (`P = P0 + ρ h g`), refractive index (`n = c ÷ v`), the law of refraction (`n1 sin θ1 = n2 sin θ2`),
  the critical angle (`sin θc = n2 ÷ n1`); Grade 10 — buoyant force (`FB = ρf Vf g`) and horizontal range
  (`R = T × v0 cos θ`). Each formula is in the book's notation (PDF pages listed in spec §3); each card's Arabic is the
  lesson's own vocabulary, checked by `lab.test.ts`, and each renders as a deck slide (`labSlides.test.ts`).
- Grade 9 joins the Lab: its grade chip appears, and a Grade 9 teacher opens on it.
- Type chips follow the grade and subject (`labKindIds`), so Grade 9 and Grade 5 no longer offer types they have none of.
- Spec correction: `g` is whatever the tool's own book uses in that lesson (Grade 10 projectile: 9.8 m/s²), not
  10 m/s² everywhere.

**Verified.** Root typecheck; curriculum `test` (N/M — name any failure, e.g. `r2.test.ts` where R2 is configured
locally) and `verify`; mobile `pnpm test` (N tests, 0 failing); api-server build + test (N); math-verifier (ran / not run
and why); browser: a Grade 9+10 teacher opens on Grade 10, Grade 9 shows 7 formula cards with only «قانون» offered,
the type resets on a grade change, `law-snell` and `law-lever` read correctly.

**Not done.** The six physics tools and the virtual-lab review screen (PRs 3–5). The refractive-index card writes
the speed as `v`; the Grade 9 text layer shows `ν` — to be confirmed against the printed page by a physics teacher.
Grade 5 images are still links until ingested.
```

Replace each `N`/`M` in **Verified** with the counts your runs printed, and correct any clause that did not hold (say what happened instead); a check that could not run is named with the reason. The heading's date is the same Amman date used for the What's New entry. In the spec, change the status line to: `Status: written 2026-11-13. PR 1 (grade filter, media) and PR 2 (formula cards, type chips) built; PRs 3–5 not started.`

- [ ] **Step 3: Run what CI runs**

```bash
pnpm run typecheck
```

```bash
pnpm --filter @workspace/curriculum test && pnpm --filter @workspace/curriculum run verify
```

```bash
cd artifacts/mobile && pnpm test
```

```bash
cd artifacts/api-server && pnpm build && pnpm test
```

```bash
cd artifacts/math-verifier && python -X utf8 test_equations.py
```

Expected: all PASS. Report anything that cannot run here (for example a missing Python package) instead of installing system packages.

- [ ] **Step 4: Commit**

```bash
git add artifacts/mobile/services/whatsNew.ts artifacts/mobile/services/i18n.ts docs/status-log.md docs/superpowers/specs/2026-11-13-lab-expansion-design.md
git diff --cached --stat
git commit -m "docs(lab): what's new, status log and spec status for the physics formula cards"
```

Then push and open a **new** PR (not #1447) titled «Science Lab: physics formula cards for Grades 9 and 10», with: what changed, the PDF page for each formula, the `ν`/`v` question for a physics teacher, the What's New entry and its date note, the two screenshots, and «Deploy: web bundle and API (lib/ changed); no migration, no native change».
