# External exam scanning — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher fill the paper-exam grid from photos of their exam paper, and scan a whole class of marked papers in one sitting with each paper matched to its student by the name written on it.

**Architecture:** Two stateless, write-nothing api-server routes return *proposals* (`POST /evaluations/scan-paper`, `POST /evaluations/:id/scan-class-paper`); the phone sends one photo per request three at a time; every decision that protects a child's marks is a pure function with tests (`scanRequest`, `scanPaper`, `studentMatch` on the server; `classScanRunner`, `classScanReview`, `classScanSave` on the client). Saving goes through the existing start-attempt, mark and submit endpoints — no new writer.

**Tech Stack:** Express + Drizzle (api-server), Expo / React Native web (mobile), `node --test` with `--experimental-strip-types`, OpenAI vision via the existing `openai` client and `lib/aiBudget.ts`.

**Spec:** `docs/superpowers/specs/2026-10-14-external-exam-scanning-design.md` (read its «Amendments» section: the setup route is `POST /evaluations/scan-paper`, stateless, not `/:id/`).

## Global Constraints

Every task's requirements include these. Values are copied from the spec.

- **Scans write nothing.** Both routes answer `saved: false`; no insert/update/delete in either handler (`scanRoutes.test.ts` pins this). Photos are not stored anywhere.
- **Under-claim everywhere:** an unreadable mark is absent/`null`, never zero; an out-of-range number is dropped, never clamped; an objective/competency outside the allowed set is `null`; a name match is `confident` **only** on an exact normalized full-name match to **exactly one** roster student, otherwise `confirm` (never assigned without a tap) or `none`.
- **The roster never goes to the model.** Matching is server-side (`studentMatch.ts`).
- **Limits:** setup takes 1–4 photos and 1–100 objective ids; a class batch takes ≤ **40** photos, **3** in flight; 8,000,000 chars per photo (base64), setup total ≤ 10,000,000; `MAX_QUESTIONS` = 50 per grid; new limiter `ai-scan-class` = 30 requests / 60 s / user.
- **Batch save never writes into a paper it did not create** (`startAttemptChecked().created === false` → skip) and **a retry never calls `startAttempt` again** (the row remembers `attemptId`).
- **Arabic first.** Every server `code` the screens can receive maps to an Arabic sentence (`scanErrors.ts`). Imperative «اقرأ» is written «اقرَأ» (`i18nTerminology.test.ts`). Font sizes come from `TYPE` in `constants/theme.ts` — 11, 13, 14, 15, 17, 20, 24, 28, 32 (`designScale.test.ts` is a ratchet; do not raise its ceiling).
- **No native module is added** (`expo-image-picker` already supports multi-select), so `app.json`'s `version` is **not** bumped.
- **Files loaded directly by `node --test` use explicit `.ts` import extensions**; extensionless relative imports only work through esbuild. Mobile tests must live in `services/__tests__/`; api-server tests anywhere under `src/**/__tests__/`.
- `DEMO_MODE` in `artifacts/mobile/services/ai/demoMode.ts` is **not touched**.
- Commit to branch `claude/peaceful-archimedes-1l5kjz`; do not push to another branch.

## Baselines (measured 2026-10-14, clean checkout + `pnpm install --frozen-lockfile`)

| Suite | Before | After this plan |
| --- | --- | --- |
| `artifacts/api-server` `pnpm test` | 1577 pass, 0 fail (mount-order suite skipped: no bundle) | **1691 pass**, 0 fail — with `pnpm build` done first, which also makes the 54 mount-order tests run (1691 = 1577 + 47 new unit tests + 13 source tests + 54 mount-order tests) |
| `artifacts/mobile` `pnpm test` | 4211 pass, 0 fail, 10 skipped | **4260 pass**, 0 fail, 10 skipped |
| `pnpm run typecheck` (repo root) | clean | clean |

Run the root typecheck from the **repo root** (`/home/user/Iqraa`): it first builds the shared libs (`tsc --build`). Run from inside `artifacts/api-server` alone it fails with `TS6305` on `lib/db`, which is not a code error.

## File map

| File | Responsibility |
| --- | --- |
| `api-server/src/modules/assessment/scanRequest.ts` (new) | Pure request checks: one photo, the setup body, the class-scan gate |
| `api-server/src/modules/assessment/scanPaper.ts` (new) | Prompt + parser for reading an exam paper into grid rows |
| `api-server/src/modules/assessment/studentMatch.ts` (new) | Name → roster match, `confident`/`confirm`/`none` |
| `api-server/src/modules/assessment/scanMarks.ts` (edit) | `readName` option on the existing prompt; `parseNameRead`, `parseTotalRead` |
| `api-server/src/routes/evaluations.ts` (edit) | The two new routes, `scanLimiter`, `respondScanError`, `scanRoster` |
| `mobile/services/evaluations.ts` (edit) | `scanPaper`, `scanClassPaper`, `startAttemptChecked` + response types |
| `mobile/services/scanErrors.ts` (new) | Error → Arabic-key mapping; which errors stop a batch / are retryable |
| `mobile/services/paperScan.ts` (new) | Scanned rows → grid rows; blank count; total mismatch |
| `mobile/services/classScanRunner.ts` (new) | 3-at-a-time sender with 429 retry and stop-on-allowance |
| `mobile/services/classScanReview.ts` (new) | Review-table rules: blockers, flags, totals |
| `mobile/services/classScanSave.ts` (new) | The save loop and its two `startAttempt` safeguards |
| `mobile/services/documents/pick.ts`, `services/i18n.ts`, `app/evaluations/new.tsx` (edit) | Multi-photo picker, all new strings, the "read from photo" button on the paper grid |
| `mobile/app/evaluations/[id]/scan-class.tsx` (new), `[id]/index.tsx` (edit) | The class-scan screen and its entry button |

All `api-server/...` and `mobile/...` paths are under `artifacts/`.

---

## Part A — api-server

### Task 1: Request checks

**Files:**
- Create: `artifacts/api-server/src/modules/assessment/scanRequest.ts`
- Test: `artifacts/api-server/src/modules/assessment/__tests__/scanRequest.test.ts`

**Interfaces:**
- Produces: `MAX_SCAN_IMAGE_CHARS`, `MAX_SETUP_IMAGES`, `MAX_SETUP_TOTAL_CHARS`, `MAX_SETUP_OBJECTIVES`; `interface ScanRefusal { status: number; error: string; code: string }`; `checkScanImage(image: unknown): ScanRefusal | null`; `parsePaperScanBody(body: unknown): { ok: true; images: string[]; objectiveIds: string[] } | { ok: false; refusal: ScanRefusal }`; `classScanGate(evaluation: { status: string; classGroupId: string | null }): ScanRefusal | null`. Task 5 calls all three.

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/modules/assessment/__tests__/scanRequest.test.ts`:

````ts
/**
 * The refusals that happen before a photograph is allowed to cost anything.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SCAN_IMAGE_CHARS,
  MAX_SETUP_IMAGES,
  MAX_SETUP_OBJECTIVES,
  checkScanImage,
  classScanGate,
  parsePaperScanBody,
} from "../scanRequest.ts";

const PHOTO = "data:image/jpeg;base64,AAAA";

describe("checkScanImage", () => {
  it("accepts a data URL image", () => {
    assert.equal(checkScanImage(PHOTO), null);
  });

  it("refuses anything that is not a data URL image", () => {
    for (const bad of [undefined, null, 5, "", "https://x/y.jpg", "data:text/plain;base64,AA", {}]) {
      assert.equal(checkScanImage(bad)?.code, "bad_image", JSON.stringify(bad));
      assert.equal(checkScanImage(bad)?.status, 400);
    }
  });

  it("refuses an oversized photo with advice, not a generic error", () => {
    const huge = "data:image/jpeg;base64," + "A".repeat(MAX_SCAN_IMAGE_CHARS);
    const refusal = checkScanImage(huge);
    assert.equal(refusal?.status, 413);
    assert.equal(refusal?.code, "image_too_large");
  });
});

describe("parsePaperScanBody", () => {
  it("accepts one to four photos and a list of objectives", () => {
    const res = parsePaperScanBody({ images: [PHOTO, PHOTO], objectiveIds: ["o1", "o2"] });
    assert.ok(res.ok);
    if (res.ok) {
      assert.equal(res.images.length, 2);
      assert.deepEqual(res.objectiveIds, ["o1", "o2"]);
    }
  });

  it("refuses no photos, too many photos, and a non-list", () => {
    for (const images of [[], Array(MAX_SETUP_IMAGES + 1).fill(PHOTO), "x", undefined]) {
      const res = parsePaperScanBody({ images, objectiveIds: ["o1"] });
      assert.equal(res.ok, false);
      if (!res.ok) assert.equal(res.refusal.code, "bad_image");
    }
  });

  it("refuses a bad photo anywhere in the list", () => {
    const res = parsePaperScanBody({ images: [PHOTO, "nope"], objectiveIds: ["o1"] });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.refusal.code, "bad_image");
  });

  it("refuses photos that are each fine but too large together", () => {
    // Three at 3.6M each: every one under the per-photo cap, 10.8M altogether.
    const big = "data:image/jpeg;base64," + "A".repeat(3_600_000);
    const res = parsePaperScanBody({ images: [big, big, big], objectiveIds: ["o1"] });
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.refusal.code, "image_too_large");
  });

  it("refuses missing, empty, blank-entry and over-long objective lists", () => {
    const base = { images: [PHOTO] };
    for (const objectiveIds of [
      undefined,
      [],
      ["o1", "  "],
      ["o1", 7],
      Array.from({ length: MAX_SETUP_OBJECTIVES + 1 }, (_, i) => `o${i}`),
    ]) {
      const res = parsePaperScanBody({ ...base, objectiveIds });
      assert.equal(res.ok, false, JSON.stringify(objectiveIds));
      if (!res.ok) assert.equal(res.refusal.code, "bad_objectives");
    }
  });

  it("de-duplicates and trims objective ids", () => {
    const res = parsePaperScanBody({ images: [PHOTO], objectiveIds: [" o1 ", "o1", "o2"] });
    assert.ok(res.ok);
    if (res.ok) assert.deepEqual(res.objectiveIds, ["o1", "o2"]);
  });

  it("survives a body that is not an object", () => {
    for (const body of [null, undefined, "x", 3, []]) {
      assert.equal(parsePaperScanBody(body).ok, false);
    }
  });
});

describe("classScanGate", () => {
  it("lets a published exam with a class through", () => {
    assert.equal(classScanGate({ status: "published", classGroupId: "c1" }), null);
  });

  it("refuses a draft or closed exam", () => {
    for (const status of ["draft", "closed"]) {
      const r = classScanGate({ status, classGroupId: "c1" });
      assert.equal(r?.status, 409);
      assert.equal(r?.code, "not_published");
    }
  });

  it("refuses an exam with no class — there is no roster to match against", () => {
    const r = classScanGate({ status: "published", classGroupId: null });
    assert.equal(r?.status, 409);
    assert.equal(r?.code, "no_class");
  });
});
````

- [ ] **Step 2: Run it to verify it fails**

```bash
cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/scanRequest.test.ts
```
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../scanRequest.ts`.

- [ ] **Step 3: Implement**

Create `artifacts/api-server/src/modules/assessment/scanRequest.ts`:

````ts
/**
 * Request checks for the evaluation-level scan routes.
 *
 * Both routes take photographs of minors' papers and spend model budget, so
 * every refusal has to happen before either is touched. They are pure
 * functions for the same reason `scanMarks.ts` is: the route files import the
 * database and the OpenAI client at module scope, which `node --test` cannot
 * load, so a decision made inline in a handler is a decision with no test.
 *
 * `MAX_SCAN_IMAGE_CHARS` repeats the figure `POST /attempts/:id/scan-marks`
 * uses (8MB of base64). That route is left alone on purpose; if one number
 * ever has to change, change both.
 */

export const MAX_SCAN_IMAGE_CHARS = 8_000_000;
/** An exam paper is rarely one page; more than four is a different feature. */
export const MAX_SETUP_IMAGES = 4;
/** Under `express.json`'s 12MB ceiling (app.ts), with room for the rest of the body. */
export const MAX_SETUP_TOTAL_CHARS = 10_000_000;
export const MAX_SETUP_OBJECTIVES = 100;

export interface ScanRefusal {
  status: number;
  error: string;
  code: string;
}

const TOO_LARGE: ScanRefusal = {
  status: 413,
  error: "That photo is too large. Take it again at a lower quality.",
  code: "image_too_large",
};

/** One photograph, as a data URL. Null means acceptable. */
export function checkScanImage(image: unknown): ScanRefusal | null {
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return { status: 400, error: "image must be a data URL", code: "bad_image" };
  }
  if (image.length > MAX_SCAN_IMAGE_CHARS) return TOO_LARGE;
  return null;
}

export type PaperScanBody =
  | { ok: true; images: string[]; objectiveIds: string[] }
  | { ok: false; refusal: ScanRefusal };

const refuse = (status: number, error: string, code: string): PaperScanBody => ({
  ok: false,
  refusal: { status, error, code },
});

/**
 * Body of `POST /evaluations/scan-paper`: the pages of an exam the teacher set,
 * and the objectives they have picked in the form. The evaluation does not
 * exist yet (the grid is saved together with it), so the objectives travel in
 * the body instead of being read off a row.
 */
export function parsePaperScanBody(body: unknown): PaperScanBody {
  const root = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const images = root["images"];
  if (!Array.isArray(images) || images.length === 0 || images.length > MAX_SETUP_IMAGES) {
    return refuse(400, `Send between 1 and ${MAX_SETUP_IMAGES} photos`, "bad_image");
  }
  let total = 0;
  for (const image of images) {
    const bad = checkScanImage(image);
    if (bad) return { ok: false, refusal: bad };
    total += (image as string).length;
  }
  if (total > MAX_SETUP_TOTAL_CHARS) return { ok: false, refusal: TOO_LARGE };

  const ids = root["objectiveIds"];
  if (!Array.isArray(ids)) {
    return refuse(400, "objectiveIds must be a list", "bad_objectives");
  }
  const trimmed = ids.map(v => (typeof v === "string" ? v.trim() : ""));
  // A blank entry is a client bug, not something to drop quietly: dropping it
  // would let the model be asked about fewer objectives than the teacher ticked.
  if (trimmed.some(v => v === "")) {
    return refuse(400, "objectiveIds must be non-empty strings", "bad_objectives");
  }
  const objectiveIds = [...new Set(trimmed)];
  if (objectiveIds.length === 0 || objectiveIds.length > MAX_SETUP_OBJECTIVES) {
    return refuse(
      400,
      `Choose between 1 and ${MAX_SETUP_OBJECTIVES} objectives`,
      "bad_objectives",
    );
  }

  return { ok: true, images: images as string[], objectiveIds };
}

/**
 * Whether a class can be scanned for this exam at all.
 *
 * Attempts only exist on a published exam, and the class is the roster the
 * student's name is matched against. An exam with no class has nobody to match.
 */
export function classScanGate(evaluation: {
  status: string;
  classGroupId: string | null;
}): ScanRefusal | null {
  if (evaluation.status !== "published") {
    return {
      status: 409,
      error: "Publish this evaluation before scanning papers",
      code: "not_published",
    };
  }
  if (!evaluation.classGroupId) {
    return {
      status: 409,
      error: "Attach this exam to a class first — the class is the roster papers are matched against",
      code: "no_class",
    };
  }
  return null;
}
````

- [ ] **Step 4: Run it to verify it passes**

Same command. Expected: `# tests 13`, `# pass 13`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/modules/assessment/scanRequest.ts artifacts/api-server/src/modules/assessment/__tests__/scanRequest.test.ts
git commit -m "api: request checks for the exam-scan routes"
```

---

### Task 2: Reading an exam paper into grid rows

**Files:**
- Create: `artifacts/api-server/src/modules/assessment/scanPaper.ts`
- Test: `artifacts/api-server/src/modules/assessment/__tests__/scanPaper.test.ts`

**Interfaces:**
- Consumes: `COMPETENCY_KEYS`, `CompetencyKey` (`./competency.ts`); `MAX_MARKS_PER_QUESTION` (`./paperExam.ts`); `parseArabicNumber` (`./scanMarks.ts`).
- Produces: `MAX_SCANNED_QUESTIONS` (50); `interface ScanObjective { id: string; label: string }`; `interface PaperScanRow { number: number; marks: number | null; objectiveId: string | null; competencyKey: CompetencyKey | null; readAs: string }`; `interface PaperScanResult { rows: PaperScanRow[]; printedTotal: number | null; skipped: { number: number; reason: string }[] }`; `buildPaperScanPrompt(objectives: readonly ScanObjective[]): { system: string; user: string }`; `parsePaperScanResponse(raw: unknown, allowedObjectiveIds: readonly string[]): PaperScanResult`. Task 5 calls both.

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/modules/assessment/__tests__/scanPaper.test.ts`:

````ts
/**
 * Reading an exam paper to fill the grid.
 *
 * Same question as scanMarks.test.ts, asked of a different number: when the
 * reading is uncertain, does the result under-claim? Here the number is a
 * question's ceiling, so a confident wrong one skews every student's score.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SCANNED_QUESTIONS,
  buildPaperScanPrompt,
  parsePaperScanResponse,
} from "../scanPaper.ts";

const IDS = ["obj-a", "obj-b"];

const q = (over: Record<string, unknown> = {}) => ({
  number: 1,
  marks: 5,
  readAs: "5",
  objectiveId: "obj-a",
  competency: "knowledge",
  ...over,
});

describe("buildPaperScanPrompt", () => {
  it("says it is reading, not setting, a paper", () => {
    const { system } = buildPaperScanPrompt([{ id: "obj-a", label: "x" }]);
    assert.match(system, /reading, not setting, a paper/);
    assert.match(system, /Never invent a question/);
  });

  it("says null beats a guessed mark", () => {
    assert.match(buildPaperScanPrompt([]).system, /Null is always better than a guess/);
  });

  it("lists every objective with its id so the model can only choose from them", () => {
    const { user } = buildPaperScanPrompt([
      { id: "obj-a", label: "يحلّ معادلة" },
      { id: "obj-b", label: "يرسم دالة" },
    ]);
    assert.match(user, /obj-a — يحلّ معادلة/);
    assert.match(user, /obj-b — يرسم دالة/);
  });
});

describe("parsePaperScanResponse", () => {
  it("accepts a clean reading", () => {
    const res = parsePaperScanResponse(
      { printedTotal: 15, questions: [q(), q({ number: 2, marks: 10, readAs: "١٠", objectiveId: "obj-b", competency: "application" })] },
      IDS,
    );
    assert.equal(res.rows.length, 2);
    assert.deepEqual(res.rows[1], {
      number: 2, marks: 10, objectiveId: "obj-b", competencyKey: "application", readAs: "١٠",
    });
    assert.equal(res.printedTotal, 15);
    assert.deepEqual(res.skipped, []);
  });

  it("never turns an unreadable mark into a number", () => {
    for (const marks of [null, undefined, "مطموس", "", {}]) {
      const res = parsePaperScanResponse({ questions: [q({ marks })] }, IDS);
      assert.equal(res.rows[0]!.marks, null, JSON.stringify(marks));
      assert.match(res.skipped[0]!.reason, /could not read/);
    }
  });

  it("drops marks the grid would refuse instead of clamping them", () => {
    for (const marks of [0, -2, 101, 5000]) {
      const res = parsePaperScanResponse({ questions: [q({ marks })] }, IDS);
      assert.equal(res.rows[0]!.marks, null, String(marks));
      assert.match(res.skipped[0]!.reason, /not a usable mark/);
    }
  });

  it("reads Arabic-Indic digits and half marks", () => {
    const res = parsePaperScanResponse(
      { questions: [q({ marks: "٢٫٥", readAs: "٢٫٥" }), q({ number: "٢", marks: "1½" })] },
      IDS,
    );
    assert.equal(res.rows[0]!.marks, 2.5);
    assert.equal(res.rows[1]!.marks, 1.5);
  });

  it("nulls an objective that was not in the list it was given", () => {
    const res = parsePaperScanResponse({ questions: [q({ objectiveId: "obj-elsewhere" })] }, IDS);
    assert.equal(res.rows[0]!.objectiveId, null);
  });

  it("nulls a competency that is not one of the four", () => {
    for (const competency of ["recall", "", null, 3, "Knowledge"]) {
      const res = parsePaperScanResponse({ questions: [q({ competency })] }, IDS);
      assert.equal(res.rows[0]!.competencyKey, null, JSON.stringify(competency));
    }
  });

  it("keeps row N as question N when the pages skip a number", () => {
    const res = parsePaperScanResponse(
      { questions: [q(), q({ number: 2 }), q({ number: 4 })] },
      IDS,
    );
    assert.deepEqual(res.rows.map(r => r.number), [1, 2, 3, 4]);
    assert.deepEqual(
      { marks: res.rows[2]!.marks, objectiveId: res.rows[2]!.objectiveId, competencyKey: res.rows[2]!.competencyKey },
      { marks: null, objectiveId: null, competencyKey: null },
    );
    assert.deepEqual(res.skipped.map(s => s.number), [3]);
  });

  it("takes only the first reading when a question appears twice", () => {
    const res = parsePaperScanResponse({ questions: [q({ marks: 4 }), q({ marks: 9 })] }, IDS);
    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0]!.marks, 4);
  });

  it("ignores non-questions: bad numbers, non-objects", () => {
    const res = parsePaperScanResponse(
      { questions: [q({ number: 0 }), q({ number: -1 }), q({ number: 1.5 }), q({ number: "x" }), "text", null, q({ number: 1 })] },
      IDS,
    );
    assert.deepEqual(res.rows.map(r => r.number), [1]);
  });

  it("cuts a paper at the grid's ceiling and says so", () => {
    const many = Array.from({ length: MAX_SCANNED_QUESTIONS + 3 }, (_, i) => q({ number: i + 1 }));
    const res = parsePaperScanResponse({ questions: many }, IDS);
    assert.equal(res.rows.length, MAX_SCANNED_QUESTIONS);
    assert.ok(res.skipped.some(s => s.number === MAX_SCANNED_QUESTIONS + 1));
  });

  it("reports no total unless it is a positive number", () => {
    for (const printedTotal of [null, undefined, 0, -3, "غير واضح"]) {
      assert.equal(parsePaperScanResponse({ questions: [q()], printedTotal }, IDS).printedTotal, null);
    }
    assert.equal(parsePaperScanResponse({ questions: [q()], printedTotal: "٤٠" }, IDS).printedTotal, 40);
  });

  it("returns nothing for an unusable response", () => {
    for (const raw of [null, undefined, {}, { questions: "no" }, [], "text"]) {
      const res = parsePaperScanResponse(raw, IDS);
      assert.deepEqual(res.rows, [], JSON.stringify(raw));
    }
  });
});
````

- [ ] **Step 2: Run it to verify it fails**

```bash
cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/scanPaper.test.ts
```
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../scanPaper.ts`.

- [ ] **Step 3: Implement**

Create `artifacts/api-server/src/modules/assessment/scanPaper.ts`:

````ts
/**
 * Reading an exam paper the teacher set, to fill the paper-exam grid.
 *
 * A paper exam is one row per question — marks, objective, competency — and
 * the teacher already has all three in front of them on the paper. This reads
 * the pages and proposes the rows; it saves nothing. The proposals pre-fill a
 * grid the teacher edits, and the existing `PUT /evaluations/:id/questions/paper`
 * (`parsePaperRows`) is still what validates and stores them.
 *
 * Built to under-claim, like `scanMarks.ts`, and for the same reason: a wrong
 * reading does not throw. A mark that is wrong here becomes the ceiling every
 * student's score on that question is measured against.
 *
 * - A mark it cannot read is **null**, never a default.
 * - A mark outside what `parsePaperRows` would accept is **null**, not clamped.
 * - An objective the model names that is not in the list it was given is
 *   **null**; the server does not take the model's word for what exists.
 * - A competency is a *suggestion*. `paperExam.ts` is explicit that a question's
 *   cognitive demand is the teacher's choice, so this is pre-filled and badged
 *   in the grid, never silently decided.
 * - A question number the pages skip becomes a **blank row**, so row N in the
 *   grid is question N on the paper.
 */
import { COMPETENCY_KEYS, type CompetencyKey } from "./competency.ts";
import { MAX_MARKS_PER_QUESTION } from "./paperExam.ts";
import { parseArabicNumber } from "./scanMarks.ts";

/** Same ceiling as the grid (`MAX_QUESTIONS` in routes/evaluations.ts). */
export const MAX_SCANNED_QUESTIONS = 50;

export interface ScanObjective {
  id: string;
  /** Arabic wording where there is one — what the paper's teacher would recognise. */
  label: string;
}

export interface PaperScanRow {
  /** 1-based, as printed. */
  number: number;
  marks: number | null;
  objectiveId: string | null;
  competencyKey: CompetencyKey | null;
  /** The characters the model reports seeing for the marks, for the teacher to compare. */
  readAs: string;
}

export interface PaperScanResult {
  rows: PaperScanRow[];
  /** The total the paper prints for itself ("المجموع 40"), when it prints one. */
  printedTotal: number | null;
  skipped: { number: number; reason: string }[];
}

export function buildPaperScanPrompt(objectives: readonly ScanObjective[]): {
  system: string;
  user: string;
} {
  const system = [
    "You read an exam paper from photographs of its pages, to list its questions.",
    "",
    "You are reading, not setting, a paper. Never invent a question, never guess a",
    "mark, and never continue a question that is not on the pages.",
    "",
    "For each question report:",
    "- number: the question number as printed",
    "- marks: what the question is worth, as printed",
    "- readAs: the characters you saw for the marks, exactly as written",
    "- objectiveId: the id of the ONE learning objective in the list that the",
    "  question measures, or null if none clearly fits",
    "- competency: knowledge, understanding, application or critical_thinking,",
    "  or null if you are unsure",
    "",
    "Rules:",
    "1. If the pages do not state a question's marks, or you cannot read them with",
    "   confidence, set marks to null. Null is always better than a guess — the",
    "   marks become the ceiling every student is scored against.",
    "2. If a question is split into parts that each carry marks and no total is",
    "   printed for the question, report the sum and put the parts in readAs",
    '   (for example "2+3").',
    "3. Choose objectiveId only from the list you are given. Never invent an id.",
    "   null is better than a poor fit.",
    "4. Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) and Western digits mean the same thing.",
    "   Report numbers as numbers.",
    "5. If the paper prints its own total (for example المجموع ٤٠), report it as",
    "   printedTotal; otherwise null.",
    "",
    'Return JSON only: {"printedTotal":40,"questions":[{"number":1,"marks":5,"readAs":"٥","objectiveId":"<id from the list>","competency":"knowledge"}]}',
    "No prose, no markdown fence.",
  ].join("\n");

  const list = objectives.map(o => `  ${o.id} — ${o.label}`).join("\n");
  const user = [
    "Learning objectives (choose objectiveId only from these):",
    list,
    "",
    "The photographs are the pages of the paper, in order.",
    "List every question on them, in order.",
  ].join("\n");

  return { system, user };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function parsePaperScanResponse(
  raw: unknown,
  allowedObjectiveIds: readonly string[],
): PaperScanResult {
  const root = asRecord(raw);
  const list = Array.isArray(root?.["questions"]) ? (root!["questions"] as unknown[]) : [];

  const byNumber = new Map<number, PaperScanRow>();
  const skipped: { number: number; reason: string }[] = [];

  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;

    const number = parseArabicNumber(row["number"]);
    if (number === null || !Number.isInteger(number) || number < 1) continue;
    if (number > MAX_SCANNED_QUESTIONS) {
      skipped.push({ number, reason: `a paper exam holds at most ${MAX_SCANNED_QUESTIONS} questions` });
      continue;
    }
    // The first reading of a question wins, as in `parseScanResponse`.
    if (byNumber.has(number)) continue;

    let marks: number | null = null;
    const value = parseArabicNumber(row["marks"]);
    if (value === null) {
      skipped.push({ number, reason: "could not read the marks" });
    } else if (!(value > 0) || value > MAX_MARKS_PER_QUESTION) {
      // Rejected, not clamped: the same rule `parsePaperRows` enforces on save,
      // applied early so a misread 50 never reaches the grid looking plausible.
      skipped.push({ number, reason: `read ${value}, which is not a usable mark` });
    } else {
      marks = round2(value);
    }

    const objective = typeof row["objectiveId"] === "string" ? row["objectiveId"].trim() : "";
    const competency = row["competency"];

    byNumber.set(number, {
      number,
      marks,
      objectiveId: allowedObjectiveIds.includes(objective) ? objective : null,
      competencyKey: COMPETENCY_KEYS.includes(competency as CompetencyKey)
        ? (competency as CompetencyKey)
        : null,
      readAs: typeof row["readAs"] === "string" ? row["readAs"] : "",
    });
  }

  // Row N must be question N. A number the pages skipped becomes a blank row
  // rather than shifting every later question up by one.
  const highest = byNumber.size === 0 ? 0 : Math.max(...byNumber.keys());
  const rows: PaperScanRow[] = [];
  for (let n = 1; n <= highest; n++) {
    const found = byNumber.get(n);
    if (found) {
      rows.push(found);
    } else {
      rows.push({ number: n, marks: null, objectiveId: null, competencyKey: null, readAs: "" });
      skipped.push({ number: n, reason: "no question found on the pages" });
    }
  }
  skipped.sort((a, b) => a.number - b.number);

  const total = parseArabicNumber(root?.["printedTotal"]);
  return {
    rows,
    printedTotal: total !== null && total > 0 ? round2(total) : null,
    skipped,
  };
}
````

- [ ] **Step 4: Run it to verify it passes**

Same command. Expected: `# tests 15`, `# pass 15`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/modules/assessment/scanPaper.ts artifacts/api-server/src/modules/assessment/__tests__/scanPaper.test.ts
git commit -m "api: read an exam paper into paper-grid rows, under-claiming"
```

---

### Task 3: Matching a written name to the roster

**Files:**
- Create: `artifacts/api-server/src/modules/assessment/studentMatch.ts`
- Test: `artifacts/api-server/src/modules/assessment/__tests__/studentMatch.test.ts`

**Interfaces:**
- Consumes: `normalizeArabic` from `@workspace/curriculum` (the single shared normaliser — do not write another).
- Produces: `interface RosterEntry { studentId: string; displayName: string; hasAttempt: boolean }`; `interface MatchCandidate { studentId: string; displayName: string; score: number; hasAttempt: boolean }`; `type MatchStatus = "confident" | "confirm" | "none"`; `interface StudentMatch { status: MatchStatus; studentId: string | null; candidates: MatchCandidate[] }`; `MIN_CANDIDATE_SCORE` (0.5), `MAX_CANDIDATES` (3); `matchStudent(nameRead: string | null | undefined, roster: readonly RosterEntry[]): StudentMatch`. Task 5 calls `matchStudent` and builds `RosterEntry[]`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/modules/assessment/__tests__/studentMatch.test.ts`:

````ts
/**
 * Matching a name off a photograph to a roster.
 *
 * The question every test here asks: when it is not certain, does it refuse to
 * pick? A wrong `confident` puts one child's marks on another and nothing
 * downstream can tell.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_CANDIDATES, matchStudent, type RosterEntry } from "../studentMatch.ts";

const r = (studentId: string, displayName: string, hasAttempt = false): RosterEntry => ({
  studentId, displayName, hasAttempt,
});

const CLASS = [
  r("s1", "سارة أحمد علي"),
  r("s2", "محمد خالد"),
  r("s3", "ليلى حسن"),
];

describe("matchStudent — confident", () => {
  it("is confident on an exact full-name match", () => {
    const m = matchStudent("محمد خالد", CLASS);
    assert.equal(m.status, "confident");
    assert.equal(m.studentId, "s2");
  });

  it("ignores the differences between two spellings of one name", () => {
    // hamza, ta marbuta, ya/alef maqsura, diacritics, tatweel, punctuation, spacing.
    const roster = [r("s1", "أحمد عبد الرحمن"), r("s2", "ليلى")];
    for (const written of ["احمد عبد الرحمن", "أَحْمَد  عبد  الرحمن", "احـمد عبد الرحمن.", "إحمد عبد الرحمن"]) {
      const m = matchStudent(written, roster);
      assert.equal(m.studentId, "s1", written);
      assert.equal(m.status, "confident", written);
    }
    assert.equal(matchStudent("ليلي", roster).studentId, "s2");
  });

  it("is confident for a single-name roster row that is unique", () => {
    assert.equal(matchStudent("ليلى", [r("a", "ليلى"), r("b", "سارة")]).status, "confident");
  });
});

describe("matchStudent — never guesses", () => {
  it("is NEVER confident when two students share the name", () => {
    const twins = [r("a", "محمد خالد"), r("b", "محمد خالد"), r("c", "سارة")];
    const m = matchStudent("محمد خالد", twins);
    assert.equal(m.status, "confirm");
    assert.equal(m.studentId, null);
    assert.deepEqual(m.candidates.map(c => c.studentId).sort(), ["a", "b"]);
  });

  it("asks for a tap when only a first name was read", () => {
    const m = matchStudent("سارة", CLASS);
    assert.equal(m.status, "confirm");
    assert.equal(m.studentId, null);
    assert.equal(m.candidates[0]!.studentId, "s1");
  });

  it("asks for a tap when two roster students share the first name", () => {
    const roster = [r("a", "سارة أحمد"), r("b", "سارة محمود")];
    const m = matchStudent("سارة", roster);
    assert.equal(m.status, "confirm");
    assert.equal(m.candidates.length, 2);
  });

  it("asks for a tap on a partial or misspelt name instead of choosing", () => {
    const m = matchStudent("سارة احمد", CLASS);
    assert.equal(m.status, "confirm");
    assert.equal(m.candidates[0]!.studentId, "s1");
    assert.ok(m.candidates[0]!.score < 1);
  });

  it("is none for a name nothing resembles", () => {
    for (const written of ["يوسف إبراهيم", "x", "12345"]) {
      const m = matchStudent(written, CLASS);
      assert.equal(m.status, "none", written);
      assert.equal(m.studentId, null);
      assert.deepEqual(m.candidates, []);
    }
  });

  it("is none for no name, and for an empty roster", () => {
    for (const written of [null, undefined, "", "   ", "،.؛"]) {
      assert.equal(matchStudent(written, CLASS).status, "none", JSON.stringify(written));
    }
    assert.equal(matchStudent("محمد خالد", []).status, "none");
  });
});

describe("matchStudent — candidates", () => {
  it("offers at most three, best first", () => {
    const roster = ["a", "b", "c", "d", "e"].map(id => r(id, `سارة ${id}`));
    const m = matchStudent("سارة", roster);
    assert.equal(m.candidates.length, MAX_CANDIDATES);
    const scores = m.candidates.map(c => c.score);
    assert.deepEqual([...scores].sort((x, y) => y - x), scores);
  });

  it("carries hasAttempt through so the screen can warn before saving", () => {
    const m = matchStudent("محمد خالد", [r("s2", "محمد خالد", true)]);
    assert.equal(m.status, "confident");
    assert.equal(m.candidates[0]!.hasAttempt, true);
  });
});
````

- [ ] **Step 2: Run it to verify it fails**

```bash
cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/studentMatch.test.ts
```
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../studentMatch.ts`.

- [ ] **Step 3: Implement**

Create `artifacts/api-server/src/modules/assessment/studentMatch.ts`:

````ts
/**
 * Matching the name written on a photographed paper to a student on the roster.
 *
 * The model only *transcribes* the name; this decides what it means. The roster
 * never goes to the model, so it cannot be steered towards a plausible name —
 * it can only report what is written.
 *
 * Built to under-claim, because a wrong match puts one child's marks on another:
 *
 * - **`confident` only on an exact, unique match** — the normalized name equals
 *   exactly one roster student's normalized name. Two students with the same
 *   name (or a first name shared by single-name rows) can never be confident.
 * - Everything else with a plausible candidate is **`confirm`**: the teacher is
 *   shown up to three and taps one. Nothing is assigned without that tap.
 * - A blank, or a name nothing resembles, is **`none`**.
 *
 * "Exact" is after `normalizeArabic` (hamza, ta marbuta, ya, diacritics,
 * digits) and after dropping punctuation and tatweel — the differences between
 * two ways of writing the same name, not between two names.
 */
import { normalizeArabic } from "@workspace/curriculum";

export interface RosterEntry {
  studentId: string;
  displayName: string;
  /** Already has a paper for this exam; the batch will not write into it. */
  hasAttempt: boolean;
}

export interface MatchCandidate {
  studentId: string;
  displayName: string;
  /** 0–1. 1 is an exact name match. */
  score: number;
  hasAttempt: boolean;
}

export type MatchStatus = "confident" | "confirm" | "none";

export interface StudentMatch {
  status: MatchStatus;
  /** Set only when `status` is `confident`. */
  studentId: string | null;
  candidates: MatchCandidate[];
}

/** Below this a roster name is not offered at all. */
export const MIN_CANDIDATE_SCORE = 0.5;
export const MAX_CANDIDATES = 3;

function tokens(name: string): string[] {
  return normalizeArabic(name)
    .replace(/ـ/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Dice coefficient over the sets of name parts: 1 identical, 0 nothing shared. */
function score(a: readonly string[], b: readonly string[]): number {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size === 0 || right.size === 0) return 0;
  let common = 0;
  for (const part of left) if (right.has(part)) common++;
  return (2 * common) / (left.size + right.size);
}

export function matchStudent(
  nameRead: string | null | undefined,
  roster: readonly RosterEntry[],
): StudentMatch {
  const none: StudentMatch = { status: "none", studentId: null, candidates: [] };
  const read = tokens(nameRead ?? "");
  if (read.length === 0 || roster.length === 0) return none;

  const readKey = read.join(" ");
  const scored: MatchCandidate[] = roster.map(r => {
    const parts = tokens(r.displayName);
    return {
      studentId: r.studentId,
      displayName: r.displayName,
      score: parts.join(" ") === readKey ? 1 : score(read, parts),
      hasAttempt: r.hasAttempt,
    };
  });

  const exact = scored.filter(c => c.score === 1);
  if (exact.length === 1) {
    const only = exact[0]!;
    return { status: "confident", studentId: only.studentId, candidates: [only] };
  }

  const candidates = scored
    .filter(c => c.score >= MIN_CANDIDATE_SCORE)
    .sort((x, y) => y.score - x.score || x.displayName.localeCompare(y.displayName, "ar"))
    .slice(0, MAX_CANDIDATES);

  return candidates.length === 0
    ? none
    : { status: "confirm", studentId: null, candidates };
}
````

- [ ] **Step 4: Run it to verify it passes**

Same command. Expected: `# tests 11`, `# pass 11`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/modules/assessment/studentMatch.ts artifacts/api-server/src/modules/assessment/__tests__/studentMatch.test.ts
git commit -m "api: match a name read off a paper to the roster; confident only when exact and unique"
```

---

### Task 4: Name and total on the existing mark-scan prompt

**Files:**
- Modify: `artifacts/api-server/src/modules/assessment/scanMarks.ts` (`buildScanPrompt`, plus two new exports at the end)
- Test: `artifacts/api-server/src/modules/assessment/__tests__/scanMarksName.test.ts`

**Interfaces:**
- Produces: `buildScanPrompt(questions, opts?: { readName?: boolean })` — **the default (no opts) output is byte-identical to today's**; `parseNameRead(raw: unknown): string | null`; `parseTotalRead(raw: unknown): number | null`. Task 5 calls all three.

The golden string in the test was **captured from the prompt as it is on `main` before this task** (2026-10-14). Do not regenerate it from the new code — its whole job is to prove `POST /attempts/:id/scan-marks` did not change.

- [ ] **Step 1: Write the test**

Create `artifacts/api-server/src/modules/assessment/__tests__/scanMarksName.test.ts`:

````ts
/**
 * The class scan asks the same prompt for two more things — the student's name
 * and the written total — and must not change what `scan-marks` has always sent.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildScanPrompt,
  parseNameRead,
  parseTotalRead,
  type ScannableQuestion,
} from "../scanMarks.ts";

const QUESTIONS: ScannableQuestion[] = [
  { questionId: "q1", number: 1, maxMarks: 5, type: "open_ended" },
  { questionId: "q2", number: 2, maxMarks: 10, type: "open_ended" },
];

// Captured from the prompt as it was before `readName` existed. If this fails,
// `POST /attempts/:id/scan-marks` has started sending the model something else.
const GOLDEN_DEFAULT = {
  system:
    "You read a teacher's handwritten marks from a photograph of a marked exam paper.\n\nYou are transcribing, not marking. Never judge whether a mark is correct,\nnever infer a mark from the student's work, and never fill in a gap.\n\nRules:\n1. Report only marks you can actually see written on the page.\n2. If a question has no visible mark, or you cannot read it with confidence,\n   omit that question entirely. Omitting is always better than guessing —\n   a guessed mark is attached to a real student.\n3. Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) and Western digits mean the same thing.\n   Report the numeric value.\n4. Half marks are common and are written many ways (٥٫٥, 5.5, 5½, ٥ و نصف).\n   Report them as a decimal.\n\nReturn JSON only: {\"marks\":[{\"number\":1,\"value\":3.5,\"readAs\":\"٣٫٥\"}]}\nNo prose, no markdown fence.",
  user:
    "This paper has these questions, numbered as they appear:\n  1. out of 5\n  2. out of 10\n\nRead the mark the teacher wrote for each one.\n\"readAs\" is the characters you saw, exactly as written.\n\"value\" is that as a number.\nOmit any question whose mark you cannot see or cannot read.",
};

describe("buildScanPrompt — default is unchanged", () => {
  it("is byte-identical to what scan-marks sent before readName existed", () => {
    assert.deepEqual(buildScanPrompt(QUESTIONS), GOLDEN_DEFAULT);
    assert.deepEqual(buildScanPrompt(QUESTIONS, {}), GOLDEN_DEFAULT);
    assert.deepEqual(buildScanPrompt(QUESTIONS, { readName: false }), GOLDEN_DEFAULT);
  });
});

describe("buildScanPrompt — readName", () => {
  it("asks for the name as written and forbids completing or guessing it", () => {
    const { system } = buildScanPrompt(QUESTIONS, { readName: true });
    assert.match(system, /transcribe the student's name exactly as written/);
    assert.match(system, /Never complete, correct or guess a name/);
  });

  it("asks for the written total and shows the new JSON shape", () => {
    const { system } = buildScanPrompt(QUESTIONS, { readName: true });
    assert.match(system, /wrote a total for the whole paper/);
    assert.match(system, /\{"name":"[^"]+","total":18,"marks":\[/);
  });

  it("keeps every rule of the default prompt", () => {
    const { system, user } = buildScanPrompt(QUESTIONS, { readName: true });
    assert.match(system, /transcribing, not marking/);
    assert.match(system, /Omitting is always better than guessing/);
    assert.equal(user, GOLDEN_DEFAULT.user);
  });
});

describe("parseNameRead", () => {
  it("returns the trimmed name", () => {
    assert.equal(parseNameRead({ name: "  سارة أحمد " }), "سارة أحمد");
  });

  it("is null for anything that is not a usable name", () => {
    for (const raw of [null, undefined, {}, { name: null }, { name: "" }, { name: "   " }, { name: 7 }, { name: "x".repeat(101) }, [], "text"]) {
      assert.equal(parseNameRead(raw), null, JSON.stringify(raw));
    }
  });
});

describe("parseTotalRead", () => {
  it("reads Western and Arabic-Indic digits", () => {
    assert.equal(parseTotalRead({ total: 18 }), 18);
    assert.equal(parseTotalRead({ total: "١٨٫٥" }), 18.5);
  });

  it("is null unless it is a positive number", () => {
    for (const raw of [null, undefined, {}, { total: null }, { total: 0 }, { total: -4 }, { total: "غير واضح" }, []]) {
      assert.equal(parseTotalRead(raw), null, JSON.stringify(raw));
    }
  });
});
````

- [ ] **Step 2: Run it to verify it fails**

```bash
cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/scanMarksName.test.ts
```
Expected: FAIL — `SyntaxError: ... does not provide an export named 'parseNameRead'`. (Before the change the golden assertion alone would pass; that is the point.)

- [ ] **Step 3: Modify `scanMarks.ts`**

Apply this diff (it replaces `buildScanPrompt` and appends two functions; if a hunk will not apply because the file moved, make the same edit by hand — the diff is the intent):

````diff
diff --git a/artifacts/api-server/src/modules/assessment/scanMarks.ts b/artifacts/api-server/src/modules/assessment/scanMarks.ts
index 249bee9..7c637ef 100644
--- a/artifacts/api-server/src/modules/assessment/scanMarks.ts
+++ b/artifacts/api-server/src/modules/assessment/scanMarks.ts
@@ -47,10 +47,20 @@ export interface ScanParseResult {
   skipped: { number: number; reason: string }[];
 }
 
-export function buildScanPrompt(questions: readonly ScannableQuestion[]): {
+/**
+ * `readName` is for the class scan, where the photo arrives with no student
+ * attached and the paper itself is what says whose it is. The default (no
+ * options) is what `POST /attempts/:id/scan-marks` has always sent — a golden
+ * test pins it, so extending this cannot change that route's prompt.
+ */
+export function buildScanPrompt(
+  questions: readonly ScannableQuestion[],
+  opts: { readName?: boolean } = {},
+): {
   system: string;
   user: string;
 } {
+  const readName = opts.readName === true;
   const system = [
     "You read a teacher's handwritten marks from a photograph of a marked exam paper.",
     "",
@@ -66,8 +76,19 @@ export function buildScanPrompt(questions: readonly ScannableQuestion[]): {
     "   Report the numeric value.",
     "4. Half marks are common and are written many ways (٥٫٥, 5.5, 5½, ٥ و نصف).",
     "   Report them as a decimal.",
+    ...(readName
+      ? [
+          "5. Also transcribe the student's name exactly as written on the paper, in the",
+          "   same letters. If there is no name, or you cannot read it with confidence,",
+          "   return null. Never complete, correct or guess a name.",
+          "6. If the teacher wrote a total for the whole paper, report it as total (a",
+          "   number); otherwise null.",
+        ]
+      : []),
     "",
-    'Return JSON only: {"marks":[{"number":1,"value":3.5,"readAs":"٣٫٥"}]}',
+    readName
+      ? 'Return JSON only: {"name":"سارة أحمد","total":18,"marks":[{"number":1,"value":3.5,"readAs":"٣٫٥"}]}'
+      : 'Return JSON only: {"marks":[{"number":1,"value":3.5,"readAs":"٣٫٥"}]}',
     "No prose, no markdown fence.",
   ].join("\n");
 
@@ -181,3 +202,23 @@ export function parseScanResponse(
 
   return { proposals, skipped };
 }
+
+/**
+ * The student's name as the model transcribed it, or null.
+ *
+ * Trimmed and bounded: this string is only ever matched against the roster
+ * (`studentMatch.ts`) and shown back to the teacher, but it came out of a model
+ * reading a photograph, so it is not trusted to be short or to be a name.
+ */
+export function parseNameRead(raw: unknown): string | null {
+  const name = asRecord(raw)?.["name"];
+  if (typeof name !== "string") return null;
+  const trimmed = name.trim();
+  return trimmed.length >= 1 && trimmed.length <= 100 ? trimmed : null;
+}
+
+/** The total the teacher wrote for the whole paper, when they wrote one. */
+export function parseTotalRead(raw: unknown): number | null {
+  const total = parseArabicNumber(asRecord(raw)?.["total"]);
+  return total !== null && total > 0 ? Math.round(total * 100) / 100 : null;
+}
````

- [ ] **Step 4: Run both scan-prompt suites**

```bash
cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/scanMarksName.test.ts src/modules/assessment/__tests__/scanMarks.test.ts
```
Expected: `# tests 21`, `# pass 21` (8 new + the 13 that already existed, untouched).

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/modules/assessment/scanMarks.ts artifacts/api-server/src/modules/assessment/__tests__/scanMarksName.test.ts
git commit -m "api: scan prompt can also read the student's name and written total; default unchanged"
```

---

### Task 5: The two routes

**Files:**
- Modify: `artifacts/api-server/src/routes/evaluations.ts` (imports, `scanLimiter`, `respondScanError`, `POST /evaluations/scan-paper`, `scanRoster`, `POST /evaluations/:id/scan-class-paper`)
- Modify: `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`
- Test: `artifacts/api-server/src/routes/__tests__/scanRoutes.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces (HTTP, consumed by Task 6):
  - `POST /evaluations/scan-paper` — body `{ images: string[], objectiveIds: string[] }` → `200 { rows: PaperScanRow[], printedTotal: number|null, skipped: {number,reason}[], model: string, saved: false }`; errors `400 {code: bad_image|bad_objectives|unknown_objectives}`, `413 image_too_large`, `429 user_quota_exceeded|budget_exceeded|rate_limited`, `503 live_mode_off`, `502 scan_unavailable`.
  - `POST /evaluations/:id/scan-class-paper` — body `{ image: string }` → `200 { nameRead: string|null, match: { status, studentId: string|null, candidates: [{studentId, displayName, score, hasAttempt}] }, proposals: MarkProposal[], skipped, writtenTotal: number|null, model, saved: false }`; errors as above plus `404`, `409 not_published|no_class`.

**Why two tests.** The handlers cannot be imported under `node --test` (database + OpenAI client at module scope), so there is no way to call them directly. `scanRoutes.test.ts` reads the source and **can fail first**; `mountOrder.test.ts` boots the built bundle and proves the paths are guarded — but note it **cannot fail first**, because the `/evaluations` prefix guard answers 401 whether or not the routes exist. Run both; trust neither alone.

- [ ] **Step 1: Write the failing source test**

Create `artifacts/api-server/src/routes/__tests__/scanRoutes.test.ts`:

````ts
/**
 * The two exam-scan routes write nothing, and guard their model call.
 *
 * Route files import the database and the OpenAI client at module scope, which
 * `node --test` cannot load (see the note in studentLessonExplanation.test.ts),
 * so this reads the source. What it proves is textual: the handlers contain no
 * write and check live mode, budget and quota *before* the model is called. How
 * a request actually behaves is covered by the pure-function tests next to the
 * modules (`scanRequest`, `scanPaper`, `studentMatch`) and by mountOrder.test.ts.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.resolve(here, "../evaluations.ts"), "utf8");

/** From a route's declaration to the next route, helper or EOF. */
function handler(opening: string): string {
  const start = source.indexOf(opening);
  assert.notEqual(start, -1, `${opening} is not declared in routes/evaluations.ts`);
  const rest = source.slice(start + opening.length);
  const next = rest.search(/\nrouter\.(get|post|put|patch|delete)\(|\nasync function |\nfunction /);
  return next === -1 ? rest : rest.slice(0, next);
}

const ROUTES = {
  "POST /evaluations/scan-paper": handler('router.post("/evaluations/scan-paper"'),
  "POST /evaluations/:id/scan-class-paper": handler('"/evaluations/:id/scan-class-paper"'),
};

for (const [name, body] of Object.entries(ROUTES)) {
  describe(name, () => {
    it("writes nothing — no insert, update or delete", () => {
      assert.doesNotMatch(body, /\.(insert|update|delete)\(/);
    });

    it("says in its response that nothing was saved", () => {
      assert.match(body, /saved: false/);
    });

    it("is rate limited", () => {
      assert.match(body, /scanLimiter/);
    });

    it("checks live mode, budget and quota before the model is called", () => {
      const call = body.indexOf("openai.chat.completions.create(");
      assert.notEqual(call, -1, "no model call found");
      for (const guard of ["assertLiveModeEnabled(", "assertBudgetAvailable(", "assertUserQuotaAvailable("]) {
        const at = body.indexOf(guard);
        assert.ok(at !== -1 && at < call, `${guard} must come before the model call`);
      }
    });

    it("records the spend with a prompt version", () => {
      assert.match(body, /recordUsage\(/);
      assert.match(body, /promptVersion: "scan-(paper|class-paper)-1"/);
    });
  });
}

describe("route-specific refusals", () => {
  it("scan-paper validates its body and resolves the objectives against the curriculum", () => {
    const body = ROUTES["POST /evaluations/scan-paper"];
    assert.match(body, /parsePaperScanBody\(/);
    assert.match(body, /resolveObjectiveIds\(/);
  });

  it("scan-class-paper is owner-only, published-only, and checks the photo", () => {
    const body = ROUTES["POST /evaluations/:id/scan-class-paper"];
    assert.match(body, /ownedEvaluation\(/);
    assert.match(body, /classScanGate\(/);
    assert.match(body, /checkScanImage\(/);
  });

  it("scan-class-paper never sends the roster to the model", () => {
    const body = ROUTES["POST /evaluations/:id/scan-class-paper"];
    const call = body.indexOf("openai.chat.completions.create(");
    const model = body.slice(call, body.indexOf("});", call));
    assert.doesNotMatch(model, /roster/);
  });
});
````

- [ ] **Step 2: Run it to verify it fails**

```bash
cd artifacts/api-server && node --experimental-strip-types --test src/routes/__tests__/scanRoutes.test.ts
```
Expected: FAIL — `router.post("/evaluations/scan-paper" is not declared in routes/evaluations.ts`.

- [ ] **Step 3: Add the routes**

Apply this diff to `artifacts/api-server/src/routes/evaluations.ts`. It adds the imports, the limiter and error responder after `aiLimiter`, the stateless `scan-paper` route immediately before `router.get("/evaluations", …)` (so it sits with `from-worksheet`, ahead of every `/:id` route), and `scanRoster` + `scan-class-paper` right after `POST /evaluations/:id/attempts`:

````diff
diff --git a/artifacts/api-server/src/routes/evaluations.ts b/artifacts/api-server/src/routes/evaluations.ts
index c2ead42..6013e4a 100644
--- a/artifacts/api-server/src/routes/evaluations.ts
+++ b/artifacts/api-server/src/routes/evaluations.ts
@@ -7,7 +7,7 @@
  * "stay within the selected grade and curriculum" a request rather than a
  * constraint.
  */
-import { Router } from "express";
+import { Router, type Response } from "express";
 import { createRateLimiter } from "../lib/rateLimit";
 import { db } from "@workspace/db";
 import {
@@ -96,6 +96,16 @@ import { extractJSON } from "../lib/generationShape.ts";
 import { groundingForObjectives } from "../lib/grounding.ts";
 import { openai } from "@workspace/integrations-openai-ai-server";
 import { recommendationsFor } from "../modules/assessment/recommend";
+import {
+  buildScanPrompt,
+  parseNameRead,
+  parseScanResponse,
+  parseTotalRead,
+  type ScannableQuestion,
+} from "../modules/assessment/scanMarks.ts";
+import { buildPaperScanPrompt, parsePaperScanResponse } from "../modules/assessment/scanPaper.ts";
+import { checkScanImage, classScanGate, parsePaperScanBody } from "../modules/assessment/scanRequest.ts";
+import { matchStudent, type RosterEntry } from "../modules/assessment/studentMatch.ts";
 import type { ObjectiveScore } from "../modules/assessment/scoring";
 
 import { resultsReleaseDecision } from "../lib/resultsRelease.ts";
@@ -118,6 +128,38 @@ const aiLimiter = createRateLimiter({
   key: (req) => (req as AuthenticatedRequest).user?.id ?? req.ip ?? "unknown",
 });
 
+// The two scan routes below read photographs, so they are model calls. A class
+// of 30–40 papers goes through the second one three at a time from the phone, so
+// this is looser than the generator's ten a minute — but still a ceiling, and
+// keyed per user like the rest.
+const scanLimiter = createRateLimiter({
+  windowMs: 60_000,
+  max: 30,
+  name: "ai-scan-class",
+  key: (req) => (req as AuthenticatedRequest).user?.id ?? req.ip ?? "unknown",
+});
+
+/** The same answers `POST /attempts/:id/scan-marks` gives, so a screen maps one set of codes. */
+function respondScanError(res: Response, err: unknown, what: string): void {
+  if (err instanceof AiUserQuotaExceededError) {
+    res.status(429).json({ error: err.message, code: "user_quota_exceeded" });
+    return;
+  }
+  if (err instanceof AiBudgetExceededError) {
+    res.status(429).json({ error: err.message, code: "budget_exceeded" });
+    return;
+  }
+  if (err instanceof AiLiveModeOffError) {
+    res.status(503).json({ error: err.message, code: "live_mode_off" });
+    return;
+  }
+  logger.error({ err }, what);
+  res.status(502).json({
+    error: "Could not read that photo. Nothing was changed — try again, or enter the marks by hand.",
+    code: "scan_unavailable",
+  });
+}
+
 const ALL_TYPES = Object.keys(QUESTION_TYPES) as QuestionType[];
 
 /**
@@ -410,6 +452,71 @@ router.post("/evaluations/from-worksheet", async (req: AuthenticatedRequest, res
   }
 });
 
+/**
+ * Read the pages of an exam the teacher set, to fill the paper-exam grid.
+ *
+ * Stateless on purpose: the grid is saved together with the evaluation
+ * (`new.tsx` creates the evaluation, then `PUT .../questions/paper`), so when a
+ * teacher scans the paper there is no evaluation row to hang this off. The
+ * objectives they have ticked travel in the body instead, and are resolved here
+ * against the curriculum like every other write.
+ *
+ * **It writes nothing.** The rows pre-fill a grid the teacher edits; the paper
+ * `PUT` still validates and stores them. Photos are not stored.
+ */
+router.post("/evaluations/scan-paper", scanLimiter, async (req: AuthenticatedRequest, res) => {
+  try {
+    const body = parsePaperScanBody(req.body);
+    if (!body.ok) {
+      res.status(body.refusal.status).json({ error: body.refusal.error, code: body.refusal.code });
+      return;
+    }
+    const { found, missing } = resolveObjectiveIds(body.objectiveIds);
+    if (missing.length > 0 || found.length === 0) {
+      res.status(400).json({ error: "Unknown objective", code: "unknown_objectives", details: missing });
+      return;
+    }
+
+    assertLiveModeEnabled();
+    assertBudgetAvailable();
+    await assertUserQuotaAvailable(req.user!.id);
+
+    const prompt = buildPaperScanPrompt(
+      found.map(o => ({ id: o.id, label: o.descriptionAr || o.description })),
+    );
+    const model = getGenerationModel();
+    const completion = await openai.chat.completions.create({
+      model,
+      max_completion_tokens: 3000,
+      messages: [
+        { role: "system", content: prompt.system },
+        {
+          role: "user",
+          content: [
+            { type: "text", text: prompt.user },
+            ...body.images.map(url => ({ type: "image_url" as const, image_url: { url } })),
+          ],
+        },
+      ],
+    });
+    recordUsage(completion.usage, model, {
+      kind: "quiz",
+      promptVersion: "scan-paper-1",
+      userId: req.user!.id,
+    });
+
+    const parsed = parsePaperScanResponse(
+      extractJSON(completion.choices[0]?.message?.content ?? "{}"),
+      found.map(o => o.id),
+    );
+    // `saved: false` is stated in the response so a client cannot present these
+    // as stored.
+    res.json({ ...parsed, model, saved: false });
+  } catch (err) {
+    respondScanError(res, err, "scan paper failed");
+  }
+});
+
 router.get("/evaluations", async (req: AuthenticatedRequest, res) => {
   try {
     const classId = trimmed(req.query["classId"]);
@@ -1876,6 +1983,124 @@ router.post("/evaluations/:id/attempts", async (req: AuthenticatedRequest, res)
   }
 });
 
+/**
+ * The class a scanned paper is matched against: current, non-archived members
+ * of the exam's class, narrowed to its audience when it is a group check — the
+ * rule `PATCH /attempts/:id` already applies when it moves a paper onto a
+ * student. `hasAttempt` lets the screen warn before a save that would skip them.
+ */
+async function scanRoster(evaluation: {
+  id: string;
+  teacherId: string;
+  classGroupId: string | null;
+}): Promise<RosterEntry[]> {
+  if (!evaluation.classGroupId) return [];
+  const members = await db
+    .select({ id: students.id, displayName: students.displayName })
+    .from(students)
+    .innerJoin(classMemberships, eq(classMemberships.studentId, students.id))
+    .where(
+      and(
+        eq(classMemberships.classGroupId, evaluation.classGroupId),
+        eq(students.teacherId, evaluation.teacherId),
+        isNull(students.archivedAt),
+      ),
+    )
+    .orderBy(asc(students.displayName));
+  const audience = await evaluationAudience(evaluation.id);
+  const sat = await db
+    .select({ studentId: attempts.studentId })
+    .from(attempts)
+    .where(eq(attempts.evaluationId, evaluation.id));
+  const hasAttempt = new Set(sat.map(a => a.studentId));
+  return members
+    .filter(m => inAudience(audience, m.id))
+    .map(m => ({ studentId: m.id, displayName: m.displayName, hasAttempt: hasAttempt.has(m.id) }));
+}
+
+/**
+ * Read one student's marked paper: the marks, and whose it is.
+ *
+ * The caller sends photos one at a time (three in flight), so one bad photo
+ * costs one row, not the batch. Nothing is created: no attempt, no grade. The
+ * response carries the name as written, a match against the class roster done
+ * here (the model never sees the roster), and the marks as proposals. A client
+ * saves them through the ordinary start-attempt and marking endpoints.
+ */
+router.post(
+  "/evaluations/:id/scan-class-paper",
+  scanLimiter,
+  async (req: AuthenticatedRequest, res) => {
+    try {
+      const evaluation = await ownedEvaluation(req.params["id"] as string, req.user!.id);
+      if (!evaluation) {
+        res.status(404).json({ error: "Evaluation not found" });
+        return;
+      }
+      const refused = classScanGate(evaluation) ?? checkScanImage(req.body?.image);
+      if (refused) {
+        res.status(refused.status).json({ error: refused.error, code: refused.code });
+        return;
+      }
+      const image = req.body.image as string;
+
+      assertLiveModeEnabled();
+      assertBudgetAvailable();
+      await assertUserQuotaAvailable(req.user!.id);
+
+      const live = await liveQuestions(evaluation.id);
+      if (live.length === 0) {
+        res.status(409).json({ error: "This evaluation has no questions" });
+        return;
+      }
+      const questions: ScannableQuestion[] = live.map((q, i) => ({
+        questionId: q.id,
+        number: i + 1,
+        maxMarks: Number(q.marks),
+        type: q.type,
+      }));
+      const roster = await scanRoster(evaluation);
+
+      const prompt = buildScanPrompt(questions, { readName: true });
+      const model = getGenerationModel();
+      const completion = await openai.chat.completions.create({
+        model,
+        max_completion_tokens: 1500,
+        messages: [
+          { role: "system", content: prompt.system },
+          {
+            role: "user",
+            content: [
+              { type: "text", text: prompt.user },
+              { type: "image_url", image_url: { url: image } },
+            ],
+          },
+        ],
+      });
+      recordUsage(completion.usage, model, {
+        kind: "quiz",
+        promptVersion: "scan-class-paper-1",
+        userId: req.user!.id,
+      });
+
+      const raw = extractJSON(completion.choices[0]?.message?.content ?? "{}");
+      const parsed = parseScanResponse(raw, questions);
+      const nameRead = parseNameRead(raw);
+      res.json({
+        nameRead,
+        match: matchStudent(nameRead, roster),
+        proposals: parsed.proposals,
+        skipped: parsed.skipped,
+        writtenTotal: parseTotalRead(raw),
+        model,
+        saved: false,
+      });
+    } catch (err) {
+      respondScanError(res, err, "scan class paper failed");
+    }
+  },
+);
+
 /**
  * Books a teacher can actually build an evaluation from.
  *
````

- [ ] **Step 4: Add the bundle-level guard test**

Apply this diff to `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`:

````diff
diff --git a/artifacts/api-server/src/routes/__tests__/mountOrder.test.ts b/artifacts/api-server/src/routes/__tests__/mountOrder.test.ts
index ef2e605..1d0152a 100644
--- a/artifacts/api-server/src/routes/__tests__/mountOrder.test.ts
+++ b/artifacts/api-server/src/routes/__tests__/mountOrder.test.ts
@@ -104,6 +104,31 @@ describe("API mount order", { skip: built ? false : "run `pnpm build` first" },
     assert.equal(approve.status, 401);
   });
 
+  it("guards the two exam-scan routes, and they shadow nothing", async () => {
+    // Both read photographs of minors' papers and spend model budget, so an
+    // unguarded one would be a public vision endpoint. No token: refused before
+    // any database or model access (DATABASE_URL is a dead address here).
+    const setup = await fetch(`${base}/evaluations/scan-paper`, {
+      method: "POST",
+      headers: { "Content-Type": "application/json" },
+      body: JSON.stringify({ images: [], objectiveIds: [] }),
+    });
+    assert.equal(setup.status, 401);
+    const batch = await fetch(
+      `${base}/evaluations/00000000-0000-4000-8000-000000000000/scan-class-paper`,
+      {
+        method: "POST",
+        headers: { "Content-Type": "application/json" },
+        body: JSON.stringify({ image: "data:image/jpeg;base64,AAAA" }),
+      },
+    );
+    assert.equal(batch.status, 401);
+    // `scan-paper` is a fixed path next to `/evaluations/:id/...` routes; a path
+    // the router does not own must still be answered by the guard, not swallowed.
+    const other = await fetch(`${base}/evaluations/scan-paper/extra`, { method: "POST" });
+    assert.ok(other.status === 401 || other.status === 404, `got ${other.status}`);
+  });
+
   it("keeps the bank catalog public, and free of what it cannot serve", async () => {
     // Same reasoning as curriculum: titles and provenance, not documents.
     const res = await fetch(`${base}/bank/items?kind=exam`);
````

- [ ] **Step 5: Typecheck, build, test**

```bash
cd /home/user/Iqraa && pnpm run typecheck
cd artifacts/api-server && pnpm build && node --experimental-strip-types --test src/routes/__tests__/scanRoutes.test.ts src/routes/__tests__/mountOrder.test.ts
```
Expected: typecheck clean (all three projects `Done`); `scanRoutes.test.ts` 13 pass; `mountOrder.test.ts` 54 pass including «guards the two exam-scan routes, and they shadow nothing».

- [ ] **Step 6: Full api-server suite**

```bash
cd artifacts/api-server && pnpm test
```
Expected: `# tests 1691`, `# fail 0`, `# skipped 0`.

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src/routes/evaluations.ts artifacts/api-server/src/routes/__tests__/scanRoutes.test.ts artifacts/api-server/src/routes/__tests__/mountOrder.test.ts
git commit -m "api: POST /evaluations/scan-paper and /:id/scan-class-paper — proposals only, nothing written"
```

---

## Part B — mobile

### Task 6: API client, error mapping, grid conversion

**Files:**
- Modify: `artifacts/mobile/services/evaluations.ts`
- Create: `artifacts/mobile/services/scanErrors.ts`, `artifacts/mobile/services/paperScan.ts`
- Test: `artifacts/mobile/services/__tests__/scanErrors.test.ts`, `artifacts/mobile/services/__tests__/paperScan.test.ts`

**Interfaces:**
- Produces from `evaluations.ts`: `interface PaperScanRow`; `scanPaper(images: string[], objectiveIds: string[]): Promise<{ rows: PaperScanRow[]; printedTotal: number|null; skipped: {number:number;reason:string}[]; model: string; saved: boolean }>`; `type ScanMatchStatus`; `interface ScanCandidate`; `interface ClassScanResponse`; `scanClassPaper(evaluationId: string, image: string): Promise<ClassScanResponse>`; `startAttemptChecked(evaluationId, studentId): Promise<{ attempt: Attempt; created: boolean }>` (`startAttempt` now delegates to it; its signature is unchanged).
- Produces from `scanErrors.ts`: `type ScanErrorKey`; `scanErrorKey(err: unknown): ScanErrorKey`; `isBatchStopError(err): boolean`; `isRetryable(err): boolean`. `ScanErrorKey` values are all valid `TranslationKey`s (added in Task 7).
- Produces from `paperScan.ts`: `interface GridRow { marks: string; objectiveId: string; competencyKey: CompetencyKey; review: boolean }`; `gridFromScan(rows, objectiveIds, fallbackCompetency): GridRow[]`; `blankMarkCount(rows): number`; `totalMismatch(rows, printedTotal): { sum: number; printed: number } | null`.

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/scanErrors.test.ts`:

````ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isBatchStopError, isRetryable, scanErrorKey } from '../scanErrors.ts';

const err = (status: number, code = '') => ({ status, code });

describe('scanErrorKey', () => {
  it('maps every code the scan routes send to a sentence that says what to do', () => {
    assert.equal(scanErrorKey(err(413, 'image_too_large')), 'scanTooLarge');
    assert.equal(scanErrorKey(err(413, 'payload_too_large')), 'scanTooLarge');
    assert.equal(scanErrorKey(err(413)), 'scanTooLarge');
    assert.equal(scanErrorKey(err(503, 'live_mode_off')), 'scanUnavailable');
    assert.equal(scanErrorKey(err(409, 'not_published')), 'scanNotPublished');
    assert.equal(scanErrorKey(err(409, 'no_class')), 'scanNoClass');
    assert.equal(scanErrorKey(err(502, 'scan_unavailable')), 'scanFailed');
  });

  it('tells a spent allowance apart from a busy minute — both are 429', () => {
    assert.equal(scanErrorKey(err(429, 'user_quota_exceeded')), 'scanBudgetSpent');
    assert.equal(scanErrorKey(err(429, 'budget_exceeded')), 'scanBudgetSpent');
    assert.equal(scanErrorKey(err(429, 'rate_limited')), 'scanRateLimited');
    assert.equal(scanErrorKey(err(429)), 'scanRateLimited');
  });

  it('falls back to the hand-entry sentence for anything else', () => {
    for (const e of [new Error('boom'), null, undefined, 'text', err(500), {}]) {
      assert.equal(scanErrorKey(e), 'scanFailed');
    }
  });
});

describe('isBatchStopError', () => {
  it('stops on the failures every remaining photo would repeat', () => {
    for (const code of ['live_mode_off', 'budget_exceeded', 'user_quota_exceeded']) {
      assert.equal(isBatchStopError(err(429, code)), true, code);
    }
  });

  it('does not stop on a bad photo, a busy minute, or a server hiccup', () => {
    for (const e of [err(400, 'bad_image'), err(413, 'image_too_large'), err(429, 'rate_limited'), err(502, 'scan_unavailable'), null]) {
      assert.equal(isBatchStopError(e), false);
    }
  });
});

describe('isRetryable', () => {
  it('retries only a rate limit, never a spent allowance', () => {
    assert.equal(isRetryable(err(429, 'rate_limited')), true);
    assert.equal(isRetryable(err(429)), true);
    assert.equal(isRetryable(err(429, 'user_quota_exceeded')), false);
    assert.equal(isRetryable(err(502, 'scan_unavailable')), false);
  });
});
````

Create `artifacts/mobile/services/__tests__/paperScan.test.ts`:

````ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { blankMarkCount, gridFromScan, totalMismatch } from '../paperScan.ts';
import type { PaperScanRow } from '../evaluations.ts';

const row = (over: Partial<PaperScanRow> = {}): PaperScanRow => ({
  number: 1, marks: 5, objectiveId: 'o1', competencyKey: 'knowledge', readAs: '5', ...over,
});

describe('gridFromScan', () => {
  it('carries what was read and marks every row for review', () => {
    const grid = gridFromScan([row({ marks: 2.5, objectiveId: 'o2', competencyKey: 'application' })], ['o1', 'o2'], 'understanding');
    assert.deepEqual(grid, [{ marks: '2.5', objectiveId: 'o2', competencyKey: 'application', review: true }]);
  });

  it('leaves an unread mark blank instead of defaulting it', () => {
    assert.equal(gridFromScan([row({ marks: null })], ['o1'], 'understanding')[0]!.marks, '');
  });

  it('falls back to the first ticked objective and the default competency, as the grid does', () => {
    const [g] = gridFromScan([row({ objectiveId: null, competencyKey: null })], ['o9', 'o1'], 'understanding');
    assert.equal(g!.objectiveId, 'o9');
    assert.equal(g!.competencyKey, 'understanding');
  });

  it('does not keep an objective the teacher has not ticked', () => {
    assert.equal(gridFromScan([row({ objectiveId: 'o-unticked' })], ['o1'], 'understanding')[0]!.objectiveId, 'o1');
  });

  it('is empty for an empty scan', () => {
    assert.deepEqual(gridFromScan([], ['o1'], 'understanding'), []);
  });
});

describe('blankMarkCount', () => {
  it('counts blanks, zeros and junk — everything the grid would refuse', () => {
    assert.equal(blankMarkCount([{ marks: '' }, { marks: '0' }, { marks: 'x' }, { marks: '٣' }, { marks: '2.5' }]), 3);
  });
});

describe('totalMismatch', () => {
  it('is null when the marks add up to the printed total, in either digit set', () => {
    assert.equal(totalMismatch([{ marks: '5' }, { marks: '٥' }, { marks: '2.5' }], 12.5), null);
  });

  it('reports both numbers when they disagree', () => {
    assert.deepEqual(totalMismatch([{ marks: '5' }, { marks: '5' }], 15), { sum: 10, printed: 15 });
  });

  it('is null when the paper printed no total', () => {
    assert.equal(totalMismatch([{ marks: '5' }], null), null);
  });

  it('ignores blank rows rather than counting them as zero-and-agreeing', () => {
    assert.deepEqual(totalMismatch([{ marks: '5' }, { marks: '' }], 10), { sum: 5, printed: 10 });
  });
});
````

- [ ] **Step 2: Run them to verify they fail**

```bash
cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/scanErrors.test.ts services/__tests__/paperScan.test.ts
```
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../scanErrors.ts` / `../paperScan.ts`.

- [ ] **Step 3: Implement the two pure modules**

Create `artifacts/mobile/services/scanErrors.ts`:

````ts
/**
 * What a failed scan means for the teacher, in their language.
 *
 * Every failure on the scan paths carries a `status` and a machine-readable
 * `code` (`EvaluationError`), precisely so a screen never shows the server's
 * English on an Arabic screen — which is what production did on the first real
 * scan (STATUS.md, «The first real scan was refused»). Pure and duck-typed so
 * the bare `node --test` runner can load it; the screens map the key to text.
 */
export type ScanErrorKey =
  | 'scanTooLarge'
  | 'scanUnavailable'
  | 'scanBudgetSpent'
  | 'scanRateLimited'
  | 'scanNotPublished'
  | 'scanNoClass'
  | 'scanFailed';

function parts(err: unknown): { status: number; code: string } {
  const e = err as { status?: unknown; code?: unknown } | null;
  return {
    status: typeof e?.status === 'number' ? e.status : 0,
    code: typeof e?.code === 'string' ? e.code : '',
  };
}

export function scanErrorKey(err: unknown): ScanErrorKey {
  const { status, code } = parts(err);
  if (code === 'image_too_large' || code === 'payload_too_large' || status === 413) return 'scanTooLarge';
  if (code === 'live_mode_off') return 'scanUnavailable';
  // Before the 429 test below: both of these are 429s, but they are not "wait a
  // moment" — the month's allowance is gone.
  if (code === 'user_quota_exceeded' || code === 'budget_exceeded') return 'scanBudgetSpent';
  if (code === 'rate_limited' || status === 429) return 'scanRateLimited';
  if (code === 'not_published') return 'scanNotPublished';
  if (code === 'no_class') return 'scanNoClass';
  return 'scanFailed';
}

/** Failures that will fail every remaining photo the same way, so the batch stops. */
export function isBatchStopError(err: unknown): boolean {
  const { code } = parts(err);
  return code === 'live_mode_off' || code === 'budget_exceeded' || code === 'user_quota_exceeded';
}

/** "Wait and try again" rather than a failure. */
export function isRetryable(err: unknown): boolean {
  return scanErrorKey(err) === 'scanRateLimited';
}
````

Create `artifacts/mobile/services/paperScan.ts`:

````ts
/**
 * Turning a scanned exam paper into the rows of the paper-exam grid.
 *
 * The grid is the teacher's: a scan only pre-fills it. Anything the server
 * could not read stays blank (marks) or falls back exactly as the grid's own
 * default already does (objective, competency), and every scanned row carries
 * `review` until the teacher touches it, so a suggestion is never mistaken for
 * a decision. Free of react-native so `node --test` can load it.
 */
import { toLatinDigits } from './latinDigits.ts';
import type { CompetencyKey, PaperScanRow } from './evaluations.ts';

export interface GridRow {
  marks: string;
  objectiveId: string;
  competencyKey: CompetencyKey;
  /** Came from a scan and the teacher has not looked at it yet. */
  review: boolean;
}

export function gridFromScan(
  rows: readonly PaperScanRow[],
  objectiveIds: readonly string[],
  fallbackCompetency: CompetencyKey,
): GridRow[] {
  const fallbackObjective = objectiveIds[0] ?? '';
  return rows.map(r => ({
    // Blank, not a default: the grid's own validation names the row.
    marks: r.marks === null ? '' : String(r.marks),
    objectiveId:
      r.objectiveId !== null && objectiveIds.includes(r.objectiveId) ? r.objectiveId : fallbackObjective,
    competencyKey: r.competencyKey ?? fallbackCompetency,
    review: true,
  }));
}

/** How many scanned rows still have no marks — what the teacher is told to fill in. */
export function blankMarkCount(rows: readonly { marks: string }[]): number {
  return rows.filter(r => !(Number(toLatinDigits(r.marks)) > 0)).length;
}

/**
 * The scanned marks disagree with the total the paper prints for itself. Either
 * a question was missed or a mark was misread; both are worth one glance before
 * the grid is saved. Null when they agree or the paper prints no total.
 */
export function totalMismatch(
  rows: readonly { marks: string }[],
  printedTotal: number | null,
): { sum: number; printed: number } | null {
  if (printedTotal === null) return null;
  let sum = 0;
  for (const r of rows) {
    const v = Number(toLatinDigits(r.marks));
    if (Number.isFinite(v) && v > 0) sum += v;
  }
  sum = Math.round(sum * 100) / 100;
  return Math.abs(sum - printedTotal) < 0.005 ? null : { sum, printed: printedTotal };
}
````

- [ ] **Step 4: Extend the API client**

Apply this diff to `artifacts/mobile/services/evaluations.ts` (it replaces `startAttempt` with `startAttemptChecked` + a delegating `startAttempt`, and adds the scan types and calls before `setTeacherComment`):

````diff
diff --git a/artifacts/mobile/services/evaluations.ts b/artifacts/mobile/services/evaluations.ts
index fcda3a8..e91c535 100644
--- a/artifacts/mobile/services/evaluations.ts
+++ b/artifacts/mobile/services/evaluations.ts
@@ -560,14 +560,27 @@ export async function setMasteryUnlock(evaluationId: string, studentId: string,
   await readJson<{ ok: boolean }>(res, 'Updating the unlock');
 }
 
-/** Find-or-create: safe to call every time a teacher opens a student's entry screen. */
-export async function startAttempt(evaluationId: string, studentId: string): Promise<Attempt> {
+/**
+ * Find-or-create, and says which: `created` is false when the student already
+ * had a paper for this exam (any source). The marking endpoint upserts, so a
+ * caller that is about to WRITE marks must read this — writing into a paper it
+ * did not create silently replaces a mark a teacher entered or a student earned.
+ */
+export async function startAttemptChecked(
+  evaluationId: string,
+  studentId: string,
+): Promise<{ attempt: Attempt; created: boolean }> {
   const res = await apiFetch(`/evaluations/${evaluationId}/attempts`, {
     method: 'POST',
     body: JSON.stringify({ studentId }),
   });
-  const data = await readJson<{ attempt: Attempt }>(res, 'Starting attempt');
-  return data.attempt;
+  const data = await readJson<{ attempt: Attempt; created?: boolean }>(res, 'Starting attempt');
+  return { attempt: data.attempt, created: data.created === true };
+}
+
+/** Find-or-create: safe to call every time a teacher opens a student's entry screen. */
+export async function startAttempt(evaluationId: string, studentId: string): Promise<Attempt> {
+  return (await startAttemptChecked(evaluationId, studentId)).attempt;
 }
 
 export async function getAttempt(attemptId: string): Promise<{
@@ -654,6 +667,78 @@ export async function scanMarks(
   return readJson(res, 'Reading the marks');
 }
 
+/** One question the model read off an exam paper. Mirrors api-server `PaperScanRow`. */
+export interface PaperScanRow {
+  /** 1-based, as printed. */
+  number: number;
+  /** Null when the pages did not state it or it could not be read — never a default. */
+  marks: number | null;
+  objectiveId: string | null;
+  competencyKey: CompetencyKey | null;
+  readAs: string;
+}
+
+/**
+ * Read the pages of an exam the teacher set, to fill the paper-exam grid.
+ *
+ * Stateless: the grid is saved together with the evaluation, so there is no
+ * evaluation yet — the objectives ticked in the form travel in the body. Saves
+ * nothing; `saved: false` comes back to say so.
+ */
+export async function scanPaper(
+  images: string[],
+  objectiveIds: string[],
+): Promise<{
+  rows: PaperScanRow[];
+  printedTotal: number | null;
+  skipped: { number: number; reason: string }[];
+  model: string;
+  saved: boolean;
+}> {
+  const res = await apiFetch('/evaluations/scan-paper', {
+    method: 'POST',
+    body: JSON.stringify({ images, objectiveIds }),
+    // Up to four pages through a vision model; a little longer than one page.
+    timeoutMs: 60_000,
+  });
+  return readJson(res, 'Reading the paper');
+}
+
+export type ScanMatchStatus = 'confident' | 'confirm' | 'none';
+
+export interface ScanCandidate {
+  studentId: string;
+  displayName: string;
+  /** 0–1; 1 is an exact name match. */
+  score: number;
+  hasAttempt: boolean;
+}
+
+export interface ClassScanResponse {
+  /** The name as the model transcribed it, or null. */
+  nameRead: string | null;
+  match: { status: ScanMatchStatus; studentId: string | null; candidates: ScanCandidate[] };
+  proposals: MarkProposal[];
+  skipped: { number: number; reason: string }[];
+  /** The total the teacher wrote on the paper, when they wrote one. */
+  writtenTotal: number | null;
+  model: string;
+  saved: boolean;
+}
+
+/**
+ * Read one student's marked paper: the marks, and whose it is. Creates nothing.
+ * Called once per photograph so one failure costs one row.
+ */
+export async function scanClassPaper(evaluationId: string, image: string): Promise<ClassScanResponse> {
+  const res = await apiFetch(`/evaluations/${evaluationId}/scan-class-paper`, {
+    method: 'POST',
+    body: JSON.stringify({ image }),
+    timeoutMs: 45_000,
+  });
+  return readJson(res, 'Reading the paper');
+}
+
 export async function setTeacherComment(attemptId: string, teacherComment: string): Promise<Attempt> {
   const res = await apiFetch(`/attempts/${attemptId}`, {
     method: 'PATCH',
````

Why `startAttemptChecked` exists: `POST /evaluations/:id/attempts` is find-or-create and the marking endpoint upserts, so any caller about to *write* marks must know whether the paper already existed (Task 9).

- [ ] **Step 5: Run the tests**

Same command as Step 2. Expected: `# tests 16`, `# pass 16`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/evaluations.ts artifacts/mobile/services/scanErrors.ts artifacts/mobile/services/paperScan.ts artifacts/mobile/services/__tests__/scanErrors.test.ts artifacts/mobile/services/__tests__/paperScan.test.ts
git commit -m "mobile: scan API client, startAttemptChecked, error mapping, scan-to-grid conversion"
```

---

### Task 7: Paper setup from photos (UI, strings, picker)

This task has no unit test of its own: it is wiring, and the logic it calls was tested in Task 6. Two **existing** guard suites do apply and must stay green — `designScale.test.ts` and `i18nTerminology.test.ts` — and they already caught two mistakes while this plan was being verified (a `fontSize` of 12 and the imperative «اقرأ»). The code below has both fixed.

**Files:**
- Modify: `artifacts/mobile/services/i18n.ts` (**all** new strings for both screens, Arabic and English)
- Modify: `artifacts/mobile/services/documents/pick.ts`
- Modify: `artifacts/mobile/app/evaluations/new.tsx`

**Interfaces:**
- Consumes: `scanPaper`, `gridFromScan`, `blankMarkCount`, `totalMismatch`, `scanErrorKey` (Task 6); `confirm` from `@/services/confirm`.
- Produces: `pickMarkSheetPhotos(limit: number): Promise<string[]>` (also used by Task 10); the `paperScan*`, `paperRowReview`, `paperTotalMismatch`, `scanRateLimited`, `scanNotPublished`, `scanNoClass` and `classScan*` translation keys.

- [ ] **Step 1: Add the strings**

Apply to `artifacts/mobile/services/i18n.ts`. The keys land right after each language's existing `scanFilledSome`. Every key exists in **both** `ar` and `en` (`TranslationKey` is derived from `en`):

````diff
diff --git a/artifacts/mobile/services/i18n.ts b/artifacts/mobile/services/i18n.ts
index b284b1a..b69bc60 100644
--- a/artifacts/mobile/services/i18n.ts
+++ b/artifacts/mobile/services/i18n.ts
@@ -2199,6 +2199,52 @@ const translations = {
     scanFoundNothing: 'لم يُقرأ أي علامة من الصورة.',
     scanFilledAll: (n: string) => `مُلئت ${arMarksPhrase(n)} — راجعها ثم احفظ.`,
     scanFilledSome: (n: string, left: string) => `مُلئت ${arMarksPhrase(n)}، وبقيت ${left} بحاجة إليك.`,
+    paperScanBtn: 'اقرَأ الأسئلة من صور الورقة',
+    paperScanHint: 'اختر صور صفحات الامتحان بالترتيب (حتى 4). تُملأ العلامات وتُقترح النتاجات والمهارات — راجعها قبل إنشاء الامتحان.',
+    paperScanReading: 'يقرأ الورقة…',
+    paperScanNeedObjective: 'اختر درسًا واحدًا على الأقل قبل قراءة الورقة.',
+    paperScanFoundNothing: 'لم تُقرأ أي أسئلة من الصور.',
+    paperScanFilled: (n: string, blank: string) =>
+      blank === '0'
+        ? `الأسئلة المقروءة: ${n} — راجعها ثم أنشئ الامتحان.`
+        : `الأسئلة المقروءة: ${n} — منها ${blank} بلا علامة. أكملها ثم أنشئ الامتحان.`,
+    paperScanReplaceTitle: 'استبدال الأسئلة الحالية؟',
+    paperScanReplaceBody: 'ستحلّ الأسئلة المقروءة من الصور محل ما أدخلته في الجدول.',
+    paperScanReplaceConfirm: 'استبدل',
+    paperRowReview: 'راجع',
+    paperTotalMismatch: (sum: string, printed: string) =>
+      `مجموع العلامات المقروءة ${sum}، لكن الورقة تذكر ${printed}. تحقق من العلامات.`,
+    scanRateLimited: 'الخدمة مشغولة قليلًا. أعد المحاولة بعد لحظات.',
+    scanNotPublished: 'انشر الامتحان أولًا قبل مسح أوراق الصف.',
+    scanNoClass: 'اربط الامتحان بصف أولًا — الصف هو قائمة الأسماء التي تُطابَق عليها الأوراق.',
+    classScanBtn: 'امسح أوراق الصف',
+    classScanTitle: 'مسح أوراق الصف',
+    classScanHint: 'صوّر الصفحة التي عليها العلامات لكل طالب (حتى 40 ورقة). يُقرأ الاسم والعلامات، ولا يُحفظ شيء حتى تراجعها.',
+    classScanPickBtn: 'اختر الصور',
+    classScanTooMany: (n: string) => `الحد الأقصى ${n} ورقة في المرة الواحدة.`,
+    classScanProgress: (done: string, total: string) => `الأوراق المقروءة: ${done} من ${total}`,
+    classScanStopped: 'توقّف المسح. ما قُرئ قبل التوقّف باقٍ في الجدول.',
+    classScanNameRead: (name: string) => `المكتوب على الورقة: ${name}`,
+    classScanNoName: 'لم يُقرأ اسم على الورقة',
+    classScanPickStudent: 'الطالب',
+    classScanLikely: 'هل هو أحد هؤلاء؟',
+    classScanBlockNoStudent: 'اختر الطالب',
+    classScanBlockDuplicate: 'ورقتان لنفس الطالب',
+    classScanBlockInvalid: 'علامة غير صحيحة',
+    classScanFlagHasAttempt: 'للطالب ورقة سابقة لهذا الامتحان — ستُتخطّى ولن تُستبدل.',
+    classScanOpenStudent: 'افتح ورقة الطالب',
+    classScanFlagBlank: 'خانات فارغة — تُحفظ بلا علامة.',
+    classScanFlagTotal: (sum: string, written: string) => `المجموع ${sum}، والمكتوب على الورقة ${written}.`,
+    classScanRowFailed: 'تعذّرت قراءة هذه الصورة.',
+    classScanRowNotRun: 'لم تُقرأ — توقّف المسح.',
+    classScanRowSkipped: 'تُخطّيت — للطالب ورقة سابقة.',
+    classScanRowSaved: 'حُفظت',
+    classScanRowSaveFailed: 'تعذّر الحفظ — اضغط «احفظ العلامات» للمحاولة من جديد.',
+    classScanSaveBtn: 'احفظ العلامات',
+    classScanSaving: 'يحفظ…',
+    classScanSummary: (saved: string, attention: string, skipped: string) =>
+      `حُفظت ${saved} · تحتاج مراجعة ${attention} · تُخطّيت ${skipped}`,
+    classScanLoadFailed: 'تعذّر تحميل الامتحان أو الصف.',
     attemptGradedToast: 'تم التصحيح — النتيجة في الأعلى',
     markLabel: 'العلامة',
     markOutOf: (max: string) => `من ${max}`,
@@ -4666,6 +4712,52 @@ const translations = {
     scanFoundNothing: 'No marks could be read from that photo.',
     scanFilledAll: (n: string) => `Filled ${n} ${n === '1' ? 'mark' : 'marks'} — check them, then save.`,
     scanFilledSome: (n: string, left: string) => `Filled ${n}, and ${left} still need you.`,
+    paperScanBtn: 'Read the questions from photos of the paper',
+    paperScanHint: 'Pick photos of the exam pages in order (up to 4). The marks are filled in and objectives and skills are suggested — check them before you create the exam.',
+    paperScanReading: 'Reading the paper…',
+    paperScanNeedObjective: 'Choose at least one lesson before reading the paper.',
+    paperScanFoundNothing: 'No questions could be read from those photos.',
+    paperScanFilled: (n: string, blank: string) =>
+      blank === '0'
+        ? `Questions read: ${n} — check them, then create the exam.`
+        : `Questions read: ${n} — ${blank} with no mark. Fill those in, then create the exam.`,
+    paperScanReplaceTitle: 'Replace the current questions?',
+    paperScanReplaceBody: 'The questions read from the photos will replace what you entered in the grid.',
+    paperScanReplaceConfirm: 'Replace',
+    paperRowReview: 'Check',
+    paperTotalMismatch: (sum: string, printed: string) =>
+      `The marks read add up to ${sum}, but the paper says ${printed}. Check the marks.`,
+    scanRateLimited: 'The service is busy for a moment. Try again shortly.',
+    scanNotPublished: 'Publish the exam before scanning class papers.',
+    scanNoClass: 'Attach the exam to a class first — the class is the list of names papers are matched against.',
+    classScanBtn: 'Scan the class papers',
+    classScanTitle: 'Scan the class papers',
+    classScanHint: 'Photograph the page with the marks for each student (up to 40 papers). The name and marks are read, and nothing is saved until you check them.',
+    classScanPickBtn: 'Choose photos',
+    classScanTooMany: (n: string) => `At most ${n} papers at a time.`,
+    classScanProgress: (done: string, total: string) => `Papers read: ${done} of ${total}`,
+    classScanStopped: 'Scanning stopped. What was read before it stopped is still in the table.',
+    classScanNameRead: (name: string) => `Written on the paper: ${name}`,
+    classScanNoName: 'No name could be read on the paper',
+    classScanPickStudent: 'Student',
+    classScanLikely: 'Is it one of these?',
+    classScanBlockNoStudent: 'Choose the student',
+    classScanBlockDuplicate: 'Two papers for the same student',
+    classScanBlockInvalid: 'A mark is not valid',
+    classScanFlagHasAttempt: 'This student already has a paper for this exam — it will be skipped, not replaced.',
+    classScanOpenStudent: "Open the student's paper",
+    classScanFlagBlank: 'Empty boxes — saved with no mark.',
+    classScanFlagTotal: (sum: string, written: string) => `The marks add up to ${sum}, but the paper says ${written}.`,
+    classScanRowFailed: 'That photo could not be read.',
+    classScanRowNotRun: 'Not read — scanning stopped.',
+    classScanRowSkipped: 'Skipped — the student already has a paper.',
+    classScanRowSaved: 'Saved',
+    classScanRowSaveFailed: 'Could not save — press “Save the marks” to try again.',
+    classScanSaveBtn: 'Save the marks',
+    classScanSaving: 'Saving…',
+    classScanSummary: (saved: string, attention: string, skipped: string) =>
+      `Saved ${saved} · need attention ${attention} · skipped ${skipped}`,
+    classScanLoadFailed: 'Could not load the exam or the class.',
     attemptGradedToast: 'Marked — the result is at the top',
     markLabel: 'Mark',
     markOutOf: (max: string) => `of ${max}`,
````

- [ ] **Step 2: Add the multi-photo picker**

Apply to `artifacts/mobile/services/documents/pick.ts`:

````diff
diff --git a/artifacts/mobile/services/documents/pick.ts b/artifacts/mobile/services/documents/pick.ts
index fd0da0a..56e156e 100644
--- a/artifacts/mobile/services/documents/pick.ts
+++ b/artifacts/mobile/services/documents/pick.ts
@@ -88,3 +88,32 @@ export async function pickMarkSheetPhoto(): Promise<string | null> {
   // help — it re-compresses twelve megapixels rather than sending fewer.
   return downscaleImage(`data:${mime};base64,${asset.base64}`);
 }
+
+/**
+ * Several photos of marked papers (or of the pages of one exam), each shrunk the
+ * same way `pickMarkSheetPhoto` does. Empty on cancel or no permission.
+ *
+ * `limit` is a ceiling on the picker, and applied again to the result because
+ * `selectionLimit` is advisory on some platforms.
+ */
+export async function pickMarkSheetPhotos(limit: number): Promise<string[]> {
+  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
+  if (!perm.granted) return [];
+
+  const result = await ImagePicker.launchImageLibraryAsync({
+    mediaTypes: ['images'],
+    allowsMultipleSelection: true,
+    selectionLimit: limit,
+    quality: 0.6,
+    base64: true,
+  });
+  if (result.canceled || !result.assets?.length) return [];
+
+  const out: string[] = [];
+  for (const asset of result.assets.slice(0, limit)) {
+    if (!asset.base64) continue;
+    const mime = asset.mimeType || 'image/jpeg';
+    out.push(await downscaleImage(`data:${mime};base64,${asset.base64}`));
+  }
+  return out;
+}
````

- [ ] **Step 3: Wire the paper grid**

Apply to `artifacts/mobile/app/evaluations/new.tsx`. What it does: a «اقرَأ الأسئلة من صور الورقة» button above the grid; on success the grid takes the **paper's** length (`scannedCount` overrides the count picker, and choosing a count again clears it); every scanned row shows «راجع» until edited; unread marks stay blank so the existing `paperMarksInvalid` check names the row; a rescan over hand-edited rows asks first; a total mismatch is shown in red.

````diff
diff --git a/artifacts/mobile/app/evaluations/new.tsx b/artifacts/mobile/app/evaluations/new.tsx
index 4ba043b..eaf9705 100644
--- a/artifacts/mobile/app/evaluations/new.tsx
+++ b/artifacts/mobile/app/evaluations/new.tsx
@@ -35,6 +35,7 @@ import {
   createEvaluation,
   generateEvaluation,
   listEvaluableBooks,
+  scanPaper,
   setPaperQuestions,
   type CompetencyKey,
   type Difficulty,
@@ -44,6 +45,10 @@ import {
 import type { TranslationKey } from '@/services/i18n';
 import { palette } from '@/constants/colors';
 import { toLatinDigits } from '@/services/latinDigits';
+import { confirm } from '@/services/confirm';
+import { pickMarkSheetPhotos } from '@/services/documents/pick';
+import { blankMarkCount, gridFromScan, totalMismatch } from '@/services/paperScan';
+import { scanErrorKey } from '@/services/scanErrors';
 import { groupObjectivesByLesson } from '@/services/objectiveLessons';
 import { BackButton } from '@/components/ui/BackButton';
 
@@ -103,7 +108,19 @@ const QUESTION_COUNTS = [5, 10, 15, 20, 25, 30];
 type Mode = 'generate' | 'paper';
 
 /** One row of the paper grid, as it sits in the form. */
-type PaperRow = { marks: string; objectiveId: string; competencyKey: CompetencyKey };
+type PaperRow = {
+  marks: string;
+  objectiveId: string;
+  competencyKey: CompetencyKey;
+  /**
+   * Came from a photo of the paper and the teacher has not touched it yet. Set
+   * by a scan, cleared by any edit; `false` means "edited by hand", which is
+   * what makes a rescan ask before it replaces the grid.
+   */
+  review?: boolean;
+};
+/** Pages of one exam a single scan will take. */
+const MAX_SCAN_PAGES = 4;
 
 const COMPETENCIES: CompetencyKey[] = ['knowledge', 'understanding', 'application', 'critical_thinking'];
 const COMPETENCY_KEY: Record<CompetencyKey, TranslationKey> = {
@@ -144,6 +161,11 @@ export default function NewEvaluationScreen() {
   const [title, setTitle] = useState('');
   const [mode, setMode] = useState<Mode>('generate');
   const [paperRows, setPaperRows] = useState<PaperRow[]>([]);
+  /** Set by a scan: the grid is as long as the paper was, not as long as the count picker says. */
+  const [scannedCount, setScannedCount] = useState<number | null>(null);
+  const [printedTotal, setPrintedTotal] = useState<number | null>(null);
+  const [scanning, setScanning] = useState(false);
+  const [scanNote, setScanNote] = useState('');
   const [error, setError] = useState('');
   const [creating, setCreating] = useState(false);
 
@@ -170,7 +192,7 @@ export default function NewEvaluationScreen() {
     if (mode !== 'paper') return;
     const objectiveIds = [...selectedObjectives];
     const fallback = objectiveIds[0] ?? '';
-    const count = QUESTION_COUNTS[countIdx] ?? 10;
+    const count = scannedCount ?? QUESTION_COUNTS[countIdx] ?? 10;
     setPaperRows(prev =>
       Array.from({ length: count }, (_, i): PaperRow => {
         const row = prev[i];
@@ -179,15 +201,59 @@ export default function NewEvaluationScreen() {
           marks: row?.marks ?? DEFAULT_MARKS,
           objectiveId: keepObjective ? row.objectiveId : fallback,
           competencyKey: row?.competencyKey ?? 'understanding',
+          review: row?.review,
         };
       }),
     );
-  }, [mode, countIdx, selectedObjectives]);
+  }, [mode, countIdx, selectedObjectives, scannedCount]);
 
   const setPaperRow = useCallback((index: number, patch: Partial<PaperRow>) => {
-    setPaperRows(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
+    setPaperRows(prev => prev.map((r, i) => (i === index ? { ...r, ...patch, review: false } : r)));
   }, []);
 
+  /**
+   * Fill the grid from photos of the exam paper. Saves nothing: the rows land in
+   * the grid, flagged «راجع», and the existing create path validates them.
+   * Unread marks stay blank, so the grid's own check names the row.
+   */
+  const onScanPaper = async () => {
+    if (scanning) return;
+    if (selectedObjectives.size === 0) {
+      setError(t('paperScanNeedObjective'));
+      return;
+    }
+    const images = await pickMarkSheetPhotos(MAX_SCAN_PAGES);
+    if (images.length === 0) return;
+    if (paperRows.some(r => r.review === false)) {
+      const ok = await confirm({
+        title: t('paperScanReplaceTitle'),
+        message: t('paperScanReplaceBody'),
+        confirmLabel: t('paperScanReplaceConfirm'),
+        cancelLabel: t('cancel'),
+      });
+      if (!ok) return;
+    }
+    setScanning(true);
+    setError('');
+    setScanNote('');
+    try {
+      const res = await scanPaper(images, [...selectedObjectives]);
+      if (res.rows.length === 0) {
+        setScanNote(t('paperScanFoundNothing'));
+        return;
+      }
+      const grid = gridFromScan(res.rows, [...selectedObjectives], 'understanding');
+      setScannedCount(grid.length);
+      setPaperRows(grid);
+      setPrintedTotal(res.printedTotal);
+      setScanNote(t('paperScanFilled', String(grid.length), String(blankMarkCount(grid))));
+    } catch (err) {
+      setError(t(scanErrorKey(err)));
+    } finally {
+      setScanning(false);
+    }
+  };
+
   // Teachers think in lessons, not objectives: the picker lists lessons, and
   // ticking one selects every objective it carries. Downstream (paper rows,
   // create) still works on objective ids, so nothing else moves.
@@ -502,7 +568,12 @@ export default function NewEvaluationScreen() {
           label={t('questionCountLabel')}
           value={String(QUESTION_COUNTS[countIdx])}
           options={QUESTION_COUNTS.map(String)}
-          onChange={setCountIdx}
+          onChange={i => {
+            setCountIdx(i);
+            // Choosing a count is choosing the grid's length again.
+            setScannedCount(null);
+            setPrintedTotal(null);
+          }}
           colors={colors}
           isRTL={isRTL}
           accent={ACCENT}
@@ -516,6 +587,36 @@ export default function NewEvaluationScreen() {
             <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
               {t('paperGridHint')}
             </Text>
+            <Pressable
+              onPress={onScanPaper}
+              disabled={scanning}
+              style={[styles.scanPaperBtn, { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: scanning ? 0.6 : 1 }]}
+            >
+              {scanning ? (
+                <ActivityIndicator size="small" color={ACCENT} />
+              ) : (
+                <Ionicons name="scan-outline" size={18} color={ACCENT} />
+              )}
+              <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, flexShrink: 1, textAlign: 'center' }}>
+                {scanning ? t('paperScanReading') : t('paperScanBtn')}
+              </Text>
+            </Pressable>
+            <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
+              {t('paperScanHint')}
+            </Text>
+            {scanNote ? (
+              <Text style={[styles.hint, { color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
+                {scanNote}
+              </Text>
+            ) : null}
+            {(() => {
+              const mismatch = totalMismatch(paperRows, printedTotal);
+              return mismatch ? (
+                <Text style={[styles.hint, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
+                  {t('paperTotalMismatch', String(mismatch.sum), String(mismatch.printed))}
+                </Text>
+              ) : null;
+            })()}
             {selectedObjectives.size === 0 ? (
               <Text style={[styles.hint, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                 {t('selectAtLeastOneObjective')}
@@ -602,6 +703,9 @@ function PaperRowEditor({
         <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
           {t('paperMarksLabel')}
         </Text>
+        {row.review ? (
+          <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{t('paperRowReview')}</Text>
+        ) : null}
         <TextInput
           value={row.marks}
           onChangeText={v => onChange({ marks: v })}
@@ -701,6 +805,7 @@ const styles = StyleSheet.create({
   modeRow: { gap: 8, marginBottom: 8 },
   modeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
   paperRow: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
+  scanPaperBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 6 },
   paperNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
   paperMarks: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 64, textAlign: 'center', fontSize: 14 },
   compChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
````

- [ ] **Step 4: Typecheck and run the guard suites**

```bash
cd /home/user/Iqraa && pnpm run typecheck
cd artifacts/mobile && pnpm test
```
Expected: typecheck clean; mobile `# fail 0`. If `designScale.test.ts` fails, a `fontSize` is off the `TYPE` scale — change it to a `TYPE` step, do **not** raise the ceiling. If `i18nTerminology.test.ts` fails, an Arabic string contains a bare «اقرأ».

- [ ] **Step 5: Smoke it (manual — the web build)**

```bash
pnpm run dev:mobile:web   # Expo web on :8081
```
Sign in as a teacher → New evaluation → «امتحان ورقي» (paper exam) → pick a book and one lesson → the button appears above the grid. Pressing it with **no lesson ticked** shows «اختر درسًا واحدًا على الأقل…». With a lesson ticked and photos chosen, **live AI off** (the local default) must show «قراءة الصور غير مفعّلة حاليًا…» (`scanUnavailable`) — that is the error path working end to end (`503 live_mode_off` → `scanErrorKey` → Arabic). Report what you saw; do not claim the model read a paper (Global Constraints, and the STATUS entry in Task 11).

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/i18n.ts artifacts/mobile/services/documents/pick.ts artifacts/mobile/app/evaluations/new.tsx
git commit -m "mobile: fill the paper-exam grid from photos of the paper"
```

---

### Task 8: The three-at-a-time runner

**Files:**
- Create: `artifacts/mobile/services/classScanRunner.ts`
- Test: `artifacts/mobile/services/__tests__/classScanRunner.test.ts`

**Interfaces:**
- Consumes: `isBatchStopError`, `isRetryable` (Task 6).
- Produces: `type PhotoOutcome<R> = { state: 'read'; result: R } | { state: 'failed'; error: unknown } | { state: 'not_run' }`; `interface RunnerOptions { concurrency?: number; maxRetries?: number; backoffMs?: (attempt: number) => number; sleep?: (ms: number) => Promise<void>; onStart?: (index: number) => void }`; `scanAll<R>(count: number, scanOne: (index: number) => Promise<R>, onOutcome: (index: number, outcome: PhotoOutcome<R>) => void, opts?: RunnerOptions): Promise<{ stopped: boolean }>`. Every index in `0..count-1` receives **exactly one** outcome.

- [ ] **Step 1: Write the failing test**

Create `artifacts/mobile/services/__tests__/classScanRunner.test.ts`:

````ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scanAll, type PhotoOutcome } from '../classScanRunner.ts';

const noWait = { sleep: async () => {}, backoffMs: () => 0 };

function collect<R>() {
  const outcomes = new Map<number, PhotoOutcome<R>>();
  return { outcomes, on: (i: number, o: PhotoOutcome<R>) => void outcomes.set(i, o) };
}

describe('scanAll', () => {
  it('reads every photo and never has more than three in flight', async () => {
    let inFlight = 0;
    let peak = 0;
    const { outcomes, on } = collect<number>();
    const res = await scanAll(10, async i => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight--;
      return i * 2;
    }, on, noWait);
    assert.equal(peak, 3);
    assert.equal(res.stopped, false);
    assert.equal(outcomes.size, 10);
    for (let i = 0; i < 10; i++) assert.deepEqual(outcomes.get(i), { state: 'read', result: i * 2 });
  });

  it('one bad photo costs one row, not the batch', async () => {
    const { outcomes, on } = collect<string>();
    await scanAll(5, async i => {
      if (i === 2) throw { status: 502, code: 'scan_unavailable' };
      return 'ok';
    }, on, noWait);
    assert.equal(outcomes.get(2)!.state, 'failed');
    assert.deepEqual([0, 1, 3, 4].map(i => outcomes.get(i)!.state), ['read', 'read', 'read', 'read']);
  });

  it('stops on a spent allowance, keeps what was read, and marks the rest not_run', async () => {
    const { outcomes, on } = collect<number>();
    const res = await scanAll(10, async i => {
      if (i === 4) throw { status: 429, code: 'user_quota_exceeded' };
      return i;
    }, on, { ...noWait, concurrency: 1 });
    assert.equal(res.stopped, true);
    assert.equal(outcomes.size, 10, 'every photo ends in exactly one outcome');
    assert.deepEqual([0, 1, 2, 3].map(i => outcomes.get(i)!.state), ['read', 'read', 'read', 'read']);
    assert.equal(outcomes.get(4)!.state, 'failed');
    for (let i = 5; i < 10; i++) assert.equal(outcomes.get(i)!.state, 'not_run');
  });

  it('retries a rate limit after a pause and then succeeds', async () => {
    const slept: number[] = [];
    const tries = new Map<number, number>();
    const { outcomes, on } = collect<string>();
    await scanAll(2, async i => {
      const n = (tries.get(i) ?? 0) + 1;
      tries.set(i, n);
      if (i === 0 && n < 3) throw { status: 429, code: 'rate_limited' };
      return 'ok';
    }, on, { sleep: async ms => void slept.push(ms), backoffMs: a => a * 1000 });
    assert.deepEqual(outcomes.get(0), { state: 'read', result: 'ok' });
    assert.equal(tries.get(0), 3);
    assert.deepEqual(slept, [1000, 2000]);
  });

  it('gives up after the retries and reports the photo as failed — without stopping the batch', async () => {
    const { outcomes, on } = collect<string>();
    const res = await scanAll(3, async i => {
      if (i === 1) throw { status: 429, code: 'rate_limited' };
      return 'ok';
    }, on, { ...noWait, maxRetries: 2 });
    assert.equal(res.stopped, false);
    assert.equal(outcomes.get(1)!.state, 'failed');
    assert.equal(outcomes.get(2)!.state, 'read');
  });

  it('reports a started photo so the table can show it reading', async () => {
    const started: number[] = [];
    await scanAll(3, async () => 'ok', () => {}, { ...noWait, concurrency: 1, onStart: i => void started.push(i) });
    assert.deepEqual(started, [0, 1, 2]);
  });

  it('handles an empty batch', async () => {
    const res = await scanAll(0, async () => 'x', () => assert.fail('no outcome expected'), noWait);
    assert.equal(res.stopped, false);
  });
});
````

- [ ] **Step 2: Run it to verify it fails**

```bash
cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/classScanRunner.test.ts
```
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../classScanRunner.ts`.

- [ ] **Step 3: Implement**

Create `artifacts/mobile/services/classScanRunner.ts`:

````ts
/**
 * Sending a class's photographs to the scan route, a few at a time.
 *
 * One request per photo, so one bad photo costs one row and not the batch. The
 * runner owns three decisions, each of which is a bug if made inline in a
 * screen:
 *
 * - **Bounded concurrency.** Three in flight keeps a class of 30–40 under the
 *   route's per-minute ceiling and gives the model a steady stream.
 * - **A rate limit is "wait", a spent allowance is "stop".** Both are 429. A busy
 *   minute is retried with a pause; a spent allowance (or live mode off) would
 *   fail every remaining photo identically, so the batch stops and keeps
 *   everything already read.
 * - **Nothing is lost.** Every photo ends in exactly one outcome — read, failed,
 *   or `not_run` because the batch stopped before it started.
 */
import { isBatchStopError, isRetryable } from './scanErrors.ts';

export type PhotoOutcome<R> =
  | { state: 'read'; result: R }
  | { state: 'failed'; error: unknown }
  | { state: 'not_run' };

export interface RunnerOptions {
  /** Photos in flight at once. */
  concurrency?: number;
  /** Extra tries after a rate-limited answer. */
  maxRetries?: number;
  /** Pause before retry number `attempt` (1-based), in ms. */
  backoffMs?: (attempt: number) => number;
  sleep?: (ms: number) => Promise<void>;
  /** Called as each photo starts, so the table can show «يقرأ…». */
  onStart?: (index: number) => void;
}

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function scanAll<R>(
  count: number,
  scanOne: (index: number) => Promise<R>,
  onOutcome: (index: number, outcome: PhotoOutcome<R>) => void,
  opts: RunnerOptions = {},
): Promise<{ stopped: boolean }> {
  const concurrency = Math.max(1, opts.concurrency ?? 3);
  const maxRetries = opts.maxRetries ?? 2;
  const backoff = opts.backoffMs ?? (attempt => 10_000 * attempt);
  const sleep = opts.sleep ?? wait;

  let next = 0;
  let stopped = false;

  async function worker(): Promise<void> {
    while (!stopped) {
      const index = next++;
      if (index >= count) return;
      opts.onStart?.(index);
      for (let attempt = 0; ; attempt++) {
        try {
          onOutcome(index, { state: 'read', result: await scanOne(index) });
          break;
        } catch (error) {
          if (isRetryable(error) && attempt < maxRetries) {
            await sleep(backoff(attempt + 1));
            continue;
          }
          if (isBatchStopError(error)) stopped = true;
          onOutcome(index, { state: 'failed', error });
          break;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, worker));

  // Whatever was never picked up because the batch stopped.
  for (let i = next; i < count; i++) onOutcome(i, { state: 'not_run' });
  return { stopped };
}
````

- [ ] **Step 4: Run it to verify it passes**

Same command. Expected: `# tests 7`, `# pass 7`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/classScanRunner.ts artifacts/mobile/services/__tests__/classScanRunner.test.ts
git commit -m "mobile: send class photos three at a time; retry a busy minute, stop on a spent allowance"
```

---

### Task 9: Review-table rules and the save loop

**Files:**
- Create: `artifacts/mobile/services/classScanReview.ts`, `artifacts/mobile/services/classScanSave.ts`
- Test: `artifacts/mobile/services/__tests__/classScanReview.test.ts`, `artifacts/mobile/services/__tests__/classScanSave.test.ts`

**Interfaces:**
- Consumes: `ClassScanResponse`, `ScanCandidate`, `ScanMatchStatus` (types, Task 6); `toLatinDigits` (`./latinDigits.ts`).
- Produces from `classScanReview.ts`: `type RowState`, `interface ReviewQuestion { id; number; maxMarks }`, `interface ReviewRow`, `interface ReviewContext { questions: readonly ReviewQuestion[]; hasAttempt: ReadonlySet<string> }`, `newRow(key)`, `rowFromScan(row, res)`, `assignStudent(row, studentId|null)`, `setMark(row, questionId, text)`, `parseMark(text, max): MarkParse`, `rowTotal(row, questions)`, `reportRows(rows, ctx): Map<string, RowReport>`, `savableRows`, `canSave`, `saveSummary`, `isSavableState`, `type Blocker`, `type Flag`, `interface RowReport`.
- Produces from `classScanSave.ts`: `interface SaveDeps { startAttempt(evaluationId, studentId): Promise<{ attemptId: string; created: boolean }>; setGrade(attemptId, questionId, marks: number): Promise<void>; submit(attemptId): Promise<void> }`; `saveRows(evaluationId, rows, ctx, deps, onPatch): Promise<void>`.

The two safeguards in `saveRows` (Global Constraints) are the reason this task exists: **never write into a paper it did not create**, and **a retry reuses the remembered `attemptId`**. The tests named «NEVER writes into a paper it did not create» and «RETRY after a half-failed save…» are the ones to read first.

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/classScanReview.test.ts`:

````ts
/**
 * The rules that stop a class scan putting marks on the wrong child.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assignStudent,
  canSave,
  newRow,
  parseMark,
  reportRows,
  rowFromScan,
  rowTotal,
  saveSummary,
  savableRows,
  setMark,
  type ReviewContext,
  type ReviewRow,
} from '../classScanReview.ts';
import type { ClassScanResponse } from '../evaluations.ts';

const QS = [
  { id: 'q1', number: 1, maxMarks: 5 },
  { id: 'q2', number: 2, maxMarks: 10 },
];
const ctx = (hasAttempt: string[] = []): ReviewContext => ({ questions: QS, hasAttempt: new Set(hasAttempt) });

const scan = (over: Partial<ClassScanResponse> = {}): ClassScanResponse => ({
  nameRead: 'سارة أحمد',
  match: { status: 'confident', studentId: 's1', candidates: [{ studentId: 's1', displayName: 'سارة أحمد', score: 1, hasAttempt: false }] },
  proposals: [
    { questionId: 'q1', number: 1, awardedMarks: 4, readAs: '4' },
    { questionId: 'q2', number: 2, awardedMarks: 7.5, readAs: '٧٫٥' },
  ],
  skipped: [],
  writtenTotal: 11.5,
  model: 'm',
  saved: false,
  ...over,
});

const read = (key: string, over: Partial<ReviewRow> = {}): ReviewRow => ({
  ...rowFromScan(newRow(key), scan()),
  ...over,
});

describe('parseMark', () => {
  it('reads Latin and Arabic-Indic digits and the decimal marks teachers type', () => {
    assert.deepEqual(parseMark('4', 5), { kind: 'ok', value: 4 });
    assert.deepEqual(parseMark('٤', 5), { kind: 'ok', value: 4 });
    assert.deepEqual(parseMark('٣٫٥', 5), { kind: 'ok', value: 3.5 });
    assert.deepEqual(parseMark('3,5', 5), { kind: 'ok', value: 3.5 });
    assert.deepEqual(parseMark(' 0 ', 5), { kind: 'ok', value: 0 });
  });

  it('blank is blank — never zero', () => {
    assert.deepEqual(parseMark('', 5), { kind: 'blank' });
    assert.deepEqual(parseMark('   ', 5), { kind: 'blank' });
  });

  it('rejects out-of-range and non-numbers instead of clamping', () => {
    for (const bad of ['6', '5.01', '-1', 'abc', '1.234', '1/2', '٦']) {
      assert.deepEqual(parseMark(bad, 5), { kind: 'invalid' }, bad);
    }
  });
});

describe('rowFromScan', () => {
  it('a confident match arrives assigned, with the marks in the boxes', () => {
    const r = read('a');
    assert.equal(r.state, 'read');
    assert.equal(r.studentId, 's1');
    assert.deepEqual(r.marks, { q1: '4', q2: '7.5' });
  });

  it('a confirm or none match arrives UNASSIGNED — nothing is chosen without a tap', () => {
    for (const status of ['confirm', 'none'] as const) {
      const r = rowFromScan(newRow('a'), scan({ match: { status, studentId: null, candidates: [] } }));
      assert.equal(r.studentId, null, status);
    }
  });

  it('a question the scan did not read has no entry — blank, not zero', () => {
    const r = rowFromScan(newRow('a'), scan({ proposals: [{ questionId: 'q1', number: 1, awardedMarks: 4, readAs: '4' }] }));
    assert.equal(r.marks['q2'], undefined);
  });
});

describe('reportRows — blockers', () => {
  it('blocks a row with no student', () => {
    const r = assignStudent(read('a'), null);
    assert.deepEqual(reportRows([r], ctx()).get('a')!.blockers, ['no_student']);
    assert.equal(canSave([r], ctx()), false);
  });

  it('blocks BOTH rows when two papers are assigned to one student', () => {
    const rows = [read('a'), read('b')];
    const report = reportRows(rows, ctx());
    assert.deepEqual(report.get('a')!.blockers, ['duplicate_student']);
    assert.deepEqual(report.get('b')!.blockers, ['duplicate_student']);
    assert.equal(canSave(rows, ctx()), false);
    // Reassigning one clears both.
    assert.equal(canSave([rows[0]!, assignStudent(rows[1]!, 's2')], ctx()), true);
  });

  it('blocks a box holding an invalid mark', () => {
    const r = setMark(read('a'), 'q1', '9');
    assert.deepEqual(reportRows([r], ctx()).get('a')!.blockers, ['mark_invalid']);
    assert.equal(canSave([r], ctx()), false);
  });

  it('only rows that can be saved are judged — a failed photo blocks nothing', () => {
    const failed: ReviewRow = { ...newRow('f'), state: 'failed' };
    assert.equal(reportRows([failed], ctx()).has('f'), false);
    assert.equal(canSave([failed, read('a')], ctx()), true);
  });
});

describe('reportRows — flags, which never block', () => {
  it('flags a student who already has a paper, skips them, and does not block', () => {
    const r = read('a');
    const report = reportRows([r], ctx(['s1'])).get('a')!;
    assert.deepEqual(report.flags, ['has_attempt']);
    assert.deepEqual(report.blockers, []);
    assert.deepEqual(savableRows([r], ctx(['s1'])), []);
    // Nothing to write, so there is nothing to save.
    assert.equal(canSave([r], ctx(['s1'])), false);
  });

  it('two papers for a student who already has one do not block each other', () => {
    assert.equal(reportRows([read('a'), read('b')], ctx(['s1'])).get('a')!.blockers.length, 0);
  });

  it('flags blank cells but still allows the save', () => {
    const r = setMark(read('a'), 'q2', '');
    const report = reportRows([r], ctx()).get('a')!;
    assert.ok(report.flags.includes('blank_cells'));
    assert.equal(canSave([r], ctx()), true);
  });

  it('flags a total that disagrees with the one written on the paper', () => {
    assert.deepEqual(reportRows([read('a')], ctx()).get('a')!.flags, []);
    const off = setMark(read('a'), 'q1', '5');
    assert.ok(reportRows([off], ctx()).get('a')!.flags.includes('total_mismatch'));
  });

  it('does not flag a mismatch when the paper wrote no total', () => {
    const r = read('a', { writtenTotal: null });
    assert.ok(!reportRows([r], ctx()).get('a')!.flags.includes('total_mismatch'));
  });
});

describe('setMark', () => {
  it('forgets that the question was already written, so a retry writes the corrected mark', () => {
    const r = setMark(read('a', { savedQuestionIds: ['q1', 'q2'] }), 'q1', '3');
    assert.deepEqual(r.savedQuestionIds, ['q2']);
    assert.equal(r.marks['q1'], '3');
  });
});

describe('rowTotal and saveSummary', () => {
  it('totals only the valid boxes', () => {
    assert.equal(rowTotal(read('a'), QS), 11.5);
    assert.equal(rowTotal(setMark(read('a'), 'q2', 'x'), QS), 4);
  });

  it('summarises what was saved, skipped and needs attention', () => {
    const rows: ReviewRow[] = [
      { ...newRow('1'), state: 'saved' },
      { ...newRow('2'), state: 'saved' },
      { ...newRow('3'), state: 'skipped_existing' },
      { ...newRow('4'), state: 'save_failed' },
      { ...newRow('5'), state: 'failed' },
      { ...newRow('6'), state: 'not_run' },
    ];
    assert.deepEqual(saveSummary(rows), { saved: 2, needAttention: 3, skipped: 1 });
  });
});
````

Create `artifacts/mobile/services/__tests__/classScanSave.test.ts`:

````ts
/**
 * Saving a class scan must never overwrite a paper it did not create, and a
 * retry must never skip a paper it did.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { saveRows, type SaveDeps } from '../classScanSave.ts';
import { newRow, rowFromScan, type ReviewContext, type ReviewRow } from '../classScanReview.ts';
import type { ClassScanResponse } from '../evaluations.ts';

const QS = [
  { id: 'q1', number: 1, maxMarks: 5 },
  { id: 'q2', number: 2, maxMarks: 10 },
];
const ctx = (hasAttempt: string[] = []): ReviewContext => ({ questions: QS, hasAttempt: new Set(hasAttempt) });

const scan = (studentId: string, marks: Record<string, number>): ClassScanResponse => ({
  nameRead: 'x',
  match: { status: 'confident', studentId, candidates: [] },
  proposals: Object.entries(marks).map(([questionId, awardedMarks], i) => ({ questionId, number: i + 1, awardedMarks, readAs: String(awardedMarks) })),
  skipped: [],
  writtenTotal: null,
  model: 'm',
  saved: false,
});
const row = (key: string, studentId: string, marks: Record<string, number> = { q1: 4, q2: 7 }) =>
  rowFromScan(newRow(key), scan(studentId, marks));

function fakeDeps(over: Partial<SaveDeps> = {}) {
  const calls: string[] = [];
  const deps: SaveDeps = {
    async startAttempt(_e, studentId) { calls.push(`start:${studentId}`); return { attemptId: `att-${studentId}`, created: true }; },
    async setGrade(a, q, m) { calls.push(`grade:${a}:${q}:${m}`); },
    async submit(a) { calls.push(`submit:${a}`); },
    ...over,
  };
  return { deps, calls };
}

/** Apply patches the way the screen's state does, so a second call sees them. */
function store(rows: ReviewRow[]) {
  const byKey = new Map(rows.map(r => [r.key, r]));
  return {
    onPatch: (key: string, patch: Partial<ReviewRow>) => byKey.set(key, { ...byKey.get(key)!, ...patch }),
    get: (key: string) => byKey.get(key)!,
    all: () => [...byKey.values()],
  };
}

describe('saveRows', () => {
  it('starts, marks every filled box, then submits — in that order', async () => {
    const { deps, calls } = fakeDeps();
    const s = store([row('a', 's1')]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.deepEqual(calls, ['start:s1', 'grade:att-s1:q1:4', 'grade:att-s1:q2:7', 'submit:att-s1']);
    assert.equal(s.get('a').state, 'saved');
  });

  it('leaves a blank box unmarked — it writes no zero', async () => {
    const { deps, calls } = fakeDeps();
    const s = store([row('a', 's1', { q1: 4 })]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.deepEqual(calls, ['start:s1', 'grade:att-s1:q1:4', 'submit:att-s1']);
  });

  it('NEVER writes into a paper it did not create', async () => {
    const { deps, calls } = fakeDeps({
      async startAttempt() { calls.push('start'); return { attemptId: 'theirs', created: false }; },
    });
    const s = store([row('a', 's1')]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.deepEqual(calls, ['start'], 'no grade, no submit');
    assert.equal(s.get('a').state, 'skipped_existing');
  });

  it('skips a student the screen already knew had a paper, without even starting', async () => {
    const { deps, calls } = fakeDeps();
    const s = store([row('a', 's1')]);
    await saveRows('e1', s.all(), ctx(['s1']), deps, s.onPatch);
    assert.deepEqual(calls, []);
    assert.equal(s.get('a').state, 'skipped_existing');
  });

  it('a failure on one row does not stop the others', async () => {
    const { deps, calls } = fakeDeps({
      async setGrade(a, q, m) { if (a === 'att-s1') throw new Error('boom'); calls.push(`grade:${a}:${q}:${m}`); },
    });
    const s = store([row('a', 's1'), row('b', 's2')]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.equal(s.get('a').state, 'save_failed');
    assert.equal(s.get('a').error, 'boom');
    assert.equal(s.get('b').state, 'saved');
  });

  it('RETRY after a half-failed save reuses the paper it made instead of skipping it', async () => {
    let failOnce = true;
    const { deps, calls } = fakeDeps({
      async setGrade(a, q, m) {
        if (q === 'q2' && failOnce) { failOnce = false; throw new Error('network'); }
        calls.push(`grade:${a}:${q}:${m}`);
      },
      async startAttempt(_e, studentId) {
        calls.push(`start:${studentId}`);
        // The second time, the paper exists because of THIS batch.
        return { attemptId: 'att-s1', created: calls.filter(c => c.startsWith('start')).length === 1 };
      },
    });
    const s = store([row('a', 's1')]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.equal(s.get('a').state, 'save_failed');
    assert.equal(s.get('a').attemptId, 'att-s1');
    assert.deepEqual(s.get('a').savedQuestionIds, ['q1']);

    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.equal(s.get('a').state, 'saved', 'the retry must not skip its own paper');
    assert.equal(calls.filter(c => c.startsWith('start')).length, 1, 'start is not called again');
    assert.equal(calls.filter(c => c === 'grade:att-s1:q1:4').length, 1, 'q1 is not written twice');
    assert.ok(calls.includes('grade:att-s1:q2:7'));
  });

  it('a failed submit retries just the submit', async () => {
    let failOnce = true;
    const { deps, calls } = fakeDeps({
      async submit(a) { if (failOnce) { failOnce = false; throw new Error('x'); } calls.push(`submit:${a}`); },
    });
    const s = store([row('a', 's1')]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.equal(s.get('a').state, 'saved');
    assert.equal(calls.filter(c => c.startsWith('grade')).length, 2, 'each mark written once');
    assert.equal(calls.filter(c => c.startsWith('submit')).length, 1);
  });

  it('ignores rows that are not ready: unassigned, failed photos, already saved', async () => {
    const { deps, calls } = fakeDeps();
    const unassigned = { ...row('a', 's1'), studentId: null };
    const failed: ReviewRow = { ...newRow('f'), state: 'failed' };
    const saved: ReviewRow = { ...row('s', 's9'), state: 'saved' };
    const s = store([unassigned, failed, saved]);
    await saveRows('e1', s.all(), ctx(), deps, s.onPatch);
    assert.deepEqual(calls, []);
  });
});
````

- [ ] **Step 2: Run them to verify they fail**

```bash
cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/classScanReview.test.ts services/__tests__/classScanSave.test.ts
```
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../classScanReview.ts` / `../classScanSave.ts`.

- [ ] **Step 3: Implement**

Create `artifacts/mobile/services/classScanReview.ts`:

````ts
/**
 * The review table for a scanned class: one row per photograph.
 *
 * Everything the screen decides about a row lives here as a pure function, so
 * the rules that protect a child's marks are tested rather than buried in JSX:
 * which rows block a save, which are only flagged, and what a row remembers so
 * a retry does not repeat or skip work.
 *
 * A row *blocks* the save when saving it would put marks on the wrong child or
 * store a number that is not a mark: no student chosen, two papers for one
 * student, a box that does not hold a valid mark. A row is only *flagged* when
 * saving is safe but the teacher should know: the student already has a paper
 * (it is skipped, never overwritten), cells are blank (saved as unmarked), or
 * the marks do not add up to the total written on the paper.
 *
 * Free of react-native so `node --test` can load it.
 */
import { toLatinDigits } from './latinDigits.ts';
import type { ClassScanResponse, ScanCandidate, ScanMatchStatus } from './evaluations.ts';

export type RowState =
  | 'queued'
  | 'reading'
  | 'read'
  | 'failed'
  | 'not_run'
  | 'saved'
  | 'save_failed'
  | 'skipped_existing';

export interface ReviewQuestion {
  id: string;
  /** 1-based, as on the paper. */
  number: number;
  maxMarks: number;
}

export interface ReviewRow {
  /** Stable per photograph, so state updates find their row after a re-render. */
  key: string;
  state: RowState;
  /** Null until a student is assigned — a `confirm` or `none` row starts here. */
  studentId: string | null;
  matchStatus: ScanMatchStatus | null;
  nameRead: string | null;
  candidates: ScanCandidate[];
  /** Text in each question's box, by question id. Blank means unmarked, never zero. */
  marks: Record<string, string>;
  writtenTotal: number | null;
  /** Remembered after the first successful start, so a retry never starts again. */
  attemptId: string | null;
  /** Questions whose mark has been written, so a retry does not repeat them. */
  savedQuestionIds: string[];
  /** A scan-error key while reading, or the save error afterwards. */
  error: string | null;
}

export interface ReviewContext {
  questions: readonly ReviewQuestion[];
  /** Students who already have a paper for this exam. */
  hasAttempt: ReadonlySet<string>;
}

export function newRow(key: string): ReviewRow {
  return {
    key,
    state: 'queued',
    studentId: null,
    matchStatus: null,
    nameRead: null,
    candidates: [],
    marks: {},
    writtenTotal: null,
    attemptId: null,
    savedQuestionIds: [],
    error: null,
  };
}

/** A photograph came back read. Only a `confident` match arrives assigned. */
export function rowFromScan(row: ReviewRow, res: ClassScanResponse): ReviewRow {
  const marks: Record<string, string> = {};
  for (const p of res.proposals) marks[p.questionId] = String(p.awardedMarks);
  return {
    ...row,
    state: 'read',
    studentId: res.match.status === 'confident' ? res.match.studentId : null,
    matchStatus: res.match.status,
    nameRead: res.nameRead,
    candidates: res.match.candidates,
    marks,
    writtenTotal: res.writtenTotal,
    error: null,
  };
}

export function assignStudent(row: ReviewRow, studentId: string | null): ReviewRow {
  return { ...row, studentId };
}

/**
 * Edit a box. An edit invalidates that question's "already written" memory, so
 * a retry after a half-failed save writes the corrected number, not the old one.
 */
export function setMark(row: ReviewRow, questionId: string, text: string): ReviewRow {
  return {
    ...row,
    marks: { ...row.marks, [questionId]: text },
    savedQuestionIds: row.savedQuestionIds.filter(id => id !== questionId),
  };
}

export type MarkParse = { kind: 'blank' } | { kind: 'ok'; value: number } | { kind: 'invalid' };

/** A box's text as a mark: Arabic digits and `٫`/`,` decimals accepted, range-checked. */
export function parseMark(text: string, max: number): MarkParse {
  const t = toLatinDigits(text).trim().replace(/[٫,،]/g, '.');
  if (t === '') return { kind: 'blank' };
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { kind: 'invalid' };
  const value = Number(t);
  return value > max ? { kind: 'invalid' } : { kind: 'ok', value };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function rowTotal(row: ReviewRow, questions: readonly ReviewQuestion[]): number {
  let sum = 0;
  for (const q of questions) {
    const parsed = parseMark(row.marks[q.id] ?? '', q.maxMarks);
    if (parsed.kind === 'ok') sum += parsed.value;
  }
  return round2(sum);
}

export type Blocker = 'no_student' | 'duplicate_student' | 'mark_invalid';
export type Flag = 'has_attempt' | 'blank_cells' | 'total_mismatch';
export interface RowReport {
  blockers: Blocker[];
  flags: Flag[];
}

/** States a row can be saved from. A retry of a failed save is a save. */
const SAVABLE: readonly RowState[] = ['read', 'save_failed'];
export const isSavableState = (s: RowState): boolean => SAVABLE.includes(s);

export function reportRows(
  rows: readonly ReviewRow[],
  ctx: ReviewContext,
): Map<string, RowReport> {
  const live = rows.filter(r => isSavableState(r.state));

  // A student with a paper already is skipped whatever the row says, so those
  // rows take no part in the duplicate check or the blockers.
  const claims = new Map<string, number>();
  for (const r of live) {
    if (r.studentId && !ctx.hasAttempt.has(r.studentId)) {
      claims.set(r.studentId, (claims.get(r.studentId) ?? 0) + 1);
    }
  }

  const out = new Map<string, RowReport>();
  for (const r of live) {
    const report: RowReport = { blockers: [], flags: [] };
    if (!r.studentId) {
      report.blockers.push('no_student');
    } else if (ctx.hasAttempt.has(r.studentId)) {
      report.flags.push('has_attempt');
    } else {
      if ((claims.get(r.studentId) ?? 0) > 1) report.blockers.push('duplicate_student');
      let blank = false;
      let invalid = false;
      for (const q of ctx.questions) {
        const parsed = parseMark(r.marks[q.id] ?? '', q.maxMarks);
        if (parsed.kind === 'blank') blank = true;
        if (parsed.kind === 'invalid') invalid = true;
      }
      if (invalid) report.blockers.push('mark_invalid');
      if (blank) report.flags.push('blank_cells');
      if (r.writtenTotal !== null && Math.abs(rowTotal(r, ctx.questions) - r.writtenTotal) >= 0.005) {
        report.flags.push('total_mismatch');
      }
    }
    out.set(r.key, report);
  }
  return out;
}

/** Rows the save will actually write: assigned, and not already sat. */
export function savableRows(rows: readonly ReviewRow[], ctx: ReviewContext): ReviewRow[] {
  return rows.filter(
    r => isSavableState(r.state) && r.studentId !== null && !ctx.hasAttempt.has(r.studentId),
  );
}

/** Save is allowed when nothing blocks and there is something to write. */
export function canSave(rows: readonly ReviewRow[], ctx: ReviewContext): boolean {
  const reports = reportRows(rows, ctx);
  for (const report of reports.values()) if (report.blockers.length > 0) return false;
  return savableRows(rows, ctx).length > 0;
}

export function saveSummary(rows: readonly ReviewRow[]): {
  saved: number;
  needAttention: number;
  skipped: number;
} {
  let saved = 0;
  let needAttention = 0;
  let skipped = 0;
  for (const r of rows) {
    if (r.state === 'saved') saved++;
    else if (r.state === 'skipped_existing') skipped++;
    else if (r.state === 'save_failed' || r.state === 'failed' || r.state === 'not_run') needAttention++;
  }
  return { saved, needAttention, skipped };
}
````

Create `artifacts/mobile/services/classScanSave.ts`:

````ts
/**
 * Saving a reviewed class scan, through the endpoints a teacher already uses.
 *
 * `startAttempt` is find-or-create and the marking endpoint upserts, so two
 * things that look harmless are not:
 *
 * 1. **Writing into a paper this batch did not create.** If the student already
 *    had a paper, `created` is false, and writing the scan into it would replace
 *    a mark a teacher entered or a student earned. A row in that state is skipped
 *    and nothing is written.
 * 2. **Retrying with `startAttempt` again.** If a save fails half-way, the paper
 *    now exists *because of this batch*; a second `startAttempt` reports
 *    `created: false` and the retry would wrongly skip its own paper. The row
 *    remembers `attemptId` from the first success, and a retry never starts again.
 *
 * Rows are saved one after another: the order is the teacher's, the load on the
 * API is the same as typing the marks, and a failure is easy to attribute.
 */
import { parseMark, type ReviewContext, type ReviewRow } from './classScanReview.ts';

export interface SaveDeps {
  startAttempt(evaluationId: string, studentId: string): Promise<{ attemptId: string; created: boolean }>;
  setGrade(attemptId: string, questionId: string, marks: number): Promise<void>;
  submit(attemptId: string): Promise<void>;
}

export async function saveRows(
  evaluationId: string,
  rows: readonly ReviewRow[],
  ctx: ReviewContext,
  deps: SaveDeps,
  onPatch: (key: string, patch: Partial<ReviewRow>) => void,
): Promise<void> {
  for (const row of rows) {
    if (row.state !== 'read' && row.state !== 'save_failed') continue;
    if (!row.studentId) continue;
    if (ctx.hasAttempt.has(row.studentId)) {
      onPatch(row.key, { state: 'skipped_existing' });
      continue;
    }

    try {
      let attemptId = row.attemptId;
      if (!attemptId) {
        const started = await deps.startAttempt(evaluationId, row.studentId);
        if (!started.created) {
          onPatch(row.key, { state: 'skipped_existing' });
          continue;
        }
        attemptId = started.attemptId;
        onPatch(row.key, { attemptId });
      }

      const written = new Set(row.savedQuestionIds);
      for (const q of ctx.questions) {
        if (written.has(q.id)) continue;
        const parsed = parseMark(row.marks[q.id] ?? '', q.maxMarks);
        // Blank stays unmarked and invalid cannot get here (it blocks the save).
        if (parsed.kind !== 'ok') continue;
        await deps.setGrade(attemptId, q.id, parsed.value);
        written.add(q.id);
        onPatch(row.key, { savedQuestionIds: [...written] });
      }

      await deps.submit(attemptId);
      onPatch(row.key, { state: 'saved', error: null });
    } catch (err) {
      onPatch(row.key, {
        state: 'save_failed',
        error: err instanceof Error ? err.message : 'save failed',
      });
    }
  }
}
````

- [ ] **Step 4: Run them to verify they pass**

Same command. Expected: `# tests 26`, `# pass 26`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/classScanReview.ts artifacts/mobile/services/classScanSave.ts artifacts/mobile/services/__tests__/classScanReview.test.ts artifacts/mobile/services/__tests__/classScanSave.test.ts
git commit -m "mobile: class-scan review rules and a save loop that never overwrites or skips its own paper"
```

---

### Task 10: The class-scan screen and its entry

No unit test: the screen holds no rules (they are Tasks 8–9). Verification is typecheck, the full mobile suite, and the manual smoke below.

**Files:**
- Create: `artifacts/mobile/app/evaluations/[id]/scan-class.tsx`
- Modify: `artifacts/mobile/app/evaluations/[id]/index.tsx`

**Interfaces:**
- Consumes: `scanAll` (Task 8); `reportRows`, `canSave`, `saveSummary`, `rowFromScan`, `newRow`, `assignStudent`, `setMark` (Task 9); `saveRows`, `SaveDeps` (Task 9); `scanClassPaper`, `startAttemptChecked`, `setQuestionGrade`, `submitAttempt`, `getEvaluation`, `listAttempts` (`@/services/evaluations`); `pickMarkSheetPhotos` (Task 7); `getClass`, `filterToAudience` (existing); every `classScan*` string (Task 7).
- Produces: route `/evaluations/[id]/scan-class`; a button on the published evaluation screen, shown only when **every** question is a paper question (`isPaperQuestion` from `@/services/paperQuestion`) — a generated exam marks itself, and a scan would write teacher marks over that.

- [ ] **Step 1: Create the screen**

Create `artifacts/mobile/app/evaluations/[id]/scan-class.tsx`:

````tsx
/**
 * Scan the class — photograph each student's marked paper, check the table,
 * save the lot.
 *
 * The screen holds no rules. What blocks a save, what only warns, and what a
 * retry must remember live in `services/classScanReview.ts` and
 * `classScanSave.ts`, where they are tested; the runner that sends photos three
 * at a time lives in `classScanRunner.ts`. This file only wires them to views.
 *
 * Nothing here writes until «احفظ العلامات»: the scan returns proposals, they
 * land in boxes, and the ordinary start-attempt and marking endpoints do the
 * saving. Photos live in this component's memory and nowhere else.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { palette } from '@/constants/colors';
import { BackButton } from '@/components/ui/BackButton';
import { PickerField } from '@/components/ui/PickerField';
import { getClass, type RosterStudent } from '@/services/roster';
import {
  getEvaluation,
  listAttempts,
  scanClassPaper,
  setQuestionGrade,
  startAttemptChecked,
  submitAttempt,
} from '@/services/evaluations';
import { pickMarkSheetPhotos } from '@/services/documents/pick';
import { scanAll } from '@/services/classScanRunner';
import { isBatchStopError, scanErrorKey, type ScanErrorKey } from '@/services/scanErrors';
import { saveRows, type SaveDeps } from '@/services/classScanSave';
import {
  assignStudent,
  canSave,
  newRow,
  reportRows,
  rowFromScan,
  rowTotal,
  saveSummary,
  setMark,
  type ReviewContext,
  type ReviewQuestion,
  type ReviewRow,
  type RowReport,
} from '@/services/classScanReview';
import { filterToAudience } from '@/services/supportGroups';

const ACCENT = palette.primary;
/** Solid fills carry white text: `hero` stays deep enough for that in dark mode. */
const ACCENT_FILL = palette.hero;
/** One class in one sitting; also the route's own per-minute budget in practice. */
const MAX_PHOTOS = 40;

/** The three calls a save makes, adapted to the shapes `saveRows` expects. */
const SAVE_DEPS: SaveDeps = {
  async startAttempt(evaluationId, studentId) {
    const { attempt, created } = await startAttemptChecked(evaluationId, studentId);
    return { attemptId: attempt.id, created };
  },
  async setGrade(attemptId, questionId, marks) {
    await setQuestionGrade(attemptId, questionId, { awardedMarks: marks });
  },
  async submit(attemptId) {
    await submitAttempt(attemptId);
  },
};

export default function ScanClassScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [hasAttempt, setHasAttempt] = useState<Set<string>>(new Set());
  const [photos, setPhotos] = useState<string[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  // The save loop reads the rows as they are when it starts; a ref keeps that
  // read current without making the loop re-create on every keystroke.
  const rowsRef = useRef<ReviewRow[]>([]);
  rowsRef.current = rows;

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [data, attempts] = await Promise.all([getEvaluation(id), listAttempts(id)]);
        if (!data.evaluation.classGroupId) {
          setLoadError(t('scanNoClass'));
          return;
        }
        if (data.evaluation.status !== 'published') {
          setLoadError(t('scanNotPublished'));
          return;
        }
        const { students } = await getClass(data.evaluation.classGroupId);
        setRoster(filterToAudience(students, data.audience));
        // Numbered in the same order the server numbers them for the model.
        setQuestions(data.questions.map((q, i) => ({ id: q.id, number: i + 1, maxMarks: Number(q.marks) })));
        setHasAttempt(new Set(attempts.map(a => a.studentId)));
      } catch {
        setLoadError(t('classScanLoadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t]);

  const ctx = useMemo<ReviewContext>(() => ({ questions, hasAttempt }), [questions, hasAttempt]);
  const reports = useMemo(() => reportRows(rows, ctx), [rows, ctx]);
  const summary = useMemo(() => saveSummary(rows), [rows]);

  const patchRow = useCallback((key: string, patch: Partial<ReviewRow>) => {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch } : r)));
  }, []);
  const updateRow = useCallback((key: string, fn: (r: ReviewRow) => ReviewRow) => {
    setRows(prev => prev.map(r => (r.key === key ? fn(r) : r)));
  }, []);

  const onPick = async () => {
    if (!id || reading || saving) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      setNote(t('classScanTooMany', String(MAX_PHOTOS)));
      return;
    }
    const picked = await pickMarkSheetPhotos(room);
    if (picked.length === 0) return;

    const offset = photos.length;
    setPhotos(prev => [...prev, ...picked]);
    setRows(prev => [...prev, ...picked.map((_, i) => newRow(`p${offset + i}`))]);
    setReading(true);
    setNote('');
    try {
      await scanAll(
        picked.length,
        i => scanClassPaper(id, picked[i]!),
        (i, outcome) => {
          const key = `p${offset + i}`;
          if (outcome.state === 'read') {
            updateRow(key, r => rowFromScan(r, outcome.result));
          } else if (outcome.state === 'failed') {
            patchRow(key, { state: 'failed', error: scanErrorKey(outcome.error) });
            // Say why the batch stopped, once, in the teacher's language.
            if (isBatchStopError(outcome.error)) setNote(t(scanErrorKey(outcome.error)));
          } else {
            patchRow(key, { state: 'not_run' });
          }
        },
        { onStart: i => patchRow(`p${offset + i}`, { state: 'reading' }) },
      );
    } finally {
      setReading(false);
    }
  };

  const onSave = async () => {
    if (!id || saving || reading || !canSave(rowsRef.current, ctx)) return;
    setSaving(true);
    try {
      await saveRows(id, rowsRef.current, ctx, SAVE_DEPS, patchRow);
      // A student saved now has a paper: a later stray photo of theirs is
      // flagged instead of being started a second time.
      const done = rowsRef.current.filter(r => r.state === 'saved' && r.studentId).map(r => r.studentId!);
      setHasAttempt(prev => new Set([...prev, ...done]));
    } finally {
      setSaving(false);
    }
  };

  const readCount = rows.filter(r => r.state !== 'queued' && r.state !== 'reading').length;
  const savedAny = summary.saved + summary.needAttention + summary.skipped > 0;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 80 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.hero, { backgroundColor: ACCENT_FILL, paddingTop: insets.top + 12 }]}>
        <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start' }} />
        <Text style={[styles.heroTitle, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t('classScanTitle')}
        </Text>
      </View>

      <View style={{ padding: 20, gap: 12 }}>
        {loadError ? (
          <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }}>{loadError}</Text>
        ) : (
          <>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, textAlign: align }}>
              {t('classScanHint')}
            </Text>

            <Pressable
              onPress={onPick}
              disabled={reading || saving}
              style={[styles.pickBtn, { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: reading || saving ? 0.6 : 1 }]}
            >
              {reading ? <ActivityIndicator size="small" color={ACCENT} /> : <Ionicons name="images-outline" size={18} color={ACCENT} />}
              <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>
                {reading ? t('classScanProgress', String(readCount), String(rows.length)) : t('classScanPickBtn')}
              </Text>
            </Pressable>

            {note ? (
              <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }}>{note}</Text>
            ) : null}

            {rows.map((row, index) => (
              <RowCard
                key={row.key}
                row={row}
                index={index}
                photo={photos[index]}
                questions={questions}
                roster={roster}
                report={reports.get(row.key)}
                disabled={saving || reading}
                onAssign={studentId => updateRow(row.key, r => assignStudent(r, studentId))}
                onMark={(questionId, text) => updateRow(row.key, r => setMark(r, questionId, text))}
                onOpenStudent={studentId =>
                  router.push({ pathname: '/evaluations/[id]/answers/[studentId]', params: { id: id as string, studentId } })
                }
                colors={colors}
                isRTL={isRTL}
                align={align}
                t={t}
              />
            ))}

            {rows.length > 0 && (
              <>
                {savedAny ? (
                  <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: align }}>
                    {t('classScanSummary', String(summary.saved), String(summary.needAttention), String(summary.skipped))}
                  </Text>
                ) : null}
                <Pressable
                  onPress={onSave}
                  disabled={saving || reading || !canSave(rows, ctx)}
                  style={[styles.saveBtn, { backgroundColor: ACCENT_FILL, opacity: saving || reading || !canSave(rows, ctx) ? 0.5 : 1 }]}
                >
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : null}
                  <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 15 }}>
                    {saving ? t('classScanSaving') : t('classScanSaveBtn')}
                  </Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function RowCard({
  row, index, photo, questions, roster, report, disabled, onAssign, onMark, onOpenStudent, colors, isRTL, align, t,
}: {
  row: ReviewRow;
  index: number;
  photo: string | undefined;
  questions: ReviewQuestion[];
  roster: RosterStudent[];
  report: RowReport | undefined;
  disabled: boolean;
  onAssign: (studentId: string | null) => void;
  onMark: (questionId: string, text: string) => void;
  onOpenStudent: (studentId: string) => void;
  colors: ReturnType<typeof useColors>;
  isRTL: boolean;
  align: 'left' | 'right';
  t: (key: any, ...args: any[]) => string;
}) {
  const live = row.state === 'read' || row.state === 'save_failed';
  const done = row.state === 'saved' || row.state === 'skipped_existing';
  const studentName = roster.find(s => s.id === row.studentId)?.displayName ?? '';
  const note = (text: string, color: string) => (
    <Text style={{ color, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 20, textAlign: align }}>{text}</Text>
  );

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', gap: 12, alignItems: 'flex-start' }}>
        {photo ? <Image source={{ uri: photo }} style={styles.thumb} /> : null}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
            {index + 1}
          </Text>
          {row.state === 'queued' || row.state === 'reading' ? <ActivityIndicator size="small" color={ACCENT} /> : null}
          {row.state === 'failed'
            ? note(`${t('classScanRowFailed')} ${row.error ? t(row.error as ScanErrorKey) : ''}`, colors.destructive)
            : null}
          {row.state === 'not_run' ? note(t('classScanRowNotRun'), colors.mutedForeground) : null}
          {row.state === 'saved' ? note(t('classScanRowSaved'), palette.success) : null}
          {row.state === 'skipped_existing' ? note(t('classScanRowSkipped'), colors.mutedForeground) : null}
          {row.state === 'save_failed' ? note(t('classScanRowSaveFailed'), colors.destructive) : null}
          {live || done ? note(row.nameRead ? t('classScanNameRead', row.nameRead) : t('classScanNoName'), colors.mutedForeground) : null}
        </View>
      </View>

      {live && (
        <>
          {!row.studentId && row.candidates.length > 0 ? (
            <View style={{ gap: 6, marginTop: 10 }}>
              {note(t('classScanLikely'), colors.mutedForeground)}
              <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 6 }}>
                {row.candidates.map(c => (
                  <Pressable
                    key={c.studentId}
                    onPress={() => onAssign(c.studentId)}
                    disabled={disabled}
                    style={[styles.chip, { borderColor: ACCENT, opacity: c.hasAttempt ? 0.6 : 1 }]}
                  >
                    <Text style={{ color: ACCENT, fontFamily: 'Almarai_400Regular', fontSize: 13 }}>{c.displayName}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <PickerField
            label={t('classScanPickStudent')}
            value={studentName}
            options={roster.map(s => s.displayName)}
            onChange={i => onAssign(roster[i]?.id ?? null)}
            colors={colors}
            isRTL={isRTL}
            accent={ACCENT}
          />

          <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {questions.map(q => (
              <View key={q.id} style={{ alignItems: 'center', gap: 2 }}>
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>{q.number}</Text>
                <TextInput
                  value={row.marks[q.id] ?? ''}
                  onChangeText={text => onMark(q.id, text)}
                  editable={!disabled}
                  keyboardType="decimal-pad"
                  style={[styles.markBox, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                />
                <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>/{q.maxMarks}</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 2, marginTop: 6 }}>
            {report?.blockers.includes('no_student') ? note(t('classScanBlockNoStudent'), colors.destructive) : null}
            {report?.blockers.includes('duplicate_student') ? note(t('classScanBlockDuplicate'), colors.destructive) : null}
            {report?.blockers.includes('mark_invalid') ? note(t('classScanBlockInvalid'), colors.destructive) : null}
            {report?.flags.includes('has_attempt') ? note(t('classScanFlagHasAttempt'), colors.mutedForeground) : null}
            {report?.flags.includes('has_attempt') && row.studentId ? (
              <Pressable onPress={() => onOpenStudent(row.studentId!)} hitSlop={8}>
                <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_500Medium', fontSize: 13, textAlign: align }}>
                  {t('classScanOpenStudent')}
                </Text>
              </Pressable>
            ) : null}
            {report?.flags.includes('blank_cells') ? note(t('classScanFlagBlank'), colors.mutedForeground) : null}
            {report?.flags.includes('total_mismatch') && row.writtenTotal !== null
              ? note(t('classScanFlagTotal', String(rowTotal(row, questions)), String(row.writtenTotal)), colors.mutedForeground)
              : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingHorizontal: 20, paddingBottom: 20 },
  heroTitle: { color: '#fff', fontSize: 20, marginTop: 8 },
  pickBtn: { alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 12 },
  saveBtn: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12 },
  thumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: '#0001' },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  markBox: { borderWidth: 1, borderRadius: 8, minWidth: 52, paddingHorizontal: 8, paddingVertical: 6, textAlign: 'center', fontSize: 14 },
});
````

- [ ] **Step 2: Add the entry button**

Apply to `artifacts/mobile/app/evaluations/[id]/index.tsx` (the button goes in the **first** published-only block, above «لوحة النتائج»; the file has a second, similar results button further down — leave it alone):

````diff
diff --git a/artifacts/mobile/app/evaluations/[id]/index.tsx b/artifacts/mobile/app/evaluations/[id]/index.tsx
index 038f55c..c5cd32b 100644
--- a/artifacts/mobile/app/evaluations/[id]/index.tsx
+++ b/artifacts/mobile/app/evaluations/[id]/index.tsx
@@ -38,6 +38,7 @@ import { AddReadAloudModal } from '@/components/AddReadAloudModal';
 import { AddDictationModal } from '@/components/AddDictationModal';
 import { EditQuestionModal } from '@/components/EditQuestionModal';
 import { isEditableQuestion } from '@/services/questionDraft';
+import { isPaperQuestion } from '@/services/paperQuestion';
 import { ClassPickerSheet } from '@/components/ui/ClassPickerSheet';
 import { BookFiguresPanel } from '@/components/ui/BookFiguresPanel';
 import { QuestionFigure } from '@/components/ui/QuestionFigure';
@@ -465,6 +466,19 @@ export default function EvaluationDetailScreen() {
               {t('enterAnswersBtn')}
             </Text>
           </Pressable>
+          {/* A paper exam only: every question is a mark with no text. A generated
+              exam marks itself, and a scan would write teacher marks over that. */}
+          {questions.length > 0 && questions.every(isPaperQuestion) && (
+            <Pressable
+              onPress={() => router.push({ pathname: '/evaluations/[id]/scan-class', params: { id: evaluation.id } })}
+              style={[styles.resultsBtn, { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
+            >
+              <Ionicons name="scan-outline" size={18} color={ACCENT} />
+              <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15 }}>
+                {t('classScanBtn')}
+              </Text>
+            </Pressable>
+          )}
           <Pressable
             onPress={() => router.push({ pathname: '/evaluations/[id]/results', params: { id: evaluation.id } })}
             style={[styles.resultsBtn, { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
````

- [ ] **Step 3: Typecheck and run both suites**

```bash
cd /home/user/Iqraa && pnpm run typecheck
cd artifacts/mobile && pnpm test
```
Expected: typecheck clean; mobile `# tests 4270`, `# pass 4260`, `# fail 0`, `# skipped 10`.

- [ ] **Step 4: Smoke it (manual — the web build)**

With `pnpm run dev:api` and `pnpm run dev:mobile:web` running:

1. Create a paper exam, attach it to a class that has students, **publish** it. The detail screen shows «امسح أوراق الصف» above «لوحة النتائج». A **generated** (non-paper) exam must **not** show it.
2. Open it: the hint and «اختر الصور» appear. On an exam **with no class**, the screen shows `scanNoClass` instead; on a draft, `scanNotPublished`.
3. Choose 2–3 photos with **live AI off**: each row ends «تعذّرت قراءة هذه الصورة…» with the Arabic «قراءة الصور غير مفعّلة حاليًا…», and the batch note shows the same reason once (`live_mode_off` is a batch-stopping error, so the remaining photos end «لم تُقرأ — توقّف المسح»). Confirm the **save button stays disabled** (nothing to save).
4. Do **not** claim the table, name matching or saving "work" from this: with live AI off no row ever reaches `read`. That path is covered by the Task 8–9 unit tests and still needs a real-model run (Task 11, «Not verified»). The same goes for the «افتح ورقة الطالب» link on a skipped row (it opens that student's answers screen): it only appears once a scan has been read.

- [ ] **Step 5: Commit**

```bash
git add "artifacts/mobile/app/evaluations/[id]/scan-class.tsx" "artifacts/mobile/app/evaluations/[id]/index.tsx"
git commit -m "mobile: scan a whole class of marked papers into a review table"
```

---

## Part C — close out

### Task 11: STATUS.md, one CLAUDE.md note, final verification

**Files:**
- Modify: `STATUS.md` (new section above `## Row-level security is built and switched off, 2026-10-13`; a correction under `## Scanning the marks off the paper, 2026-08-25`)
- Modify: `CLAUDE.md` (one bullet under «Things that have bitten before»)

- [ ] **Step 1: Add the STATUS.md section**

Insert this immediately **before** the line `## Row-level security is built and switched off, 2026-10-13` (sections are newest-first):

```markdown
## Scanning external exams: paper setup from photos, and a whole class at once, 2026-10-14

Two things a teacher who sets their own paper exam used to do by hand.

**Setting the exam up.** On the new-exam form, a paper exam's grid can be filled
from photos of the paper (up to four pages): `POST /evaluations/scan-paper`
returns one proposed row per question — marks, a suggested objective chosen only
from the lessons ticked, a suggested competency — and the grid takes the paper's
length. It is stateless (the grid is built before the evaluation exists) and
**writes nothing**; the existing `PUT .../questions/paper` still validates and
stores. Scanned rows read «راجع» until touched, an unread mark stays blank, and a
total that disagrees with the one the paper prints is flagged.

**Marking a class.** On a published paper exam attached to a class,
«امسح أوراق الصف» takes up to 40 photos of marked papers, three at a time. Each
`POST /evaluations/:id/scan-class-paper` returns the marks, the name as written,
and a match against the class roster **done on the server** (the roster never goes
to the model). A match is `confident` only when the normalized name equals exactly
one student's; anything else is `confirm` (three candidates, a tap) or `none`. A
review table shows every row; saving goes through the existing start-attempt,
mark and submit endpoints.

**Two things in the existing API this had to design around** — both easy to get
wrong for the next feature that writes marks in bulk:

- `POST /evaluations/:id/attempts` is find-or-create and `PUT /attempts/:id/grades/:qid`
  upserts, so writing marks into a paper you did not create silently replaces a
  mark a teacher entered or a student earned. The mobile `startAttempt` threw
  away the `created` flag; `startAttemptChecked` returns it, and the batch skips
  any paper it did not make.
- The same find-or-create breaks **retry**: after a half-failed save the paper
  exists because of this batch, so a second start reports `created: false`. A
  row therefore remembers its `attemptId` and never starts twice.

**Decisions kept from the spec:** blank cells are saved as unmarked (the paper
stays provisional); a student who already has a paper is skipped, never
overwritten; photos are not stored; setup takes photos only (no PDF — the web
build has no PDF rendering path).

**Not verified: the model has never read a real exam paper or a real class set.**
The local key is a placeholder and these routes are not deployed, so every test
runs with live mode off — the position the original scanner shipped in. Three
questions only a real photo answers: whether the marks and objective suggestions
are good enough to save typing; whether handwritten names are read well enough
for an exact match to fire at all (if almost never, every row falls back to
`confirm` — safe, but then no faster than picking the student first); and whether
three-at-a-time stays under the 30-per-minute `ai-scan-class` limiter in practice
(call latency is unmeasured). Treat the feature as unproven until a real class
has been scanned.

**Tests.** The decisions are pure functions: `scanRequest`, `scanPaper`,
`studentMatch`, `scanMarks` (a golden test pins `scan-marks`' prompt, which this
did not change) on the server; `scanErrors`, `paperScan`, `classScanRunner`,
`classScanReview`, `classScanSave` on the client. `scanRoutes.test.ts` reads the
two handlers' source (they write nothing, are rate-limited, and check live mode,
budget and quota before the model), and `mountOrder.test.ts` asserts both are
guarded in the built bundle. api-server 1691, mobile 4260 passing.
```

- [ ] **Step 2: Correct the 2026-08-25 entry**

Directly after the paragraph in `## Scanning the marks off the paper, 2026-08-25` that begins `13 tests on the parser, 6 on the route's guards`, add:

```markdown
> **Correction (2026-10-14):** the «6 on the route's guards» are not in the
> repository. `src/**/__tests__` holds the 13 parser tests (`scanMarks.test.ts`)
> and nothing that exercises `POST /attempts/:id/scan-marks`; no route-handler
> test harness exists (route files load the database and the OpenAI client at
> module scope, which `node --test` cannot import). The guards it describes are
> real in the code but untested. The 2026-10-14 scan routes avoid the gap by
> keeping their decisions in pure functions — see the section above.
```

- [ ] **Step 3: Add the CLAUDE.md note**

Append this bullet to «Things that have bitten before» in `CLAUDE.md`:

```markdown
- **`startAttempt` is find-or-create and the marking endpoint upserts (found
  2026-10-14, designing the class scan — it had not bitten yet).** Writing marks
  into a paper you did not create replaces a teacher's or a student's mark with
  no error, and `startAttempt` (mobile) hides which case you are in. Use
  `startAttemptChecked` and read `created`; and remember the `attemptId` you got
  so a retry does not start again and mistake its own half-saved paper for
  someone else's. `services/classScanSave.ts` is the worked example.
```

- [ ] **Step 4: Final verification (everything, from a clean tree)**

```bash
cd /home/user/Iqraa && git status --short          # nothing unexpected
pnpm run typecheck                                  # all three projects Done
cd artifacts/api-server && pnpm build && pnpm test  # 1691 pass, 0 fail, 0 skipped
cd ../mobile && pnpm test                           # 4260 pass, 0 fail, 10 skipped
```
Read the numbers; do not assume them. If they differ from the table at the top, find out why before committing.

- [ ] **Step 5: Commit**

```bash
git add STATUS.md CLAUDE.md
git commit -m "docs: STATUS for exam scanning, correct the scan-marks test claim, note the find-or-create trap"
```

- [ ] **Step 6: Push and open the PR**

```bash
git push -u origin claude/peaceful-archimedes-1l5kjz
```
PR #1052 (the spec) is already open as a draft on this branch; this work lands on it. Update its description to say it now carries the implementation, and keep it **draft** until a real-model run (below) has been done or the teacher has agreed to ship it unverified.

### Verifying with a real model (not part of the build — needs a key and a real class)

Not done and not doable in a sandbox. When someone has `AI_LIVE_MODE=true`, `AI_BUDGET_USD` set and a real `OPENAI_API_KEY` locally:

1. **Setup:** photograph a real exam paper (2 pages, mixed Arabic/Western digits, one question with sub-parts). Does the grid get the right number of rows? Are the marks right? Are any suggested objectives wrong? Is the printed total right?
2. **Names:** photograph 10 marked papers with the student's name handwritten. How many are `confident`, `confirm`, `none`? Any `confident` that is **wrong** is a stop-ship bug in `studentMatch.ts`.
3. **Marks:** compare the review table to the papers. Any silently wrong mark is a bug; a blank is the safe failure.
4. **Rate:** time a 30-photo batch. Does the limiter ever return 429? If so, lower `concurrency` or raise `ai-scan-class`.
5. Record the answers in STATUS.md under the section above, replacing «Not verified» with what was measured.
