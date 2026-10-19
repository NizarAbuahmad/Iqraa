# Load test

Drives the real HTTP API the way launch day will: a sign-up and sign-in rush,
then classes of students sitting a published exam while their teachers watch.
No browser, so it measures the server and Postgres, not React.

| Phase | What it does | Why |
| --- | --- | --- |
| `signup` / `verify` / `login` | N accounts register, enter their code, then sign in, all at once | bcrypt cost 12, the rate-limit upserts, one connection pool |
| `exam` | C teachers each publish an exam to a class of S students; every student opens the link, claims a name, answers every question, submits and fetches the result, ramped over `--ramp-s` | the path a real class uses; teachers poll attempts meanwhile |
| `bystander` | `GET /healthz` (no database) every 250 ms for the whole run | shows when the Node event loop is starved, which no per-route number does |

The sign-up, verify and sign-in phases behave like the app: a `503` the API sends
on purpose (`hashing_busy` / `db_busy`, "busy, try again") is retried after
`Retry-After`, and the report counts it as **shed**, not as an error. What it
checks is that every account gets through, and how long that takes from the
user's side (`--max-rush-ms` to gate on it).

After the exam it asks Postgres how many attempts are really stored, because a
`200` from submit is not the same thing as a row.

## Run it

It **creates users, classes and exams, truncates `rate_limit_buckets`, and writes
verification codes straight into Postgres**. Give it a throwaway database and
the API that uses it; it refuses `*.run.app`, `iqrra.com`, and any non-local host
unless you pass `--allow-remote` (for a staging service you own).

```bash
# empty Postgres, migrated and seeded (see CLAUDE.md: "Browser smoke test")
export DB=postgres://postgres@127.0.0.1:5432/iqraa_load
DATABASE_URL=$DB pnpm --filter @workspace/db run migrate -- --from-env
DATABASE_URL=$DB pnpm --filter @workspace/db run seed:assessment
pnpm --filter @workspace/api-server run build

# the API, as e2e/playwright.config.ts starts it (+ ADMIN_DEBUG_KEY for pool stats)
PORT=8099 NODE_ENV=development DATABASE_URL=$DB SESSION_SECRET=x-0123456789-0123456789-0123456789 \
  OPENAI_API_KEY=sk-placeholder AI_LIVE_MODE=false STUDENT_ACCOUNTS=false ADMIN_DEBUG_KEY=lt-admin \
  node artifacts/api-server/dist/index.mjs &

cd e2e && LOADTEST_DATABASE_URL=$DB pnpm run loadtest -- --signups 100 --classes 5 --students 60 --admin-key lt-admin
```

`--help` lists every option. It exits 1 if more than `--max-error-rate` (default
1%) of requests were 5xx or never answered, if any student failed to finish, if
stored submissions don't match successful submits, or (optionally) if a route's
p95 exceeds `--max-p95-ms`.

## Reading the result

- **shed (503 busy) is not a failure either**, but a lot of it means the instance
  is at capacity. Compare `time to success incl. retries` with the client's 15 s
  patience (`API_TIMEOUT_MS`).
- **429s are not failures.** One load generator is one IP. Against a local API the
  script gives each virtual user its own `X-Forwarded-For` (Express trusts one
  proxy hop, so this works only with nothing in front of the API). Behind Cloud
  Run the real client IP wins and you will hit the per-IP limiters — which is
  itself worth knowing for a school behind one NAT address.
- **`db pool … waiting`** needs `--admin-key` (the API's `ADMIN_DEBUG_KEY`). A number
  that stays above zero means requests are parked waiting for one of the
  instance's connections (`DB_POOL_MAX`, default 10).
- **A local run has no network between the API and Postgres.** Production adds a
  Cloud Run → Neon round trip to every query, so treat exam-path latencies as a
  floor, and the bcrypt/event-loop numbers (pure CPU) as close to the truth. For
  numbers that mean something for production, point `--api` at a staging
  Cloud Run service wired to a Neon *branch* with `--allow-remote`.
- It is **one process on one machine**: past a few thousand concurrent virtual
  users the load generator, not the server, becomes the limit.
