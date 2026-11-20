# Teacher newsletter — design

Date: 2026-11-20. Status: design approved in chat; this spec awaits the owner's
read before an implementation plan is written. Nothing is built.

## Goal

A monthly email to teachers that says what is new in the app, so a teacher who
has not opened it lately has a reason to come back. The owner reads and
approves every issue; no issue is ever sent by a schedule or by a deploy.

## Decisions taken with the owner (2026-11-20)

| Question | Decision |
| --- | --- |
| Who receives it | Teachers only. Not parents, students or the waitlist. |
| What it is for | What is new in the app. |
| Consent | Every teacher with a verified email receives it; each issue carries an unsubscribe link (opt-out). |
| How an issue is written | Pre-filled from the teacher «ما الجديد» notes; the owner edits. No model writes it. |
| Sending | Nothing is sent before the owner's final review and approval. |

## What exists today (checked 2026-11-20)

- **A mail tool for the waitlist.** `POST /admin/broadcasts`
  (`artifacts/api-server/src/routes/admin.ts`) sends one message to the
  iqrra.com waitlist, `system_admin` only, with `dryRun` (count, no mail) and
  `testOnly` (one copy to the caller). The screen is
  `artifacts/mobile/app/admin/signups.tsx`. Its rules are in `lib/siteMail.ts`.
- **A sender.** `sendBroadcast` (`lib/email.ts`) sends through Resend in batches
  of 100, leaves out every address in `email_suppressions`, and returns who was
  accepted, who failed and who was skipped. Its footer text is written for the
  waitlist («لأنك سجّلت اهتمامك… على iqrra.com») and its link builder takes a
  waitlist row id.
- **Unsubscribe per address.** `lib/emailUnsubscribe.ts` builds a link for any
  address (`emailUnsubscribeUrl`), `GET|POST /api/email/unsubscribe`
  (`routes/emailPreferences.ts`) serves it, and `email_suppressions` holds the
  result. It stops every `general` mail to that address; `security` mail
  (sign-up and password codes) still arrives.
- **The notes.** `WHATS_NEW` (`artifacts/mobile/services/whatsNew.ts`) has one
  entry per visible change: `date`, `roles`, a title and body translation key,
  and an optional `route`. 15 entries today.
- **Not there:** any mail to registered users other than security codes and
  admin notices; any record of an issue; any line about product news in the
  privacy policy (`artifacts/mobile/constants/legal.ts`, `LEGAL_VERSION`
  2026-11-19).
- **A stricter precedent.** The waitlist's own «أخبار وتحديثات» mail is closed
  (`UPDATES_CONSENT_FROM = null`) because the sign-up form promised only an
  invite and a launch notice. The opt-out decision above is looser than that
  rule; see *Risks*.

## The approval rule

This is the part the owner asked for, so it is enforced by the server, not by
the screen.

1. An issue can be sent only by a signed-in `system_admin` pressing send. No
   cron, workflow, deploy step or script calls the send route.
2. A send is accepted only for text that was test-sent first. The test stores a
   hash of the subject and body; the send recomputes it. Any edit after the
   test, even one character, gets `409 not-tested`.
3. The test must be less than 24 hours old, or the send gets `409 test-expired`.
4. A test goes to the caller's own address and to nobody else.

## How one issue goes out

1. **Open** `/admin/newsletter`. The screen shows when the last issue went out
   and how many teachers would receive one now.
2. **Draft.** «أنشئ مسودة» fills the subject and body from the notes (below).
   The owner edits, reorders or deletes freely. A draft lives on the screen
   only; nothing is stored or sent.
3. **Test.** «أرسل لي نسخة» mails that exact text to the owner, subject
   prefixed «[تجريبي]», and stores the issue as tested.
4. **Send.** «أرسل إلى المعلمين» opens a confirm dialog with the count, then
   sends. The screen shows sent, failed and skipped.
5. **Retry.** If some failed, pressing send again for the same issue reaches
   only the teachers who did not get it.

## The draft

A pure function in the app, `artifacts/mobile/services/newsletterDraft.ts`,
because the notes and their translations live in the app:

`buildNewsletterDraft({ entries, since, today, t })` → `{ subject, body }`

- Takes entries whose `roles` include `teacher`, dated after `since` (the Amman
  day of the last sent issue) and not after `today`. With no issue sent yet,
  `since` is 31 days before `today`.
- Body is plain text: an Arabic block, then an English block. Each entry is its
  title, its body, and, when it has a `route`, the line
  `https://app.iqrra.com<route>`.
- Subject: «جديد إقرأ هذا الشهر · What's new in Iqrra».
- **First issue only** (no issue sent yet): the body opens with one sentence in
  each language saying this is Iqrra's monthly news for teachers and that the
  link at the bottom stops it.
- No entries in the window returns an empty body, and the screen says there is
  nothing new to send.

`renderBroadcastBody` (`lib/siteMail.ts`) turns the text into email HTML. Today
it sets one direction for the whole message (any Arabic letter makes all of it
right-to-left), which would right-align the English block. It changes to set
direction **per paragraph**. This also applies to waitlist mail, where a
two-language message has the same fault.

## Who receives it

`pickTeacherRecipients(rows)`, pure, in a new `lib/newsletter.ts`:

- `role` is `teacher` or `school_admin`,
- `email` is present and a valid address, `emailVerified` is true,
- `suspendedAt` is null,
- one recipient per address.

`sendBroadcast` then drops anyone in `email_suppressions`, as it does today.

## API

New router file `artifacts/api-server/src/routes/adminNewsletter.ts`, mounted
with its paths spelled out and its guards on each route (never a bare
`router.use`, see CLAUDE.md on routers without a prefix). All three routes are
`authMiddleware` + `requireRole("system_admin")`. This is a new file, not more
branches in `POST /admin/broadcasts`: `admin.ts` is already large and the
waitlist rules (`purpose`, consent dates) do not apply to teachers. The sender
is shared.

| Route | Does |
| --- | --- |
| `GET /admin/newsletter` | `{ lastSentAt, eligible, unsubscribed }`. Sends nothing. |
| `POST /admin/newsletter/test` `{subject, body}` | Mails the caller; stores or replaces the one unsent issue with its hash and `testedAt`; returns `{ issueId, sentTo }`. |
| `POST /admin/newsletter/send` `{issueId, subject, body}` | Applies the approval rule; sends to eligible teachers not yet in `newsletter_sends` for this issue; records those Resend accepted; returns `{ sent, failed, skipped }`. |

- Subject and body limits are `parseBroadcast`'s (3–150 and 10–10,000
  characters).
- The two sending routes use the existing `admin-broadcasts` rate limiter.
- The send is synchronous and answers after the mail is handed over, as the
  waitlist send does (work after `res.json` may not run on Cloud Run).
- `sendBroadcast` gains two things: the link builder receives the whole
  recipient (the teacher link is `emailUnsubscribeUrl(email)`), and the footer
  sentence is an argument. The teacher footer: «تصلك هذه الرسالة لأن لديك حساب
  معلّم في إقرأ.» / "You received this because you have a teacher account on
  Iqrra.", followed by the unsubscribe link.
- Reading every teacher's address crosses users, so under `RLS_ENFORCE` it must
  go through the same connection the admin Users screen uses; if that is
  `systemDb`, the new file is added to `systemDbFiles.test.ts`.

## Database

One migration, two tables (`lib/db/src/schema/newsletter.ts`):

**`newsletter_issues`**

| column | type | note |
| --- | --- | --- |
| `id` | uuid, pk | |
| `subject` | text | as tested |
| `body` | text | as tested, plain text |
| `content_hash` | text | sha-256 of subject and body |
| `created_by` | uuid → users, set null | |
| `tested_at` | timestamptz | |
| `sent_at` | timestamptz, null | set on the first successful send; null means draft |

At most one row has `sent_at` null: a new test replaces it.

**`newsletter_sends`**: `issue_id` → issues (cascade), `user_id` → users
(cascade), `sent_at`. Primary key `(issue_id, user_id)`, which is what makes a
second delivery of one issue to one teacher impossible.

Both tables are admin-only: classified in `rlsCoverage.test.ts`, with no grant
to `iqraa_app` beyond what the admin path needs. The migration only creates
tables, so it needs no destructive-migration acknowledgement.

## App

- `app/admin/newsletter.tsx`, opened from the admin dashboard, admin only. It
  holds the subject and body fields, the three buttons, the count and the
  result. The send button is disabled until a test of the current text has
  succeeded on this screen; the server rule above holds either way.
- No «ما الجديد» entry: only an admin can see the screen. The PR body says so.

## Privacy policy

`constants/legal.ts` gains one sentence, Arabic and English, in the section on
how email is used: teachers receive occasional product news by email and can
stop it with the link in any issue. `LEGAL_VERSION` moves to the merge day.
There is no re-acceptance flow, so existing teachers are not shown the new
text; the first issue's opening sentence is how they are told.

## Tests

- `lib/__tests__/newsletter.test.ts` (API, pure): recipient rules (role,
  unverified, suspended, no email, duplicate address), the hash, and the
  approval rule (untested, edited after test, expired test).
- `newsletter.db.test.ts` (API, database): a second send of one issue reaches
  nobody already recorded; a failed batch stays eligible; a suppressed address
  is skipped.
- `siteMail` test: direction per paragraph.
- `services/__tests__/newsletterDraft.test.ts` (app): the window, teacher-only
  entries, the first-issue sentence, the empty case, links.
- `mountOrder.test.ts` keeps passing: an unowned path still answers 404.
- No test sends real mail: without `RESEND_API_KEY` the sender reports every
  address as failed, which is what the tests run against.

## Risks

- **Mail teachers did not ask for.** Opt-out was the owner's choice. The policy
  text is model-written and not lawyer-reviewed, existing teachers accepted a
  version with no newsletter line, and the repo's own waitlist rule is
  stricter. Mitigations in this design: the first-issue sentence, one-click
  unsubscribe, and the policy line. A lawyer's read is still open.
- **Unsubscribe is all-or-nothing.** A teacher who unsubscribes also stops
  other `general` mail to that address (admin notices). Security codes still
  arrive. A separate "product news" switch is left out.
- **Resend limits are unchecked.** Before the first real send the owner checks,
  in the Resend dashboard, the plan's daily and monthly caps against the
  `eligible` count, and that the `RESEND_FROM_EMAIL` domain is verified.
- **A wrong link in an issue cannot be recalled.** The test copy is the only
  guard; the owner opens each link in it before sending.

## Left out

Scheduling; open and click tracking; parents, students and the waitlist;
AI-written text; a stored history screen of past issues; a Profile switch for
product news only; images or a designed template beyond the existing email
shell.

## Before the first real issue (owner)

1. Read this spec and the policy sentence.
2. Check the Resend caps and the sending domain.
3. Send the test, open every link, then send.
