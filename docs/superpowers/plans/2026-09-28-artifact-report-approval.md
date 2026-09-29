# AI-Artifact Report → Admin Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "بلّغ عن مشكلة" from an immediate self-serve retirement into a report that a `system_admin` must approve — the flagged artifact keeps serving other teachers until then, and admins are notified by push and email.

**Architecture:** A new `ai_artifact_reports` table queues reports (mirroring the existing `chatReports` moderation pattern). The teacher-facing endpoint inserts a report row instead of retiring; a new admin-only endpoint pair (list + resolve) reuses the *existing* `retireVariant()` to actually retire on approval. A new notification helper pushes to `system_admin` devices and emails them via the existing Resend integration.

**Tech Stack:** Express + Drizzle (`lib/db`), Expo/React Native mobile client, existing `sendExpoPush`/Resend helpers.

**Spec:** [`docs/superpowers/specs/2026-09-28-artifact-report-approval-design.md`](../specs/2026-09-28-artifact-report-approval-design.md)

## Global Constraints

- Admin scope for this queue is `system_admin` only (not `school_admin`) — different from the chat-moderation queue's `ADMIN_ROLES`.
- The reporting teacher gets an immediate personal replacement via `onRegenerate()`; other teachers keep being served the flagged variant until an admin approves.
- No reason/free-text field on the report — the confirm dialog has no text input today and none is being added.
- `POST /generate/variants/:id/retire` keeps its URL unchanged; only its behavior and response shape change.
- A notification failure (push or email) must never fail the teacher's report call.
- New table `ai_artifact_reports` needs `pnpm --filter @workspace/db run push` against production after merge — PR description must say `schema-push: done`.

---

## Task 1: DB schema — `ai_artifact_reports` table

**Files:**
- Create: `lib/db/src/schema/aiArtifactReports.ts`
- Modify: `lib/db/src/schema/index.ts`

**Interfaces:**
- Produces: `aiArtifactReports` (pgTable), `ArtifactReportStatus` (`"open" | "approved" | "dismissed"`), `AiArtifactReport` type — all imported by Task 2 (`artifactCache.ts`) and Task 5 (`moderation.ts`).

- [ ] **Step 1: Write the schema file**

```ts
// lib/db/src/schema/aiArtifactReports.ts
import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiArtifacts } from "./aiArtifacts";
import { users } from "./users";

export type ArtifactReportStatus = "open" | "approved" | "dismissed";

/**
 * A teacher's "بلّغ عن مشكلة" on a pooled artifact, queued for a
 * `system_admin` to act on — see `routes/moderation.ts`'s
 * `/moderation/artifact-reports*` endpoints.
 *
 * The artifact itself is NOT retired by inserting this row: `aiArtifacts`'s
 * pool keeps serving it to other teachers until an admin approves. That is
 * the point of this table existing separately from `retiredAt` — a report is
 * a claim, not yet a decision.
 */
export const aiArtifactReports = pgTable(
  "ai_artifact_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artifactId: uuid("artifact_id")
      .notNull()
      .references(() => aiArtifacts.id, { onDelete: "cascade" }),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull().default(""),
    status: text("status").$type<ArtifactReportStatus>().notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("ai_artifact_reports_artifact_idx").on(t.artifactId),
    index("ai_artifact_reports_status_idx").on(t.status),
  ],
);

export const insertAiArtifactReportSchema = createInsertSchema(aiArtifactReports).omit({
  id: true,
  createdAt: true,
});

export type AiArtifactReport = typeof aiArtifactReports.$inferSelect;
export type InsertAiArtifactReport = z.infer<typeof insertAiArtifactReportSchema>;
```

- [ ] **Step 2: Export it from the schema barrel**

In `lib/db/src/schema/index.ts`, right after the existing `aiArtifacts` export:

```ts
export * from "./aiArtifacts";
// A teacher's report against a pooled artifact — see aiArtifactReports.ts
export * from "./aiArtifactReports";
```

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS (no automated test — this repo has no schema-file tests; `lib/db/src` has none today, and a real round-trip needs a live Postgres this suite doesn't have. Verified structurally at push time in Task 8.)

- [ ] **Step 4: Commit**

```bash
git add lib/db/src/schema/aiArtifactReports.ts lib/db/src/schema/index.ts
git commit -m "feat(db): add ai_artifact_reports table"
```

---

## Task 2: Server lib — `reportVariant()` in `artifactCache.ts`

**Files:**
- Modify: `artifacts/api-server/src/lib/artifactCache.ts` (add after `retireVariant`, ~line 248)

**Interfaces:**
- Consumes: `aiArtifacts`, `aiArtifactReports` from `@workspace/db` (Task 1); `note()`/`lastFailure` already in this file.
- Produces: `reportVariant(args: { artifactId: string; reporterUserId: string }): Promise<ReportOutcome>` where `ReportOutcome = { ok: true; reportId: string; kind: string; lessonRef: string } | { ok: false }` — consumed by Task 4 (`generate.ts`).
- The existing `retireVariant(artifactId: string): Promise<boolean>` is UNCHANGED and is reused as-is by Task 5's admin-resolve endpoint — do not modify it.

- [ ] **Step 1: Add `reportVariant`, right after `retireVariant`'s closing brace**

```ts
export type ReportOutcome =
  | { ok: true; reportId: string; kind: string; lessonRef: string }
  | { ok: false };

/**
 * Queue a report against a pooled artifact — does NOT retire it.
 *
 * Unlike `retireVariant`, this never touches `retiredAt`: the artifact keeps
 * serving every other teacher asking for the same key until a `system_admin`
 * approves the report (see `routes/moderation.ts`). Refuses (returns
 * `{ ok: false }`) for an artifact that no longer exists or is already
 * retired — reporting a dead variant is a no-op, not an error, matching
 * `retireVariant`'s own "gone is not a failure" posture.
 */
export async function reportVariant(args: {
  artifactId: string;
  reporterUserId: string;
}): Promise<ReportOutcome> {
  try {
    const { db, aiArtifacts, aiArtifactReports } = await import("@workspace/db");
    const { eq, and, isNull } = await import("drizzle-orm");
    const [artifact] = await db
      .select({ id: aiArtifacts.id, kind: aiArtifacts.kind, lessonRef: aiArtifacts.lessonRef })
      .from(aiArtifacts)
      .where(and(eq(aiArtifacts.id, args.artifactId), isNull(aiArtifacts.retiredAt)))
      .limit(1);
    if (!artifact) {
      lastFailure = null;
      return { ok: false };
    }
    const [row] = await db
      .insert(aiArtifactReports)
      .values({ artifactId: args.artifactId, reporterUserId: args.reporterUserId })
      .returning({ id: aiArtifactReports.id });
    lastFailure = null;
    return { ok: true, reportId: row.id, kind: artifact.kind, lessonRef: artifact.lessonRef };
  } catch (err) {
    note(err, "insert");
    return { ok: false };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS. (No unit test — matches this file's existing convention: `retireVariant`, `readPool`, `storeVariant` etc. have no `artifactCache.test.ts`, because they need a live database this repo's `node --test` suite doesn't have. Exercised for real in Task 4's manual verification.)

- [ ] **Step 3: Commit**

```bash
git add artifacts/api-server/src/lib/artifactCache.ts
git commit -m "feat(api): add reportVariant, separate from retireVariant"
```

---

## Task 3: Server lib — admin notification (email + push)

**Files:**
- Modify: `artifacts/api-server/src/lib/email.ts` (add `sendArtifactReportedEmail` + a private `escapeHtml`)
- Create: `artifacts/api-server/src/lib/adminNotify.ts`

**Interfaces:**
- Consumes: `sendExpoPush` from `./pushNotifications.ts` (existing), `db`/`users`/`devicePushTokens` from `@workspace/db`, `logger` from `./logger.ts`.
- Produces: `notifyAdminsOfArtifactReport(args: { kind: string; lessonRef: string }): Promise<void>` — consumed by Task 4 (`generate.ts`). Never throws.

- [ ] **Step 1: Add the email sender to `email.ts`**

Add near the bottom of `artifacts/api-server/src/lib/email.ts`, before the final closing (keep existing functions untouched):

```ts
/**
 * `reason`/`lessonRef` ultimately trace back to a teacher's report and a
 * lesson id — neither is attacker-controlled today (no free-text field
 * exists yet), but this is the one place in the file that interpolates
 * anything other than a server-generated code, so it escapes rather than
 * assuming that stays true.
 */
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/**
 * Tells a `system_admin` a teacher flagged a shared AI artifact. Same
 * transport and failure posture as every other email here: no key means no
 * send, logged and swallowed — the report itself must not depend on mail
 * being configured.
 */
export async function sendArtifactReportedEmail(
  to: string,
  info: { kind: string; lessonRef: string },
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn({ to }, "RESEND_API_KEY not set — artifact-report notice not sent");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "Iqraa <onboarding@resend.dev>",
        to,
        subject: "تقرير محتوى جديد بانتظار المراجعة / New content report awaiting review",
        html: renderArtifactReportedEmailHtml(info),
      }),
    });
    if (!res.ok) {
      logger.error({ to, status: res.status, body: await res.text() }, "resend artifact-report notice send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err, to }, "resend artifact-report notice send threw");
    return false;
  }
}

function renderArtifactReportedEmailHtml(info: { kind: string; lessonRef: string }): string {
  const kind = escapeHtml(info.kind);
  const lessonRef = escapeHtml(info.lessonRef || "—");
  return renderEmailShell(`
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-bottom:24px;">
      <p>أبلغ معلّم عن مشكلة في مادة مولَّدة بالذكاء الاصطناعي، وهي بانتظار مراجعتك.</p>
      <p><strong>النوع:</strong> ${kind}</p>
      <p><strong>الدرس:</strong> ${lessonRef}</p>
      <p>راجع البلاغ من لوحة الإدارة داخل التطبيق.</p>
    </div>
    <hr style="border:none;border-top:1px solid #E2E8F0;" />
    <div dir="ltr" style="font-family:Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-top:24px;">
      <p>A teacher reported a problem with an AI-generated ${kind}, awaiting your review.</p>
      <p><strong>Lesson:</strong> ${lessonRef}</p>
      <p>Review it from the admin dashboard in the app.</p>
    </div>
  `);
}
```

- [ ] **Step 2: Write `adminNotify.ts`**

```ts
// artifacts/api-server/src/lib/adminNotify.ts
import { db, users, devicePushTokens } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { sendExpoPush } from "./pushNotifications.ts";
import { sendArtifactReportedEmail } from "./email.ts";
import { logger } from "./logger.ts";

/**
 * Pushes + emails every `system_admin` when a teacher reports a pooled
 * artifact. Never throws: a notification failure must not fail the
 * teacher's report call, so every branch here is caught and logged instead
 * of propagated — same posture as `sendExpoPush` itself.
 */
export async function notifyAdminsOfArtifactReport(args: {
  kind: string;
  lessonRef: string;
}): Promise<void> {
  try {
    const admins = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.role, "system_admin"));
    if (admins.length === 0) return;

    const adminIds = admins.map((a) => a.id);
    const tokenRows = await db
      .select({ expoPushToken: devicePushTokens.expoPushToken })
      .from(devicePushTokens)
      .where(inArray(devicePushTokens.userId, adminIds));

    const body = `${args.kind} — ${args.lessonRef || "بدون درس محدد"}`;
    await sendExpoPush(
      tokenRows.map((t) => ({
        to: t.expoPushToken,
        title: "تقرير محتوى جديد",
        body,
        data: { screen: "artifact-reports" },
      })),
    );

    await Promise.all(admins.map((a) => sendArtifactReportedEmail(a.email, args)));
  } catch (err) {
    logger.error({ err }, "notifyAdminsOfArtifactReport failed");
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS. (No unit test — matches `pushNotifications.ts`'s own convention: it has no test file either, since its only job is a fire-and-forget HTTP call. Exercised manually in Task 4.)

- [ ] **Step 4: Commit**

```bash
git add artifacts/api-server/src/lib/email.ts artifacts/api-server/src/lib/adminNotify.ts
git commit -m "feat(api): notify system_admins by push and email on artifact report"
```

---

## Task 4: Server route — `/generate/variants/:id/retire` becomes a report

**Files:**
- Modify: `artifacts/api-server/src/routes/generate.ts` (imports ~line 59-65, handler ~line 871-907)

**Interfaces:**
- Consumes: `reportVariant` (Task 2), `notifyAdminsOfArtifactReport` (Task 3).
- Produces: same URL, new response shapes — `{ reported: true }` on success, `404 { error, alreadyRetired: true }` when nothing was there to report. Consumed by Task 6 (`RemoteAIService.reportVariant`).

- [ ] **Step 1: Update the import block**

Change:
```ts
import {
  noteServed,
  readPool,
  readSeenArtifactIds,
  retireVariant,
  storeVariant,
} from "../lib/artifactCache.ts";
```
to:
```ts
import {
  noteServed,
  readPool,
  readSeenArtifactIds,
  reportVariant,
  storeVariant,
} from "../lib/artifactCache.ts";
import { notifyAdminsOfArtifactReport } from "../lib/adminNotify.ts";
```

- [ ] **Step 2: Replace the route handler**

Replace the whole block from the `/**\n * Take a pooled artifact out of circulation.` comment (~line 871) through the closing `});` (~line 907) with:

```ts
/**
 * Report a pooled artifact as wrong.
 *
 * Unlike a straight retirement, this does NOT pull the artifact out of the
 * pool by itself — it queues a report for a `system_admin` to approve (see
 * `routes/moderation.ts`'s `/moderation/artifact-reports*`), and every other
 * teacher asking for the same key keeps being served it until then. Only the
 * *reporting* teacher gets an immediate personal replacement, via the
 * client's `onRegenerate()` call after this responds.
 *
 * Open to any authenticated teacher — same reasoning as before: the person
 * holding the bad paper is the one who knows it is bad. What changed is who
 * acts on that claim, not who may raise it.
 *
 * Under /generate/* so it inherits the auth guard the classroom-activity
 * route once escaped by being mounted bare — see the note above that route.
 */
generateRouter.post("/generate/variants/:id/retire", async (req: AuthenticatedRequest, res) => {
  // Express types this as `string | string[]`; a repeated :id would otherwise
  // reach a uuid comparison as an array.
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (typeof id !== "string" || !id) {
    res.status(404).json({ error: "No pooled variant to report." });
    return;
  }
  const outcome = await reportVariant({ artifactId: id, reporterUserId: req.user!.id });
  if (!outcome.ok) {
    // 404 for "no such variant" and for "already retired" alike: both mean
    // there is nothing left in the pool to report, which is what the caller
    // wanted, and telling the two apart says which ids exist.
    res.status(404).json({ error: "No pooled variant to report.", alreadyRetired: true });
    return;
  }
  logger.warn(
    { artifactId: id, reportId: outcome.reportId, userId: req.user?.id },
    "pooled artifact reported by a teacher",
  );
  await notifyAdminsOfArtifactReport({ kind: outcome.kind, lessonRef: outcome.lessonRef });
  res.json({ reported: true });
});
```

- [ ] **Step 3: Build and typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification against local dev**

Per `LOCAL_SETUP.md`, start the API (`pnpm run dev:api`) against a local DB with the new table pushed (`pnpm --filter @workspace/db run push` against your dev `DATABASE_URL`). With a teacher token and a real `aiArtifacts.id`:

```bash
curl -X POST http://localhost:8080/api/generate/variants/<artifact-id>/retire \
  -H "Authorization: Bearer <token>"
```

Expected: `{"reported":true}`, a new `open` row in `ai_artifact_reports`, and `aiArtifacts.retiredAt` for that row still `NULL` (confirm with `SELECT retired_at FROM ai_artifacts WHERE id = '<artifact-id>'`). Calling it again on the same id returns `{"reported":false,...}`-shaped 404 only once it's actually retired (Task 5) — while still `open`, the endpoint has no dedupe, so a second call inserts a second report row (by design, per spec).

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/routes/generate.ts
git commit -m "feat(api): report a pooled artifact instead of retiring it directly"
```

---

## Task 5: Server routes — admin queue (`GET`/`POST /moderation/artifact-reports*`)

**Files:**
- Modify: `artifacts/api-server/src/routes/moderation.ts`
- Modify: `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`

**Interfaces:**
- Consumes: `aiArtifacts`, `aiArtifactReports`, `ArtifactReportStatus` from `@workspace/db`; `retireVariant` from `../lib/artifactCache.ts` (unchanged, Task 2 left it alone).
- Produces: `GET /moderation/artifact-reports?status=&limit=&offset=` → `{ reports, total, openCount }`; `POST /moderation/artifact-reports/:id/resolve` with `{ outcome: 'approved' | 'dismissed' }` → `{ report, retired }`. Consumed by Task 7 (mobile admin screen).

- [ ] **Step 1: Write the failing mount-order test**

In `mountOrder.test.ts`, add this `it` right after the existing `"mounts the moderation queue, and refuses it without a token"` block (~line 334):

```ts
  it("mounts the artifact-report queue, and refuses it without a token", async () => {
    // Same shape as the chat-moderation queue above, but for reported AI
    // artifacts: a report has always been possible since this route
    // existed as an immediate retire, so a 404 here would mean the new
    // review surface silently isn't reachable.
    const res = await fetch(`${base}/moderation/artifact-reports`);
    assert.equal(res.status, 401, "the artifact-report queue must exist and require a token");

    const resolve = await fetch(
      `${base}/moderation/artifact-reports/00000000-0000-0000-0000-000000000000/resolve`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    );
    assert.equal(resolve.status, 401, "resolving an artifact report must require a token");
  });
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd artifacts/api-server && pnpm build && pnpm test`
Expected: FAIL — `GET /moderation/artifact-reports` answers 404 (unmounted), not 401.

- [ ] **Step 3: Add the routes to `moderation.ts`**

Add these imports at the top, alongside the existing ones:
```ts
import {
  aiArtifacts,
  aiArtifactReports,
  chatMessages,
  chatReports,
  chatThreads,
  db,
  users,
  type ArtifactReportStatus,
  type ChatReportStatus,
} from "@workspace/db";
```
and:
```ts
import { retireVariant } from "../lib/artifactCache.ts";
```

Add this constant near the top, beside the existing `ADMIN_ROLES`:
```ts
// Separate from the chat-moderation ADMIN_ROLES on purpose: artifact
// quality is a curriculum/content concern, not a per-school one, so
// school_admin is deliberately left out.
const ARTIFACT_ADMIN_ROLES = ["system_admin"];
const ARTIFACT_REPORT_STATUSES: ArtifactReportStatus[] = ["open", "approved", "dismissed"];
```

Add these two routes at the end of the file, right before `export default router;`:

```ts
const artifactReporter = alias(users, "artifact_reporter");

/**
 * GET /moderation/artifact-reports?status=open&limit=&offset=
 *
 * Same shape as GET /moderation/reports: newest first, carries the
 * artifact's own kind/lesson/language and the reporter's name so an admin
 * can decide without leaving this screen.
 */
router.get(
  "/moderation/artifact-reports",
  authMiddleware,
  requireRole(...ARTIFACT_ADMIN_ROLES),
  async (req, res) => {
    try {
      const { status, limit, offset } = req.query as {
        status?: string;
        limit?: string;
        offset?: string;
      };

      const pageSize = Math.min(Math.max(Number(limit) || 50, 1), 200);
      const pageOffset = Math.max(Number(offset) || 0, 0);
      const wanted = ARTIFACT_REPORT_STATUSES.includes(status as ArtifactReportStatus)
        ? (status as ArtifactReportStatus)
        : undefined;
      const where = wanted ? eq(aiArtifactReports.status, wanted) : undefined;

      const rows = await db
        .select({
          id: aiArtifactReports.id,
          status: aiArtifactReports.status,
          createdAt: aiArtifactReports.createdAt,
          artifactId: aiArtifactReports.artifactId,
          kind: aiArtifacts.kind,
          lessonRef: aiArtifacts.lessonRef,
          language: aiArtifacts.language,
          artifactRetiredAt: aiArtifacts.retiredAt,
          reporterId: artifactReporter.id,
          reporterName: sql<string>`${artifactReporter.firstName} || ' ' || ${artifactReporter.lastName}`,
        })
        .from(aiArtifactReports)
        .innerJoin(aiArtifacts, eq(aiArtifactReports.artifactId, aiArtifacts.id))
        .innerJoin(artifactReporter, eq(aiArtifactReports.reporterUserId, artifactReporter.id))
        .where(where)
        .orderBy(desc(aiArtifactReports.createdAt))
        .limit(pageSize)
        .offset(pageOffset);

      const [{ count: total }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiArtifactReports)
        .where(where);
      const [{ count: openCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiArtifactReports)
        .where(eq(aiArtifactReports.status, "open"));

      res.json({ reports: rows, total, openCount });
    } catch (err) {
      logger.error({ err }, "list artifact reports failed");
      res.status(500).json({ error: "Failed to load reports" });
    }
  },
);

/**
 * POST /moderation/artifact-reports/:id/resolve
 *
 * Body: { outcome: 'approved' | 'dismissed' }
 *
 * `approved` calls the SAME `retireVariant` the teacher-facing route used to
 * call directly — approving a report is now the only path to that function.
 * `dismissed` only closes the report; the artifact was never touched.
 */
router.post(
  "/moderation/artifact-reports/:id/resolve",
  authMiddleware,
  requireRole(...ARTIFACT_ADMIN_ROLES),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { outcome } = req.body as { outcome?: string };
      if (outcome !== "approved" && outcome !== "dismissed") {
        res.status(400).json({ error: "outcome must be 'approved' or 'dismissed'" });
        return;
      }

      const [report] = await db
        .select()
        .from(aiArtifactReports)
        .where(eq(aiArtifactReports.id, req.params["id"] as string))
        .limit(1);
      if (!report) {
        res.status(404).json({ error: "Report not found" });
        return;
      }

      const retired = outcome === "approved" ? await retireVariant(report.artifactId) : false;

      const [saved] = await db
        .update(aiArtifactReports)
        .set({ status: outcome })
        .where(eq(aiArtifactReports.id, report.id))
        .returning();

      logger.info(
        { reportId: report.id, moderatorId: req.user!.id, outcome, retired },
        "artifact-report moderation action",
      );

      res.json({ report: saved, retired });
    } catch (err) {
      logger.error({ err }, "resolve artifact report failed");
      res.status(500).json({ error: "Failed to resolve report" });
    }
  },
);
```

- [ ] **Step 4: Run the test again and confirm it passes**

Run: `cd artifacts/api-server && pnpm build && pnpm test`
Expected: PASS — both new assertions return 401.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/routes/moderation.ts artifacts/api-server/src/routes/__tests__/mountOrder.test.ts
git commit -m "feat(api): admin queue for AI-artifact reports"
```

---

## Task 6: Mobile client — report instead of retire

**Files:**
- Modify: `artifacts/mobile/services/ai/RemoteAIService.ts` (~line 264)
- Modify: `artifacts/mobile/components/ui/GeneratorResultActions.tsx`
- Modify: `artifacts/mobile/services/i18n.ts` (~line 775-781 AR, ~line 2584-2590 EN)

**Interfaces:**
- Produces: `remoteAIService.reportVariant(variantId: string): Promise<boolean>` (renamed from `retireVariant`, same call shape).

- [ ] **Step 1: Rename `retireVariant` → `reportVariant` in `RemoteAIService.ts`**

```ts
  /**
   * Report a pooled artifact as wrong. Does NOT retire it — a `system_admin`
   * has to approve that; this only queues the report and gets the reporting
   * teacher a fresh replacement via the caller's regenerate step.
   *
   * `false` means there was nothing in the pool under that id to report — no
   * such variant, or it was already retired by an earlier approval. Not an
   * error: both leave the caller where it wanted to be, and the screen goes
   * on to regenerate either way. A network or auth failure throws, because
   * that one did *not* leave the report queued and saying otherwise would be
   * a lie the teacher acts on.
   */
  async reportVariant(variantId: string): Promise<boolean> {
    const res = await apiFetch(`/generate/variants/${encodeURIComponent(variantId)}/retire`, {
      method: 'POST',
    });
    if (res.status === 404) return false;
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    return true;
  }
```

(Replaces the existing `retireVariant` method at that location — same name change everywhere it was called, i.e. just this one method definition; no other file calls it directly yet.)

- [ ] **Step 2: Update `GeneratorResultActions.tsx`**

Replace the `reportProblem` function and add a `reported` state that resets when the artifact on screen changes:

```tsx
  const [reporting, setReporting] = React.useState(false);
  const [reported, setReported] = React.useState(false);

  // A new variantId means onRegenerate() already swapped in a fresh,
  // unreported artifact — the button must not still say "reported" for it.
  React.useEffect(() => {
    setReported(false);
  }, [variantId]);

  /**
   * Queue a report against this artifact, then regenerate.
   *
   * Reporting no longer retires anything itself — a `system_admin` approves
   * that from the admin queue. Both halves still matter for the *reporting*
   * teacher: reporting alone would leave them holding the paper they just
   * flagged; regenerating alone would give them a good one while everyone
   * else kept getting served the bad one until someone else noticed.
   *
   * A failed report does NOT go on to regenerate — same reasoning as before:
   * the report has to fail visibly or not at all.
   */
  const reportProblem = async () => {
    if (!variantId || reporting || reported) return;
    const ok = await confirm({
      title: t('reportArtifactTitle'),
      message: t('reportArtifactMsg'),
      confirmLabel: t('reportArtifactConfirm'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    setReporting(true);
    try {
      const queued = await remoteAIService.reportVariant(variantId);
      // Already gone (retired by an earlier approval) counts as done — the
      // teacher wanted it out of circulation and it already is.
      onToast(queued ? t('reportArtifactDone') : t('reportArtifactGone'));
      setReported(true);
      onRegenerate();
    } catch {
      onToast(t('reportArtifactFailed'));
    } finally {
      setReporting(false);
    }
  };
```

Update the button's `disabled`/`opacity`/label to reflect `reported`:

```tsx
        {!!variantId && (
          <Pressable
            onPress={reportProblem}
            disabled={reporting || reported}
            style={({ pressed }) => [
              styles.actionBtn,
              {
                borderColor: colors.destructive,
                borderRadius: colors.radius,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                opacity: reporting || reported ? 0.5 : pressed ? 0.8 : 1,
              },
            ]}
          >
            <Ionicons name="flag-outline" size={16} color={colors.destructive} />
            <Text style={[styles.actionText, { color: colors.destructive, fontFamily: 'Cairo_600SemiBold' }]}>
              {reported ? t('reportArtifactSent') : t('reportArtifactBtn')}
            </Text>
          </Pressable>
        )}
```

- [ ] **Step 3: Reword the i18n keys**

In `artifacts/mobile/services/i18n.ts`, replace the Arabic block (~line 775-781):
```ts
    reportArtifactBtn: 'بلّغ عن مشكلة في هذه النسخة',
    reportArtifactSent: 'تم الإبلاغ',
    reportArtifactTitle: 'الإبلاغ عن هذه النسخة؟',
    reportArtifactMsg: 'هذه النسخة مُشتركة: تُقدَّم لكل معلّم يطلب هذا الدرس. البلاغ يُرسَل لفريق المحتوى للمراجعة، وتبقى النسخة متاحة للآخرين حتى تتم الموافقة على سحبها. سيُنشأ لك بديل جديد الآن.',
    reportArtifactConfirm: 'إرسال البلاغ',
    reportArtifactDone: 'تم إرسال البلاغ، سيراجعه فريق المحتوى — ويجري إنشاء بديل لك',
    reportArtifactGone: 'هذه النسخة لم تعد في المشترك، ويجري إنشاء بديل',
    reportArtifactFailed: 'تعذّر إرسال البلاغ — لم يتغيّر شيء',
```
and the English block (~line 2584-2590):
```ts
    reportArtifactBtn: 'Report a problem with this version',
    reportArtifactSent: 'Reported',
    reportArtifactTitle: 'Report this version?',
    reportArtifactMsg: 'This version is shared — it is served to every teacher who asks for this lesson. Your report goes to the content team for review, and this version stays available to others until they approve withdrawing it. A replacement is generated for you now.',
    reportArtifactConfirm: 'Send report',
    reportArtifactDone: 'Report sent — the content team will review it. Generating a replacement for you',
    reportArtifactGone: 'That version was already out of the shared pool — generating a replacement',
    reportArtifactFailed: 'Could not send the report — nothing changed',
```

- [ ] **Step 4: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS. (No automated test possible here per `CLAUDE.md`: the mobile test runner only picks up `services/__tests__/**/*.test.ts`, and both changed files — a component and a service that imports `apiFetch`, which touches `expo-*` at module scope — fall outside that glob or can't load under bare `node --test` anyway. Verified manually in Task 7's run-through.)

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/ai/RemoteAIService.ts artifacts/mobile/components/ui/GeneratorResultActions.tsx artifacts/mobile/services/i18n.ts
git commit -m "feat(mobile): report a problem queues for review instead of retiring instantly"
```

---

## Task 7: Mobile admin UI — artifact-reports screen + dashboard link

**Files:**
- Create: `artifacts/mobile/app/admin/artifact-reports.tsx`
- Modify: `artifacts/mobile/app/admin/dashboard.tsx`

**Interfaces:**
- Consumes: `GET /moderation/artifact-reports`, `POST /moderation/artifact-reports/:id/resolve` (Task 5).

- [ ] **Step 1: Write the screen**

```tsx
// artifacts/mobile/app/admin/artifact-reports.tsx
/**
 * The AI-artifact report queue — where a teacher's "بلّغ عن مشكلة" is
 * actually acted on. Structurally mirrors admin/moderation.tsx, but for
 * `ai_artifacts` reports instead of chat reports: system_admin only (not
 * school_admin — content quality isn't a per-school concern), and the only
 * two outcomes are approve (retire the artifact) or dismiss.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiJson } from '@/services/apiClient';
import { confirm } from '@/services/confirm';
import { goBack } from '@/services/navigation';

const ACCENT = '#4F46E5';
const ADMIN_ROLES = ['system_admin'];

type Report = {
  id: string;
  status: 'open' | 'approved' | 'dismissed';
  createdAt: string;
  artifactId: string;
  kind: string;
  lessonRef: string;
  language: string;
  artifactRetiredAt: string | null;
  reporterId: string;
  reporterName: string;
};

type StatusFilter = 'open' | 'approved' | 'dismissed' | 'all';
const FILTERS: StatusFilter[] = ['open', 'approved', 'dismissed', 'all'];

export default function ArtifactReportsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);
  const ar = lang === 'ar';
  const topPad = insets.top + (insets.top === 0 ? 20 : 0);

  const [reports, setReports] = useState<Report[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [filter, setFilter] = useState<StatusFilter>('open');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (which: StatusFilter) => {
    const q = which === 'all' ? '' : `?status=${which}`;
    const res = await apiJson<{ reports: Report[]; openCount: number }>(`/moderation/artifact-reports${q}`);
    setReports(res.reports);
    setOpenCount(res.openCount);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    load(filter)
      .catch((e: unknown) =>
        setError((ar ? 'تعذّر تحميل البلاغات: ' : 'Failed to load reports: ') + (e instanceof Error ? e.message : String(e))),
      )
      .finally(() => setLoading(false));
  }, [isAdmin, filter, load, ar]);

  const resolve = async (report: Report, outcome: 'approved' | 'dismissed') => {
    setBusyId(report.id);
    setError('');
    try {
      await apiJson(`/moderation/artifact-reports/${report.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ outcome }),
      });
      await load(filter);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  const confirmAndResolve = async (report: Report, outcome: 'approved' | 'dismissed') => {
    const ok = await confirm({
      title:
        outcome === 'approved'
          ? ar
            ? 'سحب هذه النسخة من المشترك؟'
            : 'Withdraw this version from the shared pool?'
          : ar
            ? 'تجاهل هذا البلاغ؟'
            : 'Dismiss this report?',
      confirmLabel: ar ? 'تأكيد' : 'Confirm',
      cancelLabel: ar ? 'إلغاء' : 'Cancel',
      destructive: outcome === 'approved',
    });
    if (ok) await resolve(report, outcome);
  };

  if (authLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.mutedForeground} />
        <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 16, marginTop: 12, textAlign: 'center' }}>
          {ar ? 'هذه الصفحة للإدارة فقط' : 'This page is for admins only'}
        </Text>
        <Pressable onPress={() => goBack()} hitSlop={10} style={{ marginTop: 16 }}>
          <Text style={{ color: ACCENT, fontFamily: 'Cairo_600SemiBold' }}>{ar ? 'رجوع' : 'Go back'}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: ACCENT }]}>
        <Pressable onPress={() => goBack()} hitSlop={10} style={[styles.backBtn, { alignSelf: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color="#fff" />
        </Pressable>
        <Text style={{ color: '#fff', fontFamily: 'Cairo_700Bold', fontSize: 20, textAlign: isRTL ? 'right' : 'left' }}>
          {ar ? 'بلاغات المحتوى' : 'Content reports'}
        </Text>
        <Text style={{ color: '#fff', opacity: 0.85, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginTop: 4, textAlign: isRTL ? 'right' : 'left' }}>
          {openCount === 0 ? (ar ? 'لا بلاغات مفتوحة' : 'No open reports') : ar ? `${openCount} بلاغ مفتوح` : `${openCount} open`}
        </Text>
      </View>

      <View style={[styles.filters, { flexDirection: isRTL ? 'row-reverse' : 'row', borderBottomColor: colors.border }]}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            style={[styles.chip, { backgroundColor: filter === f ? ACCENT : colors.card, borderColor: colors.border }]}
          >
            <Text style={{ color: filter === f ? '#fff' : colors.mutedForeground, fontFamily: 'Cairo_500Medium', fontSize: 12 }}>
              {labelFor(f, ar)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {error ? (
          <Text style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: 13, lineHeight: 21, marginBottom: 12, textAlign: isRTL ? 'right' : 'left' }}>
            {error}
          </Text>
        ) : null}

        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 40 }} />
        ) : reports.length === 0 ? (
          <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center', marginTop: 40 }}>
            {ar ? 'لا شيء هنا.' : 'Nothing here.'}
          </Text>
        ) : (
          reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              colors={colors}
              ar={ar}
              isRTL={isRTL}
              busy={busyId === r.id}
              onApprove={() => confirmAndResolve(r, 'approved')}
              onDismiss={() => confirmAndResolve(r, 'dismissed')}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function labelFor(f: StatusFilter, ar: boolean): string {
  if (f === 'open') return ar ? 'مفتوحة' : 'Open';
  if (f === 'approved') return ar ? 'سُحبت' : 'Withdrawn';
  if (f === 'dismissed') return ar ? 'مرفوضة' : 'Dismissed';
  return ar ? 'الكل' : 'All';
}

function ReportCard({
  report, colors, ar, isRTL, busy, onApprove, onDismiss,
}: {
  report: Report;
  colors: ReturnType<typeof useColors>;
  ar: boolean;
  isRTL: boolean;
  busy: boolean;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const align = isRTL ? 'right' : 'left';
  const open = report.status === 'open';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, textAlign: align }}>
        {report.kind}
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 19 }}>
          {'  '}{report.lessonRef || (ar ? '— بلا درس محدد —' : '— no lesson —')} · {report.language}
        </Text>
      </Text>

      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, lineHeight: 19, marginTop: 4, textAlign: align }}>
        {ar ? 'أبلغ عنه: ' : 'Reported by '}{report.reporterName}
        {' · '}{new Date(report.createdAt).toLocaleString()}
      </Text>

      <View style={[styles.badges, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Badge text={statusLabel(report.status, ar)} color={open ? colors.warning : colors.mutedForeground} colors={colors} />
        {report.artifactRetiredAt ? <Badge text={ar ? 'مسحوبة' : 'Retired'} color={colors.info} colors={colors} /> : null}
      </View>

      {busy ? (
        <ActivityIndicator color={ACCENT} style={{ marginTop: 14 }} />
      ) : open ? (
        <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Action label={ar ? 'سحب النسخة' : 'Withdraw version'} onPress={onApprove} color={colors.destructive} colors={colors} />
          <Action label={ar ? 'تجاهل' : 'Dismiss'} onPress={onDismiss} color={colors.mutedForeground} colors={colors} />
        </View>
      ) : null}
    </View>
  );
}

function statusLabel(s: Report['status'], ar: boolean): string {
  if (s === 'open') return ar ? 'مفتوح' : 'Open';
  if (s === 'approved') return ar ? 'سُحبت' : 'Withdrawn';
  return ar ? 'مرفوض' : 'Dismissed';
}

function Badge({ text, color, colors }: { text: string; color: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.badge, { borderColor: color, borderRadius: colors.radius }]}>
      <Text style={{ color, fontFamily: 'Cairo_500Medium', fontSize: 11 }}>{text}</Text>
    </View>
  );
}

function Action({ label, onPress, color, colors }: {
  label: string; onPress: () => void; color: string; colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.action, { borderColor: color, borderRadius: colors.radius, opacity: pressed ? 0.6 : 1 }]}
    >
      <Text style={{ color, fontFamily: 'Cairo_600SemiBold', fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { padding: 4, marginBottom: 8 },
  filters: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  card: { borderWidth: 1, padding: 14, marginBottom: 12 },
  badges: { gap: 6, marginTop: 10, flexWrap: 'wrap' },
  badge: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  actions: { gap: 8, marginTop: 14, flexWrap: 'wrap' },
  action: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
});
```

- [ ] **Step 2: Add the dashboard nav card**

In `artifacts/mobile/app/admin/dashboard.tsx`, right after the existing "Moderation" `Pressable` card (the one navigating to `/admin/moderation`), add:

```tsx
            {/* Content reports — same visibility tier as message moderation,
                just for AI artifacts instead of chat messages. */}
            <Pressable
              onPress={() => router.push('/admin/artifact-reports' as any)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  marginHorizontal: 20,
                  marginBottom: 16,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  gap: 12,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="document-text-outline" size={20} color={ACCENT} />
              <Text style={{ color: colors.foreground, fontFamily: 'Cairo_600SemiBold', fontSize: 14, flex: 1, textAlign: isRTL ? 'right' : 'left' }}>
                {lang === 'ar' ? 'بلاغات المحتوى' : 'Content reports'}
              </Text>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.mutedForeground} />
            </Pressable>
```

This dashboard card is visible to `school_admin` too (the page's own gate is `ADMIN_ROLES = ['school_admin', 'system_admin']`), but the screen it links to immediately gates on `system_admin` alone and shows the "admins only"-style refusal to a `school_admin` — same two-tier pattern the message-moderation card already relies on (page-level gate broader than some individual admin tools).

- [ ] **Step 3: Typecheck**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual run-through**

Per the `run` skill / `LOCAL_SETUP.md`: `pnpm run dev:mobile:web`, sign in as a `system_admin` account (or temporarily set a dev user's `role` to `system_admin` in the local DB), open `/admin/dashboard`, tap "بلاغات المحتوى", confirm the list loads (empty state if no reports yet), then from another account report an artifact via a generator screen and confirm it appears with status "مفتوح" and that "سحب النسخة" sets `aiArtifacts.retiredAt` (check via `SELECT retired_at FROM ai_artifacts WHERE id = '<artifactId>'`).

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/app/admin/artifact-reports.tsx artifacts/mobile/app/admin/dashboard.tsx
git commit -m "feat(mobile): admin screen for AI-artifact content reports"
```

---

## Task 8: Rollout — schema push

**Files:** none (operational step)

- [ ] **Step 1: Push the new table to production**

After this branch is merged to `main`:
```bash
pnpm --filter @workspace/db run push
```
Run against the production `DATABASE_URL` per `docs/deploying.md` / `STATUS.md`'s standing process — this is the manual step nothing else runs for you.

- [ ] **Step 2: Verify**

```bash
pnpm --filter @workspace/db run verify-schema
```
Expected: `ai_artifact_reports` reports `ok`, columns included.

- [ ] **Step 3: PR description**

Include `schema-push: done` in the pull request body — CI's schema-check gate on `lib/db/src/schema` changes requires this line to pass.

---

## Self-Review Notes

- **Spec coverage:** every section of the design doc maps to a task — data model → Task 1; report endpoint → Tasks 2, 4; admin queue → Task 5; notifications → Task 3; client → Task 6; admin UI → Task 7; rollout → Task 8.
- **Placeholder scan:** no TBD/TODO; every step has real code, not a description of code.
- **Type consistency:** `reportVariant`'s `ReportOutcome` shape is used identically in Task 2 (definition), Task 4 (route), — `retireVariant`'s existing `boolean` return is left untouched and reused as-is in Task 5. `ArtifactReportStatus` values (`open`/`approved`/`dismissed`) are the same three strings across Task 1 (schema), Task 5 (route + `ARTIFACT_REPORT_STATUSES`), and Task 7 (mobile `Report['status']`, `FILTERS`).
- **Known gap, deliberate:** no automated test touches `reportVariant`, `notifyAdminsOfArtifactReport`, or the mobile changes — each task above explains why against this repo's actual existing test coverage for that layer (DB-touching lib functions and RN components have zero precedent of unit tests here). The one new automated test (Task 5) targets exactly the piece this repo *does* systematically test: route mounting/auth-gating, via the existing `mountOrder.test.ts` pattern.
