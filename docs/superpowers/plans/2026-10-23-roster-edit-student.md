# Roster: edit a student (PR 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A teacher can edit a student's name, register number, gender and note from the class Students tab; renaming keeps linked code-only accounts in step; each row shows which account claimed the name and when.

**Architecture:** Pure rules (name key, "is this account name still the derived one") live in a new db-free `lib/rosterRename.ts`, tested like `claimDecision.ts`. `PATCH /students/:id` gains a duplicate-name check (409 `student_name_taken`) and, after the rename, re-derives linked code-only account names through `systemDb`. `GET /classes/:id` returns each student's `links` (account name, relation, joined-at) next to the existing `linked` flag. The app replaces the note-only modal with one `EditStudentSheet` and adds a `ClaimedByLine` under each name.

**Tech Stack:** Express + Drizzle (api-server), Node `--test`, Expo / React Native Web (mobile), pnpm monorepo.

**Spec:** `docs/superpowers/specs/2026-10-23-roster-edit-and-claim-approval-design.md` (section "PR 1"). PR 2 (pending claims) gets its own plan after this lands, because it depends on how the claim routes look then.

## Global Constraints

- No schema change and no migration in this plan.
- Never `sed -i` / `perl -pi` on source; use the Edit tool (files hold Arabic and `${...}`).
- Never log a child's name. Log ids only.
- Latin product name is **Iqrra** in copy; the Arabic brand is **«إقرأ»**. This plan adds neither.
- Arabic is the product language; every new string is added to **both** `ar` and `en` in `artifacts/mobile/services/i18n.ts` (`i18n.test.ts` fails on a missing key).
- Text on a `colors.primary` fill is `colors.primaryForeground`, never `'#fff'`.
- A `<Modal>` holding a text input wraps its body in `<KeyboardSafeView>`; do not add a `KeyboardAvoidingView` inside a screen.
- Relative imports in api-server files loaded by `node --test` carry an explicit `.ts` extension; mobile services likewise.
- `routes/roster.ts` is already pinned in `systemDbFiles.test.ts`; do not add `systemDb` to any other file.
- Branch `claude/happy-bohr-khh1n2` (the spec's draft PR #1225). Commits end with the two trailer lines from the session attribution. Add named paths only (`git add <path>`), never `-A`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `artifacts/api-server/src/lib/rosterRename.ts` (new) | Pure: `nameKey`, `nameTakenBy`, `renamedAccountNames` |
| `artifacts/api-server/src/lib/__tests__/rosterRename.test.ts` (new) | Unit tests for the above |
| `artifacts/api-server/src/routes/roster.ts` (modify) | PATCH duplicate check + account sync; GET class returns `links`; import `nameKey` instead of the local copy |
| `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts` (modify) | Reason string for `routes/roster.ts` |
| `artifacts/api-server/src/routes/__tests__/rosterEdit.db.test.ts` (new) | HTTP + real-DB tests for GET links and PATCH rename |
| `artifacts/mobile/services/rosterLinks.ts` (new) | Pure: `RosterLink`, `selfLink`, `linkDisplayName`, `formatLinkedOn` |
| `artifacts/mobile/services/studentEdit.ts` (new) | Pure: `StudentDraft`, `draftOf`, `studentChanges`, `canSaveStudent` |
| `artifacts/mobile/services/roster.ts` (modify) | `RosterStudent.links`, exported `StudentChanges` |
| `artifacts/mobile/services/__tests__/rosterLinks.test.ts`, `studentEdit.test.ts` (new) | Unit tests |
| `artifacts/mobile/services/i18n.ts` (modify) | New keys, ar + en |
| `artifacts/mobile/components/classes/EditStudentSheet.tsx` (new) | The edit modal |
| `artifacts/mobile/components/classes/ClaimedByLine.tsx` (new) | «حساب: … · date» line |
| `artifacts/mobile/app/classes/[id]/index.tsx` (modify) | Swap the note modal for the sheet, add the line, map `student_name_taken` |
| `docs/status-log.md` (modify) | Entry at the top |

---

### Task 1: Pure rename rules (api-server)

**Files:**
- Create: `artifacts/api-server/src/lib/rosterRename.ts`
- Test: `artifacts/api-server/src/lib/__tests__/rosterRename.test.ts`

**Interfaces:**
- Consumes: `namesForNewAccount(role, rosterName)` from `./redeemPolicy.ts`; types `ClaimRelation`, `ClaimRole` from `./claimDecision.ts`.
- Produces:
  - `nameKey(name: string): string`
  - `nameTakenBy(candidate: string, peers: readonly string[]): boolean`
  - `renamedAccountNames(input: { relation: ClaimRelation; oldRosterName: string; newRosterName: string; current: { firstName: string; lastName: string } }): { firstName: string; lastName: string } | null`

- [ ] **Step 1: Install dependencies (fresh checkout has no `node_modules`)**

Run: `cd /home/user/Iqraa && pnpm install`
Expected: completes without error. (Full install, not filtered — see CLAUDE.md.)

- [ ] **Step 2: Write the failing test**

Create `artifacts/api-server/src/lib/__tests__/rosterRename.test.ts`:

```ts
/**
 * What this guards: renaming a roster row must not leave the linked account
 * wearing the old name, and must never overwrite a name its owner chose.
 *
 * A code-only account (no email) is named from the roster row once, at sign-up
 * (`namesForNewAccount`). The teacher's chat list shows that account name, so a
 * rename that stopped at the roster row left «خالد التبس» in every thread. But
 * a person may also have edited their own name, so the account is rewritten
 * only while it still equals what the OLD roster name would have produced.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { nameKey, nameTakenBy, renamedAccountNames } from "../rosterRename.ts";

describe("nameKey / nameTakenBy", () => {
  it("collapses whitespace and case, nothing more", () => {
    assert.equal(nameKey("  Khaled   AL  Tais "), "khaled al tais");
  });

  it("does not fold Arabic orthography — two different names stay different", () => {
    assert.notEqual(nameKey("أحمد"), nameKey("احمد"));
  });

  it("finds a peer with the same name regardless of spacing", () => {
    assert.equal(nameTakenBy("خالد   التيس", ["سارة", "خالد التيس"]), true);
  });

  it("is false when no peer shares the name", () => {
    assert.equal(nameTakenBy("خالد التيس", ["سارة", "آدم"]), false);
    assert.equal(nameTakenBy("خالد التيس", []), false);
  });
});

describe("renamedAccountNames", () => {
  it("re-derives a student account that still carries the old roster name", () => {
    assert.deepEqual(
      renamedAccountNames({
        relation: "self",
        oldRosterName: "خالد التبس",
        newRosterName: "خالد التيس",
        current: { firstName: "خالد", lastName: "التبس" },
      }),
      { firstName: "خالد", lastName: "التيس" },
    );
  });

  it("re-derives a parent account, which is «ولي أمر» plus the child's name", () => {
    assert.deepEqual(
      renamedAccountNames({
        relation: "guardian",
        oldRosterName: "خالد التبس",
        newRosterName: "خالد التيس",
        current: { firstName: "ولي أمر", lastName: "خالد التبس" },
      }),
      { firstName: "ولي أمر", lastName: "خالد التيس" },
    );
  });

  it("leaves a name its owner changed alone", () => {
    assert.equal(
      renamedAccountNames({
        relation: "self",
        oldRosterName: "خالد التبس",
        newRosterName: "خالد التيس",
        current: { firstName: "خوخو", lastName: "" },
      }),
      null,
    );
  });

  it("returns null when the rename changes nothing about the derived name", () => {
    assert.equal(
      renamedAccountNames({
        relation: "self",
        oldRosterName: "خالد التيس",
        newRosterName: "خالد   التيس",
        current: { firstName: "خالد", lastName: "التيس" },
      }),
      null,
    );
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd /home/user/Iqraa/artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/rosterRename.test.ts`
Expected: FAIL — `Cannot find module '../rosterRename.ts'`.

- [ ] **Step 4: Write the minimal implementation**

Create `artifacts/api-server/src/lib/rosterRename.ts`:

```ts
/**
 * The rules for renaming a roster row, with no database attached — the same
 * split as claimDecision.ts, for the same reason: importing `@workspace/db`
 * needs a live Postgres, and these rules decide whether a person's own name is
 * overwritten.
 */
import type { ClaimRelation, ClaimRole } from "./claimDecision.ts";
import { namesForNewAccount } from "./redeemPolicy.ts";

/**
 * Whitespace-normalised, case-folded. Deliberately does not fold Arabic
 * orthography (أ/ا, ة/ه): merging two people who share a spelling is a worse
 * failure than allowing a near-duplicate, and it cannot be undone from the UI.
 */
export function nameKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Whether `candidate` is already the name of one of `peers`. */
export function nameTakenBy(candidate: string, peers: readonly string[]): boolean {
  const key = nameKey(candidate);
  return peers.some(peer => nameKey(peer) === key);
}

const ROLE_OF: Record<ClaimRelation, ClaimRole> = { self: "student", guardian: "parent" };

/**
 * The new first/last name for a linked code-only account after its roster row
 * was renamed, or null when it should be left as it is.
 *
 * Null when the account's current name is not what `oldRosterName` would have
 * produced — the person edited it, and it is theirs now — and when the rename
 * does not change the derived name at all.
 */
export function renamedAccountNames(input: {
  relation: ClaimRelation;
  oldRosterName: string;
  newRosterName: string;
  current: { firstName: string; lastName: string };
}): { firstName: string; lastName: string } | null {
  const role = ROLE_OF[input.relation];
  const before = namesForNewAccount(role, input.oldRosterName);
  if (input.current.firstName !== before.firstName || input.current.lastName !== before.lastName) {
    return null;
  }
  const after = namesForNewAccount(role, input.newRosterName);
  if (after.firstName === before.firstName && after.lastName === before.lastName) return null;
  return after;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd /home/user/Iqraa/artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/rosterRename.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/lib/rosterRename.ts artifacts/api-server/src/lib/__tests__/rosterRename.test.ts
git diff --cached --stat
git commit -m "feat(api): pure rules for renaming a roster row

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
```

---

### Task 2: `PATCH /students/:id` — duplicate check and account sync

**Files:**
- Modify: `artifacts/api-server/src/routes/roster.ts` (imports ~line 55; local `nameKey` ~line 712; PATCH handler ~lines 1025-1067)
- Modify: `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts:26`
- Modify: `docs/superpowers/specs/2026-10-23-roster-edit-and-claim-approval-design.md` (the "one transaction" line)
- Test: `artifacts/api-server/src/routes/__tests__/rosterEdit.db.test.ts` (new)

**Interfaces:**
- Consumes: `nameKey`, `nameTakenBy`, `renamedAccountNames` from `../lib/rosterRename.ts` (Task 1).
- Produces: `PATCH /students/:id` answers **409** `{ error, code: "student_name_taken" }` when another live student in any class this student sits in has the same `nameKey`; otherwise unchanged behaviour plus linked code-only accounts renamed.

- [ ] **Step 1: Write the failing DB test**

Create `artifacts/api-server/src/routes/__tests__/rosterEdit.db.test.ts`:

```ts
/**
 * Editing a roster row over HTTP, against a real database: the duplicate-name
 * refusal and the rename reaching linked code-only accounts. The class roster
 * read (`links`) is covered here too, since it shares the fixture.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

describeDb("editing a roster row over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let parentC = "";

  const user = async (sql: string, params: unknown[]) => (await db.pool.query(sql, params)).rows[0];
  const names = async (userId: string) =>
    user(`SELECT first_name, last_name FROM users WHERE id = $1`, [userId]);

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    // Roster writes are gated on the teacher's consent attestation.
    await db.pool.query(`UPDATE users SET roster_consent_at = now() WHERE id = ANY($1::uuid[])`, [
      [w.users.t1, w.users.t2],
    ]);
    // Sara's accounts as a code-only sign-up would have made them: named from the roster row.
    await db.pool.query(
      `UPDATE users SET login_code_hash = 'h-student', first_name = 'سارة', last_name = '' WHERE id = $1`,
      [w.users.studentA],
    );
    await db.pool.query(
      `UPDATE users SET login_code_hash = 'h-parent', first_name = 'ولي أمر', last_name = 'سارة' WHERE id = $1`,
      [w.users.parentA],
    );
    // A second guardian who has since chosen their own name.
    parentC = (
      await user(
        `INSERT INTO users (first_name, last_name, role, login_code_hash) VALUES ('أم', 'سارة', 'parent', 'h-parent-c') RETURNING id`,
        [],
      )
    ).id;
    await db.pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'guardian')`, [
      w.students.sA1,
      parentC,
    ]);
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  describe("GET /classes/:id", () => {
    it("lists who holds each name, with the account's name and when it joined", async () => {
      const res = await call(on, "GET", `/classes/${w.classes.c1}`, w.users.t1);
      assert.equal(res.status, 200, on.logs().slice(-1500));
      const sara = res.json.students.find((s: { id: string }) => s.id === w.students.sA1);
      assert.equal(sara.linked, true);
      const self = sara.links.find((l: { relation: string }) => l.relation === "self");
      assert.equal(self.userId, w.users.studentA);
      assert.equal(self.firstName, "سارة");
      assert.ok(self.linkedAt);
      assert.equal(sara.links.filter((l: { relation: string }) => l.relation === "guardian").length, 2);
      assert.equal("linkedCount" in sara, false);
    });

    it("is another teacher's class: 404", async () => {
      const res = await call(on, "GET", `/classes/${w.classes.c1}`, w.users.t2);
      assert.equal(res.status, 404);
    });
  });

  describe("PATCH /students/:id", () => {
    it("renames, and re-derives linked code-only accounts that still carry the old name", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.sA1}`, w.users.t1, { displayName: "سارة أحمد" });
      assert.equal(res.status, 200, on.logs().slice(-1500));
      assert.equal(res.json.student.displayName, "سارة أحمد");
      assert.deepEqual(await names(w.users.studentA), { first_name: "سارة", last_name: "أحمد" });
      assert.deepEqual(await names(w.users.parentA), { first_name: "ولي أمر", last_name: "سارة أحمد" });
    });

    it("leaves an account whose owner chose their own name alone", async () => {
      assert.deepEqual(await names(parentC), { first_name: "أم", last_name: "سارة" });
    });

    it("refuses a name already used by another student in the same class, however it is spaced", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.aA}`, w.users.t1, { displayName: "سارة   أحمد" });
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "student_name_taken");
      const row = await user(`SELECT display_name FROM students WHERE id = $1`, [w.students.aA]);
      assert.equal(row.display_name, "آدم");
    });

    it("allows the same name in another teacher's roster", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.sA2}`, w.users.t2, { displayName: "سارة أحمد" });
      assert.equal(res.status, 200);
    });

    it("allows keeping a student's own name (only the spacing changes)", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.sA1}`, w.users.t1, { displayName: "سارة  أحمد" });
      assert.equal(res.status, 200);
    });

    it("is another teacher's student: 404, and nothing changes", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.sA1}`, w.users.t2, { displayName: "x" });
      assert.equal(res.status, 404);
    });

    it("still refuses an empty name", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.sA1}`, w.users.t1, { displayName: "   " });
      assert.equal(res.status, 400);
    });
  });
});
```

- [ ] **Step 2: Build the bundle and run it to verify it fails**

DB-backed tests boot `dist/index.mjs` and need `TEST_DATABASE_URL` (see `LOCAL_SETUP.md`, «DB-backed API tests»).

Run:
```bash
cd /home/user/Iqraa/artifacts/api-server
pg_isready 2>&1 | head -1; echo "TEST_DATABASE_URL=${TEST_DATABASE_URL:-<unset>}"
pnpm build
node --experimental-strip-types --test src/routes/__tests__/rosterEdit.db.test.ts
```
Expected with a local Postgres: the `GET` tests FAIL (`links` undefined) and the rename/409 tests FAIL. Expected without one: the suite **skips** with the TEST_DATABASE_URL reason. If it skips, say so in the final report — the same suite runs in CI with `REQUIRE_DB_TESTS=true`, so a red CI there is the check; do not claim it passed locally.

- [ ] **Step 3: Implement — import, drop the local `nameKey`**

In `artifacts/api-server/src/routes/roster.ts`, after the line `import { subjectColumns, withSubjectIds } from "../lib/classSubjects.js";` add:

```ts
import { nameKey, nameTakenBy, renamedAccountNames } from "../lib/rosterRename.ts";
```

In the `POST /classes/:id/students` handler, delete this line (the import replaces it; `takenNames` keeps using `nameKey`):

```ts
    const nameKey = (name: string) => name.replace(/\s+/g, " ").trim().toLowerCase();
```

- [ ] **Step 4: Implement — the sync helper**

Directly above `const STUDENT_GENDERS = new Set(["male", "female", ""]);` add:

```ts
/**
 * After a rename, the linked code-only accounts (no email, no password, no
 * Google id) are named from the roster row, so they are re-derived here — but
 * only while they still carry the OLD roster name (see lib/rosterRename.ts).
 *
 * systemDb: it writes other users' rows, which the app role cannot. That is a
 * second connection, so this cannot share a transaction with the roster update;
 * it runs after it and only logs on failure, because the rename the teacher
 * asked for has already been saved and must not be reported as failed.
 * Logs ids only — never a child's name.
 */
async function syncLinkedAccountNames(studentId: string, oldName: string, newName: string): Promise<void> {
  try {
    const linked = await systemDb
      .select({
        userId: users.id,
        relation: rosterLinks.relation,
        firstName: users.firstName,
        lastName: users.lastName,
        loginCodeHash: users.loginCodeHash,
        passwordHash: users.passwordHash,
        googleId: users.googleId,
      })
      .from(rosterLinks)
      .innerJoin(users, eq(users.id, rosterLinks.userId))
      .where(eq(rosterLinks.studentId, studentId));

    for (const account of linked) {
      if (!account.loginCodeHash || account.passwordHash || account.googleId) continue;
      const next = renamedAccountNames({
        relation: account.relation,
        oldRosterName: oldName,
        newRosterName: newName,
        current: account,
      });
      if (next) await systemDb.update(users).set(next).where(eq(users.id, account.userId));
    }
  } catch (err) {
    logger.error({ err, studentId }, "renaming a student's linked accounts failed — the roster name was saved");
  }
}
```

- [ ] **Step 5: Implement — the PATCH handler**

In the `router.patch("/students/:id", …)` handler, replace

```ts
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body?.displayName !== undefined) {
      const displayName = trimmed(req.body.displayName);
      if (!displayName) {
        res.status(400).json({ error: "displayName cannot be empty" });
        return;
      }
      patch["displayName"] = displayName;
    }
```

with

```ts
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    let renamedFrom: string | null = null;
    if (req.body?.displayName !== undefined) {
      const displayName = trimmed(req.body.displayName);
      if (!displayName) {
        res.status(400).json({ error: "displayName cannot be empty" });
        return;
      }
      const [current] = await db
        .select({ displayName: students.displayName })
        .from(students)
        .where(and(eq(students.id, studentId), eq(students.teacherId, req.user!.id)))
        .limit(1);
      if (!current) {
        res.status(404).json({ error: "Student not found" });
        return;
      }
      if (displayName !== current.displayName) {
        // The same rule the add route applies: a name already in one of this
        // student's classes would split a child's results across two look-alike
        // rows. Other classes and other teachers are free to reuse it.
        const myClasses = db
          .select({ id: classMemberships.classGroupId })
          .from(classMemberships)
          .where(eq(classMemberships.studentId, studentId));
        const peers = await db
          .selectDistinct({ displayName: students.displayName })
          .from(classMemberships)
          .innerJoin(students, eq(students.id, classMemberships.studentId))
          .where(
            and(
              inArray(classMemberships.classGroupId, myClasses),
              ne(students.id, studentId),
              eq(students.teacherId, req.user!.id),
              isNull(students.archivedAt),
            ),
          );
        if (nameTakenBy(displayName, peers.map(p => p.displayName))) {
          res.status(409).json({
            error: "A student with this name is already in the class",
            code: "student_name_taken",
          });
          return;
        }
        renamedFrom = current.displayName;
      }
      patch["displayName"] = displayName;
    }
```

Then, after the 404 check following `.returning()` and before `res.json({ student: row })`, add:

```ts
    if (renamedFrom !== null) {
      await syncLinkedAccountNames(studentId, renamedFrom, row.displayName);
    }
```

- [ ] **Step 6: Update the `systemDb` pin's reason and the spec**

In `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts`, replace the value on the `"routes/roster.ts"` line with:

```ts
  "routes/roster.ts": "reissuing a login code revokes that account's refresh tokens, and a rename re-derives a linked account's name — both write another user's row, which the app role cannot",
```

In the spec, replace the sentence "Done with `systemDb` inside one transaction with the student update (it writes another user's row)." with "Done with `systemDb` right after the student update, not in the same transaction (a second connection cannot share one); a failure is logged and the saved rename stands."

- [ ] **Step 7: Typecheck and run the tests**

Run:
```bash
cd /home/user/Iqraa/artifacts/api-server
pnpm run typecheck
pnpm build
node --experimental-strip-types --test src/lib/__tests__/rosterRename.test.ts src/lib/__tests__/systemDbFiles.test.ts src/routes/__tests__/rosterEdit.db.test.ts
```
Expected: typecheck clean; unit tests PASS; the DB suite PASSES with a local `TEST_DATABASE_URL`, otherwise skips (report that).

- [ ] **Step 8: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/routes/roster.ts artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts artifacts/api-server/src/routes/__tests__/rosterEdit.db.test.ts docs/superpowers/specs/2026-10-23-roster-edit-and-claim-approval-design.md
git diff --cached --stat
git commit -m "feat(api): refuse duplicate student names on rename and rename linked accounts

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
```

---

### Task 3: `GET /classes/:id` returns each student's `links`

**Files:**
- Modify: `artifacts/api-server/src/routes/roster.ts` (the `router.get("/classes/:id", …)` handler, ~lines 183-221)
- Test: `artifacts/api-server/src/routes/__tests__/rosterEdit.db.test.ts` (the `GET` tests from Task 2 are the failing tests)

**Interfaces:**
- Consumes: nothing new.
- Produces: each student in the response is `{ id, displayName, externalRef, gradeId, teacherNote, gender, createdAt, linked: boolean, links: { userId: string; relation: "self" | "guardian"; firstName: string; lastName: string; linkedAt: string }[] }`, `links` oldest-first.

- [ ] **Step 1: Confirm the GET tests fail**

They were written in Task 2 Step 1 and were failing there (no `links` field). If the DB suite skipped locally, reading the handler is the confirmation; CI is the real run.

- [ ] **Step 2: Implement**

In the `router.get("/classes/:id", …)` handler replace the `linkedCount` comment block and the `roster` query and the `res.json` with:

```ts
    const roster = await db
      .select({
        id: students.id,
        displayName: students.displayName,
        externalRef: students.externalRef,
        gradeId: students.gradeId,
        teacherNote: students.teacherNote,
        gender: students.gender,
        createdAt: students.createdAt,
      })
      .from(classMemberships)
      .innerJoin(students, eq(students.id, classMemberships.studentId))
      .where(and(eq(classMemberships.classGroupId, classId), isNull(students.archivedAt)))
      .orderBy(asc(students.displayName));

    // Who holds each name, not just whether anyone does. Read in one query for
    // the whole roster rather than one per row, and with the same
    // students → roster_links → users join the contacts picker uses
    // (routes/messaging.ts), so the teacher's own scoped connection can read
    // the linked accounts' names without systemDb.
    const linkRows =
      roster.length === 0
        ? []
        : await db
            .select({
              studentId: students.id,
              userId: users.id,
              relation: rosterLinks.relation,
              firstName: users.firstName,
              lastName: users.lastName,
              linkedAt: rosterLinks.createdAt,
            })
            .from(students)
            .innerJoin(rosterLinks, eq(rosterLinks.studentId, students.id))
            .innerJoin(users, eq(users.id, rosterLinks.userId))
            .where(
              and(
                eq(students.teacherId, req.user!.id),
                inArray(students.id, roster.map(s => s.id)),
              ),
            )
            .orderBy(asc(rosterLinks.createdAt));

    const linksByStudent = new Map<string, Omit<(typeof linkRows)[number], "studentId">[]>();
    for (const { studentId, ...link } of linkRows) {
      const list = linksByStudent.get(studentId) ?? [];
      list.push(link);
      linksByStudent.set(studentId, list);
    }

    res.json({
      class: withSubjectIds(group),
      students: roster.map(s => {
        const links = linksByStudent.get(s.id) ?? [];
        return { ...s, links, linked: links.length > 0 };
      }),
    });
```

(`count` stays imported — `GET /classes` still uses it.)

- [ ] **Step 3: Typecheck, build, test**

Run:
```bash
cd /home/user/Iqraa/artifacts/api-server
pnpm run typecheck && pnpm build
node --experimental-strip-types --test src/routes/__tests__/rosterEdit.db.test.ts
pnpm test
```
Expected: typecheck clean; the whole api-server suite passes (the mount-order suite needs the fresh build); the DB suite passes with a local database, otherwise skips (report that).

- [ ] **Step 4: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/api-server/src/routes/roster.ts
git diff --cached --stat
git commit -m "feat(api): class roster read says which account holds each name

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
```

---

### Task 4: Mobile pure helpers and types

**Files:**
- Create: `artifacts/mobile/services/rosterLinks.ts`, `artifacts/mobile/services/studentEdit.ts`
- Modify: `artifacts/mobile/services/roster.ts` (`RosterStudent`, `updateStudent`)
- Test: `artifacts/mobile/services/__tests__/rosterLinks.test.ts`, `artifacts/mobile/services/__tests__/studentEdit.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `rosterLinks.ts`: `type RosterLinkRelation = 'self' | 'guardian'`; `interface RosterLink { userId: string; relation: RosterLinkRelation; firstName: string; lastName: string; linkedAt: string }`; `selfLink(links: readonly RosterLink[] | undefined): RosterLink | null`; `linkDisplayName(link: Pick<RosterLink, 'firstName' | 'lastName'>): string`; `formatLinkedOn(iso: string, lang: string): string`
  - `roster.ts`: `interface StudentChanges { displayName?: string; externalRef?: string; teacherNote?: string; gender?: '' | 'male' | 'female' }`; `RosterStudent.links?: RosterLink[]`; `updateStudent(studentId: string, changes: StudentChanges): Promise<RosterStudent>`
  - `studentEdit.ts`: `interface StudentDraft { displayName: string; externalRef: string; gender: '' | 'male' | 'female'; teacherNote: string }`; `draftOf(s: RosterStudent): StudentDraft`; `studentChanges(s: RosterStudent, d: StudentDraft): StudentChanges`; `canSaveStudent(s: RosterStudent, d: StudentDraft): boolean`

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/rosterLinks.test.ts`:

```ts
/**
 * The «حساب: …» line on a roster row. The pure part: which link is shown, how
 * its name is written, and how its date is formatted.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatLinkedOn, linkDisplayName, selfLink, type RosterLink } from '../rosterLinks.ts';

const link = (relation: RosterLink['relation'], firstName: string, lastName = ''): RosterLink => ({
  userId: `${relation}-${firstName}`,
  relation,
  firstName,
  lastName,
  linkedAt: '2026-10-23T12:00:00.000Z',
});

describe('selfLink', () => {
  it('picks the student account, not a parent', () => {
    const got = selfLink([link('guardian', 'ولي أمر', 'خالد'), link('self', 'خالد', 'التيس')]);
    assert.equal(got?.relation, 'self');
  });

  it('is null when only parents are linked, or the server sent no links', () => {
    assert.equal(selfLink([link('guardian', 'ولي أمر')]), null);
    assert.equal(selfLink([]), null);
    assert.equal(selfLink(undefined), null);
  });
});

describe('linkDisplayName', () => {
  it('joins first and last name and collapses stray whitespace', () => {
    assert.equal(linkDisplayName({ firstName: 'خالد', lastName: ' التيس ' }), 'خالد التيس');
  });

  it('has no trailing space for a one-word name', () => {
    assert.equal(linkDisplayName({ firstName: 'ميمي', lastName: '' }), 'ميمي');
  });
});

describe('formatLinkedOn', () => {
  it('writes a short day and month', () => {
    assert.equal(formatLinkedOn('2026-10-23T12:00:00.000Z', 'en'), '23 Oct');
  });

  it('is empty for an unreadable date rather than "Invalid Date"', () => {
    assert.equal(formatLinkedOn('not a date', 'en'), '');
  });
});
```

Create `artifacts/mobile/services/__tests__/studentEdit.test.ts`:

```ts
/**
 * The edit sheet sends only what changed: the PATCH handler tells an absent
 * field from an empty one, so `teacherNote: ''` clears a note and omitting it
 * leaves it. Sending everything would also needlessly re-run the rename check.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canSaveStudent, draftOf, studentChanges } from '../studentEdit.ts';
import type { RosterStudent } from '../roster.ts';

const student: RosterStudent = {
  id: 's1',
  displayName: 'خالد التيس',
  externalRef: '1042',
  gradeId: 'grade-10',
  teacherNote: 'يستعجل',
  gender: 'male',
  createdAt: '2026-09-01T00:00:00.000Z',
};

describe('draftOf', () => {
  it('copies the editable fields, with empty strings for the optional ones', () => {
    assert.deepEqual(draftOf({ ...student, externalRef: null, gender: undefined }), {
      displayName: 'خالد التيس',
      externalRef: '',
      gender: '',
      teacherNote: 'يستعجل',
    });
  });
});

describe('studentChanges', () => {
  it('is empty for an untouched draft', () => {
    assert.deepEqual(studentChanges(student, draftOf(student)), {});
  });

  it('names only the fields that changed, trimmed', () => {
    const draft = { ...draftOf(student), displayName: '  خالد التيس الأحمد ', teacherNote: 'يتحسّن' };
    assert.deepEqual(studentChanges(student, draft), { displayName: 'خالد التيس الأحمد', teacherNote: 'يتحسّن' });
  });

  it('sends an empty string to clear the note or the register number', () => {
    const draft = { ...draftOf(student), externalRef: '', teacherNote: '   ' };
    assert.deepEqual(studentChanges(student, draft), { externalRef: '', teacherNote: '' });
  });

  it('treats whitespace-only edits to the note as no change when the note was empty', () => {
    const empty = { ...student, teacherNote: '' };
    assert.deepEqual(studentChanges(empty, { ...draftOf(empty), teacherNote: '  ' }), {});
  });
});

describe('canSaveStudent', () => {
  it('needs a name and at least one change', () => {
    assert.equal(canSaveStudent(student, draftOf(student)), false);
    assert.equal(canSaveStudent(student, { ...draftOf(student), gender: 'female' }), true);
    assert.equal(canSaveStudent(student, { ...draftOf(student), displayName: '   ' }), false);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/rosterLinks.test.ts services/__tests__/studentEdit.test.ts`
Expected: FAIL — cannot find `../rosterLinks.ts` / `../studentEdit.ts`.

- [ ] **Step 3: Implement the helpers and types**

Create `artifacts/mobile/services/rosterLinks.ts`:

```ts
/**
 * Who holds a roster name. The server sends, per student, the accounts linked
 * to that row (`GET /classes/:id`); these helpers pick what a row shows.
 */
export type RosterLinkRelation = 'self' | 'guardian';

export interface RosterLink {
  userId: string;
  relation: RosterLinkRelation;
  firstName: string;
  lastName: string;
  /** ISO instant the link was made. */
  linkedAt: string;
}

/** The student's own account — the one a teacher checks "is this really them". Parents are on the key screen. */
export function selfLink(links: readonly RosterLink[] | undefined): RosterLink | null {
  return links?.find(l => l.relation === 'self') ?? null;
}

export function linkDisplayName(link: Pick<RosterLink, 'firstName' | 'lastName'>): string {
  return `${link.firstName} ${link.lastName}`.replace(/\s+/g, ' ').trim();
}

/** "23 Oct" / «٢٣ أكتوبر», in Amman time like every other school date here. Empty for an unreadable value. */
export function formatLinkedOn(iso: string, lang: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Amman',
  });
}
```

Create `artifacts/mobile/services/studentEdit.ts`:

```ts
/**
 * The edit-student sheet's draft, and what it sends. Pure, so the "only what
 * changed" rule is tested without a screen.
 */
import type { RosterStudent, StudentChanges } from './roster.ts';

export interface StudentDraft {
  displayName: string;
  externalRef: string;
  gender: '' | 'male' | 'female';
  teacherNote: string;
}

export function draftOf(s: RosterStudent): StudentDraft {
  return {
    displayName: s.displayName,
    externalRef: s.externalRef ?? '',
    gender: s.gender ?? '',
    teacherNote: s.teacherNote,
  };
}

/** Only the fields that differ, trimmed the way the server trims them. An empty string is a real change (it clears). */
export function studentChanges(s: RosterStudent, d: StudentDraft): StudentChanges {
  const changes: StudentChanges = {};
  const name = d.displayName.trim();
  if (name !== s.displayName) changes.displayName = name;
  const ref = d.externalRef.trim();
  if (ref !== (s.externalRef ?? '')) changes.externalRef = ref;
  if (d.gender !== (s.gender ?? '')) changes.gender = d.gender;
  const note = d.teacherNote.trim();
  if (note !== s.teacherNote) changes.teacherNote = note;
  return changes;
}

export function canSaveStudent(s: RosterStudent, d: StudentDraft): boolean {
  return d.displayName.trim() !== '' && Object.keys(studentChanges(s, d)).length > 0;
}
```

In `artifacts/mobile/services/roster.ts`: add the import under the `StudentRecord` import

```ts
import type { RosterLink } from './rosterLinks.ts';
```

add to `RosterStudent`, after `linked?: boolean;`:

```ts
  /** Accounts linked to this name, oldest first. Absent from servers older than the field and from `/students`. */
  links?: RosterLink[];
```

and replace the `updateStudent` signature's inline type with an exported interface — add above the function's doc comment:

```ts
export interface StudentChanges {
  displayName?: string;
  externalRef?: string;
  teacherNote?: string;
  gender?: '' | 'male' | 'female';
}
```

and change the parameter to `changes: StudentChanges,`.

- [ ] **Step 4: Run the tests and typecheck**

Run:
```bash
cd /home/user/Iqraa/artifacts/mobile
node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/rosterLinks.test.ts services/__tests__/studentEdit.test.ts
pnpm run typecheck
```
Expected: 11 tests PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/rosterLinks.ts artifacts/mobile/services/studentEdit.ts artifacts/mobile/services/roster.ts artifacts/mobile/services/__tests__/rosterLinks.test.ts artifacts/mobile/services/__tests__/studentEdit.test.ts
git diff --cached --stat
git commit -m "feat(app): pure helpers for the edit-student sheet and the claimed-by line

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
```

---

### Task 5: The edit sheet, the claimed-by line, and wiring

**Files:**
- Modify: `artifacts/mobile/services/i18n.ts` (ar block near `saveNote:` ~line 2251; en block near `saveNote:` ~line 5478)
- Create: `artifacts/mobile/components/classes/EditStudentSheet.tsx`, `artifacts/mobile/components/classes/ClaimedByLine.tsx`
- Modify: `artifacts/mobile/app/classes/[id]/index.tsx`

**Interfaces:**
- Consumes: `draftOf`, `studentChanges`, `canSaveStudent`, `StudentDraft` (Task 4); `selfLink`, `linkDisplayName`, `formatLinkedOn`, `RosterLink` (Task 4); `StudentChanges`, `RosterStudent` (Task 4).
- Produces: `<EditStudentSheet student onSave(changes) onClose saving error />`, `<ClaimedByLine links />`.

- [ ] **Step 1: Add the strings (both languages)**

In the **ar** block, directly after the line `    saveNote: 'احفظ الملاحظة',` add:

```ts
    editStudent: 'تعديل بيانات الطالب',
    studentNameLabel: 'الاسم',
    studentRefLabel: 'الرقم المدرسي (اختياري)',
    studentGenderLabel: 'الجنس',
    studentGenderUnset: 'غير محدد',
    studentGenderMale: 'طالب',
    studentGenderFemale: 'طالبة',
    saveChanges: 'احفظ التعديلات',
    studentNameRequired: 'اكتب اسم الطالب.',
    studentNameTaken: 'يوجد طالب بهذا الاسم في الصف. أضف ما يميّزه، مثل اسم العائلة.',
    rosterClaimedByLabel: 'الحساب:',
```

In the **en** block, directly after the line `    saveNote: 'Save note',` add:

```ts
    editStudent: 'Edit student',
    studentNameLabel: 'Name',
    studentRefLabel: 'Register number (optional)',
    studentGenderLabel: 'Gender',
    studentGenderUnset: 'Not set',
    studentGenderMale: 'Boy',
    studentGenderFemale: 'Girl',
    saveChanges: 'Save changes',
    studentNameRequired: "Enter the student's name.",
    studentNameTaken: 'A student with this name is already in the class. Add something that tells them apart, such as a family name.',
    rosterClaimedByLabel: 'Account:',
```

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/i18n.test.ts`
Expected: PASS (same keys in both languages, none empty).

- [ ] **Step 2: Create `ClaimedByLine`**

Create `artifacts/mobile/components/classes/ClaimedByLine.tsx`:

```tsx
/**
 * «الحساب: خالد التيس · ٢٣ أكتوبر» under a roster name — which account holds
 * it and since when, so a teacher can see at a glance that the name on the
 * roster and the account behind it are the same child. Shows the student's own
 * account only; parents are listed on the code screen.
 */
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { formatLinkedOn, linkDisplayName, selfLink, type RosterLink } from '@/services/rosterLinks';

export function ClaimedByLine({ links }: { links: readonly RosterLink[] | undefined }) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const own = selfLink(links);
  if (!own) return null;
  const when = formatLinkedOn(own.linkedAt, lang);
  return (
    <Text
      numberOfLines={1}
      style={[
        styles.line,
        { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: isRTL ? 'right' : 'left' },
      ]}
    >
      {t('rosterClaimedByLabel')} {linkDisplayName(own)}
      {when ? ` · ${when}` : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: { fontSize: 13, lineHeight: 21, marginTop: 2 },
});
```

- [ ] **Step 3: Create `EditStudentSheet`**

Create `artifacts/mobile/components/classes/EditStudentSheet.tsx`:

```tsx
/**
 * Edit one student: name, register number, gender, the teacher's note.
 *
 * Mounted only while a student is being edited (`key` on the student id), so
 * its draft is initialised from props once and never needs an effect to reset.
 * It reports only what changed (services/studentEdit.ts) and leaves the save,
 * the cache update and the error text to the screen that owns the roster.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardSafeView } from '@/components/ui/KeyboardSafeView';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import type { RosterStudent, StudentChanges } from '@/services/roster';
import { canSaveStudent, draftOf, studentChanges, type StudentDraft } from '@/services/studentEdit';

interface Props {
  student: RosterStudent;
  saving: boolean;
  error: string;
  onSave: (changes: StudentChanges) => void;
  onClose: () => void;
}

const GENDERS = [
  { value: '', labelKey: 'studentGenderUnset' },
  { value: 'male', labelKey: 'studentGenderMale' },
  { value: 'female', labelKey: 'studentGenderFemale' },
] as const;

export function EditStudentSheet({ student, saving, error, onSave, onClose }: Props) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const [draft, setDraft] = useState<StudentDraft>(() => draftOf(student));
  const set = <K extends keyof StudentDraft>(key: K, value: StudentDraft[K]) =>
    setDraft(prev => ({ ...prev, [key]: value }));

  const nameMissing = draft.displayName.trim() === '';
  const canSave = canSaveStudent(student, draft) && !saving;

  const inputStyle = [
    styles.input,
    { color: colors.foreground, borderColor: colors.border, fontFamily: 'Almarai_400Regular', textAlign: align },
  ] as const;
  const labelStyle = [
    styles.label,
    { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align },
  ] as const;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardSafeView>
        <View style={styles.backdrop}>
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
              {t('editStudent')}
            </Text>

            <Text style={labelStyle}>{t('studentNameLabel')}</Text>
            <TextInput
              value={draft.displayName}
              onChangeText={v => set('displayName', v)}
              autoFocus
              style={inputStyle}
              accessibilityLabel={t('studentNameLabel')}
            />
            {nameMissing ? (
              <Text style={[styles.hint, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {t('studentNameRequired')}
              </Text>
            ) : null}

            <Text style={labelStyle}>{t('studentRefLabel')}</Text>
            <TextInput
              value={draft.externalRef}
              onChangeText={v => set('externalRef', v)}
              style={inputStyle}
              accessibilityLabel={t('studentRefLabel')}
            />

            <Text style={labelStyle}>{t('studentGenderLabel')}</Text>
            <View style={styles.genderRow}>
              {GENDERS.map(g => {
                const on = draft.gender === g.value;
                return (
                  <Pressable
                    key={g.value}
                    onPress={() => set('gender', g.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={[
                      styles.genderBtn,
                      { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : 'transparent' },
                    ]}
                  >
                    <Text
                      style={{
                        color: on ? colors.primaryForeground : colors.foreground,
                        fontFamily: 'ReadexPro_500Medium',
                        fontSize: 14,
                      }}
                    >
                      {t(g.labelKey)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={labelStyle}>{t('studentRecordNote')}</Text>
            <TextInput
              value={draft.teacherNote}
              onChangeText={v => set('teacherNote', v)}
              placeholder={t('studentNotePlaceholder')}
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[...inputStyle, styles.note]}
              accessibilityLabel={t('studentRecordNote')}
            />

            {error ? (
              <Text style={[styles.hint, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable onPress={onClose} style={styles.btn}>
                <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold' }}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={() => onSave(studentChanges(student, draft))}
                disabled={!canSave}
                accessibilityRole="button"
                style={[styles.btn, styles.primary, { backgroundColor: colors.primary, opacity: canSave ? 1 : 0.5 }]}
              >
                {saving ? (
                  <ActivityIndicator color={colors.primaryForeground} size="small" />
                ) : (
                  <Text style={{ color: colors.primaryForeground, fontFamily: 'ReadexPro_600SemiBold' }}>
                    {t('saveChanges')}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 460, borderRadius: 16, padding: 20, gap: 8 },
  title: { fontSize: 18, marginBottom: 4 },
  label: { fontSize: 13, marginTop: 6 },
  hint: { fontSize: 14, lineHeight: 22 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  note: { minHeight: 90, textAlignVertical: 'top' },
  genderRow: { flexDirection: 'row', gap: 8 },
  genderBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  primary: { minWidth: 120, alignItems: 'center' },
});
```

- [ ] **Step 4: Wire it into the class screen**

All edits in `artifacts/mobile/app/classes/[id]/index.tsx`, with the Edit tool:

1. Imports — after `import { MathPracticeSheet } from '@/components/classes/MathPracticeSheet';` add:
```tsx
import { EditStudentSheet } from '@/components/classes/EditStudentSheet';
import { ClaimedByLine } from '@/components/classes/ClaimedByLine';
```
and in the `@/services/roster` import list add `type StudentChanges,` after `type RosterStudent,`.

2. State — replace
```tsx
  const [noteStudent, setNoteStudent] = useState<RosterStudent | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
```
with
```tsx
  const [editStudent, setEditStudent] = useState<RosterStudent | null>(null);
  const [savingStudent, setSavingStudent] = useState(false);
```

3. `describe` — after `if (err.isStorageUnavailable) return t('rosterStorageUnavailable');` add:
```tsx
        if (err.code === 'student_name_taken') return t('studentNameTaken');
```

4. Handlers — replace `openNote` and `onSaveNote` (the whole `const openNote = …` and `const onSaveNote = async () => {…};` blocks) with:
```tsx
  const openEdit = (student: RosterStudent) => {
    setError('');
    setEditStudent(student);
  };

  const closeEdit = () => {
    setEditStudent(null);
    setError('');
  };

  const onSaveStudent = async (changes: StudentChanges) => {
    if (!editStudent || savingStudent) return;
    if (Object.keys(changes).length === 0) {
      closeEdit();
      return;
    }
    setSavingStudent(true);
    setError('');
    try {
      const updated = await updateStudent(editStudent.id, changes);
      // Take the server's row rather than the draft: it trimmed the values, and
      // showing something the database does not hold is how an edit that looks
      // saved turns out not to be. The server's PATCH row carries no `links`,
      // so keep the ones the list already has.
      queryClient.setQueryData<ClassQueryData>(CLASS_QUERY_KEY(id), prev =>
        prev
          ? {
              ...prev,
              students: prev.students.map(s =>
                s.id === updated.id ? { ...s, ...updated, links: s.links, linked: s.linked } : s,
              ),
            }
          : prev,
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditStudent(null);
    } catch (err) {
      setError(describe(err));
    } finally {
      setSavingStudent(false);
    }
  };
```

5. Row — change `onPress={() => openNote(item)}` to `onPress={() => openEdit(item)}` and `accessibilityLabel={t('studentRecordNote')}` on that Pressable to `accessibilityLabel={t('editStudent')}`. After the closing of the `{item.teacherNote ? (…) : item.externalRef ? (…) : null}` block (just before the `</View>` that closes the name column), add:
```tsx
                <ClaimedByLine links={item.links} />
```

6. Modal — replace the whole `<Modal visible={noteStudent !== null} …> … </Modal>` block (from `<Modal` with `visible={noteStudent !== null}` through its closing `</Modal>`) with:
```tsx
      {editStudent ? (
        <EditStudentSheet
          key={editStudent.id}
          student={editStudent}
          saving={savingStudent}
          error={error}
          onSave={changes => { void onSaveStudent(changes); }}
          onClose={closeEdit}
        />
      ) : null}
```

7. Confirm nothing still references the removed names:

Run: `cd /home/user/Iqraa/artifacts/mobile && grep -n "noteStudent\|noteText\|savingNote\|openNote\|onSaveNote\|setNoteStudent" "app/classes/[id]/index.tsx"`
Expected: no output.

- [ ] **Step 5: Typecheck and run the mobile suite**

Run:
```bash
cd /home/user/Iqraa/artifacts/mobile
pnpm run typecheck
pnpm test
```
Expected: typecheck clean; the suite passes. It prints nothing until it finishes (minutes) — that is not a hang. `i18nTerminology.test.ts` and `iconSystem.test.ts` run in it: if either flags the new copy or `Ionicons` usage, fix the copy, not the test.

- [ ] **Step 6: Check it in a browser if the app can run here**

Needs a throwaway local Postgres and a teacher account (see `LOCAL_SETUP.md`). If a database is available: start `pnpm run dev:api` and `pnpm run dev:mobile:web` with `AI_LIVE_MODE=false`, register a teacher, make a class, add a student, tap the pencil, rename it, and confirm the new name shows, a duplicate name shows the Arabic message, and the modal closes on save. If no database is available, say plainly in the final report that the screen was not exercised in a browser.

- [ ] **Step 7: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/i18n.ts artifacts/mobile/components/classes/EditStudentSheet.tsx artifacts/mobile/components/classes/ClaimedByLine.tsx "artifacts/mobile/app/classes/[id]/index.tsx"
git diff --cached --stat
git commit -m "feat(app): edit a student's name, register number, gender and note; show the claiming account

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
```

---

### Task 6: Verify as CI does, write it up, ship

**Files:**
- Modify: `docs/status-log.md` (new entry directly under the header, above the newest `## ` section)

- [ ] **Step 1: Run what CI runs for the touched packages**

Run:
```bash
cd /home/user/Iqraa
pnpm run typecheck
cd artifacts/api-server && pnpm build && pnpm test
cd ../mobile && pnpm test
```
Expected: all green. Record any suite that skipped (DB-backed) rather than passed.

- [ ] **Step 2: Add the status-log entry**

At the top of `docs/status-log.md`, directly under the "Adding an entry" paragraph and above the newest `## ` section, add (adjust the wording to what was actually verified in Steps 1 and Task 5 Step 6):

```markdown
## Roster: edit a student, and see which account holds each name — 2026-10-23

The pencil on a roster row used to open only the note; a teacher could not fix a misspelt name
(`PATCH /students/:id` and `updateStudent` already took `displayName`, no screen sent it). It now
opens one sheet: name, register number, gender, note (`EditStudentSheet`), sending only what changed
(`studentEdit.ts`). Each joined row also shows «الحساب: <name> · <date>» (`ClaimedByLine`), from a new
`links` array on `GET /classes/:id` (the old `linked` flag stays).

**Rules.** A rename that matches another live student in any of that student's classes is a 409
`student_name_taken` (same whitespace/case key as the add route, no Arabic folding; other classes
and other teachers may reuse the name). After a rename, linked code-only accounts (no email,
password or Google id) are re-derived from the new roster name — only if they still carry what the
old name would have produced, so a name a person chose is never overwritten. That write uses
`systemDb` (`routes/roster.ts` was already pinned) in a second step after the roster update, not
the same transaction; a failure is logged by id and the saved rename stands.

**Verified:** <list what ran: unit tests, typecheck, api-server and mobile suites>. **Not verified:**
<state plainly whether the DB-backed suite (`rosterEdit.db.test.ts`) and a browser pass ran here or only in CI>.

**Not built (PR 2, next):** teacher approval of class-code joins — design in
`docs/superpowers/specs/2026-10-23-roster-edit-and-claim-approval-design.md`. Until then a class code
still lets anyone pick any free name; the claimed-by line and unlink are the check.
```

Replace the two `<…>` placeholders with the real results before committing — an entry with angle brackets in it is not done.

- [ ] **Step 3: Commit and push**

```bash
cd /home/user/Iqraa
git add docs/status-log.md
git commit -m "docs: status-log entry for editing students

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
git push -u origin claude/happy-bohr-khh1n2
```

- [ ] **Step 4: Update the open draft PR**

Retitle [#1225](https://github.com/NizarAbuahmad/Iqraa/pull/1225) to «Edit students: rename, claimed-by line (PR 1 of 2)» and replace its body with what changed, what was and was not verified (DB suite / browser), and that PR 2 (teacher-approved claims, a schema change) follows as its own draft PR once this merges — at which point the branch restarts from `main` (`git fetch origin main && git checkout -B claude/happy-bohr-khh1n2 origin/main`). Keep it a draft until the DB-backed CI job is green. Then watch CI per the PR-activity rules.

---

## Self-Review (done)

- **Spec coverage (PR 1):** edit sheet with name/register/gender/note → Task 5; duplicate-name 409 → Task 2; rename sync only while the name is untouched → Tasks 1–2; claimed-by line from `links` with `linked` kept → Tasks 3–5; "no schema change" holds (no migration anywhere). PR 2 items are explicitly out of this plan.
- **Spec deviation recorded:** the sync is not in one transaction with the student update (two connections); Task 2 Step 6 edits the spec to say so.
- **Placeholders:** the only angle-bracket text is the status-log entry's two verification fields, which Step 2 says to fill before committing.
- **Type consistency:** `StudentChanges` (Task 4) is what `studentChanges`, `EditStudentSheet.onSave` and `onSaveStudent` use; `RosterLink` fields match the Task 3 response (`userId, relation, firstName, lastName, linkedAt`); `nameKey/nameTakenBy/renamedAccountNames` signatures match between Tasks 1 and 2.
