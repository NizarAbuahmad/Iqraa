# Science Lab («المختبر») Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a «المختبر» shelf to the library: a list of grade 10 chemistry and physics lab items, a full-screen present mode for each, and three interactives (periodic table, mole calculator, vector addition).

**Architecture:** Curated item data and a loader live in `lib/curriculum` (new `lab.ts`, `elements.ts` and two JSON files, exposed as `./lab` and `./elements` subpaths). Calculation logic lives in pure modules under `artifacts/mobile/services/` so `node --test` can run them. Screens and SVG components live under `app/curriculum/lab/` and `components/lab/` and import only the pure modules. No DB table, no native module.

**Tech Stack:** TypeScript, Expo Router, React Native + `react-native-svg`, `expo-image`, `expo-clipboard`, `expo-linking`, `node --test` with `--experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-10-06-science-lab-design.md`

## Global Constraints

- Arabic is the product language and the UI is RTL-first. Compute maths in latin; convert to Arabic digits only at display time (`labFormat.ts`).
- Phase 1 adds **no DB table and no schema change**, so no `schema-push` is needed. The PR description must say `schema-push: not needed`.
- **No new native module and no `app.json` `version` bump.** Use only packages already in `artifacts/mobile/package.json`.
- Every curriculum Arabic term shown (element names, law terms) is checked by a test against the lesson's own `vocabulary` or the printed textbook text. Do not write curriculum Arabic from memory. UI chrome strings (buttons, labels) are the only Arabic written fresh, and go through `services/i18n.ts` in both the `ar` and `en` blocks.
- Lessons are carried by `kbl-*` id, never by title. Each item's `subjectId` must agree with its lesson (a chemistry item on a chemistry lesson), and a test enforces it.
- Mobile tests only run under `artifacts/mobile/services/__tests__/**/*.test.ts` with bare `node --test`, so anything tested must not import `react-native` or `expo-*`. Files loaded directly by `node --test` use explicit `.ts` import extensions.
- `lib/curriculum` tests run from `src/**/__tests__/**/*.test.ts` (`pnpm --filter @workspace/curriculum test`).
- Do not add a licensed item from memory. Licence and `licenseCheckedAt` stay in `external_resources.json`; lab items point at them by id.
- Commit messages end with the two attribution trailer lines the session was given (`Co-Authored-By: ...` and `Claude-Session: ...`). Work on branch `claude/optimistic-hawking-fiflkp`, which already carries draft PR #886.
- `STATUS.md` is the source of truth: edit it in the same PR (Task 9).

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/curriculum/src/data/lab_items.json` | The curated lab items (3 interactives, 4 laws, then external pointers). |
| `lib/curriculum/src/lab.ts` | Types, loader, filters, `validateLabItems`. |
| `lib/curriculum/src/data/elements.json` | Elements 1–20: symbol, names, mass, period, group. |
| `lib/curriculum/src/elements.ts` | Element lookups, electron configuration, shell counts. |
| `lib/curriculum/src/__tests__/lab.test.ts`, `elements.test.ts` | Data integrity and witness tests. |
| `artifacts/mobile/services/labFormat.ts` | Arabic-Indic digits, number and scientific formatting. |
| `artifacts/mobile/services/labLinks.ts` | Route paths and route-param resolution. |
| `artifacts/mobile/services/labMole.ts` | Formula parser, molar mass, mole conversions. |
| `artifacts/mobile/services/labVectors.ts` | Vector addition and scene layout. |
| `artifacts/mobile/components/lab/*.tsx` | Frame, item cards, three interactives, figure strip. |
| `artifacts/mobile/app/curriculum/lab/index.tsx`, `[itemId].tsx` | The shelf and present mode. |
| `artifacts/mobile/app/curriculum/resources.tsx` | Entry card (small edit). |

---

### Task 1: Lab item data model and loader

**Files:**
- Create: `lib/curriculum/src/data/lab_items.json`
- Create: `lib/curriculum/src/lab.ts`
- Create: `lib/curriculum/src/__tests__/lab.test.ts`
- Modify: `lib/curriculum/package.json` (add the `./lab` export)

**Interfaces:**
- Produces (used by Tasks 5–9):
  - `LAB_INTERACTIVE_IDS = ['periodic-table','mole-calculator','vector-addition'] as const`, `type LabInteractiveId`
  - `type LabItemKind = 'interactive' | 'law' | 'external'`
  - `interface LabQuantity { symbol: string; nameEn: string; unit: string }`
  - `type LabItem = LabInteractiveItem | LabLawItem | LabExternalItem`, all sharing `id, gradeId, subjectId, lessonId, titleAr, titleEn`
  - `LAB_ITEMS: LabItem[]`, `getLabItem(id: string): LabItem | undefined`, `labItemsForLesson(lessonId: string): LabItem[]`, `filterLabItems(f?: LabFilter, items?: readonly LabItem[]): LabItem[]`, `validateLabItems(items?: readonly LabItem[]): string[]`

- [ ] **Step 1: Write the failing test**

Create `lib/curriculum/src/__tests__/lab.test.ts`:

```ts
/**
 * The lab item manifest (`lab.ts`).
 *
 * What this guards: every item names a lesson by id, and that lesson has to
 * exist and belong to the item's own subject. A lesson title does not identify
 * a lesson, and the generators branch on subject — a chemistry card filed on a
 * physics lesson would look fine and teach the wrong class. Law cards show the
 * lesson's own vocabulary terms, so each term is checked against the lesson.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  LAB_INTERACTIVE_IDS,
  LAB_ITEMS,
  filterLabItems,
  getLabItem,
  labItemsForLesson,
  validateLabItems,
  type LabItem,
} from '../lab.ts';
import { lessonKbId } from '../curriculumIds.ts';
import { GRADES, SUBJECTS } from '../catalog.ts';

interface CatalogLesson {
  id: string;
  vocabulary?: Array<{ ar: string; en: string }>;
}
interface CatalogFile {
  units: Array<{ lessons: CatalogLesson[] }>;
}

const FILES = [
  { file: 'iqra_curriculum_g10_chem_sem1.json', subject: 'chem', semester: 1 },
  { file: 'iqra_curriculum_g10_chem_sem2.json', subject: 'chem', semester: 2 },
  { file: 'iqra_curriculum_g10_phys_sem1.json', subject: 'phys', semester: 1 },
  { file: 'iqra_curriculum_g10_phys_sem2.json', subject: 'phys', semester: 2 },
] as const;

/** kbl id → { subject slug, Arabic vocabulary terms }, for every grade 10 chem/phys lesson. */
function lessonIndex(): Map<string, { slug: string; terms: string[] }> {
  const out = new Map<string, { slug: string; terms: string[] }>();
  for (const f of FILES) {
    const cat = JSON.parse(readFileSync(new URL(`../data/${f.file}`, import.meta.url), 'utf8')) as CatalogFile;
    for (const unit of cat.units) {
      for (const lesson of unit.lessons) {
        const id = lessonKbId({ gradeId: 'grade-10', subject: f.subject, semester: f.semester }, lesson.id);
        out.set(id, { slug: f.subject, terms: (lesson.vocabulary ?? []).map(v => v.ar) });
      }
    }
  }
  return out;
}

const SLUG_BY_SUBJECT: Record<string, string> = { chemistry: 'chem', physics: 'phys' };

describe('the shipped lab manifest', () => {
  it('is structurally valid', () => {
    assert.deepEqual(validateLabItems(), []);
  });

  it('files every item under a real grade and subject', () => {
    const grades = new Set(GRADES.map(g => g.id));
    const subjects = new Set(SUBJECTS.map(s => s.id));
    for (const item of LAB_ITEMS) {
      assert.ok(grades.has(item.gradeId), `${item.id}: unknown grade ${item.gradeId}`);
      assert.ok(subjects.has(item.subjectId), `${item.id}: unknown subject ${item.subjectId}`);
    }
  });

  it('names a lesson that exists, in the item\'s own subject', () => {
    const lessons = lessonIndex();
    for (const item of LAB_ITEMS) {
      const lesson = lessons.get(item.lessonId);
      assert.ok(lesson, `${item.id}: ${item.lessonId} is not a grade 10 chemistry/physics lesson`);
      assert.equal(lesson.slug, SLUG_BY_SUBJECT[item.subjectId], `${item.id}: subject disagrees with its lesson`);
    }
  });

  it('only shows a law term the lesson itself lists', () => {
    const lessons = lessonIndex();
    for (const item of LAB_ITEMS) {
      if (item.kind !== 'law') continue;
      const terms = lessons.get(item.lessonId)?.terms ?? [];
      for (const term of item.termsAr) {
        assert.ok(terms.includes(term), `${item.id}: "${term}" is not in the lesson's vocabulary`);
      }
    }
  });

  it('ships the three flagship interactives, once each', () => {
    const ids = LAB_ITEMS.flatMap(i => (i.kind === 'interactive' ? [i.interactiveId] : []));
    assert.deepEqual([...ids].sort(), [...LAB_INTERACTIVE_IDS].sort());
  });
});

describe('lookups', () => {
  it('finds an item by id and returns undefined otherwise', () => {
    assert.equal(getLabItem('lab-periodic-table')?.kind, 'interactive');
    assert.equal(getLabItem('nope'), undefined);
  });

  it('filters by lesson, treating an empty id as no lesson', () => {
    assert.ok(labItemsForLesson('kbl-chem-s2-nccd-u4_l2').length >= 2);
    assert.deepEqual(labItemsForLesson(''), []);
  });

  it('filters by subject and kind', () => {
    const laws = filterLabItems({ kind: 'law' });
    assert.ok(laws.length > 0 && laws.every(i => i.kind === 'law'));
    const phys = filterLabItems({ subjectId: 'physics' });
    assert.ok(phys.length > 0 && phys.every(i => i.subjectId === 'physics'));
  });
});

describe('validateLabItems', () => {
  const law: LabItem = {
    id: 'x',
    kind: 'law',
    origin: 'original',
    gradeId: 'grade-10',
    subjectId: 'physics',
    lessonId: 'kbl-phys-s1-nccd-u2_l3',
    titleAr: 'عنوان',
    titleEn: 'Title',
    formula: 'F = m × a',
    quantities: [{ symbol: 'F', nameEn: 'Force', unit: 'N' }],
    termsAr: ['عنوان'],
  };

  it('flags a duplicate id', () => {
    assert.ok(validateLabItems([law, law]).some(e => e.includes('duplicate id')));
  });

  it('flags a law with no formula or no terms', () => {
    const errors = validateLabItems([{ ...law, formula: ' ', termsAr: [] }]);
    assert.ok(errors.some(e => e.includes('formula')));
    assert.ok(errors.some(e => e.includes('termsAr')));
  });

  it('flags an external item pointing at nothing', () => {
    const errors = validateLabItems([
      { ...law, kind: 'external', externalId: 'does-not-exist' } as unknown as LabItem,
    ]);
    assert.ok(errors.some(e => e.includes('does-not-exist')));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/lab.test.ts`
Expected: FAIL — `Cannot find module '../lab.ts'`.

- [ ] **Step 3: Write the data file**

Create `lib/curriculum/src/data/lab_items.json`:

```json
{
  "note": "Curated Science Lab items. Schema and rules: ../lab.ts. First-party items (origin 'original') carry no licence; 'external' items point at an entry in external_resources.json, where the licence lives. A law card's Arabic terms are copied verbatim from the lesson's own vocabulary and a test enforces it — do not write curriculum Arabic from memory.",
  "items": [
    {
      "id": "lab-periodic-table",
      "kind": "interactive",
      "origin": "original",
      "interactiveId": "periodic-table",
      "gradeId": "grade-10",
      "subjectId": "chemistry",
      "lessonId": "kbl-chem-s1-nccd-u2_l2",
      "titleAr": "جدول العناصر التفاعلي",
      "titleEn": "Interactive Periodic Table"
    },
    {
      "id": "lab-mole-calculator",
      "kind": "interactive",
      "origin": "original",
      "interactiveId": "mole-calculator",
      "gradeId": "grade-10",
      "subjectId": "chemistry",
      "lessonId": "kbl-chem-s2-nccd-u4_l2",
      "titleAr": "حاسبة المول والكتلة المولية",
      "titleEn": "Mole and Molar Mass Calculator"
    },
    {
      "id": "lab-vector-addition",
      "kind": "interactive",
      "origin": "original",
      "interactiveId": "vector-addition",
      "gradeId": "grade-10",
      "subjectId": "physics",
      "lessonId": "kbl-phys-s1-nccd-u1_l2",
      "titleAr": "جمع المتجهات تفاعليًا",
      "titleEn": "Interactive Vector Addition"
    },
    {
      "id": "law-newton-second",
      "kind": "law",
      "origin": "original",
      "gradeId": "grade-10",
      "subjectId": "physics",
      "lessonId": "kbl-phys-s1-nccd-u2_l3",
      "titleAr": "القانون الثاني لنيوتن",
      "titleEn": "Newton's Second Law",
      "formula": "F = m × a",
      "quantities": [
        { "symbol": "F", "nameEn": "Net force", "unit": "N" },
        { "symbol": "m", "nameEn": "Mass", "unit": "kg" },
        { "symbol": "a", "nameEn": "Acceleration", "unit": "m/s²" }
      ],
      "termsAr": ["القانون الثاني لنيوتن"]
    },
    {
      "id": "law-vector-resultant",
      "kind": "law",
      "origin": "original",
      "gradeId": "grade-10",
      "subjectId": "physics",
      "lessonId": "kbl-phys-s1-nccd-u1_l2",
      "titleAr": "متجه المحصلة",
      "titleEn": "Resultant Vector",
      "formula": "Rx = Ax + Bx ,  Ry = Ay + By ,  R = √(Rx² + Ry²)",
      "quantities": [
        { "symbol": "R", "nameEn": "Resultant magnitude", "unit": "same as A and B" },
        { "symbol": "Rx, Ry", "nameEn": "Components of the resultant", "unit": "same as A and B" }
      ],
      "termsAr": ["متجه المحصلة", "تحليل المتجهات إلى مركباتها"]
    },
    {
      "id": "law-molar-mass",
      "kind": "law",
      "origin": "original",
      "gradeId": "grade-10",
      "subjectId": "chemistry",
      "lessonId": "kbl-chem-s2-nccd-u4_l2",
      "titleAr": "الكتلة المولية",
      "titleEn": "Molar Mass",
      "formula": "n = m ÷ Mr",
      "quantities": [
        { "symbol": "n", "nameEn": "Amount of substance", "unit": "mol" },
        { "symbol": "m", "nameEn": "Mass", "unit": "g" },
        { "symbol": "Mr", "nameEn": "Molar mass", "unit": "g/mol" }
      ],
      "termsAr": ["المول", "الكتلة المولية"]
    },
    {
      "id": "law-avogadro",
      "kind": "law",
      "origin": "original",
      "gradeId": "grade-10",
      "subjectId": "chemistry",
      "lessonId": "kbl-chem-s2-nccd-u4_l2",
      "titleAr": "عدد أفوجادرو",
      "titleEn": "Avogadro's Number",
      "formula": "N = n × N_A",
      "quantities": [
        { "symbol": "N", "nameEn": "Number of particles", "unit": "particles" },
        { "symbol": "n", "nameEn": "Amount of substance", "unit": "mol" },
        { "symbol": "N_A", "nameEn": "Avogadro's number", "unit": "particles/mol" }
      ],
      "termsAr": ["المول", "عدد أفوجادرو"]
    }
  ]
}
```

- [ ] **Step 4: Write the loader**

Create `lib/curriculum/src/lab.ts`:

```ts
/**
 * Science Lab items — what a teacher can put on the projector for one lesson.
 *
 * Three kinds, deliberately few:
 *  - `interactive`: a first-party component (periodic table, mole calculator,
 *    vector addition). Nothing licensed, so no licence fields.
 *  - `law`: a formula card. The formula and quantities are latin symbols; the
 *    only Arabic on it is lesson vocabulary copied verbatim (`termsAr`), which
 *    a test checks against the lesson. No Arabic prose is written by us.
 *  - `external`: a pointer to an entry in `external.ts`. The licence and
 *    `licenseCheckedAt` live on that entry and nowhere else, so there is one
 *    place to re-check them.
 *
 * Book figures are not listed here; the screen joins them from
 * `figuresForLesson` at render time.
 *
 * Items carry the `kbl-*` lesson id, never a title, and the subject the item is
 * filed under must agree with its lesson (enforced in `lab.test.ts`).
 */
import raw from './data/lab_items.json' with { type: 'json' };
import { getExternalResource } from './external.ts';

export const LAB_INTERACTIVE_IDS = ['periodic-table', 'mole-calculator', 'vector-addition'] as const;
export type LabInteractiveId = (typeof LAB_INTERACTIVE_IDS)[number];

export type LabItemKind = 'interactive' | 'law' | 'external';

interface LabItemBase {
  /** Stable slug, used in the present-mode URL. */
  id: string;
  /** `grade-*` id from `GRADES`. */
  gradeId: string;
  /** A `SUBJECTS` id. */
  subjectId: string;
  /** `kbl-*` lesson id. */
  lessonId: string;
  titleAr: string;
  titleEn: string;
}

export interface LabInteractiveItem extends LabItemBase {
  kind: 'interactive';
  origin: 'original';
  interactiveId: LabInteractiveId;
}

export interface LabQuantity {
  symbol: string;
  nameEn: string;
  unit: string;
}

export interface LabLawItem extends LabItemBase {
  kind: 'law';
  origin: 'original';
  /** Latin symbols. Converted to Arabic digits only at display time. */
  formula: string;
  quantities: LabQuantity[];
  /** Arabic vocabulary terms of the lesson, copied verbatim. */
  termsAr: string[];
}

export interface LabExternalItem extends LabItemBase {
  kind: 'external';
  /** An `ExternalResource.id` in `external_resources.json`. */
  externalId: string;
}

export type LabItem = LabInteractiveItem | LabLawItem | LabExternalItem;

export const LAB_ITEMS: LabItem[] = raw.items as unknown as LabItem[];

export function getLabItem(id: string): LabItem | undefined {
  return LAB_ITEMS.find(i => i.id === id);
}

/** Every lab item filed on one lesson, in manifest order. */
export function labItemsForLesson(lessonId: string): LabItem[] {
  if (!lessonId) return [];
  return LAB_ITEMS.filter(i => i.lessonId === lessonId);
}

export interface LabFilter {
  gradeId?: string;
  subjectId?: string;
  kind?: LabItemKind;
}

export function filterLabItems(f: LabFilter = {}, items: readonly LabItem[] = LAB_ITEMS): LabItem[] {
  return items.filter(
    i =>
      (!f.gradeId || i.gradeId === f.gradeId) &&
      (!f.subjectId || i.subjectId === f.subjectId) &&
      (!f.kind || i.kind === f.kind),
  );
}

/**
 * Structural problems that make an item unusable, as messages. Same posture as
 * `validateExternalResources`: this reports and the test decides. Whether the
 * lesson exists and whether a term is in its vocabulary needs the catalog, so
 * those checks live in `lab.test.ts`.
 */
export function validateLabItems(items: readonly LabItem[] = LAB_ITEMS): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) errors.push(`${item.id}: duplicate id`);
    seen.add(item.id);
    if (!item.gradeId.startsWith('grade-')) errors.push(`${item.id}: "${item.gradeId}" is not a grade-* id`);
    if (!item.subjectId) errors.push(`${item.id}: no subjectId`);
    if (!item.lessonId.startsWith('kbl-')) errors.push(`${item.id}: "${item.lessonId}" is not a kbl-* lesson id`);
    if (!item.titleAr.trim() || !item.titleEn.trim()) errors.push(`${item.id}: blank title`);

    if (item.kind === 'interactive') {
      if (!LAB_INTERACTIVE_IDS.includes(item.interactiveId)) {
        errors.push(`${item.id}: unknown interactiveId "${item.interactiveId}"`);
      }
    } else if (item.kind === 'law') {
      if (!item.formula.trim()) errors.push(`${item.id}: blank formula`);
      if (!item.quantities.length) errors.push(`${item.id}: no quantities`);
      if (!item.termsAr.length) errors.push(`${item.id}: no termsAr`);
      if (!item.termsAr.includes(item.titleAr)) errors.push(`${item.id}: titleAr must be one of termsAr`);
    } else if (item.kind === 'external') {
      if (!getExternalResource(item.externalId)) {
        errors.push(`${item.id}: externalId "${item.externalId}" is not in external_resources.json`);
      }
    }
  }
  return errors;
}
```

- [ ] **Step 5: Add the package export**

In `lib/curriculum/package.json`, in `"exports"`, add after the `"./external"` line:

```json
    "./lab": "./src/lab.ts",
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/lab.test.ts`
Expected: PASS, all tests green. If "is not in the lesson's vocabulary" fails for a term, the lesson vocabulary is the authority: fix the JSON term to match it exactly, never loosen the test. If `lessonKbId` rejects `'chem'`/`'phys'` as a `subject`, read `SUBJECTS` in `src/curriculumIds.ts` for the real slugs and change `FILES` and `SLUG_BY_SUBJECT` together.

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm --filter @workspace/curriculum run typecheck`
Expected: no errors.

```bash
git add lib/curriculum/package.json lib/curriculum/src/lab.ts lib/curriculum/src/data/lab_items.json lib/curriculum/src/__tests__/lab.test.ts
git commit -m "feat(lab): lab item manifest, loader and validation"
```

---

### Task 2: Elements 1–20 with witnessed Arabic names

**Files:**
- Create: `lib/curriculum/src/data/elements.json`
- Create: `lib/curriculum/src/elements.ts`
- Create: `lib/curriculum/src/__tests__/elements.test.ts`
- Modify: `lib/curriculum/package.json` (add the `./elements` export)

**Interfaces:**
- Produces (used by Tasks 3 and 8):
  - `interface Element { z: number; symbol: string; nameAr: string; nameEn: string; atomicMass: number; period: number; group: number }`
  - `ELEMENTS: Element[]` (Z = 1..20, ascending), `getElement(z: number): Element | undefined`, `elementBySymbol(symbol: string): Element | undefined`
  - `electronConfiguration(z: number): Array<{ n: number; sub: 's' | 'p'; electrons: number }>` (empty for Z outside 1..20)
  - `formatConfiguration(z: number): string` e.g. `"1s2 2s2 2p6 3s1"`
  - `shellCounts(z: number): number[]` e.g. Na → `[2, 8, 1]`

- [ ] **Step 1: Write the failing test**

Create `lib/curriculum/src/__tests__/elements.test.ts`:

```ts
/**
 * The element dataset (`elements.ts`).
 *
 * The Arabic names are the part most likely to be wrong, and a wrong one reads
 * as plausible Arabic. So each name must appear in the printed textbook text
 * ("witness"), not just look right. The configuration is computed, not stored,
 * and cross-checked against the stored period.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ELEMENTS,
  electronConfiguration,
  elementBySymbol,
  formatConfiguration,
  getElement,
  shellCounts,
} from '../elements.ts';
import { normalizeArabic } from '../arabic.ts';

function bookText(file: string): string {
  const doc = JSON.parse(readFileSync(new URL(`../data/extracted/${file}`, import.meta.url), 'utf8')) as {
    text: string[];
  };
  return normalizeArabic(doc.text.join('\n'));
}

describe('the element table', () => {
  it('holds elements 1–20 in order, with unique symbols', () => {
    assert.deepEqual(ELEMENTS.map(e => e.z), Array.from({ length: 20 }, (_, i) => i + 1));
    assert.equal(new Set(ELEMENTS.map(e => e.symbol)).size, 20);
  });

  it('looks elements up by number and symbol', () => {
    assert.equal(getElement(11)?.symbol, 'Na');
    assert.equal(getElement(21), undefined);
    assert.equal(elementBySymbol('Cl')?.z, 17);
    assert.equal(elementBySymbol('cl'), undefined, 'symbols are case-sensitive');
  });

  it('prints every Arabic name in the grade 10 or grade 9 chemistry book', () => {
    const corpus = `${bookText('chem-s1-student-book.json')}\n${bookText('g9-chemistry-s1-student-book.json')}`;
    const missing = ELEMENTS.filter(e => !corpus.includes(normalizeArabic(e.nameAr))).map(
      e => `${e.symbol} ${e.nameAr}`,
    );
    assert.deepEqual(missing, [], 'these names are not printed in the book — use the book\'s spelling');
  });

  it('agrees with the book on the masses a teacher will check against', () => {
    // Pinned values: the calculator's answers must match the book's answer key.
    assert.equal(elementBySymbol('H')?.atomicMass, 1.008);
    assert.equal(elementBySymbol('O')?.atomicMass, 15.999);
  });
});

describe('electron configuration', () => {
  it('fills 1s 2s 2p 3s 3p 4s in order', () => {
    assert.equal(formatConfiguration(1), '1s1');
    assert.equal(formatConfiguration(11), '1s2 2s2 2p6 3s1');
    assert.equal(formatConfiguration(20), '1s2 2s2 2p6 3s2 3p6 4s2');
  });

  it('places exactly Z electrons for every element', () => {
    for (const e of ELEMENTS) {
      const total = electronConfiguration(e.z).reduce((s, c) => s + c.electrons, 0);
      assert.equal(total, e.z, e.symbol);
    }
  });

  it('puts the stored period at the highest occupied shell', () => {
    for (const e of ELEMENTS) {
      const top = Math.max(...electronConfiguration(e.z).map(c => c.n));
      assert.equal(e.period, top, `${e.symbol}: period vs configuration`);
    }
  });

  it('counts electrons per shell', () => {
    assert.deepEqual(shellCounts(11), [2, 8, 1]);
    assert.deepEqual(shellCounts(18), [2, 8, 8]);
    assert.deepEqual(shellCounts(20), [2, 8, 8, 2]);
  });

  it('returns nothing outside the covered range', () => {
    assert.deepEqual(electronConfiguration(0), []);
    assert.deepEqual(electronConfiguration(21), []);
    assert.equal(formatConfiguration(21), '');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/elements.test.ts`
Expected: FAIL — `Cannot find module '../elements.ts'`.

- [ ] **Step 3: Write the data file**

Create `lib/curriculum/src/data/elements.json`:

```json
{
  "note": "Elements 1-20. Arabic names must appear in the printed textbook text (elements.test.ts); if one fails, use the book's own spelling. Masses are standard atomic weights (abridged) — compare them to the table printed in the grade 10 chemistry book before shipping, and use the book's values where it rounds (Task 2, step 6).",
  "elements": [
    { "z": 1, "symbol": "H", "nameAr": "الهيدروجين", "nameEn": "Hydrogen", "atomicMass": 1.008, "period": 1, "group": 1 },
    { "z": 2, "symbol": "He", "nameAr": "الهيليوم", "nameEn": "Helium", "atomicMass": 4.003, "period": 1, "group": 18 },
    { "z": 3, "symbol": "Li", "nameAr": "الليثيوم", "nameEn": "Lithium", "atomicMass": 6.94, "period": 2, "group": 1 },
    { "z": 4, "symbol": "Be", "nameAr": "البريليوم", "nameEn": "Beryllium", "atomicMass": 9.012, "period": 2, "group": 2 },
    { "z": 5, "symbol": "B", "nameAr": "البورون", "nameEn": "Boron", "atomicMass": 10.81, "period": 2, "group": 13 },
    { "z": 6, "symbol": "C", "nameAr": "الكربون", "nameEn": "Carbon", "atomicMass": 12.011, "period": 2, "group": 14 },
    { "z": 7, "symbol": "N", "nameAr": "النيتروجين", "nameEn": "Nitrogen", "atomicMass": 14.007, "period": 2, "group": 15 },
    { "z": 8, "symbol": "O", "nameAr": "الأكسجين", "nameEn": "Oxygen", "atomicMass": 15.999, "period": 2, "group": 16 },
    { "z": 9, "symbol": "F", "nameAr": "الفلور", "nameEn": "Fluorine", "atomicMass": 18.998, "period": 2, "group": 17 },
    { "z": 10, "symbol": "Ne", "nameAr": "النيون", "nameEn": "Neon", "atomicMass": 20.18, "period": 2, "group": 18 },
    { "z": 11, "symbol": "Na", "nameAr": "الصوديوم", "nameEn": "Sodium", "atomicMass": 22.99, "period": 3, "group": 1 },
    { "z": 12, "symbol": "Mg", "nameAr": "المغنيسيوم", "nameEn": "Magnesium", "atomicMass": 24.305, "period": 3, "group": 2 },
    { "z": 13, "symbol": "Al", "nameAr": "الألمنيوم", "nameEn": "Aluminium", "atomicMass": 26.982, "period": 3, "group": 13 },
    { "z": 14, "symbol": "Si", "nameAr": "السيليكون", "nameEn": "Silicon", "atomicMass": 28.085, "period": 3, "group": 14 },
    { "z": 15, "symbol": "P", "nameAr": "الفسفور", "nameEn": "Phosphorus", "atomicMass": 30.974, "period": 3, "group": 15 },
    { "z": 16, "symbol": "S", "nameAr": "الكبريت", "nameEn": "Sulfur", "atomicMass": 32.06, "period": 3, "group": 16 },
    { "z": 17, "symbol": "Cl", "nameAr": "الكلور", "nameEn": "Chlorine", "atomicMass": 35.45, "period": 3, "group": 17 },
    { "z": 18, "symbol": "Ar", "nameAr": "الأرجون", "nameEn": "Argon", "atomicMass": 39.95, "period": 3, "group": 18 },
    { "z": 19, "symbol": "K", "nameAr": "البوتاسيوم", "nameEn": "Potassium", "atomicMass": 39.098, "period": 4, "group": 1 },
    { "z": 20, "symbol": "Ca", "nameAr": "الكالسيوم", "nameEn": "Calcium", "atomicMass": 40.078, "period": 4, "group": 2 }
  ]
}
```

- [ ] **Step 4: Write the module**

Create `lib/curriculum/src/elements.ts`:

```ts
/**
 * Elements 1–20 for the Science Lab.
 *
 * Twenty, not 118: that is what the grade 10 electron-configuration lesson
 * works with, and every Arabic name here has to be witnessed in the printed
 * book (`elements.test.ts`). Adding an element means finding its printed
 * spelling first.
 *
 * The configuration is computed from the Aufbau order rather than stored. For
 * Z ≤ 20 there are no exceptions to it (the first is chromium, Z = 24), which
 * is also why this stops at 20 instead of quietly returning a wrong answer for
 * a heavier element.
 */
import raw from './data/elements.json' with { type: 'json' };

export interface Element {
  z: number;
  symbol: string;
  nameAr: string;
  nameEn: string;
  atomicMass: number;
  period: number;
  group: number;
}

export const ELEMENTS: Element[] = raw.elements as Element[];

export function getElement(z: number): Element | undefined {
  return ELEMENTS.find(e => e.z === z);
}

/** Case-sensitive: `Co` is cobalt and `CO` is a molecule, and the parser relies on that. */
export function elementBySymbol(symbol: string): Element | undefined {
  return ELEMENTS.find(e => e.symbol === symbol);
}

const FILL_ORDER = [
  { n: 1, sub: 's', cap: 2 },
  { n: 2, sub: 's', cap: 2 },
  { n: 2, sub: 'p', cap: 6 },
  { n: 3, sub: 's', cap: 2 },
  { n: 3, sub: 'p', cap: 6 },
  { n: 4, sub: 's', cap: 2 },
] as const;

export interface SubshellFill {
  n: number;
  sub: 's' | 'p';
  electrons: number;
}

export function electronConfiguration(z: number): SubshellFill[] {
  if (!Number.isInteger(z) || z < 1 || z > 20) return [];
  const out: SubshellFill[] = [];
  let left = z;
  for (const s of FILL_ORDER) {
    if (left <= 0) break;
    const electrons = Math.min(left, s.cap);
    out.push({ n: s.n, sub: s.sub, electrons });
    left -= electrons;
  }
  return out;
}

/** `"1s2 2s2 2p6 3s1"` — latin, exponents as plain digits. The screen renders them raised. */
export function formatConfiguration(z: number): string {
  return electronConfiguration(z)
    .map(c => `${c.n}${c.sub}${c.electrons}`)
    .join(' ');
}

/** Electrons per principal shell: sodium → `[2, 8, 1]`. */
export function shellCounts(z: number): number[] {
  const counts: number[] = [];
  for (const c of electronConfiguration(z)) {
    counts[c.n - 1] = (counts[c.n - 1] ?? 0) + c.electrons;
  }
  return counts;
}
```

- [ ] **Step 5: Add the package export**

In `lib/curriculum/package.json`, in `"exports"`, add after the `"./lab"` line:

```json
    "./elements": "./src/elements.ts",
```

- [ ] **Step 6: Run the test, then reconcile the Arabic names and masses with the book**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/elements.test.ts`

Expected on first run: the configuration, lookup and mass tests pass; the "prints every Arabic name" test may FAIL and list names the book spells differently (for example البريليوم vs البيريليوم, الفسفور vs الفوسفور, الأرجون vs الأرغون). For each listed name, find the printed spelling and correct `nameAr` in `elements.json`:

```bash
cd lib/curriculum && node -e "
const t = JSON.parse(require('fs').readFileSync('src/data/extracted/chem-s1-student-book.json','utf8')).text.join(' ');
const stem = process.argv[1];
console.log([...new Set(t.match(new RegExp('[\\\\u0621-\\\\u064A]*' + stem + '[\\\\u0621-\\\\u064A]*','g')))]);
" "ريليوم"
```

Change the stem argument (a few letters from the middle of the name) until the printed spelling shows. If a name appears only in the grade 9 book, that is fine (the test searches both). Never loosen the test; if a name is printed nowhere, drop that element from `elements.json`, renumber nothing, and note it in the commit message.

Then open the mass table printed in the chemistry S2 student book (`chem-s2-student-book.json`, search for `الكتلة الذرية`) and compare H, C, O, Na, Cl, Ca with `elements.json`. If the book rounds (for example Cl = 35.5, H = 1), store the book's values, because a teacher will compare the calculator's answer with the book's answer key, and update the two pinned values in the test to match. Re-run until green.

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm --filter @workspace/curriculum run typecheck && pnpm --filter @workspace/curriculum test`
Expected: no type errors; whole curriculum suite passes.

```bash
git add lib/curriculum/package.json lib/curriculum/src/elements.ts lib/curriculum/src/data/elements.json lib/curriculum/src/__tests__/elements.test.ts
git commit -m "feat(lab): elements 1-20 with book-witnessed Arabic names"
```

---

### Task 3: Mole and molar-mass logic

**Files:**
- Create: `artifacts/mobile/services/labMole.ts`
- Test: `artifacts/mobile/services/__tests__/labMole.test.ts`

**Interfaces:**
- Consumes: `elementBySymbol` from `@workspace/curriculum/elements` (Task 2).
- Produces (used by Task 8):
  - `type FormulaResult = { ok: true; counts: Record<string, number> } | { ok: false; reason: 'empty' | 'syntax' | 'unknown-element'; detail?: string }`
  - `parseFormula(input: string): FormulaResult`
  - `molarMass(counts: Record<string, number>): number`
  - `AVOGADRO: number`
  - `type MoleKnown = 'grams' | 'moles' | 'particles'`
  - `type MoleResult = { ok: true; molarMass: number; grams: number; moles: number; particles: number } | { ok: false; reason: FormulaFailure | 'bad-value' }`
  - `solveMole(input: { formula: string; known: MoleKnown; value: number }): MoleResult`

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/labMole.test.ts`:

```ts
/**
 * Formula parsing and mole conversions for the lab calculator.
 *
 * The parser is the risky part: «CO» and «Co» differ by one letter's case, and
 * a calculator that quietly reads `Fe2O3` as something else would teach a wrong
 * molar mass. Anything it cannot read must come back as a named failure, not a
 * number.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AVOGADRO, molarMass, parseFormula, solveMole } from '../labMole.ts';

function close(actual: number, expected: number, tol = 1e-6): void {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} is not within ${tol} of ${expected}`);
}

function counts(formula: string): Record<string, number> {
  const r = parseFormula(formula);
  assert.ok(r.ok, `${formula} should parse`);
  return r.counts;
}

describe('parseFormula', () => {
  it('reads plain formulas', () => {
    assert.deepEqual(counts('H2O'), { H: 2, O: 1 });
    assert.deepEqual(counts('NaCl'), { Na: 1, Cl: 1 });
  });

  it('multiplies through parentheses', () => {
    assert.deepEqual(counts('Ca(OH)2'), { Ca: 1, O: 2, H: 2 });
    assert.deepEqual(counts('Al2(SO4)3'), { Al: 2, S: 3, O: 12 });
  });

  it('accepts subscript digits and stray spaces', () => {
    assert.deepEqual(counts(' H₂O '), { H: 2, O: 1 });
  });

  it('refuses an element outside the covered range, by name', () => {
    const r = parseFormula('Fe2O3');
    assert.deepEqual(r, { ok: false, reason: 'unknown-element', detail: 'Fe' });
  });

  it('is case-sensitive: lowercase and mis-cased symbols are not guessed', () => {
    assert.equal(parseFormula('h2o').ok, false);
    const co = parseFormula('Co');
    assert.equal(co.ok, false);
    assert.equal(!co.ok && co.reason, 'unknown-element');
  });

  it('refuses malformed input rather than guessing', () => {
    for (const bad of ['Ca(OH', 'H2O)', '2H2O', 'H0', 'H2$', '()']) {
      const r = parseFormula(bad);
      assert.equal(r.ok, false, bad);
      assert.equal(!r.ok && r.reason, 'syntax', bad);
    }
    assert.deepEqual(parseFormula('   '), { ok: false, reason: 'empty' });
  });
});

describe('molarMass', () => {
  it('sums atomic masses', () => {
    close(molarMass(counts('H2O')), 2 * 1.008 + 15.999);
    close(molarMass(counts('CO2')), 12.011 + 2 * 15.999);
  });
});

describe('solveMole', () => {
  it('converts grams to moles and particles', () => {
    const mm = 2 * 1.008 + 15.999;
    const r = solveMole({ formula: 'H2O', known: 'grams', value: 2 * mm });
    assert.ok(r.ok);
    close(r.moles, 2);
    close(r.grams, 2 * mm);
    close(r.particles / AVOGADRO, 2, 1e-9);
  });

  it('converts moles to grams', () => {
    const r = solveMole({ formula: 'NaCl', known: 'moles', value: 0.5 });
    assert.ok(r.ok);
    close(r.grams, 0.5 * (22.99 + 35.45));
  });

  it('converts particles to moles', () => {
    const r = solveMole({ formula: 'CO2', known: 'particles', value: 3 * AVOGADRO });
    assert.ok(r.ok);
    close(r.moles, 3, 1e-9);
  });

  it('rejects negative or non-finite values', () => {
    for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = solveMole({ formula: 'H2O', known: 'grams', value });
      assert.deepEqual(r, { ok: false, reason: 'bad-value' });
    }
  });

  it('passes a formula failure through unchanged', () => {
    const r = solveMole({ formula: 'Fe', known: 'grams', value: 1 });
    assert.deepEqual(r, { ok: false, reason: 'unknown-element', detail: 'Fe' });
  });
});
```

If Task 2 step 6 changed the stored masses to the book's values, update the expected numbers in this test to the same values.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labMole.test.ts`
Expected: FAIL — `Cannot find module '../labMole.ts'`.

- [ ] **Step 3: Write the implementation**

Create `artifacts/mobile/services/labMole.ts`:

```ts
/**
 * Formula parsing and mole conversions for the lab calculator.
 *
 * Pure and dependency-light on purpose: the mobile test runner is bare
 * `node --test`, so nothing here may import `react-native`. Everything is
 * latin; the screen converts digits for display (`labFormat.ts`).
 *
 * The parser fails closed. A symbol it does not know (anything past element
 * 20) or a shape it cannot read comes back as a named reason, never as a
 * number — a wrong molar mass looks exactly like a right one.
 */
import { elementBySymbol } from '@workspace/curriculum/elements';

export type FormulaFailure = 'empty' | 'syntax' | 'unknown-element';

export type FormulaResult =
  | { ok: true; counts: Record<string, number> }
  | { ok: false; reason: FormulaFailure; detail?: string };

/** Avogadro's number, particles per mole. Compare to the book's printed value. */
export const AVOGADRO = 6.022e23;

const MAX_COUNT = 1000;

const SYNTAX: FormulaResult = { ok: false, reason: 'syntax' };

export function parseFormula(input: string): FormulaResult {
  const s = input.replace(/\s+/g, '').replace(/[₀-₉]/g, d => String(d.charCodeAt(0) - 0x2080));
  if (!s) return { ok: false, reason: 'empty' };

  const stack: Array<Record<string, number>> = [{}];
  let i = 0;

  // Reads a run of digits as a count; no digits means 1, and 0 or huge is a syntax error.
  const readCount = (): number | null => {
    const start = i;
    while (i < s.length && s[i] >= '0' && s[i] <= '9') i++;
    if (i === start) return 1;
    const n = Number(s.slice(start, i));
    return n >= 1 && n <= MAX_COUNT ? n : null;
  };

  while (i < s.length) {
    const ch = s[i];
    if (ch === '(') {
      stack.push({});
      i++;
    } else if (ch === ')') {
      if (stack.length < 2) return SYNTAX;
      i++;
      const mult = readCount();
      if (mult === null) return SYNTAX;
      const group = stack.pop() as Record<string, number>;
      if (Object.keys(group).length === 0) return SYNTAX;
      const top = stack[stack.length - 1];
      for (const [symbol, c] of Object.entries(group)) top[symbol] = (top[symbol] ?? 0) + c * mult;
    } else if (ch >= 'A' && ch <= 'Z') {
      let symbol = ch;
      i++;
      if (i < s.length && s[i] >= 'a' && s[i] <= 'z') {
        symbol += s[i];
        i++;
      }
      if (!elementBySymbol(symbol)) return { ok: false, reason: 'unknown-element', detail: symbol };
      const c = readCount();
      if (c === null) return SYNTAX;
      const top = stack[stack.length - 1];
      top[symbol] = (top[symbol] ?? 0) + c;
    } else {
      return SYNTAX;
    }
  }

  if (stack.length !== 1) return SYNTAX;
  return { ok: true, counts: stack[0] };
}

export function molarMass(counts: Record<string, number>): number {
  let total = 0;
  for (const [symbol, c] of Object.entries(counts)) {
    total += (elementBySymbol(symbol)?.atomicMass ?? 0) * c;
  }
  return total;
}

export type MoleKnown = 'grams' | 'moles' | 'particles';

export type MoleResult =
  | { ok: true; molarMass: number; grams: number; moles: number; particles: number }
  | { ok: false; reason: FormulaFailure | 'bad-value'; detail?: string };

export function solveMole(input: { formula: string; known: MoleKnown; value: number }): MoleResult {
  const parsed = parseFormula(input.formula);
  if (!parsed.ok) return parsed;
  if (!Number.isFinite(input.value) || input.value < 0) return { ok: false, reason: 'bad-value' };

  const mm = molarMass(parsed.counts);
  let moles: number;
  if (input.known === 'grams') moles = input.value / mm;
  else if (input.known === 'moles') moles = input.value;
  else moles = input.value / AVOGADRO;

  return { ok: true, molarMass: mm, grams: moles * mm, moles, particles: moles * AVOGADRO };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labMole.test.ts`
Expected: PASS. If the import `@workspace/curriculum/elements` fails to resolve, confirm `lib/curriculum/package.json` has the `./elements` export (Task 2, step 5) and that `pnpm install` has linked the workspace.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/labMole.ts artifacts/mobile/services/__tests__/labMole.test.ts
git commit -m "feat(lab): formula parser and mole conversions"
```

---

### Task 4: Vector addition logic and scene layout

**Files:**
- Create: `artifacts/mobile/services/labVectors.ts`
- Test: `artifacts/mobile/services/__tests__/labVectors.test.ts`

**Interfaces:**
- Produces (used by Task 8):
  - `interface PolarVector { magnitude: number; angleDeg: number }`, `interface Components { x: number; y: number }`
  - `toComponents(v: PolarVector): Components`, `fromComponents(c: Components): PolarVector` (angle in [0, 360), zero vector → `{0, 0}`)
  - `addVectors(a: PolarVector, b: PolarVector): { components: Components; resultant: PolarVector }`
  - `interface ScenePoint { x: number; y: number }`, `layoutScene(a, b, size, padding?): { origin; aTip; rTip: ScenePoint }` — head-to-tail drawing: A from origin to `aTip`, B from `aTip` to `rTip`, resultant from origin to `rTip`; y is screen-down.

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/labVectors.test.ts`:

```ts
/**
 * Vector addition for the lab's interactive.
 *
 * The edge cases are the ones a demo hits live: opposite vectors that cancel
 * (a zero resultant must not report a stray angle), and vectors straddling 0°,
 * where atan2 returns a tiny negative angle that must not render as 359.999°.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { addVectors, fromComponents, layoutScene, toComponents } from '../labVectors.ts';

function close(actual: number, expected: number, tol = 1e-6): void {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} is not within ${tol} of ${expected}`);
}

/** Angles are circular: 359.9999999° and 0° are the same direction. */
function angleClose(actual: number, expected: number, tol = 1e-6): void {
  const d = Math.abs(((actual - expected + 540) % 360) - 180);
  assert.ok(d <= tol, `${actual}° is not ${expected}°`);
}

describe('toComponents / fromComponents', () => {
  it('round-trips', () => {
    const c = toComponents({ magnitude: 10, angleDeg: 30 });
    close(c.x, 10 * Math.cos(Math.PI / 6));
    close(c.y, 5);
    const p = fromComponents(c);
    close(p.magnitude, 10);
    angleClose(p.angleDeg, 30);
  });

  it('keeps angles in [0, 360)', () => {
    const p = fromComponents({ x: 1, y: -1 });
    close(p.angleDeg, 315);
    const zero = fromComponents({ x: 0, y: 0 });
    assert.deepEqual(zero, { magnitude: 0, angleDeg: 0 });
  });
});

describe('addVectors', () => {
  it('adds a 3-4-5 pair at right angles', () => {
    const { resultant } = addVectors({ magnitude: 3, angleDeg: 0 }, { magnitude: 4, angleDeg: 90 });
    close(resultant.magnitude, 5);
    close(resultant.angleDeg, 53.13010235, 1e-6);
  });

  it('is commutative', () => {
    const a = { magnitude: 7, angleDeg: 20 };
    const b = { magnitude: 2, angleDeg: 200 };
    const ab = addVectors(a, b).resultant;
    const ba = addVectors(b, a).resultant;
    close(ab.magnitude, ba.magnitude);
    angleClose(ab.angleDeg, ba.angleDeg);
  });

  it('cancels opposite vectors to a clean zero', () => {
    const { resultant } = addVectors({ magnitude: 5, angleDeg: 0 }, { magnitude: 5, angleDeg: 180 });
    assert.deepEqual(resultant, { magnitude: 0, angleDeg: 0 });
  });

  it('does not report 359.99° for vectors straddling zero', () => {
    const { resultant } = addVectors({ magnitude: 10, angleDeg: 350 }, { magnitude: 10, angleDeg: 10 });
    close(resultant.magnitude, 20 * Math.cos((10 * Math.PI) / 180));
    angleClose(resultant.angleDeg, 0);
    // Not merely circularly close: the value shown must be 0, not 359.99999.
    assert.ok(resultant.angleDeg < 1e-6);
  });
});

describe('layoutScene', () => {
  const size = 300;
  const padding = 24;

  it('keeps every point inside the padded box', () => {
    const cases: Array<[number, number, number, number]> = [
      [10, 0, 10, 90],
      [20, 45, 5, 225],
      [1, 10, 19, 350],
    ];
    for (const [ma, aa, mb, ab] of cases) {
      const { origin, aTip, rTip } = layoutScene(
        { magnitude: ma, angleDeg: aa },
        { magnitude: mb, angleDeg: ab },
        size,
        padding,
      );
      for (const p of [origin, aTip, rTip]) {
        assert.ok(p.x >= padding - 1e-6 && p.x <= size - padding + 1e-6, `x ${p.x}`);
        assert.ok(p.y >= padding - 1e-6 && p.y <= size - padding + 1e-6, `y ${p.y}`);
      }
    }
  });

  it('flips y so that an upward vector points up the screen', () => {
    const { origin, aTip } = layoutScene({ magnitude: 10, angleDeg: 90 }, { magnitude: 0, angleDeg: 0 }, size, padding);
    assert.ok(aTip.y < origin.y);
  });

  it('survives two zero vectors without dividing by zero', () => {
    const { origin, aTip, rTip } = layoutScene({ magnitude: 0, angleDeg: 0 }, { magnitude: 0, angleDeg: 0 }, size, padding);
    for (const p of [origin, aTip, rTip]) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labVectors.test.ts`
Expected: FAIL — `Cannot find module '../labVectors.ts'`.

- [ ] **Step 3: Write the implementation**

Create `artifacts/mobile/services/labVectors.ts`:

```ts
/**
 * Vector addition for the lab's interactive, plus the layout that fits the
 * drawing to its canvas.
 *
 * Maths in latin and radians internally; angles in and out are degrees counter-
 * clockwise from +x, kept in [0, 360). A resultant that is zero (opposite
 * vectors) reports angle 0 rather than whatever atan2 returns for rounding
 * noise.
 */
export interface PolarVector {
  magnitude: number;
  angleDeg: number;
}

export interface Components {
  x: number;
  y: number;
}

export interface ScenePoint {
  x: number;
  y: number;
}

const EPS = 1e-9;
const RAD = Math.PI / 180;

export function toComponents(v: PolarVector): Components {
  return { x: v.magnitude * Math.cos(v.angleDeg * RAD), y: v.magnitude * Math.sin(v.angleDeg * RAD) };
}

export function fromComponents(c: Components): PolarVector {
  const magnitude = Math.hypot(c.x, c.y);
  if (magnitude < EPS) return { magnitude: 0, angleDeg: 0 };
  let angleDeg = Math.atan2(c.y, c.x) / RAD;
  if (angleDeg < 0) angleDeg += 360;
  // atan2 of a hair below zero lands at 359.99999… — that is 0°.
  if (angleDeg >= 360 - EPS) angleDeg = 0;
  return { magnitude, angleDeg };
}

export function addVectors(a: PolarVector, b: PolarVector): { components: Components; resultant: PolarVector } {
  const ca = toComponents(a);
  const cb = toComponents(b);
  const components = { x: ca.x + cb.x, y: ca.y + cb.y };
  return { components, resultant: fromComponents(components) };
}

/**
 * Head-to-tail drawing fitted to a square canvas: A from the origin to `aTip`,
 * B from `aTip` to `rTip`, and the resultant from the origin to `rTip`. The
 * scale is chosen so all three points sit inside `padding`; y is flipped for a
 * screen that counts downward.
 */
export function layoutScene(
  a: PolarVector,
  b: PolarVector,
  size: number,
  padding = 24,
): { origin: ScenePoint; aTip: ScenePoint; rTip: ScenePoint } {
  const ca = toComponents(a);
  const cb = toComponents(b);
  const pts = [
    { x: 0, y: 0 },
    { x: ca.x, y: ca.y },
    { x: ca.x + cb.x, y: ca.y + cb.y },
  ];
  const minX = Math.min(...pts.map(p => p.x));
  const maxX = Math.max(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y));
  const maxY = Math.max(...pts.map(p => p.y));
  const span = Math.max(maxX - minX, maxY - minY, EPS);
  const scale = (size - 2 * padding) / span;
  // Centre the drawing in the box along the shorter axis.
  const offX = padding + ((size - 2 * padding) - (maxX - minX) * scale) / 2;
  const offY = padding + ((size - 2 * padding) - (maxY - minY) * scale) / 2;
  const map = (p: { x: number; y: number }): ScenePoint => ({
    x: offX + (p.x - minX) * scale,
    y: size - (offY + (p.y - minY) * scale),
  });
  return { origin: map(pts[0]), aTip: map(pts[1]), rTip: map(pts[2]) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labVectors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/labVectors.ts artifacts/mobile/services/__tests__/labVectors.test.ts
git commit -m "feat(lab): vector addition and scene layout"
```

---

### Task 5: Number formatting and route helpers

**Files:**
- Create: `artifacts/mobile/services/labFormat.ts`
- Create: `artifacts/mobile/services/labLinks.ts`
- Test: `artifacts/mobile/services/__tests__/labFormat.test.ts`
- Test: `artifacts/mobile/services/__tests__/labLinks.test.ts`

**Interfaces:**
- Consumes: `getLabItem`, `type LabItem` from `@workspace/curriculum/lab` (Task 1).
- Produces (used by Tasks 6–8):
  - `toArabicDigits(s: string): string`
  - `formatLabNumber(n: number, lang: 'ar' | 'en', maxFractionDigits?: number): string` (default 2; `'—'` for non-finite)
  - `formatScientific(n: number, lang: 'ar' | 'en', sig?: number): { mantissa: string; exponent: string | null }` (default 4 significant figures)
  - `LAB_ROUTE = '/curriculum/lab'`, `labItemPath(id: string): string`, `resolveLabParam(param: string | string[] | undefined): LabItem | null`

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/labFormat.test.ts`:

```ts
/**
 * Display conversion for lab numbers. Maths stays latin everywhere else
 * (CLAUDE.md); this is the one place digits become Arabic-Indic.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatLabNumber, formatScientific, toArabicDigits } from '../labFormat.ts';

describe('toArabicDigits', () => {
  it('converts digits and the decimal point', () => {
    assert.equal(toArabicDigits('12.5'), '١٢٫٥');
    assert.equal(toArabicDigits('0'), '٠');
  });
  it('leaves other characters alone', () => {
    assert.equal(toArabicDigits('3 g/mol'), '٣ g/mol');
  });
});

describe('formatLabNumber', () => {
  it('rounds and trims trailing zeros', () => {
    assert.equal(formatLabNumber(12.5, 'en'), '12.5');
    assert.equal(formatLabNumber(2, 'en'), '2');
    assert.equal(formatLabNumber(0.1 + 0.2, 'en'), '0.3');
    assert.equal(formatLabNumber(18.0153, 'en', 3), '18.015');
  });
  it('uses Arabic digits for ar', () => {
    assert.equal(formatLabNumber(12.5, 'ar'), '١٢٫٥');
  });
  it('never prints negative zero', () => {
    assert.equal(formatLabNumber(-0.0000001, 'en'), '0');
  });
  it('prints a dash for a non-finite value', () => {
    assert.equal(formatLabNumber(Number.NaN, 'en'), '—');
    assert.equal(formatLabNumber(Number.POSITIVE_INFINITY, 'ar'), '—');
  });
});

describe('formatScientific', () => {
  it('splits mantissa and exponent so the screen can raise the exponent', () => {
    assert.deepEqual(formatScientific(6.022e23, 'en'), { mantissa: '6.022', exponent: '23' });
    assert.deepEqual(formatScientific(6.022e23, 'ar'), { mantissa: '٦٫٠٢٢', exponent: '٢٣' });
  });
  it('trims a zero tail from the mantissa', () => {
    assert.deepEqual(formatScientific(3e10, 'en'), { mantissa: '3', exponent: '10' });
  });
  it('uses a true minus sign for negative exponents', () => {
    assert.deepEqual(formatScientific(1.5e-5, 'en'), { mantissa: '1.5', exponent: '−5' });
  });
  it('has no exponent for zero', () => {
    assert.deepEqual(formatScientific(0, 'en'), { mantissa: '0', exponent: null });
  });
});
```

Create `artifacts/mobile/services/__tests__/labLinks.test.ts`:

```ts
/**
 * Route helpers. A present-mode URL is shareable, so what arrives in the
 * param is untrusted: it has to resolve to a known item or to nothing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LAB_ROUTE, labItemPath, resolveLabParam } from '../labLinks.ts';

describe('labItemPath', () => {
  it('builds the present-mode path', () => {
    assert.equal(LAB_ROUTE, '/curriculum/lab');
    assert.equal(labItemPath('lab-periodic-table'), '/curriculum/lab/lab-periodic-table');
  });
  it('encodes an id that is not url-safe', () => {
    assert.equal(labItemPath('a b/c'), '/curriculum/lab/a%20b%2Fc');
  });
});

describe('resolveLabParam', () => {
  it('resolves a known id, including from an array param', () => {
    assert.equal(resolveLabParam('lab-mole-calculator')?.kind, 'interactive');
    assert.equal(resolveLabParam(['lab-mole-calculator', 'x'])?.id, 'lab-mole-calculator');
  });
  it('returns null for an unknown, empty or missing id', () => {
    assert.equal(resolveLabParam('nope'), null);
    assert.equal(resolveLabParam(''), null);
    assert.equal(resolveLabParam(undefined), null);
    assert.equal(resolveLabParam([]), null);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labFormat.test.ts services/__tests__/labLinks.test.ts`
Expected: FAIL — `Cannot find module '../labFormat.ts'` / `'../labLinks.ts'`.

- [ ] **Step 3: Write the implementations**

Create `artifacts/mobile/services/labFormat.ts`:

```ts
/**
 * Display formatting for lab numbers.
 *
 * Everything upstream is latin; this is the only place digits become
 * Arabic-Indic. Scientific notation returns mantissa and exponent separately
 * because the screen raises the exponent in its own `Text` — Arabic-Indic
 * digits have no superscript forms.
 */
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const MINUS = '−';

export function toArabicDigits(s: string): string {
  return s.replace(/[0-9]/g, d => AR_DIGITS[Number(d)]).replace(/\./g, '٫');
}

function localise(s: string, lang: 'ar' | 'en'): string {
  return lang === 'ar' ? toArabicDigits(s) : s;
}

export function formatLabNumber(n: number, lang: 'ar' | 'en', maxFractionDigits = 2): string {
  if (!Number.isFinite(n)) return '—';
  const rounded = Number(n.toFixed(maxFractionDigits));
  const text = String(Object.is(rounded, -0) ? 0 : rounded);
  return localise(text, lang);
}

export function formatScientific(
  n: number,
  lang: 'ar' | 'en',
  sig = 4,
): { mantissa: string; exponent: string | null } {
  if (!Number.isFinite(n)) return { mantissa: '—', exponent: null };
  if (n === 0) return { mantissa: localise('0', lang), exponent: null };
  const [m, e] = n.toExponential(Math.max(0, sig - 1)).split('e');
  const mantissa = m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m;
  const exp = Number(e);
  const expText = `${exp < 0 ? MINUS : ''}${Math.abs(exp)}`;
  return { mantissa: localise(mantissa, lang), exponent: localise(expText, lang) };
}
```

Create `artifacts/mobile/services/labLinks.ts`:

```ts
/**
 * Routes for the Science Lab. A present-mode URL is shareable, so the id that
 * arrives in the route param is untrusted: it resolves to a known item or to
 * null, never to a guess.
 */
import { getLabItem, type LabItem } from '@workspace/curriculum/lab';

export const LAB_ROUTE = '/curriculum/lab';

export function labItemPath(id: string): string {
  return `${LAB_ROUTE}/${encodeURIComponent(id)}`;
}

export function resolveLabParam(param: string | string[] | undefined): LabItem | null {
  const id = Array.isArray(param) ? param[0] : param;
  if (!id) return null;
  return getLabItem(id) ?? null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labFormat.test.ts services/__tests__/labLinks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/labFormat.ts artifacts/mobile/services/labLinks.ts artifacts/mobile/services/__tests__/labFormat.test.ts artifacts/mobile/services/__tests__/labLinks.test.ts
git commit -m "feat(lab): number formatting and route helpers"
```

---

### Task 6: Route gating pin, strings, entry card and the shelf screen

**Files:**
- Modify: `artifacts/mobile/services/__tests__/routeGating.test.ts:118` (pin the new routes)
- Modify: `artifacts/mobile/services/i18n.ts` (add keys to both the `ar` block near line 313 and the `en` block near line 2381)
- Modify: `artifacts/mobile/app/curriculum/resources.tsx` (entry card after the intro text, around line 616)
- Create: `artifacts/mobile/components/lab/LabFrame.tsx`
- Create: `artifacts/mobile/app/curriculum/lab/index.tsx`

**Interfaces:**
- Consumes: `LAB_ITEMS`, `filterLabItems`, `type LabItem`, `type LabItemKind` (Task 1); `LAB_ROUTE`, `labItemPath` (Task 5); `getLessonById` from `@/services/knowledgeBase` (returns `KBLesson` with `titleAr`/`titleEn`).
- Produces (used by Task 7): `LabFrame({ title, subtitle?, children })`, and these i18n keys: `labTitle`, `labEntryTitle`, `labEntryHint`, `labIntro`, `labAllSubjects`, `labAllKinds`, `labKindInteractive`, `labKindLaw`, `labKindExternal`, `labEmpty`, `labNotFound`, `labCopyLink`, `labLinkCopied`, `labFormula`, `labTerms`, `labQuantities`, `labBookFigures`, `labBookFiguresNote`, `labOpenSource`, `labSource`.

- [ ] **Step 1: Pin the new routes in the gating test (failing first)**

In `artifacts/mobile/services/__tests__/routeGating.test.ts`, in the `isNonTeacherRoute` "lets a parent or student reach the screens built for them" list, add after the `'/curriculum/resources',` line:

```ts
      // The Science Lab shelf and its present mode (a shareable URL). Same
      // prefix rule as the library above.
      '/curriculum/lab',
      '/curriculum/lab/lab-periodic-table',
```

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/routeGating.test.ts`
Expected: PASS already (the prefix `/curriculum` is allowlisted). This pin exists so that converting the allowlist to exact matching fails loudly. If it fails, stop: the gating assumption in the spec is wrong and the plan needs revisiting.

- [ ] **Step 2: Add the strings**

In `artifacts/mobile/services/i18n.ts`, add to the `ar` block (next to `resourcesTitle`, around line 313):

```ts
    labTitle: 'المختبر',
    labEntryTitle: 'المختبر',
    labEntryHint: 'قوانين ونماذج تفاعلية وصور من الكتاب، للعرض في الحصة',
    labIntro: 'مواد للعرض في الحصة مرتبطة بدروس الكيمياء والفيزياء للصف العاشر.',
    labAllSubjects: 'كل المواد',
    labAllKinds: 'كل الأنواع',
    labKindInteractive: 'نموذج تفاعلي',
    labKindLaw: 'قانون',
    labKindExternal: 'مصدر خارجي',
    labEmpty: 'لا توجد مواد مطابقة.',
    labNotFound: 'لم نجد هذه المادة. ربما حُذف الرابط أو تغيّر.',
    labCopyLink: 'نسخ الرابط',
    labLinkCopied: 'تم نسخ الرابط',
    labFormula: 'الصيغة',
    labTerms: 'مصطلحات الدرس',
    labQuantities: 'الكميات',
    labBookFigures: 'صور من الكتاب',
    labBookFiguresNote: 'من كتاب الطالب نفسه',
    labOpenSource: 'فتح المصدر',
    labSource: 'المصدر',
```

and to the `en` block (next to `resourcesTitle`, around line 2381):

```ts
    labTitle: 'Science Lab',
    labEntryTitle: 'Science Lab',
    labEntryHint: 'Laws, interactive models and book figures to show in class',
    labIntro: 'Material to show in class, tied to grade 10 chemistry and physics lessons.',
    labAllSubjects: 'All subjects',
    labAllKinds: 'All types',
    labKindInteractive: 'Interactive',
    labKindLaw: 'Law',
    labKindExternal: 'External source',
    labEmpty: 'Nothing matches.',
    labNotFound: 'We could not find this item. The link may have been removed or changed.',
    labCopyLink: 'Copy link',
    labLinkCopied: 'Link copied',
    labFormula: 'Formula',
    labTerms: 'Lesson terms',
    labQuantities: 'Quantities',
    labBookFigures: 'Figures from the book',
    labBookFiguresNote: 'From the student book itself',
    labOpenSource: 'Open source',
    labSource: 'Source',
```

Run: `cd artifacts/mobile && pnpm run typecheck`
Expected: no errors. If the two language blocks are checked for key parity, a missing key in either will fail here; add it.

- [ ] **Step 3: Create the shared frame**

Create `artifacts/mobile/components/lab/LabFrame.tsx`:

```tsx
/**
 * The Science Lab's page frame: the library's teal header band, a back button,
 * and a centred, width-capped scroll area. Shared by the shelf and present mode
 * so the two screens cannot drift apart in layout.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { goBack } from '@/services/navigation';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function LabFrame({ title, subtitle, children }: Props) {
  const colors = useColors();
  const { isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const align = isRTL ? 'right' : 'left';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: colors.hero, paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => goBack()}
          hitSlop={10}
          accessibilityRole="button"
          style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: 8 }}
        >
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={[styles.title, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>{subtitle}</Text>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 48,
          width: '100%',
          maxWidth: CONTENT_MAX_WIDTH,
          alignSelf: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 16, paddingBottom: 16 },
  title: { color: '#fff', fontSize: 22 },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
});
```

- [ ] **Step 4: Create the shelf screen**

Create `artifacts/mobile/app/curriculum/lab/index.tsx`:

```tsx
/**
 * The Science Lab shelf — every lab item, filterable by subject and kind.
 *
 * Reached from the library's «المختبر» card. Student-reachable with no gating
 * change: `/curriculum` is already on the non-teacher allowlist and matches by
 * prefix (pinned in routeGating.test.ts). Tapping an item opens present mode.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LAB_ITEMS, filterLabItems, type LabItem, type LabItemKind } from '@workspace/curriculum/lab';
import { SUBJECTS } from '@workspace/curriculum';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getLessonById } from '@/services/knowledgeBase';
import { labItemPath } from '@/services/labLinks';
import { LabFrame } from '@/components/lab/LabFrame';
import type { TranslationKey } from '@/services/i18n';

const KIND_LABEL: Record<LabItemKind, TranslationKey> = {
  interactive: 'labKindInteractive',
  law: 'labKindLaw',
  external: 'labKindExternal',
};

const KIND_ICON: Record<LabItemKind, React.ComponentProps<typeof Ionicons>['name']> = {
  interactive: 'flask-outline',
  law: 'calculator-outline',
  external: 'open-outline',
};

export default function LabShelfScreen() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [kind, setKind] = useState<LabItemKind | null>(null);

  const subjectIds = useMemo(() => [...new Set(LAB_ITEMS.map(i => i.subjectId))], []);
  const kinds = useMemo(() => [...new Set(LAB_ITEMS.map(i => i.kind))] as LabItemKind[], []);
  const shown = useMemo(
    () => filterLabItems({ subjectId: subjectId ?? undefined, kind: kind ?? undefined }),
    [subjectId, kind],
  );

  const subjectName = (id: string) => {
    const s = SUBJECTS.find(x => x.id === id);
    return s ? (lang === 'ar' ? s.nameAr : s.name) : id;
  };

  return (
    <LabFrame title={t('labTitle')} subtitle={t('labIntro')}>
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Chip label={t('labAllSubjects')} on={subjectId === null} onPress={() => setSubjectId(null)} />
        {subjectIds.map(id => (
          <Chip key={id} label={subjectName(id)} on={subjectId === id} onPress={() => setSubjectId(id)} />
        ))}
      </View>
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Chip label={t('labAllKinds')} on={kind === null} onPress={() => setKind(null)} />
        {kinds.map(k => (
          <Chip key={k} label={t(KIND_LABEL[k])} on={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>

      {shown.length === 0 ? (
        <Text style={[styles.empty, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
          {t('labEmpty')}
        </Text>
      ) : (
        shown.map(item => <ItemRow key={item.id} item={item} />)
      )}
    </LabFrame>
  );

  function ItemRow({ item }: { item: LabItem }) {
    const lesson = getLessonById(item.lessonId);
    const lessonTitle = lesson ? (lang === 'ar' ? lesson.titleAr : lesson.titleEn) : '';
    return (
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          router.push(labItemPath(item.id) as never);
        }}
        accessibilityRole="button"
        style={[
          styles.row,
          { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
          <Ionicons name={KIND_ICON[item.kind]} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.rowTitle, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left', fontFamily: 'ReadexPro_600SemiBold' }]}
          >
            {lang === 'ar' ? item.titleAr : item.titleEn}
          </Text>
          <Text
            style={[styles.rowMeta, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left', fontFamily: 'Almarai_400Regular' }]}
          >
            {t(KIND_LABEL[item.kind])}
            {lessonTitle ? ` · ${lessonTitle}` : ''}
          </Text>
        </View>
        <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
      </Pressable>
    );
  }

  function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
    return (
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onPress();
        }}
        accessibilityRole="button"
        aria-selected={on}
        style={[styles.chip, { backgroundColor: on ? colors.primary : colors.muted }]}
      >
        <Text
          style={{
            color: on ? colors.primaryForeground : colors.foreground,
            fontFamily: 'ReadexPro_500Medium',
            fontSize: 13,
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  chips: { flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  row: {
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15 },
  rowMeta: { fontSize: 12, marginTop: 2 },
  empty: { textAlign: 'center', padding: 32 },
});
```

Note: `ItemRow` and `Chip` are declared as hoisted function declarations inside the component so they can read `colors`, `isRTL`, `t` and `lang` without prop-drilling. If lint or the React compiler objects to components defined inside a component, move them to module scope and pass `colors`, `isRTL`, `t` and `lang` as props.

- [ ] **Step 5: Add the entry card to the library**

In `artifacts/mobile/app/curriculum/resources.tsx`, directly after the intro `<Text …>{t('resourcesIntro')}</Text>` block (around line 616) and before `{grades.length > 1 ? (`, insert:

```tsx
        <Pressable
          onPress={() => router.push('/curriculum/lab' as never)}
          accessibilityRole="button"
          style={[
            styles.labCard,
            { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
          ]}
        >
          <View style={[styles.labCardIcon, { backgroundColor: colors.secondary }]}>
            <Ionicons name="flask-outline" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, textAlign: isRTL ? 'right' : 'left' }}>
              {t('labEntryTitle')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, marginTop: 2, textAlign: isRTL ? 'right' : 'left' }}>
              {t('labEntryHint')}
            </Text>
          </View>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
        </Pressable>
```

and add to the file's `StyleSheet.create({ … })` (the one holding `styles.hero`):

```ts
  labCard: {
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  labCardIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
```

- [ ] **Step 6: Typecheck and verify**

Run: `pnpm run typecheck`
Expected: no errors.

Run: `pnpm run dev:mobile:web` and open `http://localhost:8081/curriculum/resources`. Expected: a «المختبر» card above the filters; tapping it opens the shelf listing seven items (3 interactive, 4 law); subject and kind chips filter them. Signing in needs a person (dev web authenticates against production, per STATUS.md), so if you cannot sign in, say so in the PR rather than claiming this was seen. Tapping an item lands on a not-yet-built screen until Task 7.

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile/services/__tests__/routeGating.test.ts artifacts/mobile/services/i18n.ts artifacts/mobile/app/curriculum/resources.tsx artifacts/mobile/components/lab/LabFrame.tsx artifacts/mobile/app/curriculum/lab/index.tsx
git commit -m "feat(lab): shelf screen and library entry card"
```

---

### Task 7: Present mode for laws, external pointers and book figures

**Files:**
- Create: `artifacts/mobile/components/lab/LabLawCard.tsx`
- Create: `artifacts/mobile/components/lab/LabExternalCard.tsx`
- Create: `artifacts/mobile/components/lab/LabFigureStrip.tsx`
- Create: `artifacts/mobile/app/curriculum/lab/[itemId].tsx`

**Interfaces:**
- Consumes: `type LabLawItem`, `type LabExternalItem` (Task 1); `getExternalResource`, `type ExternalResource` from `@workspace/curriculum/external`; `resolveLabParam`, `labItemPath` (Task 5); `figuresForLesson` from `@/services/bookFigures` and `bookFigureUri` from `@/services/bookFigureUri`; `openExternal` from `@/services/externalLinks`; `LabFrame` and the `lab*` i18n keys (Task 6).
- Produces (used by Task 8): `[itemId].tsx` renders `<LabInteractive interactiveId={…} />` imported from `@/components/lab/LabInteractive` — Task 8 creates that file; until then this screen stubs it (step 5).

- [ ] **Step 1: Create the law card**

Create `artifacts/mobile/components/lab/LabLawCard.tsx`:

```tsx
/**
 * A law as a card: the formula big, the quantities with units, and the
 * lesson's own vocabulary terms. No Arabic prose written by us appears here —
 * the terms are copied verbatim from the lesson and tested against it.
 *
 * The formula is latin and always laid out left-to-right, even in an RTL
 * screen: «F = m × a» reads wrongly mirrored.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LabLawItem } from '@workspace/curriculum/lab';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

export function LabLawCard({ item }: { item: LabLawItem }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align, fontFamily: 'ReadexPro_500Medium' }]}>
        {t('labFormula')}
      </Text>
      <View style={[styles.formulaBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.formula, { color: colors.primary, fontFamily: 'ReadexPro_700Bold' }]}>{item.formula}</Text>
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align, fontFamily: 'ReadexPro_500Medium' }]}>
        {t('labQuantities')}
      </Text>
      {item.quantities.map(q => (
        <View
          key={q.symbol}
          style={[styles.qRow, { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Text style={[styles.symbol, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold' }]}>{q.symbol}</Text>
          <Text style={{ flex: 1, color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }}>
            {q.nameEn}
          </Text>
          <Text style={[styles.unit, { color: colors.mutedForeground }]}>{q.unit}</Text>
        </View>
      ))}

      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align, fontFamily: 'ReadexPro_500Medium' }]}>
        {t('labTerms')}
      </Text>
      <View style={[styles.terms, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {item.termsAr.map(term => (
          <View key={term} style={[styles.term, { backgroundColor: colors.secondary }]}>
            <Text style={{ color: colors.secondaryForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 14 }}>{term}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 10 },
  label: { fontSize: 13, marginTop: 6 },
  formulaBox: { borderWidth: 1, borderRadius: 16, paddingVertical: 28, paddingHorizontal: 16, alignItems: 'center' },
  // `direction: 'ltr'` keeps the formula from being mirrored on an RTL screen.
  formula: { fontSize: 32, writingDirection: 'ltr', textAlign: 'center' },
  qRow: { alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  symbol: { fontSize: 20, minWidth: 56, writingDirection: 'ltr', textAlign: 'center' },
  unit: { fontSize: 13, writingDirection: 'ltr' },
  terms: { flexWrap: 'wrap', gap: 8 },
  term: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
});
```

- [ ] **Step 2: Create the external card**

Create `artifacts/mobile/components/lab/LabExternalCard.tsx`:

```tsx
/**
 * A pointer to a curated third-party resource.
 *
 * Opens the original rather than copying or embedding it, and always shows the
 * attribution verbatim: for these licences the credit is a condition of use,
 * not decoration (STATUS.md, «The English lab» — three render paths once
 * dropped it).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LabExternalItem } from '@workspace/curriculum/lab';
import { getExternalResource } from '@workspace/curriculum/external';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { openExternal } from '@/services/externalLinks';

export function LabExternalCard({ item }: { item: LabExternalItem }) {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const resource = getExternalResource(item.externalId);
  const align = isRTL ? 'right' : 'left';

  // validateLabItems rejects a dangling externalId, so this is a belt-and-braces
  // guard rather than an expected state.
  if (!resource) {
    return (
      <Text style={{ color: colors.destructive, padding: 16, textAlign: align, fontFamily: 'Almarai_400Regular' }}>
        {t('labNotFound')}
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
        {lang === 'ar' ? resource.titleAr : resource.titleEn}
      </Text>
      <Pressable
        onPress={() => openExternal(resource.sourceUrl)}
        accessibilityRole="button"
        style={[styles.open, { backgroundColor: colors.primary, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
      >
        <Ionicons name="open-outline" size={18} color={colors.primaryForeground} />
        <Text style={{ color: colors.primaryForeground, fontFamily: 'ReadexPro_600SemiBold' }}>{t('labOpenSource')}</Text>
      </Pressable>
      <Text style={[styles.credit, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
        {t('labSource')}: {resource.attribution}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 14 },
  title: { fontSize: 18 },
  open: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
  credit: { fontSize: 12 },
});
```

- [ ] **Step 3: Create the figure strip**

Create `artifacts/mobile/components/lab/LabFigureStrip.tsx`:

```tsx
/**
 * The lesson's own book figures, joined at render time from the figure index —
 * lab items do not list them. Shown in a wrapping grid so a projector shows
 * several at once; each carries its source page so it can be checked against
 * the book.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { figuresForLesson } from '@/services/bookFigures';
import { bookFigureUri } from '@/services/bookFigureUri';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

const MAX_FIGURES = 12;

export function LabFigureStrip({ lessonId }: { lessonId: string }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const figures = useMemo(
    () =>
      figuresForLesson(lessonId)
        .map(f => ({ f, uri: bookFigureUri(f) }))
        .filter((x): x is { f: (typeof x)['f']; uri: string } => x.uri !== null)
        .slice(0, MAX_FIGURES),
    [lessonId],
  );
  if (figures.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.foreground, textAlign: isRTL ? 'right' : 'left', fontFamily: 'ReadexPro_600SemiBold' }]}>
        {t('labBookFigures')}
      </Text>
      <Text style={[styles.note, { color: colors.mutedForeground, textAlign: isRTL ? 'right' : 'left', fontFamily: 'Almarai_400Regular' }]}>
        {t('labBookFiguresNote')}
      </Text>
      <View style={[styles.grid, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {figures.map(({ f, uri }) => (
          <View key={`${f.sourceId}/${f.file}`} style={[styles.cell, { borderColor: colors.border, backgroundColor: '#fff' }]}>
            <Image source={{ uri }} style={styles.img} contentFit="contain" accessibilityLabel={`p. ${f.pdfPage}`} />
            <Text style={[styles.page, { color: colors.mutedForeground }]}>p. {f.pdfPage}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 6 },
  title: { fontSize: 16 },
  note: { fontSize: 12, marginBottom: 6 },
  grid: { flexWrap: 'wrap', gap: 10 },
  cell: { width: 160, borderWidth: 1, borderRadius: 10, padding: 6, alignItems: 'center' },
  img: { width: '100%', height: 120 },
  page: { fontSize: 11, marginTop: 4 },
});
```

- [ ] **Step 4: Create present mode**

Create `artifacts/mobile/app/curriculum/lab/[itemId].tsx`:

```tsx
/**
 * Present mode — one lab item, full screen, for the projector.
 *
 * The id in the URL is shareable and untrusted: it resolves through
 * `resolveLabParam` or the screen says it could not find the item. The share
 * button copies a link built by `Linking.createURL`, which is the app's own
 * scheme on native and the site origin on web.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { getLessonById } from '@/services/knowledgeBase';
import { labItemPath, resolveLabParam } from '@/services/labLinks';
import { LabFrame } from '@/components/lab/LabFrame';
import { LabLawCard } from '@/components/lab/LabLawCard';
import { LabExternalCard } from '@/components/lab/LabExternalCard';
import { LabFigureStrip } from '@/components/lab/LabFigureStrip';
import { LabInteractive } from '@/components/lab/LabInteractive';

export default function LabPresentScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const [copied, setCopied] = useState(false);

  const item = resolveLabParam(itemId);
  if (!item) {
    return (
      <LabFrame title={t('labTitle')}>
        <Text style={[styles.missing, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
          {t('labNotFound')}
        </Text>
      </LabFrame>
    );
  }

  const lesson = getLessonById(item.lessonId);
  const lessonTitle = lesson ? (lang === 'ar' ? lesson.titleAr : lesson.titleEn) : undefined;

  const copyLink = async () => {
    try {
      await Clipboard.setStringAsync(Linking.createURL(labItemPath(item.id)));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be refused (insecure web origin, permissions). Nothing to
      // recover: the button simply does not confirm.
    }
  };

  return (
    <LabFrame title={lang === 'ar' ? item.titleAr : item.titleEn} subtitle={lessonTitle}>
      <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable
          onPress={copyLink}
          accessibilityRole="button"
          style={[styles.copy, { backgroundColor: colors.muted, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name={copied ? 'checkmark' : 'link-outline'} size={16} color={colors.foreground} />
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
            {copied ? t('labLinkCopied') : t('labCopyLink')}
          </Text>
        </Pressable>
      </View>

      {item.kind === 'interactive' ? <LabInteractive interactiveId={item.interactiveId} /> : null}
      {item.kind === 'law' ? <LabLawCard item={item} /> : null}
      {item.kind === 'external' ? <LabExternalCard item={item} /> : null}

      <LabFigureStrip lessonId={item.lessonId} />
    </LabFrame>
  );
}

const styles = StyleSheet.create({
  missing: { textAlign: 'center', padding: 32 },
  actions: { paddingHorizontal: 16, paddingTop: 12 },
  copy: { alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
});
```

- [ ] **Step 5: Add a temporary `LabInteractive` so the screen compiles**

Create `artifacts/mobile/components/lab/LabInteractive.tsx` (Task 8 replaces its body):

```tsx
/**
 * Maps an interactive id to its component. Task 8 fills this in; until then it
 * renders nothing so present mode for laws and external items already works.
 */
import React from 'react';
import type { LabInteractiveId } from '@workspace/curriculum/lab';

export function LabInteractive(_props: { interactiveId: LabInteractiveId }) {
  return null;
}
```

- [ ] **Step 6: Typecheck and verify**

Run: `pnpm run typecheck`
Expected: no errors. If `expo-linking`'s `createURL` or `expo-clipboard`'s `setStringAsync` have different names in the installed versions, read `node_modules/expo-linking` / `expo-clipboard` types and adjust.

Run: `pnpm run dev:mobile:web`, then open `/curriculum/lab/law-newton-second`. Expected: header «القانون الثاني لنيوتن», the lesson title under it, a large `F = m × a` unmirrored in the RTL layout, three quantity rows, one term chip, then the lesson's book figures (physics S1 has figures). Open `/curriculum/lab/nope` and expect the not-found message. As in Task 6, a person has to sign in; if nobody can, say so in the PR.

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile/components/lab artifacts/mobile/app/curriculum/lab/\[itemId\].tsx
git commit -m "feat(lab): present mode for laws, external pointers and book figures"
```

---

### Task 8: The three interactives

**Files:**
- Modify: `artifacts/mobile/components/lab/LabInteractive.tsx` (replace the stub)
- Create: `artifacts/mobile/components/lab/LabPeriodicTable.tsx`
- Create: `artifacts/mobile/components/lab/LabMoleCalculator.tsx`
- Create: `artifacts/mobile/components/lab/LabVectorAddition.tsx`
- Modify: `artifacts/mobile/services/i18n.ts` (interactive strings, both `ar` and `en`)

**Interfaces:**
- Consumes: `ELEMENTS`, `getElement`, `formatConfiguration`, `shellCounts`, `type Element` (Task 2); `solveMole`, `AVOGADRO`, `type MoleKnown` (Task 3); `addVectors`, `layoutScene`, `type PolarVector` (Task 4); `formatLabNumber`, `formatScientific` (Task 5).
- Produces: `LabInteractive({ interactiveId })` dispatches to the three components.

- [ ] **Step 1: Add the strings**

In `artifacts/mobile/services/i18n.ts`, add to the `ar` block after the `lab*` keys from Task 6:

```ts
    labPtSelect: 'اختر عنصرًا',
    labPtNumber: 'العدد الذري',
    labPtMass: 'الكتلة الذرية',
    labPtPeriod: 'الدورة',
    labPtGroup: 'المجموعة',
    labPtConfig: 'التوزيع الإلكتروني',
    labMoleFormula: 'الصيغة الكيميائية',
    labMoleKnown: 'المعطى',
    labMoleGrams: 'الكتلة (غ)',
    labMoleMoles: 'عدد المولات',
    labMoleParticles: 'عدد الجسيمات',
    labMoleValue: 'القيمة',
    labMoleMolarMass: 'الكتلة المولية (غ/مول)',
    labMoleErrEmpty: 'اكتب صيغة كيميائية.',
    labMoleErrSyntax: 'تعذّرت قراءة الصيغة. استخدم رموزًا مثل H2O أو Ca(OH)2.',
    labMoleErrUnknown: 'هذا العنصر غير مغطى بعد. المغطى: العناصر من 1 إلى 20.',
    labMoleErrValue: 'أدخل رقمًا موجبًا.',
    labVecA: 'المتجه A',
    labVecB: 'المتجه B',
    labVecMagnitude: 'المقدار',
    labVecAngle: 'الزاوية (°)',
    labVecResultant: 'المحصلة R',
```

and to the `en` block after its `lab*` keys:

```ts
    labPtSelect: 'Pick an element',
    labPtNumber: 'Atomic number',
    labPtMass: 'Atomic mass',
    labPtPeriod: 'Period',
    labPtGroup: 'Group',
    labPtConfig: 'Electron configuration',
    labMoleFormula: 'Chemical formula',
    labMoleKnown: 'Known quantity',
    labMoleGrams: 'Mass (g)',
    labMoleMoles: 'Moles',
    labMoleParticles: 'Particles',
    labMoleValue: 'Value',
    labMoleMolarMass: 'Molar mass (g/mol)',
    labMoleErrEmpty: 'Type a chemical formula.',
    labMoleErrSyntax: 'Could not read the formula. Use symbols like H2O or Ca(OH)2.',
    labMoleErrUnknown: 'That element is not covered yet. Covered: elements 1 to 20.',
    labMoleErrValue: 'Enter a positive number.',
    labVecA: 'Vector A',
    labVecB: 'Vector B',
    labVecMagnitude: 'Magnitude',
    labVecAngle: 'Angle (°)',
    labVecResultant: 'Resultant R',
```

- [ ] **Step 2: Create the periodic table**

Create `artifacts/mobile/components/lab/LabPeriodicTable.tsx`:

```tsx
/**
 * Elements 1–20 in their table positions, with a detail panel and a Bohr-style
 * shell diagram. Selecting an element shows its number, Arabic name, mass,
 * period, group and electron configuration.
 *
 * The grid is laid out left-to-right on purpose, even on an RTL screen: that is
 * how the textbook prints the table, and mirroring it puts group 1 on the
 * wrong side. The Arabic labels inside keep their own direction.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ELEMENTS, formatConfiguration, shellCounts, type Element } from '@workspace/curriculum/elements';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { formatLabNumber } from '@/services/labFormat';

const CELL = 44;
const GAP = 4;
const COLS = 18;
const ROWS = 4;

export function LabPeriodicTable() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const [z, setZ] = useState(11);
  const selected = ELEMENTS.find(e => e.z === z) as Element;
  const align = isRTL ? 'right' : 'left';

  const byCell = useMemo(() => {
    const m = new Map<string, Element>();
    for (const e of ELEMENTS) m.set(`${e.period}:${e.group}`, e);
    return m;
  }, []);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.hint, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
        {t('labPtSelect')}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ direction: 'ltr' as const }}>
        <View style={{ width: COLS * (CELL + GAP), direction: 'ltr' }}>
          {Array.from({ length: ROWS }, (_, r) => (
            <View key={r} style={{ flexDirection: 'row', direction: 'ltr' }}>
              {Array.from({ length: COLS }, (_, c) => {
                const e = byCell.get(`${r + 1}:${c + 1}`);
                if (!e) return <View key={c} style={{ width: CELL, height: CELL, margin: GAP / 2 }} />;
                const on = e.z === z;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setZ(e.z)}
                    accessibilityRole="button"
                    aria-selected={on}
                    style={[
                      styles.cell,
                      { backgroundColor: on ? colors.primary : colors.card, borderColor: on ? colors.primary : colors.border },
                    ]}
                  >
                    <Text style={[styles.cellZ, { color: on ? colors.primaryForeground : colors.mutedForeground }]}>{e.z}</Text>
                    <Text style={[styles.cellSym, { color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_700Bold' }]}>
                      {e.symbol}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.detail, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <ShellDiagram z={selected.z} color={colors.primary} muted={colors.border} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.foreground, fontSize: 22, textAlign: align, fontFamily: 'ReadexPro_700Bold' }}>
            {selected.symbol} · {lang === 'ar' ? selected.nameAr : selected.nameEn}
          </Text>
          <Row label={t('labPtNumber')} value={formatLabNumber(selected.z, lang)} align={align} colors={colors} />
          <Row label={t('labPtMass')} value={formatLabNumber(selected.atomicMass, lang, 3)} align={align} colors={colors} />
          <Row label={t('labPtPeriod')} value={formatLabNumber(selected.period, lang)} align={align} colors={colors} />
          <Row label={t('labPtGroup')} value={formatLabNumber(selected.group, lang)} align={align} colors={colors} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: align, marginTop: 6, fontFamily: 'Almarai_400Regular' }}>
            {t('labPtConfig')}
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 16, writingDirection: 'ltr', textAlign: align }}>
            {formatConfiguration(selected.z)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  align,
  colors,
}: {
  label: string;
  value: string;
  align: 'left' | 'right';
  colors: { foreground: string; mutedForeground: string };
}) {
  return (
    <Text style={{ color: colors.foreground, fontSize: 14, textAlign: align, fontFamily: 'Almarai_400Regular' }}>
      <Text style={{ color: colors.mutedForeground }}>{label}: </Text>
      {value}
    </Text>
  );
}

/** Concentric shells with one dot per electron, spread evenly round each ring. */
function ShellDiagram({ z, color, muted }: { z: number; color: string; muted: string }) {
  const counts = shellCounts(z);
  const size = 120;
  const c = size / 2;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={c} cy={c} r={5} fill={color} />
      {counts.map((n, i) => {
        const r = 14 + i * 14;
        return (
          <React.Fragment key={i}>
            <Circle cx={c} cy={c} r={r} fill="none" stroke={muted} strokeWidth={1} />
            {Array.from({ length: n }, (_, k) => {
              const a = (2 * Math.PI * k) / n - Math.PI / 2;
              return <Circle key={k} cx={c + r * Math.cos(a)} cy={c + r * Math.sin(a)} r={2.6} fill={color} />;
            })}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  hint: { fontSize: 13 },
  cell: {
    width: CELL,
    height: CELL,
    margin: GAP / 2,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellZ: { fontSize: 9, position: 'absolute', top: 2, left: 4 },
  cellSym: { fontSize: 16 },
  detail: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 14, alignItems: 'center' },
});
```

- [ ] **Step 3: Create the mole calculator**

Create `artifacts/mobile/components/lab/LabMoleCalculator.tsx`:

```tsx
/**
 * Type a formula, give one of grams / moles / particles, get the other two and
 * the molar mass. Everything is computed by `solveMole`; this file only reads
 * inputs and prints results. A formula it cannot read shows a named message —
 * never a number.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { solveMole, type MoleKnown } from '@/services/labMole';
import { formatLabNumber, formatScientific } from '@/services/labFormat';
import type { TranslationKey } from '@/services/i18n';

const PRESETS = ['H2O', 'CO2', 'NaCl', 'Ca(OH)2'];

const KNOWN_LABEL: Record<MoleKnown, TranslationKey> = {
  grams: 'labMoleGrams',
  moles: 'labMoleMoles',
  particles: 'labMoleParticles',
};

export function LabMoleCalculator() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const [formula, setFormula] = useState('H2O');
  const [known, setKnown] = useState<MoleKnown>('grams');
  const [raw, setRaw] = useState('36');

  const result = useMemo(() => {
    // Latin only: `Number()` would read Arabic-Indic digits as NaN, which is the
    // right answer — it reports "enter a number" instead of guessing.
    const value = raw.trim() === '' ? Number.NaN : Number(raw);
    return solveMole({ formula, known, value });
  }, [formula, known, raw]);

  const error = !result.ok
    ? ({
        empty: t('labMoleErrEmpty'),
        syntax: t('labMoleErrSyntax'),
        'unknown-element': t('labMoleErrUnknown'),
        'bad-value': t('labMoleErrValue'),
      }[result.reason] as string)
    : null;

  const particles = result.ok ? formatScientific(result.particles, lang) : null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align }]}>{t('labMoleFormula')}</Text>
      <TextInput
        value={formula}
        onChangeText={setFormula}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
      />
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {PRESETS.map(p => (
          <Pressable key={p} onPress={() => setFormula(p)} accessibilityRole="button" style={[styles.chip, { backgroundColor: colors.muted }]}>
            <Text style={{ color: colors.foreground, writingDirection: 'ltr' }}>{p}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align }]}>{t('labMoleKnown')}</Text>
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {(Object.keys(KNOWN_LABEL) as MoleKnown[]).map(k => (
          <Pressable
            key={k}
            onPress={() => setKnown(k)}
            accessibilityRole="button"
            aria-selected={known === k}
            style={[styles.chip, { backgroundColor: known === k ? colors.primary : colors.muted }]}
          >
            <Text style={{ color: known === k ? colors.primaryForeground : colors.foreground }}>{t(KNOWN_LABEL[k])}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.mutedForeground, textAlign: align }]}>{t('labMoleValue')}</Text>
      <TextInput
        value={raw}
        onChangeText={setRaw}
        keyboardType="decimal-pad"
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }]}
      />

      {error ? (
        <Text style={{ color: colors.destructive, textAlign: align, fontFamily: 'Almarai_400Regular' }}>{error}</Text>
      ) : result.ok && particles ? (
        <View style={[styles.results, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ResultRow label={t('labMoleMolarMass')} colors={colors} align={align}>
            <Text style={styles.value}>{formatLabNumber(result.molarMass, lang, 3)}</Text>
          </ResultRow>
          <ResultRow label={t('labMoleGrams')} colors={colors} align={align}>
            <Text style={styles.value}>{formatLabNumber(result.grams, lang, 3)}</Text>
          </ResultRow>
          <ResultRow label={t('labMoleMoles')} colors={colors} align={align}>
            <Text style={styles.value}>{formatLabNumber(result.moles, lang, 4)}</Text>
          </ResultRow>
          <ResultRow label={t('labMoleParticles')} colors={colors} align={align}>
            <Text style={styles.value}>
              {particles.mantissa}
              {particles.exponent !== null ? (lang === 'ar' ? ' × ١٠' : ' × 10') : ''}
            </Text>
            {particles.exponent !== null ? <Text style={styles.exp}>{particles.exponent}</Text> : null}
          </ResultRow>
        </View>
      ) : null}
    </View>
  );
}

function ResultRow({
  label,
  children,
  colors,
  align,
}: {
  label: string;
  children: React.ReactNode;
  colors: { foreground: string; mutedForeground: string; border: string };
  align: 'left' | 'right';
}) {
  return (
    <View style={[styles.row, { borderColor: colors.border }]}>
      <Text style={{ color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 8 },
  label: { fontSize: 13, marginTop: 6 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 18, writingDirection: 'ltr' },
  chips: { flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  results: { borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 8, gap: 4 },
  row: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  value: { fontSize: 22, fontFamily: 'ReadexPro_700Bold' },
  exp: { fontSize: 13, marginTop: 2, fontFamily: 'ReadexPro_700Bold' },
});
```

Note: the particles row prints `mantissa × 10` then the raised exponent. The `.replace` expression above is awkward; simplify it to:

```tsx
{particles.mantissa}
{particles.exponent !== null ? (lang === 'ar' ? ' × ١٠' : ' × 10') : ''}
```

Use that form when typing it in.

- [ ] **Step 4: Create the vector addition scene**

Create `artifacts/mobile/components/lab/LabVectorAddition.tsx`:

```tsx
/**
 * Two vectors drawn head-to-tail with their resultant, adjusted with − / +
 * steppers (big targets, easy on a projector). All geometry comes from
 * `labVectors.ts`, so what is drawn is what the tests checked.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { addVectors, layoutScene, type PolarVector, type ScenePoint } from '@/services/labVectors';
import { formatLabNumber } from '@/services/labFormat';

const SIZE = 300;
const A_COLOR = '#0EA5E9';
const B_COLOR = '#F97316';

export function LabVectorAddition() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const [a, setA] = useState<PolarVector>({ magnitude: 3, angleDeg: 0 });
  const [b, setB] = useState<PolarVector>({ magnitude: 4, angleDeg: 90 });

  const { resultant } = useMemo(() => addVectors(a, b), [a, b]);
  const scene = useMemo(() => layoutScene(a, b, SIZE), [a, b]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.canvas, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Svg width="100%" height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <Arrow from={scene.origin} to={scene.aTip} color={A_COLOR} label="A" />
          <Arrow from={scene.aTip} to={scene.rTip} color={B_COLOR} label="B" />
          <Arrow from={scene.origin} to={scene.rTip} color={colors.primary} label="R" bold />
        </Svg>
      </View>

      <Control title={t('labVecA')} color={A_COLOR} v={a} onChange={setA} lang={lang} isRTL={isRTL} t={t} colors={colors} />
      <Control title={t('labVecB')} color={B_COLOR} v={b} onChange={setB} lang={lang} isRTL={isRTL} t={t} colors={colors} />

      <View style={[styles.result, { backgroundColor: colors.card, borderColor: colors.primary }]}>
        <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold', textAlign: isRTL ? 'right' : 'left' }}>
          {t('labVecResultant')}
        </Text>
        <Text style={{ color: colors.foreground, fontSize: 22, fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }}>
          {formatLabNumber(resultant.magnitude, lang)} @ {formatLabNumber(resultant.angleDeg, lang, 1)}°
        </Text>
      </View>
    </View>
  );
}

function Arrow({
  from,
  to,
  color,
  label,
  bold,
}: {
  from: ScenePoint;
  to: ScenePoint;
  color: string;
  label: string;
  bold?: boolean;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return null;
  const ux = dx / len;
  const uy = dy / len;
  const head = 10;
  const base = { x: to.x - ux * head, y: to.y - uy * head };
  const left = { x: base.x - uy * 5, y: base.y + ux * 5 };
  const right = { x: base.x + uy * 5, y: base.y - ux * 5 };
  const mid = { x: (from.x + to.x) / 2 - uy * 12, y: (from.y + to.y) / 2 + ux * 12 };
  return (
    <>
      <Line x1={from.x} y1={from.y} x2={base.x} y2={base.y} stroke={color} strokeWidth={bold ? 4 : 3} />
      <Polygon points={`${to.x},${to.y} ${left.x},${left.y} ${right.x},${right.y}`} fill={color} />
      <SvgText x={mid.x} y={mid.y} fill={color} fontSize={14} fontWeight="bold" textAnchor="middle">
        {label}
      </SvgText>
    </>
  );
}

function Control({
  title,
  color,
  v,
  onChange,
  lang,
  isRTL,
  t,
  colors,
}: {
  title: string;
  color: string;
  v: PolarVector;
  onChange: (v: PolarVector) => void;
  lang: 'ar' | 'en';
  isRTL: boolean;
  t: (k: 'labVecMagnitude' | 'labVecAngle') => string;
  colors: { foreground: string; mutedForeground: string; muted: string; card: string; border: string };
}) {
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
  return (
    <View style={[styles.control, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={{ color, fontFamily: 'ReadexPro_700Bold', textAlign: isRTL ? 'right' : 'left' }}>{title}</Text>
      <Stepper
        label={t('labVecMagnitude')}
        value={formatLabNumber(v.magnitude, lang)}
        onMinus={() => onChange({ ...v, magnitude: clamp(v.magnitude - 1, 0, 20) })}
        onPlus={() => onChange({ ...v, magnitude: clamp(v.magnitude + 1, 0, 20) })}
        colors={colors}
        isRTL={isRTL}
      />
      <Stepper
        label={t('labVecAngle')}
        value={formatLabNumber(v.angleDeg, lang)}
        onMinus={() => onChange({ ...v, angleDeg: (v.angleDeg - 15 + 360) % 360 })}
        onPlus={() => onChange({ ...v, angleDeg: (v.angleDeg + 15) % 360 })}
        colors={colors}
        isRTL={isRTL}
      />
    </View>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  colors,
  isRTL,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  colors: { foreground: string; mutedForeground: string; muted: string };
  isRTL: boolean;
}) {
  return (
    <View style={[styles.stepper, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      <Text style={{ flex: 1, color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' }}>
        {label}
      </Text>
      <Pressable onPress={onMinus} accessibilityRole="button" accessibilityLabel="−" style={[styles.stepBtn, { backgroundColor: colors.muted }]}>
        <Text style={[styles.stepText, { color: colors.foreground }]}>−</Text>
      </Pressable>
      <Text style={{ minWidth: 56, textAlign: 'center', color: colors.foreground, fontSize: 18, fontFamily: 'ReadexPro_600SemiBold' }}>{value}</Text>
      <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel="+" style={[styles.stepBtn, { backgroundColor: colors.muted }]}>
        <Text style={[styles.stepText, { color: colors.foreground }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  canvas: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  control: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  stepper: { alignItems: 'center', gap: 10 },
  stepBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 24, lineHeight: 28 },
  result: { borderWidth: 2, borderRadius: 14, padding: 14, gap: 4 },
});
```

Note: in `Arrow`, drop the no-op `strokeDasharray={bold ? undefined : undefined}` prop when typing it in.

- [ ] **Step 5: Replace the dispatcher**

Replace the whole of `artifacts/mobile/components/lab/LabInteractive.tsx`:

```tsx
/**
 * Maps an interactive id to its component. The id set is closed
 * (`LAB_INTERACTIVE_IDS`), so a new interactive needs an entry here and in the
 * manifest — the `Record` type fails to compile until both exist.
 */
import React from 'react';
import type { LabInteractiveId } from '@workspace/curriculum/lab';
import { LabPeriodicTable } from './LabPeriodicTable';
import { LabMoleCalculator } from './LabMoleCalculator';
import { LabVectorAddition } from './LabVectorAddition';

const COMPONENTS: Record<LabInteractiveId, React.ComponentType> = {
  'periodic-table': LabPeriodicTable,
  'mole-calculator': LabMoleCalculator,
  'vector-addition': LabVectorAddition,
};

export function LabInteractive({ interactiveId }: { interactiveId: LabInteractiveId }) {
  const Component = COMPONENTS[interactiveId];
  return <Component />;
}
```

- [ ] **Step 6: Typecheck, test and verify**

Run: `pnpm run typecheck && cd artifacts/mobile && pnpm test`
Expected: no type errors; the whole mobile suite passes, including the new lab tests.

Run: `pnpm run dev:mobile:web`, then open each of `/curriculum/lab/lab-periodic-table`, `/lab-mole-calculator`, `/lab-vector-addition`. Expected:
- Periodic table: 20 cells in table positions (H alone top-left, He top-right of the strip, Na–Ar on row 3, K and Ca on row 4); tapping Na shows `1s2 2s2 2p6 3s1`, period 3, group 1, a 2-8-1 shell diagram.
- Mole calculator: H2O with 36 g gives 2 mol and about 1.2 × 10²⁴ particles; `Fe2O3` shows the "not covered yet" message instead of a number; `Ca(OH` shows the syntax message.
- Vector addition: A=3@0°, B=4@90° shows R = 5 @ 53.1°; tapping + on B's magnitude redraws.
As before, signing in needs a person; state in the PR what was and was not seen.

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile/components/lab artifacts/mobile/services/i18n.ts
git commit -m "feat(lab): periodic table, mole calculator and vector addition interactives"
```

---

### Task 9: Curated external pointers, STATUS.md and PR

**Files:**
- Modify: `lib/curriculum/src/data/lab_items.json` (append external items)
- Modify: `STATUS.md` (new section above `## A class can hold Library items, 2026-10-04`)
- Test: `lib/curriculum/src/__tests__/lab.test.ts` (existing checks cover the new items)

**Interfaces:**
- Consumes: `EXTERNAL_RESOURCES` from `lib/curriculum/src/external.ts`.

- [ ] **Step 1: List the candidates**

Run from the repo root:

```bash
node --experimental-strip-types -e "
import('./lib/curriculum/src/external.ts').then(({ EXTERNAL_RESOURCES }) => {
  const rows = EXTERNAL_RESOURCES.filter(r =>
    r.gradeIds.includes('grade-10') && ['chemistry', 'physics'].includes(r.subjectId) && r.lessonIds.length > 0);
  for (const r of rows) console.log(JSON.stringify({ id: r.id, subjectId: r.subjectId, kind: r.kind, lessonIds: r.lessonIds, titleEn: r.titleEn, titleAr: r.titleAr }));
});
"
```

Expected: one JSON line per curated chemistry or physics resource filed on grade 10 lessons. Videos and images are what a teacher can show; skip `text` and `audio`.

- [ ] **Step 2: Append one lab item per candidate**

For each line from step 1, append an item to `items` in `lab_items.json`, using the resource's own `lessonIds[0]`, `subjectId`, `titleAr` and `titleEn`, with the shape:

```json
    {
      "id": "lab-ext-<resource id>",
      "kind": "external",
      "externalId": "<resource id>",
      "gradeId": "grade-10",
      "subjectId": "<chemistry or physics>",
      "lessonId": "<lessonIds[0]>",
      "titleAr": "<resource titleAr>",
      "titleEn": "<resource titleEn>"
    }
```

Do not write any title yourself: copy `titleAr` and `titleEn` from the resource. Note that `LabExternalItem` has no `origin` field, which matches `lab.ts`.

- [ ] **Step 3: Run the checks**

Run: `pnpm --filter @workspace/curriculum test && pnpm run typecheck`
Expected: PASS. The existing lab tests check each new item's lesson exists and agrees with its subject, and `validateLabItems` checks each `externalId`. If the "ships the three flagship interactives" test or a count assertion breaks, it should not: they count interactives only.

- [ ] **Step 4: Update STATUS.md**

Insert this section directly above the line `## A class can hold Library items, 2026-10-04` in `STATUS.md`. Fill the angle-bracket values from what you actually observed; delete any claim you did not verify:

```markdown
## The Science Lab: a shelf in the library, 2026-10-06

**What a teacher can use today.** `/curriculum/resources` has a «المختبر» card
opening `/curriculum/lab`: seven first-party items — three interactives
(periodic table for elements 1–20, mole and molar-mass calculator, vector
addition) and four law cards (F = m × a, the vector resultant, n = m ÷ Mr,
N = n × N_A) — plus <N> pointers to curated external resources and the lesson's
own book figures. Each opens in a full-screen present mode with a copyable
link. Student-reachable by the existing `/curriculum` prefix allowlist, pinned in
`routeGating.test.ts`.

**It is grade 10 only, and the interactives were swapped during planning.** The
approved design named a pH scale and an Ohm's-law circuit. Neither has a grade
10 lesson (acids/bases is grade 9 chemistry; no grade 9 or 10 physics lesson
covers circuits), so they became the periodic table, the mole calculator and
vector addition, each on a real lesson.

**Nothing Arabic was written from memory.** A law card's Arabic is lesson
vocabulary copied verbatim and tested against the lesson; element names are
tested against the printed textbook text (`elements.test.ts`). The calculator's
parser fails closed — an element past 20 or a malformed formula returns a named
reason, never a number.

**Data lives in `lib/curriculum`** (`lab.ts`, `elements.ts`, two JSON files), so
it ships over the air. No table, no native module, no `app.json` version bump,
no schema push.

### What does not work

- **Nothing here has been seen by a person in a browser** <or: state exactly
  what was seen>. Reaching the screens means signing in, and `dev:mobile:web`
  authenticates against production.
- **No 3D, no games, no experiment cards, no hand-made infographics, no
  equipment glossary.** Experiment cards wait on vision extraction of the
  activity books (see «The English lab»); the glossary needs instruments, and
  lesson vocabulary lists terms.
- **A lab item cannot be attached to a class.** That needs a `class_resources`
  kind and the manual production schema push.
- **Elements 21+ are absent**, and the electron-configuration code stops at 20
  on purpose (the first Aufbau exception is Z = 24).
- **Biology has no lab items**, as it has no curated external media.
```

- [ ] **Step 5: Full verification**

Run: `pnpm run typecheck && pnpm --filter @workspace/curriculum test && cd artifacts/mobile && pnpm test && cd ../api-server && pnpm build && pnpm test`
Expected: everything passes. (The api-server leg is unaffected by this change, but CLAUDE.md asks for it to be built before its tests; skip it only if the sandbox cannot build it, and say so.)

- [ ] **Step 6: Commit, push, and update the PR**

```bash
git add lib/curriculum/src/data/lab_items.json STATUS.md
git commit -m "feat(lab): external pointers and STATUS entry"
git push -u origin claude/optimistic-hawking-fiflkp
```

Then update PR #886 (it started as the design spec): change its title to `feat: Science Lab («المختبر») in the library` and replace its body so it states what shipped, what was verified and what was not, and `schema-push: not needed`. End the body with the session attribution line.

---

## Self-Review (done while writing)

**Spec coverage.** Placement (entry card, `/curriculum/lab`, present mode, no new tab) → Task 6–7. Data in `lib/curriculum`, no DB, kinds `interactive`/`law`/`external`, figures joined at render → Tasks 1, 7. Reuse of figures, external shelf, licence machinery → Tasks 1, 7, 9. Three interactives with pure-logic split → Tasks 2–5, 8. Guardrails (witnessed Arabic, no "verified" without a checker, no licence from memory, attribution on every render path) → Tasks 1, 2, 7. Class attach out of scope → noted in Task 9's STATUS entry. Verification plan → Tasks 6–9. Spec's open question on the element dataset source → handled in Task 2 step 6.

**Gaps found and decided.** The spec's «equipment glossary» and hand-made infographics are deferred (spec and STATUS say so). The biology gap is recorded in STATUS rather than shown in the UI (the spec was edited to match).

**Type consistency.** `LabItem`/`LabLawItem`/`LabExternalItem`/`LabInteractiveId` are defined in Task 1 and used unchanged in Tasks 5–8. `solveMole`, `parseFormula`, `AVOGADRO`, `MoleKnown` (Task 3) match Task 8's use. `addVectors`, `layoutScene`, `PolarVector`, `ScenePoint` (Task 4) match Task 8. `formatLabNumber(n, lang, digits)` and `formatScientific(n, lang, sig)` (Task 5) match Task 8's calls. i18n keys defined in Tasks 6 and 8 are the ones the components read.

**Known soft spots to watch during execution.** The Arabic spellings of element names and the mass values are reconciled against the book in Task 2 step 6, so the numbers in the Task 3 test may change with them. The UI tasks cannot be unit-tested (the mobile runner cannot load `react-native`); their gate is typecheck plus a person looking at the web build.
