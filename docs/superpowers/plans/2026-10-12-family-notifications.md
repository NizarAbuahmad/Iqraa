# Notifications (Part 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Read first: one migration, and where this plan departs from the controller's decisions.**

- **One migration, additive, and nothing else needs one.** `0008_*` adds `users.push_prefs jsonb NOT NULL DEFAULT '{}'` and the table `homework_reminders`. Everything else reads data that already exists: `roster_links`, `class_memberships`, `homework_completions`, `evaluations.exam_date` / `exam_time`, `attempt_results.is_provisional` and `device_push_tokens`. The app creates its Android channels at runtime from JS (`ensureNotificationChannels`, called from `app/(tabs)/_layout.tsx`), so the new channels ship by OTA. **No native module is added, and `app.json` `version` must not change.** Only Task 1 touches `lib/db`. An implementer who finds another task needs a schema change must stop and report.
- **D1 is kept: the switches live in a jsonb column on `users`.** `users` already has one row per account. `{}` means "all on" with no backfill, an empty object can never fall out of step the way a second table's missing row can, and a future category needs no migration. Two switches flipped together merge in SQL (`push_prefs || $patch`), so neither overwrites the other. `authMiddleware` selects named columns, so the hot per-request read does not grow. The jsonb `NOT NULL DEFAULT` add does not match CI's destructive patterns (`SET NOT NULL` is a separate statement), so the PR needs no `destructive-migration` flag.
- **Quiet hours, changed: `sound: null` alone silences nothing on Android.** Android is the only app that ships (iOS has not been built, per STATUS.md «iOS is untouched»), and since Android 8 sound belongs to the channel a notification lands in, not to the message. So between 22:00 and 07:00 Amman the shared sender sends to a new silent channel, `quiet` (importance LOW: listed in the shade, with no sound and no vibration), **and** sets `sound: null`, which is what iOS reads. The trade-off: someone who muted «الواجبات» in Android's own settings still sees a night-time homework push under «ليلًا (بلا صوت)». The in-app switches are the real opt-out. Quiet hours cover this part's family pushes (homework, exam dates and results, the release announcement included). Chat and admin pushes do not change.
- **D1's route placement is `GET|PUT /auth/me/push-preferences`, in `routes/auth.ts`.** That file is where account routes live, next to `/me` and `/me/ai-usage`. Each route carries `authMiddleware` itself, because the auth router also has public routes and so cannot take a prefix guard.
- **D3, pruning dead tokens.** The release announcement is rewritten onto the shared sender, so its copy of the prune goes away. `routes/messaging.ts` (`pruneDeadTokens`, one helper shared by two call sites) and `lib/adminNotify.ts` keep their own. They are outside this part's path, and changing them is not trivially safe.
- **D7: the publish announcement is built but is not race-safe.** Two publishes of one dated draft that run at the same moment can both announce. The publish write sits inside a share-code retry loop that a conditional write would break. This is listed as a known gap. The PATCH announcement is race-safe.
- **Feature flag.** Homework, exam-date and reminder pushes are skipped while `STUDENT_ACCOUNTS` is off, because the School tab answers 403 then. Results pushes keep today's behaviour either way.
- **Copy.** A guardian's push puts the child's name first («سارة: واجب جديد»), so no verb or preposition has to agree with a name. Arabic verbs agree with the child's gender, and `students.gender` is often `''`.
- **Test seam.** `startServer` now defaults `EXPO_PUSH_URL` to a closed local port and `PUSH_QUIET_HOURS` to `off`, so no DB test can reach Expo and no assertion depends on the time of day.

**Goal:** Students and their guardians get a push when homework is posted, the day before homework is due and not done, when an exam's date is set or changed, and when a result reaches them, including a paper mark typed after the release. Each category can be switched off in Settings, and pushes at night arrive silently.

**Architecture:** API first. Pure rules go in `artifacts/api-server/src/modules/notifications/` and are unit-tested: the switches, quiet hours, recipient selection and message building, the Arabic texts, the exam-date decision and the reminder window. One shared sender (`lib/familyPush.ts`) takes accounts already resolved by `lib/familyAccess.ts` (roster rows to accounts), drops suspended accounts and switched-off categories, builds one message per device, sends through `sendExpoPush` and prunes dead tokens. The three teacher actions await their push before the response, capped at 4 s by `lib/pushWithin.ts`. The reminder is `POST /internal/homework-reminders`, guarded by a shared key and made idempotent by `homework_reminders`. DB tests run the built server against an in-process Expo stub and assert who was pushed and, just as important, who was not. On mobile: two new channels plus a silent one, `school` as a tap target, and three switches in Settings.

**Tech Stack:** Express + Drizzle (Postgres) in `artifacts/api-server`, `lib/db` migrations, the DB test harness (`src/test-support/`), Expo push HTTP API, Expo / React Native (RTL, Arabic-first) in `artifacts/mobile`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-11-family-school-views-design.md`. This plan implements section «4. Notifications» together with the Part 4 notes at the end of sections 2–3, «Testing» and «Risks». Task 12 rewrites section 4 as built.

## Global Constraints

- Branch `claude/brave-einstein-qxpxc3`, draft PR #1007. **Implementers commit only. Never push, never edit the PR.** The controller pushes.
- The only schema change is Task 1's: edit `lib/db/src/schema`, run `pnpm --filter @workspace/db run generate`, commit `lib/db/migrations/`. Additive only. Never `push`.
- Every guard is path-scoped. Never write a bare `router.use(mw)`. The internal route's guard lives inside its handler.
- **Do not touch `.github/workflows/deploy.yml`.** A `--update-secrets` / `--set-secrets` ref to a secret that does not exist yet fails every Cloud Run deploy. The code reads `process.env.INTERNAL_CRON_KEY` and answers 404 until someone attaches it by hand (Task 12 documents the steps). `deploy.yml`'s `--update-env-vars` keeps a manually attached secret across deploys.
- Files loaded by `node --test` need explicit `.ts` extensions in relative imports. New api-server files use `.ts` (as `lib/familyAccess.ts` does). A unit-tested file must not import `@workspace/db`, though type-only imports are fine.
- DB behaviour is tested through the harness: `describeDb`, a raw-SQL seed, the built bundle. Run api-server tests **after** `pnpm build`. Every DB test that expects silence must also be able to go red (see each task's mutation proofs).
- **The school day is Asia/Amman, a fixed UTC+3.** A homework day is `dueAtToDueDate(dueAt)`. An exam day is the text `exam_date` (`YYYY-MM-DD`, no zone). Format it with string slicing; **never** `new Date(examDate)` or `toISOString()` an exam day.
- Push copy is **Arabic only**, like every existing push: it goes out with no request to read a locale from. Titles are ≤ 50 code points (`TITLE_MAX`). Dates and times go inside a left-to-right isolate (`⁦…⁩`), the way the app's `formatDueDate` does.
- `PUSH_CHANNEL` in `lib/pushNotifications.ts` stays a **flat literal of string values**. The mobile test `pushPolicy.test.ts` regex-reads it and fails unless the app creates every id.
- Teacher-triggered pushes (homework posted, exam date, paper marks) are **awaited before the response, through `pushWithin`** (4 s cap, never throws). The release announcement stays fire-and-forget, as it is today.
- Chat messages are not governed by the switches or by quiet hours.
- Mobile: tests only run from `artifacts/mobile/services/__tests__/` and cannot import `react-native` / `expo-*` / `apiClient.ts`, so fetchers stay in their own file. Design ratchets (`designScale.test.ts`): take spacing and type from `SPACE` / `TYPE`. Toggles use `aria-checked`, never `accessibilityState` (`ariaState.test.ts`). Every new i18n key goes in both `ar` and `en` (`i18n.test.ts`). Keep hook order fixed: new hooks go at the top of the component, never inside a conditional branch.
- No native module and no `app.json` `version` bump (see the top of this plan).
- Commit trailers follow the session attribution reminder. Do not name a model in code, comments or docs.

**Commands used throughout** (from the repo root):

```bash
# api-server unit test (one file)
(cd artifacts/api-server && node --experimental-strip-types --test <path-under-artifacts/api-server>)
# api-server DB test (one file) — needs the throwaway Postgres from LOCAL_SETUP.md «DB-backed API tests»
(cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres node --experimental-strip-types --test <path>)
# mobile test (one file)
(cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test <path-under-artifacts/mobile>)
```

## File Structure

| Path | Responsibility |
| --- | --- |
| `lib/db/src/schema/users.ts` | `push_prefs` column |
| `lib/db/src/schema/homework.ts` | `homework_reminders` table |
| `lib/db/migrations/0008_*.sql` + meta (generated) | the additive migration |
| `artifacts/api-server/src/modules/notifications/pushPrefs.ts` (new) | categories, reading/merging switches (pure) |
| `…/modules/notifications/quietHours.ts` (new) | `isQuietHour`, `familyDelivery` (pure) |
| `…/modules/notifications/familyPushText.ts` (new) | Arabic texts, `clip`, `pushDay` (pure) |
| `…/modules/notifications/familyPush.ts` (new) | `selectRecipients`, `familyMessages` (pure) |
| `…/modules/notifications/examDateNotice.ts` (new) | when an exam-date push is due, and of what kind (pure) |
| `…/modules/notifications/reminders.ts` (new) | the "due tomorrow" window, who is reminded (pure) |
| `artifacts/api-server/src/lib/pushNotifications.ts` | `sound`, `EXPO_PUSH_URL`, channels `homework`/`exams`/`quiet` |
| `artifacts/api-server/src/lib/pushWithin.ts` (new) | await work with a cap, never throw |
| `artifacts/api-server/src/lib/familyAccess.ts` | `accountsLinkedTo`, `liveClassStudentIds` |
| `artifacts/api-server/src/lib/familyPush.ts` (new) | `sendFamilyPush`, the one family sender |
| `artifacts/api-server/src/lib/resultsReleaseNotify.ts` | onto the shared sender; `finalResultStudentIds` |
| `artifacts/api-server/src/lib/familyPushEvents.ts` (new) | homework posted, exam date, paper results |
| `artifacts/api-server/src/lib/homeworkReminders.ts` (new) | `runHomeworkReminders` |
| `artifacts/api-server/src/routes/auth.ts` | `GET|PUT /auth/me/push-preferences` |
| `artifacts/api-server/src/routes/homework.ts` | push on `POST /homework` |
| `artifacts/api-server/src/routes/evaluations.ts` | push on PATCH (race-safe), publish, paper-totals |
| `artifacts/api-server/src/routes/internal.ts` (new) + `routes/index.ts` | `POST /internal/homework-reminders` |
| `artifacts/api-server/src/modules/homework/rules.ts` | export `addDays` |
| `artifacts/api-server/src/test-support/pushStub.ts` (new) | in-process Expo stand-in |
| `artifacts/api-server/src/test-support/seedPush.ts` (new) | device tokens, a suspended guardian, reminder homework, helpers |
| `artifacts/api-server/src/test-support/startServer.ts` | safe defaults for `EXPO_PUSH_URL`, `PUSH_QUIET_HOURS` |
| `artifacts/api-server/src/routes/__tests__/*.db.test.ts` (new ×6) | pushPreferences, resultsPush, homeworkPush, examDatePush, paperTotalsPush, homeworkReminders |
| `artifacts/mobile/services/pushPolicy.ts`, `services/pushTokens.ts` | channels `homework`, `exams`, `quiet` |
| `artifacts/mobile/services/notificationDeepLink.ts` | `school` → `/school` |
| `artifacts/mobile/services/pushPrefs.ts` (new), `services/pushPrefsApi.ts` (new) | switch logic and fetchers |
| `artifacts/mobile/services/i18n.ts` | keys, ar + en; the permission prompt copy |
| `artifacts/mobile/app/settings.tsx` | three switches for parents and students |
| `STATUS.md`, spec, `docs/deploying.md`, `CLAUDE.md` | Task 12 |

---

### Task 1: Schema, migration, and the switch rules

**Files:**
- Modify: `lib/db/src/schema/users.ts`, `lib/db/src/schema/homework.ts`
- Generate: `lib/db/migrations/0008_*.sql`, `lib/db/migrations/meta/0008_snapshot.json`, `lib/db/migrations/meta/_journal.json`
- Create: `artifacts/api-server/src/modules/notifications/pushPrefs.ts`
- Test: `artifacts/api-server/src/modules/notifications/__tests__/pushPrefs.test.ts`

**Interfaces:**
- Produces (`@workspace/db`): `users.pushPrefs` (`Partial<Record<"homework" | "exams" | "results", boolean>>`, default `{}`); table `homeworkReminders` (`id`, `homeworkId`, `dueDate` text, `sentAt`; unique `homework_reminders_unique` on (`homeworkId`, `dueDate`)); type `HomeworkReminder`.
- Produces (`modules/notifications/pushPrefs.ts`):
  - `const PUSH_CATEGORIES: readonly ["homework", "exams", "results"]`; `type PushCategory`; `type PushPrefs = Record<PushCategory, boolean>`; `type PushPrefsPatch = Partial<PushPrefs>`
  - `readPushPrefs(stored: unknown): PushPrefs`: only an explicit `false` turns a switch off
  - `allowsPush(stored: unknown, category: PushCategory): boolean`
  - `parsePushPrefsPatch(body: unknown): { ok: true; value: PushPrefsPatch } | { ok: false; error: string }`

- [ ] **Step 1: Write the failing test** (`pushPrefs.test.ts`):

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { allowsPush, parsePushPrefsPatch, PUSH_CATEGORIES, readPushPrefs } from "../pushPrefs.ts";

describe("readPushPrefs", () => {
  it("reads an account that never chose as all on", () => {
    assert.deepEqual(readPushPrefs({}), { homework: true, exams: true, results: true });
    assert.deepEqual(readPushPrefs(null), { homework: true, exams: true, results: true });
    assert.deepEqual(readPushPrefs([false]), { homework: true, exams: true, results: true });
  });
  it("turns a switch off only for an explicit false", () => {
    assert.deepEqual(readPushPrefs({ homework: false }), { homework: false, exams: true, results: true });
    // Opt-outs: anything that is not `false` leaves the push on.
    assert.deepEqual(readPushPrefs({ exams: "false", results: 0 }), { homework: true, exams: true, results: true });
  });
  it("ignores keys it does not know", () => {
    assert.deepEqual(readPushPrefs({ chat: false }), { homework: true, exams: true, results: true });
  });
});

describe("allowsPush", () => {
  it("answers per category", () => {
    assert.equal(allowsPush({ results: false }, "results"), false);
    assert.equal(allowsPush({ results: false }, "homework"), true);
  });
});

describe("parsePushPrefsPatch", () => {
  it("takes any subset of the three switches", () => {
    assert.deepEqual(parsePushPrefsPatch({ homework: false }), { ok: true, value: { homework: false } });
    assert.deepEqual(parsePushPrefsPatch({ exams: true, results: false }), { ok: true, value: { exams: true, results: false } });
  });
  it("drops keys it does not own", () => {
    assert.deepEqual(parsePushPrefsPatch({ homework: true, chat: false }), { ok: true, value: { homework: true } });
  });
  it("refuses a switch that is not true or false", () => {
    assert.equal(parsePushPrefsPatch({ homework: "off" }).ok, false);
    assert.equal(parsePushPrefsPatch({ homework: null }).ok, false);
  });
  it("refuses a body that changes nothing", () => {
    for (const body of [{}, { chat: false }, null, [], "homework", 1]) {
      assert.equal(parsePushPrefsPatch(body).ok, false, JSON.stringify(body));
    }
  });
  it("names exactly three categories", () => {
    assert.deepEqual([...PUSH_CATEGORIES], ["homework", "exams", "results"]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** `(cd artifacts/api-server && node --experimental-strip-types --test src/modules/notifications/__tests__/pushPrefs.test.ts)` should FAIL with the module not found.

- [ ] **Step 3: Implement `pushPrefs.ts`:**

```ts
/**
 * An account's school-notification switches (spec Part 4): `homework` (posted,
 * and the reminder the day before), `exams` (a date set, changed or cleared)
 * and `results` (released, or a paper mark typed after the release). Chat
 * messages are not governed here.
 *
 * Opt-outs: stored in `users.push_prefs` as only the choices made, so `{}` —
 * every account before this existed — is all on, and only an explicit `false`
 * turns one off. A malformed value reads as on: the failure mode of a bad
 * value is "one push too many", never a family silently cut off.
 */
export const PUSH_CATEGORIES = ["homework", "exams", "results"] as const;
export type PushCategory = (typeof PUSH_CATEGORIES)[number];
export type PushPrefs = Record<PushCategory, boolean>;
export type PushPrefsPatch = Partial<PushPrefs>;

export function readPushPrefs(stored: unknown): PushPrefs {
  const o = stored && typeof stored === "object" && !Array.isArray(stored) ? (stored as Record<string, unknown>) : {};
  return { homework: o.homework !== false, exams: o.exams !== false, results: o.results !== false };
}

export function allowsPush(stored: unknown, category: PushCategory): boolean {
  return readPushPrefs(stored)[category];
}

/** The body of `PUT /auth/me/push-preferences`: one or more known switches, each true or false. */
export function parsePushPrefsPatch(body: unknown): { ok: true; value: PushPrefsPatch } | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Send an object of switches: homework, exams, results" };
  }
  const b = body as Record<string, unknown>;
  const value: PushPrefsPatch = {};
  for (const c of PUSH_CATEGORIES) {
    if (b[c] === undefined) continue;
    if (typeof b[c] !== "boolean") return { ok: false, error: `${c} must be true or false` };
    value[c] = b[c] as boolean;
  }
  if (Object.keys(value).length === 0) return { ok: false, error: "Nothing to change: send homework, exams or results" };
  return { ok: true, value };
}
```

- [ ] **Step 4: Run the test again and confirm it passes.** Same command.

- [ ] **Step 5: Schema.** In `lib/db/src/schema/users.ts`, add after `schoolId` (before `createdAt`):

```ts
  /**
   * Which school notifications this account wants — `homework` (posted, and
   * the reminder the day before), `exams` (a date set or changed), `results`
   * (released, or a mark typed after the release). Opt-outs: a missing key is
   * ON, so `{}` — every account made before 2026-10-12 — gets all three, and
   * only `false` turns one off. Chat is not governed here. Read through
   * api-server `modules/notifications/pushPrefs.ts`; written only by
   * `PUT /auth/me/push-preferences`, which merges with `||` in SQL.
   */
  pushPrefs: jsonb("push_prefs").$type<Partial<Record<"homework" | "exams" | "results", boolean>>>().notNull().default({}),
```

In `lib/db/src/schema/homework.ts`, append:

```ts
/**
 * One row per homework per due day that a reminder went out for — the
 * at-most-once record behind `POST /internal/homework-reminders`. The run
 * CLAIMS a row (insert … on conflict do nothing) before sending, and skips a
 * homework it could not claim, so a second run the same day, a scheduler
 * retry or two overlapping runs send nothing twice. Keyed by the due day too:
 * a homework whose due date moves is reminded again for its new day. The price
 * of claiming first, accepted: a send that fails after the claim is not retried.
 */
export const homeworkReminders = pgTable(
  "homework_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    homeworkId: uuid("homework_id")
      .notNull()
      .references(() => homework.id, { onDelete: "cascade" }),
    /** The Amman calendar day the homework was due on when reminded, `YYYY-MM-DD`. */
    dueDate: text("due_date").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [unique("homework_reminders_unique").on(t.homeworkId, t.dueDate)],
);

export type HomeworkReminder = typeof homeworkReminders.$inferSelect;
```

- [ ] **Step 6: Generate the migration.** Run `pnpm --filter @workspace/db run generate`. Read the new `lib/db/migrations/0008_*.sql`. It must contain only: `CREATE TABLE "homework_reminders"` (with `CONSTRAINT "homework_reminders_unique" UNIQUE("homework_id","due_date")`), `ALTER TABLE "users" ADD COLUMN "push_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL`, and one `FOREIGN KEY … ON DELETE cascade`. No `DROP`, `RENAME`, `SET NOT NULL` or `SET DATA TYPE`.

- [ ] **Step 7: Prove it applies to an empty database.** Run `(cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres node --experimental-strip-types --test src/test-support/__tests__/harness.db.test.ts)`. That suite migrates a fresh database, so it PASSES only if `0008` applies. Then `pnpm run typecheck` at the root should be clean.

- [ ] **Step 8: Commit**

```bash
git add lib/db/src/schema/users.ts lib/db/src/schema/homework.ts lib/db/migrations artifacts/api-server/src/modules/notifications
git commit -m "feat(db): push switches on users and a homework_reminders claim table; the switch rules"
```

---

### Task 2: `GET|PUT /auth/me/push-preferences`

**Files:**
- Modify: `artifacts/api-server/src/routes/auth.ts`
- Modify: `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`
- Test: `artifacts/api-server/src/routes/__tests__/pushPreferences.db.test.ts`

**Interfaces:**
- Consumes: Task 1's `readPushPrefs`, `parsePushPrefsPatch`, `users.pushPrefs`.
- Produces (HTTP, any signed-in role):
  - `GET /auth/me/push-preferences` returns `200 { preferences: { homework: boolean, exams: boolean, results: boolean } }`.
  - `PUT /auth/me/push-preferences` takes `{ homework?, exams?, results? }` (booleans, at least one) and returns `200 { preferences }`. It answers `400 { error, code: "invalid_input" }` for a bad body and `401` without a token. Stored as a merge: only the keys sent change.

- [ ] **Step 1: Write the failing DB test** (`pushPreferences.db.test.ts`):

```ts
/**
 * What this guards: an account's three school-notification switches. The ways
 * it goes wrong: a fresh account reading as "off", one switch overwriting
 * another, a garbage value being stored, and one account's choice touching
 * another's. Any role may hold them (a teacher simply receives none of these).
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

const PATH = "/auth/me/push-preferences";
const ALL_ON = { homework: true, exams: true, results: true };

describeDb("push preferences over HTTP, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let w: FamilyWorld;
  const stored = async (userId: string) =>
    (await db.pool.query<{ p: unknown }>(`SELECT push_prefs AS p FROM users WHERE id = $1`, [userId])).rows[0]?.p;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    server = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  it("reads every switch as on for an account that never chose", async () => {
    const r = await call(server, "GET", PATH, w.users.parentA);
    assert.equal(r.status, 200, server.logs().slice(-1500));
    assert.deepEqual(r.json, { preferences: ALL_ON });
  });

  it("turns one switch off, keeps the others, and stores only the choice", async () => {
    const r = await call(server, "PUT", PATH, w.users.parentA, { homework: false });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json, { preferences: { ...ALL_ON, homework: false } });
    assert.deepEqual(await stored(w.users.parentA), { homework: false });
    assert.deepEqual((await call(server, "GET", PATH, w.users.parentA)).json, { preferences: { ...ALL_ON, homework: false } });
  });

  it("merges a second change instead of overwriting the first", async () => {
    const r = await call(server, "PUT", PATH, w.users.parentA, { results: false });
    assert.deepEqual(r.json, { preferences: { homework: false, exams: true, results: false } });
    assert.deepEqual(await stored(w.users.parentA), { homework: false, results: false });
  });

  it("turns a switch back on", async () => {
    const r = await call(server, "PUT", PATH, w.users.parentA, { homework: true });
    assert.deepEqual(r.json, { preferences: { homework: true, exams: true, results: false } });
  });

  it("works for a student and a teacher too, and never touches another account", async () => {
    assert.equal((await call(server, "PUT", PATH, w.users.studentA, { exams: false })).status, 200);
    assert.deepEqual((await call(server, "GET", PATH, w.users.t1)).json, { preferences: ALL_ON });
    assert.deepEqual((await call(server, "GET", PATH, w.users.parentB)).json, { preferences: ALL_ON });
    assert.deepEqual(await stored(w.users.parentB), {});
  });

  it("refuses a body that changes nothing or is not true/false, and stores nothing", async () => {
    const before = await stored(w.users.parentB);
    for (const body of [{}, { homework: "off" }, { chat: false }, []]) {
      const r = await call(server, "PUT", PATH, w.users.parentB, body);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(r.json.code, "invalid_input");
    }
    assert.deepEqual(await stored(w.users.parentB), before);
  });

  it("needs a token", async () => {
    assert.equal((await call(server, "GET", PATH)).status, 401);
    assert.equal((await call(server, "PUT", PATH, undefined, { homework: false })).status, 401);
  });
});
```

Add to `mountOrder.test.ts`, after the «mounts the account-type switch behind a token» case:

```ts
  it("guards the notification switches — signed-in only, any role", async () => {
    // Account-level, under /auth beside /me. A 404 would mean the routes were
    // never mounted; a 200 that anyone could read or flip them.
    const get = await fetch(`${base}/auth/me/push-preferences`);
    assert.equal(get.status, 401, "reading the switches must require a token");
    const put = await fetch(`${base}/auth/me/push-preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homework: false }),
    });
    assert.equal(put.status, 401, "changing the switches must require a token");
  });
```

- [ ] **Step 2: Run both and confirm they fail.** Run the DB test command on `src/routes/__tests__/pushPreferences.db.test.ts`, then `(cd artifacts/api-server && node --experimental-strip-types --test src/routes/__tests__/mountOrder.test.ts)` after the build. Both should FAIL with 404s, because the routes do not exist yet.

- [ ] **Step 3: Implement in `routes/auth.ts`.** Add the import `import { parsePushPrefsPatch, readPushPrefs } from "../modules/notifications/pushPrefs.ts";` and, right after the `GET /me/ai-usage` handler:

```ts
// GET|PUT /auth/me/push-preferences — the account's school-notification
// switches (homework, exam dates, results). Any signed-in role: only parents
// and students are sent these pushes, but a switch is harmless on a teacher.
// Chat is not governed by them. See modules/notifications/pushPrefs.ts.
router.get("/me/push-preferences", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const [row] = await db.select({ pushPrefs: users.pushPrefs }).from(users).where(eq(users.id, req.user!.id)).limit(1);
    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ preferences: readPushPrefs(row.pushPrefs) });
  } catch (err) {
    logger.error({ err }, "read push preferences failed");
    res.status(500).json({ error: "Failed to read notification settings" });
  }
});

router.put("/me/push-preferences", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const parsed = parsePushPrefsPatch(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error, code: "invalid_input" });
    return;
  }
  try {
    // Merged in SQL, not read-modify-write: two switches flipped at once from
    // two devices must not overwrite each other.
    const [row] = await db
      .update(users)
      .set({ pushPrefs: sql`${users.pushPrefs} || ${JSON.stringify(parsed.value)}::jsonb` })
      .where(eq(users.id, req.user!.id))
      .returning({ pushPrefs: users.pushPrefs });
    if (!row) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({ preferences: readPushPrefs(row.pushPrefs) });
  } catch (err) {
    logger.error({ err }, "save push preferences failed");
    res.status(500).json({ error: "Failed to save notification settings" });
  }
});
```

- [ ] **Step 4: Run both again and confirm they pass.** Then `pnpm run typecheck`.

- [ ] **Step 5: Mutation proof** (report each, then revert it): (a) replace the `||` merge with `${JSON.stringify(parsed.value)}::jsonb`, and "merges a second change" should go red; (b) delete the `if (!parsed.ok)` block, and "refuses a body…" should go red; (c) drop `authMiddleware` from the PUT, and the mountOrder case should go red.

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src/routes
git commit -m "feat(api): GET|PUT /auth/me/push-preferences — three school-notification switches per account"
```

---

### Task 3: The push layer: `sound`, a test seam, new channels, quiet hours, `pushWithin`

**Files:**
- Modify: `artifacts/api-server/src/lib/pushNotifications.ts`
- Create: `artifacts/api-server/src/modules/notifications/quietHours.ts`, `artifacts/api-server/src/lib/pushWithin.ts`
- Modify: `artifacts/mobile/services/pushPolicy.ts`, `artifacts/mobile/services/pushTokens.ts`
- Test: `artifacts/api-server/src/lib/__tests__/pushNotifications.test.ts` (extend), `artifacts/api-server/src/modules/notifications/__tests__/quietHours.test.ts`, `artifacts/api-server/src/lib/__tests__/pushWithin.test.ts`, `artifacts/mobile/services/__tests__/pushPolicy.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1's `PushCategory`.
- Produces:
  - `PUSH_CHANNEL = { messages, results, admin, homework: "homework", exams: "exams", quiet: "quiet" }` (a flat literal).
  - `ExpoPushMessage.sound?: "default" | null`.
  - `sendExpoPush` posts to `process.env.EXPO_PUSH_URL` when that is set, read on each call; otherwise to Expo.
  - `quietHours.ts`: `QUIET_FROM_HOUR = 22`, `QUIET_UNTIL_HOUR = 7`, `ammanHour(now: Date): number`, `isQuietHour(now: Date): boolean`, `quietHoursEnabled(env?: Record<string, string | undefined>): boolean` (false only for `PUSH_QUIET_HOURS=off`), `interface Delivery { channelId: PushCategory | "quiet"; sound: "default" | null }`, `familyDelivery(category: PushCategory, now: Date, quietOn: boolean): Delivery`.
  - `pushWithin.ts`: `FAMILY_PUSH_WAIT_MS = 4000`, `pushWithin(label: string, work: () => Promise<unknown>, ms?: number): Promise<void>`. It never rejects, and it stops waiting at `ms` without cancelling the work.
  - Mobile: `PushChannelId` gains `'homework' | 'exams' | 'quiet'`; `PushChannel.importance` gains `'low'`.

- [ ] **Step 1: Write the failing tests.**

`quietHours.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ammanHour, familyDelivery, isQuietHour, quietHoursEnabled } from "../quietHours.ts";

describe("isQuietHour (22:00–07:00 Asia/Amman, a fixed UTC+3)", () => {
  it("starts at 22:00 Amman", () => {
    assert.equal(isQuietHour(new Date("2026-10-14T18:59:59Z")), false); // 21:59:59
    assert.equal(isQuietHour(new Date("2026-10-14T19:00:00Z")), true); // 22:00
  });
  it("runs through midnight and ends at 07:00 Amman", () => {
    assert.equal(isQuietHour(new Date("2026-10-14T21:30:00Z")), true); // 00:30 the next day
    assert.equal(isQuietHour(new Date("2026-10-15T03:59:59Z")), true); // 06:59:59
    assert.equal(isQuietHour(new Date("2026-10-15T04:00:00Z")), false); // 07:00
  });
  it("reads the Amman hour, not the server's", () => {
    assert.equal(ammanHour(new Date("2026-10-14T22:00:00Z")), 1);
  });
});

describe("familyDelivery", () => {
  const night = new Date("2026-10-14T20:00:00Z");
  const day = new Date("2026-10-14T09:00:00Z");
  it("rings on the category's own channel by day", () => {
    assert.deepEqual(familyDelivery("homework", day, true), { channelId: "homework", sound: "default" });
    assert.deepEqual(familyDelivery("results", day, true), { channelId: "results", sound: "default" });
  });
  it("goes to the silent channel with no sound at night", () => {
    assert.deepEqual(familyDelivery("exams", night, true), { channelId: "quiet", sound: null });
  });
  it("ignores the night when quiet hours are switched off", () => {
    assert.deepEqual(familyDelivery("exams", night, false), { channelId: "exams", sound: "default" });
  });
});

describe("quietHoursEnabled", () => {
  it("is on unless PUSH_QUIET_HOURS=off", () => {
    assert.equal(quietHoursEnabled({}), true);
    assert.equal(quietHoursEnabled({ PUSH_QUIET_HOURS: "on" }), true);
    assert.equal(quietHoursEnabled({ PUSH_QUIET_HOURS: "off" }), false);
  });
});
```

`pushWithin.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { pushWithin } from "../pushWithin.ts";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

test("waits for work that finishes inside the cap", async () => {
  let done = false;
  await pushWithin("t", async () => {
    await sleep(20);
    done = true;
  }, 500);
  assert.equal(done, true);
});

test("stops waiting at the cap, without cancelling the work", async () => {
  let done = false;
  const started = Date.now();
  await pushWithin("t", async () => {
    await sleep(300);
    done = true;
  }, 50);
  assert.ok(Date.now() - started < 250, "returned at the cap");
  assert.equal(done, false);
  await sleep(350);
  assert.equal(done, true, "the work kept running");
});

test("never throws, whether the work rejects or throws synchronously", async () => {
  await pushWithin("t", async () => {
    throw new Error("boom");
  }, 100);
  await pushWithin("t", () => {
    throw new Error("sync boom");
  }, 100);
});

test("a failure after the cap is not an unhandled rejection", async () => {
  // node:test fails the file on an unhandled rejection, so this test is the assertion.
  await pushWithin("t", async () => {
    await sleep(50);
    throw new Error("late");
  }, 10);
  await sleep(100);
});
```

Append to `lib/__tests__/pushNotifications.test.ts`:

```ts
test("sendExpoPush passes sound through, null included", async () => {
  let sent: unknown[] = [];
  globalThis.fetch = mock.fn(async (_url: string, init: RequestInit) => {
    sent = JSON.parse(init.body as string) as unknown[];
    return jsonResponse(200, { data: sent.map(() => ({ status: "ok" })) });
  }) as unknown as typeof fetch;

  await sendExpoPush([
    { to: "ExponentPushToken[aaa]", title: "t", body: "b", channelId: PUSH_CHANNEL.homework, sound: "default" },
    { to: "ExponentPushToken[bbb]", title: "t", body: "b", channelId: PUSH_CHANNEL.quiet, sound: null },
  ]);

  assert.deepEqual(sent, [
    { to: "ExponentPushToken[aaa]", title: "t", body: "b", channelId: "homework", sound: "default" },
    { to: "ExponentPushToken[bbb]", title: "t", body: "b", channelId: "quiet", sound: null },
  ]);
});

test("sendExpoPush posts to EXPO_PUSH_URL when it is set, and to Expo otherwise", async () => {
  const urls: string[] = [];
  globalThis.fetch = mock.fn(async (url: string, init: RequestInit) => {
    urls.push(String(url));
    const sent = JSON.parse(init.body as string) as unknown[];
    return jsonResponse(200, { data: sent.map(() => ({ status: "ok" })) });
  }) as unknown as typeof fetch;
  const saved = process.env.EXPO_PUSH_URL;
  try {
    delete process.env.EXPO_PUSH_URL;
    await sendExpoPush([{ to: "ExponentPushToken[a]", title: "t", body: "b" }]);
    process.env.EXPO_PUSH_URL = "http://127.0.0.1:9/stub";
    await sendExpoPush([{ to: "ExponentPushToken[a]", title: "t", body: "b" }]);
  } finally {
    if (saved === undefined) delete process.env.EXPO_PUSH_URL;
    else process.env.EXPO_PUSH_URL = saved;
  }
  assert.deepEqual(urls, ["https://exp.host/--/api/v2/push/send", "http://127.0.0.1:9/stub"]);
});
```

Append to the `describe('notification channels', …)` block of `artifacts/mobile/services/__tests__/pushPolicy.test.ts`:

```ts
  it('creates a homework and an exams channel for families', () => {
    for (const id of ['homework', 'exams'] as const) {
      const c = PUSH_CHANNELS.find(ch => ch.id === id);
      assert.ok(c, id);
      assert.equal(c.adminOnly, undefined);
    }
  });

  // Quiet hours (22:00–07:00 Amman) send to this channel: on Android the sound
  // is the channel's, not the message's, so this one must be silent.
  it('has a silent night channel that every account gets', () => {
    const quiet = PUSH_CHANNELS.find(c => c.id === 'quiet');
    assert.ok(quiet);
    assert.equal(quiet.importance, 'low');
    assert.ok(channelsFor(false).some(c => c.id === 'quiet'));
  });
```

- [ ] **Step 2: Run them and confirm they fail.** Run the api-server unit command on `src/modules/notifications/__tests__/quietHours.test.ts`, `src/lib/__tests__/pushWithin.test.ts` and `src/lib/__tests__/pushNotifications.test.ts`. Expect FAIL: modules missing, `PUSH_CHANNEL.homework` undefined, and a URL mismatch. Run the mobile command on `services/__tests__/pushPolicy.test.ts`; it should FAIL with no `homework` channel.

- [ ] **Step 3: Implement `quietHours.ts`:**

```ts
/**
 * Quiet hours for family pushes: 22:00–07:00 Asia/Amman (a fixed UTC+3 since
 * Jordan dropped DST in 2022). A push in that window is still sent — a teacher
 * who posts homework at 23:00 is not delayed — but silently.
 *
 * Silently means the `quiet` channel, not only `sound: null`: on Android 8+
 * the sound belongs to the channel a notification lands in, and the message's
 * own `sound` is ignored. `sound: null` is kept for iOS, which reads it.
 * `PUSH_QUIET_HOURS=off` disables the window (the DB tests set it, so no
 * assertion depends on the time of day).
 */
import type { PushCategory } from "./pushPrefs.ts";

export const QUIET_FROM_HOUR = 22;
export const QUIET_UNTIL_HOUR = 7;
const AMMAN_OFFSET_HOURS = 3;

export function ammanHour(now: Date): number {
  return (now.getUTCHours() + AMMAN_OFFSET_HOURS) % 24;
}

export function isQuietHour(now: Date): boolean {
  const h = ammanHour(now);
  return h >= QUIET_FROM_HOUR || h < QUIET_UNTIL_HOUR;
}

export function quietHoursEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PUSH_QUIET_HOURS !== "off";
}

export interface Delivery {
  channelId: PushCategory | "quiet";
  sound: "default" | null;
}

/** The Android channel (named like its category) and sound a family push goes out with. */
export function familyDelivery(category: PushCategory, now: Date, quietOn: boolean): Delivery {
  return quietOn && isQuietHour(now) ? { channelId: "quiet", sound: null } : { channelId: category, sound: "default" };
}
```

- [ ] **Step 4: Implement `pushWithin.ts`:**

```ts
/**
 * Wait for a push before answering the request — but not for long, and never
 * let it fail the request.
 *
 * Cloud Run throttles a revision's CPU once the response has been sent
 * (deploy.yml does not pass --no-cpu-throttling), so work left running after
 * `res.json` — the old fire-and-forget pattern — can stall until the next
 * request arrives. Teacher actions that tell families something therefore
 * await it here, capped: past `ms` the request answers anyway and the work
 * carries on as best it can. Errors are logged, never thrown.
 */
import { logger } from "./logger.ts";

export const FAMILY_PUSH_WAIT_MS = 4_000;

export async function pushWithin(label: string, work: () => Promise<unknown>, ms: number = FAMILY_PUSH_WAIT_MS): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // `Promise.resolve().then(work)` turns a synchronous throw into a rejection,
  // and the second `then` handles it, so `running` never rejects — not even
  // after the cap, when nothing is awaiting it any more.
  const running = Promise.resolve()
    .then(work)
    .then(
      () => "done" as const,
      err => {
        logger.error({ err, label }, "family push failed");
        return "failed" as const;
      },
    );
  const capped = new Promise<"capped">(resolve => {
    timer = setTimeout(() => resolve("capped"), ms);
  });
  const outcome = await Promise.race([running, capped]);
  clearTimeout(timer);
  if (outcome === "capped") logger.warn({ label, ms }, "family push still running when the response went out");
}
```

- [ ] **Step 5: Edit `pushNotifications.ts`.**
  1. Replace `const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";` with:

```ts
const DEFAULT_EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Read on every call, never captured at import: the DB tests point the built
 * server at an in-process stub (test-support/pushStub.ts) through this. Unset
 * in production.
 */
function expoPushUrl(): string {
  return process.env.EXPO_PUSH_URL || DEFAULT_EXPO_PUSH_URL;
}
```

     and in `sendExpoPush`, change `fetch(EXPO_PUSH_URL, …)` to `fetch(expoPushUrl(), …)`.
  2. Extend `PUSH_CHANNEL`, keeping it a flat literal:

```ts
export const PUSH_CHANNEL = {
  messages: "messages",
  results: "results",
  admin: "admin",
  homework: "homework",
  exams: "exams",
  quiet: "quiet",
} as const;
```

     Add one line to its doc comment: "`homework` and `exams` are the family pushes of spec Part 4; `quiet` is where any family push goes between 22:00 and 07:00 Amman (modules/notifications/quietHours.ts)."
  3. Add to `ExpoPushMessage`, after `badge`:

```ts
  /**
   * iOS only: `"default"` plays the default sound, `null` none. Android takes
   * its sound from the channel instead — see quietHours.ts for why quiet
   * hours also switch the channel.
   */
  sound?: "default" | null;
```

  4. Replace the header's sentence «Fire-and-forget by design: callers (routes/messaging.ts) never await this before responding» with: «Chat and admin callers do not await this before responding; the family pushes (lib/familyPush.ts) do, capped by lib/pushWithin.ts, because Cloud Run throttles the CPU once a response is sent. Either way a failure here must never surface as a failed request.»

- [ ] **Step 6: Mobile channels.** In `artifacts/mobile/services/pushPolicy.ts`:
  - `export type PushChannelId = 'messages' | 'results' | 'reminders' | 'admin' | 'homework' | 'exams' | 'quiet';`
  - `importance: 'high' | 'default' | 'low';` with the comment `/** 'high' shows a heads-up banner; 'default' only lands in the shade; 'low' lands in the shade with no sound or vibration. */`
  - Append to `PUSH_CHANNELS`, before the `admin` entry:

```ts
  {
    id: 'homework',
    importance: 'default',
    nameAr: 'الواجبات',
    nameEn: 'Homework',
    descriptionAr: 'واجب جديد من المعلّم، وتذكير قبل موعده بيوم',
    descriptionEn: 'New homework from a teacher, and a reminder the day before it is due',
  },
  {
    id: 'exams',
    importance: 'high',
    nameAr: 'مواعيد الامتحانات',
    nameEn: 'Exam dates',
    descriptionAr: 'عند تحديد موعد امتحان أو تغييره',
    descriptionEn: 'When an exam is scheduled or its date changes',
  },
  {
    // The server sends every family push here between 22:00 and 07:00 Amman
    // (quietHours.ts on the API): Android takes sound from the channel, so a
    // silent night needs a silent channel.
    id: 'quiet',
    importance: 'low',
    nameAr: 'ليلًا (بلا صوت)',
    nameEn: 'At night (silent)',
    descriptionAr: 'ما يصل من المدرسة بين العاشرة مساءً والسابعة صباحًا، بلا صوت',
    descriptionEn: 'School notifications that arrive between 10 pm and 7 am, without sound',
  },
```

  In `services/pushTokens.ts`, `ensureNotificationChannels`, replace the `importance:` expression and add the low-channel options:

```ts
        importance:
          c.importance === 'high'
            ? Notifications.AndroidImportance.HIGH
            : c.importance === 'low'
              ? Notifications.AndroidImportance.LOW
              : Notifications.AndroidImportance.DEFAULT,
        // Android fixes a channel's sound and vibration when it is first
        // created — later calls only rename it — so the silent channel must be
        // silent from its first creation.
        ...(c.importance === 'low' ? { sound: null, enableVibrate: false } : {}),
```

- [ ] **Step 7: Run everything again and confirm it passes.** That means all four test files, plus the mobile `pushPolicy.test.ts` parity case («creates every channel the server sends to»), which now also covers `homework`/`exams`/`quiet`. Then `pnpm run typecheck`.

- [ ] **Step 8: Mutation proof** (report, revert): (a) in `isQuietHour` change `h >= QUIET_FROM_HOUR` to `h > QUIET_FROM_HOUR`, and "starts at 22:00 Amman" should go red; (b) remove `quiet` from the app's `PUSH_CHANNELS`, and the parity test should go red; (c) in `pushWithin`, drop the second `then` handler, and "never throws" should go red.

- [ ] **Step 9: Commit**

```bash
git add artifacts/api-server/src/lib artifacts/api-server/src/modules/notifications artifacts/mobile/services
git commit -m "feat(push): sound on a message, a test seam for Expo, homework/exams/quiet channels, quiet hours, pushWithin"
```

---

### Task 4: Test harness: an Expo stub, device tokens, safe server defaults

**Files:**
- Create: `artifacts/api-server/src/test-support/pushStub.ts`, `artifacts/api-server/src/test-support/seedPush.ts`
- Modify: `artifacts/api-server/src/test-support/startServer.ts`
- Test: `artifacts/api-server/src/test-support/__tests__/pushStub.test.ts`

**Interfaces:**
- Consumes: Task 3's `sendExpoPush` env seam; `FamilyWorld` (`seedFamilies.ts`).
- Produces. **Tasks 5–9 use these:**
  - `pushStub.ts`: `interface StubMessage { to: string; title: string; body: string; data?: Record<string, unknown>; channelId?: string; sound?: "default" | null; badge?: number }`; `interface PushStub { url: string; messages(): StubMessage[]; clear(): void; markDead(token: string): void; failNext(status?: number): void; delayNext(ms: number): void; waitFor(pred: (all: StubMessage[]) => boolean, timeoutMs?: number): Promise<StubMessage[]>; settle(ms?: number): Promise<StubMessage[]>; close(): Promise<void> }`; `startPushStub(): Promise<PushStub>`.
  - `seedPush.ts`: `PUSH_TOKENS` (owner → token list), `type TokenOwner`, `seedPushWorld(pool, w): Promise<void>` (tokens, plus `suspendedParent` as a guardian of Sara's row `sA1`), `sentTo(messages, owner): StubMessage[]`, `ownersReached(messages): string[]` (sorted, unique), `setPushPrefs(pool, userId, prefs: Record<string, boolean>): Promise<void>`, `shownDay(ymd: string): string`. Task 9 adds `RM_TITLES`, `ammanDueAt`, `seedReminderHomework` to this file.
  - `startServer` defaults: `EXPO_PUSH_URL=http://127.0.0.1:9/push-disabled-in-tests` and `PUSH_QUIET_HOURS=off`. Callers override them through `env`.

- [ ] **Step 1: Write the failing test** (`test-support/__tests__/pushStub.test.ts`). It runs without a database:

```ts
/**
 * The stub stands in for Expo in every push DB test, so it has to behave like
 * Expo where the server cares: one ticket per message in order, a
 * DeviceNotRegistered ticket for a dead token, a failed batch, a slow answer.
 * Driven through the real sendExpoPush, which also proves the EXPO_PUSH_URL seam.
 */
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { startPushStub, type PushStub } from "../pushStub.ts";
import { deadTokensFrom, sendExpoPush } from "../../lib/pushNotifications.ts";

describe("the Expo push stub", () => {
  let stub: PushStub;
  let saved: string | undefined;
  before(async () => {
    stub = await startPushStub();
    saved = process.env.EXPO_PUSH_URL;
    process.env.EXPO_PUSH_URL = stub.url;
  });
  after(async () => {
    if (saved === undefined) delete process.env.EXPO_PUSH_URL;
    else process.env.EXPO_PUSH_URL = saved;
    await stub.close();
  });
  beforeEach(() => stub.clear());

  it("records what sendExpoPush sends and answers with tickets", async () => {
    const message = { to: "ExponentPushToken[a]", title: "t", body: "b", channelId: "homework" as const, sound: null, data: { screen: "school" } };
    const results = await sendExpoPush([message]);
    assert.deepEqual(results, [{ to: "ExponentPushToken[a]", status: "ok" }]);
    assert.deepEqual(stub.messages(), [message]);
  });

  it("answers DeviceNotRegistered for a token marked dead", async () => {
    stub.markDead("ExponentPushToken[b]");
    const results = await sendExpoPush([
      { to: "ExponentPushToken[a]", title: "t", body: "b" },
      { to: "ExponentPushToken[b]", title: "t", body: "b" },
    ]);
    assert.deepEqual(deadTokensFrom(results), ["ExponentPushToken[b]"]);
  });

  it("fails one batch on request, records nothing from it, then recovers", async () => {
    stub.failNext(500);
    const failed = await sendExpoPush([{ to: "ExponentPushToken[a]", title: "t", body: "b" }]);
    assert.deepEqual(failed, [{ to: "ExponentPushToken[a]", status: "error" }]);
    assert.deepEqual(stub.messages(), []);
    const ok = await sendExpoPush([{ to: "ExponentPushToken[a]", title: "t", body: "b" }]);
    assert.equal(ok[0]?.status, "ok");
  });

  it("delays one answer on request", async () => {
    stub.delayNext(200);
    const started = Date.now();
    await sendExpoPush([{ to: "ExponentPushToken[a]", title: "t", body: "b" }]);
    assert.ok(Date.now() - started >= 180);
  });

  it("waitFor gives up, saying what it saw", async () => {
    await assert.rejects(stub.waitFor(all => all.length > 5, 100), /waited 100ms/);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.** `(cd artifacts/api-server && node --experimental-strip-types --test src/test-support/__tests__/pushStub.test.ts)` should FAIL with the module missing.

- [ ] **Step 3: Write `pushStub.ts`:**

```ts
/**
 * A stand-in for Expo's push endpoint, running in the test process. The built
 * server (a child process — startServer.ts) is pointed at it with
 * EXPO_PUSH_URL, so every message it would have sent to Expo lands here
 * instead, and a DB test can assert who was pushed, what it said, on which
 * channel — and, as importantly, who was not.
 *
 * A message is recorded when its request ARRIVES, before any delayed answer.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface StubMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  sound?: "default" | null;
  badge?: number;
}

export interface PushStub {
  /** e.g. http://127.0.0.1:41234/push */
  url: string;
  /** Everything received since the last clear(), in arrival order. */
  messages(): StubMessage[];
  clear(): void;
  /** Answer DeviceNotRegistered for this token from now on. */
  markDead(token: string): void;
  /** Answer the next request with this HTTP status (default 500) and record nothing from it. */
  failNext(status?: number): void;
  /** Hold the answer to the next request for `ms`. */
  delayNext(ms: number): void;
  /** Resolve with every message once `pred` holds; reject after `timeoutMs` (default 3000). */
  waitFor(pred: (all: StubMessage[]) => boolean, timeoutMs?: number): Promise<StubMessage[]>;
  /** Wait `ms` (default 300) for stragglers, then return everything received. */
  settle(ms?: number): Promise<StubMessage[]>;
  close(): Promise<void>;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function startPushStub(): Promise<PushStub> {
  let received: StubMessage[] = [];
  const dead = new Set<string>();
  let failStatus: number | null = null;
  let delayMs = 0;

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", chunk => {
      raw += String(chunk);
    });
    req.on("end", () => {
      if (failStatus !== null) {
        const status = failStatus;
        failStatus = null;
        res.writeHead(status, { "Content-Type": "text/plain" });
        res.end("stub failure");
        return;
      }
      let batch: StubMessage[];
      try {
        batch = JSON.parse(raw) as StubMessage[];
      } catch {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("bad json");
        return;
      }
      received.push(...batch);
      const data = batch.map((m, i) =>
        dead.has(m.to)
          ? { status: "error", message: "not registered", details: { error: "DeviceNotRegistered" } }
          : { status: "ok", id: `ticket-${received.length - batch.length + i}` },
      );
      const wait = delayMs;
      delayMs = 0;
      setTimeout(() => {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data }));
      }, wait);
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/push`,
    messages: () => [...received],
    clear() {
      received = [];
    },
    markDead(token) {
      dead.add(token);
    },
    failNext(status = 500) {
      failStatus = status;
    },
    delayNext(ms) {
      delayMs = ms;
    },
    async waitFor(pred, timeoutMs = 3000) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        if (pred(received)) return [...received];
        if (Date.now() > deadline) {
          throw new Error(`push stub: waited ${timeoutMs}ms; received ${JSON.stringify(received).slice(0, 2000)}`);
        }
        await sleep(50);
      }
    },
    async settle(ms = 300) {
      await sleep(ms);
      return [...received];
    },
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}
```

- [ ] **Step 4: Safe defaults in `startServer.ts`.** Add to the `env` object, after `STUDENT_ACCOUNTS: "true",`:

```ts
    // No DB test may ever reach Expo: port 9 is closed, so a push sent by a
    // test that did not ask for the stub fails at once (and is logged). Push
    // tests pass { EXPO_PUSH_URL: stub.url }.
    EXPO_PUSH_URL: "http://127.0.0.1:9/push-disabled-in-tests",
    // Quiet hours would change the channel and sound at night; tests must not
    // depend on the time of day. The rule itself is unit-tested.
    PUSH_QUIET_HOURS: "off",
```

- [ ] **Step 5: Write `seedPush.ts`:**

```ts
/**
 * Push fixtures on top of the family world (seedFamilies.ts): device tokens
 * for every account, so a test can tell from a token alone who was pushed,
 * and one suspended guardian of Sara's row — suspension must stop a push, not
 * only a sign-in. Kept out of seedFamilies so no older test changes.
 * Raw SQL, like the other fixtures.
 */
import type { Pool } from "pg";

import type { FamilyWorld } from "./seedFamilies.ts";
import type { StubMessage } from "./pushStub.ts";

/** parentA has two devices: a push must reach every device of an account. */
export const PUSH_TOKENS = {
  parentA: ["ExponentPushToken[parentA-phone]", "ExponentPushToken[parentA-tablet]"],
  parentB: ["ExponentPushToken[parentB-phone]"],
  studentA: ["ExponentPushToken[studentA-phone]"],
  studentB: ["ExponentPushToken[studentB-phone]"],
  studentUnlinked: ["ExponentPushToken[studentUnlinked-phone]"],
  suspendedParent: ["ExponentPushToken[suspendedParent-phone]"],
  t1: ["ExponentPushToken[t1-phone]"],
  t2: ["ExponentPushToken[t2-phone]"],
} as const;
export type TokenOwner = keyof typeof PUSH_TOKENS;

const OWNER_OF = new Map<string, TokenOwner>(
  (Object.entries(PUSH_TOKENS) as [TokenOwner, readonly string[]][]).flatMap(([owner, tokens]) =>
    tokens.map(t => [t, owner] as [string, TokenOwner]),
  ),
);

export async function seedPushWorld(pool: Pool, w: FamilyWorld): Promise<void> {
  for (const [owner, tokens] of Object.entries(PUSH_TOKENS) as [TokenOwner, readonly string[]][]) {
    for (const token of tokens) {
      await pool.query(`INSERT INTO device_push_tokens (user_id, expo_push_token, platform) VALUES ($1, $2, 'android')`, [
        w.users[owner],
        token,
      ]);
    }
  }
  await pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'guardian')`, [
    w.students.sA1,
    w.users.suspendedParent,
  ]);
}

/** The messages that went to any of this account's devices. */
export function sentTo(messages: readonly StubMessage[], owner: TokenOwner): StubMessage[] {
  const mine = new Set<string>(PUSH_TOKENS[owner]);
  return messages.filter(m => mine.has(m.to));
}

/** Who got anything, sorted — an unknown token shows up as `unknown:<token>`. */
export function ownersReached(messages: readonly StubMessage[]): string[] {
  return [...new Set(messages.map(m => OWNER_OF.get(m.to) ?? `unknown:${m.to}`))].sort();
}

/** Set an account's stored switches directly (`{}` = all on). */
export async function setPushPrefs(pool: Pool, userId: string, prefs: Record<string, boolean>): Promise<void> {
  await pool.query(`UPDATE users SET push_prefs = $2::jsonb WHERE id = $1`, [userId, JSON.stringify(prefs)]);
}

/** A YYYY-MM-DD day as a push prints it: DD-MM-YYYY in a left-to-right isolate. */
export function shownDay(ymd: string): string {
  return `⁦${ymd.slice(8, 10)}-${ymd.slice(5, 7)}-${ymd.slice(0, 4)}⁩`;
}
```

- [ ] **Step 6: Run the test again and confirm it passes.** Then run the whole api-server suite after a build, to show the defaults change nothing: `(cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres REQUIRE_DB_TESTS=true pnpm test)` should show 0 failures. Finish with `pnpm run typecheck`.

- [ ] **Step 7: Mutation proof** (report, revert): in the stub, drop `dead.has(m.to) ? … :` (always `ok`), and "answers DeviceNotRegistered" should go red.

- [ ] **Step 8: Commit**

```bash
git add artifacts/api-server/src/test-support
git commit -m "test(api): an in-process Expo push stub, device-token fixtures, and servers that can never reach Expo"
```

---

### Task 5: The shared family sender, with the release announcement moved onto it

**Files:**
- Create: `artifacts/api-server/src/modules/notifications/familyPushText.ts` (only `PushText` and `clip` here; Task 6 adds the rest), `artifacts/api-server/src/modules/notifications/familyPush.ts`, `artifacts/api-server/src/lib/familyPush.ts`
- Modify: `artifacts/api-server/src/lib/familyAccess.ts`, `artifacts/api-server/src/lib/resultsReleaseNotify.ts`
- Test: `artifacts/api-server/src/modules/notifications/__tests__/familyPush.test.ts`, `artifacts/api-server/src/routes/__tests__/resultsPush.db.test.ts`

**Interfaces:**
- Consumes: Task 1 `allowsPush`, `PushCategory`; Task 3 `familyDelivery`, `quietHoursEnabled`, `Delivery`, `sendExpoPush`, `deadTokensFrom`; Task 4's harness.
- Produces. **Tasks 6–9 call these:**
  - `modules/notifications/familyPushText.ts`: `interface PushText { title: string; body: string }`, `TITLE_MAX = 50`, `clip(text: string, max: number): string`.
  - `modules/notifications/familyPush.ts`: `interface LinkedAccount { userId: string; relation: "self" | "guardian"; studentId: string; childName: string; pushPrefs: unknown; suspended: boolean }`, `type Recipient = Pick<LinkedAccount, "userId" | "relation" | "studentId" | "childName">`, `selectRecipients(accounts: readonly LinkedAccount[], category: PushCategory): Recipient[]`, `familyMessages(input: { recipients; tokens: readonly { userId: string; expoPushToken: string }[]; text: (r: Recipient) => PushText | null; data: Record<string, unknown>; delivery: Delivery }): ExpoPushMessage[]`.
  - `lib/familyAccess.ts`: `accountsLinkedTo(studentIds: readonly string[]): Promise<LinkedAccount[]>`. These are the live roster rows' `self` and `guardian` accounts, suspended ones included (callers filter).
  - `lib/familyPush.ts`: `interface FamilyPushOutcome { recipients: number; messages: number; delivered: number; pruned: number }`, `sendFamilyPush(input: { category: PushCategory; accounts: readonly LinkedAccount[]; text: (r: Recipient) => PushText | null; data: Record<string, unknown>; now?: Date }): Promise<FamilyPushOutcome>`.
  - `lib/resultsReleaseNotify.ts`: `finalResultStudentIds(evaluationId: string, only?: readonly string[]): Promise<string[]>`. These are the live roster rows with a handed-in, **non-provisional** result on that exam. `announceResultsRelease` keeps its signature.

- [ ] **Step 1: Characterise the release announcement as it is.** This is `resultsPush.db.test.ts`. Write the file, and run its first `describe` against the **unchanged** code: it must PASS. Every case there pins behaviour that has to survive the rewrite.

```ts
/**
 * What this guards: the push a family gets when a teacher releases results.
 * First characterised on the code as it was before Part 4 (who hears it, what
 * it says, that a second press says nothing, that hide → release announces
 * again, that a dead device is forgotten), then tightened: a provisional
 * paper, a suspended guardian and an account that switched results off hear
 * nothing, and the push rings by day on the results channel.
 *
 * The release announcement is sent AFTER the response (fire-and-forget, as
 * before), so each case waits on the stub for what it expects, then settles
 * briefly before asserting what must be absent. Cases run in order: the
 * release flag is shared state.
 */
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { EX_TITLES, seedExams, type ExamWorld } from "../../test-support/seedExams.ts";
import { startPushStub, type PushStub } from "../../test-support/pushStub.ts";
import { PUSH_TOKENS, seedPushWorld, sentTo, setPushPrefs } from "../../test-support/seedPush.ts";

describeDb("results pushes, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;
  let x: ExamWorld;

  const release = (released: boolean) =>
    call(server, "POST", `/evaluations/${x.exams.exUnreleased}/results-release`, w.users.t1, { released });
  /** Hide, then release: a fresh announcement every time. */
  const announce = async () => {
    assert.equal((await release(false)).status, 200);
    stub.clear();
    const r = await release(true);
    assert.equal(r.status, 200, server.logs().slice(-1500));
  };
  const saraTitle = `نتيجة ${CHILDREN.sara}`;
  const waitForSarasParent = () => stub.waitFor(m => sentTo(m, "parentA").some(p => p.title === saraTitle));

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    await seedPushWorld(db.pool, w);
    // Adam handed this exam in too, but his paper is still being marked.
    const adam = await db.pool.query<{ id: string }>(
      `INSERT INTO attempts (evaluation_id, student_id, source, status, started_at, submitted_at)
       VALUES ($1, $2, 'student_link', 'needs_review', now(), now()) RETURNING id`,
      [x.exams.exUnreleased, w.students.aA],
    );
    await db.pool.query(
      `INSERT INTO attempt_results (attempt_id, earned_marks, total_marks, percent, level_key, is_provisional)
       VALUES ($1, '0.00', '10.00', '0.00', 'beginner', true)`,
      [adam.rows[0].id],
    );
    stub = await startPushStub();
    server = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url } });
  });
  after(async () => {
    await server?.stop();
    await stub?.close();
    await db?.drop();
  });
  beforeEach(() => stub.clear());

  describe("as it was before Part 4 (must pass on the old code)", () => {
    it("tells the child and each guardian, naming the child, on every device", async () => {
      assert.equal((await release(true)).status, 200);
      const msgs = await stub.waitFor(m => sentTo(m, "studentA").length > 0 && sentTo(m, "parentA").filter(p => p.title === saraTitle).length >= 2);
      const toStudent = sentTo(msgs, "studentA");
      assert.equal(toStudent.length, 1);
      assert.equal(toStudent[0].title, `نتيجة «${EX_TITLES.exUnreleased}»`);
      assert.equal(toStudent[0].body, "أعلن معلّمك النتيجة. افتحها من «اختباراتي».");
      const toParent = sentTo(msgs, "parentA").filter(m => m.title === saraTitle);
      assert.deepEqual(toParent.map(m => m.to).sort(), [...PUSH_TOKENS.parentA].sort());
      assert.equal(toParent[0].body, `أعلن المعلّم نتيجة «${EX_TITLES.exUnreleased}». افتحها من «نتائج أبنائي».`);
      for (const m of [...toStudent, ...toParent]) {
        assert.equal(m.channelId, "results");
        assert.deepEqual(m.data, { screen: "my-exams" });
      }
      for (const owner of ["parentB", "studentB", "t1", "t2", "studentUnlinked"] as const) {
        assert.equal(sentTo(await stub.settle(200), owner).length, 0, owner);
      }
    });

    it("says nothing when the results were already released", async () => {
      // Still released from the case above.
      assert.equal((await release(true)).status, 200);
      assert.deepEqual(await stub.settle(400), []);
    });

    it("announces again after the teacher hides and re-releases", async () => {
      await announce();
      await waitForSarasParent();
    });
  });

  describe("Part 4", () => {
    it("tells nobody about a paper still being marked", async () => {
      await announce();
      await waitForSarasParent();
      const msgs = await stub.settle(300);
      assert.equal(msgs.some(m => m.title === `نتيجة ${CHILDREN.adam}`), false, "Adam's paper is provisional");
    });

    it("skips a suspended guardian", async () => {
      await announce();
      await waitForSarasParent();
      assert.equal(sentTo(await stub.settle(300), "suspendedParent").length, 0);
    });

    it("honours the results switch, and only that switch", async () => {
      await setPushPrefs(db.pool, w.users.studentA, { results: false });
      try {
        await announce();
        await waitForSarasParent();
        assert.equal(sentTo(await stub.settle(300), "studentA").length, 0);
      } finally {
        await setPushPrefs(db.pool, w.users.studentA, {});
      }
      await setPushPrefs(db.pool, w.users.studentA, { homework: false, exams: false });
      try {
        await announce();
        await stub.waitFor(m => sentTo(m, "studentA").length > 0);
      } finally {
        await setPushPrefs(db.pool, w.users.studentA, {});
      }
    });

    it("rings by day (quiet hours are off in tests)", async () => {
      await announce();
      await waitForSarasParent();
      for (const m of await stub.settle(200)) assert.equal(m.sound, "default");
    });
  });

  describe("pruning (true before Part 4 too; last, because it removes a token)", () => {
    it("forgets a device Expo says is gone, and keeps the others", async () => {
      const [phone, tablet] = PUSH_TOKENS.parentA;
      stub.markDead(tablet);
      await announce();
      await waitForSarasParent();
      let tokens: string[] = [];
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        tokens = (
          await db.pool.query<{ t: string }>(`SELECT expo_push_token AS t FROM device_push_tokens WHERE user_id = $1`, [w.users.parentA])
        ).rows.map(r => r.t);
        if (!tokens.includes(tablet)) break;
        await new Promise(r => setTimeout(r, 100));
      }
      assert.deepEqual(tokens, [phone]);
    });
  });
});
```

Run the DB test command on `src/routes/__tests__/resultsPush.db.test.ts`. Expected: the first `describe` and the pruning case PASS on the old code. The `Part 4` cases FAIL: Adam is pushed, the suspended guardian is pushed, the switch is ignored, and `sound` is undefined. If a characterised case fails on the old code, stop and report: the test is wrong, not the code.

- [ ] **Step 2: Write the failing unit test** (`familyPush.test.ts`):

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { familyMessages, selectRecipients, type LinkedAccount } from "../familyPush.ts";
import { clip } from "../familyPushText.ts";

const acct = (over: Partial<LinkedAccount>): LinkedAccount => ({
  userId: "u-parent",
  relation: "guardian",
  studentId: "s-sara",
  childName: "سارة",
  pushPrefs: {},
  suspended: false,
  ...over,
});

describe("selectRecipients", () => {
  it("keeps every linked account that wants this category", () => {
    const r = selectRecipients([acct({}), acct({ userId: "u-student", relation: "self" })], "homework");
    assert.deepEqual(r.map(x => x.userId), ["u-parent", "u-student"]);
  });
  it("drops a suspended account", () => {
    assert.deepEqual(selectRecipients([acct({ suspended: true })], "homework"), []);
  });
  it("drops an account that switched THIS category off, and only this one", () => {
    assert.deepEqual(selectRecipients([acct({ pushPrefs: { homework: false } })], "homework"), []);
    assert.equal(selectRecipients([acct({ pushPrefs: { homework: false } })], "exams").length, 1);
  });
  it("keeps one entry per account, relation and child", () => {
    assert.equal(selectRecipients([acct({}), acct({})], "results").length, 1);
    assert.equal(selectRecipients([acct({}), acct({ studentId: "s-adam", childName: "آدم" })], "results").length, 2);
  });
  it("hands on no switches or suspension, only who and which child", () => {
    assert.deepEqual(selectRecipients([acct({})], "results"), [
      { userId: "u-parent", relation: "guardian", studentId: "s-sara", childName: "سارة" },
    ]);
  });
});

describe("familyMessages", () => {
  const delivery = { channelId: "homework" as const, sound: "default" as const };
  const tokens = [
    { userId: "u-parent", expoPushToken: "ExponentPushToken[p1]" },
    { userId: "u-parent", expoPushToken: "ExponentPushToken[p2]" },
    { userId: "u-student", expoPushToken: "ExponentPushToken[s1]" },
  ];
  const recipients = [
    { userId: "u-parent", relation: "guardian" as const, studentId: "s-sara", childName: "سارة" },
    { userId: "u-parent", relation: "guardian" as const, studentId: "s-adam", childName: "آدم" },
    { userId: "u-student", relation: "self" as const, studentId: "s-sara", childName: "سارة" },
  ];
  const text = (r: { relation: string; childName: string }) =>
    r.relation === "guardian" ? { title: `${r.childName}: واجب جديد`, body: "b" } : { title: "واجب جديد", body: "b" };

  it("builds one message per recipient per device, naming each child for a guardian", () => {
    const out = familyMessages({ recipients, tokens, text, data: { screen: "school" }, delivery });
    assert.equal(out.length, 5);
    assert.deepEqual(out.filter(m => m.to === "ExponentPushToken[p1]").map(m => m.title).sort(), ["آدم: واجب جديد", "سارة: واجب جديد"]);
    assert.deepEqual(out.find(m => m.to === "ExponentPushToken[s1]"), {
      to: "ExponentPushToken[s1]",
      title: "واجب جديد",
      body: "b",
      data: { screen: "school" },
      channelId: "homework",
      sound: "default",
    });
  });
  it("skips a recipient whose text is null, and one with no device", () => {
    const out = familyMessages({ recipients, tokens: tokens.slice(2), text: r => (r.relation === "self" ? null : text(r)), data: {}, delivery });
    assert.deepEqual(out, []);
  });
  it("never sends the same words to the same device twice", () => {
    const twice = [recipients[0]!, { ...recipients[0]!, studentId: "s-sara-row-2" }];
    assert.equal(familyMessages({ recipients: twice, tokens: tokens.slice(0, 1), text, data: {}, delivery }).length, 1);
  });
});

describe("clip", () => {
  it("leaves a short text alone and folds whitespace", () => {
    assert.equal(clip("  واجب   الرياضيات ", 40), "واجب الرياضيات");
  });
  it("cuts a long text to max code points with «…»", () => {
    const cut = clip("أ".repeat(60), 10);
    assert.equal([...cut].length, 10);
    assert.ok(cut.endsWith("…"));
  });
  it("never splits a character made of two code units", () => {
    assert.equal(clip("😀".repeat(5), 3), "😀😀…");
  });
});
```

Run it with the unit command, and it should FAIL with the modules missing.

- [ ] **Step 3: Write `modules/notifications/familyPushText.ts`** (the base; Task 6 appends):

```ts
/**
 * What family pushes say. Arabic only, like every push here: it goes out with
 * no request in hand to read a locale from. Pure — the senders pass names in.
 *
 * Rules every builder keeps:
 *  - a title is at most TITLE_MAX code points (a phone cuts the rest);
 *  - a guardian's push names the child FIRST («سارة: واجب جديد»), so no verb
 *    or preposition has to agree with a name — Arabic verbs agree with the
 *    child's gender, which the roster often does not record;
 *  - a day or time sits in a left-to-right isolate, as the app shows it.
 */
export interface PushText {
  title: string;
  body: string;
}

export const TITLE_MAX = 50;

/** Trim, fold whitespace, and cut at `max` code points with «…» — never through a character. */
export function clip(text: string, max: number): string {
  const folded = text.trim().replace(/\s+/g, " ");
  const chars = [...folded];
  return chars.length <= max ? folded : `${chars.slice(0, max - 1).join("").trimEnd()}…`;
}
```

- [ ] **Step 4: Write `modules/notifications/familyPush.ts`:**

```ts
/**
 * Who of a child's accounts hears a family push, and the messages they get —
 * pure, so the rules are tested without a database. lib/familyPush.ts loads
 * the accounts and devices and sends.
 */
import type { ExpoPushMessage } from "../../lib/pushNotifications.ts";
import type { PushText } from "./familyPushText.ts";
import { allowsPush, type PushCategory } from "./pushPrefs.ts";
import type { Delivery } from "./quietHours.ts";

/** One account linked to one live roster row (lib/familyAccess.ts#accountsLinkedTo). */
export interface LinkedAccount {
  userId: string;
  relation: "self" | "guardian";
  studentId: string;
  /** The roster row's name — what a guardian's push calls the child. */
  childName: string;
  /** `users.push_prefs` as stored. */
  pushPrefs: unknown;
  suspended: boolean;
}

export type Recipient = Pick<LinkedAccount, "userId" | "relation" | "studentId" | "childName">;

/**
 * The accounts that hear a push in `category`: not suspended, and not switched
 * off for this category. One entry per (account, relation, child): a guardian
 * of two children in the class gets one push per child.
 */
export function selectRecipients(accounts: readonly LinkedAccount[], category: PushCategory): Recipient[] {
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const a of accounts) {
    if (a.suspended || !allowsPush(a.pushPrefs, category)) continue;
    const key = `${a.userId}|${a.relation}|${a.studentId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ userId: a.userId, relation: a.relation, studentId: a.studentId, childName: a.childName });
  }
  return out;
}

/**
 * One message per recipient per device. `text` returning null leaves that
 * recipient out (the reminder uses it). The same words never go to the same
 * device twice — an account linked to two rows of one child would otherwise
 * be told twice.
 */
export function familyMessages(input: {
  recipients: readonly Recipient[];
  tokens: readonly { userId: string; expoPushToken: string }[];
  text: (r: Recipient) => PushText | null;
  data: Record<string, unknown>;
  delivery: Delivery;
}): ExpoPushMessage[] {
  const devices = new Map<string, string[]>();
  for (const t of input.tokens) devices.set(t.userId, [...(devices.get(t.userId) ?? []), t.expoPushToken]);
  const sent = new Set<string>();
  const out: ExpoPushMessage[] = [];
  for (const r of input.recipients) {
    const text = input.text(r);
    if (!text) continue;
    for (const to of devices.get(r.userId) ?? []) {
      const key = `${to}|${text.title}|${text.body}`;
      if (sent.has(key)) continue;
      sent.add(key);
      out.push({
        to,
        title: text.title,
        body: text.body,
        data: input.data,
        channelId: input.delivery.channelId,
        sound: input.delivery.sound,
      });
    }
  }
  return out;
}
```

- [ ] **Step 5: Add `accountsLinkedTo` to `lib/familyAccess.ts`.** Extend the db import to `import { db, rosterLinks, students, users } from "@workspace/db";`, add `import type { LinkedAccount } from "../modules/notifications/familyPush.ts";`, and append:

```ts
/**
 * Rows → accounts: every account linked to these live roster rows, `self` and
 * `guardian`, with what a push needs to decide about it — the child's name,
 * the account's switches and whether it is suspended. The reverse of the two
 * helpers above. Not filtered here: the reminder needs to know a suspended
 * student account EXISTS (the child can tick), even though it is not pushed.
 */
export async function accountsLinkedTo(studentIds: readonly string[]): Promise<LinkedAccount[]> {
  if (studentIds.length === 0) return [];
  const rows = await db
    .select({
      userId: rosterLinks.userId,
      relation: rosterLinks.relation,
      studentId: students.id,
      childName: students.displayName,
      pushPrefs: users.pushPrefs,
      suspendedAt: users.suspendedAt,
    })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .innerJoin(users, eq(users.id, rosterLinks.userId))
    .where(and(inArray(rosterLinks.studentId, [...studentIds]), isNull(students.archivedAt)));
  return rows.map(r => ({
    userId: r.userId,
    relation: r.relation,
    studentId: r.studentId,
    childName: r.childName,
    pushPrefs: r.pushPrefs,
    suspended: r.suspendedAt !== null,
  }));
}
```

- [ ] **Step 6: Write `lib/familyPush.ts`:**

```ts
/**
 * The one way a family push goes out (homework, exam dates, results): which
 * of the linked accounts want it (selectRecipients), on which devices, on
 * which channel and with what sound (quiet hours), and forgetting the devices
 * Expo says are gone. The caller decides WHICH children the news is about and
 * passes their accounts (familyAccess.ts#accountsLinkedTo) and the words.
 *
 * Throws only on a database error; teacher actions wrap it in `pushWithin`,
 * the reminder run catches per homework, the release announcement logs.
 */
import { db, devicePushTokens } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { studentAccountsEnabled } from "./features.ts";
import { deadTokensFrom, sendExpoPush } from "./pushNotifications.ts";
import { familyMessages, selectRecipients, type LinkedAccount, type Recipient } from "../modules/notifications/familyPush.ts";
import type { PushText } from "../modules/notifications/familyPushText.ts";
import type { PushCategory } from "../modules/notifications/pushPrefs.ts";
import { familyDelivery, quietHoursEnabled } from "../modules/notifications/quietHours.ts";

export interface FamilyPushOutcome {
  recipients: number;
  /** Messages handed to Expo (one per recipient per device). */
  messages: number;
  delivered: number;
  pruned: number;
}

const NOTHING: FamilyPushOutcome = { recipients: 0, messages: 0, delivered: 0, pruned: 0 };

export async function sendFamilyPush(input: {
  category: PushCategory;
  accounts: readonly LinkedAccount[];
  text: (r: Recipient) => PushText | null;
  data: Record<string, unknown>;
  now?: Date;
}): Promise<FamilyPushOutcome> {
  // Homework and exam dates live on the School tab, which answers 403 while
  // student accounts are off — never push toward a closed door. Results keep
  // the behaviour they had before Part 4.
  if (input.category !== "results" && !studentAccountsEnabled()) return NOTHING;
  const recipients = selectRecipients(input.accounts, input.category);
  if (recipients.length === 0) return NOTHING;

  const tokens = await db
    .select({ userId: devicePushTokens.userId, expoPushToken: devicePushTokens.expoPushToken })
    .from(devicePushTokens)
    .where(inArray(devicePushTokens.userId, [...new Set(recipients.map(r => r.userId))]));
  const messages = familyMessages({
    recipients,
    tokens,
    text: input.text,
    data: input.data,
    delivery: familyDelivery(input.category, input.now ?? new Date(), quietHoursEnabled()),
  });
  if (messages.length === 0) return { ...NOTHING, recipients: recipients.length };

  const results = await sendExpoPush(messages);
  // A reinstalled or replaced phone leaves a dead token every later push pays for.
  const dead = deadTokensFrom(results);
  if (dead.length > 0) await db.delete(devicePushTokens).where(inArray(devicePushTokens.expoPushToken, dead));
  return {
    recipients: recipients.length,
    messages: messages.length,
    delivered: results.filter(r => r.status === "ok").length,
    pruned: dead.length,
  };
}
```

- [ ] **Step 7: Rewrite the push half of `lib/resultsReleaseNotify.ts`.** Replace the imports and everything from `const text = releaseAnnouncement(evaluation);` up to and including the closing `}` of `if (userIds.length > 0) { … }` with the code below. The class-chat part stays as it is.

```ts
import {
  db,
  attemptResults,
  attempts,
  chatMessages,
  chatParticipants,
  chatThreads,
  classGroups,
  students,
} from "@workspace/db";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { syncClassGroupThread } from "./classThread.ts";
import { accountsLinkedTo } from "./familyAccess.ts";
import { sendFamilyPush } from "./familyPush.ts";
import { releaseAnnouncement } from "./resultsRelease.ts";

/**
 * Live roster rows whose result on this exam a family can now open: handed in
 * AND final (`studentResultReady` also needs the release, which the callers
 * check). A provisional paper is still being marked; telling its family
 * "results are out" would point them at a row with no result. `only` narrows
 * to rows a caller just saved (paper marks typed after the release).
 */
export async function finalResultStudentIds(evaluationId: string, only?: readonly string[]): Promise<string[]> {
  if (only && only.length === 0) return [];
  const rows = await db
    .select({ studentId: attempts.studentId })
    .from(attempts)
    .innerJoin(attemptResults, eq(attemptResults.attemptId, attempts.id))
    .innerJoin(students, eq(students.id, attempts.studentId))
    .where(
      and(
        eq(attempts.evaluationId, evaluationId),
        isNotNull(attempts.submittedAt),
        eq(attemptResults.isProvisional, false),
        isNull(students.archivedAt),
        only ? inArray(attempts.studentId, [...only]) : undefined,
      ),
    );
  return [...new Set(rows.map(r => r.studentId))];
}

export async function announceResultsRelease(evaluation: {
  id: string;
  teacherId: string;
  classGroupId: string | null;
  title: string | null;
  titleAr: string | null;
}): Promise<void> {
  const text = releaseAnnouncement(evaluation);

  // Through the shared family sender (lib/familyPush.ts): suspended accounts
  // and anyone who switched results off are left out, a quiet-hours push is
  // silent, dead devices are pruned.
  await sendFamilyPush({
    category: "results",
    accounts: await accountsLinkedTo(await finalResultStudentIds(evaluation.id)),
    data: { screen: "my-exams" },
    text: r => (r.relation === "guardian" ? text.guardianPush(r.childName) : { title: text.pushTitle, body: text.pushBody }),
  });
```

In the header comment, change «a push to every account linked to a roster row that handed a paper in» to «a push to every account linked to a roster row whose paper is handed in and finally marked (not provisional), except suspended accounts and anyone who switched results off». Drop `devicePushTokens`, `rosterLinks` and the push imports if nothing else uses them. The typecheck will say.

- [ ] **Step 8: Run both tests again and confirm they pass.** `familyPush.test.ts` and the whole `resultsPush.db.test.ts` file (all three `describe`s) should be green. Then `pnpm run typecheck`.

- [ ] **Step 9: Mutation proof** (report, revert): (a) delete `eq(attemptResults.isProvisional, false)`, and "tells nobody about a paper still being marked" should go red; (b) delete `a.suspended ||` in `selectRecipients`, and the unit case and "skips a suspended guardian" should go red; (c) delete `|| !allowsPush(...)`, and "honours the results switch" should go red; (d) delete the `db.delete(devicePushTokens)` line, and the pruning case should go red.

- [ ] **Step 10: Commit**

```bash
git add artifacts/api-server/src
git commit -m "feat(api): one family push sender; the release announcement skips provisional papers, suspended accounts and switched-off results"
```

---

### Task 6: A push when homework is posted

**Files:**
- Modify: `artifacts/api-server/src/modules/notifications/familyPushText.ts` (append), `artifacts/api-server/src/lib/familyAccess.ts`, `artifacts/api-server/src/routes/homework.ts`
- Create: `artifacts/api-server/src/lib/familyPushEvents.ts`
- Test: `artifacts/api-server/src/modules/notifications/__tests__/familyPushText.test.ts`, `artifacts/api-server/src/routes/__tests__/homeworkPush.db.test.ts`

**Interfaces:**
- Consumes: Task 5's `sendFamilyPush`, `accountsLinkedTo`, `clip`, `TITLE_MAX`, `PushText`; Task 3's `pushWithin`; `dueAtToDueDate` (`modules/homework/rules.ts`).
- Produces:
  - `familyPushText.ts`: `pushDay(ymd: string): string`, `pushTime(hhmm: string): string`, `classLabel(klass: { name: string; nameAr: string }): string`, `interface FamilyText { student: PushText; guardian: (child: string) => PushText }`, `homeworkPostedText(i: { title: string; className: string; dueDate: string }): FamilyText`.
  - `familyAccess.ts`: `liveClassStudentIds(classId: string): Promise<string[]>`. These are the class's live roster rows, empty for an archived class.
  - `familyPushEvents.ts`: `announceHomeworkPosted(hw: { title: string; dueAt: Date; classGroupId: string }, klass: { name: string; nameAr: string }): Promise<FamilyPushOutcome>`. **Tasks 7 and 8 append to this file.**
  - HTTP: a successful `POST /homework` has pushed (channel `homework`, `data: { screen: "school" }`) before it answers 201.

- [ ] **Step 1: Write the failing tests.**

`familyPushText.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { classLabel, homeworkPostedText, pushDay, pushTime, TITLE_MAX } from "../familyPushText.ts";

const LONG = "حلّ تمارين الدرس الثاني من الوحدة الثالثة كاملةً مع التبرير ".repeat(4);
const titleFits = (t: string) => assert.ok([...t].length <= TITLE_MAX, `${[...t].length}: ${t}`);

describe("pushDay / pushTime", () => {
  it("prints a day as DD-MM-YYYY in a left-to-right isolate, by string only", () => {
    assert.equal(pushDay("2026-10-14"), "⁦14-10-2026⁩");
    assert.equal(pushDay("not a day"), "not a day");
    assert.equal(pushTime("09:30"), "⁦09:30⁩");
  });
});

describe("classLabel", () => {
  it("prefers the Arabic name and falls back to the other", () => {
    assert.equal(classLabel({ name: "10A maths", nameAr: "العاشر أ" }), "العاشر أ");
    assert.equal(classLabel({ name: "10A maths", nameAr: "  " }), "10A maths");
  });
});

describe("homeworkPostedText", () => {
  const t = homeworkPostedText({ title: "حل تمارين ص 45", className: "10A maths", dueDate: "2026-10-14" });
  it("tells a student what, where and when", () => {
    assert.equal(t.student.title, "واجب جديد: حل تمارين ص 45");
    assert.ok(t.student.body.includes("10A maths"));
    assert.ok(t.student.body.includes("⁦14-10-2026⁩"));
  });
  it("names the child first for a guardian", () => {
    assert.equal(t.guardian("سارة").title, "سارة: واجب جديد");
    assert.ok(t.guardian("سارة").body.includes("«حل تمارين ص 45»"));
    assert.equal(t.guardian("  ").title, "واجب جديد");
  });
  it("keeps every title within TITLE_MAX, however long the names", () => {
    const long = homeworkPostedText({ title: LONG, className: LONG, dueDate: "2026-10-14" });
    titleFits(long.student.title);
    titleFits(long.guardian(LONG).title);
  });
});
```

`homeworkPush.db.test.ts`:

```ts
/**
 * What this guards: the push a family gets when a teacher posts homework. The
 * ways it goes wrong are all about WHO: another family, a teacher, a suspended
 * guardian, an archived roster row, an account that switched homework off —
 * and a push that fails or stalls taking the teacher's post down with it.
 */
import { after, before, beforeEach, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { ammanDay } from "../../test-support/seedExams.ts";
import { startPushStub, type PushStub } from "../../test-support/pushStub.ts";
import { ownersReached, seedPushWorld, sentTo, setPushPrefs, shownDay } from "../../test-support/seedPush.ts";

const DUE = ammanDay(3);

describeDb("homework pushes, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let off: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;

  const post = (on: TestServer, teacher: string, classGroupId: string, title: string) =>
    call(on, "POST", "/homework", teacher, { classGroupId, title, dueDate: DUE });

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await seedPushWorld(db.pool, w);
    stub = await startPushStub();
    server = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url } });
    off = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url, STUDENT_ACCOUNTS: undefined } });
  });
  after(async () => {
    await server?.stop();
    await off?.stop();
    await stub?.close();
    await db?.drop();
  });
  beforeEach(() => stub.clear());

  it("tells the class's student and each child's guardian, on every device, before answering", async () => {
    const r = await post(server, w.users.t1, w.classes.c1, "hw-push-c1");
    assert.equal(r.status, 201, server.logs().slice(-1500));
    // Awaited before the response: already here, no waiting.
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA", "studentA"]);
    const toStudent = sentTo(msgs, "studentA");
    assert.equal(toStudent.length, 1);
    assert.equal(toStudent[0].title, "واجب جديد: hw-push-c1");
    assert.ok(toStudent[0].body.includes("10A maths"));
    assert.ok(toStudent[0].body.includes(shownDay(DUE)));
    const toParent = sentTo(msgs, "parentA");
    assert.equal(toParent.length, 4, "two children × two devices");
    assert.deepEqual([...new Set(toParent.map(m => m.title))].sort(), [`${CHILDREN.adam}: واجب جديد`, `${CHILDREN.sara}: واجب جديد`].sort());
    for (const m of msgs) {
      assert.equal(m.channelId, "homework");
      assert.deepEqual(m.data, { screen: "school" });
      assert.equal(m.sound, "default");
    }
  });

  it("waits for the push before answering (Cloud Run throttles CPU after the response)", async () => {
    stub.delayNext(800);
    const started = Date.now();
    assert.equal((await post(server, w.users.t1, w.classes.c1, "hw-push-slow")).status, 201);
    assert.ok(Date.now() - started >= 750, `answered after ${Date.now() - started}ms`);
  });

  it("leaves out a guardian who switched homework off — and only homework", async () => {
    await setPushPrefs(db.pool, w.users.parentA, { homework: false });
    try {
      assert.equal((await post(server, w.users.t1, w.classes.c1, "hw-push-pref")).status, 201);
      assert.deepEqual(ownersReached(stub.messages()), ["studentA"]);
    } finally {
      await setPushPrefs(db.pool, w.users.parentA, {});
    }
    stub.clear();
    await setPushPrefs(db.pool, w.users.parentA, { exams: false, results: false });
    try {
      assert.equal((await post(server, w.users.t1, w.classes.c1, "hw-push-pref-2")).status, 201);
      assert.deepEqual(ownersReached(stub.messages()), ["parentA", "studentA"]);
    } finally {
      await setPushPrefs(db.pool, w.users.parentA, {});
    }
  });

  it("never reaches an archived roster row, nor a student linked to another row", async () => {
    // c2 (t2): Sara's second row (no student account) and Adam's ARCHIVED row.
    assert.equal((await post(server, w.users.t2, w.classes.c2, "hw-push-c2")).status, 201);
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA"]);
    assert.deepEqual([...new Set(msgs.map(m => m.title))], [`${CHILDREN.sara}: واجب جديد`]);
  });

  it("keeps each family to its own classes", async () => {
    assert.equal((await post(server, w.users.t1, w.classes.c3, "hw-push-c3")).status, 201);
    assert.deepEqual(ownersReached(stub.messages()), ["parentB", "studentB"]);
  });

  it("still posts when Expo is down", async () => {
    stub.failNext(500);
    const r = await post(server, w.users.t1, w.classes.c1, "hw-push-expo-down");
    assert.equal(r.status, 201);
    const row = await db.pool.query(`SELECT 1 FROM homework WHERE title = 'hw-push-expo-down'`);
    assert.equal(row.rowCount, 1);
  });

  it("pushes nothing for a refused post, an edited due date, or while student accounts are off", async () => {
    assert.equal((await post(server, w.users.t2, w.classes.c1, "hw-push-refused")).status, 404);
    const created = await post(server, w.users.t1, w.classes.c1, "hw-push-edit");
    stub.clear();
    const patched = await call(server, "PATCH", `/homework/${created.json.homework.id}`, w.users.t1, { dueDate: ammanDay(5) });
    assert.equal(patched.status, 200);
    assert.equal((await post(off, w.users.t1, w.classes.c1, "hw-push-flag-off")).status, 201);
    assert.deepEqual(await stub.settle(300), []);
  });
});
```

Run both. Expected: the unit test FAILS on missing exports, and the DB test FAILS because nothing is pushed.

- [ ] **Step 2: Append to `familyPushText.ts`:**

```ts
export interface FamilyText {
  student: PushText;
  guardian: (child: string) => PushText;
}

/** A calendar day `YYYY-MM-DD` as DD-MM-YYYY in a left-to-right isolate — the app's formatDueDate. String work only: the day has no zone. */
export function pushDay(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  return `⁦${ymd.slice(8, 10)}-${ymd.slice(5, 7)}-${ymd.slice(0, 4)}⁩`;
}

export function pushTime(hhmm: string): string {
  return `⁦${hhmm}⁩`;
}

export function classLabel(klass: { name: string; nameAr: string }): string {
  return clip(klass.nameAr.trim() || klass.name, 40);
}

/** A title made of a fixed prefix and a name, cut so the whole fits TITLE_MAX. */
function titled(prefix: string, name: string): string {
  return `${prefix}${clip(name, Math.max(10, TITLE_MAX - [...prefix].length))}`;
}

/** «سارة: واجب جديد» — the child first; see the header. */
function forChild(child: string, what: string): string {
  const name = clip(child, 24);
  return name ? `${name}: ${what}` : what;
}

export function homeworkPostedText(i: { title: string; className: string; dueDate: string }): FamilyText {
  const due = `موعده ${pushDay(i.dueDate)}`;
  return {
    student: { title: titled("واجب جديد: ", i.title), body: `${i.className} — ${due}. تجده في «المدرسة».` },
    guardian: child => ({ title: forChild(child, "واجب جديد"), body: `«${clip(i.title, 60)}» في ${i.className} — ${due}.` }),
  };
}
```

- [ ] **Step 3: Add `liveClassStudentIds` to `familyAccess.ts`.** Extend the db import with `classGroups, classMemberships`, then:

```ts
/**
 * The class's children, for a push to "the class": live roster rows that are
 * members of this class, and only while the class itself is live. Empty for
 * an archived or missing class.
 */
export async function liveClassStudentIds(classId: string): Promise<string[]> {
  const rows = await db
    .select({ studentId: students.id })
    .from(classMemberships)
    .innerJoin(students, eq(students.id, classMemberships.studentId))
    .innerJoin(classGroups, eq(classGroups.id, classMemberships.classGroupId))
    .where(and(eq(classMemberships.classGroupId, classId), isNull(students.archivedAt), isNull(classGroups.archivedAt)));
  return [...new Set(rows.map(r => r.studentId))];
}
```

- [ ] **Step 4: Write `lib/familyPushEvents.ts`:**

```ts
/**
 * The teacher actions that tell families something, one function each, which
 * the route awaits through `pushWithin`. Here: WHICH children the news is
 * about (the class, an exam's audience, the rows whose result is final).
 * lib/familyPush.ts: which of their accounts want it, and on what device.
 */
import { accountsLinkedTo, liveClassStudentIds } from "./familyAccess.ts";
import { sendFamilyPush, type FamilyPushOutcome } from "./familyPush.ts";
import { dueAtToDueDate } from "../modules/homework/rules.ts";
import { classLabel, homeworkPostedText } from "../modules/notifications/familyPushText.ts";

/** Homework posted: every live child of the class, their own account and their guardians. */
export async function announceHomeworkPosted(
  hw: { title: string; dueAt: Date; classGroupId: string },
  klass: { name: string; nameAr: string },
): Promise<FamilyPushOutcome> {
  const text = homeworkPostedText({ title: hw.title, className: classLabel(klass), dueDate: dueAtToDueDate(hw.dueAt) });
  return sendFamilyPush({
    category: "homework",
    accounts: await accountsLinkedTo(await liveClassStudentIds(hw.classGroupId)),
    data: { screen: "school" },
    text: r => (r.relation === "guardian" ? text.guardian(r.childName) : text.student),
  });
}
```

- [ ] **Step 5: Hook `POST /homework`.** In `routes/homework.ts` add `import { pushWithin } from "../lib/pushWithin.ts";` and `import { announceHomeworkPosted } from "../lib/familyPushEvents.ts";`. In the handler, keep the class:

```ts
    const klass = await findLiveClass(input.classGroupId, teacherId);
    if (!klass) {
      res.status(404).json(NO_CLASS);
      return;
    }
```

and between `const [out] = await withCounts([row!]);` and `res.status(201)…` add:

```ts
    // Tell the class's families before answering — awaited, capped, never
    // failing the post (lib/pushWithin.ts says why not fire-and-forget).
    await pushWithin("homework posted", () => announceHomeworkPosted(row!, klass));
```

Update the file header with one line: «Posting tells the class's students and their guardians (lib/familyPushEvents.ts); editing does not.»

- [ ] **Step 6: Run both tests again and confirm they pass.** Then `pnpm run typecheck`.

- [ ] **Step 7: Mutation proof** (report, revert): (a) remove the `await pushWithin(…)` line, and "tells the class's student…" should go red; (b) replace `await pushWithin(…)` with `void announceHomeworkPosted(row!, klass)` (fire-and-forget), and "waits for the push before answering" should go red; (c) remove `isNull(students.archivedAt)` from **both** `liveClassStudentIds` and `accountsLinkedTo`, and "never reaches an archived roster row" should go red (removing it from only one cannot go red, because the other still filters); (d) in `sendFamilyPush` remove the `studentAccountsEnabled()` check, and "pushes nothing … while student accounts are off" should go red.

- [ ] **Step 8: Commit**

```bash
git add artifacts/api-server/src
git commit -m "feat(api): posting homework pushes the class's students and their guardians"
```

---

### Task 7: Exam date set, changed or cleared

**Files:**
- Create: `artifacts/api-server/src/modules/notifications/examDateNotice.ts`
- Modify: `artifacts/api-server/src/modules/notifications/familyPushText.ts` (append), `artifacts/api-server/src/lib/familyPushEvents.ts` (append), `artifacts/api-server/src/routes/evaluations.ts` (`PATCH /evaluations/:id`, `POST /evaluations/:id/publish`)
- Test: `artifacts/api-server/src/modules/notifications/__tests__/examDateNotice.test.ts`, `familyPushText.test.ts` (append), `artifacts/api-server/src/routes/__tests__/examDatePush.db.test.ts`

**Interfaces:**
- Consumes: Tasks 5–6 (`sendFamilyPush`, `accountsLinkedTo`, `liveClassStudentIds`, `pushDay`, `pushTime`, `classLabel`, `FamilyText`); `assignedStudentsByEvaluation` (`lib/evaluationAudience.ts`); `audienceFor`, `inAudience` (`modules/assessment/audience.ts`); `seedExams`, `EX_TITLES`, `ammanDay`.
- Produces:
  - `examDateNotice.ts`: `interface ExamSchedule { classGroupId: string | null; examDate: string | null; examTime: string | null }`, `interface ExamForNotice extends ExamSchedule { status: string; archivedAt: Date | null }`, `type ExamDateNotice = { kind: "set" | "changed"; examDate: string; examTime: string | null } | { kind: "cleared"; examDate: null; examTime: null }`, `examVisibleToFamilies(e: { status: string; classGroupId: string | null; archivedAt: Date | null }): boolean`, `examDateNotice(before: ExamForNotice, after: ExamSchedule): ExamDateNotice | null`, `publishNotice(before: ExamForNotice): ExamDateNotice | null`.
  - `familyPushText.ts`: `examDateText(i: { examTitle: string; className: string; notice: ExamDateNotice }): FamilyText`.
  - `familyPushEvents.ts`: `announceExamDate(exam: { id: string; title: string; titleAr: string; classGroupId: string | null }, notice: ExamDateNotice): Promise<FamilyPushOutcome | null>`.
  - HTTP: `PATCH /evaluations/:id` pushes (channel `exams`, `data: { screen: "school" }`) only when the stored date or time moves on an exam families can see, and only once under a race. A successful `POST /evaluations/:id/publish` of a dated draft pushes "set".

- [ ] **Step 1: Write the failing unit tests.** `examDateNotice.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { examDateNotice, examVisibleToFamilies, publishNotice, type ExamForNotice } from "../examDateNotice.ts";

const base: ExamForNotice = { status: "published", archivedAt: null, classGroupId: "c1", examDate: "2026-10-20", examTime: "09:30" };

describe("examVisibleToFamilies", () => {
  it("is a published or closed exam, in a class, not archived", () => {
    assert.equal(examVisibleToFamilies(base), true);
    assert.equal(examVisibleToFamilies({ ...base, status: "closed" }), true);
    assert.equal(examVisibleToFamilies({ ...base, status: "draft" }), false);
    assert.equal(examVisibleToFamilies({ ...base, classGroupId: null }), false);
    assert.equal(examVisibleToFamilies({ ...base, archivedAt: new Date() }), false);
  });
});

describe("examDateNotice", () => {
  it("says nothing when neither date nor time moved", () => {
    assert.equal(examDateNotice(base, { classGroupId: "c1", examDate: "2026-10-20", examTime: "09:30" }), null);
  });
  it("tells a changed date or time", () => {
    assert.deepEqual(examDateNotice(base, { classGroupId: "c1", examDate: "2026-10-20", examTime: "10:15" }), { kind: "changed", examDate: "2026-10-20", examTime: "10:15" });
    assert.deepEqual(examDateNotice(base, { classGroupId: "c1", examDate: "2026-10-21", examTime: null }), { kind: "changed", examDate: "2026-10-21", examTime: null });
  });
  it("tells a date set on an undated exam, and a date cleared", () => {
    const undated = { ...base, examDate: null, examTime: null };
    assert.deepEqual(examDateNotice(undated, { classGroupId: "c1", examDate: "2026-10-22", examTime: null }), { kind: "set", examDate: "2026-10-22", examTime: null });
    assert.deepEqual(examDateNotice(base, { classGroupId: "c1", examDate: null, examTime: null }), { kind: "cleared", examDate: null, examTime: null });
  });
  it("never tells anyone about a draft, an archived exam, or one with no class", () => {
    const moved = { classGroupId: "c1", examDate: "2026-10-25", examTime: null };
    assert.equal(examDateNotice({ ...base, status: "draft" }, moved), null);
    assert.equal(examDateNotice({ ...base, archivedAt: new Date() }, moved), null);
    assert.equal(examDateNotice({ ...base, classGroupId: null }, { ...moved, classGroupId: null }), null);
  });
  it("tells a class newly given a dated exam that the date is set", () => {
    assert.deepEqual(examDateNotice({ ...base, classGroupId: null }, { classGroupId: "c3", examDate: "2026-10-20", examTime: "09:30" }), { kind: "set", examDate: "2026-10-20", examTime: "09:30" });
    assert.deepEqual(examDateNotice(base, { classGroupId: "c3", examDate: "2026-10-20", examTime: "09:30" }), { kind: "set", examDate: "2026-10-20", examTime: "09:30" });
  });
  it("says nothing when the class is taken away or a new class gets an undated exam", () => {
    assert.equal(examDateNotice(base, { classGroupId: null, examDate: "2026-10-20", examTime: "09:30" }), null);
    assert.equal(examDateNotice({ ...base, classGroupId: null, examDate: null, examTime: null }, { classGroupId: "c3", examDate: null, examTime: null }), null);
  });
});

describe("publishNotice", () => {
  const draft = { ...base, status: "draft" };
  it("announces the date of a dated draft in a class being published", () => {
    assert.deepEqual(publishNotice(draft), { kind: "set", examDate: "2026-10-20", examTime: "09:30" });
  });
  it("says nothing for an undated draft, one with no class, or a re-publish", () => {
    assert.equal(publishNotice({ ...draft, examDate: null, examTime: null }), null);
    assert.equal(publishNotice({ ...draft, classGroupId: null }), null);
    assert.equal(publishNotice(base), null);
    assert.equal(publishNotice({ ...base, status: "closed" }), null);
  });
});
```

Append to `familyPushText.test.ts` (and add `examDateText` to its import):

```ts
describe("examDateText", () => {
  const set = examDateText({ examTitle: "اختبار الوحدة الأولى", className: "10A maths", notice: { kind: "set", examDate: "2026-10-20", examTime: "09:30" } });
  it("tells the day and time, by string", () => {
    assert.equal(set.student.title, "موعد امتحان: اختبار الوحدة الأولى");
    assert.ok(set.student.body.includes("⁦20-10-2026⁩"));
    assert.ok(set.student.body.includes("⁦09:30⁩"));
    assert.equal(set.guardian("سارة").title, "سارة: موعد امتحان");
  });
  it("leaves the time out when there is none", () => {
    const noTime = examDateText({ examTitle: "x", className: "c", notice: { kind: "set", examDate: "2026-10-20", examTime: null } });
    assert.equal(noTime.student.body.includes("الساعة"), false);
  });
  it("says changed and cleared plainly", () => {
    const changed = examDateText({ examTitle: "x", className: "c", notice: { kind: "changed", examDate: "2026-10-21", examTime: null } });
    assert.equal(changed.student.title, "تغيّر موعد امتحان: x");
    assert.equal(changed.guardian("آدم").title, "آدم: تغيّر موعد امتحان");
    const cleared = examDateText({ examTitle: "x", className: "c", notice: { kind: "cleared", examDate: null, examTime: null } });
    assert.equal(cleared.student.title, "أُلغي موعد امتحان: x");
    assert.ok(cleared.student.body.includes("لم يعد له موعد محدّد"));
  });
  it("keeps every title within TITLE_MAX", () => {
    for (const kind of ["set", "changed"] as const) {
      const t = examDateText({ examTitle: LONG, className: LONG, notice: { kind, examDate: "2026-10-20", examTime: "09:30" } });
      titleFits(t.student.title);
      titleFits(t.guardian(LONG).title);
    }
  });
});
```

- [ ] **Step 2: Write the failing DB test** (`examDatePush.db.test.ts`):

```ts
/**
 * What this guards: the push a family gets when an exam's date is set,
 * changed or cleared. Every way it goes wrong is a leak or noise: a dated
 * draft or an exam with no class announced (no family can see either), a
 * group check announced to the whole class, a save that changed nothing
 * announced, an archived exam announced, another family told, and two racing
 * saves announcing twice. Cases run in order: exDated's schedule is shared.
 */
import { after, before, beforeEach, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call, type CallResult } from "../../test-support/http.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { ammanDay, EX_TITLES, seedExams, type ExamWorld } from "../../test-support/seedExams.ts";
import { startPushStub, type PushStub } from "../../test-support/pushStub.ts";
import { ownersReached, seedPushWorld, sentTo, setPushPrefs, shownDay } from "../../test-support/seedPush.ts";

describeDb("exam date pushes, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;
  let x: ExamWorld;

  const patch = (examId: string, body: Record<string, unknown>, teacher?: string) =>
    call(server, "PATCH", `/evaluations/${examId}`, teacher ?? w.users.t1, body);
  const ok = async (p: Promise<CallResult>) => {
    const r = await p;
    assert.equal(r.status, 200, `${r.status} ${r.text}\n${server.logs().slice(-1000)}`);
    return r;
  };
  const titlesTo = (owner: "parentA" | "parentB", msgs = stub.messages()) => [...new Set(sentTo(msgs, owner).map(m => m.title))].sort();

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    await seedPushWorld(db.pool, w);
    stub = await startPushStub();
    server = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url } });
  });
  after(async () => {
    await server?.stop();
    await stub?.close();
    await db?.drop();
  });
  beforeEach(() => stub.clear());

  it("tells the class's students and guardians that a time changed", async () => {
    await ok(patch(x.exams.exDated, { examTime: "10:15" }));
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA", "studentA"]);
    const [toStudent] = sentTo(msgs, "studentA");
    assert.equal(toStudent.title, `تغيّر موعد امتحان: ${EX_TITLES.exDated}`);
    assert.ok(toStudent.body.includes(shownDay(x.dates.exDated)));
    assert.ok(toStudent.body.includes("⁦10:15⁩"));
    assert.equal(sentTo(msgs, "parentA").length, 4, "two children × two devices");
    assert.deepEqual(titlesTo("parentA", msgs), [`${CHILDREN.adam}: تغيّر موعد امتحان`, `${CHILDREN.sara}: تغيّر موعد امتحان`].sort());
    for (const m of msgs) {
      assert.equal(m.channelId, "exams");
      assert.deepEqual(m.data, { screen: "school" });
    }
  });

  it("says nothing when a save does not move the date or time", async () => {
    await ok(patch(x.exams.exDated, { examDate: x.dates.exDated, examTime: "10:15" }));
    await ok(patch(x.exams.exDated, { classGroupId: w.classes.c1 }));
    assert.deepEqual(await stub.settle(200), []);
  });

  it("tells a cleared date, then a date set again", async () => {
    await ok(patch(x.exams.exDated, { examDate: null }));
    assert.equal(sentTo(stub.messages(), "studentA")[0]?.title, `أُلغي موعد امتحان: ${EX_TITLES.exDated}`);
    stub.clear();
    await ok(patch(x.exams.exDated, { examDate: ammanDay(8), examTime: "09:00" }));
    assert.equal(sentTo(stub.messages(), "studentA")[0]?.title, `موعد امتحان: ${EX_TITLES.exDated}`);
  });

  it("leaves out a guardian who switched exam dates off", async () => {
    await setPushPrefs(db.pool, w.users.parentA, { exams: false });
    try {
      await ok(patch(x.exams.exDated, { examTime: "12:00" }));
      assert.deepEqual(ownersReached(stub.messages()), ["studentA"]);
    } finally {
      await setPushPrefs(db.pool, w.users.parentA, {});
    }
  });

  it("announces once when two identical saves race", async () => {
    // Best effort: both requests usually read the old time before either
    // writes. See the plan's Task 7 mutation proof (c) for how this is judged.
    const [a, b] = await Promise.all([patch(x.exams.exDated, { examTime: "11:45" }), patch(x.exams.exDated, { examTime: "11:45" })]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(sentTo(await stub.settle(300), "studentA").length, 1);
  });

  it("never announces a dated draft, an archived exam, or an exam with no class", async () => {
    await ok(patch(x.exams.exDraftDated, { examDate: ammanDay(9) }));
    await ok(patch(x.exams.exPaperArchived, { examDate: ammanDay(9) }));
    await ok(patch(x.exams.exNoClass, { examTime: "13:00" }));
    assert.deepEqual(await stub.settle(300), []);
  });

  it("tells only the class a dated exam is attached to", async () => {
    await ok(patch(x.exams.exNoClass, { classGroupId: w.classes.c3 }));
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentB", "studentB"]);
    assert.deepEqual(titlesTo("parentB", msgs), [`${CHILDREN.noor}: موعد امتحان`]);
  });

  it("tells a group check's students only", async () => {
    // exGroup is for Adam alone (support groups).
    await ok(patch(x.exams.exGroup, { examDate: ammanDay(10) }));
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA"]);
    assert.deepEqual(titlesTo("parentA", msgs), [`${CHILDREN.adam}: موعد امتحان`]);
  });

  it("announces a dated draft when it is published, and not again on a re-publish", async () => {
    await ok(patch(x.exams.exPaperDraft, { examDate: ammanDay(11) }));
    assert.deepEqual(await stub.settle(200), [], "still a draft");
    const published = await call(server, "POST", `/evaluations/${x.exams.exPaperDraft}/publish`, w.users.t1);
    assert.equal(published.status, 200, published.text);
    assert.equal(sentTo(stub.messages(), "studentA")[0]?.title, `موعد امتحان: ${EX_TITLES.exPaperDraft}`);
    stub.clear();
    assert.equal((await call(server, "POST", `/evaluations/${x.exams.exPaperDraft}/publish`, w.users.t1)).status, 200);
    assert.deepEqual(await stub.settle(200), []);
  });

  it("pushes nothing for another teacher's refused save", async () => {
    assert.equal((await patch(x.exams.exDated, { examTime: "14:00" }, w.users.t2)).status, 404);
    assert.deepEqual(await stub.settle(200), []);
  });
});
```

`CallResult` is exported from `test-support/http.ts` already. `CHILDREN.noor` is `«نور»`. Run both test files, and they should FAIL with the module missing and no pushes.

- [ ] **Step 3: Write `examDateNotice.ts`:**

```ts
/**
 * When a change to an exam's planned day is news to families, and what kind.
 *
 * Families see an exam's date only on an exam they can already see
 * (`studentExamRow` / `examRowsFor`): published or closed, attached to a class
 * — and here also not archived, since a teacher archives an exam to put it
 * away. So a dated draft or an exam with no class announces nothing, ever:
 * a push would leak what the School tab hides.
 *
 * The day is zone-less text (`exam_date` / `exam_time`); this compares strings.
 */
export interface ExamSchedule {
  classGroupId: string | null;
  examDate: string | null;
  examTime: string | null;
}

export interface ExamForNotice extends ExamSchedule {
  status: string;
  archivedAt: Date | null;
}

export type ExamDateNotice =
  | { kind: "set" | "changed"; examDate: string; examTime: string | null }
  | { kind: "cleared"; examDate: null; examTime: null };

export function examVisibleToFamilies(e: { status: string; classGroupId: string | null; archivedAt: Date | null }): boolean {
  return (e.status === "published" || e.status === "closed") && !!e.classGroupId && !e.archivedAt;
}

/**
 * A PATCH's news, if any. A class that newly sees a dated exam (attached, or
 * moved to it) hears the date as `set`; the class it left is not told.
 */
export function examDateNotice(before: ExamForNotice, after: ExamSchedule): ExamDateNotice | null {
  if (!examVisibleToFamilies({ ...before, classGroupId: after.classGroupId })) return null;
  const sameFamilies = examVisibleToFamilies(before) && before.classGroupId === after.classGroupId;
  if (!sameFamilies) return after.examDate ? { kind: "set", examDate: after.examDate, examTime: after.examTime } : null;
  if (before.examDate === after.examDate && before.examTime === after.examTime) return null;
  if (after.examDate === null) return { kind: "cleared", examDate: null, examTime: null };
  if (before.examDate === null) return { kind: "set", examDate: after.examDate, examTime: after.examTime };
  return { kind: "changed", examDate: after.examDate, examTime: after.examTime };
}

/** Publishing a dated draft is the moment its date becomes visible. A re-publish is not news. */
export function publishNotice(before: ExamForNotice): ExamDateNotice | null {
  if (before.status !== "draft" || !before.examDate) return null;
  if (!examVisibleToFamilies({ ...before, status: "published" })) return null;
  return { kind: "set", examDate: before.examDate, examTime: before.examTime };
}
```

- [ ] **Step 4: Append to `familyPushText.ts`.** Add `import type { ExamDateNotice } from "./examDateNotice.ts";` at the top, then:

```ts
export function examDateText(i: { examTitle: string; className: string; notice: ExamDateNotice }): FamilyText {
  const name = i.examTitle.trim() || "الامتحان";
  const quoted = `«${clip(name, 60)}»`;
  const n = i.notice;
  if (n.kind === "cleared") {
    return {
      student: { title: titled("أُلغي موعد امتحان: ", name), body: `لم يعد له موعد محدّد — ${i.className}.` },
      guardian: child => ({ title: forChild(child, "أُلغي موعد امتحان"), body: `${quoted} لم يعد له موعد محدّد — ${i.className}.` }),
    };
  }
  const when = `يوم ${pushDay(n.examDate)}${n.examTime ? ` الساعة ${pushTime(n.examTime)}` : ""}`;
  if (n.kind === "changed") {
    return {
      student: { title: titled("تغيّر موعد امتحان: ", name), body: `الموعد الجديد: ${when} — ${i.className}.` },
      guardian: child => ({ title: forChild(child, "تغيّر موعد امتحان"), body: `${quoted} — الموعد الجديد: ${when} — ${i.className}.` }),
    };
  }
  return {
    student: { title: titled("موعد امتحان: ", name), body: `${when} — ${i.className}.` },
    guardian: child => ({ title: forChild(child, "موعد امتحان"), body: `${quoted} ${when} — ${i.className}.` }),
  };
}
```

- [ ] **Step 5: Append to `lib/familyPushEvents.ts`.** Add the imports `import { classGroups, db } from "@workspace/db";`, `import { and, eq, isNull } from "drizzle-orm";`, `import { assignedStudentsByEvaluation } from "./evaluationAudience.ts";`, `import { audienceFor, inAudience } from "../modules/assessment/audience.ts";`, `import type { ExamDateNotice } from "../modules/notifications/examDateNotice.ts";`, and extend the text import with `examDateText`. Then:

```ts
/**
 * An exam's date set, changed or cleared: the live children of its (live)
 * class, narrowed to its audience — a group check reaches its own students
 * only, the same rule the family exam list applies (`examVisibleTo`).
 */
export async function announceExamDate(
  exam: { id: string; title: string; titleAr: string; classGroupId: string | null },
  notice: ExamDateNotice,
): Promise<FamilyPushOutcome | null> {
  if (!exam.classGroupId) return null;
  const [klass] = await db
    .select({ name: classGroups.name, nameAr: classGroups.nameAr })
    .from(classGroups)
    .where(and(eq(classGroups.id, exam.classGroupId), isNull(classGroups.archivedAt)))
    .limit(1);
  if (!klass) return null;
  const audience = audienceFor((await assignedStudentsByEvaluation([exam.id])).get(exam.id));
  const studentIds = (await liveClassStudentIds(exam.classGroupId)).filter(id => inAudience(audience, id));
  const text = examDateText({ examTitle: exam.titleAr || exam.title, className: classLabel(klass), notice });
  return sendFamilyPush({
    category: "exams",
    accounts: await accountsLinkedTo(studentIds),
    data: { screen: "school" },
    text: r => (r.relation === "guardian" ? text.guardian(r.childName) : text.student),
  });
}
```

- [ ] **Step 6: Hook the PATCH, race-safe.** In `routes/evaluations.ts` add the imports:

```ts
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { pushWithin } from "../lib/pushWithin.ts";
import { announceExamDate } from "../lib/familyPushEvents.ts";
import { examDateNotice, publishNotice } from "../modules/notifications/examDateNotice.ts";
```

and next to `trimmed`:

```ts
/** "This column still holds what the request read" — null included. */
const stillHolds = (col: AnyPgColumn, value: string | null) => sql`${col} IS NOT DISTINCT FROM ${value}`;
```

In `PATCH /evaluations/:id`, replace the `const [updated] = await db.update(evaluations)…returning();` statement and its following `res.json` with:

```ts
    const next = { classGroupId: classGroupId || null, examDate: schedule.examDate, examTime: schedule.examTime };
    const values = { ...next, updatedAt: new Date() };
    // Families hear about a date only when it actually moved on an exam they
    // can see (examDateNotice). The write that announces is conditional on
    // the values this request read, so two PATCHes racing each other cannot
    // both announce: the loser falls through to the plain write and stays quiet.
    const notice = examDateNotice(evaluation, next);
    const [claimed] = notice
      ? await db
          .update(evaluations)
          .set(values)
          .where(
            and(
              eq(evaluations.id, evaluation.id),
              stillHolds(evaluations.classGroupId, evaluation.classGroupId),
              stillHolds(evaluations.examDate, evaluation.examDate),
              stillHolds(evaluations.examTime, evaluation.examTime),
            ),
          )
          .returning()
      : [];
    const [updated] = claimed
      ? [claimed]
      : await db.update(evaluations).set(values).where(eq(evaluations.id, evaluation.id)).returning();
    if (claimed && notice) await pushWithin("exam date", () => announceExamDate(claimed, notice));

    res.json({ evaluation: updated });
```

Add one sentence to the route's doc comment: «A date that moves on an exam families can see is pushed to them (modules/notifications/examDateNotice.ts) — once, even under racing saves.»

- [ ] **Step 7: Hook publish.** In `POST /evaluations/:id/publish`, replace the final `res.json({ evaluation: updated });` with:

```ts
    // A dated draft leaving draft is the moment its date reaches families.
    // Not race-safe (a known gap): two publishes of one draft racing each other
    // can both announce — the write above retries on a share-code collision,
    // which a conditional write would turn into a failed publish.
    const notice = publishNotice(evaluation);
    if (notice) await pushWithin("exam published with a date", () => announceExamDate(updated, notice));
    res.json({ evaluation: updated });
```

- [ ] **Step 8: Run all three test files again and confirm they pass.** Then `pnpm run typecheck`.

- [ ] **Step 9: Mutation proof** (report, revert): (a) in `examDateNotice` replace `examVisibleToFamilies({ ...before, classGroupId: after.classGroupId })` with `!!after.classGroupId`, and the unit "never tells anyone about a draft…" and the DB "never announces a dated draft…" should go red; (b) in `announceExamDate` drop the `.filter(id => inAudience(audience, id))`, and "tells a group check's students only" should go red; (c) replace the `stillHolds(…)` conditions with nothing (an unconditional `claimed`), then run the race case **three times**. Report how often it went red. If it never goes red, **delete that case** (a test that cannot fail is noise) and say so in the report; the conditional write stays either way. (d) Delete the equality line `if (before.examDate === after.examDate && …) return null;`, and "says nothing when a save does not move…" should go red.

- [ ] **Step 10: Commit**

```bash
git add artifacts/api-server/src
git commit -m "feat(api): an exam date set, changed or cleared is pushed to the families who can see it — once, never for a draft"
```

---

### Task 8: A paper mark typed after the release

**Files:**
- Modify: `artifacts/api-server/src/lib/familyPushEvents.ts` (append), `artifacts/api-server/src/routes/evaluations.ts` (`PUT /evaluations/:id/paper-totals`)
- Test: `artifacts/api-server/src/routes/__tests__/paperTotalsPush.db.test.ts`

**Interfaces:**
- Consumes: Task 5's `finalResultStudentIds`, `sendFamilyPush`, `accountsLinkedTo`; `releaseAnnouncement` (`lib/resultsRelease.ts`); Task 3's `pushWithin`.
- Produces: `announcePaperResults(exam: { id: string; title: string; titleAr: string }, savedStudentIds: readonly string[]): Promise<FamilyPushOutcome>`. In HTTP terms, a `paper-totals` row that answers `saved` while `releaseResultsToStudent` is on pushes that child's accounts the release text (channel `results`, `data: { screen: "my-exams" }`) before the response.

- [ ] **Step 1: Write the failing DB test** (`paperTotalsPush.db.test.ts`):

```ts
/**
 * What this guards: a paper mark typed AFTER the teacher released results is
 * visible to the family at once, so it is announced at once — and only then.
 * Not before the release (the release itself announces), not for a re-save
 * of the same mark, not for a cleared mark or a refused row, not to an
 * account that switched results off. Cases run in order on exPaper.
 */
import { after, before, beforeEach, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { EX_TITLES, seedExams, type ExamWorld } from "../../test-support/seedExams.ts";
import { startPushStub, type PushStub } from "../../test-support/pushStub.ts";
import { ownersReached, seedPushWorld, sentTo, setPushPrefs } from "../../test-support/seedPush.ts";

describeDb("paper marks typed after the release, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;
  let x: ExamWorld;

  const statuses = async (rows: Array<{ studentId: string; marks: number | null }>) => {
    const r = await call(server, "PUT", `/evaluations/${x.exams.exPaper}/paper-totals`, w.users.t1, { totals: rows });
    assert.equal(r.status, 200, `${r.text}\n${server.logs().slice(-1000)}`);
    return (r.json.results as Array<{ status: string }>).map(row => row.status);
  };

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    await seedPushWorld(db.pool, w);
    stub = await startPushStub();
    server = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url } });
  });
  after(async () => {
    await server?.stop();
    await stub?.close();
    await db?.drop();
  });
  beforeEach(() => stub.clear());

  it("pushes nothing for a mark typed before the release", async () => {
    assert.deepEqual(await statuses([{ studentId: w.students.sA1, marks: 15 }]), ["saved"]);
    assert.deepEqual(await stub.settle(300), []);
  });

  it("(setup) releasing announces Sara's mark, as the release always did", async () => {
    const r = await call(server, "POST", `/evaluations/${x.exams.exPaper}/results-release`, w.users.t1, { released: true });
    assert.equal(r.status, 200);
    await stub.waitFor(m => sentTo(m, "studentA").length > 0);
    await stub.settle(200);
  });

  it("tells the family of a mark typed after the release, naming the child, before answering", async () => {
    assert.deepEqual(await statuses([{ studentId: w.students.aA, marks: 12 }]), ["saved"]);
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA"]);
    assert.equal(msgs.length, 2, "one child × two devices");
    for (const m of msgs) {
      assert.equal(m.title, `نتيجة ${CHILDREN.adam}`);
      assert.ok(m.body.includes(EX_TITLES.exPaper));
      assert.equal(m.channelId, "results");
      assert.deepEqual(m.data, { screen: "my-exams" });
    }
  });

  it("says nothing when the same mark is saved again", async () => {
    assert.deepEqual(await statuses([{ studentId: w.students.aA, marks: 12 }]), ["unchanged"]);
    assert.deepEqual(await stub.settle(200), []);
  });

  it("tells the child and the guardian again when a mark is corrected", async () => {
    assert.deepEqual(await statuses([{ studentId: w.students.sA1, marks: 16 }]), ["saved"]);
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA", "studentA"]);
    assert.deepEqual([...new Set(sentTo(msgs, "parentA").map(m => m.title))], [`نتيجة ${CHILDREN.sara}`]);
  });

  it("says nothing for a cleared mark or a refused row", async () => {
    assert.deepEqual(
      await statuses([
        { studentId: w.students.aA, marks: null },
        { studentId: w.students.nB1, marks: 5 },
      ]),
      ["cleared", "error"],
    );
    assert.deepEqual(await stub.settle(200), []);
  });

  it("leaves out an account that switched results off", async () => {
    await setPushPrefs(db.pool, w.users.parentA, { results: false });
    try {
      assert.deepEqual(await statuses([{ studentId: w.students.aA, marks: 11 }]), ["saved"]);
      assert.deepEqual(await stub.settle(200), []);
    } finally {
      await setPushPrefs(db.pool, w.users.parentA, {});
    }
  });
});
```

Run it, and it should FAIL: "tells the family…" receives nothing. The "before the release", "unchanged" and "cleared" cases already pass, which is expected because they pin silence.

- [ ] **Step 2: Append to `lib/familyPushEvents.ts`.** Add `import { finalResultStudentIds } from "./resultsReleaseNotify.ts";` and `import { releaseAnnouncement } from "./resultsRelease.ts";`, then:

```ts
/**
 * Paper marks typed after the release: the release's own words, to the
 * children whose mark this request saved and whose result is now final.
 */
export async function announcePaperResults(
  exam: { id: string; title: string; titleAr: string },
  savedStudentIds: readonly string[],
): Promise<FamilyPushOutcome> {
  const text = releaseAnnouncement(exam);
  return sendFamilyPush({
    category: "results",
    accounts: await accountsLinkedTo(await finalResultStudentIds(exam.id, savedStudentIds)),
    data: { screen: "my-exams" },
    text: r => (r.relation === "guardian" ? text.guardianPush(r.childName) : { title: text.pushTitle, body: text.pushBody }),
  });
}
```

- [ ] **Step 3: Hook the route.** In `PUT /evaluations/:id/paper-totals`, extend the import from `../lib/familyPushEvents.ts` with `announcePaperResults` and replace `res.json({ maxMarks: outcome.maxMarks, results: outcome.results });` with:

```ts
    // A mark typed after the release is visible to the family at once
    // (studentResultReady), and the release's own announcement has already
    // gone — so announce it now. Only rows this request changed: a re-save of
    // the same total answers "unchanged" and says nothing.
    const saved = outcome.results.filter(r => r.status === "saved").map(r => r.studentId);
    if (evaluation.releaseResultsToStudent && saved.length > 0) {
      await pushWithin("paper results", () => announcePaperResults(evaluation, saved));
    }
    res.json({ maxMarks: outcome.maxMarks, results: outcome.results });
```

Add to the route's doc comment: «A row saved while results are released is pushed to that child's family (lib/familyPushEvents.ts). A sitting handed in after the release through `POST /attempts/:id/submit` or the student link is not — a known gap.»

- [ ] **Step 4: Run the test again and confirm it passes.** Then `pnpm run typecheck`.

- [ ] **Step 5: Mutation proof** (report, revert): (a) drop `evaluation.releaseResultsToStudent &&`, and "pushes nothing for a mark typed before the release" should go red; (b) filter `r.status !== "error"` instead of `=== "saved"`, and "says nothing when the same mark is saved again" should go red.

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src
git commit -m "feat(api): a paper mark typed after the release is pushed to that child's family"
```

---

### Task 9: The day-before reminder: `POST /internal/homework-reminders`

**Files:**
- Modify: `artifacts/api-server/src/modules/homework/rules.ts` (export `addDays`), `artifacts/api-server/src/modules/notifications/familyPushText.ts` (append), `artifacts/api-server/src/routes/index.ts`, `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`, `artifacts/api-server/src/test-support/seedPush.ts` (append)
- Create: `artifacts/api-server/src/modules/notifications/reminders.ts`, `artifacts/api-server/src/lib/homeworkReminders.ts`, `artifacts/api-server/src/routes/internal.ts`
- Test: `artifacts/api-server/src/modules/notifications/__tests__/reminders.test.ts`, `familyPushText.test.ts` (append), `artifacts/api-server/src/routes/__tests__/homeworkReminders.db.test.ts`

**Interfaces:**
- Consumes: Task 1 `homeworkReminders`; Tasks 5–6 (`sendFamilyPush`, `accountsLinkedTo`, `liveClassStudentIds`, `classLabel`, `clip`); `dueDateToDueAt`, `dueAtToDueDate` (`rules.ts`); `siteKeyMatches` (`lib/adminMetrics.ts`).
- Produces:
  - `rules.ts`: `export function addDays(date: string, days: number): string`. It was private; nothing else changes.
  - `reminders.ts`: `reminderWindow(now: Date): { dueDate: string; after: Date; upTo: Date }`, `type ReminderKind = "tracked" | "untracked"`, `reminderKind(row: { hasAccount: boolean; done: boolean }): ReminderKind | null`.
  - `familyPushText.ts`: `homeworkReminderText(i: { title: string; className: string }): { student: PushText; guardianTracked: (child: string) => PushText; guardianUntracked: (child: string) => PushText }`.
  - `lib/homeworkReminders.ts`: `interface ReminderRun { homework: number; pushed: number }`, `runHomeworkReminders(now?: Date): Promise<ReminderRun>`.
  - HTTP: `POST /internal/homework-reminders` with header `x-internal-key` = `INTERNAL_CRON_KEY` returns `200 { homework, pushed }`. Anything else, including an unset key, returns `404 { error: "Not found" }`.
  - `seedPush.ts`: `RM_TITLES`, `ammanDueAt(offsetDays: number, now?: Date): Date`, `seedReminderHomework(pool, w): Promise<Record<keyof typeof RM_TITLES, string>>`.

- [ ] **Step 1: Write the failing unit tests.** `reminders.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { reminderKind, reminderWindow } from "../reminders.ts";

describe("reminderWindow", () => {
  it("is the Amman day after today, as instants", () => {
    const w = reminderWindow(new Date("2026-10-14T13:00:00Z")); // 16:00 Amman, 14 Oct
    assert.equal(w.dueDate, "2026-10-15");
    assert.equal(w.after.toISOString(), "2026-10-14T20:59:59.999Z"); // end of 14 Oct, Amman
    assert.equal(w.upTo.toISOString(), "2026-10-15T20:59:59.999Z"); // end of 15 Oct, Amman
  });
  it("rolls with the Amman day, not the UTC one", () => {
    assert.equal(reminderWindow(new Date("2026-10-14T20:59:59Z")).dueDate, "2026-10-15"); // 23:59:59 Amman
    assert.equal(reminderWindow(new Date("2026-10-14T21:00:00Z")).dueDate, "2026-10-16"); // 00:00 Amman, 15 Oct
  });
  it("crosses a month and a year", () => {
    assert.equal(reminderWindow(new Date("2026-12-31T10:00:00Z")).dueDate, "2027-01-01");
  });
});

describe("reminderKind", () => {
  it("reminds a child with an account who has not ticked it", () => {
    assert.equal(reminderKind({ hasAccount: true, done: false }), "tracked");
  });
  it("says nothing about a ticked one", () => {
    assert.equal(reminderKind({ hasAccount: true, done: true }), null);
    assert.equal(reminderKind({ hasAccount: false, done: true }), null);
  });
  it("gives a child nobody can tick for the softer reminder", () => {
    assert.equal(reminderKind({ hasAccount: false, done: false }), "untracked");
  });
});
```

Append to `familyPushText.test.ts` (and add `homeworkReminderText` to its import):

```ts
describe("homeworkReminderText", () => {
  const t = homeworkReminderText({ title: "حل تمارين ص 45", className: "10A maths" });
  it("tells a student and a tracked child's guardian it is not marked done", () => {
    assert.equal(t.student.title, "تذكير: واجب موعده غدًا");
    assert.ok(t.student.body.includes("لم يُعلَّم كمُنجَز بعد"));
    assert.equal(t.guardianTracked("سارة").title, "سارة: واجب موعده غدًا");
    assert.ok(t.guardianTracked("سارة").body.includes("لم يُعلَّم كمُنجَز بعد"));
  });
  it("never claims 'not done' when nobody can tick it", () => {
    const soft = t.guardianUntracked("آدم");
    assert.equal(soft.title, "آدم: واجب موعده غدًا");
    assert.equal(soft.body.includes("لم يُعلَّم"), false);
    assert.ok(soft.body.includes("«حل تمارين ص 45»"));
  });
});
```

- [ ] **Step 2: Append to `seedPush.ts`:**

```ts
/** Reminder homework (homeworkReminders.db.test.ts). Unique titles, so a test can find each in a push body. */
export const RM_TITLES = {
  c1: "rm-c1",
  c1Done: "rm-c1-done",
  c3: "rm-c3",
  c2: "rm-c2",
  today: "rm-today",
  dayAfter: "rm-day-after",
  archived: "rm-archived",
  archivedClass: "rm-archived-class",
} as const;

/** The instant a due date `offsetDays` Amman days from now is stored as: the end of that day, Amman. */
export function ammanDueAt(offsetDays: number, now: Date = new Date()): Date {
  const day = new Date(now.getTime() + 3 * 3_600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - 3 * 3_600_000);
}

/**
 * Homework around "tomorrow" (Amman), each there to be reminded about or to
 * be left alone:
 *   c1 (t1, tomorrow)        Sara (account, not done) + Adam (no account)
 *   c1Done (t1, tomorrow)    Sara has ticked it; Adam still has no account
 *   c3 (t1, tomorrow)        Noor — family B
 *   c2 (t2, tomorrow)        Sara's second row (no account) + Adam's ARCHIVED row
 *   today / dayAfter          not tomorrow
 *   archived / archivedClass  archived homework / homework in the archived class c4
 */
export async function seedReminderHomework(pool: Pool, w: FamilyWorld): Promise<Record<keyof typeof RM_TITLES, string>> {
  const { t1, t2 } = w.users;
  const { c1, c2, c3, c4 } = w.classes;
  const hw = async (teacher: string, klass: string, title: string, offset: number, archived = false) =>
    (
      await pool.query<{ id: string }>(
        `INSERT INTO homework (teacher_id, class_group_id, title, due_at, archived_at)
         VALUES ($1, $2, $3, $4, CASE WHEN $5::boolean THEN now() END) RETURNING id`,
        [teacher, klass, title, ammanDueAt(offset), archived],
      )
    ).rows[0].id;
  const ids = {
    c1: await hw(t1, c1, RM_TITLES.c1, 1),
    c1Done: await hw(t1, c1, RM_TITLES.c1Done, 1),
    c3: await hw(t1, c3, RM_TITLES.c3, 1),
    c2: await hw(t2, c2, RM_TITLES.c2, 1),
    today: await hw(t1, c1, RM_TITLES.today, 0),
    dayAfter: await hw(t1, c1, RM_TITLES.dayAfter, 2),
    archived: await hw(t1, c1, RM_TITLES.archived, 1, true),
    archivedClass: await hw(t1, c4, RM_TITLES.archivedClass, 1),
  };
  await pool.query(`INSERT INTO homework_completions (homework_id, student_id) VALUES ($1, $2)`, [ids.c1Done, w.students.sA1]);
  return ids;
}
```

- [ ] **Step 3: Write the failing DB test** (`homeworkReminders.db.test.ts`):

```ts
/**
 * What this guards: the day-before reminder. Wrong in three ways: the wrong
 * people (a ticked-off child, another family, an archived row, a suspended or
 * switched-off account), the wrong words ("not done" about a child nobody can
 * tick for), and the wrong number of times (a second run must send nothing).
 * The trigger is a shared key: wrong, missing or UNSET is a 404.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { startPushStub, type PushStub, type StubMessage } from "../../test-support/pushStub.ts";
import { ammanDueAt, ownersReached, RM_TITLES, seedPushWorld, seedReminderHomework, sentTo, setPushPrefs } from "../../test-support/seedPush.ts";

const KEY = "test-cron-key-0123456789abcdef";
const PATH = "/internal/homework-reminders";

describeDb("homework reminders, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let keyless: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;
  let hw: Record<keyof typeof RM_TITLES, string>;

  const trigger = (on: TestServer, key?: string) =>
    fetch(`${on.base}${PATH}`, { method: "POST", headers: key === undefined ? {} : { "x-internal-key": key } });
  const about = (msgs: StubMessage[], title: string) => msgs.filter(m => m.body.includes(`«${title}»`));
  const claims = async () => Number((await db.pool.query(`SELECT count(*) AS n FROM homework_reminders`)).rows[0].n);

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await seedPushWorld(db.pool, w);
    hw = await seedReminderHomework(db.pool, w);
    await setPushPrefs(db.pool, w.users.parentB, { homework: false });
    stub = await startPushStub();
    server = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url, INTERNAL_CRON_KEY: KEY } });
    keyless = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url, INTERNAL_CRON_KEY: undefined } });
  });
  after(async () => {
    await server?.stop();
    await keyless?.stop();
    await stub?.close();
    await db?.drop();
  });

  it("is a 404 without the right key, and with no key configured at all", async () => {
    assert.equal((await trigger(server)).status, 404);
    assert.equal((await trigger(server, "wrong")).status, 404);
    assert.equal((await trigger(keyless, KEY)).status, 404);
    assert.equal((await trigger(keyless, "")).status, 404);
    assert.equal(await claims(), 0);
    assert.deepEqual(await stub.settle(200), []);
  });

  it("reminds about homework due tomorrow, saying 'not marked done' only where someone can tick", async () => {
    const res = await trigger(server, KEY);
    assert.equal(res.status, 200, server.logs().slice(-1500));
    const body = (await res.json()) as { homework: number; pushed: number };
    const msgs = stub.messages();

    // rm-c1: Sara (account, not done) and Adam (no account).
    const c1 = about(msgs, RM_TITLES.c1);
    assert.deepEqual(ownersReached(c1), ["parentA", "studentA"]);
    assert.equal(sentTo(c1, "studentA")[0]?.title, "تذكير: واجب موعده غدًا");
    assert.ok(sentTo(c1, "studentA")[0]?.body.includes("لم يُعلَّم كمُنجَز بعد"));
    const saraPush = sentTo(c1, "parentA").filter(m => m.title === `${CHILDREN.sara}: واجب موعده غدًا`);
    const adamPush = sentTo(c1, "parentA").filter(m => m.title === `${CHILDREN.adam}: واجب موعده غدًا`);
    assert.equal(saraPush.length, 2);
    assert.equal(adamPush.length, 2);
    assert.ok(saraPush.every(m => m.body.includes("لم يُعلَّم كمُنجَز بعد")));
    assert.ok(adamPush.every(m => !m.body.includes("لم يُعلَّم")), "Adam has no account: never 'not done'");

    // rm-c1-done: Sara ticked it, so only Adam's softer reminder.
    const done = about(msgs, RM_TITLES.c1Done);
    assert.deepEqual(ownersReached(done), ["parentA"]);
    assert.deepEqual([...new Set(done.map(m => m.title))], [`${CHILDREN.adam}: واجب موعده غدًا`]);

    // rm-c3: Noor's own account; her guardian switched homework off.
    assert.deepEqual(ownersReached(about(msgs, RM_TITLES.c3)), ["studentB"]);

    // rm-c2: Sara's second row has no account (soft); Adam's row there is archived.
    const c2 = about(msgs, RM_TITLES.c2);
    assert.deepEqual(ownersReached(c2), ["parentA"]);
    assert.deepEqual([...new Set(c2.map(m => m.title))], [`${CHILDREN.sara}: واجب موعده غدًا`]);
    assert.ok(c2.every(m => !m.body.includes("لم يُعلَّم")));

    for (const quiet of [RM_TITLES.today, RM_TITLES.dayAfter, RM_TITLES.archived, RM_TITLES.archivedClass]) {
      assert.deepEqual(about(msgs, quiet), [], quiet);
    }
    for (const owner of ["suspendedParent", "parentB", "t1", "t2", "studentUnlinked"] as const) {
      assert.equal(sentTo(msgs, owner).length, 0, owner);
    }
    for (const m of msgs) {
      assert.equal(m.channelId, "homework");
      assert.deepEqual(m.data, { screen: "school" });
    }
    assert.deepEqual(body, { homework: 4, pushed: msgs.length });
    assert.equal(msgs.length, 10, "rm-c1 5 + rm-c1-done 2 + rm-c3 1 + rm-c2 2");
    assert.equal(await claims(), 4);
  });

  it("sends nothing twice: a second run the same day is empty", async () => {
    stub.clear();
    const res = await trigger(server, KEY);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { homework: 0, pushed: 0 });
    assert.deepEqual(await stub.settle(200), []);
  });

  it("reminds again for a homework whose due date moved to tomorrow", async () => {
    stub.clear();
    await db.pool.query(`UPDATE homework SET due_at = $2 WHERE id = $1`, [hw.dayAfter, ammanDueAt(1)]);
    const res = await trigger(server, KEY);
    assert.equal(((await res.json()) as { homework: number }).homework, 1);
    assert.ok(about(stub.messages(), RM_TITLES.dayAfter).length > 0);
  });
});
```

Add to `mountOrder.test.ts`: at the top of the file, `const MOUNT_ORDER_CRON_KEY = "mount-order-cron-key";`; in `before`'s `env` object, `INTERNAL_CRON_KEY: MOUNT_ORDER_CRON_KEY,`; and after the «hides the site-signup ingest…» case:

```ts
  it("hides the homework-reminder trigger without the shared key, and opens it with the key", async () => {
    // Server-to-server (Cloud Scheduler). Without the key it must look like no
    // route at all — 404, not a guarded 401 — and no session guard may sit in
    // front of it (the scheduler has no session).
    const post = (headers: Record<string, string>) => fetch(`${base}/internal/homework-reminders`, { method: "POST", headers });
    assert.equal((await post({})).status, 404, "no key");
    assert.equal((await post({ "x-internal-key": "wrong" })).status, 404, "wrong key");
    assert.equal((await fetch(`${base}/internal/homework-reminders`)).status, 404, "GET is not a route");
    const right = await post({ "x-internal-key": MOUNT_ORDER_CRON_KEY });
    assert.notEqual(right.status, 404, "the right key reaches the route");
    assert.notEqual(right.status, 401, "no session guard in front of it");
  });
```

Run the three test files, and they should FAIL: modules missing, and the route a 404 even with the key.

- [ ] **Step 4: Implement.** In `rules.ts`, change `function addDays(` to `export function addDays(`.

`modules/notifications/reminders.ts`:

```ts
/**
 * The pure half of the day-before reminder (lib/homeworkReminders.ts).
 *
 * "Tomorrow" is the Amman calendar day after today's. A homework is due on it
 * when its stored instant (the end of its due day, Amman — rules.ts) falls
 * after the end of today and no later than the end of tomorrow; compared as
 * instants, so a row stored at any time of that day counts.
 */
import { addDays, dueAtToDueDate, dueDateToDueAt } from "../homework/rules.ts";

export function reminderWindow(now: Date): { dueDate: string; after: Date; upTo: Date } {
  const today = dueAtToDueDate(now);
  const tomorrow = addDays(today, 1);
  return { dueDate: tomorrow, after: dueDateToDueAt(today)!, upTo: dueDateToDueAt(tomorrow)! };
}

export type ReminderKind = "tracked" | "untracked";

/**
 * Per roster row: ticked → nothing; not ticked, with a student account →
 * "tracked" (we know it is not marked done); no account → "untracked": nobody
 * can tick it, so nobody knows whether it is done, and the reminder must not
 * say it is not.
 */
export function reminderKind(row: { hasAccount: boolean; done: boolean }): ReminderKind | null {
  if (row.done) return null;
  return row.hasAccount ? "tracked" : "untracked";
}
```

Append to `familyPushText.ts`:

```ts
export function homeworkReminderText(i: { title: string; className: string }): {
  student: PushText;
  guardianTracked: (child: string) => PushText;
  guardianUntracked: (child: string) => PushText;
} {
  const named = `«${clip(i.title, 60)}» في ${i.className}`;
  return {
    student: { title: "تذكير: واجب موعده غدًا", body: `${named} لم يُعلَّم كمُنجَز بعد.` },
    guardianTracked: child => ({ title: forChild(child, "واجب موعده غدًا"), body: `${named} لم يُعلَّم كمُنجَز بعد.` }),
    // No account can tick it: say when, never "not done".
    guardianUntracked: child => ({ title: forChild(child, "واجب موعده غدًا"), body: `تذكير بواجب ${named}.` }),
  };
}
```

`lib/homeworkReminders.ts`:

```ts
/**
 * The day-before homework reminder (spec Part 4), run once a day by Cloud
 * Scheduler through POST /internal/homework-reminders (routes/internal.ts).
 *
 * For each homework due tomorrow (Amman; modules/notifications/reminders.ts),
 * not archived, in a live class — per live roster row of that class:
 *  - ticked off → nothing;
 *  - not ticked, the child has a student account → the student and each
 *    guardian are told it is not marked done yet;
 *  - the child has no student account → only guardians, told when it is due,
 *    never that it is not done (nobody can tick it).
 *
 * At most once per homework per due day: the run CLAIMS a `homework_reminders`
 * row before sending and skips a homework it cannot claim, so a double fire,
 * a scheduler retry or two overlapping runs send nothing twice. Accepted
 * price: if the send fails after the claim, that day's reminder is lost.
 */
import { classGroups, db, homework, homeworkCompletions, homeworkReminders } from "@workspace/db";
import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { accountsLinkedTo, liveClassStudentIds } from "./familyAccess.ts";
import { sendFamilyPush } from "./familyPush.ts";
import { studentAccountsEnabled } from "./features.ts";
import { logger } from "./logger.ts";
import { classLabel, homeworkReminderText } from "../modules/notifications/familyPushText.ts";
import { reminderKind, reminderWindow } from "../modules/notifications/reminders.ts";

export interface ReminderRun {
  /** Homework reminded about in this run (claimed now). */
  homework: number;
  /** Messages handed to Expo. */
  pushed: number;
}

interface DueItem {
  id: string;
  title: string;
  classGroupId: string;
  name: string;
  nameAr: string;
}

export async function runHomeworkReminders(now: Date = new Date()): Promise<ReminderRun> {
  if (!studentAccountsEnabled()) return { homework: 0, pushed: 0 };
  const span = reminderWindow(now);
  const due: DueItem[] = await db
    .select({ id: homework.id, title: homework.title, classGroupId: homework.classGroupId, name: classGroups.name, nameAr: classGroups.nameAr })
    .from(homework)
    .innerJoin(classGroups, eq(classGroups.id, homework.classGroupId))
    .where(and(gt(homework.dueAt, span.after), lte(homework.dueAt, span.upTo), isNull(homework.archivedAt), isNull(classGroups.archivedAt)));

  const run: ReminderRun = { homework: 0, pushed: 0 };
  for (const item of due) {
    const claimed = await db
      .insert(homeworkReminders)
      .values({ homeworkId: item.id, dueDate: span.dueDate })
      .onConflictDoNothing()
      .returning({ id: homeworkReminders.id });
    if (claimed.length === 0) continue;
    run.homework++;
    try {
      run.pushed += await remindAbout(item, now);
    } catch (err) {
      logger.error({ err, homeworkId: item.id }, "homework reminder failed after its claim; not retried today");
    }
  }
  return run;
}

async function remindAbout(item: DueItem, now: Date): Promise<number> {
  const studentIds = await liveClassStudentIds(item.classGroupId);
  if (studentIds.length === 0) return 0;
  const [accounts, ticked] = await Promise.all([
    accountsLinkedTo(studentIds),
    db
      .select({ studentId: homeworkCompletions.studentId })
      .from(homeworkCompletions)
      .where(and(eq(homeworkCompletions.homeworkId, item.id), inArray(homeworkCompletions.studentId, studentIds))),
  ]);
  const done = new Set(ticked.map(t => t.studentId));
  // Any self link counts — a suspended student's too: whether the child CAN
  // tick is a fact about the row, not about who is pushed.
  const hasAccount = new Set(accounts.filter(a => a.relation === "self").map(a => a.studentId));
  const text = homeworkReminderText({ title: item.title, className: classLabel(item) });
  const outcome = await sendFamilyPush({
    category: "homework",
    accounts,
    data: { screen: "school" },
    now,
    text: r => {
      const kind = reminderKind({ hasAccount: hasAccount.has(r.studentId), done: done.has(r.studentId) });
      if (kind === null) return null;
      if (r.relation === "self") return kind === "tracked" ? text.student : null;
      return kind === "tracked" ? text.guardianTracked(r.childName) : text.guardianUntracked(r.childName);
    },
  });
  return outcome.messages;
}
```

`routes/internal.ts`:

```ts
/**
 * Server-to-server endpoints a scheduler calls. The caller is Cloud Scheduler,
 * which holds a shared key, not a user session — so no auth middleware.
 *
 * Guarded by `x-internal-key` against INTERNAL_CRON_KEY, compared in constant
 * time. A wrong, missing or UNSET key answers 404 — the route does not exist
 * for anyone else, the same posture as /site/signups. Unset is closed: until
 * the secret is created and attached to the service (docs/deploying.md,
 * «The homework reminder»), the reminder never runs.
 *
 * No `router.use` here: this router is mounted at the root of /api, where a
 * bare middleware would run for every request (see mountOrder.test.ts).
 */
import { Router } from "express";
import { siteKeyMatches } from "../lib/adminMetrics.js";
import { logger } from "../lib/logger";
import { runHomeworkReminders } from "../lib/homeworkReminders.ts";

const router = Router();

router.post("/internal/homework-reminders", async (req, res) => {
  // siteKeyMatches is a generic constant-time shared-key check, named for its first user.
  if (!siteKeyMatches(process.env.INTERNAL_CRON_KEY, req.headers["x-internal-key"])) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const run = await runHomeworkReminders(new Date());
    // The line docs/deploying.md tells the owner to look for.
    logger.info(run, "homework reminders run");
    res.json(run);
  } catch (err) {
    logger.error({ err }, "homework reminders failed");
    res.status(500).json({ error: "Failed to send homework reminders" });
  }
});

export default router;
```

In `routes/index.ts`: `import internalRouter from "./internal";` and, right after `router.use(healthRouter);`:

```ts
// Cloud Scheduler's endpoints, guarded by a shared key inside each handler
// (404 without it) — never a session, so mounted before any guarded router.
router.use(internalRouter);
```

- [ ] **Step 5: Run all four test files again and confirm they pass.** That is the unit tests, the DB test and `mountOrder.test.ts` after `pnpm build`. Then `pnpm run typecheck`.

- [ ] **Step 6: Mutation proof** (report, revert): (a) delete `if (claimed.length === 0) continue;`, and "sends nothing twice" should go red; (b) change `gt(homework.dueAt, span.after)` to `gte`, and `rm-today` appears, so the main case should go red; (c) make `reminderKind` return `"tracked"` when `!hasAccount`, and the unit test and "never 'not done'" should go red; (d) remove `if (row.done) return null;`, and the `rm-c1-done` assertions should go red; (e) change `siteKeyMatches(process.env.INTERNAL_CRON_KEY, …)` to `!process.env.INTERNAL_CRON_KEY || siteKeyMatches(…)` (open when unset), and "is a 404 … with no key configured at all" should go red.

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src
git commit -m "feat(api): POST /internal/homework-reminders — the day-before reminder, once per homework per day, behind a shared key"
```

---

### Task 10: Mobile logic: tap target, switch rules, fetchers, copy

**Files:**
- Modify: `artifacts/mobile/services/notificationDeepLink.ts`, `artifacts/mobile/services/i18n.ts`
- Create: `artifacts/mobile/services/pushPrefs.ts`, `artifacts/mobile/services/pushPrefsApi.ts`
- Test: `artifacts/mobile/services/__tests__/notificationDeepLink.test.ts` (extend), `artifacts/mobile/services/__tests__/pushPrefs.test.ts`

**Interfaces:**
- Consumes: Task 2's HTTP contract.
- Produces:
  - `SCREEN_ROUTES.school = '/school'`.
  - `pushPrefs.ts`: `type PushPrefCategory = 'homework' | 'exams' | 'results'`, `type PushPrefs = Record<PushPrefCategory, boolean>`, `PUSH_PREF_ROWS: readonly { category: PushPrefCategory; labelKey: TranslationKey; hintKey: TranslationKey }[]`, `normalizePushPrefs(raw: unknown): PushPrefs | null`, `withPref(prefs: PushPrefs, category: PushPrefCategory, on: boolean): PushPrefs`, `showsFamilyPushPrefs(role: string | null | undefined): boolean`.
  - `pushPrefsApi.ts`: `fetchPushPrefs(): Promise<PushPrefs>`, `savePushPref(category: PushPrefCategory, on: boolean): Promise<PushPrefs>`. Both throw on failure.
  - i18n keys (ar + en): `pushPrefsSection`, `pushPrefHomework`, `pushPrefHomeworkHint`, `pushPrefExams`, `pushPrefExamsHint`, `pushPrefResults`, `pushPrefResultsHint`, `pushPrefsNote`, `pushPrefsLoadFailed`, `pushPrefsSaveFailed`; `pushAskBody` reworded.

- [ ] **Step 1: Write the failing tests.** Add to `notificationDeepLink.test.ts`, inside `describe('routeFromNotificationData', …)`:

```ts
  it('opens the School tab for a homework, reminder or exam-date push', () => {
    assert.equal(routeFromNotificationData({ screen: 'school' }), '/school');
  });

  it('still ignores a screen that only looks like the School tab', () => {
    assert.equal(routeFromNotificationData({ screen: '/school' }), null);
    assert.equal(routeFromNotificationData({ screen: 'school/../admin' }), null);
  });
```

`pushPrefs.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { normalizePushPrefs, PUSH_PREF_ROWS, showsFamilyPushPrefs, withPref } from '../pushPrefs.ts';

describe('normalizePushPrefs', () => {
  it('reads the server body', () => {
    assert.deepEqual(normalizePushPrefs({ preferences: { homework: false, exams: true, results: true } }), {
      homework: false,
      exams: true,
      results: true,
    });
  });
  it('reads a missing or malformed switch as on, like the server', () => {
    assert.deepEqual(normalizePushPrefs({ preferences: { exams: 'no' } }), { homework: true, exams: true, results: true });
  });
  it('refuses a body that is not the shape', () => {
    for (const bad of [null, {}, { preferences: null }, { preferences: [] }, 'x']) {
      assert.equal(normalizePushPrefs(bad), null, JSON.stringify(bad));
    }
  });
});

describe('withPref', () => {
  it('changes one switch and leaves the original alone', () => {
    const before = { homework: true, exams: true, results: true };
    assert.deepEqual(withPref(before, 'exams', false), { homework: true, exams: false, results: true });
    assert.deepEqual(before, { homework: true, exams: true, results: true });
  });
});

describe('showsFamilyPushPrefs', () => {
  it('is for parents and students only — nobody else is sent these', () => {
    assert.equal(showsFamilyPushPrefs('parent'), true);
    assert.equal(showsFamilyPushPrefs('student'), true);
    for (const role of ['teacher', 'school_admin', 'system_admin', null, undefined]) {
      assert.equal(showsFamilyPushPrefs(role), false, String(role));
    }
  });
});

describe('PUSH_PREF_ROWS', () => {
  it('has one row per category, in the order Settings shows them', () => {
    assert.deepEqual(PUSH_PREF_ROWS.map(r => r.category), ['homework', 'exams', 'results']);
  });
});
```

Run both with the mobile command, and they should FAIL: `school` resolves to null and the module is missing.

- [ ] **Step 2: Implement.** In `notificationDeepLink.ts`, add to `SCREEN_ROUTES`:

```ts
  // Homework posted, the day-before reminder, an exam date (spec Part 4).
  school: '/school',
```

`services/pushPrefs.ts`:

```ts
/**
 * The account's school-notification switches (homework, exam dates, results),
 * as `GET|PUT /auth/me/push-preferences` returns them. Pure, so it is tested;
 * the fetchers are in pushPrefsApi.ts (apiClient pulls in react-native).
 *
 * A missing or malformed switch reads as ON — the server's own rule
 * (api-server modules/notifications/pushPrefs.ts): these are opt-outs.
 */
import type { TranslationKey } from './i18n.ts';

export type PushPrefCategory = 'homework' | 'exams' | 'results';
export type PushPrefs = Record<PushPrefCategory, boolean>;

export const PUSH_PREF_ROWS: readonly { category: PushPrefCategory; labelKey: TranslationKey; hintKey: TranslationKey }[] = [
  { category: 'homework', labelKey: 'pushPrefHomework', hintKey: 'pushPrefHomeworkHint' },
  { category: 'exams', labelKey: 'pushPrefExams', hintKey: 'pushPrefExamsHint' },
  { category: 'results', labelKey: 'pushPrefResults', hintKey: 'pushPrefResultsHint' },
];

export function normalizePushPrefs(raw: unknown): PushPrefs | null {
  if (!raw || typeof raw !== 'object') return null;
  const prefs = (raw as { preferences?: unknown }).preferences;
  if (!prefs || typeof prefs !== 'object' || Array.isArray(prefs)) return null;
  const p = prefs as Record<string, unknown>;
  return { homework: p.homework !== false, exams: p.exams !== false, results: p.results !== false };
}

export function withPref(prefs: PushPrefs, category: PushPrefCategory, on: boolean): PushPrefs {
  return { ...prefs, [category]: on };
}

/** Only parents and students are sent these pushes; nobody else has anything to switch. */
export function showsFamilyPushPrefs(role: string | null | undefined): boolean {
  return role === 'parent' || role === 'student';
}
```

`services/pushPrefsApi.ts`:

```ts
/**
 * Fetchers for the school-notification switches. Split from pushPrefs.ts
 * because apiClient pulls in react-native at module scope, which `node --test`
 * cannot load — the same split as homeworkApi.ts. No test file: the logic is
 * tested in pushPrefs.ts. Both throw on any failure; the screen chooses words.
 */
import { apiJson } from './apiClient.ts';
import { normalizePushPrefs, type PushPrefCategory, type PushPrefs } from './pushPrefs.ts';

const PATH = '/auth/me/push-preferences';

export async function fetchPushPrefs(): Promise<PushPrefs> {
  const prefs = normalizePushPrefs(await apiJson<unknown>(PATH));
  if (!prefs) throw new Error('bad_response');
  return prefs;
}

export async function savePushPref(category: PushPrefCategory, on: boolean): Promise<PushPrefs> {
  const prefs = normalizePushPrefs(await apiJson<unknown>(PATH, { method: 'PUT', body: JSON.stringify({ [category]: on }) }));
  if (!prefs) throw new Error('bad_response');
  return prefs;
}
```

In `services/i18n.ts`, in the **ar** block, replace `pushAskBody` and add after `pushAskLater`:

```ts
    pushAskBody: 'لنُعلمك عند وصول رسالة جديدة، أو واجب جديد، أو موعد امتحان، أو إعلان نتيجة. يمكنك تغيير ذلك لاحقًا من الإعدادات.',
```

```ts
    pushPrefsSection: 'إشعارات المدرسة',
    pushPrefHomework: 'الواجبات',
    pushPrefHomeworkHint: 'واجب جديد، وتذكير قبل موعده بيوم إن لم يُعلَّم كمُنجَز',
    pushPrefExams: 'مواعيد الامتحانات',
    pushPrefExamsHint: 'عند تحديد موعد امتحان أو تغييره',
    pushPrefResults: 'النتائج',
    pushPrefResultsHint: 'عندما يعلن المعلّم نتيجة',
    pushPrefsNote: 'تنطبق على كل أجهزتك. الرسائل لا تتأثر بها، وما يصل بين العاشرة مساءً والسابعة صباحًا يصل بلا صوت.',
    pushPrefsLoadFailed: 'تعذّر تحميل إعدادات الإشعارات.',
    pushPrefsSaveFailed: 'تعذّر حفظ التغيير. حاول مرة أخرى.',
```

and in the **en** block:

```ts
    pushAskBody: 'So we can tell you about new messages, new homework, exam dates and released results. You can change this later in Settings.',
```

```ts
    pushPrefsSection: 'SCHOOL NOTIFICATIONS',
    pushPrefHomework: 'Homework',
    pushPrefHomeworkHint: 'New homework, and a reminder the day before it is due if it is not marked done',
    pushPrefExams: 'Exam dates',
    pushPrefExamsHint: 'When an exam is scheduled or its date changes',
    pushPrefResults: 'Results',
    pushPrefResultsHint: 'When a teacher releases a result',
    pushPrefsNote: 'These apply to all your devices. Messages are not affected, and anything arriving between 10 pm and 7 am comes without sound.',
    pushPrefsLoadFailed: "Couldn't load your notification settings.",
    pushPrefsSaveFailed: "Couldn't save that change. Try again.",
```

- [ ] **Step 3: Run the tests again and confirm they pass.** Run `notificationDeepLink.test.ts`, `pushPrefs.test.ts` and `i18n.test.ts`, then the whole mobile suite (`cd artifacts/mobile && pnpm test`) and `pnpm run typecheck`.

- [ ] **Step 4: Mutation proof** (report, revert): replace `Object.hasOwn(SCREEN_ROUTES, screen)` with `screen in SCREEN_ROUTES`, and the existing `'toString'` case should go red. That shows the whitelist still guards the new entry.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services
git commit -m "feat(mobile): school pushes open the School tab; switch logic, fetchers and copy for school notifications"
```

---

### Task 11: Settings: three switches for parents and students

**Files:**
- Modify: `artifacts/mobile/app/settings.tsx`

**Interfaces:**
- Consumes: Task 10's `PUSH_PREF_ROWS`, `showsFamilyPushPrefs`, `withPref`, `PushPrefs`, `PushPrefCategory`, `fetchPushPrefs`, `savePushPref`, and the i18n keys.
- Produces: no exports. For a signed-in parent or student, on web as well as native, a «إشعارات المدرسة» card holds three switches. The switches are read when the screen mounts, saved optimistically, and reverted with a toast if the save fails.

There is no unit test for the screen. The logic it uses is tested in Task 10. This task is checked by typecheck, the mobile suite (`ariaState`, `designScale`, `i18n`) and the controller's visual check (Task 12, Step 6).

- [ ] **Step 1: Imports.** Add `Switch` to the `react-native` import, then add:

```tsx
import { SPACE, TYPE } from '@/constants/theme';
import { PUSH_PREF_ROWS, showsFamilyPushPrefs, withPref, type PushPrefCategory, type PushPrefs } from '@/services/pushPrefs';
import { fetchPushPrefs, savePushPref } from '@/services/pushPrefsApi';
```

and, at module level below the imports:

```tsx
const PREF_ICON: Record<PushPrefCategory, keyof typeof Ionicons.glyphMap> = {
  homework: 'book-outline',
  exams: 'calendar-outline',
  results: 'ribbon-outline',
};
```

- [ ] **Step 2: State and handlers.** Put these at the top of `SettingsScreen`, right after the existing `usePollingRefresh(loadPushState);`, so they come before any JSX and outside every conditional, keeping hook order fixed:

```tsx
  // School notifications (homework, exam dates, results): an ACCOUNT setting
  // on the server (GET/PUT /auth/me/push-preferences), so it is shown on web
  // too — it decides what reaches this account's phones. Only parents and
  // students are sent these pushes. Re-read when the open account changes.
  const showsSchoolPrefs = showsFamilyPushPrefs(user?.role);
  const [schoolPrefs, setSchoolPrefs] = useState<PushPrefs | null>(null);
  const [schoolPrefsFailed, setSchoolPrefsFailed] = useState(false);
  const [savingPref, setSavingPref] = useState<PushPrefCategory | null>(null);
  useEffect(() => {
    setSchoolPrefs(null);
    setSchoolPrefsFailed(false);
    if (!showsSchoolPrefs) return;
    let cancelled = false;
    fetchPushPrefs()
      .then(p => { if (!cancelled) setSchoolPrefs(p); })
      .catch(() => { if (!cancelled) setSchoolPrefsFailed(true); });
    return () => { cancelled = true; };
  }, [showsSchoolPrefs, user?.id]);

  // Optimistic: the switch moves at once; a failed save puts it back and says so.
  const handleSchoolPref = async (category: PushPrefCategory, on: boolean) => {
    if (!schoolPrefs || savingPref) return;
    const before = schoolPrefs;
    setSchoolPrefs(withPref(schoolPrefs, category, on));
    setSavingPref(category);
    try {
      setSchoolPrefs(await savePushPref(category, on));
    } catch {
      setSchoolPrefs(before);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setToast(t('pushPrefsSaveFailed'));
    } finally {
      setSavingPref(null);
    }
  };
```

- [ ] **Step 3: The card.** Insert it directly **after** the closing `)}` of the native-only `{Platform.OS !== 'web' && ( … notificationsSection … )}` block, and before `{/* About */}`:

```tsx
        {/* School notifications: three server-backed switches (not the OS
            permission above, and not native-only — they are an account
            setting). Every control here reads and writes the server; see the
            note on the section above about switches that lied. */}
        {showsSchoolPrefs && (
          <>
            <SectionLabel label={t('pushPrefsSection')} isRTL={isRTL} colors={colors} top />
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              {schoolPrefs === null ? (
                <View style={{ padding: SPACE.lg }}>
                  {schoolPrefsFailed ? (
                    <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: isRTL ? 'right' : 'left' }}>
                      {t('pushPrefsLoadFailed')}
                    </Text>
                  ) : (
                    <ActivityIndicator size="small" color={colors.primary} />
                  )}
                </View>
              ) : (
                PUSH_PREF_ROWS.map((row, i) => (
                  <React.Fragment key={row.category}>
                    {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                    <View style={[styles.settingRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                      <Ionicons name={PREF_ICON[row.category]} size={20} color={colors.primary} />
                      <View style={{ flex: 1, gap: SPACE.xxs }}>
                        <Text style={[styles.settingLabel, { color: colors.foreground, fontFamily: 'ReadexPro_500Medium', textAlign: isRTL ? 'right' : 'left' }]}>
                          {t(row.labelKey)}
                        </Text>
                        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 20, textAlign: isRTL ? 'right' : 'left' }}>
                          {t(row.hintKey)}
                        </Text>
                      </View>
                      <Switch
                        value={schoolPrefs[row.category]}
                        onValueChange={on => void handleSchoolPref(row.category, on)}
                        disabled={savingPref !== null}
                        accessibilityLabel={t(row.labelKey)}
                        aria-checked={schoolPrefs[row.category]}
                        trackColor={{ true: colors.primary, false: colors.border }}
                      />
                    </View>
                  </React.Fragment>
                ))
              )}
            </View>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, lineHeight: 21, marginTop: SPACE.sm, textAlign: isRTL ? 'right' : 'left' }}>
              {t('pushPrefsNote')}
            </Text>
          </>
        )}
```

In the comment above `handlePushRow`, change «the per-kind channels (messages, results, reminders)» to «the per-kind channels (messages, homework, exam dates, results, reminders)».

- [ ] **Step 4: Verify.** `pnpm run typecheck` should be clean, and `cd artifacts/mobile && pnpm test` should show 0 failures. In particular `ariaState.test.ts` (no `accessibilityState=`) and `designScale.test.ts` must not exceed their ceilings.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/app/settings.tsx
git commit -m "feat(mobile): Settings — homework, exam-date and results notification switches for parents and students"
```

---

### Task 12: Docs, the owner's infrastructure steps, final verification, and the controller's visual check

**Files:**
- Modify: `STATUS.md`, `docs/superpowers/specs/2026-10-11-family-school-views-design.md`, `docs/deploying.md`, `CLAUDE.md`

- [ ] **Step 1: `docs/deploying.md`.** Add a subsection after «### Credentials are Secret Manager references» with exactly this content (the values are real: project number `613126375862`, region `europe-west1`, service `iqraa-api`):

````markdown
### The homework reminder (Cloud Scheduler) — manual, once

`POST /api/internal/homework-reminders` sends the day-before homework reminder
(spec Part 4). It answers **404 to everyone until `INTERNAL_CRON_KEY` is on the
service** — so after a merge it is deployed but inert. Nothing in `deploy.yml`
refers to the secret, on purpose: a `--update-secrets` ref to a secret that does
not exist yet fails every Cloud Run deploy. Attach it by hand; `deploy.yml`'s
`--update-env-vars` keeps it from then on, like the other ten.

```bash
# 1. The secret: a long random value, no trailing newline.
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create INTERNAL_CRON_KEY --data-file=-
# 2. Let the API's runtime account read it.
gcloud secrets add-iam-policy-binding INTERNAL_CRON_KEY \
  --member=serviceAccount:613126375862-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
# 3. Put it on the service (rolls a new revision).
gcloud run services update iqraa-api --region europe-west1 \
  --update-secrets=INTERNAL_CRON_KEY=INTERNAL_CRON_KEY:latest
# 4. Check by hand — this CLAIMS today's reminders, so the scheduled run later today
#    sends nothing for the same homework. {"homework":N,"pushed":M}; 404 = step 3 missing.
KEY=$(gcloud secrets versions access latest --secret INTERNAL_CRON_KEY)
curl -sS -X POST -H "x-internal-key: $KEY" \
  https://iqraa-api-613126375862.europe-west1.run.app/api/internal/homework-reminders
# 5. The daily job: 16:00 Amman. (`gcloud services enable cloudscheduler.googleapis.com` first if asked.)
gcloud scheduler jobs create http homework-reminders \
  --location europe-west1 \
  --schedule "0 16 * * *" --time-zone "Asia/Amman" \
  --uri "https://iqraa-api-613126375862.europe-west1.run.app/api/internal/homework-reminders" \
  --http-method POST \
  --headers "x-internal-key=$KEY,Content-Type=application/json" \
  --message-body '{}' \
  --attempt-deadline 300s
# 6. Fire it once now, and see that it ran.
gcloud scheduler jobs run homework-reminders --location europe-west1
gcloud scheduler jobs describe homework-reminders --location europe-west1 --format='value(lastAttemptTime,status)'
gcloud logging read 'resource.type="cloud_run_revision" AND jsonPayload.msg="homework reminders run"' --limit 5 --freshness 1d
```

The job stores the key in its own config, readable by anyone with
`cloudscheduler.jobs.get`; rotate both together (new secret version, `gcloud run
services update` again, `gcloud scheduler jobs update http … --update-headers`).
A rerun the same day is safe: each homework is reminded at most once per due day
(`homework_reminders`), and a send that fails after its claim is not retried.
````

- [ ] **Step 2: Spec.** In `2026-10-11-family-school-views-design.md`, update the header status line and the Part 4 table row to say «Built, 2026-10-12 (the reminder is inert until the owner creates `INTERNAL_CRON_KEY` and the scheduler job)». Then replace the whole body of «## 4. Notifications» with these as-built bullets, keeping their substance:
  - **Who:** the roster rows the news is about, then every account linked to them (`self` and `guardian`) via `accountsLinkedTo` / `liveClassStudentIds` (`lib/familyAccess.ts`). This is the "roster row → accounts" lookup Part 3 asked for. A guardian of two children gets one push per child, named first («سارة: واجب جديد»); a student gets the generic text. Suspended accounts and archived rows get nothing. Every device gets the push, and Expo's dead tokens are pruned. One sender, `lib/familyPush.ts`. Texts are Arabic only, in `modules/notifications/familyPushText.ts`.
  - **Homework posted** (`POST /homework`): the class's students and guardians, channel `homework`, which opens «المدرسة». Changing a due date pushes nothing.
  - **Exam date set, changed or cleared** (`PATCH /evaluations/:id`): pushed only when the stored date or time actually moves on an exam families can see: published or closed, attached to a live class, not archived. It goes only to that exam's audience (a group check reaches its own students). Attaching a class to a dated exam, and publishing a dated draft, announce the date as new. A dated draft, or an exam with no class, pushes nothing. The announcing write is conditional on what the request read, so racing saves announce once; publish is not race-safe (known gap). Channel `exams`. The day is formatted as text, never through `Date`.
  - **Results:** `announceResultsRelease` now goes through the shared sender. It skips provisional sittings, suspended accounts and switched-off accounts, and still re-announces after hide → release. **Marks typed after the release** (`PUT /evaluations/:id/paper-totals`, rows that answer `saved`) get the same text. Not covered: a sitting handed in after the release via `POST /attempts/:id/submit` or the student link.
  - **Reminder** (`POST /internal/homework-reminders`, Cloud Scheduler, 16:00 Asia/Amman): homework due tomorrow (Amman day), not archived, in a live class. Not ticked, with an account: the student and guardians are told it is not marked done. No account: guardians only, and the text never says "not done". Ticked: nothing. Sent at most once per homework per due day (`homework_reminders`, claimed before sending; a failed send is not retried). The key is `x-internal-key` = `INTERNAL_CRON_KEY`, and the route is a 404 without it, including while the key is unset.
  - **Switches:** `users.push_prefs` (`{}` = all on), `GET|PUT /auth/me/push-preferences` for any account; three switches in Settings for parents and students; chat is not affected.
  - **Quiet hours:** 22:00–07:00 Amman, sent to the silent Android channel `quiet` with `sound: null`, because Android takes sound from the channel. `PUSH_QUIET_HOURS=off` disables it. Chat and admin pushes are unchanged.
  - **Teacher-triggered pushes are awaited, capped at 4 s** (`pushWithin`), because Cloud Run throttles CPU after the response. A push never fails the request. The release announcement is still fire-and-forget.
  - **App:** channels `homework`, `exams` and `quiet` are created at runtime from `PUSH_CHANNELS`, so they ship by OTA with no native change. `data.screen: "school"` opens the School tab. The permission prompt mentions homework and exam dates.

  In «Testing», add the six new DB test files. In «Risks», replace item 3 with «The reminder needs `INTERNAL_CRON_KEY` and a Cloud Scheduler job, created by hand (docs/deploying.md); until then it never fires», and add «Push delivery to a real device has never been seen».

- [ ] **Step 3: STATUS.md.** Add a section after «Exam dates and paper marks reach families, 2026-10-12»: «## Families are told: homework, exam dates, results, and a reminder the day before, 2026-10-12». Write it in the style of the Homework section:
  - **What exists:** the four pushes and who gets each; the switches (column, route, Settings); quiet hours and the `quiet` channel; `pushWithin`; migration `0008` (additive); the DB tests that pin each rule (`pushPreferences`, `resultsPush`, `homeworkPush`, `examDatePush`, `paperTotalsPush`, `homeworkReminders`) and the mutation proofs that were run (paste the implementers' reports, including how the race case did in Task 7).
  - **Owner's checklist after merge** (numbered): (1) the merge deploys the API (and migration `0008`) and the web app, and `mobile-update.yml` publishes the OTA that carries the channels, the tap target and the switches; (2) run docs/deploying.md «The homework reminder» steps 1–6, because **until then no reminder is ever sent**; (3) on a real Android phone, sign in as a parent of a child in a class, grant notifications, then from the teacher account post homework to that class. The push should appear under «الواجبات», and tapping it should open «المدرسة». Set an exam date and confirm «موعد امتحان» arrives. Type a paper mark after releasing and confirm «نتيجة …» arrives. Turn «الواجبات» off in Settings, post again, and confirm nothing arrives. (4) The next day after 16:00 Amman, read the `homework reminders run` log line.
  - **Not seen:** delivery to any real device; the OTA on a phone; the `quiet` channel at night; Cloud Scheduler firing.
  - **Known gaps** (one line each, with the reason): two simultaneous publishes of one dated draft can both announce; a sitting handed in after the release through `POST /attempts/:id/submit` or the student link is not pushed; hide → release announces again; moving a dated exam to another class tells the new class only; a corrected paper mark after the release is announced again; night pushes land in `quiet`, so an Android-level mute of «الواجبات» does not silence them (the in-app switch does); an app on a build from before this OTA shows homework/exam pushes in Android's catch-all channel (expo-notifications' fallback for an unknown channel, which also matches `PUSH_CHANNEL`'s own comment; never seen on a device); a reminder whose send fails after its claim is lost for that day; the release announcement is still fire-and-forget, so Cloud Run's CPU throttling can delay it; pushes are Arabic only and `preferredLanguage` is ignored, as before.
  - Then update the lines this part makes untrue. Find them with `grep -n "Part 4\|no push\|no notification\|reminders/admin\|rows → user\|row → user" STATUS.md`. Expect the Homework section's «no notifications», the Part 3 section's «no push when marks arrive after release / exam scheduled/changed pushes nothing», the missing rows → users helper, and the channel list (now messages, results, reminders, admin, homework, exams, quiet).
- [ ] **Step 4: CLAUDE.md.** Add these two bullets to «Things that have bitten before». Both are real traps that fail silently:

```markdown
- **Work after `res.json` may never run on Cloud Run.** The API deploys
  without `--no-cpu-throttling`, so once a response is sent the instance's CPU
  is throttled and fire-and-forget work (`promise.catch(log)` after
  `res.json`) can stall until some later request wakes it. The family pushes
  (homework posted, exam date, paper marks) therefore `await pushWithin(…)`
  before answering — capped at 4 s, never throwing (`lib/pushWithin.ts`). The
  chat and release-announcement pushes are still fire-and-forget; move them
  the same way if their delivery ever looks late.
- **A secret ref in `deploy.yml` before the secret exists fails every deploy.**
  `gcloud run deploy --update-secrets NAME=NAME:latest` refuses a secret Secret
  Manager does not have, and that breaks every merge, not just the one that
  added it. New secrets are attached by hand once (`gcloud run services update
  --update-secrets`), and `--update-env-vars` deploys keep them — see
  `INTERNAL_CRON_KEY` in docs/deploying.md. Code reading one must work, or
  fail closed, while it is unset.
```

- [ ] **Step 5: Full verification.** Paste the counts into the report:

```bash
pnpm run typecheck
cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres REQUIRE_DB_TESTS=true pnpm test
cd ../mobile && pnpm test
```

  Expected: typecheck clean; api-server 0 failed, 0 skipped; mobile 0 failed.
- [ ] **Step 6: Visual check. The CONTROLLER does this, not the implementer.** Run a local API on a seeded database (`pnpm run dev:api`, `pnpm run dev:mobile:web`) and use a browser at phone width (360 px), in Arabic and in English:
  1. Signed in as a parent, Settings shows «إشعارات المدرسة» with three switches, their hints and the note. Turn «مواعيد الامتحانات» off and reload: it stays off. Stop the API and flip a switch: it moves back and a toast says the save failed.
  2. Signed in as a teacher, Settings has no such card.
  3. Signed in as a student, the card is there.
  4. With `EXPO_PUSH_URL` pointed at a local catcher such as `npx http-echo-server` (or the stub), posting homework as the teacher shows the request leaving with the right tokens and text. This is optional, because the DB tests already cover it.

  Record in STATUS.md what was and was not seen.
- [ ] **Step 7: Commit docs.** The implementer does Steps 1–5 and 7; the controller commits Step 6's findings separately.

```bash
git add STATUS.md docs CLAUDE.md
git commit -m "docs: Part 4 — family notifications, the reminder's manual infrastructure, as built"
```

---

## Self-review

- **Spec coverage, section 4 and the Part 4 notes in sections 2–3:**
  - Homework posted goes to the class's students and guardians (T6).
  - The exam scheduled/changed hook is `PATCH /evaluations/:id` (T7), with the zone-less day formatted from the string (T6 `pushDay`, T7) and nothing pushed for a dated draft or an exam with no class (T7 unit + DB).
  - The rows → accounts lookup is `accountsLinkedTo` plus `liveClassStudentIds` (T5, T6).
  - Results released goes through the shared sender, minus provisional sittings and suspended or switched-off accounts (T5). The characterisation came first because no test existed.
  - Marks saved after release are pushed from paper-totals on `saved` while released (T8).
  - «Absent children stay `paper`»: such a child holds no final result, so `finalResultStudentIds` never selects them (T5, T8).
  - The parent `key` is not an account: pushes resolve through roster rows, never `groupChildren` (T5).
  - The reminder is Cloud Scheduler calling `POST /internal/homework-reminders`. It has a shared-secret header, a path-scoped mount, a `mountOrder` case, and is idempotent per homework and day (T9). The infrastructure and its inertness are documented (T12).
  - «Follow the existing push policy for opt-outs and quiet hours»: the policy pointed at nothing, so per the owner's decision it is now per-category switches (T1, T2, T10, T11) and quiet hours (T3).
  - Testing: unowned paths still 404 (the existing case, plus T9's 404-not-401). Another family is never pushed (T6–T9 `ownersReached`). Typecheck, `i18n.test.ts` and STATUS are updated in the same PR (T12).
  - Risks: `STUDENT_ACCOUNTS` is honoured (T5 sender, T6 test), and the real-device check is the owner's checklist (T12).
  - The controller's decisions map to tasks as follows:
    - D1: T1–T2.
    - D2: T3, with the `quiet` channel added and the reason given at the top.
    - D3: T3 and T5, with the prunes left alone as stated.
    - D4: T5–T7.
    - D5: T6.
    - D6: T9 and T12.
    - D7: T7, with publish built and its race listed.
    - D8: T8.
    - D9: T4, then T5–T9.
    - D10: T3, T10 and T11, with no native change.
    - D11: T12.
- **Placeholder scan:** there are no TBD or TODO steps. Every code step shows the code. The screen task (T11) gives the full JSX and names its precedents. The race case in T7 carries an explicit rule for what to do if it cannot fail.
- **Type consistency:**
  - `PushCategory` (T1) is the key of `familyDelivery` (T3) and `sendFamilyPush` (T5).
  - `LinkedAccount` and `Recipient` (T5 module) are what `accountsLinkedTo` returns (T5 lib) and what every text callback takes (T5–T9).
  - `PushText` and `FamilyText` (T5/T6) are returned by `homeworkPostedText`, `examDateText` and `homeworkReminderText`.
  - `ExamDateNotice` (T7) is what `examDateText` and `announceExamDate` consume.
  - `FamilyPushOutcome.messages` is the reminder's `pushed` (T9).
  - `StubMessage`, `sentTo`, `ownersReached`, `setPushPrefs`, `shownDay` (T4) and `RM_TITLES`, `ammanDueAt`, `seedReminderHomework` (T9) are named the same in every test.
  - The mobile `PushPrefCategory` matches the server's categories, and `normalizePushPrefs` follows the same "only `false` is off" rule as `readPushPrefs`.
  - `PUSH_CHANNEL` (server) and `PUSH_CHANNELS` (app) both gain `homework`, `exams` and `quiet`, pinned by the parity test.
