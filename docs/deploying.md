# Deploying

Three services, and **the order they deploy in matters** — which is the reason
this file exists. `.github/workflows/deploy.yml` ships all three from `main`,
each only when a merge touches it (see below): the API and verifier to Cloud
Run first, the web bundle to Cloudflare Pages after, and it skips the web
deploy entirely if either server deploy failed.

| | Where | How it deploys |
| --- | --- | --- |
| `iqraa-api` | Cloud Run | **Automatic** on a merge to `main` that touches the API |
| `iqraa-verifier` | Cloud Run | **Automatic** on a merge to `main` that touches the verifier |
| `iqraa-web` | Cloudflare Pages (static) | **Automatic** on a merge that could change the bundle; waits on the two above |
| Database | Neon | **Migrations apply automatically** on a merge that touches the API (the API deploy's own condition), before the new API revision takes traffic — see *Schema* below |

**Server before client, on purpose.** A new API behind an old bundle is
harmless: the bundle simply does not call the new route. The reverse is an
outage. That is not hypothetical — on 2026-09-10 a web bundle went live against
an API that lacked the matching route and broke production signups. From the
2026-09-05 Cloud Run cutover until 2026-09-15 the API and verifier were
deployed by hand, which is what made that possible; automating them closed it.

Each surface deploys only when its own paths changed (`lib/**` counts as an API
change, because the API bundles those packages, and `deploy.yml` itself counts
for every surface, because their flags and env vars live in it — since
2026-10-17; before that, an env var added there waited for the next API code
change to reach Cloud Run), and each job verifies against
the running system rather than trusting the tool: the API asserts
`/api/healthz/version` reports the deployed short SHA, because `gcloud` has
printed a success line while traffic stayed pinned to an older revision
(2026-09-07).

A skipped job is not a failure, so a green Deploy run does not mean a surface
shipped: open the run's job list. The 2026-10-27 video-shelf merge (#1324, only
the app and docs) ran `iqraa-web` alone; an API-only merge (#1323) ran the
migrations, the schema check and `iqraa-api` and skipped the verifier and the
web bundle; a docs-only merge (#1327) ran none of them. The exact path lists are
in the `what changed` job of `deploy.yml`, not here.

CI authenticates to GCP with **Workload Identity Federation** — no service
account key is stored in GitHub. The provider is bound by attribute condition to
this repository alone and mints a short-lived token per run, which matters
because this repo is public. The hand commands below still work and are the
right tool for an emergency, but they are no longer the normal path.

Cloud Run project `iqraa-auth-507315`, region `europe-west1` (nearest Google
region to Neon in Frankfurt). The Render API and verifier were retired from the
blueprint on 2026-09-05, and `iqraa-web`'s deploy moved off Render on
2026-09-13. The `iqraa-web` block is still in `render.yaml` on purpose, as a
rollback path — Render is no longer the deploy target, and its builds stay
capped, so it will simply serve whatever it last built. Delete the block once
Cloudflare has been serving for a while.

## The web app

Nothing to do. The `web` job in `.github/workflows/deploy.yml` builds the bundle
on every merge to `main` that could change it (an API-only, verifier-only or
docs-only merge skips it) and publishes it to Cloudflare Pages, and the build inlines
every `EXPO_PUBLIC_*` value — so changing one of those needs a **web rebuild**,
not just an API redeploy. Those values live in that workflow now, not in
`render.yaml`.

It moved off Render on 2026-09-13. Render's free tier meters **build minutes**
(500/month), and `pnpm install` plus an Expo export of this monorepo at ten
merges a day does not fit. On 2026-09-12 the workspace hit the cap and every
deploy was cancelled after 0.9s for a day while the site served a stale bundle —
CI green, `render.yaml` correct, nothing down. This repo is public, so Actions
runners are free and unmetered, and Cloudflare receives an already-built
directory, so neither side has a build ceiling any more.

Two things a future host change must carry, both of which bite silently:

- **The SPA catch-all.** `artifacts/mobile/public/_redirects` maps `/* →
  /index.html` with a `200`. Without it, `/workspace` and every other Expo
  Router deep link 404s on refresh.
- **The commit stamp.** `scripts/inject-pwa.mjs` reads `BUILD_COMMIT` (then
  `RENDER_GIT_COMMIT`, then `'dev'`) for `<meta name="build-commit">`. A host
  that sets neither stamps every deployed bundle `dev`, which destroys the one
  marker that answers "is this live?".

To check a change is actually live rather than trusting the dashboard, grep the
served bundle for something the change added or removed:

```bash
curl -s https://<web-host>/ | grep -oE '/_expo/static/js/web/[A-Za-z0-9._-]+\.js'
```

then `curl` that path and grep it. String literals survive minification, so a
changed array of question types or a new translation key is findable.

## The API and the verifier

Run from a clean checkout of merged `main`, with `gcloud` authenticated against
`iqraa-auth-507315`. Both commands are the ones in the Dockerfile headers —
`Dockerfile` and `artifacts/math-verifier/Dockerfile`, which stay the source of
truth if these ever drift:

```bash
gcloud run deploy iqraa-api --source . --region europe-west1 --allow-unauthenticated --port 8080 \
  --update-env-vars GIT_SHA=$(git rev-parse --short HEAD)
```

`GIT_SHA` is what `/healthz/version` reports back. It is the only way to tell
whether a deploy actually happened, because the API deploys only when a merge
touches it (or by hand, as here) while web ships whenever the app changes — a
stale API looks identical to a current one from the outside. Omit the flag and the route answers `"unknown"`, which is honest
but useless. `--update-env-vars` (not `--set-env-vars`) leaves the existing
secrets alone; see the warning below.

```bash
gcloud run deploy iqraa-verifier --source artifacts/math-verifier --region europe-west1 --allow-unauthenticated --port 8080
```

The API's build context is the **repo root**, not `artifacts/api-server`: the
build copies a data directory out of `lib/curriculum` and pnpm needs the
workspace manifests. The verifier's context is its own directory.

**"Clean checkout" is the whole instruction, and Cloud Shell will quietly
defeat it.** Its home directory persists between sessions, so a `git clone` run
there a second time fails with `destination path 'Iqraa' already exists`. Paste
clone-then-`cd`-then-deploy as one block and the clone's failure scrolls past
while `cd` and the deploy both succeed — against whatever that directory held.
On 2026-09-13 that deployed `cf1c2b7`, eight days and about 150 pull requests
stale, over a current API; `/api/healthz/version` answered `Cannot GET` because
the route did not exist yet in code that old. Always:

```bash
cd ~/Iqraa && git checkout main && git pull   # or clone somewhere new
git log --oneline -1                          # and read it
```

Then confirm what is running, after the deploy, from outside:

```bash
curl -s https://iqraa-api-613126375862.europe-west1.run.app/api/healthz/version
```

The `commit` it reports must match that `git log`. This is the check that
catches a stale build, and it costs one request.

**Do not re-enter the secrets.** `DATABASE_URL`, `OPENAI_API_KEY`,
`GOOGLE_CLIENT_ID`, `YOUTUBE_API_KEY` and the R2 keys already live on the Cloud
Run services. A `gcloud run deploy` with no env flags leaves the existing ones
in place — passing `--set-env-vars` would **replace all of them**, so use
`--update-env-vars` if you genuinely need to change one. This is not
housekeeping: on 2026-09-04 a hand-transcribed `OPENAI_API_KEY` arrived with a
bullet character in it, passed every health check, and failed only when a
teacher generated a worksheet.

### Checking it worked

```bash
curl -s https://iqraa-api-613126375862.europe-west1.run.app/api/healthz
curl -s https://iqraa-api-613126375862.europe-west1.run.app/api/healthz/verifier
```

`/healthz` **without** the `/api` prefix does not work on Cloud Run — Google
Front End reserves that path and answers with its own 404 before the container
sees it. That looks like a broken deploy and is not one.

A health check proves the container booted, and **that is all it proves.**
`/healthz` is `res.json({ status: "ok" })` — a static literal that touches no
database and no credential (`routes/health.ts`). This file claimed for a while
that it proved the container "can reach the database" — corrected 2026-09-07
after checking the handler. To prove a given secret, call something that uses
it; *Rotating a secret* below lists the one cheap request per credential.

## Is a given change live? Probe the route, not the git log

`git log` cannot answer this, and neither can `/api/healthz`. Several sessions
work in this repo at once and any of them may deploy, so the last deploy *you*
know about is not the running one — the API went through eleven revisions in
roughly an hour on 2026-09-06. Reasoning from "the deployed revision was built
from commit X" is reasoning from a fact with a very short shelf life.

Two things do answer it.

**What is running:**

```bash
gcloud run revisions list --service iqraa-api --region europe-west1 --project iqraa-auth-507315 --limit 5
```

**What is in it** — call a route the change added, and **read the body**. The
status code alone is not enough: a missing route and a missing record both come
back `404`, and telling them apart is the whole point.

```bash
API=https://iqraa-api-613126375862.europe-west1.run.app/api
curl -s "$API/auth/join/ABC234"          # a route only newer code has
curl -s "$API/definitely/not/a/route"    # what a MISSING route looks like
```

| Response body | Means |
| --- | --- |
| `{"error":"...","code":"code_not_found"}` | **The route is deployed.** It ran, looked, and found nothing — that is the handler answering. |
| `<!DOCTYPE html>… Cannot GET /api/…` | **The route is not deployed.** Express's own fallback; no handler exists. |

The JSON-versus-HTML distinction is the signal.

**The probe must be an UNAUTHENTICATED route.** This is not a detail — get it
wrong and the probe reports "deployed" for a route that does not exist. Auth
middleware runs *before* routing, so every path under a guarded prefix answers
`{"error":"No token provided"}` whether or not the route is there:

```bash
curl -s -X DELETE "$API/students/000/links/000"                    # real route
curl -s -X DELETE "$API/students/000/links/000/definitely-not-real" # not a route
# both: {"error":"No token provided"}  — proves nothing either way
```

So pick a public route the change introduced — `/auth/join/:code`, `/take/:code`
and the other `/take/*` endpoints are the unauthenticated surface. If the change
only touched guarded routes, this technique cannot see it; check the revision
timestamp against when the change merged instead.

**POST probes need a body.** `curl -X POST` with none gets Google Front End's
`411 Length Required` before the container is reached, which looks like a
failure and is not. Use `-d '{}'`.

Both directions of this have been got wrong here in one day: a deploy reported
as done that never ran (every command had failed on `PATH`, while `/api/healthz`
answered `ok` from the *old* revision), and changes assumed undeployed that had
shipped hours earlier from another session. In both cases a green health check
looked identical to the truth and to its opposite.

## A Deploy that was cancelled before it ran

A Deploy can sit at "cancelled" with nothing deployed and no step ever run. It
happened on 2026-10-05 (runs #417 and #418, 20:26 and 20:59 UTC): the first job,
`what changed`, was cancelled after about 15 minutes with no steps recorded and no
log, even though it has a 5-minute `timeout-minutes`. GitHub had assigned it to a
runner that never started it, and `timeout-minutes` only counts a job that has
started. Everything downstream was skipped, so the merge was not deployed until
the next one.

`.github/workflows/deploy-rerun-stalled.yml` re-runs such a Deploy **once**, and
only when the run was a push to `main`, was its first attempt, is still the head
of `main`, and had a job cancelled with no steps. Each condition is there because
"cancelled" is also what a deliberate cancellation looks like: the `web` job
cancels an older web deploy when a newer push arrives, and a person can cancel by
hand. Re-running either of those would put older code live over newer code.

If it does not fire (or a second attempt stalls too), re-run by hand: Actions,
then the Deploy run, then *Re-run all jobs*; or dispatch Deploy with a `target`.
Check the run is for the commit you want live, as above.

## Rotating a secret

Same shape every time: **create the new credential, install it, prove it works
with a real request, and only then revoke the old one.** Revoking first leaves
no working key and a broken write path, and the failure will not be where you
are looking.

**Credentials live in Secret Manager** (since 2026-10-08 — see *Credentials
are Secret Manager references* below). Install a new value as a new version,
piped in so it never sits in shell history or a transcript, then roll a
revision so instances re-read `latest` (env-var secrets resolve at instance
start; until a new revision, old instances keep the old value):

```bash
# paste the value, then Ctrl-D (Ctrl-Z Enter on Windows) — no trailing newline
gcloud secrets versions add KEY_NAME --data-file=- --project iqraa-auth-507315
gcloud run services update iqraa-api --region europe-west1 \
  --project iqraa-auth-507315 --update-labels rotated=$(date +%Y%m%d)
```

Revoking the old credential at the provider is still the last step. Afterwards
`gcloud secrets versions disable KEY_NAME --version <old>` so it can't be read
back either.

Non-secret config (model names, budgets, flags, bucket names) is still plain
env: change it with `--update-env-vars KEY=VALUE`, never `--set-env-vars` —
the latter replaces the whole environment.

**The database pool** is sized by three more plain env vars on `iqraa-api`, read
once at boot (`lib/db/src/poolConfig.ts`; a value that is not a whole number in
range falls back to the default rather than reaching `pg`, where `0` would mean
"unlimited" and "wait forever"):

| Var | Default | Meaning |
| --- | --- | --- |
| `DB_POOL_MAX` | 10 | connections per instance, 1–100 |
| `DB_SYSTEM_POOL_MAX` | `DB_POOL_MAX` | the second (owner) pool that exists only with `RLS_ENFORCE=on` |
| `DB_CONNECT_TIMEOUT_MS` | 10000 | how long a query waits for a free connection, 1000–60000 |

Neon sees `DB_POOL_MAX × max instances` connections (× 2 with RLS on). A **direct**
connection is capped by the compute's `max_connections` (104 at 0.25 CU, 97 usable); Neon's
**pooler** (`-pooler` in the host) accepts 10,000 client connections in transaction mode, which this
code is designed for (the row-level-security `SET LOCAL` path has not been run through it). `GET /api/healthz/pool` reports `pooled: true|false` for the running
`DATABASE_URL` (a yes/no only, never the host). Neon's plan and compute settings, and why, are in
the log entry «Neon leaves the Free plan before launch». Read the
service's `maxScale` and Neon's limit before raising it — `--max-instances` is
not pinned in `deploy.yml`, so the console value is the one in force. A query
that waits past `DB_CONNECT_TIMEOUT_MS` fails: the auth middleware and the
error handler answer **503 `db_busy` with `Retry-After`** (a 401 would make every
client refresh and retry into the same starved pool), and most routes, which
catch their own errors, answer their usual 500. Either way it logs `timeout
exceeded when trying to connect`. `GET /api/healthz/pool` (header
`x-admin-key: $ADMIN_DEBUG_KEY`) reports `total`, `idle` and `waiting` for the
instance that answers; `waiting` above zero under load means the pool is the
bottleneck.

**Password hashing** runs in a worker thread (`lib/passwordHash.ts`) so a sign-up
rush cannot stall the instance. Plain env vars again: `PASSWORD_HASH_WORKERS`
(1–4, default 1 — match the service's vCPU; `deploy.yml` sets `--cpu 2` with
`PASSWORD_HASH_WORKERS=2` for `iqraa-api`, so change them together) and `PASSWORD_HASH_MAX_PENDING`
(default 40: sign-in/sign-up requests in flight before the rest get `503
hashing_busy`). After a deploy, `GET /api/healthz/pool` must show
`hashing.degraded: false`; `true` means the worker file did not load and
hashing is back on the main thread.

`BOOK_ITEMS_LIVE` is one such flag on `iqraa-api`: it lets the live model path
add real NCCD maths book questions to an evaluation (at most half the requested
count).
**Off by default** — only the exact string `true` turns it on, it is read per
request (no rebuild; a new revision from `--update-env-vars` is enough), and
`deploy.yml` does not set it. Turn it on only after a person has compared the 25
`computed` served items (`lib/curriculum/src/data/book-items/`) with the printed
books (the 5 `verified` ones were cross-checked against the book's own printed
answers). Its
effect is visible on the paper itself: `generationParams.bookItems` is
`{ enabled, planned, supplied, drawn, ids }` on every live maths evaluation, so an
unset flag reads `enabled: false` rather than looking like a bug. A paper made
with book items tells the model what the book supplies and records
`promptVersion` `exam-gen-7+book` (`exam-gen-6+book` before 2026-10-15), so usage rows with and without the flag stay
comparable. Then generate one
maths evaluation and check it; see "Real book items on the live model path" in
`STATUS.md`.

**Check that the new revision actually took traffic.** This file used to say
traffic is `latestRevision: true` so it happens by itself. That is the normal
state, not a guarantee, and when it is not true nothing tells you: a
`gcloud run services update` reports `Done.` and creates a revision that serves
nobody, with the old one still answering every request.

```bash
gcloud run services describe iqraa-api --region europe-west1 \
  --project iqraa-auth-507315 --format="value(status.traffic)"
```

Read the whole `traffic` block, not just the first revision name. You want
`latestRevision: True` with `percent: 100`. A bare `revisionName` and no
`latestRevision` means traffic is **pinned** to that specific revision.

On 2026-09-13 it was pinned to `iqraa-api-00032-279`. Two `--update-env-vars`
calls adding `R2_PUBLIC_BUCKET` and `R2_PUBLIC_BASE_URL` each answered `Done.`
and each ended `is serving 0 percent of traffic` — a line easy to read past.
The variables were set on revisions nothing reached, so the feature that needed
them kept failing while the config looked correct. Unpin with:

```bash
gcloud run services update-traffic iqraa-api --region europe-west1 \
  --project iqraa-auth-507315 --to-latest
```

That `0 percent of traffic` in the output of a deploy or an env-var update is
the tell. It is not noise.

**The pin comes back. Treat `--to-latest` as part of deploying, not as a
repair.** It was cleared on 2026-09-13 and was pinned to `iqraa-api-00032-279`
again by 2026-09-15 — the same revision, which by then was old enough to
predate `/healthz/version` itself. So `curl …/api/healthz/version` answered
`Cannot GET`, and the API read as having gone *backwards* while four healthy
revisions from that morning (`00041` through `00044`) served nobody. Every one
of those deploys had reported `Done.`

What re-establishes it is a deploy that does not take traffic — `--tag`, or
`--no-traffic`. That writes an explicit revision into the traffic block, and an
explicit revision is a pin. The tell on 2026-09-15 was a `candidate` tag left
on `iqraa-api-00042-brg`; the pin it created then swallowed every later deploy
silently. Cleared again at 11:26 UTC that day, with `00044-trh` serving.

So after any deploy, read the traffic block. The two-line habit:

```bash
gcloud run services describe iqraa-api --region europe-west1 \
  --project iqraa-auth-507315 --format="value(status.traffic)"
curl -s https://iqraa-api-613126375862.europe-west1.run.app/api/healthz/version
```

The first must say `latestRevision: True`; the second must report the commit
you deployed. Neither alone is enough — the first can be right while the build
is stale, and the second cannot be read at all when the serving revision is old
enough to lack the route.

**The new revision gets a `candidate` tag, and that is useful.** Rather than
being unreachable, it comes up on its own URL:

```
https://candidate---iqraa-api-lqzcxyoxva-ew.a.run.app
```

So the build can be proved good *before* any production traffic moves:

```bash
curl -s https://candidate---iqraa-api-lqzcxyoxva-ew.a.run.app/api/healthz/version
```

That returns `{commit, revision}`. If the commit is the one you deployed, the
image is fine and only the traffic split is in the way. On 2026-09-15 the
candidate answered `c0a0303` while the production URL answered
`Cannot GET /api/healthz/version` — same service, two different builds, and the
difference was entirely traffic.

**Do not reflexively `--to-latest`.** Read the pin as possibly deliberate until
you know otherwise: a revision can be held precisely because something newer is
broken, and unpinning then ships the breakage. Check what changed between the
pinned revision and the candidate before promoting.

**One more trap in the check itself:** `status.traffic` is a *list*. A format
string like `--format="value(status.traffic[0].revisionName)"` reads one entry,
and with a tagged revision present the first entry is not reliably the one
serving. Ask for the whole block — `--format="json(status.traffic)"` — or the
command will confirm something that is not true.

### A health check does not test a secret

`/api/healthz` returns a static `{ status: "ok" }` and touches no credential at
all — not even the database — so every corrupted key passes it. On 2026-09-04 a
hand-transcribed `OPENAI_API_KEY` arrived with a bullet character in it, passed
every health check, and failed only when a teacher generated a worksheet.

So each secret has one cheap request that actually exercises it, and that is the
test — not the health path:

| Secret | What proves it | Breaks if wrong |
| --- | --- | --- |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Send a **chat attachment**, then attach lesson media | `routes/messaging.ts` (chat attachments), `routes/lessonMedia.ts` |
| `R2_PUBLIC_BASE_URL` | Change your profile picture, then open the returned `avatarUrl` in a browser | `POST /auth/users/avatar` — a wrong or unset value means the upload succeeds but the photo never renders |
| `OPENAI_API_KEY` | Generate a worksheet | every generator; the fallback hides it — see the mock-content note in CLAUDE.md |
| `DATABASE_URL` | `POST /api/auth/login` with a **well-formed** wrong password — the `Invalid email or password` answer comes back only after a `users` lookup. An empty body short-circuits on validation and proves nothing | everything |
| `GOOGLE_CLIENT_ID(S)` | Sign in with Google | login only; email+password still works, so this fails quietly |
| `YOUTUBE_API_KEY`, `UNSPLASH_ACCESS_KEY` | Search a video / an image | degrades silently to no results — a missing key is a no-op, not an error |

The R2 row lists two checks on purpose. Chat attachments and lesson media are
separate call sites, both writing through `putObject`, and chat attachments are
the newer path — it did not exist when the R2 keys were last touched.

### R2 specifically

Six variables, and **only two of them rotate**:

```
R2_ACCESS_KEY_ID       rotate
R2_SECRET_ACCESS_KEY   rotate
R2_ENDPOINT            leave alone
R2_BUCKET              leave alone
R2_PUBLIC_BUCKET       leave alone
R2_PUBLIC_BASE_URL     leave alone
```

Create the token in Cloudflare → R2 → Manage API Tokens, scoped to the
**`iqraa-media` and `iqraa-public` buckets only** with Object Read & Write. A
token with account-wide scope is the thing you are trying not to have.

**A bucket the server starts writing to needs adding to that token first, and
the failure looks like a code bug.** The scope is per-bucket, so a token that
was fine yesterday refuses a write to a bucket nobody had written to before.
Until 2026-09-15 the live `iqraa-api prod` token was scoped to `iqraa-media`
alone — correct for years, because `iqraa-public` only ever received book PDFs
uploaded by hand through the dashboard. The first profile picture made the
server its first programmatic writer, and every upload came back
`Failed to update profile picture`: a 500 whose cause was a Cloudflare
`403 AccessDenied` on `PutObject`, three layers down. Nothing in the app said
"permissions".

So when a feature writes to a new bucket, open the token and add it before
blaming the code. The error only exists in the API's own logs:

```bash
gcloud logging read 'resource.labels.service_name="iqraa-api" AND severity>=ERROR' \
  --project iqraa-auth-507315 --limit 5 --freshness=1d
```

Grab the `trace` from the failing request's log line and read that trace back
to get the application log beside it — the request log carries the status, the
stdout log carries the exception, and they are separate streams. Editing a
token's bucket scope keeps the same Access Key ID and secret, so no Cloud Run
change and no redeploy follow.
`R2_PUBLIC_BASE_URL` is `iqraa-public`'s own `https://pub-<hash>.r2.dev`
Public Development URL, not something the token grants — see
`docs/adding-a-book.md`'s "The two buckets" for why a profile picture (and
nothing else server-written today) belongs in the public one, not
`iqraa-media`.

### Credentials are Secret Manager references

Until 2026-10-08 every secret sat in the Cloud Run revision spec as a plain
env var, so anything that printed the service description printed the secrets
— it happened on 2026-09-06, 2026-09-19 and 2026-09-21, each a full rotation
trigger. Since revision `iqraa-api-00283-twr` these ten are
`valueFrom.secretKeyRef` → a secret of the same name, version `latest`:

```
SESSION_SECRET  DATABASE_URL  OPENAI_API_KEY  R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY  UNSPLASH_ACCESS_KEY  YOUTUBE_API_KEY
ADMIN_DEBUG_KEY  RESEND_API_KEY  SITE_INGEST_KEY
```

A describe of the service or a new revision now shows the reference, not the
value. The runtime account (`613126375862-compute@…`) holds
`secretmanager.secretAccessor` on each secret individually; `deploy.yml`'s
`--update-env-vars` deploys keep the references untouched (proved by run
37806853432). A **new** credential needs the same three steps: `gcloud secrets
create NAME --data-file=-`, `gcloud secrets add-iam-policy-binding NAME
--member=serviceAccount:613126375862-compute@developer.gserviceaccount.com
--role=roles/secretmanager.secretAccessor`, then `gcloud run services update
iqraa-api --update-secrets=NAME=NAME:latest`. A new `EXPO_PUBLIC_*` is not a
secret — it ships in the bundle.

**Old revisions still hold the plain values.** `iqraa-api-00282-9vd` and
earlier carry them in their spec, so `gcloud run revisions describe` on one of
them still prints secrets. Ask for names only, as before:

```bash
gcloud run services describe iqraa-api --region europe-west1 \
  --project iqraa-auth-507315 \
  --format="value(spec.template.spec.containers[0].env[].name)"
```

Rotating a credential retires its old value from those revisions too, which is
the real fix. `gcloud secrets versions access` prints the value by design — it
is the one command that should, so never run it into a transcript.

### The homework reminder (Cloud Scheduler) — manual, once

`POST /api/internal/homework-reminders` sends the day-before homework reminder
(spec Part 4). It answers **404 to everyone until `INTERNAL_CRON_KEY` is on the
service** — so after a merge it is deployed but inert. Nothing in `deploy.yml`
refers to the secret, on purpose: a `--update-secrets` ref to a secret that does
not exist yet fails every Cloud Run deploy. Attach it by hand; `deploy.yml`'s
`--update-env-vars` keeps it from then on, like the other ten.

**The key value must never be echoed, printed or pasted into a transcript** —
which is why this recipe generates it into a shell variable and never reads it
back from Secret Manager (`gcloud secrets versions access` prints it; see the
warning above). Run steps 1–5 in **one shell session**, so `$KEY` is still set
when steps 4 and 5 need it. If the session is lost before step 5, do not read
the secret back: rotate (see the end of this section).

```bash
P=--project=iqraa-auth-507315   # one word, so it also works unquoted in zsh
URL=https://iqraa-api-613126375862.europe-west1.run.app/api/internal/homework-reminders
# 1. The secret: a long random value, kept in $KEY (never echo it), no trailing newline.
KEY=$(openssl rand -hex 32)
printf %s "$KEY" | gcloud secrets create INTERNAL_CRON_KEY --data-file=- $P
# 2. Let the API's runtime account read it.
gcloud secrets add-iam-policy-binding INTERNAL_CRON_KEY $P \
  --member=serviceAccount:613126375862-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
# 3. Put it on the service (rolls a new revision).
gcloud run services update iqraa-api --region europe-west1 $P \
  --update-secrets=INTERNAL_CRON_KEY=INTERNAL_CRON_KEY:latest
# 4. Check by hand — this SENDS real pushes and CLAIMS tomorrow's homework for the reminder, so the
#    scheduled run later today sends nothing for the same homework. {"homework":N,"pushed":M}; 404 = step 3 missing.
curl -sS -X POST -H "x-internal-key: $KEY" "$URL"
# 5. The daily job: 16:00 Amman. (`gcloud services enable cloudscheduler.googleapis.com $P` first if asked.)
gcloud scheduler jobs create http homework-reminders $P \
  --location europe-west1 \
  --schedule "0 16 * * *" --time-zone "Asia/Amman" \
  --uri "$URL" \
  --http-method POST \
  --headers "x-internal-key=$KEY,Content-Type=application/json" \
  --message-body '{}' \
  --attempt-deadline 300s \
  --max-retry-attempts 3 --min-backoff 60s \
  --format=none   # without this gcloud prints the job, x-internal-key included
# 6. Fire it once now, and see that it ran (a second run the same day claims nothing).
gcloud scheduler jobs run homework-reminders --location europe-west1 $P
gcloud scheduler jobs describe homework-reminders --location europe-west1 $P \
  --format='value(lastAttemptTime,status)'
gcloud logging read 'resource.labels.service_name="iqraa-api" AND jsonPayload.message="homework reminders run"' \
  $P --limit 5 --freshness 1d
unset KEY   # when done
```

The job stores the key in its own config, readable by anyone with
`cloudscheduler.jobs.get`. **Rotate both together**, never by reading the old
value back:

```bash
P=--project=iqraa-auth-507315   # set these again in a fresh shell
URL=https://iqraa-api-613126375862.europe-west1.run.app/api/internal/homework-reminders
KEY=$(openssl rand -hex 32)
printf %s "$KEY" | gcloud secrets versions add INTERNAL_CRON_KEY --data-file=- $P
gcloud run services update iqraa-api --region europe-west1 $P \
  --update-secrets=INTERNAL_CRON_KEY=INTERNAL_CRON_KEY:latest --update-labels rotated=$(date +%Y%m%d)
gcloud scheduler jobs update http homework-reminders --location europe-west1 $P \
  --update-headers "x-internal-key=$KEY,Content-Type=application/json" \
  --format=none   # without this gcloud prints the job, x-internal-key included
# If the submission sweep job exists, run its `jobs update http` line (next section) here, while
# $KEY is still set (so before the unset below) and before the old versions are disabled.
unset KEY
# The service now reads the new version; disable the old one(s) so a leaked key is dead.
gcloud secrets versions list INTERNAL_CRON_KEY $P --filter=state=enabled \
  --sort-by=~createTime --format='value(name.basename())' | tail -n +2 \
  | xargs -r -n1 gcloud secrets versions disable --secret=INTERNAL_CRON_KEY $P
```

**Any `gcloud scheduler jobs create|update|describe` without `--format`
prints the stored key** (the 2026-10-16 setup leaked it that way and had to
rotate). Keep `--format=none` on writes and a `value(...)` format that omits
`httpTarget` on reads.

This rotation is also the way out if the shell session was lost before step 5 —
but if the scheduler job does not exist yet, run step 5 (with the new `$KEY`)
instead of the last `update` command.

A rerun the same day is safe: each homework is reminded at most once per due day
(`homework_reminders`, claimed before sending), and a send that fails after its
claim is not retried. One failing homework does not stop the run. The job retries
up to three times (`--max-retry-attempts 3`), which is safe because of those
claims: a retry after a failed or timed-out run reminds only the homework not yet
claimed and repeats none. The run is sequential, so a very large school could
outlast the job's 300 s attempt deadline; do not rely on the handler carrying on
after its request ends (Cloud Run throttles CPU then) — rely on the retry.

### The submission sweep (Cloud Scheduler) — manual, once

`POST /api/internal/homework-submission-sweep` cleans up the photos students hand
in with a homework project (private bucket, `homework-submissions/`). It does two
things, in this order:

1. **Retries the purge** for archived homework and for homework in an archived
   class that still has submission rows (a purge that threw, or an upload that
   raced one). Rows and photos both go.
2. **Deletes objects no `homework_submissions` row refers to**: a photo stored
   by an upload whose database write then failed, or left behind by an object
   delete that failed.

**It is irreversible: it deletes objects that are a minor's work, and nothing in
the repo can bring them back.** The code only ever errs toward keeping (see the
limits below), but treat the first run as the dangerous one.

It reuses **`INTERNAL_CRON_KEY`** and the same guard as the reminder: no new
secret, nothing to add to `deploy.yml`, and **404 to everyone until the key is on
the service** — so if the reminder section above is done, this route is already
live and inert until a caller sends the key. The key value must never be echoed,
printed or pasted into a transcript; run the commands below in **one shell
session** with `$KEY` still set, exactly as the reminder recipe says. If you no
longer have it, rotate (end of the reminder section) rather than read it back.

**The query string decides whether it deletes.** Read it before any manual call:

| Request | Result |
| --- | --- |
| no `dryRun` key at all | **real run (deletes)** — this is what the scheduled job sends |
| `?dryRun=0` or `?dryRun=false` | **real run (deletes)** |
| `dryRun` in any other form: `?dryRun`, `?dryRun=` (empty), `1`, `true`, `TRUE`, `yes`, a repeated key | dry run: reports, changes nothing |
| any other parameter (`dryrun`, `dry-run`, `limit`, …) | `400 {"error":"Unknown query parameter"}`, nothing done |

So the scheduler URI must have **no query string** (or `?dryRun=0`), and every
manual look uses `?dryRun=1`. A typo in the safety flag is a 400, never a real
run. The grace period and the per-run cap are constants in the code; a request
cannot change them.

**First run, in this order — do not create the job first:**

```bash
P=--project=iqraa-auth-507315   # one word, so it also works unquoted in zsh
URL=https://iqraa-api-613126375862.europe-west1.run.app/api/internal/homework-submission-sweep
# $KEY must be set in this shell (see above). 404 = the key is not on the service yet.
# 1. A DRY run by hand. Deletes nothing. Read the JSON.
curl -sS -X POST -H "x-internal-key: $KEY" "$URL?dryRun=1"
```

The answer is the run report itself (the same object that is logged), not wrapped
in another key. The fields: `dryRun`, `archivedHomework`, `purgeFailed`,
`rowsPurged` (phase 1); `objectsListed`, `referenced`, `orphanObjects`,
`skippedYoung`, `skippedBadKey`, `capped`, `deleted`, `listTruncated`,
`objectsSkipped` (phase 2); `sample` (up to 20 keys of what was, or in a dry run
would be, deleted). Compare `orphanObjects` with what you expect — on a young
feature, close to none. A large number is a reason to stop and look at `sample`,
not to carry on. `objectsSkipped: true` means R2 is not configured on that server
and phase 2 did not run at all.

A dry run **does not do phase 1**: it counts the rows of archived homework
(`archivedHomework`, `rowsPurged`) but removes none, so their rows still exist
and their photos count as `referenced`, not as orphans. The real run purges those
rows first and then sees their photos as orphans. So a dry run's phase-2 numbers
are a lower bound, and can be larger after the real run by the photos of the
`archivedHomework` it lists.

```bash
# 2. Once for real, by hand, when the dry run's numbers make sense. This DELETES.
curl -sS -X POST -H "x-internal-key: $KEY" "$URL"
# 3. The weekly job: Sunday 03:00 Amman. The URI carries no query string. One retry at most:
#    a sweep that half-ran is safe to run again, and a retry would only repeat the work.
gcloud scheduler jobs create http homework-submission-sweep $P \
  --location europe-west1 \
  --schedule "0 3 * * 0" --time-zone "Asia/Amman" \
  --uri "$URL" \
  --http-method POST \
  --headers "x-internal-key=$KEY,Content-Type=application/json" \
  --message-body '{}' \
  --attempt-deadline 300s \
  --max-retry-attempts 1 --min-backoff 60s \
  --format=none   # without this gcloud prints the job, x-internal-key included
# 4. Fire it once and see that it ran.
gcloud scheduler jobs run homework-submission-sweep --location europe-west1 $P
gcloud scheduler jobs describe homework-submission-sweep --location europe-west1 $P \
  --format='value(lastAttemptTime,status)'
gcloud logging read 'resource.labels.service_name="iqraa-api" AND jsonPayload.message="homework submission sweep run"' \
  $P --limit 5 --freshness 1d
unset KEY   # when done
```

**The key lives in this job's config too, so rotating `INTERNAL_CRON_KEY` means
updating this job's header as well** as the reminder job's, in the same session
as the rotation, before the old secret versions are disabled. With `$KEY`
holding the new value, as in the reminder's rotation block:

```bash
gcloud scheduler jobs update http homework-submission-sweep --location europe-west1 $P \
  --update-headers "x-internal-key=$KEY,Content-Type=application/json" \
  --format=none   # without this gcloud prints the job, x-internal-key included
```

A job left on the old key gets a 404 from then on and the sweep silently stops
running: after a rotation, check `lastAttemptTime`, `status` and the log line. The
warning above that `gcloud scheduler jobs create|update|describe` prints the
stored key applies to this job just as much: keep `--format=none` on every write
and a `value(...)` format that omits `httpTarget` on reads.

**Limits, all in code** (`modules/homework/submissionSweep.ts`,
`lib/homeworkSubmissionSweep.ts`):

- **24 hours of grace.** An object younger than that is never deleted, whether or
  not a row refers to it (an upload stores the object a moment before it records
  the row). A `lastModified` in the future counts as young. `skippedYoung` counts them.
- **At most 1000 deletes per run**, oldest first. `capped` is how many more were
  left for the next run. A bucket with a backlog is emptied over several weekly
  runs; run it by hand again to hurry that along.
- **At most 200,000 objects listed per run.** Past that, `listTruncated: true`:
  the run only swept the first 200,000 keys in key order, and every run will see
  the same ones, so an orphan sorting after the cut-off is never found. The code
  logs it at warn level; it needs a person (a bigger cap, or a listing that
  continues where the last one stopped), not another rerun.
- **Only a key of exactly this shape is ever deleted:**
  `homework-submissions/<uuid>/<uuid>/<uuid>.(jpg|png|webp)`, prefix and extension
  in lower case, the hex of the ids in either case. Anything else under the prefix
  is counted in `skippedBadKey` and left for a person to look at.
- **An object a row refers to is kept, however old**, drafts included.
- The order inside the run is deliberate (list the bucket first, read the rows
  second), so a photo uploaded while the sweep runs cannot be mistaken for an
  orphan. Do not "optimise" it.

**What to watch.** One log line per run, `homework submission sweep run`, whose
payload is the whole report above. Each deleted object also has its own line,
`homework submission sweep: deleted an orphan object`, with its `key`,
`lastModified` and `homeworkId` (the bucket keeps no history, so that line is the
only record of what went). Things worth a look when they repeat:

- `purgeFailed > 0`: a purge of an archived homework threw (logged at error level
  as `could not purge an archived homework`, with its id). Its rows are kept, so
  its photos are safe; it is retried next run. Week after week means a bad row.
- `listTruncated: true`: see the limits.
- `capped > 0` week after week: orphans arrive faster than 1000 a week. Find out why.
- A real run where `orphanObjects − capped − deleted` is above zero: some object
  deletes failed (`could not delete an orphan object`, at error level, with the key).
- A first-ever run, or a sudden jump in `orphanObjects`: something is failing
  between storing a photo and recording it.

**Cloud Run throttles CPU once a response is sent**, so the route does all its
work before answering, as the reminders do; nothing carries on afterwards. The job's
`--attempt-deadline` must therefore cover a full run (a 200,000-key listing plus
1000 deletes), and the service's own request limit is `--timeout 300` in
`deploy.yml`, so **300 s is the real ceiling**: a longer attempt deadline on the
job does not buy more time. The run's duration has not been measured against the
real bucket; read it off the first manual runs. A run cut off by the timeout is
safe to start again.

### Claude for documents (`ANTHROPIC_API_KEY`) — manual, once

Lesson plans, worksheets, quizzes and slide decks can be written by Claude Sonnet 5.5
instead of the OpenAI model. The code ships **dormant**: nothing changes until
`AI_MODEL_DOCUMENTS` is set, and a Claude id with no `ANTHROPIC_API_KEY` is ignored
(the OpenAI model keeps running, one warning in the log). As with the cron key,
`deploy.yml` does not mention the secret: a `--update-secrets` ref to a secret that
does not exist yet fails every deploy. Attach it by hand.

Chat, evaluations (exam generation), grading, the verified-derivative path,
homework, activities, infographics and the lesson-teaching deck stay on OpenAI:
they were not part of the comparison, and several of them call the OpenAI client
directly. That is why this is `AI_MODEL_DOCUMENTS` and not `AI_MODEL_GENERATE`.

**The key value must never be echoed or pasted into a transcript.** Use a *new*
key from console.anthropic.com (never one that has appeared in a log, a chat or a
terminal). `read -rs` takes it without showing it:

```bash
P=--project=iqraa-auth-507315
# 1. Paste the key (nothing is shown), then Enter.
read -rs KEY
printf %s "$KEY" | gcloud secrets create ANTHROPIC_API_KEY --data-file=- $P
unset KEY
# 2. Let the API's runtime account read it.
gcloud secrets add-iam-policy-binding ANTHROPIC_API_KEY $P \
  --member=serviceAccount:613126375862-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
# 3. Put it on the service (rolls a revision; still no change in behaviour).
gcloud run services update iqraa-api --region europe-west1 $P \
  --update-secrets=ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest
# 4. Switch it on. Plain env, so it deploys and rolls back without a secret.
gcloud run services update iqraa-api --region europe-west1 $P \
  --update-env-vars=AI_MODEL_DOCUMENTS=claude-sonnet-5-5
```

**Order matters: ship the app's 90 s wait before step 4.** A merge deploys the web build
at once, but phones keep the old 45 s limit until the production OTA
(`gh workflow run mobile-update.yml -f branch=production`). A deck takes 30-40 s on
Claude, so switching first would time it out on a phone that has not updated yet.

**Roll back** with `--remove-env-vars=AI_MODEL_DOCUMENTS`: instant, no deploy. Pooled
artifacts are keyed by model, so what OpenAI wrote and what Claude writes never mix.

What to expect, from the 2026-10-23 comparison: a document takes **15–30 s** (7 s on
the OpenAI model) and costs about **$0.04** (about $0.009), so the per-user cap
`AI_USER_BUDGET_USD=1` is roughly 25 documents instead of 115 — decide whether to
raise it. Check the first day's spend in the Anthropic console against the figure the
API logs ("ai spend updated"): the price table in `aiBudget.ts` is the model table's
$2 / $10 per million tokens and has not been checked against a bill. `AI_CLAUDE_EFFORT`
(`low`/`medium`/`high`, default `medium`, what was measured) trades speed and cost for
depth. A refusal by the model answers 502 `model_declined` with the category in the log;
the server-side refusal fallback is **not** enabled (it could not be tried without a live
key), so a teacher who hits one sees the usual generation error and can try again.

### Growth numbers that fill themselves (Facebook, Instagram, Play) — manual, once

The admin dashboard's «التنزيلات والمتابعون» cards can fill in their own number: the first time an
admin opens the dashboard each day, `GET /admin/metrics` fetches each figure that has its settings
and stores it as that day's entry. YouTube already works this way (`YOUTUBE_API_KEY`). The code
(`lib/autoMetrics.ts`) ships **dormant**: a figure with no settings is skipped, so deploying it
changes nothing. A number an admin typed for the day is kept, and a figure that came back empty is
not retried for 30 minutes. LinkedIn and X stay typed in by hand (LinkedIn needs an approved partner
app; X now bills per read).

| Figure | Settings | Secret? |
| --- | --- | --- |
| Facebook followers | `META_ACCESS_TOKEN` + `META_PAGE_ID` | the token |
| Instagram followers | `META_ACCESS_TOKEN` + `META_IG_USER_ID` | the token |
| Play downloads | `PLAY_STATS_BUCKET` (`PLAY_PACKAGE_NAME` only if the package ever changes) | none — no key |

This was written from Meta's and Google's documentation and tested against stand-ins for both; it has
**not** been run against the real accounts. The first dashboard open after setup is that test.

**Facebook and Instagram.** Both read from one Meta token.

1. The Instagram account must be a *Professional* account (Business or Creator) connected to the
   Facebook Page. Followers are not readable for a personal account.
2. developers.facebook.com → create an app (type *Business*) under the same business portfolio as the
   Page.
3. business.facebook.com → Business settings → Users → **System users** → add one → *Add assets*: the
   Page and the Instagram account → *Generate new token* for the app, with `pages_show_list`,
   `pages_read_engagement` and `instagram_basic`. Choose *never expires* if the form offers it; with
   60 days only, the cards go stale and need a new token (rotation below).
4. The Page id is on the Page (*About → Page transparency*). The Instagram user id comes from
   `GET /<page-id>?fields=instagram_business_account` in the Graph API Explorer with that token.

Do the secret in **Git Bash**, like the recipes above. The token is never typed into a chat or
echoed: `read -rs` takes it without showing it.

```bash
P=--project=iqraa-auth-507315
# 1. Paste the token (nothing is shown), then Enter.
read -rs KEY
printf %s "$KEY" | gcloud secrets create META_ACCESS_TOKEN --data-file=- $P
unset KEY
# 2. Let the API's runtime account read it.
gcloud secrets add-iam-policy-binding META_ACCESS_TOKEN $P \
  --member=serviceAccount:613126375862-compute@developer.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
# 3. Put it on the service, and switch both figures on (the ids are not secret).
gcloud run services update iqraa-api --region europe-west1 $P \
  --update-secrets=META_ACCESS_TOKEN=META_ACCESS_TOKEN:latest \
  --update-env-vars=META_PAGE_ID=<page id>,META_IG_USER_ID=<instagram user id>
```

**Play downloads.** No key: Play lets any account it has invited read its monthly report bucket, and
the API already runs as one.

1. Play Console → Users and permissions → *Invite new users* →
   `613126375862-compute@developer.gserviceaccount.com` (the account the API runs as), with the
   permission *View app information and download bulk reports (read-only)*.
2. Play Console → *Download reports* → *Statistics* → *Copy Cloud Storage URI*. The bucket id is the
   `pubsite_prod_rev_…` part, without `gs://` or anything after it.
3. Switch it on (the bucket id is not secret):

```bash
gcloud run services update iqraa-api --region europe-west1 $P \
  --update-env-vars=PLAY_STATS_BUCKET=pubsite_prod_rev_<digits>
```

Play writes these reports 3–7 days late, so the figure trails. It is the sum of the *Daily User
Installs* column over the monthly `installs_<package>_YYYYMM_overview.csv` files, not the console's
headline total, and it includes installs from before the app was public. If the console disagrees,
the console is right.

**Check it** by opening the dashboard once. A card that stays *not recorded* has a reason in the log,
named by figure (never the error or the URL, either of which can quote a token):

```bash
gcloud logging read 'resource.labels.service_name="iqraa-api" AND jsonPayload.message:"growth metric auto-fill"' \
  $P --limit 10 --freshness 1d
```

`returned no number` for a figure with a good key usually means a permission: the Meta token lacks
the Page or Instagram asset, or `followers_count` needs the Page's own token rather than the system
user's (then the API should exchange it for one: say so and it will be added), or Play has not
accepted the invitation or has written no report yet. An expired Meta token looks the same, and a
card whose *last entry* date has stopped moving is the other tell.

**Roll back or rotate** with no deploy. `--remove-env-vars=META_PAGE_ID,META_IG_USER_ID` (or
`PLAY_STATS_BUCKET`) turns a figure off. A new token is:

```bash
read -rs KEY
printf %s "$KEY" | gcloud secrets versions add META_ACCESS_TOKEN --data-file=- $P
unset KEY
gcloud run services update iqraa-api --region europe-west1 $P \
  --update-secrets=META_ACCESS_TOKEN=META_ACCESS_TOKEN:latest --update-labels rotated=$(date +%Y%m%d)
```

## The Android app (Google Play)

**Nothing publishes the Android app automatically, on any path.** Both build
paths are `workflow_dispatch`-only:

- `.github/workflows/mobile-build.yml` — EAS Build. Free but capped by
  Expo's monthly quota (ran out on its first use; see STATUS.md).
- `.github/workflows/mobile-build-gradle.yml` — `expo prebuild` +
  `./gradlew bundleRelease assembleRelease` directly on the Actions runner,
  no EAS Build involved, no quota. Needs the four keystore secrets in
  `docs/android-gradle-build-secrets.md` (one-time setup) before it will do
  anything.

Either way you get an APK and an AAB as downloadable run artifacts, not a
store listing — getting from there into Google Play is a separate, manual
process:

1. **Finish the Play Console developer account** (Account → verify phone
   number, identity) if not already done — a one-time gate before anything
   else here works.
2. **Create the app listing** (Play Console → *Create app*) if this is the
   first release.
3. **Upload the `.aab`, not the `.apk`.** Google has required an Android App
   Bundle for a new app's production/testing tracks since 2021; a raw APK
   only works for sideloading or Internal App Sharing links, not a Console
   release track. Start with **Internal testing** (Release → Testing →
   Internal testing → *Create release*) — instant, no review wait, the right
   place to confirm Google Sign-In still works against this exact signing
   certificate before testing more widely.
4. On the first upload, accept **Play App Signing** — Google re-signs the
   app for distribution while trusting the upload key this workflow already
   signs with, so nothing about the OAuth client (bound to the signing
   certificate — see STATUS.md's 2026-09-07 entry) changes.
5. Fill in the store listing, content rating, target audience, and **Data
   safety** form (Policy → App content) — answer Data safety against what
   the app actually sends (Google Sign-In account info, PostHog analytics),
   not against intent; it's checked against real behavior.
6. Move Internal → Closed → Production testing tracks the same way, then
   submit for review.

## Schema

**The schema deploys itself, as migrations.** Change `lib/db/src/schema`, then:

```bash
pnpm --filter @workspace/db run generate      # writes lib/db/migrations/NNNN_*.sql
```

and commit the generated SQL with the PR — it is part of the review. On merge,
`deploy.yml`'s `production migrations` job applies anything new to production
in one transaction, then `production schema` (`schema-check.yml`) confirms
every table, column and unique exists, and only then does the API deploy. A
failed migration rolls back whole, the API and web jobs are skipped, and the
old revision keeps serving.

CI checks every PR three ways — the first two in `migrations match schema`
(`ci.yml`), the third in `destructive-migration-ack.yml`:

- **A schema edit without its migration fails.** `generate` runs and must
  produce nothing new.
- **Every migration applies to an empty Postgres**, followed by `verify-schema`.
- **Destructive SQL needs an explicit yes.** Migrations run *before* the new
  API revision takes traffic, so the old code serves against the new schema
  for a few minutes. Adding a table or nullable column is safe; `DROP`,
  `RENAME`, `SET NOT NULL` and type changes break the running revision. Ship
  the code that stops using the old shape first, then the destructive
  migration in a later PR whose body has a line `destructive-migration: ok`.
  That line is matched literally at the start of a line. Editing the body
  re-runs this check on its own (it listens for `edited`), so adding the line
  clears it without a new commit — the reason it is a separate workflow.

`push` (`pnpm --filter @workspace/db run push`) is still there for a scratch
local database. Never point it at production: drizzle-kit resolves drift by
dropping columns, which is why production never auto-deployed before
migrations existed. Since migration 0008 it is also unsafe for any database that
has it applied: drizzle-kit 0.31 tracks RLS and policies, and the schema files
declare none, so `push` will try to `DISABLE ROW LEVEL SECURITY` and `DROP POLICY`
on whatever it is pointed at. Never run it against one with 0008 applied (already
forbidden for production).

### Baseline (once per database that predates migrations)

`0000_baseline.sql` is the whole schema as of 2026-10-08. Production already
had those tables from `push`, so it must record 0000 as applied without
running it. `migrate` refuses a database that has tables but no migration
history rather than guessing.

**Production was baselined on 2026-10-08** (Actions run 37803469909: 48/48
tables verified, 0000 recorded, 0 new), by a one-time `db-baseline.yml`
workflow that was then deleted — it kept the URL inside the repository secret.
Any other database:

```bash
pnpm --filter @workspace/db run verify-schema   # must report every table/column present
pnpm --filter @workspace/db run migrate -- --baseline
```

It is idempotent: a second run reports the history already exists. A local
database created with `push` needs the same one-time baseline; a new one
needs only `migrate`.

What `verify-schema` cannot prove before baselining: column types,
nullability, defaults, and non-unique indexes and foreign keys. If production
drifted on one of those, a later migration touching it can fail — in CI it
will pass (the empty database matches), at deploy it rolls back and names the
statement. Fix production to match by hand, then re-run the deploy.

## Row-level security

Postgres enforces who may read a row on the tables that hold students, rosters,
parent contact history, chat, exams and attempts (spec:
`docs/superpowers/specs/2026-10-13-row-level-security-design.md`). It is a second line
of defence behind the API's own checks, and it is **off until you turn it on**.

**Merging this ships the migration.** `deploy.yml` migrates production before the API takes
traffic, so the merge creates the `iqraa_app` role and enables row-level security on 28 tables.
It is dormant for the owner role (there is no `FORCE`), so nothing changes *provided the role in
Cloud Run's `DATABASE_URL` owns those tables*; a non-owner role would have no policy and be denied.
**Before merging**, connect to a Neon branch of production with the *exact* `DATABASE_URL` Cloud Run
uses (same role and credentials, only the host pointed at the branch; a branch made in the Neon console may
default to a different owner role, which would make the check pass without testing the API's role).
Then `select current_user` must equal `tableowner` for **every** row of
`select tablename, tableowner from pg_tables where schemaname='public'`; any other result means do not merge.

**Both connection strings must name the same owner role.** The migration runs under GitHub's
`secrets.DATABASE_URL` (`deploy.yml`, the `production migrations` job); the API runs under Cloud
Run's `DATABASE_URL`. The migration's `SECURITY DEFINER` helpers are owned by the *migrating*
role, and they bypass RLS only if that role also owns the tables they read. If the two secrets
name different roles, either the API's connection is not the table owner (so it is denied, with
no policy of its own) or the helpers run subject to the policies and return fewer rows than they
should — the second looks like rows quietly missing, not an error. The
migration also sets `lock_timeout = '5s'`: it takes `ACCESS EXCLUSIVE` locks on 28 tables while the
old revision still serves, so a long-running query makes the deploy stop (retry it) rather than
queueing every request behind it.

**Do not re-run 0008 by hand outside the migrator.** It is not idempotent: `CREATE POLICY` has no
`IF NOT EXISTS`, and `GRANT iqraa_app TO CURRENT_USER` needs `ADMIN OPTION` on the role if it
already exists under another creator. A second run stops at the first `CREATE POLICY`
(already exists); recover a damaged database from a Neon branch, not by editing the history table.

**The switch** is one Cloud Run env var, read once at boot:

```bash
# on
gcloud run services update iqraa-api --region europe-west1 \
  --project iqraa-auth-507315 --update-env-vars RLS_ENFORCE=on
# off — the whole rollback
gcloud run services update iqraa-api --region europe-west1 \
  --project iqraa-auth-507315 --update-env-vars RLS_ENFORCE=off
```

`--update-env-vars`, never `--set-env-vars` (see *Rotating a secret*). Changing it rolls
a revision; it is not a code deploy. With it off nothing about the API changes — one
pool, no extra statements. With it on every `db` statement runs as the `iqraa_app` role
with the signed-in user's id, and `systemDb` (the owner connection) is used by the
fourteen files pinned in `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts`.

**Before the first flip**, on a Neon *branch* of production (never production):
run the migration, run `RLS_TEST_DATABASE_URL=<branch> pnpm --filter @workspace/db run test`,
walk the teacher / parent / student flows by hand, and **measure the added latency per
statement** — the wrapper costs about two extra round trips each, which is ~0.25 ms on
loopback and unmeasured across the Cloud Run → Neon hop. Also check the database's
connection limit: with enforcement on an instance holds two pools. See the plan's Task 7
(`docs/superpowers/plans/2026-10-13-row-level-security.md`) for the gates.
The same steps as a tick-list: [`docs/rls-rollout-checklist.md`](./rls-rollout-checklist.md).

**What goes wrong, and how it looks.** A query that reads *another user's* rows does not
fail under RLS — it returns fewer rows. So the symptom is rarely a 500; it is a
notification not sent, a block not honoured, a restricted exam that opens to the class.
`lib/db/src/__tests__/rlsDiff.test.ts` is the guard: it boots the built API with
enforcement off and on and diffs statuses, bodies, pushes and rows left behind. After any
route change that touches a protected table, run it (`pnpm --filter @workspace/api-server
run build` first) and add a scenario for what you added.

**Adding a table.** `rlsCoverage.test.ts` fails until the table is classified: *protected*
(add policies in a migration, put the name in `PROTECTED`), *locked* (RLS, no policy, no
grant — only `systemDb` reads it), or *deferred* (named in `DEFERRED` — still open to
`iqraa_app`, with the grant a new migration must add by hand, since there are no default
privileges on purpose). **Adding a `systemDb` use** means editing `systemDbFiles.test.ts`
and writing the reason.

## Point-of-no-return changes go up as drafts

Some changes cannot be undone by reverting the commit — removing a service
block from `render.yaml`, deleting a service in a dashboard, anything whose
rollback needs secrets re-entered by hand. **Open those as draft PRs.** GitHub
refuses to merge a draft, so the constraint holds by itself; mark it ready only
once the condition in the body is actually met.

Writing "do not merge yet" in the body does not work here, and there is a
worked example. PR #251 retired the Render API and verifier from the blueprint.
Its own body opened with *"merging this is the point of no return, so merge it
only once Cloud Run has served real teachers through a few genuine cold
mornings"*. It was opened at 06:00:44Z and merged at 06:00:53Z — **nine
seconds**, self-merged, no reviews. The web build had been pointed at Cloud Run
51 minutes earlier, so not one cold morning had passed, let alone a few.

That is not carelessness on one PR; it is what the workflow does. Across the
twenty merged PRs around it the median time from opening to merge was about
twelve seconds. A sentence in a body has nothing to act on in that window — a
draft does. What it cost: reverting to Render was one line and a web rebuild
before #251, and after it means restoring the blocks from history **and**
re-entering every secret by hand — the same hand re-entry that produced the
bullet-corrupted `OPENAI_API_KEY` the day before.

## When to deploy

Iqraa's users are Jordanian teachers and their classes, so the school week is
**Sunday–Thursday, roughly 07:30–14:00 Amman time (UTC+3, no DST)**. Friday and
Saturday are the weekend.

Most deploys are unremarkable at any hour. Check the class-hours window when a
change alters what a student mid-exam sees — the student exam screen resumes
through `GET /take/attempt/state`, so anything changing that payload lands
under a sitting already in progress.
