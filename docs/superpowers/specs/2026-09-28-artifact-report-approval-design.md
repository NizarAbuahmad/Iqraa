# AI-artifact report → admin approval

## Problem

`GeneratorResultActions`'s "بلّغ عن مشكلة في هذه النسخة" button currently
calls `POST /generate/variants/:id/retire`, which immediately sets
`aiArtifacts.retiredAt` — any authenticated teacher can pull a shared
artifact out of the pool unilaterally, with no review. The ask is to make
this a report-and-approve flow instead: the artifact stays servable to other
teachers until a `system_admin` approves the retirement, and that admin is
notified by push and email when a report comes in.

## Existing pattern this reuses

The app already has this exact shape for chat-message moderation:
`chatReports` table → `GET/POST /moderation/reports` (`moderation.ts`,
roles `school_admin`+`system_admin`) → `app/admin/moderation.tsx`. This
design is that pattern applied to `aiArtifacts`, with two deliberate
differences: the role scope is `system_admin` only (content quality is not
a per-school concern), and it adds a notification step the chat flow never
had.

## Data model

New table, `lib/db/src/schema/aiArtifactReports.ts`:

```ts
export type ArtifactReportStatus = "open" | "approved" | "dismissed";

export const aiArtifactReports = pgTable(
  "ai_artifact_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artifactId: uuid("artifact_id").notNull().references(() => aiArtifacts.id, { onDelete: "cascade" }),
    reporterUserId: uuid("reporter_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull().default(""),
    status: text("status").$type<ArtifactReportStatus>().notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("ai_artifact_reports_artifact_idx").on(t.artifactId),
    index("ai_artifact_reports_status_idx").on(t.status),
  ],
);
```

`aiArtifacts.retiredAt` is unchanged in meaning — "never served again" —
but is now only ever written by the admin-resolve endpoint, never by the
report endpoint. No dedupe constraint on repeated reports of the same
artifact: at this volume, multiple `open` rows for one artifact just show
as multiple list entries: an admin resolves the artifact once and every
report referencing it is left `open` until swept — acceptable since a
resolved artifact is retired and can't be reported again (see below).

## Server changes

**`POST /generate/variants/:id/retire` (`generate.ts`) — becomes a report, not a retirement.**
- If the artifact is already retired, insert nothing; respond
  `{ reported: false, alreadyRetired: true }`.
- Otherwise insert an `open` row into `ai_artifact_reports`
  (`reporterUserId: req.user.id`, `artifactId: id`, `reason` from an
  optional request body field), then call `notifyAdminsOfArtifactReport()`
  (below), then respond `{ reported: true }`.
- The artifact's `retiredAt` is untouched — it keeps being served to other
  teachers asking for the same key until an admin approves.

**New: `GET /moderation/artifact-reports?status=&limit=&offset=`** and
**`POST /moderation/artifact-reports/:id/resolve`** (added to `moderation.ts`,
new `ARTIFACT_ADMIN_ROLES = ["system_admin"]` constant, both gated by
`requireRole(...ARTIFACT_ADMIN_ROLES)`):
- List mirrors `GET /moderation/reports`: joins the artifact (`kind`,
  `lessonRef`, `language`) and the reporter's name, newest first, carries
  `openCount` the same way.
- Resolve takes `{ outcome: 'approved' | 'dismissed' }`. `approved` sets
  `aiArtifacts.retiredAt = now()` (only if still null) and the report's
  `status` to `approved`. `dismissed` only sets the report's `status`. One
  call, one decision — same reasoning as the chat resolve endpoint: a queue
  entry and the artifact's live/retired state must never disagree.

**New: `lib/adminNotify.ts`** — `notifyAdminsOfArtifactReport(report, artifact)`:
- Looks up all `system_admin` users (id, email, name).
- Push: joins `devicePushTokens` for those ids, calls the existing
  `sendExpoPush()` — same helper and posture (`messaging.ts`'s
  `notifyThreadParticipants` already fire-and-forgets this same way).
- Email: calls a new `sendArtifactReportedEmail(to, { kind, lessonRef, reason })`
  in `email.ts`, built on the existing `renderEmailShell()` template.
- Both channels are wrapped so a failure is logged and never propagates —
  a notification failure must not fail the teacher's report call.

## Client changes

**`services/ai/RemoteAIService.ts`**: rename `retireVariant` → `reportVariant`
(same signature, same endpoint path — only the server-side effect changed).

**`components/ui/GeneratorResultActions.tsx`**:
- Rename the internal `reportProblem` call target to `reportVariant`.
- Add local `reported` state; once a report succeeds for the artifact on
  screen, disable the button and swap its label (e.g. `t('reportArtifactSent')`)
  so a teacher can't spam it. This state is screen-local and naturally
  resets once `onRegenerate()` swaps in a new `variantId`.
- Keep calling `onRegenerate()` after a successful (or already-retired)
  report — the reporter still gets an immediate personal replacement, per
  the approved design; only *other* teachers keep seeing the flagged
  version until an admin acts.

**`services/i18n.ts`** — reword `reportArtifact*` keys (AR + EN) from
"withdrawn now" to "reported, pending review by the content team," and add
`reportArtifactSent` for the disabled-button label. `reportArtifactGone`
is repurposed for the `alreadyRetired: true` response.

## Admin UI

New `app/admin/artifact-reports.tsx`, structurally mirroring
`app/admin/moderation.tsx`: list of `open` reports (kind, lesson,
reporter, reason, date) with Approve/Dismiss actions calling the new
resolve endpoint. `app/admin/dashboard.tsx` gets an open-count badge for
this queue the same way it already surfaces the chat-moderation one.

Scope note: the review screen shows the report's metadata, not a full
render of the artifact's content (slides/questions) — an admin who needs
to see the actual material opens it the way a teacher would. Full inline
preview is deferred; add it if metadata-only proves insufficient to decide.

## Rollout

`ai_artifact_reports` is a new table — needs
`pnpm --filter @workspace/db run push` against production after merge, per
`STATUS.md`'s standing warning that schema pushes are manual and unchecked
deploys have caused outages before. Call this out explicitly in the PR
description (`schema-push: done`).

## Out of scope (YAGNI)

- No dedupe/rate-limit on repeated reports of the same artifact.
- No audit table for admin resolve actions — a log line, same as the chat
  moderation endpoint's `logger.info(...)`, since there's no second
  moderator yet to disagree about who did what.
- No general notification center — push + a badge count, reusing exactly
  what already exists for chat.
