# Pre-demo checklist

Run this before any live demo of the hosted app. It takes about two minutes and
exists because of one specific failure mode: **the parts of Iqraa that can go
quiet do not look broken while they are quiet.** They look normal.

Everything below is PowerShell, since that is the demo machine's shell.

---

## 0. Know what can go wrong

Three services back the demo, and they fail differently:

| Service | Where | Failure looks like |
| --- | --- | --- |
| `iqraa-web` | Render static | Always awake. Rarely the problem. |
| `iqraa-api` | Render free tier | Sleeps after ~15 min. First request takes 30–60s. |
| `iqraa-verifier` | Render free tier | Sleeps too. Live since 2026-08-09; the API has reached it since 2026-08-10. Sleep is now the only thing that breaks it. |

A sleeping verifier, an unreachable one and an undeployed one all produce the
same symptom, and none of them makes the app show an error. That is not
hypothetical: a wrong URL scheme (https to Render's internal plain-HTTP
address) was misread as "never deployed" for three days, while the service sat
healthy the whole time. Step 2 is what tells them apart.

---

## 1. Warm both services

The API is the one everyone remembers. The verifier is the one that gets
forgotten, because nothing on screen depends on it visibly.

```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$api = "https://iqraa-api-dfxu.onrender.com/api"

Invoke-RestMethod "$api/healthz"            # wakes the API — may take 60s
Invoke-RestMethod "$api/healthz/verifier"   # wakes the verifier via the API
```

Expect `status : ok` from the first. The second is step 2.

## 2. Confirm the verifier is actually there

```powershell
Invoke-RestMethod "$api/healthz/verifier"
```

| Response | Meaning | Do |
| --- | --- | --- |
| `verifier : ok`, `selfTest : pass` | Live and correct. | Continue. |
| `verifier : ok`, `selfTest : fail` | Reachable but wrong about `d/dx x² = 2x`. | Stop. Something is badly wrong. |
| `verifier : unreachable` | Asleep, misconfigured, or down. | Run once more — a cold service can miss the 2.5s timeout. Still unreachable → check the Render dashboard **and** `MATH_VERIFIER_URL` before concluding anything; "unreachable" is not the same as "not deployed". |

This endpoint is public on purpose: needing a login to discover the verifier
was unreachable is part of why it stayed unreachable for three days.

## 3. Prove it is really verifying

`ok` only says something answered. This says it is answering *correctly* — and
it is the demo moment worth showing, not just checking.

```powershell
$login = Invoke-RestMethod "$api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"demo@iqraa.app","password":"IqraaDemo2026"}'
$h = @{ Authorization = "Bearer $($login.accessToken)" }

# Correct key — expect verified True
Invoke-RestMethod "$api/verify/derivative" -Method POST -Headers $h -ContentType "application/json" -Body '{"question":"3x^4 - 2x + 7","answer":"12x^3 - 2"}'

# Wrong key — expect verified False
Invoke-RestMethod "$api/verify/derivative" -Method POST -Headers $h -ContentType "application/json" -Body '{"question":"3x^4 - 2x + 7","answer":"12x^3 + 2"}'
```

**Do not skip the second call.** A `True` on its own proves nothing — a stub
that always says yes passes step 1 and step 3's first half. `True` then `False`
is the only pair that proves the maths is being checked.

## 4. Check what the app will claim

With the verifier reachable, template items come back `verified: true` /
`verificationSource: "sympy"`. Confirmed against the hosted API on 2026-08-10.

If it is unreachable — asleep, most likely — the API returns `verified: false`
with `verificationSource: "code_template"` rather than claiming verification it
did not perform. That is honest, but it means **the badge will correctly read
"not verified" for the whole demo.** Know that before a prospect asks, rather
than during. It is the single strongest argument for step 1.

---

## If you are demoing the verification story specifically

The strongest artifact is not a green badge — it is the LLM being caught. Run:

```bash
cd artifacts/math-verifier
python prove_slice.py
```

It generates 20 items and asserts every key verifies. The AI path logs its
attempts, and a typical run includes an entry like
`['answer_mismatch', 'ok_attempt_2']` — the model proposed a wrong derivative,
SymPy rejected it, and it regenerated. That is the product's whole argument in
one line of output, and it runs locally with no deployment required.

---

## Known hazards

- **The 2.5s client timeout** (`VERIFY_TIMEOUT_MS` in `mathVerifierClient.ts`)
  is shorter than a Render free-tier cold start. A first call to a sleeping
  verifier fails even though the service is healthy. Warming is not optional.
- **`DEMO_MODE = true` mocks AI but not auth.** The demo still needs the live
  API and Neon Postgres. Login is a real database round trip.
- **The demo account is `demo@iqraa.app` / `IqraaDemo2026`.** Verify login works
  in step 3 before an audience watches you type it.
- **Only `main` is deployed.** If a change "isn't showing", check it is merged
  before debugging anything visual.

## Before a real class uses a student link

- [ ] **Move `iqraa-api` and `iqraa-verifier` off Render's free tier.** Free
      instances sleep after ~15 minutes and take 30–60s to wake. Thirty
      students opening a link at the start of a lesson would each wait on a
      blank screen. Fine for testing, fatal in a classroom.
- [ ] Set `AI_USER_BUDGET_USD` — the AI budget is otherwise one shared total,
      and the teacher who generates on the 20th is refused with no way to tell
      it from a bug.
- [ ] Load-test 30 concurrent submits, and re-check Neon's connection headroom.
