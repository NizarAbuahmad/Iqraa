# Deploying

Three services, and **they do not deploy the same way** — which is the reason
this file exists. Merging to `main` ships the web app and nothing else. The API
and the verifier are Cloud Run, deployed by hand, and a merge does not touch
them.

| | Where | How it deploys |
| --- | --- | --- |
| `iqraa-web` | Render (static) | **Automatic** on merge to `main` |
| `iqraa-api` | Cloud Run | **By hand**, command below |
| `iqraa-verifier` | Cloud Run | **By hand**, command below |
| Database | Neon | Never automatic — see *Schema* below |

Cloud Run project `iqraa-auth-507315`, region `europe-west1` (nearest Google
region to Neon in Frankfurt). Only `iqraa-web` is left in `render.yaml`; the
Render API and verifier were retired from the blueprint on 2026-09-05.

## The web app

Nothing to do. Render auto-deploys `iqraa-web` on merge to `main`, and the
build inlines every `EXPO_PUBLIC_*` value — so changing one of those needs a
**web rebuild**, not just an API redeploy.

To check a change is actually live rather than trusting the dashboard, grep the
served bundle for something the change added or removed:

```bash
curl -s https://iqraa-web.onrender.com/ | grep -oE '/_expo/static/js/web/[A-Za-z0-9._-]+\.js'
```

then `curl` that path and grep it. String literals survive minification, so a
changed array of question types or a new translation key is findable.

## The API and the verifier

Run from a clean checkout of merged `main`, with `gcloud` authenticated against
`iqraa-auth-507315`. Both commands are the ones in the Dockerfile headers —
`Dockerfile` and `artifacts/math-verifier/Dockerfile`, which stay the source of
truth if these ever drift:

```bash
gcloud run deploy iqraa-api --source . --region europe-west1 --allow-unauthenticated --port 8080
```

```bash
gcloud run deploy iqraa-verifier --source artifacts/math-verifier --region europe-west1 --allow-unauthenticated --port 8080
```

The API's build context is the **repo root**, not `artifacts/api-server`: the
build copies a data directory out of `lib/curriculum` and pnpm needs the
workspace manifests. The verifier's context is its own directory.

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

A health check proves the container booted and can reach the database. It does
**not** prove the OpenAI or R2 credentials are right — nothing calls those on a
health path. Generating a worksheet is the cheapest thing that does.

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

## Schema

**Nothing deploys the database schema.** Not the build, not the deploy:

```bash
pnpm --filter @workspace/db run push
```

run by hand against the production `DATABASE_URL`, before or with the deploy.
Deliberately not wired into any build — drizzle-kit resolves drift by dropping
columns, and a deploy is the wrong place to discover that. Skipping it makes
the endpoints using the new table answer 503 "storage is not set up on this
server".

CI enforces the reminder, not the push: a PR touching `lib/db/src/schema` must
say `schema-push: done` or `schema-push: n/a` in its description
(`.github/workflows/ci.yml`), and `schema-check.yml` verifies production
against the schema daily.

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
