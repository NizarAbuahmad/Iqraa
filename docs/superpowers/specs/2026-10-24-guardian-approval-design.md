# Parent approval for email students — design

**Status:** server implemented (PR A); app (PR B) not started. **Scope:** a student who signs up with an email and no teacher's code
stays locked until a parent approves by email. Replaces the age tick-box added in «Students choose an email or a
teacher's code» (2026-10-23). Not in this spec: any change to how teacher-code students or parents sign up, ID or
document checks, a parent account or parent dashboard, deleting a declined account automatically.

## Why

The email student path (PR #1226) is gated only by a tick: «I'm an adult, or my parent agrees». Nothing verifies
it, a child can tick it, and it is the **only** gate on a student who has an email and no class, so no teacher
vouches for them. `users.guardian_confirmed_at` records the tick and nothing reads it. The owner asked for a real
check, and chose the parent-confirms-by-email design below over a date-of-birth gate.

## Decisions taken (and why)

1. **A parent confirms by email.** The student gives a parent's email at sign-up; the parent gets a link and
   approves or declines. This is the only option offered that actually involves an adult. (Alternatives offered and
   not chosen: a date-of-birth gate, both together, a teacher's code only for minors.)
2. **It applies to every email student, with no age exceptions.** The student role is for school pupils, so no birth
   year is asked and there is no "I am an adult" way round. An adult learner uses a teacher's code. (Alternative
   not chosen: ask a birth year and require a parent only under 18 or 16, which a typed birth year defeats.)
3. **Until the parent approves, the account does nothing but wait.** The student can verify their own email, sign
   in, and see a waiting screen. The **server** refuses every other request, not only the app screens.
4. **It applies to existing email students and to role switches into student.** Anyone already in that state is
   moved to the waiting screen at their next request. (Alternatives not chosen: new accounts only, and a 14-day
   grace period.)
5. **Ships dark behind a flag.** `GUARDIAN_APPROVAL=true` turns enforcement on; unset, the merge changes nothing
   for anyone. Not asked, added because enforcement locks existing users and must not deploy before the updated
   app and the parent-consent wording are ready (§Rollout).

## The rule

An account is **pending** when all of these hold, and `guardianApprovalEnabled()` is true:

- `role = 'student'`;
- `email IS NOT NULL` (a code-only student has none: their teacher vouches for them);
- `guardian_approved_at IS NULL`;
- no live roster link (`hasLiveRosterLink` is false). A teacher's per-student code links at once; a class-code
  claim links when the teacher approves it. Either way a teacher has vouched, so the account is not pending.

`pendingGuardian(user, hasLink, flagOn)` is a pure function in `lib/guardianGate.ts` (no database import, so
`node --test` can load it, as `suspension.ts` and `claimDecision.ts` are). Everything else in this spec calls it.

A pending account may reach only: `GET /auth/me`, `POST /auth/guardian-request`, `POST /auth/role` (leaving the
student role grants nothing the gate protects, and without it a student who picked the wrong role at sign-up has
no way out of the waiting screen; ruling R11), `POST /auth/logout`, `DELETE /auth/users/me` (erasure does not
pause, as for a suspended account), and `GET|POST|DELETE /auth/claim` (joining a class with a teacher's code is the
other legitimate way in; once the teacher has vouched the account is no longer pending). The unauthenticated routes (`/auth/login`, `/auth/refresh`, `/auth/verify-email` and so on) do
not pass through `authMiddleware` and are unchanged. Anything else answers **403 `guardian_approval_required`**.

One route verifies the access token itself and so never passes through `authMiddleware`: the public live-game join
(`POST /live/:code/join`, which records the signed-in student's id on the player row). It applies the same rule
through `pendingGuardian` and records no user id for a held student, who still plays, anonymously, like anyone with
the game code (ruling R12).

## Data

One additive migration (nothing destructive):

- `users.guardian_approved_at timestamptz NULL`. Set only when a parent approves. `guardian_confirmed_at` (the
  tick) stays as history and is no longer written.
- New table `guardian_consents`: `id uuid pk`, `user_id uuid not null → users(id) on delete cascade`,
  `parent_email text not null` (lower-cased, trimmed), `token_hash text NULL unique` (sha256 of a 32-byte random
  token; only the hash is stored), `created_at`, `sent_at NULL`, `expires_at NULL` (sent + 7 days), `decided_at NULL`,
  `decision text NULL` (`approved` or `declined`), `superseded_at NULL`. **`token_hash` and `expires_at` stay null
  until the mail is issued**: sign-up queues a request before the student has verified their own email, and the
  plaintext token must exist only at the moment it is mailed (it is never stored). Indexes on `user_id` and on
  `(parent_email, created_at)` for the rate limit. One **current** request per student: a new request sets
  `superseded_at` on the previous open one.
- RLS: the table is read and written only through `systemDb` (the public parent route has no user). It is classified
  as owner-only in `rlsCoverage.test.ts`, gets no grant to `iqraa_app`, and its files are added to the pinned list in
  `systemDbFiles.test.ts`.

## Flows

**Sign-up (register and Google, student, email path).** With `GUARDIAN_APPROVAL=true` the age tick is replaced by a
required `parentEmail`. Refused 400 `parent_email_required` / `parent_email_invalid`, and 400
`parent_email_is_own` when it equals the student's own address, and 429 `guardian_rate_limited` over the parent-address
limit. A request row is queued with no token. **Nothing is mailed to the parent yet.** With the flag **off** the
server behaves exactly as today: the tick is required and any `parentEmail` is ignored. (The live app still sends
the tick, so the server must keep asking for it until the flag is on.)

**`GET /guardian-consent/config`** (public) returns `{enabled}`, so the app knows which of the two sign-up forms to
show. Unlike `lookup` and `decide` it works with the flag off.

**After the student's own email is verified** (`POST /auth/verify-email`; at once for Google, whose address is
already verified), the server sends the parent mail and sets `sent_at`. Waiting until then means the sign-up form
cannot be used to send mail to a stranger from an address nobody has proved they own.

**Parent mail.** Bilingual (Arabic first), same transport and failure posture as the verification mail
(`sendGuardianConsentEmail` in `lib/email.ts`): the child's **first name only**, one sentence on what Iqrra is, the
consent statement, a button to `{GUARDIAN_LINK_BASE}/guardian#{token}` (`GUARDIAN_LINK_BASE` defaults to
`https://app.iqrra.com`), and the expiry. With no `RESEND_API_KEY` it logs as the verification mail does in dev.

**The token is in the URL fragment, never in a path or a query** (ruling R10). A browser never sends the fragment
to a server, so the token cannot reach Cloud Run's request log, this app's own log, a proxy or an analytics screen
name; the parent's page reads it from `location.hash` and posts it in a request body. A path segment would have
landed in all of those.

**Parent page (public, no account).** `POST /guardian-consent/lookup` takes `{token}` and returns
`{childFirstName, status}` where status is `open`, `expired`, `decided` or `invalid` (unknown, malformed and missing
tokens, and superseded ones, all answer `invalid`; expired ones are told apart only as far as "this link does not
work"); `POST /guardian-consent/decide` takes `{token, decision, confirmGuardian}`. There is no `GET` with a token:
`GET /guardian-consent/<token>` is a 404, so no state can change by GET and no token sits in a URL. Approving requires
`confirmGuardian: true` («I am this child's parent or legal guardian»). The write is one conditional update
(`… WHERE decided_at IS NULL AND superseded_at IS NULL AND expires_at > now() RETURNING`), so a token works once and
two clicks cannot both win. On `approved` it sets `users.guardian_approved_at` in the same transaction. Declining
sets `decision = 'declined'` and nothing else.

**Waiting screen (`/guardian-waiting`).** Shows the parent's address (masked as `ab***@gmail.com`), when the request
was sent, a **resend** button, a **change parent's email** field (both call `POST /auth/guardian-request`, which
supersedes the old link), a **sign out** link and the existing delete-account link. A declined state says so and
offers the change-email field again. If the student's own email is still unverified, the screen sends them to
verify it first.

**`POST /auth/guardian-request`** (auth; role student; allowed while pending or declined): body `{parentEmail}`. 409
`email_not_verified` if the student's own address is unverified. Validates as at sign-up. Limits below. Responds
`{parentEmailMasked, emailSent, expiresAt}`.

**`GET /auth/me`** gains `guardianStatus`: `not_required` (flag off, not a student, no email, or linked),
`approved`, `needed` (pending, no request sent yet), `waiting`, `declined`, plus `guardianParentEmailMasked`. The
app reads it on every boot and also re-reads it whenever any call returns `guardian_approval_required`.

**Role switch.** With the flag on, `POST /auth/role` (and the Google existing-account conflict path) **no longer ask
for an age tick**: switching into student simply produces a pending account, which lands on the waiting screen and
asks for the parent's email there. `decideRoleSwitch` takes an `ageTickRequired` input (default true, so today's
behaviour is unchanged) that the routes set to `!guardianApprovalEnabled()`. With the flag off the tick is asked as
today. The tick boxes leave the three role-switch screens in PR B, once the app reads `config.enabled`. A held
student may call `POST /auth/role` to leave the student role (to parent or teacher; they are then not held, and
`/me` says `not_required`); asking for `student` again changes nothing.

## Abuse limits

- 3 requests per student per rolling 24 hours (counting `guardian_consents` rows); 5 per parent address per 24 hours.
  Both answer 429 `guardian_rate_limited`.
- The public route has its own per-IP rate limiter, scoped to its path like the other public routers (asserted in
  `mountOrder.test.ts`, both ways), and never reveals whether a token was ever valid.
- The parent address cannot equal the student's own. Tokens are 32 random bytes, hashed at rest, single use, 7 days.
- The parent mail carries no login, no student surname and no account detail beyond the first name.

## Client (`artifacts/mobile`)

- `register.tsx`: the age `CheckRow` becomes a parent's-email input on the student-email path (and the Google
  path); the three role-switch screens drop their age box and `switchNeedsAgeConfirmation` is deleted.
- `services/routeGating.ts`: `needsGuardianApproval(user)` (pure, tested) sends a pending student to
  `/guardian-waiting`; `/guardian-waiting` joins the non-teacher allowlist; **`/guardian`** (the parent page, one
  route that reads the token from `location.hash` and never puts it in a path, a query or a screen name) joins
  `PUBLIC_ROUTES`, because the parent has no account. It must stay out of analytics screen tracking and crash
  breadcrumbs, or the fragment's reason for existing is lost.
- Copy in `services/i18n.ts`, Arabic first (`arabic-copy-reviewer` on every string).

## Rollout

1. **PR A, server, flag off:** migration, `guardianGate.ts`, `authMiddleware` gate, endpoints, email, `/me` field,
   register/Google/role changes, tests. Merging changes nothing for anyone while `GUARDIAN_APPROVAL` is unset.
2. **PR B, app, flag off:** waiting screen, parent page, register field, routing, copy, web build checked in
   Chromium (English and Arabic).
3. **Before the flag is turned on** (the owner's steps): the updated app has reached users (web deploys with the
   merge; Android needs an OTA or build); the parent-consent wording and the new `LEGAL_VERSION` have been read by a
   lawyer or native reader; the store declaration says parents confirm student sign-ups. Then set
   `GUARDIAN_APPROVAL=true` on the service.
4. Turning the flag on locks existing email students until a parent approves. That is decision 4, and the cost.

PR A deploying first is safe because an old app that receives `guardian_approval_required` only ever does so after
the flag is on.

## Tests

- **Unit** (`lib/__tests__/guardianGate.test.ts`): `pendingGuardian` over every combination (flag, role, email,
  approved, link) and the allowlist function.
- **DB-backed** (`routes/__tests__/guardianApproval.db.test.ts`, through the built bundle, `STUDENT_ACCOUNTS=true`
  and `GUARDIAN_APPROVAL=true` set by the test server): register needs a valid parent email and refuses the
  student's own; nothing is mailed before verification, one request after; a pending account gets 403
  `guardian_approval_required` on a representative route from each router and 200 on the allowlist; the public
  route is single use, expires, refuses an unticked approve, and a second click loses; approve sets
  `guardian_approved_at` and the same token then fails; decline leaves the account locked and a new request
  supersedes the old link; rate limits; a code-only student, a linked student, a teacher and a parent are never
  pending; the flag unset changes nothing (the same requests all succeed); role switch into student produces a
  pending account with no tick.
- **Existing tests to change:** `roleSwitch.test.ts`, `ageConfirmation.test.ts`, `signupMethod.test.ts`
  (`switchNeedsAgeConfirmation`), and the register tests that send `ageConfirmed`.
- **Mobile:** `routeGating.test.ts` for the new rule; copy and terminology tests stay green.
- **Browser (PR B):** sign-up with a parent email, the waiting screen, the parent page approving and declining,
  the student unlocked on refresh, in English and Arabic.
- **Mutation checks** on the gate (drop the roster-link exemption; drop the allowlist) and on single use.

## Limits, said plainly

- **It proves a person with access to that mailbox clicked approve, not that they are the child's parent.** A child
  can give a friend's or their own second address. That is the usual limit of email-based parental consent. The
  `confirmGuardian` statement and the stored timestamp make the claim explicit and recorded; they do not verify it.
- A student with no available parent cannot start on their own; the teacher's-code path remains for them.
- A declined or never-answered account is not deleted automatically. A purge of long-pending accounts is a follow-up.
- The parent-consent wording and the `LEGAL_VERSION` bump are drafted, **not reviewed by a lawyer**. Bumping the
  version asks every user to accept again, as the 2026-10-23 bump did.
- Parent email addresses become stored personal data. They are kept for the life of the student's account, deleted
  with it (cascade), and must be named in the privacy policy.

## Open questions for the owner

None blocking the build. Two to settle before the flag is turned on: whether declined or 30-day-silent requests
should delete the pending account, and how long the approval stays valid if the parent's address later bounces.
