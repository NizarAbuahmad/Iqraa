# Virtual Lab Link + POE Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each of the 7 Grade 10 lab lessons a link to a free PhET
simulation plus a hand-written predict–observe–explain (POE) sheet. Teachers
can print the sheet (with a QR code), save it to موادي, and get it from the
chat.

**Architecture:** Each simulation is a `link-only` entry in the existing
licensed resource catalog (`lib/curriculum`). Each sheet is a typed record in
a new `virtualLabs.ts` module. A pure builder turns a sheet into a
`WorksheetOutput` with a new optional `lab` block, so the existing worksheet
export, save, class-filing and student/teacher-copy paths do the rest. UI
work is a lesson-page card, a chat chip, and an «المحاكاة» block in موادي.

**Tech Stack:** TypeScript, Expo / React Native (web build), `node --test`
with `--experimental-strip-types`, `docx`, and `qrcode-generator` 2.0.4
(MIT, pure JS, new).

**Spec:** `docs/superpowers/specs/2026-10-06-virtual-lab-design.md`

## Global Constraints

- PhET is **link only**: never an iframe, never a copied asset or screenshot,
  never text sent to a model. PhET's attribution renders beside every link.
- No catalog entry or URL is written from memory. Each simulation URL is
  confirmed in a browser (HTML5, Arabic locale) and dated in
  `licenseCheckedAt` before it is added. A lab whose simulation cannot be
  confirmed gets no entry and no sheet.
- A sheet without `reviewedAt` is visible only when `__DEV__` is true. Never
  set `reviewedAt` yourself; it records a named chemistry or physics
  teacher's review.
- No native module, so `app.json` `version` is not bumped.
  `qrcode-generator` is pure JS.
- Mobile tests only run from `artifacts/mobile/services/__tests__/**/*.test.ts`.
  Anything those tests import must not import `react-native` or `expo-*` at
  module scope. Relative imports in such files need an explicit `.ts`
  extension.
- Curriculum tests run from `lib/curriculum/src/**/__tests__/**/*.test.ts`.
- Arabic is the product language; printed and on-screen text is RTL, and
  English mirrors it.
- Commands:
  - Mobile tests: `cd artifacts/mobile && pnpm test`
  - Curriculum tests: `cd lib/curriculum && pnpm test`
  - Typecheck: `pnpm run typecheck` at the repo root (builds lib types first)
- Every commit message ends with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_011Rg5JbiuZf4G2rgVUfhsd2
  ```

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/curriculum/src/bank.ts` (modify) | New licence `CC-BY-NC-4.0` → new policy `link-only` |
| `lib/curriculum/src/external.ts` (modify) | `simulation` means "opened as a link"; validation forces simulations to `link-only` |
| `lib/curriculum/src/virtualLabs.ts` (create) | `VirtualLabSheet` type, `VIRTUAL_LABS` data, `releasedVirtualLab`, `validateVirtualLabs` |
| `lib/curriculum/src/data/external_resources.json` (modify, Task 8) | The confirmed PhET entries |
| `artifacts/mobile/services/ai/AIService.ts` (modify) | `WorksheetOutput.lab?` |
| `artifacts/mobile/services/virtualLab.ts` (create) | Pure: sheet → `WorksheetOutput`, save payload, chat message, lab lookup for a lesson |
| `artifacts/mobile/services/labQr.ts` (create) | Pure: URL → inline SVG QR |
| `artifacts/mobile/services/exportHtml.ts` (modify) | «المحاكاة» block on the printed worksheet |
| `artifacts/mobile/services/exportText.ts` (modify) | Link + steps in worksheet text / Word |
| `artifacts/mobile/services/worksheetExport.ts` (create) | `worksheetExports(ws, …, copy)` → text/html/word, mirroring `quizExports` |
| `artifacts/mobile/app/workspace/view.tsx` (modify) | Copy choice for worksheets; «المحاكاة» block on screen |
| `artifacts/mobile/app/(tabs)/iqra.tsx` (modify) | Copy choice for worksheets; lab chip handler |
| `artifacts/mobile/services/lessonCopilot.ts` (modify) | Lab chip in `buildLessonSuggestions` |
| `artifacts/mobile/components/ui/VirtualLabCard.tsx` (create) | Lesson-page card |
| `artifacts/mobile/app/curriculum/lesson-detail.tsx` (modify) | Mount the card |
| `artifacts/mobile/components/ui/LessonShelfPanel.tsx` (modify) | Shelf note for `link-only` |
| `artifacts/mobile/services/i18n.ts` (modify) | New strings |

---

### Task 0: Branch setup (no code)

- [ ] **Step 1:** Confirm PR NizarAbuahmad/Iqraa#883 is merged. Never stack
  new commits on its unmerged branch.
- [ ] **Step 2:** Restart the branch from `main`:
  ```bash
  git fetch origin main
  git checkout -B claude/stoic-turing-n168fl origin/main
  ```
- [ ] **Step 3:** Copy the spec to
  `docs/superpowers/specs/2026-10-06-virtual-lab-design.md` and this plan to
  `docs/superpowers/plans/2026-10-06-virtual-lab.md`. Commit:
  `docs: virtual lab design and plan`.

---

### Task 1: `link-only` licence and policy

**Files:**
- Modify: `lib/curriculum/src/bank.ts` (`BankUsePolicy` ~57, `LicenseId` ~85, `POLICY_BY_LICENSE` ~137, `byPolicy` ~395)
- Modify: `lib/curriculum/src/external.ts` (kind comment ~46, `validateExternalResources` ~227)
- Modify: `artifacts/mobile/components/ui/LessonShelfPanel.tsx:195`, `artifacts/mobile/services/i18n.ts`
- Test: `lib/curriculum/src/__tests__/bank.test.ts`, `lib/curriculum/src/__tests__/external.test.ts`

**Interfaces:**
- Produces:
  - `LicenseId` gains `'CC-BY-NC-4.0'`.
  - `BankUsePolicy` gains `'link-only'`.
  - `usePolicy({ authority: 'third-party', license: 'CC-BY-NC-4.0' }) === 'link-only'`.
  - `validateExternalResources` reports any `simulation` whose policy is not
    `link-only`.

- [ ] **Step 1: Write the failing tests.** Append to `bank.test.ts`:

```ts
describe('a non-commercial licence is link-only', () => {
  it('maps CC-BY-NC-4.0 to link-only', () => {
    assert.equal(usePolicy({ authority: 'third-party', license: 'CC-BY-NC-4.0' }), 'link-only');
  });
  it('is not quotable, so it can never be reproduced or prompted', () => {
    assert.throws(() => assertQuotable({ authority: 'third-party', license: 'CC-BY-NC-4.0' } as never), /link-only/);
  });
});
```

Check how `assertQuotable` is called in the existing test at
`bank.test.ts:319` and use the same argument shape there.

Append to `external.test.ts`:

```ts
describe('a simulation is only ever a link', () => {
  const sim: ExternalResource = { ...base, id: 'sim', kind: 'simulation', provider: 'phet', license: 'CC-BY-NC-4.0' };
  it('accepts a link-only simulation', () => {
    assert.deepEqual(validateExternalResources([sim]), []);
  });
  it('refuses a simulation under any other policy', () => {
    const errs = validateExternalResources([{ ...sim, license: 'embed-terms' }]);
    assert.ok(errs.some(e => /sim: a simulation must be link-only/.test(e)), errs.join('\n'));
  });
  it('refuses a copy of a simulation', () => {
    const errs = validateExternalResources([{ ...sim, ingest: { r2Key: 'x', sha256: 'y', bytes: 1, ingestedAt: '2026-10-06' } }]);
    assert.ok(errs.some(e => /grants no redistribution right/.test(e)));
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**
  `cd lib/curriculum && pnpm test`. Expected: TS strip-types runs, then the
  assertions fail. `'CC-BY-NC-4.0'` is not mapped yet, so `usePolicy` falls
  back to `reference-only`, and the simulation rule doesn't exist.

- [ ] **Step 3: Implement.** In `bank.ts`:

```ts
  /**
   * May be pointed at — a link the teacher or student follows — and nothing
   * else: never framed in an iframe, never copied, never sent to a model.
   * For non-commercial licences (PhET since 2026-03-29): classroom use of the
   * origin site is the user's own, free use; reproducing or framing it inside
   * a commercial product is not ours to do. Stricter than `embed-only`.
   */
  | 'link-only';
```

Add to `LicenseId`:

```ts
  /**
   * Attribution-NonCommercial. PhET's whole library since 2026-03-29. Free for
   * a teacher or student to use; a commercial product may only link to it.
   */
  | 'CC-BY-NC-4.0'
```

Add `'CC-BY-NC-4.0': 'link-only',` to `POLICY_BY_LICENSE`. Change the
`byPolicy` initialiser to
`{ quotable: 0, 'reference-only': 0, 'embed-only': 0, 'link-only': 0 }`.

In `external.ts`, change the kind comment to
`/** An interactive simulation, opened as a link on its own site. Never framed, never copied. */`,
and inside the `validateExternalResources` loop add:

```ts
    if (r.kind === 'simulation' && usePolicy(r) !== 'link-only') {
      // A simulation is followed, never framed: every provider with one worth
      // linking (PhET, GeoGebra) licenses it non-commercially or by agreement.
      errors.push(`${r.id}: a simulation must be link-only (licence ${r.license})`);
    }
```

In `LessonShelfPanel.tsx:195`, change the note key to
`policy === 'link-only' ? 'shelfLinkOnly' : policy === 'embed-only' ? 'shelfEmbedOnly' : 'shelfNoReprint'`.
Add `shelfLinkOnly` to `services/i18n.ts` next to `shelfEmbedOnly`, in both
languages:
- ar: `'يُفتح على موقعه فقط — لا يُنسخ ولا يُعرض داخل التطبيق'`
- en: `'Opens on its own site only — never copied or shown inside the app'`

- [ ] **Step 4: Run the tests and see them pass.**
  `cd lib/curriculum && pnpm test` passes, then `pnpm run typecheck` at the
  root is clean. If the typecheck flags an exhaustive `switch`/`Record` over
  `BankUsePolicy` (e.g. `artifacts/api-server/src/modules/assessment/mockGenerator.ts`),
  add the `link-only` case there with the same meaning as `embed-only`.

- [ ] **Step 5: Commit.** `feat(curriculum): link-only policy for non-commercial simulations`

---

### Task 2: `virtualLabs.ts` — sheet type, release gate, validation

**Files:**
- Create: `lib/curriculum/src/virtualLabs.ts`
- Modify: `lib/curriculum/src/index.ts` (export), `lib/curriculum/package.json` `exports` (add `"./virtual-labs": "./src/virtualLabs.ts"`, following the `./external` line)
- Test: `lib/curriculum/src/__tests__/virtualLabs.test.ts`

**Interfaces:**
- Produces:

```ts
export interface VirtualLabSheet {
  lessonId: string; resourceId: string; aimAr: string;
  predict: string[]; procedure: string[]; observe: string[]; explain: string[];
  teacherKey: { predict: string[]; observe: string[]; explain: string[] };
  reviewedBy?: string; reviewedAt?: string;
}
export const VIRTUAL_LABS: readonly VirtualLabSheet[];
export function releasedVirtualLab(lessonId: string, opts?: { dev?: boolean; labs?: readonly VirtualLabSheet[] }): VirtualLabSheet | null;
export function validateVirtualLabs(labs: readonly VirtualLabSheet[], resources: readonly ExternalResource[]): string[];
```

- [ ] **Step 1: Write the failing test** (`virtualLabs.test.ts`):

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VIRTUAL_LABS, releasedVirtualLab, validateVirtualLabs, type VirtualLabSheet } from '../virtualLabs.ts';
import { EXTERNAL_RESOURCES, type ExternalResource } from '../external.ts';

const sim: ExternalResource = {
  id: 'phet-test', lessonIds: ['kbl-chem-s1-nccd-u1_lab'], gradeIds: ['grade-10'], subjectId: 'chemistry',
  kind: 'simulation', titleEn: 'Test', titleAr: 'تجربة', provider: 'phet', license: 'CC-BY-NC-4.0',
  licenseUrl: 'https://phet.colorado.edu/en/licensing', sourceUrl: 'https://phet.colorado.edu/sims/html/x/latest/x_ar.html',
  attribution: 'PhET Interactive Simulations, University of Colorado Boulder — phet.colorado.edu',
  licenseCheckedAt: '2026-10-06', authority: 'third-party',
};
const sheet: VirtualLabSheet = {
  lessonId: 'kbl-chem-s1-nccd-u1_lab', resourceId: 'phet-test', aimAr: 'هدف',
  predict: ['توقّع'], procedure: ['خطوة'], observe: ['لاحظ'], explain: ['فسّر', 'فسّر ثانيًا'],
  teacherKey: { predict: ['ج'], observe: ['ج'], explain: ['ج', 'ج'] },
};

describe('the release gate', () => {
  it('hides an unreviewed sheet from teachers', () => {
    assert.equal(releasedVirtualLab(sheet.lessonId, { labs: [sheet] }), null);
  });
  it('shows it in a dev build, for review', () => {
    assert.equal(releasedVirtualLab(sheet.lessonId, { labs: [sheet], dev: true }), sheet);
  });
  it('releases it once a review is recorded', () => {
    const reviewed = { ...sheet, reviewedBy: 'أ. معلم', reviewedAt: '2026-10-10' };
    assert.equal(releasedVirtualLab(sheet.lessonId, { labs: [reviewed] }), reviewed);
  });
  it('a lesson with no sheet has none', () => {
    assert.equal(releasedVirtualLab('kbl-nope', { labs: [sheet], dev: true }), null);
  });
});

describe('validateVirtualLabs', () => {
  it('accepts a complete sheet', () => {
    assert.deepEqual(validateVirtualLabs([sheet], [sim]), []);
  });
  it('refuses a sheet whose simulation is not in the catalog', () => {
    assert.ok(validateVirtualLabs([sheet], []).some(e => /phet-test.*not in the catalog/.test(e)));
  });
  it('refuses a sheet pointing at a non-simulation resource', () => {
    assert.ok(validateVirtualLabs([sheet], [{ ...sim, kind: 'video' }]).some(e => /not a simulation/.test(e)));
  });
  it('refuses an empty section or a key that does not match it', () => {
    const errs = validateVirtualLabs([{ ...sheet, observe: [], teacherKey: { ...sheet.teacherKey, explain: ['ج'] } }], [sim]);
    assert.ok(errs.some(e => /observe is empty/.test(e)));
    assert.ok(errs.some(e => /explain: 2 questions but 1 key/.test(e)));
  });
  it('refuses a review date without a reviewer', () => {
    assert.ok(validateVirtualLabs([{ ...sheet, reviewedAt: '2026-10-10' }], [sim]).some(e => /reviewedAt without reviewedBy/.test(e)));
  });
  it('the shipped sheets are all valid against the shipped catalog', () => {
    assert.deepEqual(validateVirtualLabs(VIRTUAL_LABS, EXTERNAL_RESOURCES), []);
  });
});
```

- [ ] **Step 2: Run and watch it fail** (module not found, then the
  assertions once a stub exists).
- [ ] **Step 3: Implement** `virtualLabs.ts`:

```ts
/**
 * A predict–observe–explain sheet for each lab lesson («تجربة استهلالية»),
 * paired with a simulation the student opens on its own site.
 *
 * Hand-written and fixed, not generated: there are seven, a wrong
 * observation in a lab is worse than none, and a fixed sheet is the same
 * whether live AI is on or off. Each stays hidden from teachers until a
 * subject teacher has reviewed it — `reviewedBy`/`reviewedAt` are that record,
 * and nothing but a real review may set them.
 */
import type { ExternalResource } from './external.ts';

export interface VirtualLabSheet {
  /** KB id of the lab lesson, e.g. `kbl-chem-s1-nccd-u1_lab`. */
  lessonId: string;
  /** The `simulation` entry in external_resources.json. */
  resourceId: string;
  aimAr: string;
  predict: string[];
  /** Numbered steps to do in the simulation. */
  procedure: string[];
  observe: string[];
  explain: string[];
  teacherKey: { predict: string[]; observe: string[]; explain: string[] };
  reviewedBy?: string;
  /** ISO date of the review; absent = not released. */
  reviewedAt?: string;
}

/** Filled in Task 8, once each simulation URL is confirmed. */
export const VIRTUAL_LABS: readonly VirtualLabSheet[] = [];

export function releasedVirtualLab(
  lessonId: string,
  opts: { dev?: boolean; labs?: readonly VirtualLabSheet[] } = {},
): VirtualLabSheet | null {
  const sheet = (opts.labs ?? VIRTUAL_LABS).find(l => l.lessonId === lessonId);
  if (!sheet) return null;
  return sheet.reviewedAt || opts.dev ? sheet : null;
}

export function validateVirtualLabs(
  labs: readonly VirtualLabSheet[],
  resources: readonly ExternalResource[],
): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const l of labs) {
    if (seen.has(l.lessonId)) errors.push(`${l.lessonId}: two sheets for one lesson`);
    seen.add(l.lessonId);
    if (!l.lessonId.startsWith('kbl-') || !l.lessonId.endsWith('_lab')) {
      errors.push(`${l.lessonId}: not a lab lesson id`);
    }
    const r = resources.find(x => x.id === l.resourceId);
    if (!r) errors.push(`${l.lessonId}: resource ${l.resourceId} is not in the catalog`);
    else {
      if (r.kind !== 'simulation') errors.push(`${l.lessonId}: ${l.resourceId} is not a simulation`);
      if (!r.lessonIds.includes(l.lessonId)) errors.push(`${l.lessonId}: ${l.resourceId} is not filed on this lesson`);
    }
    if (!l.aimAr.trim()) errors.push(`${l.lessonId}: aim is empty`);
    for (const part of ['predict', 'procedure', 'observe', 'explain'] as const) {
      if (!l[part].length || l[part].some(s => !s.trim())) errors.push(`${l.lessonId}: ${part} is empty`);
    }
    for (const part of ['predict', 'observe', 'explain'] as const) {
      if (l.teacherKey[part].length !== l[part].length) {
        errors.push(`${l.lessonId}: ${part}: ${l[part].length} questions but ${l.teacherKey[part].length} key`);
      }
    }
    if (l.reviewedAt && !l.reviewedBy?.trim()) errors.push(`${l.lessonId}: reviewedAt without reviewedBy`);
  }
  return errors;
}
```

Export from `index.ts`: `export * from './virtualLabs.ts';`.

- [ ] **Step 4: Run tests until they pass**, then `pnpm run typecheck`.
- [ ] **Step 5: Commit.** `feat(curriculum): virtual lab sheets, release gate and validation`

---

### Task 3: Sheet → worksheet builder

**Files:**
- Modify: `artifacts/mobile/services/ai/AIService.ts` (`WorksheetOutput` ~186)
- Create: `artifacts/mobile/services/virtualLab.ts`
- Test: `artifacts/mobile/services/__tests__/virtualLab.test.ts`

**Interfaces:**
- Consumes:
  - `VirtualLabSheet` and `releasedVirtualLab` from `@workspace/curriculum`
    (in tests, import from `../../../../lib/curriculum/src/virtualLabs.ts`
    the way other mobile tests import lib modules; copy their import style).
  - `getExternalResource`.
  - `resolveLessonPrepContext(lessonId, lang)` from `./lessonPrep.ts`
    (returns `{ topic, subjectLabel, gradeName, … } | null`).
- Produces:

```ts
// AIService.ts
export interface WorksheetLab { url: string; simName: string; attribution: string; steps: string[] }
// WorksheetOutput gains:  lab?: WorksheetLab;

// virtualLab.ts
export function virtualLabWorksheet(sheet: VirtualLabSheet, resource: ExternalResource, lessonTitle: string): WorksheetOutput;
export function virtualLabFor(lessonId: string, opts: { dev: boolean }): { sheet: VirtualLabSheet; resource: ExternalResource } | null;
```

- [ ] **Step 1: Write the failing test** (`virtualLab.test.ts`). Use the
  `sheet`/`sim` fixtures from Task 2 (copy them; the test must stand alone):

```ts
describe('virtualLabWorksheet', () => {
  const ws = virtualLabWorksheet(sheet, sim, 'تجربة استهلالية: الطيف الذري');
  it('is titled as a virtual lab on its lesson', () => {
    assert.equal(ws.title, 'مختبر افتراضي: تجربة استهلالية: الطيف الذري');
  });
  it('puts the aim in the instructions', () => assert.equal(ws.instructions, sheet.aimAr));
  it('asks predict, observe, explain, in that order', () => {
    assert.deepEqual(ws.sections.map(s => s.title), ['أتوقّع', 'ألاحظ', 'أفسّر']);
    assert.ok(ws.sections.every(s => s.type === 'short_answer'));
    assert.deepEqual(ws.sections[2]!.questions.map(q => q.text), sheet.explain);
  });
  it('numbers the key to match the questions across sections', () => {
    assert.deepEqual(ws.answerKey.map(k => k.num), [1, 2, 3, 4]);
    assert.deepEqual(ws.answerKey.map(k => k.answer), ['ج', 'ج', 'ج', 'ج']);
  });
  it('carries the link, credit and steps, never anything to embed', () => {
    assert.deepEqual(ws.lab, { url: sim.sourceUrl, simName: sim.titleAr, attribution: sim.attribution, steps: sheet.procedure });
  });
  it('gives each question one point', () => {
    assert.ok(ws.sections.flatMap(s => s.questions).every(q => q.points === 1));
  });
});

describe('virtualLabFor', () => {
  // An ordinary lesson, so this stays true after the lab sheets ship and are reviewed.
  it('finds nothing on a lesson with no lab', () => {
    assert.equal(virtualLabFor('kbl-math-s2-nccd-u5_l4', { dev: true }), null);
  });
});
```

- [ ] **Step 2: Run and watch it fail.**
  `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/virtualLab.test.ts`
- [ ] **Step 3: Implement.** Add `WorksheetLab` and `lab?: WorksheetLab` to
  `AIService.ts`, with a doc comment: "A virtual lab: the simulation the
  student opens on its own site. Absent on every generated worksheet." Then
  write `virtualLab.ts`:

```ts
/**
 * A virtual-lab sheet as a worksheet, so export, save, class filing and the
 * student/teacher copy all work through the worksheet paths unchanged.
 * Pure — no react-native — so the tests can load it.
 */
import type { ExternalResource, VirtualLabSheet } from '@workspace/curriculum';
import { getExternalResource, releasedVirtualLab } from '@workspace/curriculum';
import type { WorksheetOutput, WorksheetSection } from './ai/AIService.ts';

const SECTIONS = [['predict', 'أتوقّع'], ['observe', 'ألاحظ'], ['explain', 'أفسّر']] as const;

export function virtualLabWorksheet(sheet: VirtualLabSheet, resource: ExternalResource, lessonTitle: string): WorksheetOutput {
  const sections: WorksheetSection[] = SECTIONS.map(([part, title]) => ({
    type: 'short_answer',
    title,
    questions: sheet[part].map(text => ({ text, points: 1 })),
  }));
  let num = 0;
  const answerKey = SECTIONS.flatMap(([part]) => sheet.teacherKey[part].map(answer => ({ num: ++num, answer })));
  return {
    title: `مختبر افتراضي: ${lessonTitle}`,
    instructions: sheet.aimAr,
    sections,
    answerKey,
    lab: { url: resource.sourceUrl, simName: resource.titleAr, attribution: resource.attribution, steps: sheet.procedure },
  };
}

export function virtualLabFor(lessonId: string, opts: { dev: boolean }): { sheet: VirtualLabSheet; resource: ExternalResource } | null {
  const sheet = releasedVirtualLab(lessonId, { dev: opts.dev });
  const resource = sheet ? getExternalResource(sheet.resourceId) : undefined;
  return sheet && resource ? { sheet, resource } : null;
}
```

Check how other mobile services import from `@workspace/curriculum` (e.g.
`services/lessonShelf.ts`) and match it. If the alias does not resolve under
`node --test`, use the same relative path the existing tests use.

- [ ] **Step 4: Run until it passes;** then run the full `pnpm test` and the
  typecheck.
- [ ] **Step 5: Commit.** `feat(mobile): virtual lab sheet as a worksheet`

---

### Task 4: Print the «المحاكاة» block with a QR; text and Word carry it too

**Files:**
- Modify: `artifacts/mobile/package.json` (add `qrcode-generator@2.0.4` with `pnpm --filter mobile add qrcode-generator@2.0.4`; check the real package name in `artifacts/mobile/package.json`)
- Create: `artifacts/mobile/services/labQr.ts`
- Modify: `artifacts/mobile/services/exportHtml.ts` (`buildWorksheetHTML` ~490, styles ~150-240)
- Modify: `artifacts/mobile/services/exportText.ts` (`formatWorksheetText` ~75)
- Test: `artifacts/mobile/services/__tests__/virtualLabPrint.test.ts`

**Interfaces:**
- Consumes: `WorksheetOutput.lab` (Task 3).
- Produces: `labQrSvg(url: string): string`, returning an `<svg …>` string
  with no `<script>`, scalable.

- [ ] **Step 1: Write the failing test:**

```ts
import { buildWorksheetHTML } from '../exportHtml.ts';
import { formatWorksheetText } from '../exportText.ts';
import { labQrSvg } from '../labQr.ts';

const meta = { subject: 'الكيمياء', grade: 'الصف العاشر' };
const ws = virtualLabWorksheet(sheet, sim, 'الطيف الذري');      // fixtures as in Task 3

describe('the printed virtual lab', () => {
  const student = buildWorksheetHTML(ws, ws.title, meta, true, [], false);
  const teacher = buildWorksheetHTML(ws, ws.title, meta, true, [], true);
  it('prints the link as text, so a photocopy still carries it', () => {
    assert.ok(student.includes(sim.sourceUrl));
  });
  it('prints a QR code of the same link', () => {
    assert.match(student, /<div class="lab-qr"><svg/);
    assert.ok(student.includes(labQrSvg(sim.sourceUrl)));
  });
  it('credits PhET beside the link', () => assert.ok(student.includes(sim.attribution)));
  it('numbers the steps', () => assert.match(student, /<ol class="lab-steps"><li>/));
  it('keeps the key off the student copy and on the teacher copy', () => {
    assert.ok(!student.includes('مفتاح الإجابات'));
    assert.ok(teacher.includes('مفتاح الإجابات'));
  });
  it('leaves every other worksheet exactly as it was', () => {
    const plain = { ...ws, lab: undefined };
    assert.ok(!buildWorksheetHTML(plain, 'ورقة', meta, true).includes('lab-box'));
  });
});

describe('labQrSvg', () => {
  it('is an inline SVG with nothing executable', () => {
    const svg = labQrSvg('https://phet.colorado.edu/sims/html/x/latest/x_ar.html');
    assert.match(svg, /^<svg[\s>]/);
    assert.ok(!/<script|on\w+=/i.test(svg));
  });
});

describe('the virtual lab as text (share, copy, Word)', () => {
  it('carries the link and the steps', () => {
    const text = formatWorksheetText(ws, ws.title, meta, true, false);
    assert.ok(text.includes(sim.sourceUrl));
    assert.ok(text.includes(`1. ${sheet.procedure[0]}`));
  });
});
```

- [ ] **Step 2: Run and watch it fail.**
- [ ] **Step 3: Implement.**
  - Install: `cd artifacts/mobile && pnpm add qrcode-generator@2.0.4`.
  - `labQr.ts`:

```ts
/**
 * A QR code for a printed link, as inline SVG — no canvas, no image file, so
 * it prints in the PDF exactly where the link is. `qrcode-generator` is pure
 * JS (MIT, no dependencies): no native module, no app version bump.
 */
import qrcode from 'qrcode-generator';

export function labQrSvg(url: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
}
```

  - In `buildWorksheetHTML`, build the block right after the instructions
    callout and before `${worked}`:

```ts
  const lab = ws.lab
    ? `<div class="lab-box"><div class="lab-head"><div class="lab-text">`
      + `<div class="worked-label">${L('المحاكاة', 'Simulation')}: ${esc(ws.lab.simName)}</div>`
      + `<div class="lab-url">${escAttr(ws.lab.url)}</div>`
      + `<div class="lab-credit">${esc(ws.lab.attribution)}</div></div>`
      + `<div class="lab-qr">${labQrSvg(ws.lab.url)}</div></div>`
      + `<ol class="lab-steps">${ws.lab.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>`
    : '';
```

  Insert `${lab}` into `content`. The URL goes through `escAttr`, not
  `esc`: it must not carry the bidi isolates `esc` adds, and those would
  break a copied link. Add the CSS next to `.worked`:

```css
    .lab-box { border: 1px solid ${accent}55; border-radius: 8px; padding: 12px 14px; margin-bottom: 16px; break-inside: avoid; }
    .lab-head { display: flex; flex-direction: row; gap: 12px; align-items: center; }
    .lab-text { flex: 1; }
    .lab-url { direction: ltr; text-align: left; font-family: monospace; font-size: 11px; color: #1d4ed8; word-break: break-all; margin: 4px 0; }
    .lab-credit { font-size: 10.5px; color: #6b7280; }
    .lab-qr { width: 84px; height: 84px; flex-shrink: 0; }
    .lab-qr svg { width: 100%; height: 100%; }
    .lab-steps { padding-${isRTL ? 'right' : 'left'}: 20px; margin-top: 8px; }
    .lab-steps li { font-size: 12.5px; margin-bottom: 3px; }
```

  - In `formatWorksheetText`, after the instructions line:

```ts
  if (ws.lab) {
    lines.push(`\n${isAr ? 'المحاكاة' : 'SIMULATION'}: ${ws.lab.simName}`);
    lines.push(ws.lab.url);
    lines.push(ws.lab.attribution);
    ws.lab.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  }
```

- [ ] **Step 4: Run the new test and the full suite** (the existing
  `exportHtml`/`worksheetWorkedExampleRender` tests must stay green), then
  run the typecheck.
- [ ] **Step 5: Render-check.** Write a scratch script (outside the repo)
  that writes the student HTML to a file. Print it with Playwright
  (`/opt/node-tools/node_modules/playwright`) to PDF and PNG, look at it,
  and decode the QR: `pip install -q pyzbar` or any QR decoder available,
  or `zbarimg` if installed. Confirm the decoded text equals the URL.
- [ ] **Step 6: Commit.** `feat(mobile): virtual lab block with QR on the printed worksheet`

---

### Task 5: Student/teacher copy for worksheets in موادي and the chat

**Files:**
- Create: `artifacts/mobile/services/worksheetExport.ts`
- Modify: `artifacts/mobile/app/workspace/view.tsx` (quiz-only `quizCopy` → `docCopy`, export handlers ~150-215, `<ExportMenu copyChoice>`)
- Modify: `artifacts/mobile/app/(tabs)/iqra.tsx` (`exportQuiz` state → `exportDoc`, `handleExportMessage`, ExportMenu handlers ~3950)
- Test: `artifacts/mobile/services/__tests__/worksheetExport.test.ts`

**Interfaces:**
- Consumes:
  - `QuizCopy` and `quizExports` from `services/quizExport.ts` (PR #883).
  - `buildWordDocument(text, isAr, docx)` from `services/docxBuild.ts`.
- Produces:
  `worksheetExports(ws, title, meta, isAr, copy, figures?) => { text: string; html: string; word: (docx) => Document }`.

- [ ] **Step 1: Write the failing test:**

```ts
import * as docx from 'docx';
import { worksheetExports } from '../worksheetExport.ts';
import { documentXmlOf } from './docxXml.ts';

const ws = { title: 't', instructions: 'أجب', sections: [{ type: 'short_answer', title: 'ق', questions: [{ text: 'س؟', points: 1 }] }],
  answerKey: [{ num: 1, answer: 'جواب سري' }] } as WorksheetOutput;
const meta = { subject: 'الكيمياء', grade: 'الصف العاشر' };

describe('worksheetExports', () => {
  for (const [copy, keyed] of [['student', false], ['teacher', true]] as const) {
    it(`${copy} copy: the key is ${keyed ? 'in' : 'out of'} every format`, async () => {
      const out = worksheetExports(ws, 'ورقة', meta, true, copy);
      const word = documentXmlOf(await docx.Packer.toBuffer(out.word(docx)));
      for (const [format, body] of Object.entries({ text: out.text, html: out.html, word })) {
        assert.equal(body.includes('جواب سري'), keyed, `${format} ${copy}`);
      }
    });
  }
});
```

- [ ] **Step 2: Run and watch it fail.**
- [ ] **Step 3: Implement** `worksheetExport.ts`:

```ts
/**
 * A worksheet's three export formats for one copy — mirror of `quizExports`.
 * موادي and the chat have no answers toggle, so they ask in the export menu;
 * a virtual-lab sheet's key must not reach students by default.
 */
import type * as Docx from 'docx';
import type { WorksheetOutput } from './ai/AIService.ts';
import { buildWordDocument } from './docxBuild.ts';
import { buildWorksheetHTML, type BookFigureRef } from './exportHtml.ts';
import { formatWorksheetText } from './exportText.ts';
import type { QuizCopy } from './quizExport.ts';

export function worksheetExports(
  ws: WorksheetOutput, title: string, meta: { subject: string; grade: string },
  isAr: boolean, copy: QuizCopy, figures: readonly BookFigureRef[] = [],
) {
  const withKey = copy === 'teacher';
  const text = formatWorksheetText(ws, title, meta, isAr, withKey);
  return {
    text,
    html: buildWorksheetHTML(ws, title, meta, isAr, figures, withKey),
    word: (docx: typeof Docx) => buildWordDocument(text, isAr, docx),
  };
}
```

  - **`view.tsx`:**
    - Rename `quizCopy`/`setQuizCopy` to `docCopy`/`setDocCopy`.
    - In `getPlainText` and `getHTML`, route `kind === 'worksheet'` through
      `worksheetExports(content as WorksheetOutput, item.title, meta, isAr, docCopy, figures)`
      (`.text`/`.html`).
    - In `handleWord`, use the `quiz.word`-style `exportBuiltWord` path for
      both quiz and worksheet.
    - `copyChoice` shows when `(kind === 'quiz' || kind === 'worksheet') && content`.
  - **`iqra.tsx`:**
    - Replace the `exportQuiz` state with
      `exportDoc: { kind: 'quiz'; quiz } | { kind: 'worksheet'; worksheet }`,
      plus the same `title`/`meta`/`isAr`.
    - Set it in `handleExportMessage` for `data.kind === 'quiz' || 'worksheet'`.
    - `exportQuizDocs()` becomes `exportDocs()`, returning `quizExports(...)`
      or `worksheetExports(...)`.
    - The handlers are unchanged apart from the name.

- [ ] **Step 4: Run the full suite and the typecheck.**
- [ ] **Step 5: Live check** (local stack, as in PR #883's verification):
  - Save a worksheet, open it in موادي, export the student and teacher Word
    files; the key is in only the teacher's.
  - Do the same for a chat worksheet.
- [ ] **Step 6: Commit.** `feat(mobile): student/teacher copy for worksheets in موادي and chat`

---

### Task 6: Lesson-page card, save to موادي, analytics

**Files:**
- Modify: `artifacts/mobile/services/virtualLab.ts` (add `virtualLabSavePayload`)
- Create: `artifacts/mobile/components/ui/VirtualLabCard.tsx`
- Modify: `artifacts/mobile/app/curriculum/lesson-detail.tsx` (after `<LessonShelfPanel …/>` ~197)
- Modify: `artifacts/mobile/services/i18n.ts`
- Test: `artifacts/mobile/services/__tests__/virtualLab.test.ts` (extend)

**Interfaces:**
- Consumes:
  - `virtualLabFor` and `virtualLabWorksheet` (Task 3).
  - `worksheetExports` (Task 5).
  - `resolveLessonPrepContext`.
  - `saveItem` (`services/workspace.ts`).
  - `exportAsPDF` and `exportBuiltWord` (`services/share.ts`).
  - `openExternal` (`services/externalLinks.ts`).
  - `trackEvent` (`services/analytics.ts`).
- Produces:
  `virtualLabSavePayload(ws: WorksheetOutput, lessonId: string, ctx: { topic: string; subjectLabel: string; gradeName: string }): Omit<SavedMaterial, 'id' | 'savedAt' | 'isFavorite'>`.

- [ ] **Step 1: Write the failing test:**

```ts
describe('virtualLabSavePayload', () => {
  const ws = virtualLabWorksheet(sheet, sim, 'الطيف الذري');
  const p = virtualLabSavePayload(ws, sheet.lessonId, { topic: 'الطيف الذري', subjectLabel: 'الكيمياء', gradeName: 'الصف العاشر' });
  it('files it as a worksheet, marked as a virtual lab, on its lesson', () => {
    assert.equal(p.type, 'worksheet');
    assert.deepEqual(p.formState, { lessonId: sheet.lessonId, materialKind: 'virtual-lab' });
  });
  it('keeps the lab block in what it stores', () => {
    assert.deepEqual(JSON.parse(p.content).lab, ws.lab);
  });
  it('labels it with the lesson, subject and grade', () => {
    assert.deepEqual([p.title, p.topic, p.subject, p.grade, p.language], [ws.title, 'الطيف الذري', 'الكيمياء', 'الصف العاشر', 'ar']);
  });
});
```

- [ ] **Step 2: Run and watch it fail.**
- [ ] **Step 3: Implement.** `virtualLabSavePayload`:

```ts
export function virtualLabSavePayload(
  ws: WorksheetOutput, lessonId: string,
  ctx: { topic: string; subjectLabel: string; gradeName: string },
): Omit<SavedMaterial, 'id' | 'savedAt' | 'isFavorite'> {
  return {
    type: 'worksheet', title: ws.title, subject: ctx.subjectLabel, grade: ctx.gradeName,
    topic: ctx.topic, language: 'ar', content: JSON.stringify(ws),
    formState: { lessonId, materialKind: 'virtual-lab' },
  };
}
```

(Import `SavedMaterial` as a type only, so this file stays loadable by
`node --test`. If `workspace.ts` imports react-native at module scope, move
the type import to `import type`. A type-only import is erased.)

`VirtualLabCard.tsx` (props `{ lessonId: string; accent: string }`):
- `const lab = virtualLabFor(lessonId, { dev: __DEV__ })`. Return `null` when
  it is null.
- Header «🔬 مختبر افتراضي».
- Simulation name (`resource.titleAr` / `titleEn`), credit
  (`resource.attribution`), and the note `t('shelfLinkOnly')`.
- Button «افتح المحاكاة» → `trackEvent('virtual_lab_opened', { lessonId, surface: 'lesson' })`,
  then `openExternal(resource.sourceUrl)`.
- Teacher-only (`isTeacherRole(user?.role)`):
  - Button «ورقة العمل» opens `<ExportMenu>` with
    `copyChoice={{ value: copy, onChange: setCopy }}` (student by default).
    PDF → `exportAsPDF(docs.html, exportFilename(ws.title))`. Word →
    `exportBuiltWord(docs.word, exportFilename(ws.title))`. Share/copy →
    `docs.text`. `docs = worksheetExports(ws, ws.title, { subject, grade }, true, copy)`.
  - Button «احفظ في موادي» → `saveItem(virtualLabSavePayload(...))`, then a
    toast `t('savedSuccess')`.
- `ws = virtualLabWorksheet(lab.sheet, lab.resource, ctx.topic)`, with
  `ctx = resolveLessonPrepContext(lessonId, 'ar')`.

Follow `LessonShelfPanel`'s styling: `useColors`, `isRTL` row direction,
`ReadexPro`/`Almarai` fonts, accent-tinted pill.

Mount it in `lesson-detail.tsx` right after
`<LessonShelfPanel lessonId={lesson.id} accent={color} />`:
`<VirtualLabCard lessonId={lesson.id} accent={color} />`.

i18n keys (ar / en):
- `virtualLabTitle`: 'مختبر افتراضي' / 'Virtual lab'
- `virtualLabOpen`: 'افتح المحاكاة' / 'Open the simulation'
- `virtualLabSheet`: 'ورقة العمل' / 'Worksheet'
- `virtualLabSave`: 'احفظ في موادي' / 'Save to my materials'

- [ ] **Step 4: Run the full suite and the typecheck.**
- [ ] **Step 5: Commit.** `feat(mobile): virtual lab card on the lab lesson page`

---

### Task 7: Chat chip, and the «المحاكاة» block on screen in موادي

**Files:**
- Modify: `artifacts/mobile/services/lessonCopilot.ts` (`LessonSuggestion` ~68, `buildLessonSuggestions` ~676)
- Modify: `artifacts/mobile/services/virtualLab.ts` (add `virtualLabChatMessage`)
- Modify: `artifacts/mobile/app/(tabs)/iqra.tsx` (`handleLessonSuggestion` ~3032, the `buildLessonSuggestions(` call ~3228)
- Modify: `artifacts/mobile/app/workspace/view.tsx` (`WorksheetView` ~561)
- Test: `artifacts/mobile/services/__tests__/virtualLab.test.ts` (extend)

**Interfaces:**
- Produces:
  - `LessonSuggestion.action?: 'virtual-lab'`.
  - `buildLessonSuggestions(memory, lang, hasDocs, prep, opts?: { labs?: readonly VirtualLabSheet[]; dev?: boolean })`.
  - `virtualLabChatMessage(sheet, resource, ctx) => { text: string; prose: string; data: { kind: 'worksheet'; worksheet: WorksheetOutput }; meta: { title: string; subject: string; grade: string; lang: 'ar' } }`.

- [ ] **Step 1: Write the failing tests:**

```ts
import { buildLessonSuggestions, pinLesson } from '../lessonCopilot.ts';
import { emptyChatSessionMemory } from '../ai/teachingAssistant.ts';
import { getLessonById } from '../knowledgeBase.ts';

describe('the virtual lab chip', () => {
  const lab = getLessonById('kbl-chem-s1-nccd-u1_lab')!;
  const onLab = pinLesson(emptyChatSessionMemory(), lab, 'hard');
  const released = { ...sheet, reviewedBy: 'أ. معلم', reviewedAt: '2026-10-10' };
  it('leads the chips on a lab lesson with a released sheet', () => {
    const chips = buildLessonSuggestions(onLab, 'ar', false, {}, { labs: [released] });
    assert.equal(chips[0]!.action, 'virtual-lab');
    assert.equal(chips[0]!.lessonId, lab.id);
  });
  it('is absent while the sheet is unreviewed', () => {
    assert.ok(!buildLessonSuggestions(onLab, 'ar', false, {}, { labs: [sheet] }).some(c => c.action === 'virtual-lab'));
  });
  it('is absent on an ordinary lesson', () => {
    const other = pinLesson(emptyChatSessionMemory(), getLessonById('kbl-math-s2-nccd-u5_l4')!, 'hard');
    assert.ok(!buildLessonSuggestions(other, 'ar', false, {}, { labs: [released] }).some(c => c.action === 'virtual-lab'));
  });
});

describe('virtualLabChatMessage', () => {
  const m = virtualLabChatMessage(sheet, sim, { topic: 'الطيف الذري', subjectLabel: 'الكيمياء', gradeName: 'الصف العاشر' });
  it('is a worksheet message that carries the lab', () => {
    assert.equal(m.data.kind, 'worksheet');
    assert.equal(m.data.worksheet.lab?.url, sim.sourceUrl);
  });
  it('puts the link and the credit in the conversation around it', () => {
    assert.ok(m.prose.includes(sim.sourceUrl) && m.prose.includes(sim.attribution));
  });
});
```

- [ ] **Step 2: Run and watch them fail.**
- [ ] **Step 3: Implement.**
  - In `lessonCopilot.ts`, add `action?: 'virtual-lab'` to `LessonSuggestion`
    and the `opts` parameter. At the top of `buildLessonSuggestions`' `out`,
    when
    `releasedVirtualLab(lessonId ?? '', { labs: opts.labs, dev: opts.dev })`
    is non-null, `unshift`:
    `{ id: 'virtual-lab', emoji: '🔬', labelAr: 'المختبر الافتراضي', labelEn: 'Virtual lab', promptAr: '', promptEn: '', lessonId, action: 'virtual-lab' }`.
  - `virtualLabChatMessage` in `virtualLab.ts`:

```ts
export function virtualLabChatMessage(
  sheet: VirtualLabSheet, resource: ExternalResource,
  ctx: { topic: string; subjectLabel: string; gradeName: string },
) {
  const worksheet = virtualLabWorksheet(sheet, resource, ctx.topic);
  const prose = `هذه ورقة المختبر الافتراضي لدرس «${ctx.topic}». يفتح الطلبة المحاكاة على موقعها:\n${resource.sourceUrl}\n${resource.attribution}`;
  return {
    text: prose,
    prose,
    data: { kind: 'worksheet' as const, worksheet },
    meta: { title: worksheet.title, subject: ctx.subjectLabel, grade: ctx.gradeName, lang: 'ar' as const },
  };
}
```

  - In `iqra.tsx`:
    - Pass `{ dev: __DEV__ }` as the new last argument at the
      `buildLessonSuggestions(` call.
    - In `handleLessonSuggestion`, before `sendMessage`:

```ts
    if (s.action === 'virtual-lab' && s.lessonId) {
      const lab = virtualLabFor(s.lessonId, { dev: __DEV__ });
      const ctx = resolveLessonPrepContext(s.lessonId, 'ar');
      if (lab && ctx) {
        const m = virtualLabChatMessage(lab.sheet, lab.resource, ctx);
        trackEvent('virtual_lab_opened', { lessonId: s.lessonId, surface: 'chat' });
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: 'assistant', text: m.text,
          artifactData: m.data, artifactProse: m.prose, artifactMeta: m.meta, timestamp: new Date(),
        }]);
        return;
      }
    }
```

  - In `view.tsx` `WorksheetView`, after the instructions `<Text>`, when
    `ws.lab` is set, render a bordered block with:
    - the simulation name;
    - a `Pressable` URL that calls `openExternal(ws.lab.url)` and fires
      `trackEvent('virtual_lab_opened', { surface: 'workspace' })`;
    - the attribution;
    - the numbered steps (same row style as the worked-example steps above
      it).

- [ ] **Step 4: Run the full suite and the typecheck.**
- [ ] **Step 5: Commit.** `feat(mobile): virtual lab chip in chat, lab block in موادي`

---

### Task 8: Content: the confirmed simulations and the 7 sheets

**Blocked until each simulation URL is confirmed in a browser.** PhET's site
is blocked from the cloud environment. Either the user (or someone with a
browser) confirms each URL, or the user allows `phet.colorado.edu` in the
environment's network settings. For each lab, record:
- the confirmed HTML5 run URL (the Arabic `_ar.html` if one exists, else
  English);
- the simulation's exact Arabic title as PhET shows it;
- the licence page URL;
- the date checked.

Candidates (from the spec):

| Lesson | Candidate |
| --- | --- |
| `kbl-chem-s1-nccd-u1_lab` الطيف الذري | Models of the Hydrogen Atom |
| `kbl-chem-s1-nccd-u2_lab` نمذجة التوزيع الإلكتروني | Build an Atom |
| `kbl-chem-s1-nccd-u3_lab` الروابط في المركبات التساهمية | Molecule Shapes |
| `kbl-chem-s2-nccd-u4_lab` المعادلة الكيميائية | Balancing Chemical Equations |
| `kbl-chem-s2-nccd-u5_lab` الطاقة المرافقة للتفاعل | Reactions & Rates |
| `kbl-phys-s1-nccd-u1_lab` ناتج جمع قوتين عمليًا | Vector Addition |
| `kbl-phys-s1-nccd-u2_lab` وصف الحركة باستخدام المدرج الهوائي | The Moving Man |

**Files:**
- Modify: `lib/curriculum/src/data/external_resources.json` (append one entry per confirmed simulation)
- Modify: `lib/curriculum/src/virtualLabs.ts` (`VIRTUAL_LABS`)
- Test: `artifacts/mobile/services/__tests__/virtualLabContent.test.ts`

- [ ] **Step 1: Write the failing test** (it fails while `VIRTUAL_LABS` is
  empty and once any sheet is wrong):

```ts
import { VIRTUAL_LABS, validateVirtualLabs } from '../../../../lib/curriculum/src/virtualLabs.ts';
import { EXTERNAL_RESOURCES, isLicenseCheckStale } from '../../../../lib/curriculum/src/external.ts';
import { getLessonById } from '../knowledgeBase.ts';

describe('the shipped virtual labs', () => {
  it('has a sheet for every confirmed simulation, and only lab lessons', () => {
    assert.ok(VIRTUAL_LABS.length > 0);
    for (const l of VIRTUAL_LABS) {
      const lesson = getLessonById(l.lessonId);
      assert.ok(lesson, `${l.lessonId} is not a lesson`);
      assert.match(lesson!.titleAr, /^تجربة استهلالية/);
    }
  });
  it('is valid against the catalog', () => {
    assert.deepEqual(validateVirtualLabs(VIRTUAL_LABS, EXTERNAL_RESOURCES), []);
  });
  it('links to PhET simulations checked recently', () => {
    for (const l of VIRTUAL_LABS) {
      const r = EXTERNAL_RESOURCES.find(x => x.id === l.resourceId)!;
      assert.equal(r.provider, 'phet');
      assert.match(r.sourceUrl, /^https:\/\/phet\.colorado\.edu\/sims\/html\//);
      assert.ok(!isLicenseCheckStale(r), `${r.id} licence check is stale`);
    }
  });
  it('ships nothing as reviewed that was not', () => {
    for (const l of VIRTUAL_LABS) assert.equal(Boolean(l.reviewedAt), Boolean(l.reviewedBy));
  });
});
```

- [ ] **Step 2: Run and watch it fail** (`VIRTUAL_LABS.length > 0`).
- [ ] **Step 3: Add the catalog entries.** One per confirmed simulation:

```json
    {
      "id": "phet-build-an-atom",
      "lessonIds": ["kbl-chem-s1-nccd-u2_lab"],
      "gradeIds": ["grade-10"],
      "subjectId": "chemistry",
      "kind": "simulation",
      "titleEn": "Build an Atom",
      "titleAr": "<the Arabic title exactly as PhET shows it>",
      "provider": "phet",
      "license": "CC-BY-NC-4.0",
      "licenseUrl": "https://phet.colorado.edu/en/licensing",
      "sourceUrl": "<the confirmed run URL>",
      "attribution": "PhET Interactive Simulations, University of Colorado Boulder — phet.colorado.edu (CC BY-NC 4.0)",
      "licenseCheckedAt": "<the date confirmed>",
      "authority": "third-party"
    }
```

  Use `subjectId` `chemistry` or `physics`; check the exact ids in
  `SUBJECTS` (`lib/curriculum/src/catalog.ts`) first.

- [ ] **Step 4: Write the 7 sheets** in `VIRTUAL_LABS`. Rules for each:
  - The aim is one sentence tied to the unit.
  - `predict`: 1–2 prompts the student answers **before** opening the sim.
  - `procedure`: 3–6 concrete steps naming controls the sim actually has.
    Write them only against the confirmed sim, not from memory of an older
    version.
  - `observe`: 2–3 prompts naming exactly what to record.
  - `explain`: 2–3 questions that connect the observation to the unit's
    lessons (the KB's sibling lessons give the targets, e.g. «نظرية بور
    لذرة الهيدروجين» for u1).
  - `teacherKey`: the expected observation and a model answer for each
    prompt.
  - No `reviewedBy`/`reviewedAt`.

- [ ] **Step 5: Run until green**, then the full mobile and curriculum
  suites and the typecheck.
- [ ] **Step 6: Commit.** `content: virtual lab simulations and POE sheets (unreviewed)`

---

### Task 9: Verify in the running app, STATUS.md, PR

- [ ] **Step 1: Local stack** (Postgres + `pnpm run dev:api` +
  `pnpm run dev:mobile:web`). Seed a verified teacher as in PR #883's
  verification. `__DEV__` is true in the dev web build, so unreviewed
  sheets show.
- [ ] **Step 2:** Lesson page of `kbl-chem-s2-nccd-u4_lab`:
  - the card renders;
  - «افتح المحاكاة» opens the URL;
  - the student PDF has the lab block and QR, with no key, and its QR
    decodes to the URL;
  - the teacher Word file has the key;
  - «احفظ في موادي» saves it, and reopening shows the «المحاكاة» block.
- [ ] **Step 3:** Log in as a student account (or set the role) and confirm
  the card shows the sim link but no sheet buttons.
- [ ] **Step 4:** Chat on that lesson: the «🔬 المختبر الافتراضي» chip comes
  first, tapping it adds the sheet, and exporting it offers the copy choice.
- [ ] **Step 5:** An ordinary lesson shows no card and no chip.
- [ ] **Step 6:** Add a dated STATUS.md section covering:
  - what shipped;
  - the link-only licence position (PhET CC BY-NC, the GeoGebra precedent);
  - which labs have confirmed simulations;
  - that all sheets are **unreviewed and hidden in production** until a
    named teacher's review is recorded;
  - what was verified and what was not (Microsoft Word itself; a native
    build).

  Also update the «No lawfully embeddable simulation exists» note to say
  linking now ships.
- [ ] **Step 7:** Push and open a draft PR. Use the repo's PR conventions
  from PR #883.
