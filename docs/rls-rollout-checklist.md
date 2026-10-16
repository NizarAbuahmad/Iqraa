# Row-level security — rollout checklist

Row-level security is **deployed and switched off** (`RLS_ENFORCE` unset; PR #1048,
migration `0008`). Until the steps below are done it protects nothing. This is the
person-with-Neon-and-Cloud-Run-access checklist; the reasoning is in
[`docs/deploying.md`](./deploying.md) (*Row-level security*) and the plan's Task 7
(`docs/superpowers/plans/2026-10-13-row-level-security.md`).

Tick a box only when you have seen the result. Do not skip ahead: A is about production as
it is today, B–C gate the switch, D–E are the switch. When a step has a **Gate**, a failed
gate means stop and do not flip.

Values used below: Cloud Run service `iqraa-api`, region `europe-west1`, project
`iqraa-auth-507315`.

## A. Is production healthy right now?

The migration ran in production on 2026-10-14 without the pre-merge ownership check
having been done, so this is the check that was skipped.

- [ ] **A1. Look at the app.** Sign in as a teacher, open the inbox, open a class, open an
  evaluation. In the Cloud Run logs for `iqraa-api` search for `permission denied` and
  `row-level security`. **Gate:** none.
- [ ] **A2. Check table ownership** with the *exact* `DATABASE_URL` Cloud Run uses (read-only):

  ```bash
  psql "$CLOUD_RUN_DATABASE_URL" \
    -c "select current_user" \
    -c "select tablename, tableowner from pg_tables where schemaname='public' order by 1"
  ```

  **Gate:** `current_user` equals `tableowner` on **every** row. If not, the API's role is
  subject to the new policies and has no policy of its own. Make that role the owner
  (`ALTER TABLE … OWNER TO …`, a separate reviewed change) before anything else.
- [ ] **A3. Check the two connection strings name the same role:** GitHub's
  `secrets.DATABASE_URL` (the `production migrations` job in `deploy.yml`) and Cloud Run's
  `DATABASE_URL`. The `SECURITY DEFINER` helpers are owned by the *migrating* role and bypass
  RLS only if that role also owns the tables. **Gate:** same role.

## B. Rehearse on a Neon branch (never production)

- [ ] **B1. Branch production in Neon.** Note the connection string as `BRANCH_URL`.
  It must use the **same role** as Cloud Run's `DATABASE_URL` (a branch made in the console may
  default to a different owner role, which makes the later checks meaningless). Confirm with:

  ```bash
  psql "$BRANCH_URL" -c "select current_user"
  ```
- [ ] **B2. Make sure the branch is one where `0008` has not run.** Production already has it,
  so a branch of today's production will report "nothing to apply" and prove nothing. Branch
  from a point in time before 2026-10-14 00:55 UTC, or reset the branch's `drizzle` schema and
  `public` schema and re-apply from scratch. Then:

  ```bash
  DATABASE_URL="$BRANCH_URL" pnpm --filter @workspace/db run migrate -- --from-env
  ```

  **Gate:** it applies `0008` without error. This proves the Neon owner role can
  `CREATE ROLE` and `GRANT iqraa_app TO CURRENT_USER`.
- [ ] **B3. Run the database tests against the branch** — through the **pooled** endpoint if
  production uses one:

  ```bash
  RLS_TEST_DATABASE_URL="$BRANCH_URL" pnpm --filter @workspace/db run test
  ```

  **Gate:** every test passes (42 at the time of writing). This proves `SET LOCAL ROLE` and
  `set_config(…, true)` survive the pooler. If it fails behind the pooler, retry on the direct
  endpoint and record which endpoint production uses. The suites create throwaway users and
  delete them; on a branch that is safe.

## C. Measure and check limits

- [ ] **C1. Measure the added latency from where the API runs** (a Cloud Run job, or a VM in
  the API's region — numbers from a laptop overstate the cost). Use the benchmark script in
  the plan, Task 7 Step 3: it prints ms per statement with enforcement off and on. Then
  multiply the difference by the statements in a typical request (the teacher inbox is the
  heaviest read).

  **Gate:** p95 within budget — suggested ≤ +100 ms on the inbox, ≤ +25 % elsewhere. If it
  fails, do not flip. Mitigations, in order: co-locate Cloud Run with Neon; a request-scoped
  transaction for routes that never call a model; fewer statements per request.
- [ ] **C2. Check the connection ceiling.** With enforcement on an instance holds **two** pools
  (default 10 connections each). **Gate:** Neon's `max_connections` (or the pooler's limit) is
  at least `2 × 10 × <Cloud Run --max-instances>`. If not, set `max` explicitly on both pools in
  `lib/db/src/index.ts` (a code change) or lower `--max-instances`.
- [ ] **C3. Walk the flows by hand against an enforcing API pointed at the branch.** Do **not**
  do this by adding the branch URL to the production Cloud Run service: a new revision of
  `iqraa-api` carries its env vars forward, and the next deploy would ship the branch database
  to production traffic. Instead run the API locally (see `LOCAL_SETUP.md`):

  ```bash
  pnpm --filter @workspace/api-server run build
  DATABASE_URL="$BRANCH_URL" RLS_ENFORCE=on pnpm run dev:api   # :8080
  ```

  and point the web app at it. (If you must use Cloud Run, create a **separate** service for
  it, e.g. `iqraa-api-rls`, never the production one.) Walk these and watch the API's output for
  `permission denied` and `row-level security`:

  - [ ] Teacher: roster, create a class, add a student, issue a claim code, DM a parent, post in
    a class group, release results, reissue a parent's login code.
  - [ ] Parent: claim a student with the code, open the inbox, read a thread, reply (the thread
    must move to the top of the teacher's inbox), open `/parent/exams`.
  - [ ] Student: claim their record, take an exam from a share link, read results, retake a
    failed exam if mastery gating is on.
  - [ ] A parent blocked by a teacher cannot open a new thread with them.
  - [ ] Push notifications arrive for a teacher's post (check a device, not just the API log).

  **Gate:** every flow works and the log has no `permission denied` / `row-level security`.

## D. Switch it on

Outside school hours, and only with A, B and C ticked.

- [ ] **D1. Note the current state**, so rollback is unambiguous:

  ```bash
  gcloud run services describe iqraa-api --region europe-west1 \
    --project iqraa-auth-507315 --format='value(status.latestReadyRevisionName)'
  ```
- [ ] **D2. Turn it on:**

  ```bash
  gcloud run services update iqraa-api --region europe-west1 \
    --project iqraa-auth-507315 --update-env-vars RLS_ENFORCE=on
  ```

  Use `--update-env-vars`, never `--set-env-vars` (that replaces every secret).
- [ ] **D3. Watch for 30 minutes:** 5xx rate, p95 latency, push volume, and logs for
  `permission denied` / `row-level security`. Repeat the teacher inbox and a parent reply by
  hand. The failure to look for is quiet: a notification not sent, a block not honoured, a
  thread that does not move up the inbox — not a 500.
- [ ] **D4. Rollback, if anything is off — the whole rollback:**

  ```bash
  gcloud run services update iqraa-api --region europe-west1 \
    --project iqraa-auth-507315 --update-env-vars RLS_ENFORCE=off
  ```
- [ ] **D5. Update `STATUS.md`** (the *Row-level security is built and switched off* section
  says "off" and "never run against Neon") in the same sitting, and tick this file's date below.

## E. Make the CI job required

- [ ] **E1.** GitHub repo → Settings → Rules (or Branches) → the rule for `main` → *Require
  status checks to pass* → add **`row-level security`** (next to `typecheck + tests`) → save.
  A PR that breaks a policy then cannot merge.

## Record

| Step | Done by | Date | Notes (numbers, endpoint used, anything odd) |
| --- | --- | --- | --- |
| A | | | |
| B | | | |
| C | | | |
| D | | | |
| E | | | |
