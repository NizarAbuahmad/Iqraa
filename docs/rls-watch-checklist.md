# Row-level security: the full watch (checklist D3)

`docs/rls-rollout-checklist.md` D3 asks for a 30-minute watch of 5xx, p95 latency, push volume and the logs after
`RLS_ENFORCE=on`. This is that watch, step by step. It only reads: nothing here changes production. It was not
completed on the 2026-10-27 switch-on (see the record row for D in the rollout checklist).

Do it in one sitting, about 30 minutes, with a real phone for the parent side if possible.

**Before you start.** Open Cloud Shell. The prompt must say `(iqraa-auth-507315)`; if it says another project,
switch first. Every command below names `--project iqraa-auth-507315` anyway.

## 1. Minute 0 — hand test (5 min)

1. **Teacher:** open the inbox, open a chat, send a message.
2. **Parent:** the notification arrives within a few seconds. Reply to it.
3. **Teacher:** the reply shows, and that chat moves to the top of the inbox.
4. **Teacher:** open a class, an evaluation and a student list. Each loads with its data, not empty.

## 2. Minute 5 — errors in the logs

Each should print nothing, or only lines you can read as normal.

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="iqraa-api" AND ("permission denied" OR "row-level security")' --project iqraa-auth-507315 --freshness=30m --limit=20 --format='value(timestamp,severity,textPayload,jsonPayload.msg)'
```

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="iqraa-api" AND httpRequest.status>=500' --project iqraa-auth-507315 --freshness=30m --limit=20 --format='value(timestamp,httpRequest.status,httpRequest.requestUrl)'
```

If either prints lines, record them (do not paste a request URL that carries a token) and do not change anything yet.

## 3. Minute 10 — speed

1. Google Cloud console, project `iqraa-auth`: **Cloud Run → iqraa-api → Metrics**.
2. Read **Request latencies (p95)** and **Request count** over 7 days.
3. Find 2026-10-24 about 12:35, when enforcement was first switched on. After that point the p95 line should not sit
   more than about 100 ms above where it was before (the budget the benchmark was held to).
4. A jump is a finding: note the route if the log shows one, and the time.

Routes that are not on the held list (`artifacts/api-server/src/lib/heldReads.ts`) pay about 22 ms per statement; a
few such statements are expected and are not a failure. A hundred or more milliseconds on the whole service is.

## 4. Minute 15 — quiet failures

Row-level security fails quietly: a query that reads another user's rows returns fewer rows instead of an error, so
no log line shows it. Check by hand:

- A parent's notification arrives on the phone, not only inside the app.
- A chat you reply to moves to the top of the inbox.
- Optional, with the setup: a student excluded from a restricted exam cannot open it from its share link, and a
  blocked user cannot open a thread with the person who blocked them.

## 5. Minute 30 — repeat the logs

Run the two commands from step 2 again. Both should still print nothing new.

## Result

- **Clean:** record it in the rollout checklist (D3 and the D row of the record table) and in `STATUS.md`'s
  row-level-security item, with the date, and that p95 was read from the Cloud Run metrics page.
- **Anything off:** write down what, where and when, and decide about turning enforcement off with the rollback
  in rollout checklist D4 — only after looking at what failed. Rolling back is `RLS_ENFORCE=off` with
  `--update-env-vars`, never `--set-env-vars`.
