# Pre-launch security review — Iqraa

> **Status, checked 2026-09-16 when this was committed.** Both launch-blocking
> findings — HIGH-1 and HIGH-2 — were **fixed by #455** («Close the Google
> sign-in door that pre-registration was holding open»), which landed after this
> review was written and before it reached the repo. `routes/auth.ts` now refuses
> a payload whose `email_verified !== true`, and the linking rule is split into
> `lib/googleLink.ts` with its own tests, precisely so it can be exercised
> without a database.
>
> Everything below HIGH-2 is **as written and not re-checked** — the MEDIUM and
> LOW findings, the operational list, and the dependency table have not been
> revisited since. Read this as a record of the review, not as a current
> statement of what is outstanding. Re-verify before acting on any single item.

Reviewed 2026-09-16 against `ce81f3d5`. Scope: `artifacts/api-server` (all 21 routers,
middleware, libs), `artifacts/mobile` auth/storage, `lib/db` query construction,
`.github/workflows`, Dockerfile, deploy config, dependency tree, git history.

## Summary

The authorization model is better than most production codebases I've read. Every
`:id` route resolves through an owned-or-404 helper (`ownedEvaluation`,
`ownedAttempt`, `ownedStudent`, `participantOf`), guards are path-scoped at the
mount site with a test (`mountOrder.test.ts`) asserting the mount order, rate
limits live in shared Postgres rather than per-instance memory, there is no SQL
injection anywhere (every `sql` template is parameterised), no SSRF (external
media is allowlisted by manifest id, never by caller URL), and the student exam
surface — the only unauthenticated write path — is carefully built.

Two findings are launch-blocking. Both are in the same place: Google sign-in.

---

## HIGH-1 — Pre-hijack account takeover via Google account linking

`artifacts/api-server/src/routes/auth.ts:1037-1044`

```ts
[user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
if (user) {
  [user] = await db.update(users)
    .set({ googleId: payload.sub, emailVerified: true })   // <-- links to an unverified row
    .where(eq(users.id, user.id)).returning();
}
```

**Attack**

1. Attacker calls `POST /auth/register` with the victim's address and a password
   they choose. The row is created `emailVerified: false`. No session is issued,
   so nothing looks wrong. The attacker cannot log in — yet.
2. Weeks later the victim signs up with "Continue with Google" on the same address.
3. This branch finds the attacker's row by email and sets `emailVerified: true`.
4. `POST /auth/login` (`auth.ts:925`) now passes its `emailVerified` gate. The
   attacker signs in with the password from step 1 and holds the victim's account
   indefinitely — roster, evaluations, messages with parents.

Rate limits do not apply: the whole attack is one registration.

**Fix** — when linking Google to a row that has not proved its own address, the
password on that row is not trustworthy and must not survive the link:

```ts
if (user) {
  const wasUnverified = !user.emailVerified;
  [user] = await db.update(users)
    .set({
      googleId: payload.sub,
      emailVerified: true,
      // An unverified row's password was set by whoever typed it, not
      // necessarily by the person Google just authenticated. Linking would
      // otherwise hand that password a verified account.
      ...(wasUnverified ? { passwordHash: null } : {}),
    })
    .where(eq(users.id, user.id)).returning();
  if (wasUnverified) {
    await db.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));
    await db.update(emailVerificationTokens).set({ used: true })
      .where(and(eq(emailVerificationTokens.userId, user.id),
                 eq(emailVerificationTokens.used, false)));
  }
}
```

The user keeps their account and signs in with Google; `hasPassword: false` on
`/auth/me` already drives the delete screen correctly, and they can set a password
later through `/auth/forgot-password`.

**Also audit existing data before launch.** Any row with `google_id IS NOT NULL AND
password_hash IS NOT NULL` where the password predates the Google link may already
be hijacked:

```sql
SELECT id, email, created_at FROM users
WHERE google_id IS NOT NULL AND password_hash IS NOT NULL;
```

## HIGH-2 — `/auth/google` never checks `payload.email_verified`

`artifacts/api-server/src/routes/auth.ts:1024`

`verifyIdToken` proves the token was minted by Google for an accepted audience. It
does **not** prove Google verified the address inside it. The code then uses
`payload.email` as the account-linking key. Google's own integration guidance is
explicit that `email` must not be trusted as an identifier unless `email_verified`
is true — a Workspace admin can mint arbitrary addresses on their own domain, which
matters more here than usual because the customers are schools on Workspace domains.

**Fix**, one line, immediately after the existing `payload?.sub || payload.email` check:

```ts
if (payload.email_verified !== true) {
  res.status(401).json({ error: "Invalid Google credential" });
  return;
}
```

---

## MEDIUM

### M-1 — 30-day refresh tokens live in `localStorage` on production web

`artifacts/mobile/services/secureStorage.ts:6-8` says the web target "is only used
for Replit preview / development simulation". That is no longer true —
`.github/workflows/deploy.yml:320` deploys `artifacts/mobile/dist` to Cloudflare
Pages, serving app.iqrra.com. So on the live web app a 30-day refresh token sits in
`localStorage`, and `public/_headers` deliberately carries no `script-src` CSP. Any
XSS is therefore a 30-day account takeover rather than a 15-minute one.

Options, cheapest first: (a) fix the stale comment so nobody relies on it;
(b) issue a shorter-lived refresh token when the client is web; (c) add refresh
reuse detection (see L-3); (d) land the `script-src` CSP that `_headers` defers.

### M-2 — Wildcard CORS on the whole API

`artifacts/api-server/src/app.ts:39` — `app.use(cors())` sends
`Access-Control-Allow-Origin: *`. Auth is bearer-token, not cookies, so this is not
classic CSRF. But it means any page on the internet can script the unauthenticated
surfaces: `/take/:code`, `/auth/join/:code`, `/auth/login`, `/auth/register`,
`/healthz/*`. Replace with an allowlist:

```ts
const ALLOWED = new Set([
  "https://app.iqrra.com",
  "https://iqrra.com",
  ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:8081"]),
]);
app.use(cors({ origin: (o, cb) => cb(null, !o || ALLOWED.has(o)) }));
```

Native apps send no `Origin`, hence the `!o`.

### M-3 — No security headers on the API

No `helmet`, and nothing sets them by hand. Missing: `X-Content-Type-Options:
nosniff`, `Strict-Transport-Security`, `Referrer-Policy`, and — the one that
matters most for an API serving roster data — `Cache-Control: no-store` on
authenticated JSON. `pnpm add helmet` plus `app.use(helmet())` covers the first three.

### M-4 — Web `_headers` covers clickjacking only

`artifacts/mobile/public/_headers` has `X-Frame-Options` and `frame-ancestors`
(good, and the reasoning in that file is sound). Still absent:
`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`. None of
these can break an Expo bundle the way `script-src` might, so they are free.

### M-5 — Per-user AI budget is inert in production

`aiBudget.getUserBudgetLimitUsd` returns 0 unless `AI_USER_BUDGET_USD` is set, and
it is set in neither `render.yaml`, nor `deploy.yml`, nor `.env.example` — so
`assertUserQuotaAvailable` is a no-op. `routes/index.ts:31-36` already says this in
a comment; it is still true. The only per-caller ceiling is the burst limiter
(30 chat/min, 15 generate/min). One account sustaining that drains the shared
monthly `AI_BUDGET_USD`, at which point `assertBudgetAvailable` 429s **every**
user. Set `AI_USER_BUDGET_USD` on the Cloud Run service before launch.

### M-6 — `POST /media/lesson` is any-signed-in and unmetered

`routes/index.ts:100` guards `/media` with `authMiddleware` only. `lessonMedia.ts`
is documented as teacher media, but a student or parent account can post 8MB
data-URLs into R2 with no role gate, no rate limit and no per-user quota — free
file hosting and unbounded storage spend. Add `requireRole(...TEACHER_ROLES)` at
the `lessonMediaRouter` mount and a per-user limiter.

### M-7 — `qs` advisories reach production; the rest of the audit does not

`pnpm audit` reports 54 findings, 42 high. Read them carefully before reacting:
essentially every "high" is `@expo/cli`, `config-plugins`, `babel-jest` or
`xcpretty` — **build** tooling that never ships in a bundle or an image. The ones
that actually run in production are:

| Package | Path | Note |
|---|---|---|
| `qs` (2 moderate) | `api-server > express > body-parser > qs@6.15.3` | Parses every request body. Fix with a pnpm `overrides` entry to the patched version. |
| `uuid` (moderate) | `api-server > google-auth-library > gaxios > uuid` | Needs a caller-supplied `buf`; gaxios doesn't pass one. Low. |
| `esbuild` (low) | `api-server > esbuild` | Dev server only. |

Fix `qs`; record the rest in a CI allowlist so the headline number stops crying wolf.

### M-8 — Exam share codes never expire

`studentAttempt.ts:evaluationByCode` accepts any code whose evaluation is
`published` — no expiry, unlike class join codes, which check `joinCodeExpiresAt`.
`GET /take/:code` returns every student's display name. So one whiteboard photo, or
one forwarded link, exposes a class list of minors indefinitely. Teachers can close
an exam by hand, but nothing makes them. Add a `shareCodeExpiresAt`, or auto-close a
published exam some period after its sitting.

---

## LOW / hardening

- **L-1** No strength assertion on `SESSION_SECRET` at boot (`middlewares/auth.ts:29`
  only checks presence). A short or placeholder value silently forges every JWT.
  Assert length >= 32 in `index.ts` alongside the existing `PORT` check.
- **L-2** `jwt.verify(token, secret)` doesn't pin `algorithms: ["HS256"]`.
  jsonwebtoken v9 with a string secret is safe by default; pin it anyway.
- **L-3** Refresh rotation without reuse detection (`auth.ts:1183`). A stolen token
  that has already been rotated just fails — the token family isn't revoked, so the
  theft goes unnoticed. Relevant given M-1.
- **L-4** `req.headers["x-admin-key"] !== adminKey` (`health.ts:118`) is not
  constant-time. Use `crypto.timingSafeEqual`.
- **L-5** No maximum password length. bcrypt silently truncates at 72 bytes, and
  `bcrypt.hash` is reachable with a multi-megabyte string (12MB body limit). Cap at
  ~128 chars in `passwordPolicy.ts`.
- **L-6** `Dockerfile` runs as root — no `USER node`. Cloud Run sandboxes this, but
  it's one line.
- **L-7** `ci.yml`, `mobile-update.yml`, `schema-check.yml` and `provider-eval.yml`
  declare no `permissions:` block and inherit the repo default token scope; only
  `deploy.yml` sets one. Add `permissions: contents: read` to each.
  (No `pull_request_target` anywhere, and every `${{ }}` sits in an `env:` block
  rather than inline in a `run:` script — the two things that usually go wrong in
  Actions are both already right.)
- **L-8** `/healthz/errors` claims "no request bodies", but `summarizeDetail`
  spreads the whole log context (`errorLog.ts:27`), and at least one call site logs
  an address: `logger.error({ userId, email }, "verification email not sent")`.
  Postgres unique-violation messages can also embed values. It is `ADMIN_DEBUG_KEY`
  gated, so this is contained; correct the docstring or allowlist the keys.
- **L-9** The rate limiter fails open when Postgres is unreachable
  (`rateLimit.ts:47-60`). Deliberate and well-argued — but it means an attacker who
  can make the DB flap also removes all rate limiting. Alert on
  `"rate limit store unavailable"`.
- **L-10** `artifacts/mobile/google-services.json` carries a Firebase API key. That
  is a public client identifier by design, not a leak — but confirm it has Android
  package plus SHA-1 restrictions in the Cloud console, especially after the
  keystore rotation on 2026-09-06.

---

## Operational, before launch

Git history is clean — `.env` was never committed, and the one commit that pastes an
`OPENAI_API_KEY` (`40371bf1`) has it redacted. The exposures on record happened in
chat transcripts, not the repo, and are still live credentials:

- production `iqraa-api` secrets (2026-09-06 `gcloud` env dump — the whole set)
- R2 tokens, both the `iqraa-media` scoped one and the local-dev one
- the Neon database password (2026-09-13 `.env` edit)
- two Google OAuth client secrets (2026-09-08)

Rotate all of them at launch, and confirm `SESSION_SECRET`, `ADMIN_DEBUG_KEY` and
`AI_USER_BUDGET_USD` are set on the Cloud Run service.

## What I checked and found no issue with

SQL injection (all parameterised through drizzle), SSRF (`media.ts` allowlists by
manifest id), IDOR across evaluations / attempts / roster / workspace / messaging
(uniform owned-or-404), answer-key leakage to students
(`sanitizeQuestionForStudent`: allowlist, registry projection, and a belt-and-braces
second pass), share-code entropy (31^6, CSPRNG, unambiguous alphabet), verification
and reset code handling (hashed, user-scoped, attempt-capped, per-address rate
limited, uniform error messages), role escalation at registration (allowlisted),
suspension enforcement (middleware-level, fail-closed, re-read on every request),
rate-limit correctness across instances (single-statement upsert on the database
clock), and GitHub Actions secret handling.
