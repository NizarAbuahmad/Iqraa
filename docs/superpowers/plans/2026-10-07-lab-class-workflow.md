# Science Lab in the class workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher can put a Science Lab item on a class's shelf, and can insert lab items into a generated slide deck.

**Architecture:** The class shelf reuses `class_resources` with `kind='lab'` (no DDL: `kind` is plain `text`); the server owns the lab id check and the title, written from the lab catalogue. Lab slides are built client-side by a new pure module (`labSlides.ts`) out of existing slide types (`intro` for laws, `media` for the rest) and inserted after the model returns, so nothing lab-related ever enters an `AIRequest` or the shared artifact pool.

**Tech Stack:** TypeScript, Express + Drizzle (api-server), Expo / React Native (mobile), `@workspace/curriculum/lab`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-07-lab-class-workflow-design.md`

## Global Constraints

- **No DDL.** Nothing under `lib/db/src/schema` may change. If a task seems to need it, stop and report. The PR says `schema-push: n/a`.
- **No new native module, no new dependency, no `app.json` `version` bump.**
- **The server owns the title and the validity of a lab id**: an unknown id is a 400; a client cannot choose the title.
- **Dedupe by a route check (409 `already_added`), not a new unique index** (an index is DDL, and `verify-schema` would then fail the deploy until it was applied by hand).
- **Lab data never enters an `AIRequest`.** Lab slides are inserted client-side, after generation, like attachments.
- **A slide never carries unlicensed or uncredited media.** An external item with no attribution, or whose licence policy does not allow it, produces no slide.
- **Credits live in both `content` and `mediaCaption`** (presenter reads `content`; PDF and PPTX read `mediaCaption`).
- **Never put a lab slide at index 0** (HTML and PPTX always render slide 0 as the title slide).
- **Use `fetchUrl` for external images, never the one-hour presigned `/media/external/:id` link.**
- Arabic is the product language, UI is RTL-first. Maths is computed in latin and converted at display time. Carry lessons by `kbl-*` id, never by title.
- Mobile tests are bare `node --test` over `services/__tests__/**` only: nothing under test may import `react-native` or `expo-*` at module scope, and relative imports need explicit `.ts` extensions.
- Mobile test command (single file): `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/<file>.test.ts`
- api-server single test: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/<file>.test.ts`
- Anything not seen in a browser is labelled so in the PR and `STATUS.md`.
- Commits end with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_015fuX2AkHoEeHjbte2uXVtW`.

## File structure

| File | Role |
| --- | --- |
| `artifacts/api-server/src/lib/labClassResource.ts` (new) | Pure: validate a lab add-request, build the server-written snapshot |
| `artifacts/api-server/src/lib/classResource.ts` | `presentClassResource` marks a lab row `unavailable` when its id left the catalogue |
| `artifacts/api-server/src/routes/roster.ts` | POST branch for `kind: 'lab'` |
| `artifacts/mobile/services/resourceCatalog.ts` | `ResourceKind` gains `'lab'` |
| `artifacts/mobile/constants/resourceKind.ts` | icon + label for `lab` |
| `artifacts/mobile/services/classResources.ts` | lab-aware types, `addedKeys`, `addLabBodyFor`, `labItemsForClass`, `openTargetFor` |
| `artifacts/mobile/services/roster.ts` | `addClassResource` accepts a lab body |
| `artifacts/mobile/components/classes/LabPickerSheet.tsx` (new) | The class add-sheet lab picker |
| `artifacts/mobile/app/classes/[id].tsx` | Button, sheet mount, add + open handlers |
| `artifacts/mobile/services/labSlides.ts` (new) | Pure: lab item → `ActivitySlide` |
| `artifacts/mobile/services/classMedia.ts` | Shared placement slot + `insertLabSlides` |
| `artifacts/mobile/components/ui/LessonLabItems.tsx` (new) | The «من المختبر» picker on the slides screen |
| `artifacts/mobile/app/ai-tools/slides.tsx` | Picks state, build + insert at both deck-build sites |
| `artifacts/mobile/services/i18n.ts` | Strings, both language blocks |
| `STATUS.md`, `docs/superpowers/specs/2026-10-06-science-lab-design.md` | Correct the "needs a schema push" claim |

## Settled by measurement (do not re-decide)

Run against the real helpers on 2026-10-07 (`looksLikeEquation`, `hasRenderableMath`, `isolateForeignRuns`):

- `m/s²` and `a: m/s²` parse as a **stacked fraction** (`hasRenderableMath` is true; kinds `frac`). `g/mol` and `particles/mol` do not.
- Any line containing `²` is `looksLikeEquation` true, so a unit line without a bullet is drawn as a boxed equation. A **bullet** line is never an equation (`isBulletLine`).
- `Nₐ` is **not** isolated: `N = n × Nₐ` becomes `⁦N = n × N⁩ₐ`, with `ₐ` stranded outside the run.
- `m·s⁻²`, `g·mol⁻¹`, `particles·mol⁻¹` parse as plain text and isolate cleanly.
- `Rx = Ax + Bx , Ry = Ay + By , R = √(Rx² + Ry²)` as one line is drawn as one very wide equation; split into one line per equation it is fine. `R = √(Rx² + Ry²)` parses as a `root` node, which is intended.

So: **units with `/` are written as `·x⁻ⁿ`; subscript letters (`ₐ`) are written as the plain capital (`NA`); a formula holding several equations is split to one line each; quantity lines are bullets.**

---

### Task 1: Server — a lab row on a class's shelf

**Files:**
- Create: `artifacts/api-server/src/lib/labClassResource.ts`
- Create: `artifacts/api-server/src/lib/__tests__/labClassResource.test.ts`
- Modify: `artifacts/api-server/src/lib/classResource.ts` (`presentClassResource`)
- Modify: `artifacts/api-server/src/lib/__tests__/classResource.test.ts` (append)
- Modify: `artifacts/api-server/src/routes/roster.ts` (POST `/classes/:id/resources`)

**Interfaces:**
- Consumes: `getLabItem` from `@workspace/curriculum/lab` (`(id: string) => LabItem | undefined`; `LabItem` has `titleAr: string`).
- Produces:
  - `parseLabClassResourceInput(body: unknown): { itemId: string } | { error: string }`
  - `labClassResourceSnapshot(itemId: string): { title: string; mediaKind: "lab"; url: null; thumbnailUrl: null } | null`
  - Wire body for the app: `{ kind: "lab", itemId: string }`
  - A stored lab row: `kind="lab"`, `librarySource=null`, `libraryNativeId=<itemId>`, `mediaKind="lab"`, `url=null`
  - `presentClassResource` returns `unavailable: true` for a lab row whose id is not in the catalogue.

- [ ] **Step 1: Write the failing tests**

Create `artifacts/api-server/src/lib/__tests__/labClassResource.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { getLabItem } from "@workspace/curriculum/lab";
import { labClassResourceSnapshot, parseLabClassResourceInput } from "../labClassResource.ts";

const REAL_ID = "law-newton-second";

describe("parseLabClassResourceInput", () => {
  it("accepts a real lab item id", () => {
    assert.deepEqual(parseLabClassResourceInput({ kind: "lab", itemId: REAL_ID }), { itemId: REAL_ID });
  });

  it("trims the id", () => {
    assert.deepEqual(parseLabClassResourceInput({ kind: "lab", itemId: `  ${REAL_ID} ` }), { itemId: REAL_ID });
  });

  it("refuses an id that is not in the catalogue, rather than storing a dead row", () => {
    const r = parseLabClassResourceInput({ kind: "lab", itemId: "law-does-not-exist" });
    assert.ok("error" in r);
  });

  it("refuses a missing, blank, non-string or oversized id", () => {
    for (const itemId of [undefined, "", "   ", 7, "x".repeat(201)]) {
      assert.ok("error" in parseLabClassResourceInput({ kind: "lab", itemId }), String(itemId));
    }
  });

  it("refuses any other kind and a non-object body", () => {
    assert.ok("error" in parseLabClassResourceInput({ kind: "library", itemId: REAL_ID }));
    assert.ok("error" in parseLabClassResourceInput(null));
    assert.ok("error" in parseLabClassResourceInput("lab"));
  });
});

describe("labClassResourceSnapshot", () => {
  it("writes the title from the catalogue, never from the request", () => {
    const snap = labClassResourceSnapshot(REAL_ID);
    assert.ok(snap);
    assert.equal(snap.title, getLabItem(REAL_ID)!.titleAr);
    assert.equal(snap.mediaKind, "lab");
    assert.equal(snap.url, null);
    assert.equal(snap.thumbnailUrl, null);
  });

  it("is null for an unknown id", () => {
    assert.equal(labClassResourceSnapshot("nope"), null);
  });
});
```

Append to `artifacts/api-server/src/lib/__tests__/classResource.test.ts` (it already imports `presentClassResource`; reuse its imports and add nothing else):

```ts
describe("presentClassResource — lab rows", () => {
  const labRow = (libraryNativeId: string | null) => ({
    id: "11111111-1111-4111-8111-111111111111",
    kind: "lab",
    librarySource: null,
    libraryNativeId,
    title: "القانون الثاني لنيوتن",
    mediaKind: "lab",
    url: null,
    thumbnailUrl: null,
    createdAt: new Date("2026-10-07T08:00:00.000Z"),
  });

  it("is available while the item is in the catalogue", () => {
    const r = presentClassResource(labRow("law-newton-second"), new Set());
    assert.equal(r.unavailable, false);
    assert.equal(r.kind, "lab");
    assert.equal(r.source, null);
    assert.equal(r.nativeId, "law-newton-second");
  });

  it("is unavailable once the item has left the catalogue", () => {
    assert.equal(presentClassResource(labRow("law-removed-later"), new Set()).unavailable, true);
  });

  it("is unavailable with no id at all", () => {
    assert.equal(presentClassResource(labRow(null), new Set()).unavailable, true);
  });

  it("does not change how a library row is judged", () => {
    const uploaded = {
      ...labRow("3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5b"),
      kind: "library",
      librarySource: "uploaded",
      mediaKind: "video",
    };
    assert.equal(presentClassResource(uploaded, new Set()).unavailable, true);
    assert.equal(
      presentClassResource(uploaded, new Set(["3f2b8c1e-9d4a-4e6b-8a57-0c1d2e3f4a5b"])).unavailable,
      false,
    );
  });
});
```

If `describe`/`assert` are already imported at the top of that file (they are), do not re-import.

- [ ] **Step 2: Run to verify they fail**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/labClassResource.test.ts src/lib/__tests__/classResource.test.ts`
Expected: FAIL — `labClassResource.ts` not found; lab `unavailable` assertions fail.

- [ ] **Step 3: Implement**

Create `artifacts/api-server/src/lib/labClassResource.ts`:

```ts
/**
 * Science Lab items on a class's shelf (routes/roster.ts,
 * POST /classes/:id/resources with `kind: "lab"`).
 *
 * A lab item lives in code (`@workspace/curriculum/lab`), so the server can
 * check it. That is why the request carries only an id: the id must be a real
 * item, and the title stored is the catalogue's, never the app's. A row is a
 * pointer plus that snapshot, the same shape a Library row has; the table
 * needs no change because `class_resources.kind` is plain text.
 *
 * Spec: docs/superpowers/specs/2026-10-07-lab-class-workflow-design.md
 */
import { getLabItem } from "@workspace/curriculum/lab";

export const LAB_KIND = "lab" as const;
const MAX_ITEM_ID = 200;

export function parseLabClassResourceInput(body: unknown): { itemId: string } | { error: string } {
  if (!body || typeof body !== "object") return { error: "A JSON body is required" };
  const b = body as Record<string, unknown>;
  if (b["kind"] !== LAB_KIND) return { error: "kind must be lab" };
  const itemId = typeof b["itemId"] === "string" ? b["itemId"].trim() : "";
  if (!itemId || itemId.length > MAX_ITEM_ID) return { error: "itemId is required" };
  if (!getLabItem(itemId)) return { error: "itemId is not a lab item" };
  return { itemId };
}

export function labClassResourceSnapshot(
  itemId: string,
): { title: string; mediaKind: "lab"; url: null; thumbnailUrl: null } | null {
  const item = getLabItem(itemId);
  if (!item) return null;
  return { title: item.titleAr, mediaKind: "lab", url: null, thumbnailUrl: null };
}
```

In `artifacts/api-server/src/lib/classResource.ts` add the import under the existing import and change `presentClassResource`:

```ts
import { getLabItem } from "@workspace/curriculum/lab";
```

```ts
  const isUpload = row.librarySource === "uploaded" && !!row.libraryNativeId;
  const gone = isUpload && !presentLibraryIds.has(row.libraryNativeId!);
  // A lab item lives in code, so "gone" means a later release removed it.
  const labGone = row.kind === "lab" && !getLabItem(row.libraryNativeId ?? "");
```
and in the returned object: `unavailable: gone || labGone,`. Update the `ClientClassResource.unavailable` doc comment to mention a lab item that has left the catalogue.

In `artifacts/api-server/src/routes/roster.ts`, import `labClassResourceSnapshot, parseLabClassResourceInput` from `"../lib/labClassResource.ts"` (match the file's existing import style/extension for `classResource`). In the POST handler, immediately after the `findLiveClass` 404 check and **before** `const input = parseClassResourceInput(req.body);`, insert:

```ts
    // A Science Lab item: validated and titled from the catalogue, not the app.
    if (req.body && typeof req.body === "object" && (req.body as Record<string, unknown>)["kind"] === "lab") {
      const lab = parseLabClassResourceInput(req.body);
      if ("error" in lab) {
        res.status(400).json({ error: lab.error });
        return;
      }
      const snap = labClassResourceSnapshot(lab.itemId)!;
      // No unique index covers lab rows (that would be DDL), so the route checks.
      const [existing] = await db
        .select({ id: classResources.id })
        .from(classResources)
        .where(
          and(
            eq(classResources.classGroupId, classId),
            eq(classResources.kind, "lab"),
            eq(classResources.libraryNativeId, lab.itemId),
          ),
        )
        .limit(1);
      if (existing) {
        res.status(409).json({ code: "already_added", error: "Already added to this class" });
        return;
      }
      const [row] = await db
        .insert(classResources)
        .values({
          classGroupId: classId,
          teacherId: req.user!.id,
          kind: "lab",
          librarySource: null,
          libraryNativeId: lab.itemId,
          ...snap,
        })
        .returning();
      res.status(201).json({ resource: presentClassResource(row!, new Set()) });
      return;
    }
```

- [ ] **Step 4: Run to verify they pass**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/labClassResource.test.ts src/lib/__tests__/classResource.test.ts`
Expected: PASS.

Then `pnpm --filter @workspace/api-server run typecheck` (or the package's typecheck script; `pnpm run typecheck` at the root if unsure) and `cd artifacts/api-server && pnpm build && pnpm test`. Expected: all pass. (There is no database in tests, so the route branch itself is exercised by the typecheck and build only. Say so in the PR.)

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/labClassResource.ts artifacts/api-server/src/lib/__tests__/labClassResource.test.ts artifacts/api-server/src/lib/classResource.ts artifacts/api-server/src/lib/__tests__/classResource.test.ts artifacts/api-server/src/routes/roster.ts
git commit -m "feat(api): lab items on a class shelf, titled from the catalogue (no DDL)"
```

---

### Task 2: Mobile — shelf types, keys, open target, kind maps, strings

**Files:**
- Modify: `artifacts/mobile/services/resourceCatalog.ts` (`ResourceKind`)
- Modify: `artifacts/mobile/constants/resourceKind.ts`
- Modify: `artifacts/mobile/services/classResources.ts`
- Modify: `artifacts/mobile/services/roster.ts` (`addClassResource` signature)
- Modify: `artifacts/mobile/services/i18n.ts` (both blocks)
- Modify: `artifacts/mobile/services/__tests__/classResources.test.ts` (append)

**Interfaces:**
- Consumes: `labItemPath(id: string): string` from `./labLinks.ts`; `filterLabItems`, `LabItem` from `@workspace/curriculum/lab`.
- Produces (all from `services/classResources.ts`):
  - `ClassResource.kind: 'library' | 'lab'`, `ClassResource.source: ResourceSource | null`
  - `AddLabResourceBody = { kind: 'lab'; itemId: string }`
  - `labShelfKey(itemId: string): string` → `` `lab:${itemId}` ``
  - `addLabBodyFor(itemId: string): AddLabResourceBody`
  - `labItemsForClass(gradeId: string, subjectIds: readonly string[]): LabItem[]` (empty `subjectIds` = any subject)
  - `OpenTarget` gains `{ kind: 'lab'; path: string }`
  - `addedKeys` returns `lab:<id>` for lab rows
  - i18n keys: `resourceKindLab`, `fromLab`, `labPickerTitle`, `labPickerEmpty`

- [ ] **Step 1: Write the failing tests**

Append to `artifacts/mobile/services/__tests__/classResources.test.ts`, and extend its import list from `'../classResources.ts'` with `addLabBodyFor, labItemsForClass, labShelfKey`:

```ts
describe('lab rows on the shelf', () => {
  const labRow = (patch: Partial<ClassResource> = {}): ClassResource =>
    resource({
      id: 'l1',
      kind: 'lab',
      source: null,
      nativeId: 'law-newton-second',
      mediaKind: 'lab',
      url: null,
      ...patch,
    });

  it('keys a lab row by its item id, matching labShelfKey', () => {
    assert.ok(addedKeys([labRow()]).has(labShelfKey('law-newton-second')));
    assert.equal(labShelfKey('law-newton-second'), 'lab:law-newton-second');
  });

  it('does not let a lab id collide with a library key', () => {
    const keys = addedKeys([labRow(), resource({ id: 'u', nativeId: 'law-newton-second' })]);
    assert.equal(keys.size, 2);
  });

  it('sends a lab item by id alone — the server writes the title', () => {
    assert.deepEqual(addLabBodyFor('law-newton-second'), { kind: 'lab', itemId: 'law-newton-second' });
  });

  it('opens a lab row in the app, at the lab route', () => {
    assert.deepEqual(openTargetFor(labRow()), { kind: 'lab', path: '/curriculum/lab/law-newton-second' });
  });

  it('opens nothing for a lab row whose item has gone', () => {
    assert.deepEqual(openTargetFor(labRow({ unavailable: true })), { kind: 'none' });
  });

  it('is never flagged insecure', () => {
    assert.equal(isInsecureResource(labRow()), false);
  });
});

describe('labItemsForClass', () => {
  it('narrows to the class grade and subject', () => {
    const items = labItemsForClass('grade-10', ['chemistry']);
    assert.ok(items.length > 0);
    assert.ok(items.every(i => i.gradeId === 'grade-10' && i.subjectId === 'chemistry'));
  });

  it('takes any of several subjects', () => {
    const both = labItemsForClass('grade-10', ['chemistry', 'physics']);
    assert.ok(both.some(i => i.subjectId === 'chemistry'));
    assert.ok(both.some(i => i.subjectId === 'physics'));
  });

  it('treats an empty subject list as any subject, as the Library picker does', () => {
    assert.ok(labItemsForClass('grade-10', []).length >= labItemsForClass('grade-10', ['chemistry']).length);
  });

  it('is empty for a class with no lab items', () => {
    assert.deepEqual(labItemsForClass('grade-1', ['arabic']), []);
  });

  it('is empty without a grade, rather than listing everything', () => {
    assert.deepEqual(labItemsForClass('', ['chemistry']), []);
  });
});
```

The existing `resource()` helper in that file builds `kind: 'library'`; its `Partial<ClassResource>` patch now also accepts `kind: 'lab'` once the type changes.

- [ ] **Step 2: Run to verify they fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/classResources.test.ts`
Expected: FAIL — `addLabBodyFor` / `labItemsForClass` / `labShelfKey` are not exported.

- [ ] **Step 3: Implement**

`services/resourceCatalog.ts`: change

```ts
export type ResourceKind =
  | LibraryCategory
  | 'image'
  | 'page'
  /** A Science Lab item. Only ever a class-shelf row; the Library catalogue never produces one. */
  | 'lab';
```

`constants/resourceKind.ts`: add `lab: 'resourceKindLab',` to `RESOURCE_KIND_LABEL` and `lab: 'flask-outline',` to `RESOURCE_KIND_ICON`.

`services/i18n.ts`, in the Arabic block beside `libraryPickerTitle`:

```ts
    resourceKindLab: 'مختبر',
    fromLab: 'من المختبر',
    labPickerTitle: 'أضف من المختبر',
    labPickerEmpty: 'لا مواد في المختبر لهذا الصف وهذه المادة بعد',
```
and in the English block beside its `libraryPickerTitle`:

```ts
    resourceKindLab: 'Lab',
    fromLab: 'From the Lab',
    labPickerTitle: 'Add from the Lab',
    labPickerEmpty: 'Nothing in the Lab for this grade and subject yet',
```

`services/classResources.ts`:
1. Add imports: `import { filterLabItems, type LabItem } from '@workspace/curriculum/lab';` and `import { labItemPath } from './labLinks.ts';`. Update the header comment: the runtime imports are now `./i18n.ts`, `./labLinks.ts` and `@workspace/curriculum/lab`, all free of `react-native`/`expo-*`.
2. Change `ClassResource`:

```ts
export interface ClassResource {
  id: string;
  /** `lab` is a Science Lab item; `source` is null for it and `nativeId` is the lab item id. */
  kind: 'library' | 'lab';
  source: ResourceSource | null;
  nativeId: string;
  ...rest unchanged
}
```
3. After `AddResourceBody` add:

```ts
/** The body of `POST /classes/:id/resources` for a Science Lab item. */
export interface AddLabResourceBody {
  kind: 'lab';
  itemId: string;
}
```
4. Replace `addedKeys`:

```ts
/** `lab:<itemId>` — how a lab item is keyed in the shelf's "already added" set. */
export function labShelfKey(itemId: string): string {
  return `lab:${itemId}`;
}

export function addedKeys(resources: ClassResource[]): Set<string> {
  return new Set(
    resources.map(resource =>
      resource.kind === 'lab' ? labShelfKey(resource.nativeId) : `${resource.source}:${resource.nativeId}`,
    ),
  );
}
```
5. After `addBodyFor` add:

```ts
/** A lab item goes by id alone: the server checks it and writes the title. */
export function addLabBodyFor(itemId: string): AddLabResourceBody {
  return { kind: 'lab', itemId };
}

/**
 * The lab items a class can be offered: its grade and any of its subjects
 * (an empty list means any), as the Library picker does. No grade, no items.
 */
export function labItemsForClass(gradeId: string, subjectIds: readonly string[]): LabItem[] {
  if (!gradeId) return [];
  return filterLabItems({ gradeId }).filter(
    item => subjectIds.length === 0 || subjectIds.includes(item.subjectId),
  );
}
```
6. `OpenTarget` and `openTargetFor`:

```ts
export type OpenTarget =
  | { kind: 'url'; url: string }
  | { kind: 'premade'; id: string }
  | { kind: 'lab'; path: string }
  | { kind: 'none' };

export function openTargetFor(resource: ClassResource): OpenTarget {
  if (resource.unavailable) return { kind: 'none' };
  if (resource.kind === 'lab') return { kind: 'lab', path: labItemPath(resource.nativeId) };
  if (resource.source === 'premade-sheet') return { kind: 'premade', id: resource.nativeId };
  return resource.url ? { kind: 'url', url: resource.url } : { kind: 'none' };
}
```

`services/roster.ts`: import `AddLabResourceBody` beside `AddResourceBody` and change `addClassResource(classId: string, body: AddResourceBody | AddLabResourceBody)`.

- [ ] **Step 4: Run, then typecheck**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/classResources.test.ts`
Expected: PASS.

Then `pnpm run typecheck` at the repo root. Adding `'lab'` to `ResourceKind` and making `source` nullable will surface every place that assumed the old shapes (an exhaustive `Record<ResourceKind, …>`, a use of `resource.source` as non-null). Fix each by adding a `lab` entry or handling null. **Do not** add lab to the Library screen's category chips: the Library catalogue never produces a lab item. Re-run the typecheck until it is clean, and re-run `cd artifacts/mobile && pnpm test` (about 4 minutes) to prove nothing else moved.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile
git commit -m "feat(mobile): lab-aware class shelf types, keys, open target, kind icon and label"
```

---

### Task 3: Mobile — add a lab item to a class, and open one

**Files:**
- Create: `artifacts/mobile/components/classes/LabPickerSheet.tsx`
- Modify: `artifacts/mobile/app/classes/[id].tsx`

**Interfaces:**
- Consumes (Task 2): `labItemsForClass`, `labShelfKey`, `addLabBodyFor`, `addedKeys`, `OpenTarget` `{kind:'lab'}`; `addClassResource` from `@/services/roster`; i18n `fromLab`, `labPickerTitle`, `labPickerEmpty`, `libraryPickerDone`, `resourceAdded`, `labKindInteractive`, `labKindLaw`, `labKindExternal`.
- Produces: `LabPickerSheet` component with props `{ visible: boolean; group: { gradeId: string; subjectIds: readonly string[] }; added: ReadonlySet<string>; busyId: string | null; error?: string; onAdd: (itemId: string) => void; onClose: () => void }`.

This task is UI only and is outside the node test glob. Its gate is the typecheck, the lint the repo already runs, and the pure logic proven in Task 2. It has **not been seen in a browser**; say so in the PR.

- [ ] **Step 1: Create the sheet**

Create `artifacts/mobile/components/classes/LabPickerSheet.tsx`, modelled on `LibraryPickerSheet.tsx` (same Modal, backdrop, row look, «مضاف», stays open after an add so several can be added). Module-scope components only (the React compiler bails out on nested components):

```tsx
/**
 * "Add from the Lab" — opened from a class's «+» sheet, beside the Library.
 *
 * The lab catalogue is code, not a network call, so there is no loading state:
 * the list is the class's grade and subjects run through `labItemsForClass`.
 * One tap adds an item and the sheet stays open; items already on the shelf
 * read «مضاف». Spec: docs/superpowers/specs/2026-10-07-lab-class-workflow-design.md
 */
import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { LabItem } from '@workspace/curriculum/lab';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RESOURCE_KIND_ICON } from '@/constants/resourceKind';
import { labItemsForClass, labShelfKey } from '@/services/classResources';

function PickerRow({
  item,
  isAdded,
  isBusy,
  onAdd,
}: {
  item: LabItem;
  isAdded: boolean;
  isBusy: boolean;
  onAdd: () => void;
}) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const title = lang === 'ar' ? item.titleAr : item.titleEn;
  const kindLabel =
    item.kind === 'interactive' ? t('labKindInteractive') : item.kind === 'law' ? t('labKindLaw') : t('labKindExternal');

  return (
    <Pressable
      onPress={onAdd}
      disabled={isAdded || isBusy}
      accessibilityRole="button"
      style={[
        styles.row,
        { borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row', opacity: isAdded ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={RESOURCE_KIND_ICON.lab} size={20} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={2}
          style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 14, textAlign: align }}
        >
          {title}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
          {kindLabel}
        </Text>
      </View>
      {isBusy ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : isAdded ? (
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
          <Ionicons name="checkmark-circle" size={18} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 12 }}>
            {t('resourceAdded')}
          </Text>
        </View>
      ) : (
        <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
      )}
    </Pressable>
  );
}

export function LabPickerSheet({
  visible,
  group,
  added,
  busyId,
  error,
  onAdd,
  onClose,
}: {
  visible: boolean;
  group: { gradeId: string; subjectIds: readonly string[] };
  /** `lab:<itemId>` of every lab item already on the class's shelf. */
  added: ReadonlySet<string>;
  busyId: string | null;
  /** Shown inside the sheet: a toast on the screen would sit behind this Modal. */
  error?: string;
  onAdd: (itemId: string) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const items = useMemo(
    () => labItemsForClass(group.gradeId, group.subjectIds),
    // The array is rebuilt each render by the caller; its contents are the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [group.gradeId, group.subjectIds.join(',')],
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
            {t('labPickerTitle')}
          </Text>
          {error ? (
            <Text
              style={{
                color: colors.destructive,
                fontFamily: 'Almarai_400Regular',
                fontSize: 13,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {error}
            </Text>
          ) : null}
          <FlatList
            data={items}
            keyExtractor={i => i.id}
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ gap: 8 }}
            ListEmptyComponent={
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: 'Almarai_400Regular',
                  textAlign: 'center',
                  paddingVertical: 24,
                }}
              >
                {t('labPickerEmpty')}
              </Text>
            }
            renderItem={({ item }) => (
              <PickerRow
                item={item}
                isAdded={added.has(labShelfKey(item.id))}
                isBusy={busyId === item.id}
                onAdd={() => onAdd(item.id)}
              />
            )}
          />
          <View style={styles.actions}>
            <Pressable onPress={onClose} style={styles.doneBtn} accessibilityRole="button">
              <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_600SemiBold' }}>
                {t('libraryPickerDone')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { width: '100%', maxWidth: 460, borderRadius: 16, padding: 20, gap: 12 },
  title: { fontSize: 18 },
  row: { alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  doneBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
});
```

- [ ] **Step 2: Wire the class screen** (`artifacts/mobile/app/classes/[id].tsx`)

1. Imports: `import { LabPickerSheet } from '@/components/classes/LabPickerSheet';`; add `addLabBodyFor, labItemsForClass` to the existing `@/services/classResources` import list (the one containing `addedKeys`).
2. State, beside `showLibrary` (line ~144): `const [showLab, setShowLab] = useState(false); const [addingLabId, setAddingLabId] = useState<string | null>(null);` (reuse `pickerError`/`setPickerError`: only one sheet is open at a time).
3. Next to `group`/`subjectIds`/`focus` (line ~182–187), derive: `const labGroup = { gradeId: group?.gradeId ?? '', subjectIds: focus ? [focus] : subjectIds };` and `const hasLabItems = labItemsForClass(labGroup.gradeId, labGroup.subjectIds).length > 0;` (this already runs in render; the catalogue is in memory).
4. Handler, after `onAddResource`:

```tsx
  const onAddLabItem = async (itemId: string) => {
    if (!id || addingLabId) return;
    setAddingLabId(itemId);
    setPickerError('');
    let added: ClassResource | null;
    try {
      added = await addClassResource(id, addLabBodyFor(itemId));
    } catch {
      // Shown inside the sheet: a toast on this screen would sit behind its Modal.
      setPickerError(t('classResourceFailed'));
      setAddingLabId(null);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // `null` is the 409 "already there": nothing was created, so nothing to count.
    if (added) trackEvent('class_resource_added', { source: 'lab', mediaKind: 'lab' });
    try {
      setResources(await listClassResources(id));
    } catch {
      if (added) setResources(prev => withAddedResource(prev, added));
    }
    setAddingLabId(null);
  };
```

5. `onOpenResource`: add a branch after the `premade` one:

```tsx
    else if (target.kind === 'lab') {
      // `as never`: the lab routes are typed per-id, as the premade branch above is.
      router.push(target.path as never);
    }
```
6. In the add sheet, directly **after** the closing `</Pressable>` of the «من المكتبة» button (the one whose text is `t('fromLibrary')`, ends line ~1500), add a sibling button shown only when `hasLabItems`:

```tsx
            {hasLabItems ? (
              <Pressable
                onPress={() => {
                  setShowAttach(false);
                  setPickerError('');
                  setShowLab(true);
                }}
                accessibilityRole="button"
                style={[
                  styles.createRow,
                  { borderColor: ACCENT, flexDirection: isRTL ? 'row-reverse' : 'row' },
                ]}
              >
                <Ionicons name="flask-outline" size={18} color={ACCENT} />
                <Text
                  style={{
                    color: ACCENT,
                    fontFamily: 'ReadexPro_600SemiBold',
                    flex: 1,
                    textAlign: align,
                  }}
                >
                  {t('fromLab')}
                </Text>
              </Pressable>
            ) : null}
```
7. Mount the sheet right after `<LibraryPickerSheet … />` (line ~1556):

```tsx
      <LabPickerSheet
        visible={showLab}
        group={labGroup}
        added={shelfKeys}
        busyId={addingLabId}
        error={pickerError}
        onAdd={itemId => { void onAddLabItem(itemId); }}
        onClose={() => {
          setPickerError('');
          setShowLab(false);
        }}
      />
```

- [ ] **Step 3: Verify**

Run `pnpm run typecheck` (repo root) and the repo's lint if one exists (`pnpm -r run lint` / the mobile `lint` script; check `artifacts/mobile/package.json`). Expected: clean. Re-run `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/classResources.test.ts` to confirm nothing moved.

- [ ] **Step 4: Commit**

```bash
git add artifacts/mobile/components/classes/LabPickerSheet.tsx "artifacts/mobile/app/classes/[id].tsx"
git commit -m "feat(mobile): add a lab item to a class from its add sheet, and open it"
```

---

### Task 4: Mobile — lab items as slides (pure) with the formula guard

**Files:**
- Create: `artifacts/mobile/services/labSlides.ts`
- Create: `artifacts/mobile/services/__tests__/labSlides.test.ts`

**Interfaces:**
- Consumes: `getLabItem`, `labItemsForLesson`, `LabItem`, `LabLawItem`, `LabExternalItem` from `@workspace/curriculum/lab`; `getExternalResource`, `ExternalResource` from `@workspace/curriculum/external`; `usePolicy` from `@workspace/curriculum/bank`; `buildMediaSlide`, `youtubeIdFrom` from `./classMedia.ts`; `labShareUrl` from `./labLinks.ts`; `ActivitySlide` (type) from `./ai/AIService.ts`.
- Produces:
  - `unitForSlide(unit: string): string`
  - `slideSymbol(text: string): string`
  - `lawFormulaLines(item: LabLawItem): string[]`
  - `buildLabSlide(item: LabItem, isAr: boolean, slideNumber: number, resolve?: (id: string) => ExternalResource | undefined): ActivitySlide | null`
  - `labSlidesFor(itemIds: readonly string[], isAr: boolean): ActivitySlide[]` (unknown ids and refused items are skipped; slide numbers are 0, renumbered on insert)
  - `deckableLabItems(lessonId: string, isAr: boolean): LabItem[]` (the lesson's lab items that can produce a slide)

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/labSlides.test.ts`:

```ts
/**
 * Lab items as deck slides. The load-bearing tests are the two guards at the
 * bottom: every SHIPPED law is run through the deck's real formula helpers,
 * and every shipped credit is checked on both fields the exports read.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LAB_ITEMS, getLabItem, type LabLawItem, type LabExternalItem } from '@workspace/curriculum/lab';
import { getExternalResource, type ExternalResource } from '@workspace/curriculum/external';

import { isBulletLine, looksLikeEquation, stripBullet } from '../deckText.ts';
import { hasRenderableMath, isolateForeignRuns } from '../mathRender.ts';
import { labShareUrl } from '../labLinks.ts';
import {
  buildLabSlide,
  deckableLabItems,
  labSlidesFor,
  lawFormulaLines,
  slideSymbol,
  unitForSlide,
} from '../labSlides.ts';

const LRI = '⁦';
const PDI = '⁩';
const laws = LAB_ITEMS.filter((i): i is LabLawItem => i.kind === 'law');
const externals = LAB_ITEMS.filter((i): i is LabExternalItem => i.kind === 'external');

describe('unitForSlide', () => {
  it('writes a unit with a slash as a negative power, which the deck draws as plain text', () => {
    assert.equal(unitForSlide('m/s²'), 'm·s⁻²');
    assert.equal(unitForSlide('g/mol'), 'g·mol⁻¹');
    assert.equal(unitForSlide('particles/mol'), 'particles·mol⁻¹');
  });
  it('leaves a unit with no slash alone', () => {
    assert.equal(unitForSlide('N'), 'N');
    assert.equal(unitForSlide('same as A and B'), 'same as A and B');
  });
  it('leaves a slash it cannot read alone instead of guessing (the guard below then catches it)', () => {
    assert.equal(unitForSlide('m/(s·s)'), 'm/(s·s)');
  });
});

describe('slideSymbol', () => {
  it('writes a subscript letter as the plain capital, which stays inside the isolate', () => {
    assert.equal(slideSymbol('Nₐ'), 'NA');
    assert.equal(slideSymbol('N = n × Nₐ'), 'N = n × NA');
  });
  it('leaves digit subscripts and everything else alone', () => {
    assert.equal(slideSymbol('H₂O'), 'H₂O');
  });
});

describe('lawFormulaLines', () => {
  it('gives each equation its own line', () => {
    const vec = getLabItem('law-vector-resultant') as LabLawItem;
    assert.deepEqual(lawFormulaLines(vec), ['Rx = Ax + Bx', 'Ry = Ay + By', 'R = √(Rx² + Ry²)']);
  });
  it('keeps a single equation as one line', () => {
    assert.deepEqual(lawFormulaLines(getLabItem('law-newton-second') as LabLawItem), ['F = m × a']);
  });
});

describe('law slides', () => {
  it('is an ordinary intro slide, no new slide kind', () => {
    const s = buildLabSlide(getLabItem('law-newton-second')!, true, 0)!;
    assert.equal(s.type, 'intro');
    assert.ok(s.title.includes('القانون الثاني لنيوتن'));
    assert.ok(s.content.split('\n')[0] === 'F = m × a');
    assert.ok(s.content.includes('• a — Acceleration (m·s⁻²)'));
  });
  it('carries the lesson terms only in an Arabic deck, and never repeats the title as a term', () => {
    const ar = buildLabSlide(getLabItem('law-molar-mass')!, true, 0)!;
    assert.ok(ar.content.includes('• المول'));
    assert.ok(!ar.content.includes('• الكتلة المولية'));
    const en = buildLabSlide(getLabItem('law-molar-mass')!, false, 0)!;
    assert.ok(!/[؀-ۿ]/.test(en.content));
  });
});

describe('interactive slides', () => {
  it('is a link slide: a document media slide carrying the share link and the title', () => {
    const item = getLabItem('lab-periodic-table')!;
    const s = buildLabSlide(item, true, 0)!;
    assert.equal(s.type, 'media');
    assert.equal(s.mediaKind, 'document');
    assert.equal(s.mediaUrl, labShareUrl('lab-periodic-table'));
    assert.equal(s.mediaCaption, item.titleAr);
    assert.equal(s.content, item.titleAr);
  });
});

describe('external slides — refusals', () => {
  const item = externals.find(e => getExternalResource(e.externalId)?.kind === 'image')!;
  const image = getExternalResource(item.externalId)!;
  const withResource = (patch: Partial<ExternalResource>) => () => ({ ...image, ...patch });

  it('builds the slide for a licensed, credited image', () => {
    assert.ok(buildLabSlide(item, true, 0, withResource({})));
  });
  it('produces no slide without an attribution', () => {
    assert.equal(buildLabSlide(item, true, 0, withResource({ attribution: '  ' })), null);
  });
  it('produces no slide for a reference-only licence', () => {
    assert.equal(buildLabSlide(item, true, 0, withResource({ license: 'CC-BY-SA-4.0' })), null);
  });
  it('produces no image slide without a stable fetchUrl', () => {
    assert.equal(buildLabSlide(item, true, 0, withResource({ fetchUrl: undefined })), null);
  });
  it('produces no slide when the resource is gone', () => {
    assert.equal(buildLabSlide(item, true, 0, () => undefined), null);
  });
  it('refuses a video that is not an embeddable YouTube link', () => {
    const vid = externals.find(e => getExternalResource(e.externalId)?.kind === 'video')!;
    const v = getExternalResource(vid.externalId)!;
    assert.ok(buildLabSlide(vid, true, 0, () => v));
    assert.equal(buildLabSlide(vid, true, 0, () => ({ ...v, sourceUrl: 'https://example.test/x' })), null);
    assert.equal(buildLabSlide(vid, true, 0, () => ({ ...v, license: 'CC-BY-SA-4.0' })), null);
  });
});

describe('labSlidesFor / deckableLabItems', () => {
  it('keeps the order given and skips unknown ids', () => {
    const out = labSlidesFor(['law-molar-mass', 'nope', 'law-newton-second'], true);
    assert.equal(out.length, 2);
    assert.ok(out[0]!.title.includes('الكتلة المولية'));
  });
  it('offers only the lesson’s items that can actually be built', () => {
    const lessonId = getLabItem('law-newton-second')!.lessonId;
    const items = deckableLabItems(lessonId, true);
    assert.ok(items.length > 0);
    assert.ok(items.every(i => i.lessonId === lessonId));
    assert.ok(items.every(i => buildLabSlide(i, true, 0) !== null));
  });
  it('is empty for no lesson', () => {
    assert.deepEqual(deckableLabItems('', true), []);
  });
});

// ── The guards ───────────────────────────────────────────────────────────────

describe('GUARD: every shipped law, through the deck’s real formula helpers', () => {
  it('has teeth: the raw forms really are misdrawn', () => {
    assert.equal(hasRenderableMath('m/s²'), true, 'a slash unit parses as a stacked fraction');
    assert.notEqual(isolateForeignRuns('N = n × Nₐ'), `${LRI}N = n × Nₐ${PDI}`, 'ₐ is stranded outside the isolate');
  });

  for (const law of laws) {
    for (const isAr of [true, false]) {
      it(`${law.id} (${isAr ? 'ar' : 'en'})`, () => {
        const slide = buildLabSlide(law, isAr, 0)!;
        const lines = slide.content.split('\n');
        const blank = lines.indexOf('');
        const equations = lines.slice(0, blank);
        const rest = lines.slice(blank + 1).filter(Boolean);

        assert.ok(equations.length > 0, 'a formula section first');
        for (const line of equations) {
          assert.ok(looksLikeEquation(line), `"${line}" should be drawn as an equation`);
          // The whole equation is one isolated run: nothing stranded in the RTL flow.
          assert.equal(isolateForeignRuns(line), `${LRI}${line}${PDI}`, `"${line}" is not one isolated run`);
        }
        for (const line of rest) {
          assert.ok(isBulletLine(line), `"${line}" must be a bullet so it is never drawn as a boxed equation`);
          assert.ok(!hasRenderableMath(stripBullet(line)), `"${line}" would be parsed as stacked maths`);
        }
        assert.ok(!/[ₐ-ₜ]/.test(slide.content), 'a subscript letter would be stranded outside the isolate');
      });
    }
  }
});

describe('GUARD: every shipped credit reaches both fields the exports read', () => {
  for (const item of externals) {
    const res = getExternalResource(item.externalId)!;
    it(`${item.id}`, () => {
      const slide = buildLabSlide(item, true, 0);
      assert.ok(slide, 'a shipped external item must be deckable');
      assert.ok(res.attribution.trim());
      assert.ok(slide.content.includes(res.attribution), 'presenter reads the credit from content');
      assert.ok(slide.mediaCaption?.includes(res.attribution), 'PDF and PPTX read it from mediaCaption');
      if (res.kind === 'image') {
        assert.equal(slide.mediaUrl, res.fetchUrl);
        assert.ok(!slide.mediaUrl!.includes('/media/external/'), 'never the one-hour presigned link');
      } else {
        assert.equal(slide.mediaUrl, res.sourceUrl);
      }
    });
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labSlides.test.ts`
Expected: FAIL — `../labSlides.ts` not found.

- [ ] **Step 3: Implement**

Create `artifacts/mobile/services/labSlides.ts`:

```ts
/**
 * Science Lab items as deck slides — pure, so `node --test` can load it.
 *
 * Nothing here is a new slide kind. A law is an ordinary `intro` slide; an
 * external image or video is a `media` slide made by `buildMediaSlide`; an
 * interactive is a `media` slide of kind `document` that carries the share
 * link, because the deck cannot run a component.
 *
 * Two things about the deck's own text helpers shaped the notation (measured
 * 2026-10-07; `labSlides.test.ts` re-checks every shipped law on every run):
 *  - `m/s²` parses as a stacked fraction, so a unit with a slash is written
 *    as a negative power, `m·s⁻²`;
 *  - `ₐ` falls outside the right-to-left isolate, so a subscript letter is
 *    written as the plain capital, `NA`.
 * Quantity lines are bullets: a bullet is never drawn as a boxed equation.
 *
 * A slide never carries unlicensed or uncredited media: an external item with
 * no attribution, or whose licence does not allow showing it, makes no slide.
 * The credit goes in `content` AND `mediaCaption` — the presenter reads one,
 * the PDF and PPTX the other (`buildMediaSlide` sets both from one caption).
 *
 * Spec: docs/superpowers/specs/2026-10-07-lab-class-workflow-design.md
 */
import {
  getLabItem,
  labItemsForLesson,
  type LabItem,
  type LabLawItem,
} from '@workspace/curriculum/lab';
import { getExternalResource, type ExternalResource } from '@workspace/curriculum/external';
import { usePolicy } from '@workspace/curriculum/bank';
import type { ActivitySlide } from './ai/AIService.ts';
import { buildMediaSlide, youtubeIdFrom } from './classMedia.ts';
import { labShareUrl } from './labLinks.ts';

const SUPERSCRIPT: Record<string, string> = { '': '¹', '²': '²', '³': '³' };

/** `m/s²` → `m·s⁻²`; a unit with no slash, or one this cannot read, is unchanged. */
export function unitForSlide(unit: string): string {
  if (!unit.includes('/')) return unit;
  const [head, ...tails] = unit.split('/');
  const powers: string[] = [];
  for (const tail of tails) {
    const m = /^([A-Za-z]+)([²³])?$/.exec(tail.trim());
    if (!m) return unit;
    powers.push(`${m[1]}⁻${SUPERSCRIPT[m[2] ?? '']}`);
  }
  return [head!.trim(), ...powers].join('·');
}

const SUBSCRIPT_LETTER: Record<string, string> = { 'ₐ': 'A', 'ₑ': 'E', 'ₒ': 'O', 'ₓ': 'X' };

/** Subscript letters as plain capitals; digit subscripts (`H₂O`) are left as they are. */
export function slideSymbol(text: string): string {
  return text.replace(/[ₐₑₒₓ]/g, ch => SUBSCRIPT_LETTER[ch] ?? ch);
}

/** One equation per line: a card that holds several writes them as `a ,  b ,  c`. */
export function lawFormulaLines(item: LabLawItem): string[] {
  return item.formula
    .split(/\s+,\s+/)
    .map(part => slideSymbol(part).trim())
    .filter(Boolean);
}

function buildLawSlide(item: LabLawItem, isAr: boolean, slideNumber: number): ActivitySlide {
  const quantityLines = item.quantities.map(
    q => `• ${slideSymbol(q.symbol)} — ${q.nameEn} (${unitForSlide(q.unit)})`,
  );
  // Lesson vocabulary is Arabic, copied verbatim; the title is already one of the terms.
  const terms = isAr ? item.termsAr.filter(term => term !== item.titleAr) : [];
  const content = [
    ...lawFormulaLines(item),
    '',
    ...quantityLines,
    ...(terms.length ? ['', ...terms.map(term => `• ${term}`)] : []),
  ].join('\n');
  return {
    slideNumber,
    type: 'intro',
    title: `📐 ${isAr ? item.titleAr : item.titleEn}`,
    content,
    durationSeconds: 0,
  };
}

function buildExternalSlide(
  item: Extract<LabItem, { kind: 'external' }>,
  isAr: boolean,
  slideNumber: number,
  resolve: (id: string) => ExternalResource | undefined,
): ActivitySlide | null {
  const res = resolve(item.externalId);
  if (!res) return null;
  const credit = (res.attribution ?? '').trim();
  if (!credit) return null;
  const policy = usePolicy({ authority: res.authority, license: res.license });
  const caption = `${isAr ? res.titleAr : res.titleEn} — ${credit}`;

  if (res.kind === 'image') {
    // `fetchUrl` is a stable public URL; the presigned `/media/external/:id`
    // link lasts an hour and would break a saved deck.
    if (policy !== 'quotable' || !res.fetchUrl) return null;
    return buildMediaSlide('image', res.fetchUrl, caption, isAr, slideNumber);
  }
  if (res.kind === 'video') {
    if (policy !== 'embed-only' || res.provider !== 'youtube' || !youtubeIdFrom(res.sourceUrl)) return null;
    return buildMediaSlide('video', res.sourceUrl, caption, isAr, slideNumber);
  }
  return null;
}

/** The slide for one lab item, or null when it may not or cannot be shown. */
export function buildLabSlide(
  item: LabItem,
  isAr: boolean,
  slideNumber: number,
  resolve: (id: string) => ExternalResource | undefined = getExternalResource,
): ActivitySlide | null {
  switch (item.kind) {
    case 'law':
      return buildLawSlide(item, isAr, slideNumber);
    case 'interactive':
      return buildMediaSlide('document', labShareUrl(item.id), isAr ? item.titleAr : item.titleEn, isAr, slideNumber);
    case 'external':
      return buildExternalSlide(item, isAr, slideNumber, resolve);
    default:
      return null;
  }
}

/** Slides for the picked ids, in the order picked. Unknown ids and refused items are skipped. */
export function labSlidesFor(itemIds: readonly string[], isAr: boolean): ActivitySlide[] {
  const out: ActivitySlide[] = [];
  for (const id of itemIds) {
    const item = getLabItem(id);
    const slide = item ? buildLabSlide(item, isAr, 0) : null;
    if (slide) out.push(slide);
  }
  return out;
}

/** The lesson's lab items that can produce a slide — what the deck picker offers. */
export function deckableLabItems(lessonId: string, isAr: boolean): LabItem[] {
  return labItemsForLesson(lessonId).filter(item => buildLabSlide(item, isAr, 0) !== null);
}
```

If `usePolicy`'s parameter type rejects `res.authority` (it is `Pick<CurriculumSource,'authority'> & {license?}`), read `ExternalResource.authority`'s declared type in `lib/curriculum/src/external.ts` and pass it through unchanged; do not cast to `any`.

- [ ] **Step 4: Run to verify it passes**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labSlides.test.ts`
Expected: PASS. **If a guard fails, fix the notation in `labSlides.ts`, never loosen the guard.** If a shipped law's quantity unit has a shape `unitForSlide` cannot read, extend the parser and add a test case for it.

Then `pnpm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/labSlides.ts artifacts/mobile/services/__tests__/labSlides.test.ts
git commit -m "feat(mobile): lab items as deck slides, with a guard through the real formula helpers"
```

---

### Task 5: Mobile — insert lab slides into a deck, and the picker on the slides screen

**Files:**
- Modify: `artifacts/mobile/services/classMedia.ts` (`slotForResources`, `insertLessonResources`, new `insertLabSlides`)
- Create: `artifacts/mobile/services/__tests__/classMediaLab.test.ts`
- Create: `artifacts/mobile/components/ui/LessonLabItems.tsx`
- Modify: `artifacts/mobile/app/ai-tools/slides.tsx`
- Modify: `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Consumes (Task 4): `labSlidesFor(ids, isAr)`, `deckableLabItems(lessonId, isAr)`, `labShelfKey` not needed.
- Produces:
  - `insertLabSlides(slides: readonly ActivitySlide[], labSlides: readonly ActivitySlide[]): ActivitySlide[]`
  - `LessonLabItems` props `{ lessonId: string; isAr: boolean; picks: string[]; onChange: (ids: string[]) => void }`
  - i18n keys `slidesFromLab`, `slidesFromLabHint`

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/classMediaLab.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { ActivitySlide } from '../ai/AIService.ts';
import { insertLabSlides, insertLessonResources } from '../classMedia.ts';

const slide = (type: ActivitySlide['type'], title: string): ActivitySlide => ({
  slideNumber: 0,
  type,
  title,
  content: title,
  durationSeconds: 0,
});
const titles = (s: readonly ActivitySlide[]) => s.map(x => x.title);

describe('insertLabSlides', () => {
  const lab = [slide('intro', 'LAB-1'), slide('media', 'LAB-2')];

  it('goes before the first worked example', () => {
    const deck = [slide('intro', 'title'), slide('intro', 'teach'), slide('challenge', 'ex'), slide('summary', 'sum')];
    assert.deepEqual(titles(insertLabSlides(deck, lab)), ['title', 'teach', 'LAB-1', 'LAB-2', 'ex', 'sum']);
  });

  it('falls back to before the summary, then to the end', () => {
    assert.deepEqual(
      titles(insertLabSlides([slide('intro', 'title'), slide('summary', 'sum')], lab)),
      ['title', 'LAB-1', 'LAB-2', 'sum'],
    );
    assert.deepEqual(
      titles(insertLabSlides([slide('intro', 'title'), slide('intro', 'teach')], lab)),
      ['title', 'teach', 'LAB-1', 'LAB-2'],
    );
  });

  it('never lands at slide 0, which the exports always draw as the title slide', () => {
    assert.deepEqual(titles(insertLabSlides([slide('intro', 'title')], lab)), ['title', 'LAB-1', 'LAB-2']);
    assert.deepEqual(titles(insertLabSlides([slide('challenge', 'odd'), slide('intro', 'x')], lab))[0], 'odd');
  });

  it('keeps the order given, as a batch', () => {
    const out = insertLabSlides([slide('intro', 't'), slide('challenge', 'c')], lab);
    assert.deepEqual(titles(out).slice(1, 3), ['LAB-1', 'LAB-2']);
  });

  it('renumbers every slide from 1', () => {
    const out = insertLabSlides([slide('intro', 't'), slide('challenge', 'c')], lab);
    assert.deepEqual(out.map(s => s.slideNumber), [1, 2, 3, 4]);
  });

  it('is a copy, and a no-op for an empty batch', () => {
    const deck = [slide('intro', 't')];
    const out = insertLabSlides(deck, []);
    assert.notEqual(out, deck);
    assert.deepEqual(titles(out), ['t']);
  });

  it('lands after the teacher’s attachments when both are inserted', () => {
    const deck = [slide('intro', 'title'), slide('challenge', 'ex')];
    const withAttachments = insertLessonResources(deck, [{ kind: 'image', url: 'https://x.test/a.png', caption: 'ATT' }], true);
    const both = insertLabSlides(withAttachments, [slide('intro', 'LAB')]);
    assert.deepEqual(
      titles(both).map(t => (t === 'صورة' ? 'ATT' : t)),
      ['title', 'ATT', 'LAB', 'ex'],
    );
  });
});
```

(The `insertLessonResources` image slide's title is `'صورة'` in Arabic — the test maps it to a stable label; if `MEDIA_SLIDE_TITLE` ever changes, update that one line.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/classMediaLab.test.ts`
Expected: FAIL — `insertLabSlides` is not exported.

- [ ] **Step 3: Implement the insertion**

In `services/classMedia.ts`, add above `insertLessonResources` and use it there:

```ts
/**
 * Where hand-added slides (teacher attachments, lab items) go: after the
 * teaching, before the worked examples, else before the summary, else at the
 * end — and never at index 0, which every export draws as the title slide.
 */
function slotForResources(slides: readonly ActivitySlide[]): number {
  const beforeExamples = slides.findIndex(s => s.type === 'challenge');
  const beforeSummary = slides.findIndex(s => s.type === 'summary');
  const at = beforeExamples >= 0 ? beforeExamples : beforeSummary >= 0 ? beforeSummary : slides.length;
  return Math.max(at, Math.min(1, slides.length));
}
```

Replace the three lines computing `at` in `insertLessonResources` with `const at = slotForResources(slides);` (behaviour is unchanged except that a deck whose first slide is a `challenge` no longer gets a resource at index 0). Then add:

```ts
/**
 * Put already-built lab slides into a deck, as one batch in the order given,
 * at the same slot `insertLessonResources` uses. Called after it, so the
 * teacher's own attachments sit ahead of the lab slides.
 */
export function insertLabSlides(
  slides: readonly ActivitySlide[],
  labSlides: readonly ActivitySlide[],
): ActivitySlide[] {
  if (labSlides.length === 0) return [...slides];
  const at = slotForResources(slides);
  return [...slides.slice(0, at), ...labSlides, ...slides.slice(at)].map((s, i) => ({ ...s, slideNumber: i + 1 }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run both: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/classMediaLab.test.ts services/__tests__/classMedia.test.ts`
Expected: PASS (the existing `classMedia.test.ts` guards `insertLessonResources`).

- [ ] **Step 5: The picker component and the screen**

`i18n.ts`, Arabic block beside `slidesIncludeAttachments`:
```ts
    slidesFromLab: 'من المختبر',
    slidesFromLabHint: 'اختر مواد من مختبر هذا الدرس لإضافتها إلى الشرائح.',
```
English block:
```ts
    slidesFromLab: 'From the Lab',
    slidesFromLabHint: 'Pick items from this lesson’s lab to add to the slides.',
```

Create `components/ui/LessonLabItems.tsx` (module-scope components; nothing is picked by default, so lab slides are off until chosen):

```tsx
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { deckableLabItems } from '@/services/labSlides';

type Props = {
  /** The grounded lesson's KB id — empty until the topic resolves to a lesson, in which case nothing renders. */
  lessonId: string;
  /** The deck's content language: item titles and the slides built from them follow it. */
  isAr: boolean;
  picks: string[];
  onChange: (ids: string[]) => void;
};

/**
 * The lab items filed on the lesson being built, to tick into the deck. Off by
 * default: nothing is inserted until a teacher picks it, the same stance as
 * `includeAttachments`. Keyed by lesson id, never title.
 */
export function LessonLabItems({ lessonId, isAr, picks, onChange }: Props) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const items = useMemo(() => deckableLabItems(lessonId, isAr), [lessonId, isAr]);
  if (items.length === 0) return null;
  const align = isRTL ? 'right' : 'left';
  const toggle = (id: string) =>
    onChange(picks.includes(id) ? picks.filter(p => p !== id) : [...picks, id]);

  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="flask-outline" size={18} color={colors.primary} />
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 15, flex: 1, textAlign: align }}>
          {t('slidesFromLab')}
        </Text>
      </View>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
        {t('slidesFromLabHint')}
      </Text>
      {items.map(item => {
        const on = picks.includes(item.id);
        return (
          <Pressable
            key={item.id}
            onPress={() => toggle(item.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
          >
            <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? colors.primary : colors.mutedForeground} />
            <Text
              numberOfLines={2}
              style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 14, flex: 1, textAlign: align }}
            >
              {isAr ? item.titleAr : item.titleEn}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6, marginBottom: 14 },
});
```

`app/ai-tools/slides.tsx`:
1. Imports: extend the `@/services/classMedia` value import with `insertLabSlides`; add `import { labSlidesFor } from '@/services/labSlides';` and `import { LessonLabItems } from '@/components/ui/LessonLabItems';`. (`useEffect` is already imported; if not, add it to the React import.)
2. State, beside `includeAttachments` (line ~132):

```tsx
  /**
   * Lab items picked for this deck. Nothing is picked by default, so nothing is
   * inserted until a teacher asks. They are built and inserted client-side after
   * generation — never in a request body — so they cannot reach the shared
   * generation cache. Cleared when the lesson changes: an id from another
   * lesson's lab must not ride into this deck.
   */
  const [labPicks, setLabPicks] = useState<string[]>([]);
  useEffect(() => { setLabPicks([]); }, [groundedLessonId]);
```
3. Site 1 (preliminary deck, line ~486): change to

```tsx
        prelim = {
          ...base,
          slides: insertLabSlides(
            insertLessonResources(base.slides, attachedResources, isAr),
            labSlidesFor(labPicks, isAr),
          ),
        };
```
4. Site 2 (built deck, line ~642–645): change to

```tsx
      const built = {
        ...builtBase,
        slides: insertLabSlides(
          insertLessonResources(builtBase.slides, attachedResources, isAr),
          labSlidesFor(labPicks, isAr),
        ),
      };
```
5. Under `<LessonAttachments … />` (line ~911) add: `<LessonLabItems lessonId={groundedLessonId} isAr={isAr} picks={labPicks} onChange={setLabPicks} />`.

Do not touch `AIRequest` construction, `options`, or the regeneration fields.

- [ ] **Step 6: Verify**

`pnpm run typecheck` (root), repo lint if one exists, then `cd artifacts/mobile && pnpm test` (about 4 minutes). Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile
git commit -m "feat(mobile): pick lab items for a deck and insert them client-side after generation"
```

---

### Task 6: Records, verification and the PR

**Files:**
- Modify: `STATUS.md`
- Modify: `docs/superpowers/specs/2026-10-06-science-lab-design.md`
- (PR #898 description)

**Interfaces:** none.

- [ ] **Step 1: Correct the earlier claim and record the new state**

1. `docs/superpowers/specs/2026-10-06-science-lab-design.md` "Out of scope": the phrase "(a `class_resources` `lab` kind needs a schema change and the manual production schema push)" is wrong (`class_resources.kind` is plain `text`, no CHECK or enum). Replace it with "(a `class_resources` `lab` kind needs **no** schema change; see `2026-10-07-lab-class-workflow-design.md`, which built it)".
2. `STATUS.md`, section «The Science Lab: a shelf in the library, 2026-10-06»: find the sentence saying attaching a lab item to a class needs a schema change / push and correct it in place to the same fact, then add a short subsection **«Lab in the class workflow, 2026-10-07»** that states, plainly: lab items can be put on a class shelf (`kind='lab'`, no DDL, server writes the title, unknown id is 400, duplicates refused by a route check not an index, so two near-simultaneous taps can create two rows) and ticked into a deck (client-side, after generation, off by default, unit notation `m·s⁻²` and `NA` chosen by the guard test in `labSlides.test.ts`). List what is **not** done or **not seen**: nothing was viewed in a browser; the PDF and PPTX output of lab slides has not been seen by a person; the route branch has no database test; the slide editor's `applyMediaEdit` can strip a lab slide's credit when its caption is blank and blocks editing audio and document slides (pre-existing); image media slides are cropped (`object-fit: cover`) in the HTML and PPTX exports; a deck's lab slides do not update if the lab item changes; a client built before this release will show a lab row with no icon or label (the server returns it; older bundles have no `lab` entry in their kind maps); the add-to-class action is not on the lab present page. Edit the STATUS lines that this makes untrue in the same commit.
3. Do **not** touch `app.json` or anything under `lib/db/src/schema`.

- [ ] **Step 2: Full verification**

Run, and read the output (do not assume):

```bash
pnpm run typecheck
pnpm --filter @workspace/curriculum test
cd artifacts/mobile && pnpm test
cd ../api-server && pnpm build && pnpm test
cd ../.. && git status --short && git diff --stat origin/main -- lib/db app.json artifacts/mobile/app.json
```
Expected: all green; the last diff is empty (no schema, no `app.json` change). If anything under `lib/db/src/schema` shows up, **stop** — the design assumes it does not.

- [ ] **Step 3: Commit and update PR #898**

```bash
git add STATUS.md docs
git commit -m "docs: record the lab class workflow; correct the 'needs a schema push' claim"
git push -u origin claude/optimistic-hawking-fiflkp
```
Update the PR #898 description (`mcp__github__update_pull_request`) to describe what shipped, state `schema-push: n/a — no change under lib/db/src/schema (class_resources.kind is plain text)`, list what was and was not seen (above), and end with the attribution line required for pull request descriptions. Then wait for CI; if it is red, drive it to green per the PR rules. Do not mark it ready for review or merge without the user's instruction.

---

## Self-review

**Spec coverage.**
- Part 1 (shelf): no DDL, `kind='lab'`, server-written title, 400 on unknown id, 409 by route check, unavailable when id leaves the catalogue → Task 1. Open target in-app route, exhaustive maps (`ResourceKind` + icon + label both languages), lab-aware types → Task 2. «المختبر» add-sheet section narrowed to grade/subject with «مضاف» → Tasks 2–3.
- Part 2 (slides): picker «من المختبر» from `labItemsForLesson` off by default, client-side insertion before first challenge / summary / end and never slide 0, shared placement rule → Task 5. Law → `intro` slide, external image → media with `fetchUrl` and credit in both fields, video → media with watch URL, interactive → document link slide → Task 4.
- Guardrails: formula guard through real helpers (and a "has teeth" test), no uncredited/unlicensed media (refusal tests), credits in both fields (guard), server owns title/id (Task 1), no native module / `app.json` / dependency (Global Constraints + Task 6 diff check), unseen-in-browser labelled (Task 6).
- Corrections to earlier records and `schema-push: n/a` → Task 6. Known limits recorded → Task 6 STATUS text.
- **Deviation from the spec, deliberate:** the spec says the deck picker is "off by default" with an include switch like `includeAttachments`. This plan uses per-item ticks with nothing ticked by default instead of a master switch, which is the same default and one fewer toggle; selection lives in screen state, so Regenerate keeps the picked lab slides. The spec's open question on unit notation is settled by measurement (see "Settled by measurement").

**Placeholder scan.** No TBD/TODO; every code step carries code. The two places that say "read X and pass it through unchanged" (`usePolicy` parameter type; `ResourceKind` exhaustive-map fallout from the typecheck) name the exact file to read and the stop condition.

**Type consistency.** `labShelfKey` / `addedKeys` / `LabPickerSheet.added` all use `lab:<id>`; `addLabBodyFor` produces `{kind:'lab', itemId}`, which `parseLabClassResourceInput` reads as `itemId`; `OpenTarget` `{kind:'lab', path}` is consumed in `onOpenResource` as `target.path`; `labSlidesFor(ids, isAr)` and `deckableLabItems(lessonId, isAr)` are used with those signatures in `slides.tsx` and `LessonLabItems`; `insertLabSlides(slides, labSlides)` matches its tests and call sites.
