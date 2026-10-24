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
`pnpm --filter @workspace/db run generate`; not destructive. Classified in
`rlsCoverage.test.ts`; the grant to `iqraa_app` is written by hand (none is
automatic) and covered by `rlsDiff`.

**Claim write path** (`linkRosterRowInTx` in `routes/auth.ts`, shared by
`/claim` and `/redeem`): when `claimNeedsApproval`, insert into
`roster_link_requests` (`onConflictDoNothing`) instead of `roster_links`, and
return outcome `pending`. Rules:
- Several accounts may have a pending request on the same name — a squatter must
  not lock out the real child. Cap of 5 pending per student (`pending_limit`).
- A name that already has a self link is refused as today (`claim_already_linked`).
- The response carries `{ pending: true, studentName }`; no `hasRosterLink`.

**Approve / reject** (teacher, `routes/roster.ts`, ownership checked in the
WHERE, "not found" for anything not theirs):
- `GET /classes/:id/link-requests` → pending requests for the class's live
  students: account first/last name, join date, student name.
- `POST /link-requests/:id/approve` — one transaction, student row locked
  `for update`: re-check no self link exists, insert `roster_links`, delete **all**
  requests for that student, then `syncClassThreadsForStudent`. If a self link
  already exists, 409.
- `POST /link-requests/:id/reject` — delete the one request.
- An archived student or removed class membership drops its requests (cascade /
  checked on read).

**Applicant side.** `hasRosterLink` stays false, so the existing claim gate keeps
them out of the app. The gate gains a waiting state — «بانتظار موافقة المعلم على
انضمامك باسم «…»» — with a refresh button and a "choose a different name" action
(deletes their own pending request). Code-only accounts keep their login code, so
a rejected applicant can return and pick another name. Copy ar + en in `i18n.ts`;
Latin brand wording unaffected.

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
