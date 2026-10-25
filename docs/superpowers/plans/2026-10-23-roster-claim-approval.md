# Roster: teacher-approved class-code claims (PR 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student who joins by picking their name off a *class* code is held as a pending request until the teacher approves it; until then the account has no access to anything.

**Architecture:** Pending claims live in a new table `roster_link_requests`; `roster_links` and its ~120 readers are untouched, so an unapproved account fails closed (it has no link). The claim write path in `routes/auth.ts` (`linkRosterRowInTx`, shared by `/claim` and `/redeem`) writes a request instead of a link when `claimNeedsApproval(resolved)`; the teacher approves or rejects through three routes in `routes/roster.ts`; the app shows the applicant a waiting card and the teacher a banner.

**Tech Stack:** Express + Drizzle + Postgres RLS (api-server, lib/db), Node `--test`, Expo / React Native Web (mobile), pnpm monorepo.

**Spec:** `docs/superpowers/specs/2026-10-23-roster-edit-and-claim-approval-design.md` (section "PR 2"). Builds on PR 1 ([#1225](https://github.com/NizarAbuahmad/Iqraa/pull/1225), `docs/superpowers/plans/2026-10-23-roster-edit-student.md`), which must be merged first: Tasks 4 and 7 edit `routes/roster.ts` and the class screen as PR 1 left them.

## Global Constraints

- **Draft PR.** This adds a table and changes who can join a class; it goes up as a draft and stays one until a human marks it ready.
- **Start from merged `main`:** `git fetch origin main && git checkout -B claude/happy-bohr-khh1n2 origin/main` (PR 1 must already be merged; the branch name is unchanged).
- **Migrations only, never `push`, never hand-run DDL.** Edit `lib/db/src/schema`, run `pnpm --filter @workspace/db run generate`, commit `lib/db/migrations/`. The migration here is additive (no `DROP`/`RENAME`/`SET NOT NULL`), so no `destructive-migration: ok` is needed.
- **A new table gets no grant to `iqraa_app` automatically** and must be classified in `lib/db/src/__tests__/rlsCoverage.test.ts`. This table is `PROTECTED`: RLS on, policies, all four grants.
- **No new `systemDb` use.** `routes/auth.ts` already runs on the owner connection (`systemDb as db`); `routes/roster.ts` uses the teacher's scoped `db`, which the RLS policies below cover. Do not edit `systemDbFiles.test.ts`.
- Never `sed -i` / `perl -pi` on source (Arabic and `${…}`); use the Edit tool. A `git diff --stat` line reading `Bin N -> M bytes` for a text file means corruption.
- Never log a child's name or an account's name; log ids only, and never pass a raw error object to the logger (drizzle's error message carries query parameters).
- Every new string goes in **both** `ar` and `en` of `artifacts/mobile/services/i18n.ts` (`i18n.test.ts` fails on a missing key). A key that takes arguments is a function in both languages. Latin product name is **Iqrra**; Arabic brand **«إقرأ»**; neither is needed here.
- Text on a `colors.primary` fill is `colors.primaryForeground`, never `'#fff'`. A `<Modal>` with a text input wraps its body in `<KeyboardSafeView>`. Icon sizes come from the `ICON` scale (14/16/20/24). Corner/new components take colours from `useColors()`, never `palette`.
- Mobile services loaded by `node --test` import nothing that needs React Native and use explicit `.ts` relative imports; mobile tests live in `services/__tests__/`.
- DB-backed tests (`*.db.test.ts`, `rls*.test.ts`) **skip locally** without Postgres; CI runs them with `REQUIRE_DB_TESTS=true`. Never claim one passed unless you saw it run. Run `pnpm build` in `artifacts/api-server` before its tests.
- Commits end with the two attribution trailer lines from the session; `git add` named paths only, never `-A`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/db/src/schema/messaging.ts` (modify) | `rosterLinkRequests` table |
| `lib/db/migrations/0016_*.sql`, `meta/*` (generated + hand-appended RLS) | table + RLS policies + grants |
| `lib/db/src/__tests__/rlsCoverage.test.ts`, `rlsMatrix.test.ts`, `lib/db/src/testing/rlsHarness.ts` (modify) | classify + prove the policies |
| `artifacts/api-server/src/lib/claimDecision.ts` (modify) | pure: `claimNeedsApproval`, `pendingLimitReached`, `MAX_PENDING_CLAIMS_PER_STUDENT` |
| `artifacts/api-server/src/lib/__tests__/claimApproval.test.ts` (new) | unit tests for those |
| `artifacts/api-server/src/routes/auth.ts` (modify) | pending branch in `linkRosterRowInTx`; `/claim`, `/redeem`, `GET`/`DELETE /claim` |
| `artifacts/api-server/src/routes/__tests__/claimApproval.db.test.ts` (new) | HTTP + DB tests for the applicant side |
| `artifacts/api-server/src/routes/roster.ts` (modify) | list / approve / reject for the teacher |
| `artifacts/api-server/src/routes/__tests__/linkRequests.db.test.ts` (new) | HTTP + DB tests for the teacher side |
| `artifacts/mobile/services/claimResult.ts`, `claimWaiting.ts` (new) + tests | pure parsing / screen-state helpers |
| `artifacts/mobile/services/roster.ts`, `claimCodeGate.ts`, `i18n.ts` (modify) | client functions, error key, strings |
| `artifacts/mobile/components/ClaimWaitingCard.tsx` (new) | the applicant's waiting card |
| `artifacts/mobile/app/claim-required.tsx`, `app/join-class.tsx` (modify) | show waiting / pending |
| `artifacts/mobile/components/classes/LinkRequestsBanner.tsx` (new), `app/classes/[id]/index.tsx` (modify) | the teacher's banner |
| `docs/status-log.md`, `CLAUDE.md`, `docs/superpowers/specs/...-design.md` (modify) | write-up, a "bitten before" note, spec reconciliation |

---

### Task 1: The table, its migration and its row-level security

**Files:**
- Modify: `lib/db/src/schema/messaging.ts` (after the `rosterLinks` table, ~line 53)
- Create (generated): `lib/db/migrations/0016_<random>.sql`, `lib/db/migrations/meta/0016_snapshot.json`; modify `lib/db/migrations/meta/_journal.json` (generator does this)
- Modify: `lib/db/src/__tests__/rlsCoverage.test.ts` (`PROTECTED` list), `lib/db/src/testing/rlsHarness.ts` (seed), `lib/db/src/__tests__/rlsMatrix.test.ts` (new tests)

**Interfaces:**
- Produces: Drizzle table `rosterLinkRequests` exported from `@workspace/db` with columns `id, studentId, userId, relation, createdAt`; unique `(studentId, userId)`. RLS: a row is readable and deletable by its sender (`user_id = app_uid()`) and by the student's teacher (`app_teaches_student(student_id)`); the app role has **no insert/update policy** (inserts come only from `routes/auth.ts` on the owner connection).

- [ ] **Step 1: Write the failing tests**

In `lib/db/src/__tests__/rlsCoverage.test.ts`, add `"roster_link_requests"` to the `PROTECTED` array (e.g. after `"roster_links"`).

In `lib/db/src/testing/rlsHarness.ts`, after the `roster_links` insert (the line ending `[ids.studentA, ids.parentA, ids.studentUser]);`) add:

```ts
  // A student account waiting for studentA's teacher to approve its claim.
  await q(`INSERT INTO roster_link_requests (student_id, user_id, relation) VALUES ($1,$2,'self')`,
    [ids.studentA, ids.studentUser2]);
```

At the end of the `describe` in `lib/db/src/__tests__/rlsMatrix.test.ts` (before its closing `});`), add:

```ts
  test("a pending claim is visible to the student's teacher and to its sender, and to nobody else", async () => {
    await as("teacherA", "teacher", async () => {
      assert.equal((await col(`SELECT id FROM roster_link_requests WHERE student_id = $1`, [ids.studentA])).length, 1);
    });
    await as("studentUser2", "student", async () => {
      assert.equal((await col(`SELECT id FROM roster_link_requests WHERE student_id = $1`, [ids.studentA])).length, 1);
    });
    for (const [key, role] of [["teacherB", "teacher"], ["parentA", "parent"], ["studentUser", "student"]] as const) {
      await as(key, role, async () => {
        assert.deepEqual(await col(`SELECT id FROM roster_link_requests WHERE student_id = $1`, [ids.studentA]), []);
      });
    }
  });

  test("the app role can never create a pending claim — only the owner connection does", () =>
    as("teacherA", "teacher", async () => {
      await assert.rejects(
        scoped.query(`INSERT INTO roster_link_requests (student_id, user_id, relation) VALUES ($1,$2,'self')`, [ids.studentA, ids.studentUser]),
        /row-level security/,
      );
    }));

  test("only the student's teacher or the sender may delete a pending claim", async () => {
    await as("teacherB", "teacher", async () => {
      assert.equal((await scoped.query(`DELETE FROM roster_link_requests WHERE student_id = $1`, [ids.studentA])).rowCount, 0);
    });
    await as("parentA", "parent", async () => {
      assert.equal((await scoped.query(`DELETE FROM roster_link_requests WHERE student_id = $1`, [ids.studentA])).rowCount, 0);
    });
    await as("teacherA", "teacher", async () => {
      assert.equal((await scoped.query(`DELETE FROM roster_link_requests WHERE student_id = $1`, [ids.studentA])).rowCount, 1);
    });
  });
```

- [ ] **Step 2: Run them to see them fail (or skip)**

Run: `cd lib/db && node --experimental-strip-types --test --test-concurrency=1 src/__tests__/rlsCoverage.test.ts src/__tests__/rlsMatrix.test.ts`
Expected without `RLS_TEST_DATABASE_URL`: both suites **skip** ("RLS_TEST_DATABASE_URL not set") — say so in your report; CI's `row-level security` job is the real run. With a local migrated Postgres: FAIL (`relation "roster_link_requests" does not exist`).

- [ ] **Step 3: Add the table to the schema**

In `lib/db/src/schema/messaging.ts`, directly after the `rosterLinks` table definition, add (all of `pgTable, text, timestamp, uuid, index, unique` and `RosterLinkRelation`, `users`, `students` are already imported/defined in this file):

```ts
/**
 * A student's claim on a roster name that is waiting for the teacher's yes.
 *
 * Kept apart from `roster_links` on purpose. A link means "this account may
 * see and act as this child", and about 120 places read it that way (chat
 * contacts, homework, exams, parent letters). A `status` column on that table
 * would make every one of them filter it correctly, forever; a row here is
 * invisible to all of them, so an unapproved account has no access by
 * construction. Approval is one insert into `roster_links` plus deleting the
 * requests (routes/roster.ts); a claim made with a per-student code, or by a
 * parent, never comes here (lib/claimDecision.ts `claimNeedsApproval`).
 *
 * Several accounts may wait on the same name — a classmate squatting it must
 * not lock the real child out — up to MAX_PENDING_CLAIMS_PER_STUDENT.
 */
export const rosterLinkRequests = pgTable(
  "roster_link_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    relation: text("relation").$type<RosterLinkRelation>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    unique("roster_link_requests_unique").on(t.studentId, t.userId),
    index("roster_link_requests_student_idx").on(t.studentId),
    index("roster_link_requests_user_idx").on(t.userId),
  ],
);
```

- [ ] **Step 4: Generate the migration and append the RLS**

Run: `cd /home/user/Iqraa && pnpm --filter @workspace/db run generate`
Expected: a new `lib/db/migrations/0016_<name>.sql` containing a single `CREATE TABLE "roster_link_requests"` (+ FKs, unique, two indexes), a new snapshot and a journal entry. Open the generated `.sql` file and **append** (keeping the `--> statement-breakpoint` separators; the file's last generated statement ends with `;` — put the marker after it):

```sql
--> statement-breakpoint
ALTER TABLE "roster_link_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "roster_link_requests" TO iqraa_app;--> statement-breakpoint
-- Readable and deletable by the account that asked and by the student's teacher. No INSERT or
-- UPDATE policy: under a user's identity nobody may create a request (a claim is made on the
-- owner connection, routes/auth.ts), which is the same rule roster_links_insert states.
CREATE POLICY "roster_link_requests_select" ON "roster_link_requests" FOR SELECT TO iqraa_app
  USING (user_id = app_uid() OR app_teaches_student(student_id));--> statement-breakpoint
CREATE POLICY "roster_link_requests_delete" ON "roster_link_requests" FOR DELETE TO iqraa_app
  USING (user_id = app_uid() OR app_teaches_student(student_id));
```

Verify: `git diff --stat` shows no `Bin` marker; the generated statements are untouched; the migration contains no `DROP`, `RENAME` or `SET NOT NULL`.

- [ ] **Step 5: Verify what can be verified locally**

Run:
```bash
cd /home/user/Iqraa && pnpm run typecheck
pnpm --filter @workspace/db run generate   # run it AGAIN: it must report "No schema changes" and create nothing
git status --short lib/db
cd lib/db && pnpm test
```
Expected: typecheck clean; the second `generate` creates no new files (this is what CI's "migrations match schema" checks); `pnpm test` passes or skips the RLS suites (say which). Applying the migration to an empty Postgres and running the two RLS suites is CI's job (`row-level security` + `migrations match schema`); if a local Postgres exists, do it and report the output.

- [ ] **Step 6: Commit**

```bash
git add lib/db/src/schema/messaging.ts lib/db/migrations lib/db/src/__tests__/rlsCoverage.test.ts lib/db/src/__tests__/rlsMatrix.test.ts lib/db/src/testing/rlsHarness.ts
git diff --cached --stat
git commit -m "feat(db): roster_link_requests — class-code claims waiting for the teacher

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
```

---

### Task 2: Pure rules — what is held, and how many may wait

**Files:**
- Modify: `artifacts/api-server/src/lib/claimDecision.ts` (append)
- Test: `artifacts/api-server/src/lib/__tests__/claimApproval.test.ts` (new)

**Interfaces:**
- Consumes: `ClaimResolution` (already exported from `claimDecision.ts`).
- Produces:
  - `claimNeedsApproval(resolved: Extract<ClaimResolution, { ok: true }>): boolean`
  - `MAX_PENDING_CLAIMS_PER_STUDENT: 5`
  - `pendingLimitReached(othersPending: number): boolean`

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/lib/__tests__/claimApproval.test.ts`:

```ts
/**
 * What this guards: which claims wait for the teacher. Only a STUDENT who
 * picked a name off a CLASS code is held — that is the one path where nothing
 * but a shared string proves who is asking. A per-student code was handed to
 * that child by the teacher, and a parent can only use the per-student code
 * (redeemRoleCheck), so neither is held; holding them would make the teacher
 * approve people they already chose.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_PENDING_CLAIMS_PER_STUDENT,
  claimNeedsApproval,
  pendingLimitReached,
} from "../claimDecision.ts";

const ok = (relation: "self" | "guardian", viaClassCode: boolean) =>
  ({ ok: true as const, studentId: "s", relation, viaClassCode });

describe("claimNeedsApproval", () => {
  it("holds a student's pick off a class code", () => {
    assert.equal(claimNeedsApproval(ok("self", true)), true);
  });

  it("does not hold a student who has the code the teacher wrote for them", () => {
    assert.equal(claimNeedsApproval(ok("self", false)), false);
  });

  it("never holds a parent, whichever code was used", () => {
    assert.equal(claimNeedsApproval(ok("guardian", true)), false);
    assert.equal(claimNeedsApproval(ok("guardian", false)), false);
  });
});

describe("pendingLimitReached", () => {
  it("allows requests up to the cap and refuses the next one", () => {
    assert.equal(MAX_PENDING_CLAIMS_PER_STUDENT, 5);
    assert.equal(pendingLimitReached(0), false);
    assert.equal(pendingLimitReached(4), false);
    assert.equal(pendingLimitReached(5), true);
    assert.equal(pendingLimitReached(9), true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/claimApproval.test.ts`
Expected: FAIL — `claimNeedsApproval` is not exported.

- [ ] **Step 3: Implement**

Append to `artifacts/api-server/src/lib/claimDecision.ts`:

```ts
/**
 * Whether a resolved claim waits for the teacher instead of linking at once.
 *
 * Only a student who picked a name off a CLASS code: it is one string shared with
 * a whole room, so nothing proves the person holding it is the child whose name
 * they tapped, and a classmate could take another child's name. A per-student
 * code was given to that child by the teacher, and a parent can only ever use
 * the per-student code (lib/redeemPolicy.ts), so neither is held.
 */
export function claimNeedsApproval(resolved: Extract<ClaimResolution, { ok: true }>): boolean {
  return resolved.relation === "self" && resolved.viaClassCode;
}

/**
 * How many accounts may wait on one name. Several are allowed on purpose — one
 * squatter must not lock the real child out — but not without limit, or a
 * teacher's list becomes a place to spam.
 */
export const MAX_PENDING_CLAIMS_PER_STUDENT = 5;

/** `othersPending` counts the other accounts already waiting on this name, not the caller. */
export function pendingLimitReached(othersPending: number): boolean {
  return othersPending >= MAX_PENDING_CLAIMS_PER_STUDENT;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/claimApproval.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/claimDecision.ts artifacts/api-server/src/lib/__tests__/claimApproval.test.ts
git diff --cached --stat
git commit -m "feat(api): rule for which claims wait for the teacher

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
```

---

### Task 3: The claim write path — hold instead of link

**Files:**
- Modify: `artifacts/api-server/src/routes/auth.ts` (imports ~lines 10-21 and the `.ts` imports; `ClaimWriteOutcome`/`CLAIM_REFUSALS` ~338-351; `linkRosterRowInTx` ~365-424; `POST /claim` ~1022-1061; `GET /claim` ~1074-1100; `DELETE /claim` ~1109-1123; `RedeemRefused` ~1301; `POST /redeem` ~1394-1448)
- Test: `artifacts/api-server/src/routes/__tests__/claimApproval.db.test.ts` (new)

**Interfaces:**
- Consumes: `claimNeedsApproval`, `pendingLimitReached` (Task 2); `rosterLinkRequests` (Task 1).
- Produces (HTTP):
  - `POST /auth/claim`: **201** `{ studentId, relation }` when linked (unchanged); **202** `{ pending: true, studentId, studentName }` when held; **409** `{ error, code: "claim_pending_limit" }` when 5 others already wait.
  - `POST /auth/redeem`: when held, **201** with tokens and `loginCode` as today, `user.hasRosterLink === false`, plus `pending: true, studentName`.
  - `GET /auth/claim`: `{ links, pending: { studentId, displayName }[] }`.
  - `DELETE /auth/claim`: also deletes this account's pending requests.

- [ ] **Step 1: Write the failing DB test**

Create `artifacts/api-server/src/routes/__tests__/claimApproval.db.test.ts`:

```ts
/**
 * A student who picks a name off the CLASS code waits for the teacher; every
 * other way of claiming is unchanged. Real database, real HTTP.
 *
 * Fixture (seedFamilyWorld): class c1 (teacher t1) holds Sara (sA1, already has a
 * student account) and Adam (aA, a guardian but no student account). Extra
 * unclaimed roster rows are made here, so each test names the row it uses.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

// 6 characters from the share-code alphabet (no I, L, O, 0, 1).
const CLASS_CODE = "HJKMNP";
const STUDENT_CODE = "QRSTUV";

describeDb("class-code claims wait for the teacher, over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let fresh = "";   // unclaimed row with its own per-student code
  let capRow = "";  // unclaimed row that already has the maximum waiting
  let redeemRow = ""; // unclaimed row used by the code-only signup

  const q = async (sql: string, params: unknown[] = []) => (await db.pool.query(sql, params)).rows;
  const newStudentUser = async (first: string) =>
    (await q(`INSERT INTO users (first_name, last_name, role) VALUES ($1, 'T', 'student') RETURNING id`, [first]))[0].id as string;
  const newRow = async (name: string) => {
    const id = (await q(`INSERT INTO students (teacher_id, display_name) VALUES ($1, $2) RETURNING id`, [w.users.t1, name]))[0].id as string;
    await q(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, id]);
    return id;
  };
  const requests = (studentId: string) =>
    q(`SELECT user_id FROM roster_link_requests WHERE student_id = $1 ORDER BY created_at`, [studentId]);
  const selfLinks = (studentId: string) =>
    q(`SELECT user_id FROM roster_links WHERE student_id = $1 AND relation = 'self'`, [studentId]);

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await q(
      `UPDATE class_groups SET join_code = $1, join_code_expires_at = now() + interval '30 days' WHERE id = $2`,
      [CLASS_CODE, w.classes.c1],
    );
    fresh = await newRow("ليان");
    await q(`UPDATE students SET claim_code = $1, claim_code_expires_at = now() + interval '30 days' WHERE id = $2`, [STUDENT_CODE, fresh]);
    capRow = await newRow("رنا");
    for (let i = 0; i < 5; i++) {
      await q(`INSERT INTO roster_link_requests (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [capRow, await newStudentUser(`cap${i}`)]);
    }
    redeemRow = await newRow("هديل");
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  describe("an existing student account picking a name off the class list", () => {
    it("is held: 202, a request, no link", async () => {
      // An earlier pick on a different name — choosing again must replace it.
      await q(`INSERT INTO roster_link_requests (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [w.students.sA2, w.users.studentUnlinked]);

      const res = await call(on, "POST", "/auth/claim", w.users.studentUnlinked, { claimCode: CLASS_CODE, studentId: w.students.aA });
      assert.equal(res.status, 202, on.logs().slice(-1500));
      assert.deepEqual(res.json, { pending: true, studentId: w.students.aA, studentName: "آدم" });
      assert.deepEqual((await requests(w.students.aA)).map(r => r.user_id), [w.users.studentUnlinked]);
      assert.deepEqual(await selfLinks(w.students.aA), []);
      assert.deepEqual(await requests(w.students.sA2), [], "the earlier pick is replaced, not kept");
    });

    it("has no access while it waits", async () => {
      const me = await call(on, "GET", "/auth/me", w.users.studentUnlinked);
      assert.equal(me.status, 200);
      assert.equal(me.json.user?.hasRosterLink ?? me.json.hasRosterLink, false);
      const contacts = await call(on, "GET", "/messaging/contacts", w.users.studentUnlinked);
      assert.equal(contacts.status, 200);
      assert.equal(JSON.stringify(contacts.json).includes("Omar"), false, "the teacher must not be reachable");
    });

    it("lists the waiting claim next to its links", async () => {
      const res = await call(on, "GET", "/auth/claim", w.users.studentUnlinked);
      assert.equal(res.status, 200);
      assert.deepEqual(res.json.links, []);
      assert.deepEqual(res.json.pending, [{ studentId: w.students.aA, displayName: "آدم" }]);
    });

    it("asking twice is the same request, not a second one", async () => {
      const again = await call(on, "POST", "/auth/claim", w.users.studentUnlinked, { claimCode: CLASS_CODE, studentId: w.students.aA });
      assert.equal(again.status, 202);
      assert.equal((await requests(w.students.aA)).length, 1);
    });

    it("is refused when five others already wait on that name, and keeps its own earlier request", async () => {
      const res = await call(on, "POST", "/auth/claim", w.users.studentUnlinked, { claimCode: CLASS_CODE, studentId: capRow });
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "claim_pending_limit");
      assert.equal((await requests(capRow)).length, 5);
      assert.equal((await requests(w.students.aA)).length, 1, "a refused pick must not cost the account its earlier request");
    });

    it("is still refused a name that already has a student account", async () => {
      const res = await call(on, "POST", "/auth/claim", w.users.studentUnlinked, { claimCode: CLASS_CODE, studentId: w.students.sA1 });
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "claim_already_linked");
    });

    it("can withdraw: DELETE /auth/claim removes the waiting request", async () => {
      const res = await call(on, "DELETE", "/auth/claim", w.users.studentUnlinked);
      assert.equal(res.status, 200);
      assert.deepEqual(await requests(w.students.aA), []);
    });
  });

  describe("the claims that are NOT held", () => {
    it("a student with the code the teacher wrote for them links at once", async () => {
      const id = await newStudentUser("perStudent");
      const res = await call(on, "POST", "/auth/claim", id, { claimCode: STUDENT_CODE });
      assert.equal(res.status, 201, on.logs().slice(-1500));
      assert.deepEqual(res.json, { studentId: fresh, relation: "self" });
      assert.equal((await selfLinks(fresh)).length, 1);
      assert.deepEqual(await requests(fresh), []);
    });

    it("a parent picking a name off the class list links at once", async () => {
      const row = await newRow("سلمى");
      const res = await call(on, "POST", "/auth/claim", w.users.parentB, { claimCode: CLASS_CODE, studentId: row });
      assert.equal(res.status, 201, on.logs().slice(-1500));
      assert.equal(res.json.relation, "guardian");
      assert.deepEqual(await requests(row), []);
    });
  });

  describe("code-only signup (POST /auth/redeem)", () => {
    it("creates the account and holds the claim: tokens and login code as today, but no link", async () => {
      const res = await call(on, "POST", "/auth/redeem", undefined, {
        role: "student",
        claimCode: CLASS_CODE,
        studentId: redeemRow,
        acceptedTerms: true,
      });
      assert.equal(res.status, 201, on.logs().slice(-1500));
      assert.equal(res.json.pending, true);
      assert.equal(res.json.studentName, "هديل");
      assert.equal(res.json.user.hasRosterLink, false);
      assert.equal(typeof res.json.loginCode, "string");
      assert.ok(res.json.accessToken);
      const userId = res.json.user.id as string;
      assert.deepEqual((await requests(redeemRow)).map(r => r.user_id), [userId]);
      assert.deepEqual(await selfLinks(redeemRow), []);
    });
  });
});
```

- [ ] **Step 2: Build and run it to see it fail (or skip)**

Run:
```bash
cd artifacts/api-server && pnpm build
node --experimental-strip-types --test src/routes/__tests__/claimApproval.db.test.ts
```
Expected without `TEST_DATABASE_URL`: the suite **skips** — say so; CI runs it. With a local database it FAILS (first test gets 201, not 202).

- [ ] **Step 3: Imports and outcome types in `auth.ts`**

Add `rosterLinkRequests` to the `@workspace/db` import list (next to `rosterLinks`). Add, with the other `../lib/*.ts` imports:

```ts
import { claimNeedsApproval, pendingLimitReached } from "../lib/claimDecision.ts";
```

Replace the `ClaimWriteOutcome` type and the `CLAIM_REFUSALS` declaration with:

```ts
type ClaimWriteOutcome = "linked" | "pending" | "taken" | "guardian_taken" | "guardian_limit" | "pending_limit";

/**
 * What a refused claim answers. One table for `/claim` and `/redeem`, so the two
 * cannot word the same refusal differently — the app translates by `code`.
 */
const CLAIM_REFUSALS: Record<Exclude<ClaimWriteOutcome, "linked" | "pending">, { error: string; code: string }> = {
  taken: { error: "This student is already linked to an account", code: "claim_already_linked" },
  guardian_taken: { error: "A parent account is already linked to this student", code: "claim_guardian_taken" },
  guardian_limit: {
    error: "This student already has the most parent accounts allowed. Ask the teacher to remove one.",
    code: "claim_guardian_limit",
  },
  pending_limit: {
    error: "Too many accounts are waiting on this name. Ask the teacher.",
    code: "claim_pending_limit",
  },
};
```

(Keep the existing doc comment above `CLAIM_REFUSALS` as it is; only the declaration changes.)

- [ ] **Step 4: The pending branch in `linkRosterRowInTx`**

In `linkRosterRowInTx`, directly **before** the final `await tx.insert(rosterLinks)…` (after the guardian-limit block), add:

```ts
  // A student's pick off the CLASS list waits for the teacher (lib/claimDecision.ts).
  // Nothing here touches roster_links, so the account stays without access until the
  // teacher approves (routes/roster.ts).
  if (claimNeedsApproval(resolved)) {
    // Counted under the same row lock as the checks above, and BEFORE this account's
    // earlier request is replaced, so a refused pick costs it nothing.
    const [{ n } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(rosterLinkRequests)
      .where(and(eq(rosterLinkRequests.studentId, resolved.studentId), ne(rosterLinkRequests.userId, userId)));
    if (pendingLimitReached(n)) return "pending_limit";
    // One waiting pick per account: choosing another name replaces the first.
    await tx
      .delete(rosterLinkRequests)
      .where(and(eq(rosterLinkRequests.userId, userId), ne(rosterLinkRequests.studentId, resolved.studentId)));
    await tx
      .insert(rosterLinkRequests)
      .values({ studentId: resolved.studentId, userId, relation: resolved.relation })
      .onConflictDoNothing();
    return "pending";
  }
```

- [ ] **Step 5: `POST /claim`**

In the `/claim` handler replace

```ts
    const outcome = await db.transaction(tx => linkRosterRowInTx(tx, userId, resolved));
    if (outcome !== "linked") {
      res.status(409).json(CLAIM_REFUSALS[outcome]);
      return;
    }
```

with

```ts
    const outcome = await db.transaction(tx => linkRosterRowInTx(tx, userId, resolved));
    if (outcome === "pending") {
      const [row] = await db
        .select({ displayName: students.displayName })
        .from(students)
        .where(eq(students.id, resolved.studentId))
        .limit(1);
      // 202, not 201: nothing was linked. The app shows a waiting screen, not the class.
      res.status(202).json({ pending: true, studentId: resolved.studentId, studentName: row?.displayName ?? "" });
      return;
    }
    if (outcome !== "linked") {
      res.status(409).json(CLAIM_REFUSALS[outcome]);
      return;
    }
```

- [ ] **Step 6: `GET /claim` and `DELETE /claim`**

In `GET /claim`, add above the `res.json`:

```ts
    const pending = await db
      .select({ studentId: students.id, displayName: students.displayName })
      .from(rosterLinkRequests)
      .innerJoin(students, eq(students.id, rosterLinkRequests.studentId))
      .where(and(eq(rosterLinkRequests.userId, req.user!.id), isNull(students.archivedAt)));
```
and change `res.json({ links: [...byStudent.values()] });` to `res.json({ links: [...byStudent.values()], pending });`.

In `DELETE /claim`, as the first statement of the `try` (before the `const removed = …`), add:

```ts
    // A pick that is still waiting is withdrawn with the rest — "choose a different name".
    await db.delete(rosterLinkRequests).where(eq(rosterLinkRequests.userId, req.user!.id));
```

- [ ] **Step 7: `POST /redeem`**

Change the `RedeemRefused` constructor type to `Exclude<ClaimWriteOutcome, "linked" | "pending">`. Replace the transaction block

```ts
    let user: typeof users.$inferSelect;
    try {
      user = await db.transaction(async tx => {
        …
        const outcome = await linkRosterRowInTx(tx, created.id, resolved);
        if (outcome !== "linked") throw new RedeemRefused(outcome);
        return created;
      });
    } catch (err) {
```

by keeping everything the same except: declare `let held = false;` above `let user`, and replace the two lines `const outcome = …; if (outcome !== "linked") throw new RedeemRefused(outcome);` with

```ts
        const outcome = await linkRosterRowInTx(tx, created.id, resolved);
        if (outcome !== "linked" && outcome !== "pending") throw new RedeemRefused(outcome);
        held = outcome === "pending";
```

After the `catch`, change the thread-sync guard `if (resolved.relation === "self") {` to `if (resolved.relation === "self" && !held) {`, and replace the final `res.status(201).json({ … })` with:

```ts
    res.status(201).json({
      accessToken,
      refreshToken: refreshTokenValue,
      loginCode,
      // A held claim has no link yet; the app's routing gate then waits on the teacher.
      user: codeAccountUser(user, !held),
      ...(held ? { pending: true, studentName: student.displayName } : {}),
    });
```

- [ ] **Step 8: Typecheck, build, run what can run**

Run:
```bash
cd /home/user/Iqraa && pnpm run typecheck
cd artifacts/api-server && pnpm build && pnpm test
node --experimental-strip-types --test src/routes/__tests__/claimApproval.db.test.ts
```
Expected: typecheck clean; the full api-server suite passes (DB-backed suites skip without a database — report the skip count); the new DB file passes with a local `TEST_DATABASE_URL`, otherwise skips.

- [ ] **Step 9: Commit**

```bash
git add artifacts/api-server/src/routes/auth.ts artifacts/api-server/src/routes/__tests__/claimApproval.db.test.ts
git diff --cached --stat
git commit -m "feat(api): a student's class-code claim waits for the teacher

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
```

---

### Task 4: The teacher's side — list, approve, reject

**Files:**
- Modify: `artifacts/api-server/src/routes/roster.ts` (imports; new routes after `DELETE /classes/:id/students/:studentId`)
- Test: `artifacts/api-server/src/routes/__tests__/linkRequests.db.test.ts` (new)

**Interfaces:**
- Consumes: `rosterLinkRequests` (Task 1); `isUniqueViolation` from `../lib/pgErrors.js`; `syncClassThreadsForStudent`, `resyncClassGroupThreadIfExists` (already imported in `roster.ts`).
- Produces (HTTP; all behind the existing `/classes` and `/students` teacher guard, so a new path needs no new `router.use`):
  - `GET /classes/:id/link-requests` → `{ requests: { id, studentId, studentName, userId, firstName, lastName, requestedAt }[] }`, oldest first. Excludes requests whose name already has a student account, whose sender is no longer a `student`, or whose student is archived or not in this class.
  - `POST /students/:id/link-requests/:requestId/approve` → 200 `{ approved: requestId, studentId, userId }`; 409 `claim_already_linked`; 409 `claim_request_stale`; 404 for anything not the teacher's.
  - `POST /students/:id/link-requests/:requestId/reject` → 200 `{ rejected: requestId }`; 404.

- [ ] **Step 1: Write the failing DB test**

Create `artifacts/api-server/src/routes/__tests__/linkRequests.db.test.ts`:

```ts
/**
 * The teacher's side of class-code claims: see who is waiting, approve one,
 * reject one. Real database, real HTTP. Requests are inserted directly — how
 * they get made is claimApproval.db.test.ts.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

describeDb("a teacher approves or rejects a student's class-code claim, over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let u1 = "";
  let u2 = "";
  let u3 = "";
  let rowRejected = "";
  let rowStale = "";

  const q = async (sql: string, params: unknown[] = []) => (await db.pool.query(sql, params)).rows;
  const newUser = async (first: string, role = "student") =>
    (await q(`INSERT INTO users (first_name, last_name, role) VALUES ($1, 'T', $2) RETURNING id`, [first, role]))[0].id as string;
  const newRow = async (name: string) => {
    const id = (await q(`INSERT INTO students (teacher_id, display_name) VALUES ($1, $2) RETURNING id`, [w.users.t1, name]))[0].id as string;
    await q(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, id]);
    return id;
  };
  const ask = async (studentId: string, userId: string) =>
    (await q(`INSERT INTO roster_link_requests (student_id, user_id, relation) VALUES ($1, $2, 'self') RETURNING id`, [studentId, userId]))[0].id as string;
  const requestsOf = (studentId: string) => q(`SELECT user_id FROM roster_link_requests WHERE student_id = $1`, [studentId]);
  const selfLinks = (studentId: string) => q(`SELECT user_id FROM roster_links WHERE student_id = $1 AND relation = 'self'`, [studentId]);

  let r1 = "";
  let r2 = "";

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await q(`UPDATE users SET roster_consent_at = now() WHERE id = ANY($1::uuid[])`, [[w.users.t1, w.users.t2]]);
    u1 = w.users.studentUnlinked;
    u2 = await newUser("Two");
    u3 = await newUser("Three");
    r1 = await ask(w.students.aA, u1);      // Adam: two accounts want him
    r2 = await ask(w.students.aA, u2);
    await ask(w.students.sA1, u3);          // Sara already has a student account: must not be listed
    await ask(w.students.aA, w.users.parentB); // a parent account is never a student claim: must not be listed
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  describe("GET /classes/:id/link-requests", () => {
    it("lists the accounts waiting on this class's names, oldest first, with who they are", async () => {
      const res = await call(on, "GET", `/classes/${w.classes.c1}/link-requests`, w.users.t1);
      assert.equal(res.status, 200, on.logs().slice(-1500));
      const rows = res.json.requests as { id: string; studentId: string; studentName: string; userId: string; firstName: string }[];
      assert.deepEqual(rows.map(r => r.id), [r1, r2]);
      assert.equal(rows[0]!.studentId, w.students.aA);
      assert.equal(rows[0]!.studentName, "آدم");
      assert.equal(rows[0]!.userId, u1);
      assert.equal(rows[1]!.firstName, "Two");
    });

    it("is another teacher's class: 404", async () => {
      const res = await call(on, "GET", `/classes/${w.classes.c1}/link-requests`, w.users.t2);
      assert.equal(res.status, 404);
    });
  });

  describe("approve", () => {
    it("another teacher cannot: 404, and nothing changes", async () => {
      const res = await call(on, "POST", `/students/${w.students.aA}/link-requests/${r1}/approve`, w.users.t2);
      assert.equal(res.status, 404);
      assert.deepEqual(await selfLinks(w.students.aA), []);
      assert.equal((await requestsOf(w.students.aA)).length, 3);
    });

    it("links the account as the student's own, and clears every other request on that name", async () => {
      const res = await call(on, "POST", `/students/${w.students.aA}/link-requests/${r1}/approve`, w.users.t1);
      assert.equal(res.status, 200, on.logs().slice(-1500));
      assert.deepEqual(res.json, { approved: r1, studentId: w.students.aA, userId: u1 });
      assert.deepEqual((await selfLinks(w.students.aA)).map(r => r.user_id), [u1]);
      assert.deepEqual(await requestsOf(w.students.aA), []);
    });

    it("the approved account now counts as linked", async () => {
      const me = await call(on, "GET", "/auth/me", u1);
      assert.equal(me.json.user?.hasRosterLink ?? me.json.hasRosterLink, true);
    });

    it("approving a request that is gone: 404", async () => {
      const res = await call(on, "POST", `/students/${w.students.aA}/link-requests/${r2}/approve`, w.users.t1);
      assert.equal(res.status, 404);
    });

    it("a name that already has a student account cannot be approved again: 409, no second link", async () => {
      const late = await ask(w.students.aA, u3);
      const res = await call(on, "POST", `/students/${w.students.aA}/link-requests/${late}/approve`, w.users.t1);
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "claim_already_linked");
      assert.equal((await selfLinks(w.students.aA)).length, 1);
    });

    it("a request whose sender is no longer a student account is dropped, not linked: 409 claim_request_stale", async () => {
      rowStale = await newRow("نور");
      const switched = await newUser("Switched", "teacher");
      const id = await ask(rowStale, switched);
      const res = await call(on, "POST", `/students/${rowStale}/link-requests/${id}/approve`, w.users.t1);
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "claim_request_stale");
      assert.deepEqual(await selfLinks(rowStale), []);
      assert.deepEqual(await requestsOf(rowStale), []);
    });
  });

  describe("reject", () => {
    it("removes the request and links nothing", async () => {
      rowRejected = await newRow("جود");
      const id = await ask(rowRejected, u2);
      const other = await call(on, "POST", `/students/${rowRejected}/link-requests/${id}/reject`, w.users.t2);
      assert.equal(other.status, 404, "another teacher cannot reject");
      const res = await call(on, "POST", `/students/${rowRejected}/link-requests/${id}/reject`, w.users.t1);
      assert.equal(res.status, 200, on.logs().slice(-1500));
      assert.deepEqual(res.json, { rejected: id });
      assert.deepEqual(await requestsOf(rowRejected), []);
      assert.deepEqual(await selfLinks(rowRejected), []);
    });

    it("rejecting what is gone: 404", async () => {
      const res = await call(on, "POST", `/students/${rowRejected}/link-requests/${r2}/reject`, w.users.t1);
      assert.equal(res.status, 404);
    });
  });
});
```

- [ ] **Step 2: Run it to see it fail (or skip)**

Run: `cd artifacts/api-server && pnpm build && node --experimental-strip-types --test src/routes/__tests__/linkRequests.db.test.ts`
Expected without a database: **skips** (say so). With one: FAIL — the routes answer 404.

- [ ] **Step 3: Imports**

In `artifacts/api-server/src/routes/roster.ts`: add `rosterLinkRequests` to the `@workspace/db` import list (alongside `rosterLinks`); add

```ts
import { isUniqueViolation } from "../lib/pgErrors.js";
```

(`isUuid`, `findLiveClass`, `syncClassThreadsForStudent`, `resyncClassGroupThreadIfExists`, `logger`, `users`, `inArray`, `and`, `asc`, `eq`, `isNull` are already imported.)

- [ ] **Step 4: The three routes**

Directly after the `router.delete("/classes/:id/students/:studentId", …)` handler, add:

```ts
// ─── Class-code claims waiting for the teacher ───────────────────────────────
// A student who picks a name off the class code is held in roster_link_requests
// (routes/auth.ts); until the teacher approves it the account has no roster
// link and so no access to anything. See lib/claimDecision.ts.

/** After a link is made: into this teacher's class chats for the child, as the claim route does. Never throws. */
async function syncThreadsAfterApproval(studentId: string, teacherId: string): Promise<void> {
  try {
    await syncClassThreadsForStudent(studentId);
    const classes = await db
      .select({ classGroupId: classMemberships.classGroupId })
      .from(classMemberships)
      .innerJoin(classGroups, eq(classGroups.id, classMemberships.classGroupId))
      .where(and(eq(classMemberships.studentId, studentId), eq(classGroups.teacherId, teacherId), isNull(classGroups.archivedAt)));
    for (const c of classes) await resyncClassGroupThreadIfExists(c.classGroupId, teacherId);
  } catch (err) {
    logger.warn({ studentId, code: (err as { code?: unknown } | null)?.code }, "class thread sync after approval failed");
  }
}

router.get("/classes/:id/link-requests", async (req: AuthenticatedRequest, res) => {
  try {
    const classId = req.params["id"] as string;
    if (!isUuid(classId) || !(await findLiveClass(classId, req.user!.id))) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const rows = await db
      .select({
        id: rosterLinkRequests.id,
        studentId: students.id,
        studentName: students.displayName,
        userId: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        requestedAt: rosterLinkRequests.createdAt,
      })
      .from(rosterLinkRequests)
      .innerJoin(students, eq(students.id, rosterLinkRequests.studentId))
      .innerJoin(
        classMemberships,
        and(eq(classMemberships.studentId, students.id), eq(classMemberships.classGroupId, classId)),
      )
      .innerJoin(users, eq(users.id, rosterLinkRequests.userId))
      .where(
        and(
          eq(students.teacherId, req.user!.id),
          isNull(students.archivedAt),
          // A request from an account that has since become something else is not a student claim.
          eq(users.role, "student"),
        ),
      )
      .orderBy(asc(rosterLinkRequests.createdAt));

    // A name that already has a student account has nothing left to approve.
    const taken = rows.length === 0
      ? []
      : await db
          .select({ studentId: rosterLinks.studentId })
          .from(rosterLinks)
          .where(and(inArray(rosterLinks.studentId, rows.map(r => r.studentId)), eq(rosterLinks.relation, "self")));
    const takenIds = new Set(taken.map(t => t.studentId));

    res.json({ requests: rows.filter(r => !takenIds.has(r.studentId)) });
  } catch (err) {
    failRoster(res, err, "list link requests", "Failed to load join requests");
  }
});

/** The request, only if it is for this teacher's live student. "Not found" either way. */
async function findOwnRequest(requestId: string, studentId: string, teacherId: string) {
  if (!isUuid(requestId) || !isUuid(studentId)) return null;
  const [row] = await db
    .select({ id: rosterLinkRequests.id, userId: rosterLinkRequests.userId, role: users.role })
    .from(rosterLinkRequests)
    .innerJoin(students, eq(students.id, rosterLinkRequests.studentId))
    .innerJoin(users, eq(users.id, rosterLinkRequests.userId))
    .where(
      and(
        eq(rosterLinkRequests.id, requestId),
        eq(rosterLinkRequests.studentId, studentId),
        eq(students.teacherId, teacherId),
        isNull(students.archivedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

router.post("/students/:id/link-requests/:requestId/approve", async (req: AuthenticatedRequest, res) => {
  try {
    const studentId = req.params["id"] as string;
    const requestId = req.params["requestId"] as string;
    const request = await findOwnRequest(requestId, studentId, req.user!.id);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }

    // An account that switched to another role while it waited is not a student;
    // linking it as the child's own account would give a teacher account a child's
    // exam answers. Drop the request instead.
    if (request.role !== "student") {
      await db.delete(rosterLinkRequests).where(eq(rosterLinkRequests.id, request.id));
      res.status(409).json({ error: "That request is no longer valid", code: "claim_request_stale" });
      return;
    }

    try {
      await db.insert(rosterLinks).values({ studentId, userId: request.userId, relation: "self" });
    } catch (err) {
      // roster_links_one_self_idx: one student account per name, enforced where a race cannot get past it.
      if (isUniqueViolation(err)) {
        res.status(409).json({ error: "This student is already linked to an account", code: "claim_already_linked" });
        return;
      }
      throw err;
    }

    // Everyone else who was waiting on this name is answered by the link itself.
    await db.delete(rosterLinkRequests).where(eq(rosterLinkRequests.studentId, studentId));
    await syncThreadsAfterApproval(studentId, req.user!.id);

    res.json({ approved: request.id, studentId, userId: request.userId });
  } catch (err) {
    failRoster(res, err, "approve link request", "Failed to approve the request");
  }
});

router.post("/students/:id/link-requests/:requestId/reject", async (req: AuthenticatedRequest, res) => {
  try {
    const studentId = req.params["id"] as string;
    const requestId = req.params["requestId"] as string;
    const request = await findOwnRequest(requestId, studentId, req.user!.id);
    if (!request) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    await db.delete(rosterLinkRequests).where(eq(rosterLinkRequests.id, request.id));
    res.json({ rejected: request.id });
  } catch (err) {
    failRoster(res, err, "reject link request", "Failed to reject the request");
  }
});
```

- [ ] **Step 5: Typecheck, build, run what can run**

Run:
```bash
cd /home/user/Iqraa && pnpm run typecheck
cd artifacts/api-server && pnpm build && pnpm test
node --experimental-strip-types --test src/routes/__tests__/linkRequests.db.test.ts
```
Expected: typecheck clean; api-server suite passes (DB suites skip without a database — report the count); the new file passes with a local database, otherwise skips. `mountOrder.test.ts` must still pass (the new routes sit under the existing guarded `/classes` and `/students` prefixes).

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src/routes/roster.ts artifacts/api-server/src/routes/__tests__/linkRequests.db.test.ts
git diff --cached --stat
git commit -m "feat(api): a teacher lists, approves and rejects class-code claims

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
```

---

### Task 5: Mobile services, pure helpers and strings

**Files:**
- Create: `artifacts/mobile/services/claimResult.ts`, `artifacts/mobile/services/claimWaiting.ts`
- Test: `artifacts/mobile/services/__tests__/claimResult.test.ts`, `artifacts/mobile/services/__tests__/claimWaiting.test.ts`
- Modify: `artifacts/mobile/services/roster.ts` (`claimRosterCode`; new functions), `artifacts/mobile/services/claimCodeGate.ts` (`CLAIM_ERROR_KEYS`), `artifacts/mobile/services/i18n.ts` (both language blocks)

**Interfaces:**
- Produces:
  - `claimResult.ts`: `type ClaimResult = { status: 'linked'; studentId: string; relation: 'self' | 'guardian' } | { status: 'pending'; studentId: string; studentName: string }`; `parseClaimResponse(body: unknown): ClaimResult`
  - `claimWaiting.ts`: `interface PendingClaim { studentId: string; displayName: string }`; `claimScreenState(pending: readonly PendingClaim[], wasWaiting: boolean): { mode: 'form' | 'waiting'; studentName: string; declined: boolean }`
  - `roster.ts`: `claimRosterCode(code, studentId?): Promise<ClaimResult>`; `getMyRosterClaims(): Promise<{ links: …; pending: PendingClaim[] }>`; `interface LinkRequest { id; studentId; studentName; userId; firstName; lastName; requestedAt }`; `listLinkRequests(classId): Promise<LinkRequest[]>`; `approveLinkRequest(studentId, requestId): Promise<void>`; `rejectLinkRequest(studentId, requestId): Promise<void>`
  - i18n keys (below).

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/claimResult.test.ts`:

```ts
/**
 * POST /auth/claim answers 201 {studentId, relation} when it linked and 202
 * {pending: true, studentId, studentName} when the teacher has to approve. The
 * screens branch on which, so the reading of the body is pinned here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseClaimResponse } from '../claimResult.ts';

describe('parseClaimResponse', () => {
  it('reads a linked claim', () => {
    assert.deepEqual(parseClaimResponse({ studentId: 's1', relation: 'self' }), { status: 'linked', studentId: 's1', relation: 'self' });
    assert.deepEqual(parseClaimResponse({ studentId: 's1', relation: 'guardian' }), { status: 'linked', studentId: 's1', relation: 'guardian' });
  });

  it('reads a held claim, with the name the student picked', () => {
    assert.deepEqual(
      parseClaimResponse({ pending: true, studentId: 's1', studentName: 'خالد' }),
      { status: 'pending', studentId: 's1', studentName: 'خالد' },
    );
  });

  it('never mistakes a held claim for a linked one, and survives an odd body', () => {
    assert.equal(parseClaimResponse({ pending: true }).status, 'pending');
    assert.deepEqual(parseClaimResponse(null), { status: 'linked', studentId: '', relation: 'self' });
  });
});
```

Create `artifacts/mobile/services/__tests__/claimWaiting.test.ts`:

```ts
/**
 * What the mandatory claim screen shows: the code form, or — while the teacher
 * has not answered — a waiting card. When a request that was waiting is gone
 * and no link appeared, the teacher said no, and the form says so.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { claimScreenState } from '../claimWaiting.ts';

describe('claimScreenState', () => {
  it('shows the form, undeclined, for an account that never asked', () => {
    assert.deepEqual(claimScreenState([], false), { mode: 'form', studentName: '', declined: false });
  });

  it('shows the waiting card with the name that was picked', () => {
    assert.deepEqual(
      claimScreenState([{ studentId: 's1', displayName: 'خالد' }], false),
      { mode: 'waiting', studentName: 'خالد', declined: false },
    );
  });

  it('says it was declined when a waiting request disappears without a link', () => {
    assert.deepEqual(claimScreenState([], true), { mode: 'form', studentName: '', declined: true });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/claimResult.test.ts services/__tests__/claimWaiting.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: The two pure modules**

Create `artifacts/mobile/services/claimResult.ts`:

```ts
/**
 * The two answers `POST /auth/claim` can give, as the screens use them. Pure,
 * so the rule "a 202 is a waiting request, not a joined class" is tested.
 */
export type ClaimResult =
  | { status: 'linked'; studentId: string; relation: 'self' | 'guardian' }
  | { status: 'pending'; studentId: string; studentName: string };

export function parseClaimResponse(body: unknown): ClaimResult {
  const b = (body ?? {}) as { pending?: unknown; studentId?: unknown; relation?: unknown; studentName?: unknown };
  const studentId = typeof b.studentId === 'string' ? b.studentId : '';
  if (b.pending === true) {
    return { status: 'pending', studentId, studentName: typeof b.studentName === 'string' ? b.studentName : '' };
  }
  return { status: 'linked', studentId, relation: b.relation === 'guardian' ? 'guardian' : 'self' };
}
```

Create `artifacts/mobile/services/claimWaiting.ts`:

```ts
/**
 * What `app/claim-required.tsx` shows. Pure for the same reason as the rest of
 * the claim rules (see claimCodeGate.ts): the screen cannot be loaded by node.
 */
export interface PendingClaim {
  studentId: string;
  displayName: string;
}

export interface ClaimScreenState {
  mode: 'form' | 'waiting';
  /** The name the account asked for, while waiting. */
  studentName: string;
  /** A request that was waiting is gone and nothing linked: the teacher said no. */
  declined: boolean;
}

export function claimScreenState(pending: readonly PendingClaim[], wasWaiting: boolean): ClaimScreenState {
  const first = pending[0];
  if (first) return { mode: 'waiting', studentName: first.displayName, declined: false };
  return { mode: 'form', studentName: '', declined: wasWaiting };
}
```

- [ ] **Step 4: Client functions in `services/roster.ts`**

Add the imports at the top with the others:

```ts
import { parseClaimResponse, type ClaimResult } from './claimResult.ts';
import type { PendingClaim } from './claimWaiting.ts';
```

Replace the whole `claimRosterCode` function (keep its doc comment; append a sentence "A class-code pick by a student answers 202: the teacher has to approve it, and nothing is linked yet.") with:

```ts
export async function claimRosterCode(code: string, studentId?: string): Promise<ClaimResult> {
  const res = await apiFetch('/auth/claim', {
    method: 'POST',
    body: JSON.stringify({ claimCode: code, studentId }),
  });
  const result = parseClaimResponse(await readJson<unknown>(res, 'Joining class'));
  // Tracked here rather than on the two screens that call this: join-class.tsx
  // and the mandatory first claim in claim-required.tsx are the same action,
  // and instrumenting one of them is how half a funnel goes missing. Only a
  // claim that linked is a class joined; a held one is not one yet.
  if (result.status === 'linked') trackEvent('class_joined', { relation: result.relation });
  return result;
}
```

Below `listMyRosterLinks`, add:

```ts
/** Links and any still-waiting claims, for the mandatory claim screen. `GET /auth/claim`. */
export async function getMyRosterClaims(): Promise<{
  links: { studentId: string; displayName: string; gradeId: string | null }[];
  pending: PendingClaim[];
}> {
  const res = await apiFetch('/auth/claim');
  const data = await readJson<{
    links: { studentId: string; displayName: string; gradeId: string | null }[];
    pending?: PendingClaim[];
  }>(res, 'Loading your links');
  return { links: data.links, pending: data.pending ?? [] };
}

/** A student account waiting on a class-code claim, as its teacher sees it. `GET /classes/:id/link-requests`. */
export interface LinkRequest {
  id: string;
  studentId: string;
  studentName: string;
  userId: string;
  firstName: string;
  lastName: string;
  requestedAt: string;
}

export async function listLinkRequests(classId: string): Promise<LinkRequest[]> {
  const res = await apiFetch(`/classes/${classId}/link-requests`);
  const data = await readJson<{ requests: LinkRequest[] }>(res, 'Loading join requests');
  return data.requests;
}

/** Link the waiting account as the student's own. 409 `claim_already_linked` when the name already has one. */
export async function approveLinkRequest(studentId: string, requestId: string): Promise<void> {
  const res = await apiFetch(`/students/${studentId}/link-requests/${requestId}/approve`, { method: 'POST' });
  await readJson(res, 'Approving join request');
}

export async function rejectLinkRequest(studentId: string, requestId: string): Promise<void> {
  const res = await apiFetch(`/students/${studentId}/link-requests/${requestId}/reject`, { method: 'POST' });
  await readJson(res, 'Rejecting join request');
}
```

- [ ] **Step 5: The error key**

In `artifacts/mobile/services/claimCodeGate.ts`, add to `CLAIM_ERROR_KEYS` after `claim_guardian_limit`:

```ts
  // Five accounts already wait on that name (api-server lib/claimDecision.ts).
  claim_pending_limit: 'claimPendingLimit',
```

- [ ] **Step 6: Strings (both languages)**

In `artifacts/mobile/services/i18n.ts`, in the **ar** block, next to the other claim strings (e.g. directly after the `claimGuardianLimit:` entry — find it with `grep -n "claimGuardianLimit" artifacts/mobile/services/i18n.ts`), add:

```ts
    claimPendingLimit: 'عدد كبير من الطلبات ينتظر على هذا الاسم. اسأل معلمك.',
    claimWaitingTitle: 'بانتظار موافقة المعلم',
    claimWaitingDesc: (name: string) => `وصل طلبك للانضمام باسم «${name}» إلى المعلم. ستفتح لك الشعبة بعد موافقته.`,
    claimWaitingCheck: 'تحقق مرة أخرى',
    claimWaitingChange: 'اختيار اسم آخر',
    claimWaitingStill: 'لم يوافق المعلم بعد.',
    claimDeclined: 'لم يوافق المعلم على طلبك. تأكد من اسمك واختره من جديد، أو اسأل معلمك.',
    joinAnotherClassPending: 'أُرسل طلبك إلى المعلم. ستظهر الشعبة بعد موافقته.',
    linkRequestsTitle: 'طلبات الانضمام',
    linkRequestsHint: 'اختار هؤلاء الطلاب أسماءهم برمز الشعبة. وافق إذا كان الحساب لصاحب الاسم.',
    linkRequestApprove: 'موافقة',
    linkRequestReject: 'رفض',
    linkRequestFailed: 'تعذّر تنفيذ الإجراء. حاول مرة أخرى.',
    linkRequestTaken: 'هذا الاسم مرتبط بحساب طالب آخر بالفعل.',
```

In the **en** block, next to `claimGuardianLimit`:

```ts
    claimPendingLimit: 'Too many requests are waiting on this name. Ask your teacher.',
    claimWaitingTitle: 'Waiting for your teacher',
    claimWaitingDesc: (name: string) => `Your request to join as «${name}» has reached your teacher. The class opens once they approve it.`,
    claimWaitingCheck: 'Check again',
    claimWaitingChange: 'Pick a different name',
    claimWaitingStill: 'Your teacher has not approved yet.',
    claimDeclined: 'Your teacher did not approve that request. Check your name and pick it again, or ask your teacher.',
    joinAnotherClassPending: 'Your request was sent to the teacher. The class appears once they approve it.',
    linkRequestsTitle: 'Join requests',
    linkRequestsHint: 'These students picked their names with the class code. Approve if the account is the name\'s owner.',
    linkRequestApprove: 'Approve',
    linkRequestReject: 'Reject',
    linkRequestFailed: 'That did not work. Try again.',
    linkRequestTaken: 'This name is already linked to another student account.',
```

(`rosterClaimedByLabel` from PR 1 is reused for the account line; do not add it again.)

- [ ] **Step 7: Run tests and typecheck**

Run:
```bash
cd /home/user/Iqraa/artifacts/mobile
node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/claimResult.test.ts services/__tests__/claimWaiting.test.ts services/__tests__/i18n.test.ts services/__tests__/claimCodeGate.test.ts
cd /home/user/Iqraa && pnpm run typecheck
```
Expected: all pass (find the real name of the claim-code-gate test with `ls artifacts/mobile/services/__tests__ | grep -i claim` and use it); typecheck clean — the two existing callers of `claimRosterCode` (`app/claim-required.tsx`, `app/join-class.tsx`) still compile because they ignore the return value; Task 6 uses it.

- [ ] **Step 8: Commit**

```bash
git add artifacts/mobile/services/claimResult.ts artifacts/mobile/services/claimWaiting.ts artifacts/mobile/services/__tests__/claimResult.test.ts artifacts/mobile/services/__tests__/claimWaiting.test.ts artifacts/mobile/services/roster.ts artifacts/mobile/services/claimCodeGate.ts artifacts/mobile/services/i18n.ts
git diff --cached --stat
git commit -m "feat(app): client for held claims and join requests

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
```

---

### Task 6: The applicant's screens

**Files:**
- Create: `artifacts/mobile/components/ClaimWaitingCard.tsx`
- Modify: `artifacts/mobile/app/claim-required.tsx`, `artifacts/mobile/app/join-class.tsx`

**Interfaces:**
- Consumes: `claimRosterCode`, `getMyRosterClaims`, `unclaimRoster` (`services/roster.ts`); `claimScreenState`, `PendingClaim` (Task 5); strings `claimWaiting*`, `claimDeclined`, `joinAnotherClassPending`.
- Produces: `<ClaimWaitingCard studentName checking error onCheck onChange colors isRTL t />`.

- [ ] **Step 1: The waiting card**

Create `artifacts/mobile/components/ClaimWaitingCard.tsx`:

```tsx
/**
 * What an account sees while its teacher has not yet answered a class-code
 * claim: which name it asked for, a way to look again, and a way to pick a
 * different name. It sits in place of the code form on the mandatory claim
 * screen (`app/claim-required.tsx`); nothing else in the app is reachable until
 * the teacher approves, because the account has no roster link yet.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import type { TranslationKey } from '@/services/i18n';
import { ICON } from '@/constants/icons';

interface Props {
  studentName: string;
  checking: boolean;
  error: string;
  onCheck: () => void;
  onChange: () => void;
  colors: any;
  isRTL: boolean;
  t: (key: TranslationKey, ...args: any[]) => string;
}

export function ClaimWaitingCard({ studentName, checking, error, onCheck, onChange, colors, isRTL, t }: Props) {
  const align = isRTL ? 'right' : 'left';
  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: colors.radius }]}>
      <View style={[styles.head, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Ionicons name="time-outline" size={ICON.lg} color={colors.primary} />
        <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>
          {t('claimWaitingTitle')}
        </Text>
      </View>
      <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
        {t('claimWaitingDesc', studentName)}
      </Text>
      {error ? (
        <Text style={[styles.desc, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
          {error}
        </Text>
      ) : null}
      <Button label={t('claimWaitingCheck')} onPress={onCheck} loading={checking} fullWidth style={{ marginTop: 16 }} />
      <Button label={t('claimWaitingChange')} variant="ghost" onPress={onChange} disabled={checking} fullWidth style={{ marginTop: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 16 },
  head: { alignItems: 'center', gap: 10 },
  title: { fontSize: 18, flex: 1 },
  desc: { fontSize: 15, lineHeight: 24, marginTop: 10 },
});
```

Before relying on `ICON.lg`: open `artifacts/mobile/constants/icons.ts`, read the `ICON` object, and use the key whose value is 24 (the scale is 14/16/20/24); if the key is not `lg`, use the real one.

- [ ] **Step 2: `claim-required.tsx` — wire the waiting state**

With the Edit tool, in `artifacts/mobile/app/claim-required.tsx`:

1. Change `import React, { useState } from 'react';` to `import React, { useEffect, useState } from 'react';`.
2. Add imports after the existing `@/services/claimCodeGate` import:
```tsx
import { ClaimWaitingCard } from '@/components/ClaimWaitingCard';
import { claimScreenState, type PendingClaim } from '@/services/claimWaiting';
```
and change the roster import to
```tsx
import { RosterError, claimRosterCode, getMyRosterClaims, unclaimRoster } from '@/services/roster';
```
3. After the `const [error, setError] = useState('');` line add:
```tsx
  // Claims the teacher has not answered yet. A class-code pick by a student is
  // held (api-server lib/claimDecision.ts), and the account stays on this screen.
  const [pending, setPending] = useState<PendingClaim[]>([]);
  const [wasWaiting, setWasWaiting] = useState(false);
  const [checking, setChecking] = useState(false);
  const screen = claimScreenState(pending, wasWaiting);

  /** Re-reads the account's claims. 'linked' also lets the account in. */
  const refreshClaims = async (): Promise<'linked' | 'waiting' | 'none'> => {
    try {
      const { links, pending: waiting } = await getMyRosterClaims();
      if (links.length > 0) {
        markRosterClaimed();
        router.replace('/(tabs)');
        return 'linked';
      }
      setPending(waiting);
      if (waiting.length > 0) setWasWaiting(true);
      return waiting.length > 0 ? 'waiting' : 'none';
    } catch {
      return 'none';
    }
  };

  // An account that asked earlier (another session, or after signing in again) opens straight on the waiting card.
  useEffect(() => { void refreshClaims(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheck = async () => {
    setChecking(true);
    setError('');
    const state = await refreshClaims();
    if (state === 'waiting') setError(t('claimWaitingStill'));
    setChecking(false);
  };

  const handleChangeName = async () => {
    setChecking(true);
    setError('');
    try {
      await unclaimRoster();
      setPending([]);
      setWasWaiting(false);
    } catch {
      setError(t('joinAnotherClassFailed'));
    } finally {
      setChecking(false);
    }
  };
```
4. In `handleSubmit`, replace
```tsx
      await claimRosterCode(code.trim(), roster ? studentId : undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      markRosterClaimed();
      router.replace('/(tabs)');
```
with
```tsx
      const result = await claimRosterCode(code.trim(), roster ? studentId : undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result.status === 'pending') {
        // Held for the teacher: nothing is linked, so the gate must not open.
        setPending([{ studentId: result.studentId, displayName: result.studentName }]);
        setWasWaiting(true);
        setSubmitting(false);
        return;
      }
      markRosterClaimed();
      router.replace('/(tabs)');
```
5. Replace the block from `{toTeacher ? null : <RosterCodeClaimForm` through the closing `/>` of the final `<Button …/>` (the form, the error banner and the submit button) with a conditional that keeps all three unchanged in the `form` branch:

```tsx
        {screen.mode === 'waiting' && !toTeacher ? (
          <ClaimWaitingCard
            studentName={screen.studentName}
            checking={checking}
            error={error}
            onCheck={() => void handleCheck()}
            onChange={() => void handleChangeName()}
            colors={colors}
            isRTL={isRTL}
            t={t}
          />
        ) : (
          <>
            {screen.declined ? (
              <Text style={[styles.desc, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
                {t('claimDeclined')}
              </Text>
            ) : null}
            {/* the existing {toTeacher ? null : <RosterCodeClaimForm … />}, the error banner and the submit <Button …/>, unchanged */}
          </>
        )}
```
Move the three existing JSX blocks **verbatim** into the fragment where the comment stands (do not retype them; cut and paste via Edit) and delete the comment.

- [ ] **Step 3: `join-class.tsx` — a held claim is not a joined class**

In `artifacts/mobile/app/join-class.tsx`: after `const [joined, setJoined] = useState(false);` add `const [heldForTeacher, setHeldForTeacher] = useState(false);`. In `handleSubmit` replace

```tsx
      await claimRosterCode(code.trim(), roster ? studentId : undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJoined(true);
      // A class is where the teacher's messages and released results come
      // from — a natural moment to offer push (services/pushPolicy.ts).
      void askForPushPermission({ explicit: false, copy: pushAskCopy(t) });
```

with

```tsx
      const result = await claimRosterCode(code.trim(), roster ? studentId : undefined);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setJoined(true);
      if (result.status === 'pending') {
        // Held for the teacher: the class is not this account's yet, so no push ask either.
        setHeldForTeacher(true);
      } else {
        // A class is where the teacher's messages and released results come
        // from — a natural moment to offer push (services/pushPolicy.ts).
        void askForPushPermission({ explicit: false, copy: pushAskCopy(t) });
      }
```

and in the success view change `{t('joinAnotherClassSuccess')}` to `{t(heldForTeacher ? 'joinAnotherClassPending' : 'joinAnotherClassSuccess')}`.

- [ ] **Step 4: Typecheck and run the mobile suite**

Run:
```bash
cd /home/user/Iqraa && pnpm run typecheck
cd artifacts/mobile && pnpm test
```
Expected: typecheck clean; the whole mobile suite passes (it prints nothing until it finishes — minutes). If `iconSystem.test.ts`, `designScale.test.ts` or `ariaState.test.ts` flags the new component, fix the component (token sizes, `aria-*`), never the test.

- [ ] **Step 5: Look at it if you can**

Needs a local Postgres and a running API (`CLAUDE.md`, «To run the app from a worktree»). If available: register a teacher, make a class with a class code and two students; sign up a student account by redeeming that code and picking a name; confirm the waiting card shows the name, "Check again" says "not approved yet", approving as the teacher (Task 7) lets the student in, rejecting shows the declined note and the form. If no database is available, say plainly in the report that none of this was exercised in a browser.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/components/ClaimWaitingCard.tsx artifacts/mobile/app/claim-required.tsx artifacts/mobile/app/join-class.tsx
git diff --cached --stat
git commit -m "feat(app): a student whose claim waits for the teacher sees a waiting card

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
```

---

### Task 7: The teacher's banner

**Files:**
- Create: `artifacts/mobile/components/classes/LinkRequestsBanner.tsx`
- Modify: `artifacts/mobile/app/classes/[id]/index.tsx`

**Interfaces:**
- Consumes: `listLinkRequests`, `approveLinkRequest`, `rejectLinkRequest`, `RosterError` (`services/roster.ts`); `classQueryKey` from `@/services/rosterQueryKeys`; strings `linkRequests*`, `rosterClaimedByLabel`.
- Produces: `<LinkRequestsBanner classId />`; renders nothing when there are no requests, and nothing at all while the request list cannot be read.

- [ ] **Step 1: The banner**

Create `artifacts/mobile/components/classes/LinkRequestsBanner.tsx`:

```tsx
/**
 * «طلبات الانضمام» — students who picked their names with the class code and
 * are waiting for the teacher's yes. Shown above the roster, hidden at zero.
 *
 * Approving links the account as the child's own; rejecting removes the request.
 * Either way the class roster is refetched, so the name's «joined» state and the
 * claimed-by line move with it. The teacher decides on what they can see here —
 * the account's own name next to the name it asked for — which is the check the
 * class code alone cannot give.
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { RosterError, approveLinkRequest, listLinkRequests, rejectLinkRequest, type LinkRequest } from '@/services/roster';
import { classQueryKey } from '@/services/rosterQueryKeys';
import { formatLinkedOn, linkDisplayName } from '@/services/rosterLinks';
import { SPACE } from '@/constants/theme';

const requestsKey = (classId: string) => ['classLinkRequests', classId] as const;

export function LinkRequestsBanner({ classId }: { classId: string }) {
  const colors = useColors();
  const { t, isRTL, lang } = useLanguage();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const align = isRTL ? 'right' : 'left';

  const { data } = useQuery({
    queryKey: requestsKey(classId),
    queryFn: () => listLinkRequests(classId),
    staleTime: 30_000,
  });
  const requests: LinkRequest[] = data ?? [];
  if (requests.length === 0) return null;

  const act = async (request: LinkRequest, kind: 'approve' | 'reject') => {
    if (busyId) return;
    setBusyId(request.id);
    setError('');
    try {
      if (kind === 'approve') await approveLinkRequest(request.studentId, request.id);
      else await rejectLinkRequest(request.studentId, request.id);
    } catch (err) {
      setError(t(err instanceof RosterError && err.code === 'claim_already_linked' ? 'linkRequestTaken' : 'linkRequestFailed'));
    } finally {
      setBusyId(null);
      // Both lists can have changed whatever the answer was.
      void queryClient.invalidateQueries({ queryKey: requestsKey(classId) });
      void queryClient.invalidateQueries({ queryKey: classQueryKey(classId) });
    }
  };

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: colors.radius }]}>
      <Text style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
        {t('linkRequestsTitle')} · {requests.length}
      </Text>
      <Text style={[styles.hint, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]}>
        {t('linkRequestsHint')}
      </Text>
      {requests.map(request => {
        const busy = busyId === request.id;
        return (
          <View key={request.id} style={[styles.row, { borderTopColor: colors.border }]}>
            <Text style={[styles.name, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', textAlign: align }]}>
              {request.studentName}
            </Text>
            <Text style={[styles.account, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: align }]} numberOfLines={1}>
              {t('rosterClaimedByLabel')} {linkDisplayName(request)} · {formatLinkedOn(request.requestedAt, lang)}
            </Text>
            <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Pressable
                onPress={() => void act(request, 'approve')}
                disabled={busy}
                accessibilityRole="button"
                style={[styles.btn, { backgroundColor: colors.primary, opacity: busy ? 0.5 : 1 }]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={{ color: colors.primaryForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>
                    {t('linkRequestApprove')}
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => void act(request, 'reject')}
                disabled={busy}
                accessibilityRole="button"
                style={[styles.btn, { borderColor: colors.border, borderWidth: 1, opacity: busy ? 0.5 : 1 }]}
              >
                <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>
                  {t('linkRequestReject')}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
      {error ? (
        <Text style={[styles.hint, { color: colors.destructive, fontFamily: 'Almarai_400Regular', textAlign: align }]}>{error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: SPACE.md, marginBottom: SPACE.md, gap: 6 },
  title: { fontSize: 16 },
  hint: { fontSize: 14, lineHeight: 22 },
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACE.sm, marginTop: SPACE.xs, gap: 2 },
  name: { fontSize: 15 },
  account: { fontSize: 13, lineHeight: 21 },
  actions: { gap: 8, marginTop: 8 },
  btn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
```

Before relying on `SPACE.md`/`SPACE.sm`/`SPACE.xs`: read `artifacts/mobile/constants/theme.ts` and use the real `SPACE` keys (the file's other components use `SPACE.sm`, `SPACE.lg`). `classQueryKey` is exported from `services/rosterQueryKeys.ts` (the class screen imports it as `classQueryKey as CLASS_QUERY_KEY`); confirm the name there.

- [ ] **Step 2: Put it on the Students tab**

In `artifacts/mobile/app/classes/[id]/index.tsx` add the import next to the other `@/components/classes/*` imports:

```tsx
import { LinkRequestsBanner } from '@/components/classes/LinkRequestsBanner';
```

Find the students list's header (the `ListHeaderComponent` of the students `FlatList`, which holds the maths-practice `Pressable` with `onPress={() => setShowPractice(true)}`) and add, as the **first** child of that header and guarded exactly like the key icon is (accounts exist only when the flag is on):

```tsx
              {studentAccounts && id ? <LinkRequestsBanner classId={id} /> : null}
```

(`studentAccounts` and `id` are already in scope in that component.) If the header is not a fragment/`View` that can hold an extra first child, wrap the existing header content and the banner in one `<View>` — do not change anything else about the list.

- [ ] **Step 3: Typecheck and run the mobile suite**

Run:
```bash
cd /home/user/Iqraa && pnpm run typecheck
cd artifacts/mobile && pnpm test
```
Expected: clean and green. `designScale.test.ts`, `iconSystem.test.ts` and `ariaState.test.ts` are the likely tripwires; fix the component, never the test.

- [ ] **Step 4: Commit**

```bash
git add artifacts/mobile/components/classes/LinkRequestsBanner.tsx "artifacts/mobile/app/classes/[id]/index.tsx"
git diff --cached --stat
git commit -m "feat(app): a teacher approves or rejects join requests from the class screen

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
```

---

### Task 8: Write-up, reconciliation, full verification, draft PR

**Files:**
- Modify: `docs/status-log.md` (entry at the top), `CLAUDE.md` (one "bitten before" bullet), `STATUS.md` (only if a line there stops being true), `docs/superpowers/specs/2026-10-23-roster-edit-and-claim-approval-design.md`

- [ ] **Step 1: Run what CI runs**

Run:
```bash
cd /home/user/Iqraa
pnpm run typecheck
cd artifacts/api-server && pnpm build && pnpm test
cd ../mobile && pnpm test
cd ../../lib/db && pnpm test
cd ../curriculum && pnpm test && pnpm run verify
```
Record the real pass/fail/skip counts. DB-backed and RLS suites skip without Postgres — record that. If a local Postgres is available, also run `claimApproval.db.test.ts`, `linkRequests.db.test.ts`, `rlsCoverage.test.ts` and `rlsMatrix.test.ts` with their env and record the output.

- [ ] **Step 2: Reconcile the spec with what was built**

In `docs/superpowers/specs/2026-10-23-roster-edit-and-claim-approval-design.md`, section "PR 2": replace "Table `roster_link_requests` … Classified in `rlsCoverage.test.ts`; the grant to `iqraa_app` is written by hand (none is automatic) and covered by `rlsDiff`." with "Classified `PROTECTED` in `rlsCoverage.test.ts`: RLS on, a select and a delete policy (the sender and the student's teacher), no insert or update policy, grant to `iqraa_app` written by hand, proved in `rlsMatrix.test.ts`." and replace the "Approve" bullet's "one transaction, student row locked `for update`: re-check no self link exists, insert `roster_links`, …" with "insert `roster_links` (the partial unique index `roster_links_one_self_idx` refuses a second student account, answered 409 `claim_already_linked`), then delete every request on that name; no transaction is needed because the index is the guard." Add: "An account that switched role while waiting is dropped on approval (409 `claim_request_stale`) and not listed."

- [ ] **Step 3: The status-log entry, the CLAUDE.md note**

At the **top** of `docs/status-log.md` (directly under the "Adding an entry" paragraph, above the newest `## `), add a section «Class-code claims wait for the teacher — <today's date>»: what changed (the table, the held path, the three teacher routes, the waiting card, the banner), the rules (only a student off a class code is held; per-student codes and parents link at once; up to five may wait on a name; one waiting pick per account; the sender's role is checked on approval), what was verified (the real counts from Step 1, and which DB/RLS suites ran vs skipped), what was **not** verified (anything not run in a browser; RLS policies not exercised locally if skipped; no push to the student on approval — they use "Check again"), and known limits (a teacher who never opens the Students tab leaves students waiting; a rejected student can simply ask again, which a squatter can repeat up to the cap). Write real values; no angle-bracket placeholders may remain.

In `CLAUDE.md`, under «Things that have bitten before», add one bullet:

```markdown
- **A student's class-code claim waits for the teacher (since 2026-10-23).** The
  pick is a row in `roster_link_requests`, not in `roster_links`, so nothing that
  reads a link (chat contacts, homework, exams, parent letters) can see it: an
  unapproved account has no access *by construction*. Keep it that way — do not
  add a `status` column to `roster_links`. Only a `self` claim made through the
  CLASS code is held (`claimNeedsApproval`); per-student codes and parents link at
  once. Approval is `POST /students/:id/link-requests/:requestId/approve`, which
  re-checks the sender is still a `student` account.
```

If `STATUS.md` has a line stating that a class code links a student at once, change it in this PR; otherwise leave `STATUS.md` alone (`grep -n -i "class code\|join code" STATUS.md`).

- [ ] **Step 4: Commit, push, open the PR as a DRAFT**

```bash
git add docs/status-log.md CLAUDE.md docs/superpowers/specs/2026-10-23-roster-edit-and-claim-approval-design.md
git commit -m "docs: status-log entry and notes for teacher-approved claims

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0152csNJuxcocDbDb5VNvcC8"
git push -u origin claude/happy-bohr-khh1n2
```

Open a **draft** pull request titled «Teacher approves class-code joins (PR 2 of 2)» whose body states: what changed; that it adds a table and a migration (additive, not destructive) and needs the deploy to run the migration before the new API revision takes traffic (`deploy.yml` already does this); that old app builds, which expect 201 from `/auth/claim`, would read a 202 body without `relation` as a joined class — **call out whether an app build/OTA compatible with the `202` must ship first** (the `production` OTA is manual); the real verification results; what was not verified. Subscribe to its activity and drive it to green per the repo's PR rules.

---

## Self-Review (done)

- **Spec coverage (PR 2):** table + RLS → Task 1; "only a class-code student claim is held" → Task 2 (rule) + Task 3 (write path); several waiting per name, cap 5, one pick per account → Task 3; applicant sees a waiting screen, can re-check and change name → Tasks 5–6; approve/reject/list → Task 4; teacher banner → Task 7; waiting account has no access → Task 3's HTTP test (`/auth/me`, `/messaging/contacts`) plus the structural fact that no `roster_links` row exists; role switched while waiting → Task 4. Reconciled differences from the spec are written into Task 8 Step 2.
- **Placeholders:** none in code steps. Task 5 Step 6 and Task 8 Step 3 tell the executor to find a named anchor (`grep` given) or write real values; Task 6 Step 2.5 and Task 7 Step 2 instruct a verbatim move/insert of existing JSX because retyping a 40-line existing block would invite drift.
- **Type consistency:** `ClaimResult` (Task 5) is what `claim-required.tsx`/`join-class.tsx` branch on (Task 6); `PendingClaim` = the server's `GET /auth/claim` `pending` items (Task 3); `LinkRequest` fields match the `GET /classes/:id/link-requests` select (Task 4); `claim_pending_limit` is spelled the same in the server table (Task 3) and `CLAIM_ERROR_KEYS` (Task 5); the approve response and 409 codes match what `LinkRequestsBanner` reads (Tasks 4, 7).
- **Known risks called out for the executor:** DB/RLS suites cannot run without Postgres here; the migration's appended RLS is only proven by CI's `row-level security` job; the 202 on `/auth/claim` is a contract change for installed app builds (Task 8 Step 4).
