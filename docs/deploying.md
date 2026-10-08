# Deploying

Three services, and **the order they deploy in matters** — which is the reason
this file exists. `.github/workflows/deploy.yml` ships all three from `main`:
the API and verifier to Cloud Run first, the web bundle to Cloudflare Pages
after, and it skips the web deploy entirely if either server deploy failed.

| | Where | How it deploys |
| --- | --- | --- |
| `iqraa-api` | Cloud Run | **Automatic** on merge to `main` |
| `iqraa-verifier` | Cloud Run | **Automatic** on merge to `main` |
| `iqraa-web` | Cloudflare Pages (static) | **Automatic**, gated on the two above |
| Database | Neon | Never automatic — see *Schema* below |

**Server before client, on purpose.** A new API behind an old bundle is
harmless: the bundle simply does not call the new route. The reverse is an
outage. That is not hypothetical — on 2026-09-10 a web bundle went live against
an API that lacked the matching route and broke production signups. From the
2026-09-05 Cloud Run cutover until 2026-09-15 the API and verifier were
deployed by hand, which is what made that possible; automating them closed it.

Each surface deploys only when its own paths changed (`lib/**` counts as an API
change, because the API bundles those packages), and each job verifies against
the running system rather than trusting the tool: the API asserts
`/api/healthz/version` reports the deployed short SHA, because `gcloud` has
printed a success line while traffic stayed pinned to an older revision
(2026-09-07).

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
on every merge to `main` and publishes it to Cloudflare Pages, and the build inlines
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
whether a deploy actually happened, because this service is hand-deployed while
web ships on every merge — a stale API looks identical to a current one from
the outside. Omit the flag and the route answers `"unknown"`, which is honest
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

CI (`migrations match schema` in `ci.yml`) checks every PR three ways:

- **A schema edit without its migration fails.** `generate` runs and must
  produce nothing new.
- **Every migration applies to an empty Postgres**, followed by `verify-schema`.
- **Destructive SQL needs an explicit yes.** Migrations run *before* the new
  API revision takes traffic, so the old code serves against the new schema
  for a few minutes. Adding a table or nullable column is safe; `DROP`,
  `RENAME`, `SET NOT NULL` and type changes break the running revision. Ship
  the code that stops using the old shape first, then the destructive
  migration in a later PR whose body has a line `destructive-migration: ok`.
  That line is matched literally at the start of a line, and editing the body
  does not re-run the check — only a new commit does.

`push` (`pnpm --filter @workspace/db run push`) is still there for a scratch
local database. Never point it at production: drizzle-kit resolves drift by
dropping columns, which is why production never auto-deployed before
migrations existed.

### Baseline (once per database that predates migrations)

`0000_baseline.sql` is the whole schema as of 2026-10-08. Production already
had those tables from `push`, so it must record 0000 as applied without
running it. `migrate` refuses a database that has tables but no migration
history, so the first deploy after this change fails safely until this runs.
For production, run it in Actions so the URL stays in the repository secret:

```bash
gh workflow run db-baseline.yml    # verify-schema, then baseline, then migrate
```

then re-run the failed deploy. For any other database:

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
