# Row-level security — rollout checklist

Row-level security is **deployed and switched off** (`RLS_ENFORCE` unset; PR #1048,
migration `0008`). Until the steps below are done it protects nothing. This is the
person-with-Neon-and-Cloud-Run-access checklist; the reasoning is in
[`docs/deploying.md`](./deploying.md) (*Row-level security*) and the plan's Task 7
(`docs/superpowers/plans/2026-10-13-row-level-security.md`).

Tick a box only when you have seen the result. Do not skip ahead: A is about production as
it is today, B–C gate the switch, D–E are the switch. A2 and A3 were done on 2026-10-16 and B and C2 on 2026-10-23; the
rest is open. When a step has a **Gate**, a failed
gate means stop and do not flip.

Values used below: Cloud Run service `iqraa-api`, region `europe-west1`, project
`iqraa-auth-507315`.

## A. Is production healthy right now?

- [x] **A2. Table ownership — passed 2026-10-16.** Connected with the Secret Manager
  `DATABASE_URL` (the one Cloud Run reads): `current_user = neondb_owner`, and **0** tables in
  `public` owned by anyone else. So the API's role owns every table and bypasses RLS: the
  migration changed nothing for it. (The URL was read with `gcloud secrets versions access
  latest`; if Cloud Run pins an older secret version, re-check against that version.)
- [x] **A3. Same role in both connection strings — passed by inference.** Enabling RLS on a
  table needs ownership; the production migration succeeded and every table is owned by
  `neondb_owner`, so the migrating role is `neondb_owner` or a member of it.
- [ ] **A1. Look at the app and the logs.**
  1. Cloud Shell: search the logs since the deploy for the two error phrases —

     ```bash
     gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="iqraa-api" AND ("permission denied" OR "row-level security")' \
       --project iqraa-auth-507315 --freshness=3d --limit=20 \
       --format='value(timestamp,severity,textPayload,jsonPayload.msg)'
     ```
  2. Sign in as a teacher: open the inbox, a class and an evaluation, and send one test message.

  **Gate:** the search prints nothing and every screen loads with data.

## B. Rehearse on a separate Neon project (never production)

Use a **new, empty Neon project**, not a branch of production: a branch of today's production
already has `0008`, so "apply the migration" would prove nothing. The test suites create their
own fixtures, so an empty database is enough.

**Shortcut: let GitHub run B3 and B4.** The workflow `.github/workflows/rls-neon-rehearsal.yml`
applies the migrations to the rehearsal project and runs the suites on the direct **and** pooled
endpoints, so no local Node setup is needed. After B1, add two repository secrets
(Settings → Secrets and variables → Actions): `NEON_REHEARSAL_DIRECT_URL` and
`NEON_REHEARSAL_POOLED_URL`. Then Actions → *RLS Neon rehearsal* → *Run workflow*, and type
`rehearsal-not-production`. It refuses any database that already has tables in `public` and
was not created by the workflow itself, so a production string pasted by mistake stops at the
first step. A green run is B3 and B4 passed; B2 can be skipped. (It does not measure latency —
GitHub's runners are not in your Cloud Run region — so C1 is still separate.)

- [x] **B1. Create the project — done 2026-10-23** (`iqraa-rls-rehearsal`, Frankfurt, as production).
  Original instruction: In the Neon console create `iqraa-rls-rehearsal` in the
  **same region as the production Neon database** (latency in C1 is only meaningful there).
  Copy the **direct** and the **pooled** connection strings into a private note — never into
  chat or the repo.
- [x] **B2. Get the code** — skipped; the workflow does it on GitHub's runner.
  Original instruction: (Cloud Shell or any machine with Node 22+ — the tests use
  `--experimental-strip-types`):

  ```bash
  git clone https://github.com/NizarAbuahmad/Iqraa.git && cd Iqraa
  node -v                                  # v22 or newer
  corepack enable && pnpm install
  pnpm --filter @workspace/api-server run build
  ```
- [x] **B3. Apply the migrations to the empty project — passed 2026-10-23** (workflow run 39931238295,
  "Migrations up to date: 14 applied").
  Original instruction:

  ```bash
  export DIRECT_URL='<direct string>'  POOLED_URL='<pooled string>'
  DATABASE_URL="$DIRECT_URL" pnpm --filter @workspace/db run migrate -- --from-env
  ```

  **Gate:** all migrations apply, including `0008`, with no error. This proves the Neon owner
  role can `CREATE ROLE` and `GRANT iqraa_app TO CURRENT_USER`.
- [x] **B4. Run the database tests on both endpoints — passed 2026-10-23:** 46 of 46 on the direct
  endpoint and 46 of 46 on the pooled one (host `…-pooler…`), 0 failed, 0 skipped, same run.
  Original instruction:

  ```bash
  RLS_TEST_DATABASE_URL="$DIRECT_URL"  pnpm --filter @workspace/db run test
  RLS_TEST_DATABASE_URL="$POOLED_URL"  pnpm --filter @workspace/db run test
  ```

  **Gate:** every test passes on **both** (46 on 2026-10-23). The pooled run proves
  `SET LOCAL ROLE` and `set_config(…, true)` survive the pooler. The suite includes
  `rlsDiff.test.ts`, which boots the built API with enforcement off and on and replays the main
  teacher, parent and student flows — pushes, blocks, retakes, inbox order — so it replaces a
  hand click-through of those flows. Record which endpoint production uses.

## C. Measure and check limits

- [ ] **C1. Measure the added latency — FAILED the gate on 2026-10-23, do not flip.** `bench:rls`
  from Cloud Shell against the rehearsal project's pooled endpoint: 15 statements cost 167.6 ms off
  and 496.6 ms on (median), p95 174.4 vs 510.9 ms — **+336.5 ms** against a budget of +100 ms; +21.9 ms
  per statement. Cause: with enforcement on each statement is three round trips (BEGIN + scope, the
  statement, COMMIT) instead of one, and one round trip is about 11 ms here (the API is in
  europe-west1, the database in Frankfurt). Tick this only after a mitigation below brings the same
  benchmark under the budget, measured from the API's region.
  **Mitigation built (2026-10-23, spec `docs/superpowers/specs/2026-10-23-rls-latency-request-scoped-connection-design.md`):**
  the inbox (`GET /messaging/threads`) holds one scoped, read-only connection per request, so it pays about
  three round trips instead of three per statement. The held read ends when the response finishes, so a slow
  client keeps the connection until then (bounded by the 5 s hold timeout). Re-run `bench:rls` from Cloud Shell
  once this has shipped and read the `held` column; **the gate is the `held` p95 added ≤ +100 ms**. Every route
  not on `artifacts/api-server/src/lib/heldReads.ts` still pays the `on` column (about 22 ms per statement), so
  decide whether that is acceptable or which route to add next. After the flip, `LOG_LEVEL=debug` logs
  `held scope ended` with the statements and milliseconds each held request used.
  Original instruction: against the rehearsal project's **pooled** string, from
  the API's region if you can (a Cloud Run job, or a VM there; numbers from a laptop overstate
  the cost). Run the benchmark: `BENCH_DATABASE_URL='<pooled string of the rehearsal
  project>' pnpm --filter @workspace/db run bench:rls` (`lib/db/scripts/bench-rls.ts`; read-only; it
  alternates enforcement off and on and prints the added ms per statement and per 15-statement
  request, and says whether the inbox gate holds). On a laptop-free loopback Postgres it added about
  0.3 ms a statement, which is a floor, not a forecast. Multiply the difference by the statements in a typical request (the
  teacher inbox is the heaviest read, roughly fifteen).

  **Gate:** p95 within budget — suggested ≤ +100 ms on the inbox, ≤ +25 % elsewhere. If it
  fails, do not flip. Mitigations, in order: co-locate Cloud Run with Neon; a request-scoped
  transaction for routes that never call a model; fewer statements per request.
- [x] **C2. Connection ceiling — passed 2026-10-23.** Cloud Run `maxScale` 20, `minScale` 1; the API's
  `DATABASE_URL` points at the Neon **pooled** host (`…-pooler…`); the database's `max_connections` is
  225. The worst case with enforcement on is 20 × 20 = 400 client connections, above 225, but they go
  through Neon's pooler, which shares a smaller set of server connections (a burst queues at the
  pooler instead of being refused), and the pooled endpoint is the one the rehearsal passed on.
  Original instruction: With enforcement on an instance holds **two** pools
  (default 10 connections each). **Gate:** the production Neon database's `max_connections` (or
  the pooler's limit) is at least `20 × <Cloud Run --max-instances>`. Read `maxScale` with:

  ```bash
  gcloud run services describe iqraa-api --region europe-west1 --project iqraa-auth-507315 \
    --format='value(spec.template.metadata.annotations)'
  ```

  If the limit is too low, set `max` explicitly on both pools in `lib/db/src/index.ts` (a code
  change) or lower `--max-instances`.

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
| B | owner, via the GitHub workflow | 2026-10-23 | run 39931238295: migrations applied; 46/46 direct, 46/46 pooled. Direct tests ≈ 3.4 min, pooled ≈ 3.3 min (CI runner → Neon, not a latency measurement). Run 4 before it failed only because the pooled secret held a malformed string. |
| C | owner | 2026-10-23 | C2: maxScale 20, pooled host, max_connections 225 — pass via the pooler. C1: **failed** — +336.5 ms p95 per 15-statement request (budget +100 ms); +21.9 ms per statement; RTT ≈ 11 ms. |
| D | | | |
| E | | | |
