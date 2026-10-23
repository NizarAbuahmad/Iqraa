# Row-level security latency — hold one scoped connection per request — design

Status: proposal 2026-10-23, written for review. No code yet.
Parent design: `2026-10-13-row-level-security-design.md`. Rollout steps:
`docs/rls-rollout-checklist.md`.

## Why

Switching `RLS_ENFORCE=on` failed the latency gate (checklist C1, 2026-10-23, `pnpm --filter
@workspace/db run bench:rls` against the rehearsal Neon project's pooled endpoint, from Cloud Shell):

| | off | on | added |
| --- | --- | --- | --- |
| 15 statements, median | 167.6 ms | 496.6 ms | +329 ms |
| 15 statements, p95 | 174.4 ms | 510.9 ms | **+336.5 ms** (budget +100 ms) |
| one statement | 11.2 ms | 33.1 ms | +21.9 ms |

Cause: `ScopedPool.query` (`lib/db/src/scopedPool.ts`) turns every statement into three round trips —
`BEGIN; SET LOCAL ROLE …; set_config(…)` (one simple query), the statement, `COMMIT` — where the owner
connection needs one. One round trip is about 11 ms from europe-west1 (Cloud Run) to Frankfurt (Neon), so
each statement pays about +22 ms.

Two caveats on that table. The "15 statements" was an estimate (the plan's «roughly fifteen»); the real
teacher inbox (`GET /messaging/threads`, `routes/messaging.ts`) is about eight sequential steps plus the
auth lookup, so its added cost today is nearer +190 ms than +336 ms — still over budget. And the benchmark
ran from Cloud Shell, whose distance to Neon is not Cloud Run's.

## Goal and non-goals

- **Goal:** the added latency of switching enforcement on is ≤ +100 ms at p95 on the teacher inbox, and the
  added cost per request elsewhere is a few round trips, not two per statement.
- **Non-goals:** moving Cloud Run or Neon to another region (rejected below); changing any policy; changing
  what a user can see; touching enforcement-off behaviour (`ScopedPool` with `enforce` false stays exactly a
  `pg.Pool`).

## Approaches

**A. Co-locate: run the API in europe-west3 (Frankfurt).** Round trip drops to ~1–2 ms. Rejected for now: a
Cloud Run service cannot change region, the new address would differ, and the old address
(`iqraa-api-613126375862.europe-west1.run.app`) is inlined in the web build (`deploy.yml`), every Android
build and OTA update (`mobile-update.yml`, `mobile-build-gradle.yml`) and the Cloud Scheduler reminder job.
Installed apps keep calling the old address until they update, so it means two live services for weeks.
Worth doing for general speed one day; not as a fix for this.

**B. One scoped connection per request (recommended).** Check a connection out once, send
`BEGIN; SET LOCAL ROLE …; set_config(…)` once, run every statement of the request on it, `COMMIT` when the
response is done. Added cost per request: about three round trips (~33 ms), whatever the statement count.

**C. Fewer trips per statement without holding.** Rejected: the extended protocol cannot carry the scope and
a parameterised statement in one message; deferring the `COMMIT` to the next borrower leaves a transaction
open on an idle connection, which pins a server connection behind Neon's transaction-mode pooler.

## Design (B)

1. **Quick win first — the auth lookup.** `middlewares/auth.ts` reads the user row with `db` on every
   authenticated request, before identity is set, so with enforcement on it pays three round trips for a
   `users` read that has no policy (`users` is deferred). Move it to `systemDb` (the owner connection, one
   round trip) and add `auth.ts` to `systemDbFiles.test.ts` with that reason. Saves ~22 ms on every route.
2. **`lib/db/src/requestScope.ts`.** An `AsyncLocalStorage` slot beside the identity, holding a
   `RequestScope { client, ended }`. `holdScopedConnection()` is an Express middleware, mounted per route
   after `authMiddleware`. With enforcement off it does nothing.
3. **`ScopedPool.query` consults the scope.** If the current request has an open scope it acquires the
   client lazily on first use (`BEGIN READ ONLY; SET LOCAL ROLE …; set_config(…)`, one round trip), then runs
   the statement directly on it — no per-statement `BEGIN`/`COMMIT`. If the scope has ended, or there is none, it
   takes the existing per-statement path, so nothing is ever unscoped.
4. **`READ ONLY` and GET only.** The middleware refuses any method but GET and the transaction is
   `READ ONLY`, so an allow-listed route that ever tries to write gets a Postgres error, not a long-held write
   transaction. Writes that already use `systemDb` run on the other pool and are unaffected.
5. **End of scope.** The scope is closed from `res.on('finish')` / `res.on('close')` using the `RequestScope`
   object captured when the middleware ran — not the async store, which the `close` callback does not
   inherit. It `COMMIT`s (or `ROLLBACK`s after an error) and releases; a connection that cannot roll back is
   destroyed. A hold timeout (5 s) rolls back and destroys it so a stuck handler cannot pin a pool slot.
6. **Allow-list, not default.** A reviewed list of GET routes, each with a reason, in
   `artifacts/api-server/src/lib/heldReads.ts`: routes that make no model call, no HTTP call and no push
   while the handler runs (the connection is held that long). A test asserts every entry is a GET and none is
   under `/generate` or `/chat`. Start with the teacher inbox and the family home reads; extend only with a
   measurement.
7. **Serialisation.** One client runs one statement at a time, so a `Promise.all` inside a held request
   becomes sequential (+1 round trip per extra parallel statement). The inbox has one such pair.

## What stays slower

Routes not on the list, and every write, keep +2 round trips per statement (~22 ms each). A four-statement
route adds ~90 ms. That is a judgement for the owner: extend the list route by route, or accept it. The
original "+25 % elsewhere" budget would fail every unlisted route and is replaced by "no listed route over
+100 ms; unlisted routes known".

## Testing and gates

- **Measure first:** count statements and sequential steps per route in the differential harness, so the
  allow-list and the budget use real numbers, not the estimate of 15.
- `bench:rls` gains a `held` mode (one scope, N statements, one commit). **Gate:** inbox-shaped request,
  p95 added ≤ +100 ms, measured the same way as the failed run.
- New tests in `lib/db/src/__tests__`: identity isolation with two users interleaved on a pool of one; the
  scope ends on finish, on close and on error; the pool returns to `idle == total` after N requests (no
  leak); a write in a held scope errors; after the scope ends a statement still runs scoped; enforcement-off
  is identical to `pg.Pool`.
- `rlsDiff.test.ts` runs the allow-listed routes with holding on and off: same statuses, bodies, pushes.

## Risks

- A held connection is parked for the handler's whole run. Pool size 10 per instance bounds it; the hold
  timeout and the allow-list are the guard. `poolStats().waiting` is the signal to watch after the flip.
- A route that grows an external call later keeps the connection through it. The allow-list test cannot see
  that; review of a PR touching a listed handler must.
- Does not remove the other costs already documented: `users` and 22 tables stay deferred, not
  injection-proof.
