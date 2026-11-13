# Lab expansion PR 1: grade filter and the licensed media — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Science Lab («المختبر») opens on the viewer's own grade, can be filtered by grade, and lists the 24 science images and videos that `external_resources.json` already licenses but the Lab does not show.

**Architecture:** Data first: the lab manifest's test index learns more grades than Grade 10, a coverage test demands a lab row for every science image/video, and 25 rows are added to `lab_items.json`. Then a pure helper (`services/labFilters.ts`, testable under bare `node --test`) decides which grades and subjects to offer and where the screen opens; the screen (`app/curriculum/lab/index.tsx`) only wires it. No schema, no API, no native change.

**Tech Stack:** TypeScript, `node:test` (curriculum and mobile suites), Expo / React Native (web build for the visual check), JSON curriculum data.

**Spec:** `docs/superpowers/specs/2026-11-13-lab-expansion-design.md` (sections 1 and 2, *Scope and order* item 1).

## Global Constraints

- Lab items carry the `kbl-*` lesson id, never a title; an item's `subjectId` must agree with its lesson (`lab.test.ts`).
- An `external` lab item copies `titleAr`/`titleEn` from its resource exactly, and its `lessonId` is one of the resource's `lessonIds`.
- A `simulation` resource must never get a lab item: simulations reach teachers only through a released virtual-lab sheet (`releasedVirtualLab`).
- Existing lab item ids never change: they are in share links (`labShareUrl`) and lesson decks (`labSlides.ts`). New rows are appended.
- Mobile tests must live in `artifacts/mobile/services/__tests__/` and must not import `react-native` or `expo-*` at module scope, or the runner cannot load them.
- Corner screens take colours from `useColors()`, never `palette` (`cornerTheme.test.ts`).
- No `sed -i` / `perl -pi` on source or data; edit with the Edit tool. The Bash tool rewrites backslash escapes, so scripts below build newlines with `chr(10)`. After any scripted edit, read the `git diff`; a `Bin N -> M bytes` line for a text file means corruption.
- Arabic is the product language. «ما الجديد» copy is dated the Amman day the PR merges.
- Work on a branch from `origin/main` in its own worktree (`git worktree add ../wt-lab-pr1 -b <branch> origin/main`), then a **full** `pnpm install` and `pnpm exec tsc --build` at the root before trusting typecheck.

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `lib/curriculum/src/__tests__/lab.test.ts` | Modify | Lesson index over a table of catalog files (G10 chem/phys/bio/earth, G5 science); "grade agrees with lesson"; coverage test |
| `lib/curriculum/src/data/lab_items.json` | Modify | 25 new `external` rows appended |
| `artifacts/mobile/services/__tests__/labLessons.test.ts` | Create | Every lab item's lesson resolves through the app's `getLessonById` |
| `artifacts/mobile/services/labFilters.ts` | Create | Pure: grades with items, opening grade, subjects for a grade, subject to keep |
| `artifacts/mobile/services/__tests__/labFilters.test.ts` | Create | Tests for the above |
| `artifacts/mobile/app/curriculum/lab/index.tsx` | Modify | Grade chips, per-grade subject chips, grade name in the row meta |
| `artifacts/mobile/services/i18n.ts` | Modify | `labAllGrades`, two «ما الجديد» keys, in `ar` and `en` |
| `artifacts/mobile/services/whatsNew.ts` | Modify | One entry |
| `docs/status-log.md` | Modify | Top entry for this PR |
| `docs/superpowers/specs/2026-11-13-lab-expansion-design.md` | Modify | Status line: PR 1 built |

---

### Task 1: Teach the lab test index more than Grade 10

The test today reads only six Grade 10 catalog files and pins every item to Grade 10. Replace that with a table that knows each file's grade, so items for other grades can be checked the same way. Pure test refactor: the suite must stay green with the manifest unchanged.

**Files:**
- Modify: `lib/curriculum/src/__tests__/lab.test.ts` (the `FILES` table, `lessonIndex()`, `SLUG_BY_SUBJECT`, and the test "files every item under grade 10…")

**Interfaces:**
- Produces: `lessonIndex(): Map<string, { slug: string; gradeId: string; terms: string[] }>` (gains `gradeId`), used by Tasks 1–2 inside this file only.

- [ ] **Step 1: Replace the `FILES` table and `lessonIndex()`**

Replace from `const FILES = [` through the end of `function lessonIndex() { … }` with:

```ts
/**
 * Every catalog a lab item may be filed on. A grade or subject joins the Lab by
 * adding its files here; `lessonKbId` turns each JSON lesson id into the `kbl-*`
 * id the manifest carries (Grade 10 ids have no grade segment, the rest do).
 */
const FILES = [
  { file: 'iqra_curriculum_g10_chem_sem1.json', gradeId: 'grade-10', subject: 'chem', semester: 1 },
  { file: 'iqra_curriculum_g10_chem_sem2.json', gradeId: 'grade-10', subject: 'chem', semester: 2 },
  { file: 'iqra_curriculum_g10_phys_sem1.json', gradeId: 'grade-10', subject: 'phys', semester: 1 },
  { file: 'iqra_curriculum_g10_phys_sem2.json', gradeId: 'grade-10', subject: 'phys', semester: 2 },
  { file: 'iqra_curriculum_g10_bio_sem1.json', gradeId: 'grade-10', subject: 'biology', semester: 1 },
  { file: 'iqra_curriculum_g10_bio_sem2.json', gradeId: 'grade-10', subject: 'biology', semester: 2 },
  { file: 'iqra_curriculum_g10_earth_sem1.json', gradeId: 'grade-10', subject: 'earth-science', semester: 1 },
  { file: 'iqra_curriculum_g10_earth_sem2.json', gradeId: 'grade-10', subject: 'earth-science', semester: 2 },
  { file: 'iqra_curriculum_g5_science_sem1.json', gradeId: 'grade-5', subject: 'science', semester: 1 },
  { file: 'iqra_curriculum_g5_science_sem2.json', gradeId: 'grade-5', subject: 'science', semester: 2 },
] as const;

/** kbl id → { subject slug, grade, Arabic vocabulary terms }, for every lesson in `FILES`. */
function lessonIndex(): Map<string, { slug: string; gradeId: string; terms: string[] }> {
  const out = new Map<string, { slug: string; gradeId: string; terms: string[] }>();
  for (const f of FILES) {
    const cat = JSON.parse(readFileSync(new URL(`../data/${f.file}`, import.meta.url), 'utf8')) as CatalogFile;
    for (const unit of cat.units) {
      for (const lesson of unit.lessons) {
        const id = lessonKbId({ gradeId: f.gradeId, subject: f.subject, semester: f.semester }, lesson.id);
        out.set(id, { slug: f.subject, gradeId: f.gradeId, terms: (lesson.vocabulary ?? []).map(v => v.ar) });
      }
    }
  }
  return out;
}

const SLUG_BY_SUBJECT: Record<string, string> = {
  chemistry: 'chem',
  physics: 'phys',
  biology: 'biology',
  'earth-science': 'earth-science',
  science: 'science',
};
```

Delete the old one-line `const SLUG_BY_SUBJECT …` further down, so it is declared once.

- [ ] **Step 2: Replace the Grade 10 pin with "grade agrees with lesson"**

Replace the whole `it('files every item under grade 10, the only grade the lesson index covers', …)` block with:

```ts
  it('files every item under its own lesson\'s grade', () => {
    const lessons = lessonIndex();
    for (const item of LAB_ITEMS) {
      const lesson = lessons.get(item.lessonId);
      assert.ok(lesson, `${item.id}: ${item.lessonId} is not a lesson in the lab's catalog files`);
      assert.equal(item.gradeId, lesson.gradeId, `${item.id}: gradeId disagrees with its lesson`);
    }
  });
```

and in `it('names a lesson that exists, in the item\'s own subject', …)` change the failure message to
`` `${item.id}: ${item.lessonId} is not a lesson in the lab's catalog files` ``.

- [ ] **Step 3: Run the curriculum suite**

Run: `pnpm --filter @workspace/curriculum test`
Expected: PASS with no new failures. Then `pnpm run typecheck` at the root: `'earth-science'` and `'science'` must type-check as `SubjectSlug`s (they are keys of `SUBJECTS` in `curriculumIds.ts`).

- [ ] **Step 4: Commit**

```bash
git add lib/curriculum/src/__tests__/lab.test.ts
git commit -m "test(lab): lesson index knows each file's grade, not only Grade 10"
```

---

### Task 2: Every licensed science image and video gets a lab row

**Files:**
- Modify: `lib/curriculum/src/__tests__/lab.test.ts` (new test)
- Modify: `lib/curriculum/src/data/lab_items.json` (append 25 rows)
- Create: `artifacts/mobile/services/__tests__/labLessons.test.ts`

**Interfaces:**
- Consumes: `lessonIndex()` with `gradeId` (Task 1); `EXTERNAL_RESOURCES` from `../external.ts`.
- Produces: 25 manifest rows with ids `lab-ext-<resourceId>` (plus `lab-ext-commons-g5-dead-sea-salt-u4`), Grades 10 and 5, subjects `earth-science` and `science`. Task 3's tests rely on Grade 5 and Grade 10 both having items.

- [ ] **Step 1: Write the failing coverage test**

In `lab.test.ts`, change the import from `'../external.ts'` to:

```ts
import { EXTERNAL_RESOURCES, getExternalResource } from '../external.ts';
```

(`EXTERNAL_RESOURCES` is exported at `external.ts:146`.) Then add inside `describe('the shipped lab manifest', …)`:

```ts
  it('lists every licensed science image and video, and never a simulation', () => {
    const LAB_SUBJECTS = new Set(['chemistry', 'physics', 'biology', 'earth-science', 'science']);
    const pointedAt = new Set(LAB_ITEMS.flatMap(i => (i.kind === 'external' ? [i.externalId] : [])));
    const missing = EXTERNAL_RESOURCES.filter(
      r => LAB_SUBJECTS.has(r.subjectId) && (r.kind === 'image' || r.kind === 'video') && !pointedAt.has(r.id),
    ).map(r => r.id);
    assert.deepEqual(missing, [], `science media with no lab row: ${missing.join(', ')}`);
    const sims = EXTERNAL_RESOURCES.filter(r => r.kind === 'simulation' && pointedAt.has(r.id)).map(r => r.id);
    assert.deepEqual(sims, [], `a simulation reaches the Lab outside releasedVirtualLab: ${sims.join(', ')}`);
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @workspace/curriculum test`
Expected: FAIL in "lists every licensed science image and video…", naming 24 resources (`noaa-ocean-surface-currents`, …, `commons-g5-weather-station`).

- [ ] **Step 3: Append the 25 rows**

One row per resource, on its first lesson; a second row only when another of its lessons is in a different unit (only `commons-g5-dead-sea-salt`, units 3 and 4). Titles are copied from the resource. Generate the block from the data rather than typing Arabic by hand. Save as `/tmp/lab_rows.py` (outside the repo) with the Write tool, then run `python3 /tmp/lab_rows.py` from the repo root:

```python
import json
NL = chr(10)
RES = 'lib/curriculum/src/data/external_resources.json'
LAB = 'lib/curriculum/src/data/lab_items.json'
SUBJECTS = {'chemistry', 'physics', 'biology', 'earth-science', 'science'}

res = json.load(open(RES, encoding='utf-8'))
res = res if isinstance(res, list) else res['resources']
text = open(LAB, encoding='utf-8').read()
have = {i['externalId'] for i in json.loads(text)['items'] if i['kind'] == 'external'}

def unit_of(lesson_id):
    return lesson_id.rsplit('_', 1)[0]

rows = []
for r in res:
    if r['subjectId'] not in SUBJECTS or r['kind'] not in ('image', 'video') or r['id'] in have:
        continue
    units = []
    for lesson in r['lessonIds']:
        u = unit_of(lesson)
        if u in units:
            continue
        units.append(u)
        suffix = '' if len(units) == 1 else '-' + u.rsplit('-', 1)[-1]
        rows.append({
            'id': 'lab-ext-' + r['id'] + suffix,
            'kind': 'external',
            'externalId': r['id'],
            'gradeId': r['gradeIds'][0],
            'subjectId': r['subjectId'],
            'lessonId': lesson,
            'titleAr': r['titleAr'],
            'titleEn': r['titleEn'],
        })

def fmt(row):
    keys = list(row)
    body = [
        '      ' + json.dumps(k) + ': ' + json.dumps(row[k], ensure_ascii=False) + (',' if n < len(keys) - 1 else '')
        for n, k in enumerate(keys)
    ]
    return NL.join(['    {'] + body + ['    }'])

tail = '    }' + NL + '  ]' + NL + '}'
assert text.count(tail) == 1, 'manifest tail not found exactly once; stop and look'
block = (',' + NL).join(fmt(r) for r in rows)
open(LAB, 'w', encoding='utf-8').write(text.replace(tail, '    },' + NL + block + NL + '  ]' + NL + '}'))
print(len(rows), 'rows appended')
```

Expected output: `25 rows appended`.

Check the diff is text and only appends:

```bash
git diff --stat lib/curriculum/src/data/lab_items.json
```

Expected: `1 file changed, ~250 insertions(+), 1 deletion(-)` (the deleted line is the last item's `}` gaining a comma), and no `Bin`. Skim `git diff` and confirm the new ids are:

```
lab-ext-noaa-ocean-surface-currents        lab-ext-commons-g5-fly-agaric
lab-ext-noaa-gulf-stream-sst               lab-ext-commons-g5-dead-sea-salt
lab-ext-commons-basalt-columbia-river      lab-ext-commons-g5-dead-sea-salt-u4
lab-ext-commons-conglomerate-sharon        lab-ext-commons-g5-tafila-wind-farm
lab-ext-commons-gneiss-ellsworth           lab-ext-commons-g5-maan-solar
lab-ext-yt-nasa-large-scale-ocean-currents lab-ext-commons-g5-prism-spectrum
lab-ext-yt-nasa-ocean-in-motion            lab-ext-commons-g5-myplate
lab-ext-yt-nasa-rock-cycle                 lab-ext-commons-g5-urinary-ar
lab-ext-commons-g5-food-web                lab-ext-commons-g5-digestive-ar
lab-ext-commons-g5-azraq-wetland           lab-ext-commons-g5-respiratory-ar
lab-ext-commons-g5-flower-parts-ar         lab-ext-commons-g5-pulmonary-circuit-ar
                                           lab-ext-commons-g5-arm-bones-ar
                                           lab-ext-commons-g5-earth-layers
                                           lab-ext-commons-g5-weather-station
```

Delete `/tmp/lab_rows.py`.

- [ ] **Step 4: Run the curriculum suite and the curriculum verifier**

Run: `pnpm --filter @workspace/curriculum test && pnpm --filter @workspace/curriculum run verify`
Expected: PASS. If "files every item under its own lesson's grade" or "names a lesson that exists…" fails for a row, the resource's `gradeIds` or `lessonIds` disagree with the catalog: stop and report it, do not edit the resource to make the test pass.

- [ ] **Step 5: Write the app-side lesson test**

The catalog test proves the lesson exists in the JSON; this proves the *app* can open it (`getLessonById` hides lessons outside the MVP set, and the row's meta line and deck would then be blank). Create `artifacts/mobile/services/__tests__/labLessons.test.ts`:

```ts
/**
 * Every Science Lab item names a lesson the app itself resolves. `lab.test.ts`
 * (lib/curriculum) checks the lesson exists in the catalog JSON; this checks
 * `getLessonById` returns it, which also requires the lesson to be visible
 * (MVP grade, subject and book). A row whose lesson the app hides shows no
 * lesson name in the Lab and no slide in the lesson's deck.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LAB_ITEMS } from '@workspace/curriculum/lab';
import { getLessonById } from '../knowledgeBase.ts';

describe('lab items and the app lesson index', () => {
  it('resolves every lab item\'s lesson', () => {
    const missing = LAB_ITEMS.filter(i => !getLessonById(i.lessonId)).map(i => `${i.id} → ${i.lessonId}`);
    assert.deepEqual(missing, []);
  });
});
```

- [ ] **Step 6: Run the mobile suite**

Run: `cd artifacts/mobile && pnpm test`
Expected: PASS (it prints nothing for minutes; that is not a hang). If `labLessons.test.ts` lists rows, those lessons are hidden by the MVP gate: stop and report which grade/subject, do not widen `MVP_*` lists in this PR.

- [ ] **Step 7: Commit**

```bash
git add lib/curriculum/src/__tests__/lab.test.ts lib/curriculum/src/data/lab_items.json artifacts/mobile/services/__tests__/labLessons.test.ts
git diff --cached --stat
git commit -m "feat(lab): list the licensed earth-science and Grade 5 science media in the Lab"
```

---

### Task 3: Pure grade and subject logic for the Lab

**Files:**
- Create: `artifacts/mobile/services/labFilters.ts`
- Test: `artifacts/mobile/services/__tests__/labFilters.test.ts`

**Interfaces:**
- Consumes: `LabItem` from `@workspace/curriculum/lab`.
- Produces (used by Task 4):
  - `labGradeIds(items: readonly LabItem[], gradeOrder: readonly string[]): string[]`
  - `initialLabGrade(labGrades: readonly string[], userGradeIds: readonly string[] | undefined): string | null`
  - `labSubjectIds(items: readonly LabItem[], gradeId: string | null): string[]`
  - `keepLabSubject(subjectId: string | null, available: readonly string[]): string | null`

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/labFilters.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LabItem } from '@workspace/curriculum/lab';
import { initialLabGrade, keepLabSubject, labGradeIds, labSubjectIds } from '../labFilters.ts';

const item = (id: string, gradeId: string, subjectId: string): LabItem => ({
  id,
  kind: 'external',
  externalId: id,
  gradeId,
  subjectId,
  lessonId: `kbl-${id}`,
  titleAr: id,
  titleEn: id,
});

const ITEMS: LabItem[] = [
  item('a', 'grade-10', 'physics'),
  item('b', 'grade-10', 'chemistry'),
  item('c', 'grade-5', 'science'),
  item('d', 'grade-10', 'physics'),
];
const ORDER = ['grade-10', 'grade-9', 'grade-8', 'grade-5'];

describe('labGradeIds', () => {
  it('lists only grades with items, in display order', () => {
    assert.deepEqual(labGradeIds(ITEMS, ORDER), ['grade-10', 'grade-5']);
  });
  it('drops a grade the display order does not show', () => {
    assert.deepEqual(labGradeIds(ITEMS, ['grade-10']), ['grade-10']);
  });
});

describe('initialLabGrade', () => {
  const grades = ['grade-10', 'grade-5'];
  it('opens on the user\'s own grade when it has items', () => {
    assert.equal(initialLabGrade(grades, ['grade-5']), 'grade-5');
  });
  it('takes the first in display order when the user teaches several', () => {
    assert.equal(initialLabGrade(grades, ['grade-5', 'grade-10']), 'grade-10');
  });
  it('opens on all grades when none of the user\'s grades has items', () => {
    assert.equal(initialLabGrade(grades, ['grade-7']), null);
  });
  it('opens on all grades with no grades picked yet', () => {
    assert.equal(initialLabGrade(grades, undefined), null);
    assert.equal(initialLabGrade(grades, []), null);
  });
});

describe('labSubjectIds', () => {
  it('lists the grade\'s subjects once each, in manifest order', () => {
    assert.deepEqual(labSubjectIds(ITEMS, 'grade-10'), ['physics', 'chemistry']);
    assert.deepEqual(labSubjectIds(ITEMS, 'grade-5'), ['science']);
  });
  it('lists every subject for all grades', () => {
    assert.deepEqual(labSubjectIds(ITEMS, null), ['physics', 'chemistry', 'science']);
  });
});

describe('keepLabSubject', () => {
  it('keeps a subject the grade still offers', () => {
    assert.equal(keepLabSubject('physics', ['physics', 'chemistry']), 'physics');
  });
  it('falls back to all subjects when the grade has none of it', () => {
    assert.equal(keepLabSubject('physics', ['science']), null);
  });
  it('keeps all subjects as all subjects', () => {
    assert.equal(keepLabSubject(null, ['science']), null);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labFilters.test.ts`
Expected: FAIL, cannot find module `../labFilters.ts`.

- [ ] **Step 3: Implement**

Create `artifacts/mobile/services/labFilters.ts`:

```ts
/**
 * What the Science Lab offers to filter by, and where it opens. Pure, so
 * `node --test` can pin it without loading react-native; the screen
 * (`app/curriculum/lab/index.tsx`) only wires it.
 *
 * Spec: docs/superpowers/specs/2026-11-13-lab-expansion-design.md §1.
 */
import type { LabItem } from '@workspace/curriculum/lab';

/** Grade ids that have at least one item, in `gradeOrder` (the app's visible-grade order). */
export function labGradeIds(items: readonly LabItem[], gradeOrder: readonly string[]): string[] {
  const have = new Set(items.map(i => i.gradeId));
  return gradeOrder.filter(id => have.has(id));
}

/**
 * The grade the Lab opens on: the first of `labGrades` the user has picked, so
 * a teacher of Grades 9 and 10 opens on the one shown first. `null` means all
 * grades — no grade picked yet, or none of the user's grades has lab items.
 */
export function initialLabGrade(labGrades: readonly string[], userGradeIds: readonly string[] | undefined): string | null {
  if (!userGradeIds?.length) return null;
  return labGrades.find(id => userGradeIds.includes(id)) ?? null;
}

/** Subject ids with items in `gradeId` (every grade when `null`), each once, in manifest order. */
export function labSubjectIds(items: readonly LabItem[], gradeId: string | null): string[] {
  const out: string[] = [];
  for (const i of items) {
    if (gradeId !== null && i.gradeId !== gradeId) continue;
    if (!out.includes(i.subjectId)) out.push(i.subjectId);
  }
  return out;
}

/** The picked subject if the grade still offers it, else `null` (all subjects) — never an empty list. */
export function keepLabSubject(subjectId: string | null, available: readonly string[]): string | null {
  return subjectId !== null && available.includes(subjectId) ? subjectId : null;
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labFilters.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/labFilters.ts artifacts/mobile/services/__tests__/labFilters.test.ts
git commit -m "feat(lab): pure grade/subject choice for the Lab screen"
```

---

### Task 4: Grade chips on the Lab screen

**Files:**
- Modify: `artifacts/mobile/app/curriculum/lab/index.tsx`
- Modify: `artifacts/mobile/services/i18n.ts` (add `labAllGrades` beside `labAllSubjects` in both the `ar` block, ~line 351, and the `en` block, ~line 4048)

**Interfaces:**
- Consumes: the four functions from Task 3; `getVisibleGrades()` and `SUBJECTS` from `@workspace/curriculum`; `useAuth()` from `@/context/AuthContext` (its `user?.gradeIds: string[] | undefined`).

- [ ] **Step 1: Add the translation key**

In the `ar` block, directly after `labAllSubjects: 'كل المواد',` add:

```ts
    labAllGrades: 'كل الصفوف',
```

In the `en` block, directly after `labAllSubjects: 'All subjects',` add:

```ts
    labAllGrades: 'All grades',
```

- [ ] **Step 2: Wire the screen**

In `app/curriculum/lab/index.tsx`:

Imports — replace

```ts
import { SUBJECTS } from '@workspace/curriculum';
```

with

```ts
import { SUBJECTS, getVisibleGrades } from '@workspace/curriculum';
import { useAuth } from '@/context/AuthContext';
import { initialLabGrade, keepLabSubject, labGradeIds, labSubjectIds } from '@/services/labFilters';
```

Module constants — replace

```ts
const SUBJECT_IDS = [...new Set(LAB_ITEMS.map(i => i.subjectId))];
```

with

```ts
const VISIBLE_GRADES = getVisibleGrades();
const LAB_GRADE_IDS = labGradeIds(LAB_ITEMS, VISIBLE_GRADES.map(g => g.id));
```

`ItemRow` — add a `gradeName` prop and show it first in the meta line. Change the props to

```ts
function ItemRow({
  item,
  colors,
  isRTL,
  lang,
  t,
  gradeName,
}: {
  item: LabItem;
  colors: Colors;
  isRTL: boolean;
  lang: string;
  t: TFn;
  /** Shown only when all grades are listed, so two grades' rows can be told apart. */
  gradeName?: string;
}) {
```

and the meta `Text`'s children to

```tsx
          {gradeName ? `${gradeName} · ` : ''}
          {t(KIND_LABEL[item.kind])}
          {lessonTitle ? ` · ${lessonTitle}` : ''}
```

`LabShelfScreen` — replace the state and filtering lines

```ts
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [kind, setKind] = useState<LabItemKind | null>(null);

  const shown = filterLabItems({ subjectId: subjectId ?? undefined, kind: kind ?? undefined });
```

with

```ts
  const { user } = useAuth();
  // `undefined` = not chosen yet: follow the user's grade, which may arrive
  // after the first render. A tap stores a grade id or `null` (all grades).
  const [pickedGrade, setPickedGrade] = useState<string | null | undefined>(undefined);
  const gradeId = pickedGrade === undefined ? initialLabGrade(LAB_GRADE_IDS, user?.gradeIds) : pickedGrade;
  const [pickedSubject, setSubjectId] = useState<string | null>(null);
  const [kind, setKind] = useState<LabItemKind | null>(null);

  const subjectIds = labSubjectIds(LAB_ITEMS, gradeId);
  const subjectId = keepLabSubject(pickedSubject, subjectIds);
  const shown = filterLabItems({
    gradeId: gradeId ?? undefined,
    subjectId: subjectId ?? undefined,
    kind: kind ?? undefined,
  });

  const gradeName = (id: string) => {
    const g = VISIBLE_GRADES.find(x => x.id === id);
    return g ? (lang === 'ar' ? g.nameAr : g.name) : id;
  };
```

In the JSX, add the grade chip row as the first child of `CornerFrame` (only when there is a choice), and switch the subject row to `subjectIds`:

```tsx
      {LAB_GRADE_IDS.length > 1 ? (
        <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Chip colors={colors} label={t('labAllGrades')} on={gradeId === null} onPress={() => setPickedGrade(null)} />
          {LAB_GRADE_IDS.map(id => (
            <Chip colors={colors} key={id} label={gradeName(id)} on={gradeId === id} onPress={() => setPickedGrade(id)} />
          ))}
        </View>
      ) : null}
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Chip colors={colors} label={t('labAllSubjects')} on={subjectId === null} onPress={() => setSubjectId(null)} />
        {subjectIds.map(id => (
          <Chip colors={colors} key={id} label={subjectName(id)} on={subjectId === id} onPress={() => setSubjectId(id)} />
        ))}
      </View>
```

and pass the grade name to rows only when all grades are shown:

```tsx
          {shown.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              colors={colors}
              isRTL={isRTL}
              lang={lang}
              t={t}
              gradeName={gradeId === null ? gradeName(item.gradeId) : undefined}
            />
          ))}
```

Leave the kind chips and everything else as is. Keep `Chip`'s existing `colors` prop usage exactly as the file already does.

- [ ] **Step 3: Typecheck and the mobile suite**

Run: `pnpm run typecheck` (root), then `cd artifacts/mobile && pnpm test`
Expected: both PASS. `cornerTheme.test.ts`, `generatorScreens.test.ts` and `iconSystem.test.ts` read screen sources; none should change, since no `palette`, hex colour or icon size was added.

- [ ] **Step 4: Look at it in a browser**

Start the API with `AI_LIVE_MODE=false` and `pnpm run dev:mobile:web` (see `LOCAL_SETUP.md`), register a throwaway teacher, pick Grade 5 on `/setup-subjects`, open Library → «المختبر». With Playwright (desktop 1280×800 and phone 390×844, light and dark, Arabic):
  - the grade chips read «كل الصفوف · الصف العاشر · الصف الخامس», with «الصف الخامس» selected;
  - only «العلوم» is offered as a subject, and **17** rows show (16 Grade 5 images, the Dead Sea one twice);
  - tap «الصف العاشر» with «العلوم» picked: the subject falls back to «كل المواد» and the earth-science rows appear;
  - tap «كل الصفوف»: every row's meta starts with its grade name;
  - a teacher whose only grade is 7 opens on «كل الصفوف».

Take one screenshot each of phone/light and desktop/dark for the PR.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/app/curriculum/lab/index.tsx artifacts/mobile/services/i18n.ts
git diff --cached --stat
git commit -m "feat(lab): grade chips, opening on the viewer's own grade"
```

---

### Task 5: «ما الجديد», status log, spec status

**Files:**
- Modify: `artifacts/mobile/services/whatsNew.ts`
- Modify: `artifacts/mobile/services/i18n.ts` (two keys, `ar` and `en`, beside `whatsNewFollowUsTitle`)
- Modify: `docs/status-log.md`
- Modify: `docs/superpowers/specs/2026-11-13-lab-expansion-design.md`

- [ ] **Step 1: Add the entry**

At the top of `WHATS_NEW` (above `follow-us-social`), with `date` set to the Amman day the PR will merge (update it if the merge slips; a future date stays hidden until it comes):

```ts
  {
    id: 'lab-grades-and-media',
    date: '2026-11-14',
    roles: ['teacher', 'student'],
    titleKey: 'whatsNewLabGradesTitle',
    bodyKey: 'whatsNewLabGradesBody',
    route: '/curriculum/lab',
  },
```

Keys, `ar` block after `whatsNewFollowUsBody`:

```ts
    whatsNewLabGradesTitle: 'المختبر يفتح على صفّك',
    whatsNewLabGradesBody: 'أصبح «المختبر» في المكتبة يفتح على صفّك، ويمكنك عرض كل الصفوف بلمسة. وأضفنا إليه صورًا وفيديوهات لعلوم الأرض للصف العاشر، وصورًا لدروس العلوم للصف الخامس.',
```

`en` block after `whatsNewFollowUsBody`:

```ts
    whatsNewLabGradesTitle: 'The Lab opens on your grade',
    whatsNewLabGradesBody: 'The Science Lab in the Library now opens on your grade, and one tap shows every grade. It also has new earth-science photos and videos for Grade 10 and pictures for Grade 5 science lessons.',
```

Parents are left out on purpose: the Lab is a teaching shelf, and the note would only be noise to them.

- [ ] **Step 2: Run the What's New test**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whatsNew.test.ts`
Expected: PASS (keys exist, date valid, `/curriculum/lab` openable by teacher and student). If it rejects a date past today, that is the "future stays hidden" rule working; keep the merge day.

- [ ] **Step 3: Status log and spec status**

At the top of `docs/status-log.md`, directly under the header paragraph, add:

```markdown
## Science Lab: grade chips and the licensed media it was missing — <merge date>

PR 1 of `docs/superpowers/specs/2026-11-13-lab-expansion-design.md`.

**What changed.**
- The Lab opens on the viewer's own grade (`user.gradeIds`) when that grade has items, else on all grades;
  grade chips appear when more than one grade has items; subject chips follow the grade and fall back to
  «كل المواد» when the picked subject has nothing there; with all grades shown, each row names its grade.
- 25 new `external` rows: the 8 Grade 10 earth-science images and videos and the 16 Grade 5 science images
  that were licensed in `external_resources.json` but not listed (one Grade 5 image spans two units).
- `lab.test.ts` reads a table of catalog files with their grades instead of six Grade 10 files, checks each
  item's grade against its lesson's, and fails when a science image or video has no lab row or a
  simulation has one. `labLessons.test.ts` (mobile) checks the app resolves every item's lesson.

**Verified.** Curriculum `test` and `verify`, mobile `pnpm test`, root typecheck; the screen in a browser
(phone and desktop, light and dark, Arabic) as a Grade 5 teacher and a Grade 7-only teacher.

**Not done.** Law cards, the six physics tools and the virtual-lab review screen (PRs 2–5 of the spec).
Biology still has only four images; Grades 6–9 science have no lab rows.
```

In the spec, change the status line to:

```markdown
Status: written 2026-11-13. PR 1 (grade filter, media) built; PRs 2–5 not started.
```

- [ ] **Step 4: Run everything CI runs**

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

Expected: all PASS. (The API and verifier are untouched, but `lib/` changed, so CI runs them and `deploy.yml` will redeploy the API on merge.)

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/whatsNew.ts artifacts/mobile/services/i18n.ts docs/status-log.md docs/superpowers/specs/2026-11-13-lab-expansion-design.md
git diff --cached --stat
git commit -m "docs(lab): what's new, status log and spec status for the Lab grade filter"
```

Then push and open the PR with the two screenshots, the What's New entry named in the body, and «Deploy: web bundle and API (lib/ changed); no migration, no native change».
