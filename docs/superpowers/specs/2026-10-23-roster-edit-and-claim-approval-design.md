# Roster: edit a student, and teacher-approved claims

Date: 2026-10-23 · Status: design approved in chat, spec awaiting review

## Problem

1. A teacher cannot rename a student from the app. `PATCH /students/:id` and
   `updateStudent()` already accept `displayName`, but the pencil on a roster row
   opens only the note modal.
2. Nothing makes sure the account linked to a roster row is the right person. A
   class code (`class_groups.joinCode`) lets anyone holding it pick any free name
   off the list; the only checks are one-self-link-per-name and the teacher's
   after-the-fact unlink. A teacher sees only an «انضم» pill, not *which* account.

## Decisions (approved)

- **Verification model B:** a student who joins from the *class code* is held as a
  pending request until the teacher approves.
- **Fail closed:** pending claims live in a **new table**, `roster_link_requests`.
  `roster_links` keeps its meaning ("approved link") and none of its ~120
  readers (auth, messaging, familyAccess, homework, studentExams, studentAttempt,
  classThread, roster) change. An unapproved account has no `roster_links` row,
  therefore no access, with no filter anyone could forget.
- Two PRs. **PR 1** has no schema change; **PR 2** is a draft.

## Which claims are held

| Path | Relation | Result |
| --- | --- | --- |
| Class code, student picks a name (`viaClassCode`, `relation = self`) | self | **pending request** |
| Per-student code (`students.claimCode`) | self or guardian | linked at once — the teacher handed that code to that child |
| Class code, parent | guardian | already refused by `redeemRoleCheck`; unchanged |

The decision is a pure function in `lib/claimDecision.ts` (`claimNeedsApproval`),
tested without a database like the rest of that file.

## PR 1 — edit, rename sync, claimed-by (no schema change)

**Edit sheet.** The pencil opens one sheet: display name, register number
(`externalRef`), gender, note. Replaces the note-only modal in
`app/classes/[id]/index.tsx`; the note stays one field of it.

**Rename rules (API, `PATCH /students/:id`).**
- Reject a `displayName` already used by another non-archived student in any class
  this student sits in — 409 `student_name_taken`. Same normalisation as the add
  route (`nameKey`: collapse whitespace, lower-case); no Arabic orthography folding,
  for the reason that route gives.
- After a rename, re-derive the display name of linked **code-only** accounts
  (`users.loginCodeHash` set, no password, no Google id) with
  `namesForNewAccount(role, newName)` — but only when the account's current
  first/last name equals `namesForNewAccount(role, oldName)`, i.e. the person has
  not edited it. Done with `systemDb` right after the student update, not in the same
  transaction (a second connection cannot share one); a failure is logged and the saved rename stands. `roster.ts` is already in
  `systemDbFiles.test.ts`.
- Class chat titles derive from the class, not the child, so nothing else moves.

**Claimed-by line.** `GET /classes/:id` returns, per student, `links:
[{ userId, relation, firstName, lastName, linkedAt }]` instead of only a count; the
existing `linked` boolean stays (derived) so older clients keep working. The row
shows «حساب: <name> · <date>» under the name.

## PR 2 — pending requests (draft)

**Table** `roster_link_requests`: `id`, `student_id` → students (cascade),
`user_id` → users (cascade), `relation` (always `self` for now), `created_at`;
unique `(student_id, user_id)`; index on `student_id`. Additive migration through
`pnpm --filter @workspace/db run generate`; not destructive. Classified `PROTECTED` in
`rlsCoverage.test.ts`: RLS on, a select and a delete policy (the sender and the student's
teacher), no insert or update policy, grant to `iqraa_app` written by hand, proved in
`rlsMatrix.test.ts`.

**Claim write path** (`linkRosterRowInTx` in `routes/auth.ts`, shared by
`/claim` and `/redeem`): when `claimNeedsApproval`, insert into
`roster_link_requests` (`onConflictDoNothing`) instead of `roster_links`, and
return outcome `pending`. Rules:
- Several accounts may have a pending request on the same name — a squatter must
  not lock out the real child. Cap of 5 pending per student (`pending_limit`).
- A name that already has a self link is refused as today (`claim_already_linked`).
- `POST /auth/claim` answers **202** `{ pending: true, studentId, studentName }`
  (201 `{ studentId, relation }` is unchanged for a link); `POST /auth/redeem` answers
  201 as today with `user.hasRosterLink: false` plus `pending: true, studentName`;
  `GET /auth/claim` returns `{ links, pending }`; the cap answers 409
  `claim_pending_limit`.
- An account holds one waiting pick: choosing another name replaces it, and a refused
  pick (cap) costs it nothing. Re-entering the code for a name the account already holds
  queues nothing.
- `DELETE /auth/claim` withdraws the waiting pick as well as the links;
  `DELETE /auth/claim?pendingOnly=1` withdraws the pick and never touches a link (the
  waiting card uses it, because the teacher may have approved since it last looked).

**Approve / reject** (teacher, `routes/roster.ts`, ownership checked in the
WHERE, "not found" for anything not theirs):
- `GET /classes/:id/link-requests` → pending requests for the class's live
  students: account first/last name, join date, student name.
- `POST /students/:id/link-requests/:requestId/approve` — the request is consumed first,
  then `roster_links` is inserted (the partial unique index `roster_links_one_self_idx`
  refuses a second student account, answered 409 `claim_already_linked`), then every
  other request on that name is deleted and `syncClassThreadsForStudent` runs; the index
  is the guard, not a lock. An account that switched role while waiting is dropped on
  approval (409 `claim_request_stale`) and is not listed. Each list item says whether
  the account was just created from the class code (`codeSignup`), because such an
  account is named after the roster name that was picked and so proves nothing itself.
- `POST /students/:id/link-requests/:requestId/reject` — delete the one request.
- An archived student or removed class membership drops its requests (cascade /
  checked on read).

**Applicant side.** `hasRosterLink` stays false, so the account has no access. Since
2026-10-23 a student is not gated onto the claim screen (only a parent is), so the
waiting state lives in three places: `claim-required` (a parent or a student who got
there), `join-class` (reads the account's claims on open), and a note under the login
code on the code-only signup. The waiting card says which name was asked for, with
"check again" and "pick a different name" (withdraw-only). A held student with no class
still lands on the grade picker after signup — the routing gate was deliberately not
widened. Copy ar + en in `i18n.ts`.

**Teacher side.** A banner at the top of the Students tab — «٢ طلاب بانتظار
الموافقة» — opens the list with Approve / Reject per request. Hidden at zero.
Mirrors the existing `unlinkAccount` confirm pattern.

## Out of scope

Search/sort/filter on the roster, bulk actions, parent approval, notifications for
a new request (the banner is enough for v1), a per-class "auto-approve" switch.
Each is a follow-up if teachers ask.

## Testing

- `claimDecision.test.ts`: `claimNeedsApproval` truth table (per-student code →
  no; class code + self → yes; guardian → no).
- api-server: rename conflict (409), rename sync only when the account name was
  untouched, `/claim` and `/redeem` produce a request not a link on a class code,
  approve links + clears siblings, reject removes, pending account gets nothing
  from `/messaging/contacts`, `/student/*` or homework, other teacher's request is
  404. DB-backed where the repo has a harness (`*.db.test.ts`).
- mobile: pure helpers (pending-count label, claimed-by line) in
  `services/__tests__`; screens checked in a browser, not just tests.
- Run what CI runs: `pnpm run typecheck`, api-server `pnpm build && pnpm test`,
  mobile `pnpm test`.

## Risks

- A pending applicant on `/redeem` already has an account and session; the plan
  must confirm every student-facing route is guarded by a link, not by role alone
  (the test above is the proof).
- Teachers who never open the Students tab leave applicants waiting. Accepted for
  v1; the banner is the only prompt.
