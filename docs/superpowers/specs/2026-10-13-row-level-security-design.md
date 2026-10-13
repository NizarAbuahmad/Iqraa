# Row-level security for user data — design

Status: design approved in conversation 2026-10-13; spec awaiting review.
Scope: first release ("scope A") — the mechanism, plus policies on the
tables holding children's and private data. Everything else is a later PR.

## Why

Today nothing in the database enforces who may read a row. The API connects as
one role through one `DATABASE_URL`, and every route scopes its own queries
(`findLiveClass`, `where teacherId = …`). A single missing `where` is a data
leak, and the data in question is children's names, grades, parent contact
history and chat. RLS is a second line of defence: a forgotten filter returns
nothing instead of everything.

It is **not** a defence against SQL injection (see *Limits*), and it is not
needed for correctness while every access goes through the API.

## Decisions already made

| Question | Decision |
| --- | --- |
| First release scope | Mechanism + sensitive tables (not all ~45, not a one-table pilot) |
| Rollout | Policies ship inert; enforcement is a separate, reversible switch |
| Carrying identity | `AsyncLocalStorage` + a per-statement transaction wrapper around `db` |
| Second connection string | **No.** `SET LOCAL ROLE iqraa_app` from the owner connection |
| `users` table | Deferred to the first follow-up PR |

## 1. Mechanism

### Identity

`authMiddleware` (`artifacts/api-server/src/middlewares/auth.ts`) calls
`next()` inside `als.run({ userId, role }, next)` after it has resolved
`req.user`. Every later middleware and handler runs inside that context.
Express invokes the rest of the chain synchronously from `next()`, so the
context survives to the handler and to any `await` inside it.

### `db` becomes a wrapper; `systemDb` is the owner

`lib/db` exports:

- `db` — same name and Drizzle API as today, so the ~41 importing files do not
  change. Each top-level statement runs as

  ```sql
  BEGIN;
  SET LOCAL ROLE iqraa_app;
  SELECT set_config('app.user_id', $1, true), set_config('app.role', $2, true);
  <the statement>
  COMMIT;
  ```

  when `RLS_ENFORCE=on` and an identity is in context. `db.transaction(fn)`
  does the first three lines once for the whole transaction (the 14 existing
  call sites).
- `systemDb` — plain owner connection, no `SET ROLE`. Owners bypass RLS.
  Every use is an explicit, greppable import.
- Identity is validated as a UUID before it is passed on, and passed as a bind
  parameter. Role is checked against the known role list.

With `RLS_ENFORCE=on` and **no identity in context**, `db` still switches to
`iqraa_app` but sets no `app.user_id`, so every policy evaluates false: the
query sees zero rows and writes are rejected. A path that forgot to establish
identity fails closed instead of falling back to the owner.

With `RLS_ENFORCE=off` (the default), `db` behaves exactly as it does today —
no `BEGIN`, no `SET ROLE`, no extra round trips.

### Paths that must use `systemDb`

These legitimately act without, or before, a user identity:

- the user lookup inside `authMiddleware` itself;
- `routes/auth.ts`: login, register, refresh, password reset, email
  verification, `POST /auth/redeem`, and anything touching the three token
  tables;
- `lib/rosterClaim.ts`: the claim-code lookup runs before a `roster_links` row
  exists for the caller;
- token-based student attempts (`attempts.access_token_hash` — a student opens
  an exam from a link with no login): the route verifies the token, then runs
  scoped by that attempt id. This is today's protection, unchanged;
- any query outside a request: push-notification fan-out to all
  `system_admin`s (`lib/adminNotify.ts`), result-release notification, startup
  and health checks.

The plan must enumerate each remaining `db` call that reads **another user's**
rows (e.g. "does the recipient block me" reads someone else's `chat_blocks`)
and route it through a `SECURITY DEFINER` helper or `systemDb`. This audit of
the ~41 files is the largest risk in the change and the largest part of the
plan.

### Why not hold a transaction for the whole request

Generation routes keep a request open for 30–60 s waiting on the model. A
request-long transaction would pin a pooled connection idle for that whole
time. Per-statement transactions cost roughly two extra round trips per query
instead; the Neon rehearsal measures it.

## 2. Policies

### Helpers (custom SQL migration)

All `SECURITY DEFINER`, `STABLE`, owned by the migration role, with
`SET search_path = public, pg_temp` pinned. Needed because `students`,
`roster_links` and `class_memberships` would otherwise reference each other's
policies and Postgres raises "infinite recursion detected in policy".

- `app_uid() → uuid` — `nullif(current_setting('app.user_id', true), '')::uuid`
- `app_role() → text`
- `app_sees_student(sid uuid) → boolean` — caller is the student's teacher, or
  has a `roster_links` row for it
- `app_teaches_student(sid uuid) → boolean` — teacher only
- `app_in_thread(tid uuid) → boolean` — caller has a `chat_participants` row,
  or owns the thread's class group

### Tables and rules

| Table | Read | Write |
| --- | --- | --- |
| `students` | teacher (`teacher_id = uid`) or any roster-linked user | teacher only; insert needs `teacher_id = uid` |
| `class_groups` | owning teacher | owning teacher |
| `class_memberships` | `app_sees_student(student_id)` or owning teacher of the class | owning teacher |
| `roster_links` | the linked user, or the student's teacher | linked user may insert/delete their own; teacher may delete |
| `parent_contacts` | `teacher_id = uid` | `teacher_id = uid` |
| `chat_threads` | `app_in_thread(id)` | creator, or class owner for the class thread |
| `chat_participants` | own row, or `app_in_thread(thread_id)` | own row (hide/read markers); thread creator adds others |
| `chat_messages`, `chat_message_reads`, `chat_message_reactions` | `app_in_thread` via the message | insert needs `sender_id` / `user_id = uid` **and** thread membership |
| `chat_blocks` | `blocker_user_id = uid` | `blocker_user_id = uid` |
| `chat_reports` | `reporter_user_id = uid`, or `school_admin` / `system_admin` | `reporter_user_id = uid`; admins update `status` |
| `device_push_tokens` | `user_id = uid` | `user_id = uid` |
| `evaluations`, `evaluation_questions`, `evaluation_assignments` | teacher owner; students/guardians for assigned evaluations | teacher owner |
| `attempts`, `attempt_answers`, `attempt_question_grades`, `grade_overrides`, `attempt_results`, `recommendations`, `grading_jobs`, `attempt_retakes`, `mastery_overrides` | `app_sees_student(student_id)` (attempt children via their attempt) | teacher of the evaluation; the student's own answers while the attempt is open |
| `refresh_tokens`, `password_reset_tokens`, `email_verification_tokens` | **no policy** — RLS on, default deny | `systemDb` only |

Admins get no blanket access. `school_admin`/`system_admin` appear only in the
`chat_reports` policy because `routes/moderation.ts` reads it.

### Not in this release

`users` (every roster and chat screen joins it for names; a correct "who may
see this user" rule is its own piece of work), curriculum/bank/library/
AI-artifact tables, `schools`, `rate_limit_buckets`, and the remaining
teacher-owned tables (`saved_materials`, `teaching_plans`, `schedule_*`,
`class_resources`, `lesson_media`, `feedback`). Each goes on an explicit
allowlist so the coverage guard (below) can tell "deferred on purpose" from
"forgotten".

## 3. Migrations and schema

- Policies and `.enableRLS()` are declared in the Drizzle schema
  (`pgPolicy`, `pgRole('iqraa_app').existing()`), so `drizzle-kit generate`
  stays in sync and CI's "generate must produce nothing" check still holds.
- A custom SQL migration (`drizzle-kit generate --custom`) creates the role
  and helper functions:
  - `CREATE ROLE iqraa_app NOLOGIN NOBYPASSRLS` (guarded by `IF NOT EXISTS`);
  - `GRANT iqraa_app TO CURRENT_USER`;
  - `GRANT USAGE ON SCHEMA public`, and `SELECT, INSERT, UPDATE, DELETE` on the
    protected tables (and `SELECT` on any table a policy or helper reads);
  - `ALTER DEFAULT PRIVILEGES` is deliberately **not** used — new tables are
    not granted automatically, so a forgotten table is unreachable rather than
    exposed.
- No password and no new secret. Migrations keep using the owner URL.
- Not destructive in the sense of `destructive-migration-ack.yml`; nothing is
  dropped or renamed, and with enforcement off nothing changes behaviourally.

## 4. Rollout

1. Merge: schema, role, helpers, policies, wrapper. `RLS_ENFORCE` unset → off.
   Production behaviour is unchanged.
2. Rehearse on a Neon branch with `RLS_ENFORCE=on`: teacher, parent and
   student flows by hand; measure per-query latency; confirm the owner can
   create and `SET ROLE` to `iqraa_app`, and that it works through the pooled
   endpoint.
3. Flip `RLS_ENFORCE=on` in production (Cloud Run env var, no deploy).
4. Rollback is `RLS_ENFORCE=off`.

`RLS_ENFORCE` is read at startup. It is a server-side env var, not
`EXPO_PUBLIC_*`, so none of the three client-side declaration sites apply.

## 5. Testing

CI already runs Postgres 16 with a superuser. New suites live under
`artifacts/api-server/src/**/__tests__/` (the globbed location) and apply the
real migrations.

- **Matrix suite** — connects through the wrapper with `RLS_ENFORCE=on` and
  asserts, per protected table: teacher A cannot read or write teacher B's
  rows; a parent sees only the linked child and that child's attempts; a
  student sees only their own; a non-participant cannot read a thread or post
  to it; an admin reads `chat_reports` but not `students`.
- **Fail-closed test** — a query with no identity in context returns zero rows
  and rejects writes.
- **Escape-hatch test** — `systemDb` can read across users; `db` cannot.
- **Coverage guard** — every table in the schema is either RLS-enabled or on
  the explicit deferred allowlist. A new table that is neither fails CI,
  matching the repo's convention of tests that fail on drift.
- **Off-mode test** — with `RLS_ENFORCE=off` the wrapper issues no `BEGIN`/
  `SET ROLE` and results match today's.
- The existing suites keep running with enforcement off, plus the key
  route suites (roster, messaging, attempts) once with enforcement on.

## 6. Limits and risks

- **Not injection-proof.** The session user is the owner, so injected raw SQL
  could `RESET ROLE`. This design protects against forgotten filters. A
  separate login role would close it at the cost of a second secret; revisit
  if the threat model changes.
- **The audit.** Cross-user reads in the existing code must each be found and
  handled; one missed makes that screen return empty under enforcement. The
  rehearsal and the route suites are the net.
- **Latency.** About two added round trips per statement under enforcement;
  measured before the flip.
- **Pooling.** `SET LOCAL` and `set_config(..., true)` are transaction-scoped,
  so they are safe behind a transaction-mode pooler. A session-level setting
  would not be.
- **Policy cost.** Helper functions are `STABLE` and index-backed
  (`roster_links_user_idx`, `chat_participants_user_idx`); check plans for the
  chat message list, the hottest path.
- **Unverified assumptions** to confirm on the Neon branch: owner can
  `CREATE ROLE` and `GRANT` it to itself; `SET LOCAL ROLE` works through the
  pooled endpoint.

## 7. Follow-ups (separate PRs)

1. `users` — visibility rule for self, co-participants, roster-linked users.
2. Remaining teacher-owned tables.
3. Shared-content tables, with read-all/write-admin policies.
4. Consider a separate login role if injection is added to the threat model.
5. Update `STATUS.md` and add a *Row-level security* section to
   `docs/deploying.md` (switch, rollback, how to add a table) in the PR that
   introduces the mechanism, per the repo's rule that STATUS moves with the
   change.
