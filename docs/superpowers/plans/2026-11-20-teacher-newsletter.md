# Teacher Newsletter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a `system_admin` send a monthly "what's new" email to teachers, drafted from the «ما الجديد» notes, and only after a test copy of the exact same text.

**Architecture:** A new admin router (`routes/adminNewsletter.ts`) reuses the existing Resend batch sender (`sendBroadcast`) and the per-address unsubscribe list. Two new owner-only tables record each issue and who received it. The draft is built in the app, where the notes and their translations live, and posted to the API as plain text.

**Tech Stack:** Express 5, Drizzle (Postgres), `node --test`, Expo / React Native (web build), Resend REST API.

**Spec:** `docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md`

## Global Constraints

- **Nothing sends mail without a signed-in `system_admin` pressing a button.** No cron, workflow, deploy step, script or test may call the send route against a real mail provider. Do not add any.
- **No real email during this work.** Never set `RESEND_API_KEY` in a test, a shell or an env file. Tests point the sender at a local stub with `RESEND_API_URL`.
- A send is accepted only for text whose hash matches a stored test less than 24 hours old; otherwise `409 not-tested` or `409 test-expired`.
- Recipients: `role` in `teacher`, `school_admin`; `email` present and valid; `emailVerified` true; `suspendedAt` null; one per address; minus `email_suppressions`.
- Subject 3–150 characters, body 10–10,000 characters.
- Teacher footer, exact text: «تصلك هذه الرسالة لأن لديك حساب معلّم في إقرأ.» / "You received this because you have a teacher account on Iqrra."
- Latin product name is **Iqrra**; Arabic brand is **«إقرأ»**.
- Schema changes are migrations only (`pnpm --filter @workspace/db run generate`); never `push`.
- No `sed -i` / `perl -pi` on source; use the Edit tool. API files loaded by `node --test` import with explicit `.ts`.
- Never read or print a `.env` file.
- `git add` named paths only, never `-A` or `.`.
- Commit messages end with the two attribution lines the session gives (Co-Authored-By and Claude-Session); no model name anywhere else.

## Two deliberate differences from the spec

1. The spec says the sending routes use the existing `admin-broadcasts` rate limiter. That limiter is a private constant in `routes/admin.ts`. The new router gets its own limiter with the same numbers (20 an hour per admin), named `admin-newsletter`.
2. `newsletter_issues` gains one column the spec does not list, `sending_at`, so two simultaneous sends of one issue cannot both mail everyone (the spec promises nobody gets an issue twice).

## File map

| File | Responsibility |
| --- | --- |
| `artifacts/api-server/src/lib/siteMail.ts` (modify) | `renderBroadcastBody`: direction per paragraph; export the text limits |
| `artifacts/api-server/src/lib/email.ts` (modify) | `sendBroadcast`: link builder receives the recipient, footer is an argument, provider URL overridable |
| `artifacts/api-server/src/routes/admin.ts` (modify) | two call sites adapt to the new `sendBroadcast` signature |
| `lib/db/src/schema/newsletter.ts` (create) | `newsletter_issues`, `newsletter_sends` |
| `lib/db/migrations/0031_*.sql` (generated + 4 lines) | the two tables, RLS on, no app-role grant |
| `artifacts/api-server/src/lib/newsletter.ts` (create) | pure rules: recipients, hash, parse, approval decision, teacher link and footer |
| `artifacts/api-server/src/routes/adminNewsletter.ts` (create) | the three routes |
| `artifacts/api-server/src/test-support/resendStub.ts` (create) | a local stand-in for Resend's batch endpoint |
| `artifacts/mobile/services/newsletterDraft.ts` (create) | pure draft builder |
| `artifacts/mobile/app/admin/newsletter.tsx` (create) | the admin screen |
| `artifacts/mobile/app/admin/dashboard.tsx` (modify) | link to the screen |
| `artifacts/mobile/constants/legal.ts` (modify) | one sentence, new version |

Run API tests from `artifacts/api-server`, mobile tests from `artifacts/mobile`. The DB-backed API tests (`*.db.test.ts`) need the built bundle and `TEST_DATABASE_URL` pointing at a throwaway Postgres; without one they skip locally and CI runs them (`REQUIRE_DB_TESTS=true`). Say in the PR body which ones you could not run.

---

### Task 1: Email body direction per paragraph

**Files:**
- Modify: `artifacts/api-server/src/lib/siteMail.ts` (`renderBroadcastBody`, and the two `const` limits above `parseBroadcast`)
- Test: `artifacts/api-server/src/lib/__tests__/siteMail.test.ts`

**Interfaces:**
- Produces: `renderBroadcastBody(text: string): string` (unchanged signature); `SUBJECT_MAX = 150`, `BODY_MAX = 10_000` now exported.

- [ ] **Step 1: Write the failing test**

Add inside `describe("renderBroadcastBody", …)` in `siteMail.test.ts`:

```ts
  it("sets direction per paragraph, so an English block under an Arabic one reads left to right", () => {
    const html = renderBroadcastBody("مرحبًا بكم في إقرأ\n\nHello from Iqrra");
    const dirs = [...html.matchAll(/<p dir="(rtl|ltr)"/g)].map(m => m[1]);
    assert.deepEqual(dirs, ["rtl", "ltr"]);
    assert.doesNotMatch(html, /<div dir=/, "the wrapper carries no direction of its own");
  });
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/siteMail.test.ts`
Expected: FAIL in the new test (`dirs` is `[]`).

- [ ] **Step 3: Implement**

In `siteMail.ts`, change `const SUBJECT_MAX = 150;` and `const BODY_MAX = 10_000;` to `export const`. Then replace the tail of `renderBroadcastBody` (from `const paragraphs =` to the `return`) with:

```ts
  const isArabic = (s: string) => /[؀-ۿ]/.test(s);
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p dir="${isArabic(p) ? "rtl" : "ltr"}" style="margin:0 0 14px;">${p.split("\n").map(inline).join("<br />")}</p>`)
    .join("");
  return `<div style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;">${paragraphs}</div>`;
```

Update the function's doc comment's last sentence to: "Direction follows each paragraph's language: any Arabic letter → RTL."

- [ ] **Step 4: Run the file and see it pass**

Run: `node --experimental-strip-types --test src/lib/__tests__/siteMail.test.ts`
Expected: PASS, including the older "sets direction from the language" test.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/siteMail.ts artifacts/api-server/src/lib/__tests__/siteMail.test.ts
git commit -m "Broadcast mail: text direction per paragraph"
```

---

### Task 2: `sendBroadcast` takes the recipient, a footer, and a provider URL

**Files:**
- Modify: `artifacts/api-server/src/lib/email.ts` (`sendBroadcast`, about lines 380–445)
- Modify: `artifacts/api-server/src/routes/admin.ts` (the two `sendBroadcast(` calls in `POST /admin/broadcasts`)
- Test: `artifacts/api-server/src/lib/__tests__/broadcast.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type BroadcastRecipient = { id: string; email: string };
  export type BroadcastFooter = { ar: string; en: string };
  export async function sendBroadcast(
    recipients: readonly BroadcastRecipient[],
    subject: string,
    bodyHtml: string,
    unsubscribeUrl: (r: BroadcastRecipient) => string,
    footer?: BroadcastFooter,            // default: the waitlist sentence
  ): Promise<{ sent: string[]; failed: string[]; skipped: string[] }>
  ```
  `footer` strings are trusted constants written in code, never user input. `RESEND_API_URL` (env, optional) replaces `https://api.resend.com` for the batch call.

- [ ] **Step 1: Update the existing helper and add failing tests**

In `broadcast.test.ts` change the helper line to:

```ts
const unsub = (r: { id: string }) => `https://api.test/unsub?id=${r.id}`;
```

Add to the `afterEach` body: `delete process.env.RESEND_API_URL;`

Add inside `describe("sendBroadcast", …)`:

```ts
  it("hands the whole recipient to the link builder and prints the footer it was given", async () => {
    let batch: { html: string; headers: Record<string, string> }[] = [];
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      batch = JSON.parse(String(init?.body));
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    await sendBroadcast(
      [{ id: "u1", email: "t@school.jo" }],
      "Hello",
      "<p>x</p>",
      r => `https://api.test/u?e=${encodeURIComponent(r.email)}`,
      { ar: "سطر المعلّم", en: "Teacher line" },
    );
    assert.match(batch[0]!.html, /سطر المعلّم/);
    assert.match(batch[0]!.html, /Teacher line/);
    assert.doesNotMatch(batch[0]!.html, /iqrra\.com\./, "the waitlist sentence is gone");
    assert.equal(batch[0]!.headers["List-Unsubscribe"], "<https://api.test/u?e=t%40school.jo>");
  });

  it("keeps the waitlist sentence when no footer is given", async () => {
    let html = "";
    globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
      html = JSON.parse(String(init?.body))[0].html;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    await sendBroadcast(people(1), "s", "<p>x</p>", unsub);
    assert.match(html, /You received this because you signed up for Iqrra at iqrra\.com\./);
  });

  it("calls RESEND_API_URL when it is set", async () => {
    let url = "";
    globalThis.fetch = (async (u: unknown) => {
      url = String(u);
      return new Response("{}", { status: 200 });
    }) as typeof fetch;
    process.env.RESEND_API_URL = "http://127.0.0.1:9/";
    await sendBroadcast(people(1), "s", "<p>x</p>", unsub);
    assert.equal(url, "http://127.0.0.1:9/emails/batch");
  });
```

- [ ] **Step 2: Run and see them fail**

Run: `node --experimental-strip-types --test src/lib/__tests__/broadcast.test.ts`
Expected: FAIL (the first new test finds no «سطر المعلّم»; the third gets `https://api.resend.com/emails/batch`).

- [ ] **Step 3: Implement in `email.ts`**

Above `sendBroadcast` add:

```ts
export type BroadcastRecipient = { id: string; email: string };
/** The "why you got this" sentence under a broadcast. Trusted text written in code, never user input. */
export type BroadcastFooter = { ar: string; en: string };
const WAITLIST_FOOTER: BroadcastFooter = {
  ar: "تلقّيت هذه الرسالة لأنك سجّلت اهتمامك بتطبيق إقرأ على iqrra.com.",
  en: "You received this because you signed up for Iqrra at iqrra.com.",
};
/** Resend's origin. Overridden only by tests, which point it at a local stub (test-support/resendStub.ts). */
const resendBase = () => (process.env.RESEND_API_URL || "https://api.resend.com").replace(/\/+$/, "");
```

Change the signature to:

```ts
export async function sendBroadcast(
  recipients: readonly BroadcastRecipient[],
  subject: string,
  bodyHtml: string,
  unsubscribeUrl: (r: BroadcastRecipient) => string,
  footer: BroadcastFooter = WAITLIST_FOOTER,
): Promise<{ sent: string[]; failed: string[]; skipped: string[] }> {
```

Inside the loop: `fetch("https://api.resend.com/emails/batch", …)` becomes `` fetch(`${resendBase()}/emails/batch`, …) ``; `const url = unsubscribeUrl(r.id);` becomes `const url = unsubscribeUrl(r);`; and the footer block becomes:

```ts
                `<div style="font-size:12px;color:#94A3B8;line-height:1.7;">
                  <div dir="rtl">${footer.ar} <a href="${url}" style="color:#94A3B8;">إلغاء الاشتراك</a></div>
                  <div dir="ltr">${footer.en} <a href="${url}" style="color:#94A3B8;">Unsubscribe</a></div>
                </div>`,
```

- [ ] **Step 4: Adapt the two callers in `routes/admin.ts`**

In `POST /admin/broadcasts`, both calls pass `unsubscribeUrl` as the fourth argument. Change each to `(r) => unsubscribeUrl(r.id)`:

```ts
      const test = await sendBroadcast([{ id: me.id, email: me.email }], `[تجريبي] ${subject}`, html, (r) => unsubscribeUrl(r.id));
```
```ts
    const result = await sendBroadcast(recipients, subject, html, (r) => unsubscribeUrl(r.id));
```

Run `grep -rn "sendBroadcast(" artifacts/api-server/src --include=*.ts` and confirm no other caller passes an id-taking function.

- [ ] **Step 5: Run tests and typecheck**

Run: `node --experimental-strip-types --test src/lib/__tests__/broadcast.test.ts && pnpm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src/lib/email.ts artifacts/api-server/src/routes/admin.ts artifacts/api-server/src/lib/__tests__/broadcast.test.ts
git commit -m "sendBroadcast: recipient-aware link, footer argument, overridable provider URL"
```

---

### Task 3: Tables `newsletter_issues` and `newsletter_sends`

**Files:**
- Create: `lib/db/src/schema/newsletter.ts`
- Modify: `lib/db/src/schema/index.ts` (one export, after the `usage` export)
- Create: `lib/db/migrations/0031_<generated-name>.sql` (generated, then four lines appended)
- Modify: `lib/db/src/__tests__/rlsCoverage.test.ts` (the `LOCKED` list)

**Interfaces:**
- Produces, from `@workspace/db`: `newsletterIssues` (`id`, `subject`, `body`, `contentHash`, `createdBy`, `testedAt`, `sendingAt`, `sentAt`) and `newsletterSends` (`issueId`, `userId`, `sentAt`).

- [ ] **Step 1: Write the schema**

`lib/db/src/schema/newsletter.ts`:

```ts
import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * The teacher newsletter (docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md).
 *
 * `newsletter_issues` — one row per issue. A row is written when a system admin sends
 * themselves a test copy (`tested_at`, with a hash of the subject and body); the send route
 * accepts only text whose hash matches a test less than 24 hours old. `sent_at` is null
 * until the first teacher has been mailed; at most one row is unsent, because a new test
 * replaces it. `sending_at` is a short claim taken while a send runs, so two requests for
 * one issue cannot both mail everyone.
 *
 * `newsletter_sends` — who was handed to the mail provider for an issue. The primary key
 * is what makes a second delivery of one issue to one teacher impossible, and a retry
 * after a failed batch reaches only those with no row.
 *
 * Owner connection only: RLS on, no policy and no grant to the app role, like
 * `email_suppressions`. Only api-server routes/adminNewsletter.ts reads or writes them.
 */
export const newsletterIssues = pgTable("newsletter_issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  subject: text("subject").notNull(),
  body: text("body").notNull(), // plain text, as tested
  contentHash: text("content_hash").notNull(), // api-server lib/newsletter.ts newsletterHash
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  testedAt: timestamp("tested_at", { withTimezone: true }).defaultNow().notNull(),
  sendingAt: timestamp("sending_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const newsletterSends = pgTable(
  "newsletter_sends",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => newsletterIssues.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.userId] })],
);

export type NewsletterIssue = typeof newsletterIssues.$inferSelect;
```

In `lib/db/src/schema/index.ts`, after `export * from "./usage";` add:

```ts
// The teacher newsletter: issues and who received each — see newsletter.ts
export * from "./newsletter";
```

- [ ] **Step 2: Generate the migration**

Run from the repo root: `pnpm --filter @workspace/db run generate`
Expected: one new file `lib/db/migrations/0031_<name>.sql` with two `CREATE TABLE` statements and three foreign keys, and updated files under `lib/db/migrations/meta/`. It must contain no `DROP`, `RENAME` or `ALTER … SET NOT NULL`.

- [ ] **Step 3: Lock the tables**

Append to the end of the generated `.sql` file (same form as `0020_parched_zaladane.sql`):

```sql
--> statement-breakpoint
ALTER TABLE "newsletter_issues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "newsletter_sends" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Owner connection only: no policy and no grant, like email_suppressions (0020). Only a system admin's
-- newsletter routes touch these, through systemDb.
REVOKE ALL ON "newsletter_issues" FROM iqraa_app;--> statement-breakpoint
REVOKE ALL ON "newsletter_sends" FROM iqraa_app;
```

- [ ] **Step 4: Classify the tables**

In `lib/db/src/__tests__/rlsCoverage.test.ts`, the `LOCKED` list becomes:

```ts
const LOCKED = ["email_suppressions", "email_verification_tokens", "guardian_consents", "newsletter_issues", "newsletter_sends", "password_reset_tokens", "refresh_tokens"] as const;
```

- [ ] **Step 5: Verify**

Run: `pnpm run typecheck`
Expected: no errors.

If a throwaway Postgres is available, also run (from a checkout with no repo-root `.env`):
`RLS_TEST_DATABASE_URL=<throwaway> pnpm --filter @workspace/db test`
Expected: `row-level security covers every table` passes. Without a database, CI's `row-level security` and `migrations match schema` jobs are the check; say so in the PR body.

- [ ] **Step 6: Commit**

```bash
git add lib/db/src/schema/newsletter.ts lib/db/src/schema/index.ts lib/db/migrations lib/db/src/__tests__/rlsCoverage.test.ts
git diff --cached --stat
git commit -m "Schema: newsletter issues and sends (owner-only tables)"
```

Check the `--stat` output lists only the schema file, the index, the new migration, `meta/` files and the RLS test.

---

### Task 4: The newsletter rules (pure)

**Files:**
- Create: `artifacts/api-server/src/lib/newsletter.ts`
- Test: `artifacts/api-server/src/lib/__tests__/newsletter.test.ts`

**Interfaces:**
- Consumes: `SUBJECT_MAX`, `BODY_MAX` from `./siteMail.ts` (Task 1); `isValidEmailAddress` from `./emailAddress.ts`; `emailUnsubscribeUrl` from `./emailUnsubscribe.ts`; `BroadcastFooter` type from `./email.ts` (Task 2).
- Produces:
  ```ts
  export const NEWSLETTER_ROLES: readonly ["teacher", "school_admin"];
  export const TEST_MAX_AGE_MS: number; // 24 h
  export const TEACHER_FOOTER: { ar: string; en: string };
  export type TeacherRow = { id: string; email: string | null; role: string; emailVerified: boolean; suspendedAt: Date | null };
  export function pickTeacherRecipients(rows: readonly TeacherRow[]): { id: string; email: string }[];
  export function newsletterHash(subject: string, text: string): string;
  export function parseNewsletter(body: unknown): { subject: string; text: string } | { error: "subject" | "body" };
  export type SendDecision = "ok" | "not-tested" | "test-expired";
  export function sendDecision(issue: { contentHash: string; testedAt: Date } | null | undefined, subject: string, text: string, now?: Date): SendDecision;
  export function teacherUnsubscribeUrl(r: { email: string }): string;
  ```

- [ ] **Step 1: Write the failing tests**

`artifacts/api-server/src/lib/__tests__/newsletter.test.ts`:

```ts
/**
 * The teacher newsletter's rules (docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md):
 * who may receive it, and that a send is refused unless the exact text was test-sent in the
 * last 24 hours. Pure: no database, no mail.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  newsletterHash,
  parseNewsletter,
  pickTeacherRecipients,
  sendDecision,
  teacherUnsubscribeUrl,
  TEST_MAX_AGE_MS,
  type TeacherRow,
} from "../newsletter.ts";
import { readEmailUnsubscribeToken } from "../emailUnsubscribe.ts";

let n = 0;
const row = (over: Partial<TeacherRow> = {}): TeacherRow => ({
  id: `id-${++n}`,
  email: `t${n}@school.jo`,
  role: "teacher",
  emailVerified: true,
  suspendedAt: null,
  ...over,
});

describe("pickTeacherRecipients", () => {
  it("takes verified, unsuspended teachers and school admins with a valid address", () => {
    const keep = row();
    const principal = row({ role: "school_admin" });
    const out = pickTeacherRecipients([
      keep,
      principal,
      row({ role: "student" }),
      row({ role: "parent" }),
      row({ role: "system_admin" }),
      row({ emailVerified: false }),
      row({ suspendedAt: new Date() }),
      row({ email: null }),
      row({ email: "not-an-address" }),
    ]);
    assert.deepEqual(out, [
      { id: keep.id, email: keep.email },
      { id: principal.id, email: principal.email },
    ]);
  });

  it("sends one copy to an address, whatever its case", () => {
    const first = row({ email: "Same@School.jo" });
    const out = pickTeacherRecipients([first, row({ email: "same@school.jo" })]);
    assert.deepEqual(out, [{ id: first.id, email: "Same@School.jo" }]);
  });
});

describe("parseNewsletter", () => {
  it("trims and returns the text", () => {
    assert.deepEqual(parseNewsletter({ subject: "  Hello  ", body: "  ten chars!  " }), { subject: "Hello", text: "ten chars!" });
  });
  it("refuses a short or missing subject or body", () => {
    assert.deepEqual(parseNewsletter({ subject: "ab", body: "long enough body" }), { error: "subject" });
    assert.deepEqual(parseNewsletter({ subject: "Hello", body: "short" }), { error: "body" });
    assert.deepEqual(parseNewsletter(null), { error: "subject" });
    assert.deepEqual(parseNewsletter({ subject: "x".repeat(151), body: "long enough body" }), { error: "subject" });
    assert.deepEqual(parseNewsletter({ subject: "Hello", body: "x".repeat(10_001) }), { error: "body" });
  });
});

describe("sendDecision", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const tested = (ago: number, subject = "Hello", text = "The body text") => ({
    contentHash: newsletterHash(subject, text),
    testedAt: new Date(now.getTime() - ago),
  });

  it("accepts the text that was tested", () => {
    assert.equal(sendDecision(tested(60_000), "Hello", "The body text", now), "ok");
  });
  it("refuses when nothing was tested", () => {
    assert.equal(sendDecision(null, "Hello", "The body text", now), "not-tested");
    assert.equal(sendDecision(undefined, "Hello", "The body text", now), "not-tested");
  });
  it("refuses a body or a subject edited after the test, even by one character", () => {
    assert.equal(sendDecision(tested(60_000), "Hello", "The body text.", now), "not-tested");
    assert.equal(sendDecision(tested(60_000), "Hello!", "The body text", now), "not-tested");
  });
  it("refuses a test older than 24 hours", () => {
    assert.equal(sendDecision(tested(TEST_MAX_AGE_MS + 1), "Hello", "The body text", now), "test-expired");
    assert.equal(sendDecision(tested(TEST_MAX_AGE_MS - 1), "Hello", "The body text", now), "ok");
  });
  it("does not confuse where the subject ends and the body begins", () => {
    assert.notEqual(newsletterHash("ab", "c long enough"), newsletterHash("a", "bc long enough"));
  });
});

describe("teacherUnsubscribeUrl", () => {
  it("is the per-address unsubscribe link", () => {
    const before = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "s".repeat(32);
    try {
      const url = teacherUnsubscribeUrl({ email: "T@School.jo" });
      const token = new URL(url).searchParams.get("t");
      assert.match(url, /\/api\/email\/unsubscribe\?t=/);
      assert.equal(readEmailUnsubscribeToken(token), "t@school.jo");
    } finally {
      if (before === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = before;
    }
  });
});
```

- [ ] **Step 2: Run and see it fail**

Run: `node --experimental-strip-types --test src/lib/__tests__/newsletter.test.ts`
Expected: FAIL, cannot find module `../newsletter.ts`.

- [ ] **Step 3: Implement**

`artifacts/api-server/src/lib/newsletter.ts`:

```ts
/**
 * The rules behind the teacher newsletter (routes/adminNewsletter.ts; spec
 * docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md): who receives
 * an issue, and when a send is allowed. Pure on purpose, like siteMail.ts — the
 * route imports `@workspace/db`, which cannot load under `node --test`.
 *
 * The approval rule lives here: an issue goes out only if the exact subject and
 * body were sent to the admin as a test less than 24 hours ago. The route stores
 * a hash at test time and asks `sendDecision` at send time.
 */
import { createHash } from "node:crypto";
import type { BroadcastFooter } from "./email.ts";
import { isValidEmailAddress } from "./emailAddress.ts";
import { emailUnsubscribeUrl } from "./emailUnsubscribe.ts";
import { BODY_MAX, SUBJECT_MAX } from "./siteMail.ts";

/** Teacher accounts. A system admin is the sender, and gets the test copy instead. */
export const NEWSLETTER_ROLES = ["teacher", "school_admin"] as const;

export const TEST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const TEACHER_FOOTER: BroadcastFooter = {
  ar: "تصلك هذه الرسالة لأن لديك حساب معلّم في إقرأ.",
  en: "You received this because you have a teacher account on Iqrra.",
};

export type TeacherRow = {
  id: string;
  email: string | null;
  role: string;
  emailVerified: boolean;
  suspendedAt: Date | null;
};

/** One recipient per address: a verified, unsuspended teacher account with a usable address. */
export function pickTeacherRecipients(rows: readonly TeacherRow[]): { id: string; email: string }[] {
  const seen = new Set<string>();
  const out: { id: string; email: string }[] = [];
  for (const r of rows) {
    if (!(NEWSLETTER_ROLES as readonly string[]).includes(r.role)) continue;
    if (!r.emailVerified || r.suspendedAt) continue;
    const email = (r.email ?? "").trim();
    if (!isValidEmailAddress(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: r.id, email });
  }
  return out;
}

/** JSON of the pair, so "ab"+"c" and "a"+"bc" cannot collide. */
export function newsletterHash(subject: string, text: string): string {
  return createHash("sha256").update(JSON.stringify([subject, text])).digest("hex");
}

/** `{subject, body}` from the admin screen, trimmed. Same limits as the waitlist mail. */
export function parseNewsletter(body: unknown): { subject: string; text: string } | { error: "subject" | "body" } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const subject = typeof b.subject === "string" ? b.subject.trim() : "";
  const text = typeof b.body === "string" ? b.body.trim() : "";
  if (subject.length < 3 || subject.length > SUBJECT_MAX) return { error: "subject" };
  if (text.length < 10 || text.length > BODY_MAX) return { error: "body" };
  return { subject, text };
}

export type SendDecision = "ok" | "not-tested" | "test-expired";

export function sendDecision(
  issue: { contentHash: string; testedAt: Date } | null | undefined,
  subject: string,
  text: string,
  now: Date = new Date(),
): SendDecision {
  if (!issue || issue.contentHash !== newsletterHash(subject, text)) return "not-tested";
  if (now.getTime() - issue.testedAt.getTime() > TEST_MAX_AGE_MS) return "test-expired";
  return "ok";
}

/** The per-address link (lib/emailUnsubscribe.ts). The API refuses to boot without SESSION_SECRET, so null is a bug. */
export function teacherUnsubscribeUrl(r: { email: string }): string {
  const url = emailUnsubscribeUrl(r.email);
  if (!url) throw new Error("SESSION_SECRET not set — cannot sign an unsubscribe link");
  return url;
}
```

If `email.ts` cannot be imported for its type under `node --test` (it loads the logger), `import type` is erased by `--experimental-strip-types` and is safe. If the test still fails on that import, declare `type BroadcastFooter = { ar: string; en: string }` locally instead and delete the import.

- [ ] **Step 4: Run and see it pass**

Run: `node --experimental-strip-types --test src/lib/__tests__/newsletter.test.ts`
Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/newsletter.ts artifacts/api-server/src/lib/__tests__/newsletter.test.ts
git commit -m "Newsletter rules: recipients and the test-before-send decision"
```

---

### Task 5: The three admin routes

**Files:**
- Create: `artifacts/api-server/src/test-support/resendStub.ts`
- Create: `artifacts/api-server/src/routes/adminNewsletter.ts`
- Modify: `artifacts/api-server/src/routes/index.ts` (import, and one `router.use` after `router.use(adminInsightsRouter);`)
- Modify: `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts` (`ALLOWED`)
- Modify: `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts` (two route lists, about lines 936–945)
- Test: `artifacts/api-server/src/routes/__tests__/adminNewsletter.db.test.ts`

**Interfaces:**
- Consumes: everything Task 4 produces; `sendBroadcast` (Task 2); `renderBroadcastBody` (Task 1); `newsletterIssues`, `newsletterSends` (Task 3); `suppressedAmong` from `../lib/emailSuppression.ts`; `UUID` from `../lib/adminMetrics.js`.
- Produces (all `system_admin` only):
  - `GET /admin/newsletter` → `{ lastSentAt: string | null, eligible: number, unsubscribed: number }`
  - `POST /admin/newsletter/test` `{subject, body}` → `200 { issueId, sentTo }`; `400 {error:"subject"|"body"|"no-email"}`; `409 {error:"unsubscribed"}`; `502 {error:"send"}`
  - `POST /admin/newsletter/send` `{issueId, subject, body}` → `200 { sent, failed, skipped }`; `400 {error:"subject"|"body"|"issueId"}`; `409 {error:"not-tested"|"test-expired"|"sending"}`; `500 {error:"sent-not-recorded", sent}`

- [ ] **Step 1: Write the Resend stub**

`artifacts/api-server/src/test-support/resendStub.ts`:

```ts
/**
 * A stand-in for Resend's batch endpoint, running in the test process. The built
 * server (a child process — startServer.ts) is pointed at it with RESEND_API_URL
 * and a fake RESEND_API_KEY, so a DB test can assert exactly who would have been
 * mailed, and what, without any mail leaving the machine.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

export interface StubMail {
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;
}

export interface ResendStub {
  /** e.g. http://127.0.0.1:41234 — the value for RESEND_API_URL. */
  url: string;
  /** Every mail accepted since the last clear(), in arrival order. */
  mails(): StubMail[];
  clear(): void;
  /** Refuse the next request with this status (default 500) and record nothing from it. */
  failNext(status?: number): void;
  close(): Promise<void>;
}

export async function startResendStub(): Promise<ResendStub> {
  let received: StubMail[] = [];
  let failStatus: number | null = null;

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", chunk => {
      raw += String(chunk);
    });
    req.on("end", () => {
      if (failStatus !== null) {
        const status = failStatus;
        failStatus = null;
        res.writeHead(status, { "Content-Type": "text/plain" });
        res.end("stub failure");
        return;
      }
      if (req.method !== "POST" || req.url !== "/emails/batch") {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not the batch endpoint");
        return;
      }
      try {
        received.push(...(JSON.parse(raw) as StubMail[]));
      } catch {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("bad json");
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: [] }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    mails: () => [...received],
    clear() {
      received = [];
    },
    failNext(status = 500) {
      failStatus = status;
    },
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}
```

- [ ] **Step 2: Write the failing DB test**

`artifacts/api-server/src/routes/__tests__/adminNewsletter.db.test.ts`:

```ts
/**
 * The teacher newsletter routes, against a real database through the built bundle, with
 * Resend replaced by a local stub (no mail leaves the machine).
 *
 * What this guards: only a system admin may use them; an issue cannot be sent unless that
 * exact text was test-sent first, and not after 24 hours; a test reaches the admin alone;
 * a send reaches verified, unsuspended teachers and school admins who have not unsubscribed,
 * and nobody else; a second send of one issue mails nobody again; and a refused batch leaves
 * its teachers eligible for the retry.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { startResendStub, type ResendStub } from "../../test-support/resendStub.ts";
import { call } from "../../test-support/http.ts";

describeDb("teacher newsletter", () => {
  let db: TestDb;
  let server: TestServer;
  let stub: ResendStub;
  let admin: string;
  let principal: string;
  let ayla: string;

  const SUBJECT = "جديد إقرأ هذا الشهر · What's new in Iqrra";
  const BODY = "شارك موادك برابط\nhttps://app.iqrra.com/ai-tools/lesson-plan\n\nShare your materials by link";
  const mail = (name: string) => `${name.toLowerCase()}@example.test`;

  const addUser = async (name: string, role: string, extra: Record<string, unknown> = {}): Promise<string> => {
    const cols = ["first_name", "last_name", "role", "email", "email_verified", ...Object.keys(extra)];
    const vals = [name, "Test", role, mail(name), true, ...Object.values(extra)];
    // A key in `extra` that repeats a base column overrides it: keep the last value per column.
    const merged = new Map<string, unknown>();
    cols.forEach((c, i) => merged.set(c, vals[i]));
    const names = [...merged.keys()];
    const ph = names.map((_, i) => `$${i + 1}`).join(", ");
    return (
      await db.pool.query<{ id: string }>(`INSERT INTO users (${names.join(", ")}) VALUES (${ph}) RETURNING id`, [...merged.values()])
    ).rows[0]!.id;
  };
  const test = (subject = SUBJECT, body = BODY) => call(server, "POST", "/admin/newsletter/test", admin, { subject, body });
  const send = (issueId: string, subject = SUBJECT, body = BODY) =>
    call(server, "POST", "/admin/newsletter/send", admin, { issueId, subject, body });
  const recipients = () => stub.mails().map(m => m.to).sort();

  before(async () => {
    db = await setupTestDb();
    stub = await startResendStub();
    server = await startServer({
      databaseUrl: db.url,
      env: { RESEND_API_KEY: "re_test_key", RESEND_API_URL: stub.url },
    });
    admin = await addUser("Admin", "system_admin");
    principal = await addUser("Principal", "school_admin");
    ayla = await addUser("Ayla", "teacher");
    await addUser("Basel", "teacher"); // unsubscribed, below
    await addUser("Carmen", "teacher", { email_verified: false });
    await addUser("Dina", "teacher", { suspended_at: new Date().toISOString() });
    await addUser("Eman", "student");
    await addUser("Fadi", "parent");
    await db.pool.query(`INSERT INTO email_suppressions (email, source) VALUES ($1, 'link')`, [mail("Basel")]);
  });

  after(async () => {
    await server?.stop();
    await stub?.close();
    await db?.drop();
  });

  it("is for a system admin only", async () => {
    for (const who of [principal, ayla]) {
      assert.equal((await call(server, "GET", "/admin/newsletter", who)).status, 403);
      assert.equal((await call(server, "POST", "/admin/newsletter/test", who, { subject: SUBJECT, body: BODY })).status, 403);
      assert.equal(
        (await call(server, "POST", "/admin/newsletter/send", who, { issueId: crypto.randomUUID(), subject: SUBJECT, body: BODY })).status,
        403,
      );
    }
    assert.equal((await call(server, "GET", "/admin/newsletter")).status, 401);
    assert.equal(stub.mails().length, 0);
  });

  it("counts who would receive an issue, before any was sent", async () => {
    const res = await call(server, "GET", "/admin/newsletter", admin);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { lastSentAt: null, eligible: 2, unsubscribed: 1 });
  });

  it("refuses a send that was never tested, and mails nobody", async () => {
    const res = await send(crypto.randomUUID());
    assert.equal(res.status, 409);
    assert.equal(res.json.error, "not-tested");
    assert.equal(stub.mails().length, 0);
  });

  it("refuses malformed input", async () => {
    assert.equal((await test("ab", BODY)).json.error, "subject");
    assert.equal((await test(SUBJECT, "short")).json.error, "body");
    const bad = await call(server, "POST", "/admin/newsletter/send", admin, { issueId: "nope", subject: SUBJECT, body: BODY });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error, "issueId");
  });

  it("sends the test to the admin alone, then sends that exact text to the teachers once", async () => {
    stub.clear();
    const tested = await test();
    assert.equal(tested.status, 200, tested.text);
    assert.equal(tested.json.sentTo, mail("Admin"));
    assert.deepEqual(recipients(), [mail("Admin")]);
    assert.match(stub.mails()[0]!.subject, /^\[تجريبي\] /);
    const issueId: string = tested.json.issueId;

    // One changed character after the test: refused, nobody mailed.
    stub.clear();
    const edited = await send(issueId, SUBJECT, `${BODY}.`);
    assert.equal(edited.status, 409);
    assert.equal(edited.json.error, "not-tested");
    assert.equal(stub.mails().length, 0);

    const sent = await send(issueId);
    assert.equal(sent.status, 200, sent.text);
    assert.deepEqual(sent.json, { sent: 2, failed: 0, skipped: 1 });
    assert.deepEqual(recipients(), [mail("Ayla"), mail("Principal")]);
    const one = stub.mails()[0]!;
    assert.equal(one.subject, SUBJECT);
    assert.match(one.html, /You received this because you have a teacher account on Iqrra\./);
    assert.match(one.html, /\/api\/email\/unsubscribe\?t=/);
    assert.match(one.html, /<p dir="rtl"/);
    assert.match(one.html, /<p dir="ltr"/);
    assert.equal(one.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");

    // Pressing send again mails nobody a second time.
    stub.clear();
    const again = await send(issueId);
    assert.equal(again.status, 200);
    assert.equal(again.json.sent, 0);
    assert.equal(stub.mails().length, 0);

    const info = await call(server, "GET", "/admin/newsletter", admin);
    assert.ok(info.json.lastSentAt, "the issue is recorded as sent");
  });

  it("keeps teachers eligible when the provider refuses the batch, and reaches them on the retry", async () => {
    const tested = await test(SUBJECT, `${BODY}\n\nSecond issue`);
    const issueId: string = tested.json.issueId;
    stub.clear();
    stub.failNext(500);
    const failed = await send(issueId, SUBJECT, `${BODY}\n\nSecond issue`);
    assert.equal(failed.status, 200);
    assert.deepEqual(failed.json, { sent: 0, failed: 2, skipped: 1 });
    assert.equal(stub.mails().length, 0);

    const retry = await send(issueId, SUBJECT, `${BODY}\n\nSecond issue`);
    assert.equal(retry.json.sent, 2);
    assert.deepEqual(recipients(), [mail("Ayla"), mail("Principal")]);
  });

  it("refuses a test older than 24 hours", async () => {
    const tested = await test(SUBJECT, `${BODY}\n\nThird issue`);
    await db.pool.query(`UPDATE newsletter_issues SET tested_at = now() - interval '25 hours' WHERE id = $1`, [tested.json.issueId]);
    stub.clear();
    const res = await send(tested.json.issueId, SUBJECT, `${BODY}\n\nThird issue`);
    assert.equal(res.status, 409);
    assert.equal(res.json.error, "test-expired");
    assert.equal(stub.mails().length, 0);
  });

  it("a new test replaces the unsent draft, so its id no longer sends", async () => {
    const first = await test(SUBJECT, `${BODY}\n\nFourth issue`);
    const second = await test(SUBJECT, `${BODY}\n\nFifth issue`);
    assert.notEqual(first.json.issueId, second.json.issueId);
    const stale = await send(first.json.issueId, SUBJECT, `${BODY}\n\nFourth issue`);
    assert.equal(stale.status, 409);
    assert.equal(stale.json.error, "not-tested");
  });
});
```

The admin makes about 15 POSTs in this file and the limiter allows 20 an hour per admin. If you add cases, keep the count under 20 or add a second admin user for them; do not raise the limit for the test.

- [ ] **Step 3: Build and see it fail (or skip without a database)**

Run: `pnpm build && TEST_DATABASE_URL=<throwaway> node --experimental-strip-types --test src/routes/__tests__/adminNewsletter.db.test.ts`
Expected with a database: FAIL (routes answer 404). Without `TEST_DATABASE_URL`: skipped; continue, and rely on CI.

- [ ] **Step 4: Implement the router**

`artifacts/api-server/src/routes/adminNewsletter.ts`:

```ts
/**
 * The teacher newsletter (docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md):
 *
 *   GET  /admin/newsletter                          — when the last issue went out, and who would get one now
 *   POST /admin/newsletter/test {subject, body}     — one copy to the caller; records the text as tested
 *   POST /admin/newsletter/send {issueId, subject, body}
 *                                                   — the tested text, to every eligible teacher not yet mailed it
 *
 * System admin only. Nothing here runs by itself: there is no schedule, and the send route
 * refuses any text that was not test-sent to the admin in the last 24 hours (lib/newsletter.ts,
 * `sendDecision`). Do not add a caller that is not a person pressing a button.
 *
 * Reads through `systemDb` (listed in lib/__tests__/systemDbFiles.test.ts): it reads every
 * teacher's address, and its two tables have no app-role grant.
 *
 * Every path starts `/admin/newsletter` and each route carries its own guards, so mounting
 * this router at the root shadows nothing (mountOrder.test.ts).
 *
 * The send is synchronous, like the waitlist broadcast: 100 per batch, ~0.6 s apart, fine into
 * the low thousands. The answer is written after the mail is handed over and recorded, because
 * work after `res.json` may never run on Cloud Run.
 */
import { Router } from "express";
import { newsletterIssues, newsletterSends, systemDb as db, users } from "@workspace/db";
import { and, desc, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { authMiddleware, requireRole, type AuthenticatedRequest } from "../middlewares/auth.js";
import { UUID } from "../lib/adminMetrics.js";
import { sendBroadcast } from "../lib/email.js";
import { suppressedAmong } from "../lib/emailSuppression.ts";
import { logger } from "../lib/logger.js";
import {
  NEWSLETTER_ROLES,
  TEACHER_FOOTER,
  newsletterHash,
  parseNewsletter,
  pickTeacherRecipients,
  sendDecision,
  teacherUnsubscribeUrl,
} from "../lib/newsletter.ts";
import { createRateLimiter } from "../lib/rateLimit.js";
import { renderBroadcastBody } from "../lib/siteMail.js";

const router = Router();

const limiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  name: "admin-newsletter",
  key: (req) => (req as AuthenticatedRequest).user?.id ?? req.ip ?? "unknown",
});

/** A send that died mid-way must not lock the issue for ever. */
const SENDING_CLAIM_MINUTES = 10;

const teacherRows = () =>
  db
    .select({ id: users.id, email: users.email, role: users.role, emailVerified: users.emailVerified, suspendedAt: users.suspendedAt })
    .from(users)
    .where(inArray(users.role, [...NEWSLETTER_ROLES]));

router.get("/admin/newsletter", authMiddleware, requireRole("system_admin"), async (_req, res) => {
  try {
    const recipients = pickTeacherRecipients(await teacherRows());
    const suppressed = await suppressedAmong(recipients.map((r) => r.email));
    const [last] = await db
      .select({ sentAt: newsletterIssues.sentAt })
      .from(newsletterIssues)
      .where(isNotNull(newsletterIssues.sentAt))
      .orderBy(desc(newsletterIssues.sentAt))
      .limit(1);
    res.json({ lastSentAt: last?.sentAt ?? null, eligible: recipients.length - suppressed.size, unsubscribed: suppressed.size });
  } catch (err) {
    logger.error({ err }, "newsletter summary failed");
    res.status(500).json({ error: "Failed to load" });
  }
});

router.post("/admin/newsletter/test", authMiddleware, requireRole("system_admin"), limiter, async (req: AuthenticatedRequest, res) => {
  const parsed = parseNewsletter(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const me = req.user!;
  if (!me.email) {
    res.status(400).json({ error: "no-email" });
    return;
  }
  try {
    const out = await sendBroadcast(
      [{ id: me.id, email: me.email }],
      `[تجريبي] ${parsed.subject}`,
      renderBroadcastBody(parsed.text),
      teacherUnsubscribeUrl,
      TEACHER_FOOTER,
    );
    if (out.sent.length === 0) {
      // The admin's own address is on the unsubscribe list: say so rather than "could not send".
      res.status(out.skipped.length > 0 ? 409 : 502).json({ error: out.skipped.length > 0 ? "unsubscribed" : "send" });
      return;
    }
    // One unsent issue at a time: this test replaces the last one, whose id then no longer sends.
    await db.delete(newsletterIssues).where(isNull(newsletterIssues.sentAt));
    const [issue] = await db
      .insert(newsletterIssues)
      .values({ subject: parsed.subject, body: parsed.text, contentHash: newsletterHash(parsed.subject, parsed.text), createdBy: me.id })
      .returning({ id: newsletterIssues.id });
    res.json({ issueId: issue!.id, sentTo: me.email });
  } catch (err) {
    logger.error({ err }, "newsletter test failed");
    res.status(500).json({ error: "Failed to send" });
  }
});

router.post("/admin/newsletter/send", authMiddleware, requireRole("system_admin"), limiter, async (req: AuthenticatedRequest, res) => {
  const parsed = parseNewsletter(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const issueId = (req.body as { issueId?: unknown } | null)?.issueId;
  if (typeof issueId !== "string" || !UUID.test(issueId)) {
    res.status(400).json({ error: "issueId" });
    return;
  }
  try {
    const [issue] = await db.select().from(newsletterIssues).where(eq(newsletterIssues.id, issueId)).limit(1);
    const decision = sendDecision(issue, parsed.subject, parsed.text);
    if (decision !== "ok") {
      res.status(409).json({ error: decision });
      return;
    }

    // Claim the issue, so a second request for it (a double tap, a retry while this one runs) mails nobody.
    const claimed = await db
      .update(newsletterIssues)
      .set({ sendingAt: sql`now()` })
      .where(
        and(
          eq(newsletterIssues.id, issueId),
          or(isNull(newsletterIssues.sendingAt), lt(newsletterIssues.sendingAt, sql`now() - make_interval(mins => ${SENDING_CLAIM_MINUTES})`)),
        ),
      )
      .returning({ id: newsletterIssues.id });
    if (claimed.length === 0) {
      res.status(409).json({ error: "sending" });
      return;
    }

    try {
      const already = new Set(
        (await db.select({ userId: newsletterSends.userId }).from(newsletterSends).where(eq(newsletterSends.issueId, issueId))).map((r) => r.userId),
      );
      const recipients = pickTeacherRecipients(await teacherRows()).filter((r) => !already.has(r.id));
      const out = await sendBroadcast(recipients, parsed.subject, renderBroadcastBody(parsed.text), teacherUnsubscribeUrl, TEACHER_FOOTER);

      const accepted = new Set(out.sent.map((e) => e.toLowerCase()));
      const sentIds = recipients.filter((r) => accepted.has(r.email.toLowerCase())).map((r) => r.id);
      if (sentIds.length > 0) {
        try {
          await db.insert(newsletterSends).values(sentIds.map((userId) => ({ issueId, userId }))).onConflictDoNothing();
          await db
            .update(newsletterIssues)
            .set({ sentAt: sql`coalesce(${newsletterIssues.sentAt}, now())` })
            .where(eq(newsletterIssues.id, issueId));
        } catch (err) {
          // The mail is out and we cannot remember to whom: a retry would mail them again, so say so loudly.
          logger.error({ err, issueId, sent: sentIds.length }, "newsletter sent but not recorded — do not retry this issue");
          res.status(500).json({ error: "sent-not-recorded", sent: sentIds.length });
          return;
        }
      }
      logger.info(
        { by: req.user!.id, issueId, sent: out.sent.length, failed: out.failed.length, skipped: out.skipped.length },
        "teacher newsletter",
      );
      res.json({ sent: out.sent.length, failed: out.failed.length, skipped: out.skipped.length });
    } finally {
      await db
        .update(newsletterIssues)
        .set({ sendingAt: null })
        .where(eq(newsletterIssues.id, issueId))
        .catch((err) => logger.error({ err, issueId }, "newsletter claim not released"));
    }
  } catch (err) {
    logger.error({ err }, "newsletter send failed");
    if (!res.headersSent) res.status(500).json({ error: "Failed to send" });
  }
});

export default router;
```

- [ ] **Step 5: Mount it and register it**

In `artifacts/api-server/src/routes/index.ts`: after `import adminInsightsRouter from "./adminInsights";` add `import adminNewsletterRouter from "./adminNewsletter";`, and after `router.use(adminInsightsRouter);` add `router.use(adminNewsletterRouter);`.

In `systemDbFiles.test.ts`, add to `ALLOWED` after the `routes/adminInsights.ts` line:

```ts
  "routes/adminNewsletter.ts": "system-admin-only teacher newsletter: reads every teacher's address to mail them, and records who was mailed in two tables that have no app-role grant",
```

In `mountOrder.test.ts` (the admin token test, about line 936): add `"/admin/newsletter"` to the GET list, and `"/admin/newsletter/test"`, `"/admin/newsletter/send"` to the POST list:

```ts
    for (const route of ["/feedback", "/admin/usage-summary", "/admin/users", "/admin/metrics", "/admin/signups", "/admin/ai-costs", "/admin/newsletter"]) {
```
```ts
    for (const route of ["/admin/metrics", "/admin/invites", "/admin/broadcasts", "/admin/newsletter/test", "/admin/newsletter/send", `/admin/users/${crypto.randomUUID()}/suspend`]) {
```

- [ ] **Step 6: Build, typecheck, run**

Run: `pnpm run typecheck && pnpm build && pnpm test`
Expected: typecheck clean; the whole API suite passes; `mountOrder`, `systemDbFiles`, `newsletter`, `broadcast`, `siteMail` pass. With `TEST_DATABASE_URL` set, `adminNewsletter.db.test.ts` passes all eight tests; without it, it reports skipped.

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src/routes/adminNewsletter.ts artifacts/api-server/src/routes/index.ts artifacts/api-server/src/test-support/resendStub.ts artifacts/api-server/src/routes/__tests__/adminNewsletter.db.test.ts artifacts/api-server/src/routes/__tests__/mountOrder.test.ts artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts
git commit -m "Teacher newsletter routes: summary, test copy, send after test"
```

---

### Task 6: The draft builder (app, pure)

**Files:**
- Create: `artifacts/mobile/services/newsletterDraft.ts`
- Test: `artifacts/mobile/services/__tests__/newsletterDraft.test.ts`

**Interfaces:**
- Consumes: `WhatsNewEntry` type from `./whatsNew.ts`.
- Produces:
  ```ts
  export const NEWSLETTER_APP_URL = 'https://app.iqrra.com';
  export const NEWSLETTER_FIRST_WINDOW_DAYS = 31;
  export const NEWSLETTER_SUBJECT: string;
  export function buildNewsletterDraft(input: {
    entries: readonly WhatsNewEntry[];
    since: string | null;       // Amman day (YYYY-MM-DD) of the last sent issue; null = none yet
    today: string;              // Amman day
    ar: (key: string) => string;
    en: (key: string) => string;
  }): { subject: string; body: string; count: number };
  ```
  `count` is the number of entries used; `body` is `''` when it is 0.

The file must load under bare `node --test`: no `react-native`, no `expo-*`, type-only imports from `whatsNew.ts`, and explicit `.ts` extensions.

- [ ] **Step 1: Write the failing test**

`artifacts/mobile/services/__tests__/newsletterDraft.test.ts`:

```ts
// The teacher newsletter's draft (docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md):
// which «ما الجديد» notes go in, in both languages, and the one-time opening sentence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEWSLETTER_SUBJECT, buildNewsletterDraft } from '../newsletterDraft.ts';
import type { WhatsNewEntry } from '../whatsNew.ts';

const entry = (id: string, date: string, over: Partial<WhatsNewEntry> = {}): WhatsNewEntry =>
  ({ id, date, roles: ['teacher'], titleKey: `${id}Title`, bodyKey: `${id}Body`, ...over }) as WhatsNewEntry;
const ar = (k: string) => `ع:${k}`;
const en = (k: string) => `E:${k}`;
const draft = (entries: WhatsNewEntry[], since: string | null, today = '2026-11-20') =>
  buildNewsletterDraft({ entries, since, today, ar, en });

test('takes teacher notes after the last issue and up to today, newest first', () => {
  const out = draft(
    [
      entry('future', '2026-11-21'),
      entry('b', '2026-11-20', { route: '/iqra' }),
      entry('a', '2026-11-05'),
      entry('sameDay', '2026-11-01'),
      entry('old', '2026-10-20'),
      entry('student', '2026-11-10', { roles: ['student'] }),
    ],
    '2026-11-01',
  );
  assert.equal(out.count, 2);
  assert.equal(out.subject, NEWSLETTER_SUBJECT);
  assert.ok(out.body.indexOf('ع:bTitle') < out.body.indexOf('ع:aTitle'));
  for (const gone of ['future', 'sameDay', 'old', 'student']) assert.ok(!out.body.includes(`${gone}Title`), gone);
});

test('writes an Arabic block, then an English block, each note with its link', () => {
  const out = draft([entry('b', '2026-11-20', { route: '/iqra' }), entry('a', '2026-11-05')], '2026-11-01');
  assert.equal(
    out.body,
    [
      'ع:bTitle\nع:bBody\nhttps://app.iqrra.com/iqra',
      'ع:aTitle\nع:aBody',
      'E:bTitle\nE:bBody\nhttps://app.iqrra.com/iqra',
      'E:aTitle\nE:aBody',
    ].join('\n\n'),
  );
});

test('with no issue sent yet, looks back 31 days and opens by saying what this mail is', () => {
  const out = draft([entry('in', '2026-10-21'), entry('out', '2026-10-20')], null);
  assert.equal(out.count, 1);
  assert.ok(out.body.includes('inTitle'));
  assert.ok(!out.body.includes('outTitle'));
  const paragraphs = out.body.split('\n\n');
  assert.match(paragraphs[0]!, /رسالة إقرأ الشهرية للمعلّمين/);
  assert.match(paragraphs[0]!, /إلغاء الاشتراك/);
  assert.match(paragraphs[2]!, /^This is Iqrra's monthly email for teachers/);
  assert.match(paragraphs[2]!, /Unsubscribe/);
});

test('a later issue has no opening sentence', () => {
  const out = draft([entry('a', '2026-11-05')], '2026-11-01');
  assert.ok(!out.body.includes('monthly email'));
  assert.ok(!out.body.includes('الشهرية'));
});

test('nothing new gives an empty body', () => {
  assert.deepEqual(draft([entry('old', '2026-10-01')], '2026-11-01'), { subject: NEWSLETTER_SUBJECT, body: '', count: 0 });
  assert.equal(draft([], null).body, '');
});
```

- [ ] **Step 2: Run and see it fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/newsletterDraft.test.ts`
Expected: FAIL, cannot find module `../newsletterDraft.ts`.

- [ ] **Step 3: Implement**

`artifacts/mobile/services/newsletterDraft.ts`:

```ts
/**
 * The teacher newsletter's draft (docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md).
 *
 * Built here, in the app, because the «ما الجديد» notes and their translations live here
 * (services/whatsNew.ts, services/i18n.ts). It only fills the admin's form
 * (app/admin/newsletter.tsx): nothing is stored or sent from a draft, and the admin edits
 * it freely before the test copy.
 *
 * The body is plain text, which the API turns into email HTML (api-server lib/siteMail.ts,
 * `renderBroadcastBody`): a blank line starts a paragraph, a bare URL becomes a link, and
 * each paragraph takes its own direction — so the Arabic block reads right to left and the
 * English block under it left to right.
 *
 * Pure, and loaded by bare `node --test`: type-only imports, nothing from react-native.
 */
import type { WhatsNewEntry } from './whatsNew.ts';

export const NEWSLETTER_APP_URL = 'https://app.iqrra.com';
/** How far the first issue looks back, when there is no last issue to start from. */
export const NEWSLETTER_FIRST_WINDOW_DAYS = 31;
export const NEWSLETTER_SUBJECT = "جديد إقرأ هذا الشهر · What's new in Iqrra";

const INTRO_AR = 'هذه رسالة إقرأ الشهرية للمعلّمين: ما الجديد في التطبيق. لإيقافها اضغط «إلغاء الاشتراك» أسفل الرسالة.';
const INTRO_EN = "This is Iqrra's monthly email for teachers: what is new in the app. To stop it, press Unsubscribe at the bottom.";

/** `days` before a `YYYY-MM-DD`, as a `YYYY-MM-DD`. */
function daysBefore(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!) - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function buildNewsletterDraft(input: {
  entries: readonly WhatsNewEntry[];
  /** Amman day of the last sent issue, or null when none was ever sent. */
  since: string | null;
  /** Today in Amman. */
  today: string;
  ar: (key: string) => string;
  en: (key: string) => string;
}): { subject: string; body: string; count: number } {
  const first = input.since === null;
  // "Dated after `since`": with no issue yet, 31 days before today is the last day left out.
  const after = input.since ?? daysBefore(input.today, NEWSLETTER_FIRST_WINDOW_DAYS);
  // ISO days compare as strings. Newest first, whatever order the list is in.
  const picked = input.entries
    .filter((e) => e.roles.includes('teacher') && e.date > after && e.date <= input.today)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  if (picked.length === 0) return { subject: NEWSLETTER_SUBJECT, body: '', count: 0 };

  const block = (t: (key: string) => string) =>
    picked.map((e) => [t(e.titleKey), t(e.bodyKey), ...(e.route ? [`${NEWSLETTER_APP_URL}${e.route}`] : [])].join('\n'));
  const body = [...(first ? [INTRO_AR] : []), ...block(input.ar), ...(first ? [INTRO_EN] : []), ...block(input.en)].join('\n\n');
  return { subject: NEWSLETTER_SUBJECT, body, count: picked.length };
}
```

Worked example of the window: with `since = null` and `today = 2026-11-20`, `after` is `2026-10-20`, so a note dated `2026-10-21` is in and one dated `2026-10-20` is out, which is what the third test checks.

- [ ] **Step 4: Run and see it pass**

Run: `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/newsletterDraft.test.ts`
Expected: PASS, five tests. If the sort test fails because two picked entries share a date, that is expected to keep list order (`Array.prototype.sort` is stable).

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/newsletterDraft.ts artifacts/mobile/services/__tests__/newsletterDraft.test.ts
git commit -m "Newsletter draft from the what's-new notes"
```

---

### Task 7: The admin screen

**Files:**
- Create: `artifacts/mobile/app/admin/newsletter.tsx`
- Modify: `artifacts/mobile/app/admin/dashboard.tsx` (the link list near line 269, and its `.filter` on line 279)

**Interfaces:**
- Consumes: `buildNewsletterDraft` (Task 6); `WHATS_NEW` from `@/services/whatsNew`; `getT` from `@/services/i18n`; `ammanToday` from `@/services/homework`; the three routes (Task 5); `apiJson`, `ApiError` from `@/services/apiClient`; `confirm` from `@/services/confirm`.

There is no unit test for this file: the mobile runner cannot load React Native. Its rules are tested in Tasks 4–6; this task ends with a check in the browser.

- [ ] **Step 1: Write the screen**

`artifacts/mobile/app/admin/newsletter.tsx`:

```tsx
/**
 * The teacher newsletter (docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md).
 *
 * A system admin drafts an issue from the «ما الجديد» notes (services/newsletterDraft.ts),
 * edits it, sends a test copy to their own address, and only then may send it to teachers.
 * Nothing here is automatic. The send button is disabled until a test of the text on screen
 * has succeeded; the server enforces the same rule whatever this screen does
 * (api-server routes/adminNewsletter.ts), so an edit after the test needs a new test.
 *
 * Role-gated client-side like the other admin screens; enforcement is server-side.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { apiJson, ApiError } from '@/services/apiClient';
import { confirm } from '@/services/confirm';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { BackButton } from '@/components/ui/BackButton';
import { getT } from '@/services/i18n';
import { ammanToday } from '@/services/homework';
import { WHATS_NEW } from '@/services/whatsNew';
import { buildNewsletterDraft } from '@/services/newsletterDraft';

const ACCENT = '#4F46E5';

type Summary = { lastSentAt: string | null; eligible: number; unsubscribed: number };
/** The text a successful test covered. The send button is live only while the fields still match it. */
type Tested = { issueId: string; subject: string; body: string };

export default function AdminNewsletterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isRTL, lang } = useLanguage();
  const ar = lang === 'ar';
  const { user, isLoading: authLoading } = useAuth();
  const isAdmin = user?.role === 'system_admin';

  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadError, setLoadError] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [tested, setTested] = useState<Tested | null>(null);
  const [busy, setBusy] = useState<'' | 'test' | 'send'>('');
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => {
    try {
      setSummary(await apiJson<Summary>('/admin/newsletter'));
      setLoadError('');
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void refresh();
  }, [isAdmin, refresh]);

  const textReady = subject.trim().length >= 3 && body.trim().length >= 10;
  // Trimmed, as the server trims before hashing.
  const matchesTest = !!tested && tested.subject === subject.trim() && tested.body === body.trim();

  const fillDraft = () => {
    if (!summary) return;
    const draft = buildNewsletterDraft({
      entries: WHATS_NEW,
      since: summary.lastSentAt ? ammanToday(new Date(summary.lastSentAt)) : null,
      today: ammanToday(),
      ar: getT('ar') as (key: string) => string,
      en: getT('en') as (key: string) => string,
    });
    if (draft.count === 0) {
      setNote(ar ? 'لا جديد للمعلّمين منذ آخر عدد.' : 'Nothing new for teachers since the last issue.');
      return;
    }
    setSubject(draft.subject);
    setBody(draft.body);
    setTested(null);
    setNote(ar ? `مسودة من ${draft.count} خبرًا. عدّلها ثم أرسل نسخة لنفسك.` : `Draft with ${draft.count} notes. Edit it, then send yourself a copy.`);
  };

  const failed = (e: unknown): string => {
    const code = e instanceof ApiError ? e.message : '';
    if (code === 'not-tested') return ar ? 'النص تغيّر بعد النسخة التجريبية. أرسل نسخة تجريبية جديدة أولًا.' : 'The text changed after the test copy. Send a new test first.';
    if (code === 'test-expired') return ar ? 'مضى أكثر من ٢٤ ساعة على النسخة التجريبية. أرسل نسخة جديدة أولًا.' : 'The test copy is more than 24 hours old. Send a new one first.';
    if (code === 'sending') return ar ? 'هذا العدد قيد الإرسال الآن. انتظر قليلًا.' : 'This issue is being sent right now. Wait a moment.';
    if (code === 'unsubscribed') return ar ? 'بريدك في قائمة إلغاء الاشتراك، فلا تصلك النسخة التجريبية.' : 'Your own address is unsubscribed, so the test copy cannot reach you.';
    if (code === 'sent-not-recorded') return ar ? 'أُرسلت الرسائل لكن لم يُسجَّل المستلمون. لا تُعد الإرسال، وراجع السجلات.' : 'The mail went out but the recipients were not recorded. Do not send again; check the logs.';
    return ar ? 'تعذّر الإرسال' : 'Could not send';
  };

  const sendTest = async () => {
    if (busy || !textReady) return;
    setBusy('test');
    setNote('');
    try {
      const r = await apiJson<{ issueId: string; sentTo: string }>('/admin/newsletter/test', {
        method: 'POST',
        body: JSON.stringify({ subject, body }),
      });
      setTested({ issueId: r.issueId, subject: subject.trim(), body: body.trim() });
      setNote(ar ? `أُرسلت نسخة تجريبية إلى ${r.sentTo}. اقرأها وافتح كل رابط قبل الإرسال.` : `Test copy sent to ${r.sentTo}. Read it and open every link before sending.`);
    } catch (e: unknown) {
      setNote(failed(e));
    } finally {
      setBusy('');
    }
  };

  const sendIssue = async () => {
    if (busy || !tested || !matchesTest || !summary || summary.eligible === 0) return;
    const ok = await confirm({
      title: ar ? 'إرسال العدد إلى المعلّمين؟' : 'Send this issue to teachers?',
      message: ar
        ? `سيُرسل إلى ${summary.eligible} معلّمًا. لا يمكن التراجع عن الإرسال.`
        : `This goes to ${summary.eligible} teachers and can't be undone.`,
      confirmLabel: ar ? 'أرسل' : 'Send',
      cancelLabel: ar ? 'إلغاء' : 'Cancel',
    });
    if (!ok) return;
    setBusy('send');
    setNote('');
    try {
      const r = await apiJson<{ sent: number; failed: number; skipped: number }>('/admin/newsletter/send', {
        method: 'POST',
        body: JSON.stringify({ issueId: tested.issueId, subject, body }),
        timeoutMs: 180_000,
      });
      const skipped = r.skipped ? (ar ? ` · أُلغي اشتراك ${r.skipped}` : ` · unsubscribed ${r.skipped}`) : '';
      const retry = r.failed > 0 ? (ar ? ' · اضغط الإرسال مرة أخرى ليصل إلى من لم يصلهم فقط' : ' · press send again to reach only those who were missed') : '';
      setNote((ar ? `أُرسلت ${r.sent} · فشلت ${r.failed}` : `Sent ${r.sent} · failed ${r.failed}`) + skipped + retry);
    } catch (e: unknown) {
      setNote(failed(e));
    } finally {
      setBusy('');
      void refresh();
    }
  };

  if (authLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={ACCENT} /></View>;
  }
  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }}>{ar ? 'هذه الصفحة لمدير النظام فقط' : 'This page is for system admins only'}</Text>
      </View>
    );
  }

  const align = isRTL ? 'right' : 'left';
  const row = isRTL ? 'row-reverse' : 'row';
  const canSend = !busy && matchesTest && !!summary && summary.eligible > 0;
  const input = { borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 12, paddingVertical: 8, color: colors.foreground, fontFamily: 'Almarai_400Regular', textAlign: align } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 60, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}>
        <View style={[styles.header, { paddingTop: insets.top + 20, backgroundColor: ACCENT }]}>
          <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: 8 }} />
          <Text style={{ color: '#fff', fontFamily: 'ReadexPro_700Bold', fontSize: 20, textAlign: align }}>
            {ar ? 'نشرة المعلّمين' : 'Teacher newsletter'}
          </Text>
        </View>

        <View style={{ margin: 20, gap: 10 }}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
              {summary === null
                ? (loadError ? (ar ? 'تعذّر التحميل' : 'Could not load') : '…')
                : ar
                  ? `${summary.eligible} معلّمًا يستلمون العدد · ${summary.unsubscribed} ألغوا الاشتراك`
                  : `${summary.eligible} teachers would receive it · ${summary.unsubscribed} unsubscribed`}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
              {summary?.lastSentAt
                ? (ar ? `آخر عدد: ${new Date(summary.lastSentAt).toLocaleDateString()}` : `Last issue: ${new Date(summary.lastSentAt).toLocaleDateString()}`)
                : (ar ? 'لم يُرسل أي عدد بعد.' : 'No issue has been sent yet.')}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
              {ar
                ? 'لا يُرسل شيء تلقائيًا. يُرسل العدد فقط بعد أن تصلك نسخة تجريبية من النص نفسه وتضغط الإرسال.'
                : 'Nothing is sent automatically. An issue goes out only after a test copy of the same text reaches you and you press send.'}
            </Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, gap: 8 }]}>
            <Pressable
              onPress={fillDraft}
              disabled={!summary || !!busy}
              accessibilityRole="button"
              style={[styles.chip, { alignSelf: isRTL ? 'flex-end' : 'flex-start', borderRadius: colors.radius, borderColor: ACCENT, opacity: !summary || busy ? 0.5 : 1 }]}
            >
              <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>{ar ? 'أنشئ مسودة من «ما الجديد»' : "Draft from What's new"}</Text>
            </Pressable>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder={ar ? 'عنوان الرسالة' : 'Subject'}
              placeholderTextColor={colors.mutedForeground}
              maxLength={150}
              style={input}
            />
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={ar ? 'نص الرسالة — سطر فارغ يفصل الفقرات، والروابط تصبح قابلة للنقر' : 'Message — a blank line starts a new paragraph; links become clickable'}
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={14}
              maxLength={10000}
              style={[input, { minHeight: 280, textAlignVertical: 'top' }]}
            />
            <View style={{ flexDirection: row, gap: 8, flexWrap: 'wrap' }}>
              <Pressable
                onPress={() => { void sendTest(); }}
                disabled={!!busy || !textReady}
                accessibilityRole="button"
                style={[styles.chip, { borderRadius: colors.radius, borderColor: ACCENT, opacity: busy || !textReady ? 0.5 : 1 }]}
              >
                <Text style={{ color: ACCENT, fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                  {busy === 'test' ? '…' : ar ? 'أرسل لي نسخة تجريبية' : 'Send me a test copy'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => { void sendIssue(); }}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canSend }}
                style={[styles.chip, { borderRadius: colors.radius, backgroundColor: ACCENT, borderColor: ACCENT, opacity: canSend ? 1 : 0.5 }]}
              >
                <Text style={{ color: '#fff', fontFamily: 'ReadexPro_600SemiBold', fontSize: 13 }}>
                  {busy === 'send' ? '…' : ar ? `أرسل إلى ${summary?.eligible ?? 0} معلّمًا` : `Send to ${summary?.eligible ?? 0} teachers`}
                </Text>
              </Pressable>
            </View>
            {textReady && !matchesTest && (
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>
                {tested
                  ? (ar ? 'عدّلت النص بعد النسخة التجريبية: أرسل نسخة جديدة ليُفتح الإرسال.' : 'You edited the text after the test copy: send a new one to unlock sending.')
                  : (ar ? 'الإرسال إلى المعلّمين يُفتح بعد نسخة تجريبية من هذا النص.' : 'Sending to teachers unlocks after a test copy of this text.')}
              </Text>
            )}
            {!!note && (
              <Text style={{ color: colors.foreground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align }}>{note}</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  card: { padding: 12, borderWidth: 1, gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1.5 },
});
```

This copies the header, card and chip styling of `app/admin/signups.tsx` on purpose (same admin accent, same shapes). If `pnpm test` in mobile fails a design-scale or status-bar test that names this file (for example a header band under the status bar needing `useLightStatusBar()`), read how `app/admin/insights.tsx` satisfies the same test and do the same; do not weaken the test.

- [ ] **Step 2: Link it from the dashboard**

In `app/admin/dashboard.tsx`, add a row after the `/admin/signups` row:

```tsx
                ['/admin/newsletter', 'newspaper-outline', 'نشرة المعلّمين', 'Teacher newsletter'],
```

and change the filter line under it to keep it for system admins only:

```tsx
                // Schools, insights and the newsletter span every school: the server answers them for a system admin only.
                .filter(([href]) => (href !== '/admin/schools' && href !== '/admin/insights' && href !== '/admin/newsletter') || user?.role === 'system_admin')
```

- [ ] **Step 3: Typecheck and run the mobile suite**

Run from the repo root: `pnpm run typecheck`
Run: `cd artifacts/mobile && pnpm test` (prints nothing for minutes; that is not a hang)
Expected: both pass.

- [ ] **Step 4: Check it in a browser, with mail off**

Start the API with no mail key and live AI off, and the web app:

```bash
AI_LIVE_MODE=false pnpm run dev:api
```
```bash
pnpm run dev:mobile:web
```

Sign in as a system admin (see `LOCAL_SETUP.md` for the seeded test accounts; do not open any `.env`). Open `/admin/newsletter` and confirm, in Arabic and in English:

1. The count line and "no issue has been sent yet" show.
2. «أنشئ مسودة» fills the subject and a body with an Arabic block, an English block, and `https://app.iqrra.com/...` links.
3. The send button is disabled before a test.
4. «أرسل لي نسخة تجريبية» shows "could not send" (there is no mail key locally, so the server reports the send failed) and the send button stays disabled. That is the correct local result; the success path is covered by `adminNewsletter.db.test.ts`.

Report what you saw. Do not set a mail key to "see it work".

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/app/admin/newsletter.tsx artifacts/mobile/app/admin/dashboard.tsx
git commit -m "Admin screen: teacher newsletter (draft, test copy, send)"
```

---

### Task 8: Privacy policy sentence

**Files:**
- Modify: `artifacts/mobile/constants/legal.ts` (`LEGAL_LAST_UPDATED`, `LEGAL_VERSION`, and the "To email you" bullet in both languages, about lines 123 and 224)
- Test: existing `services/__tests__/legalVersion.test.ts`, `services/__tests__/legalDocs.test.ts`

The date below is the day this PR merges. If it merges on another day, use that day in all three places.

- [ ] **Step 1: Add the sentence in Arabic**

In the Arabic bullet that starts «لمراسلتك بالبريد الإلكتروني:», insert after «ودعوة التطبيق وأخبار إطلاقه لمن سجّل اهتمامه.»:

```
 ونرسل إلى المعلّمين رسالة دورية بما استجدّ في التطبيق.
```

so that part reads: «…ودعوة التطبيق وأخبار إطلاقه لمن سجّل اهتمامه. ونرسل إلى المعلّمين رسالة دورية بما استجدّ في التطبيق. في أسفل كلّ رسالة رابط «إلغاء الاشتراك»…».

- [ ] **Step 2: Add the sentence in English**

In the English bullet that starts "To email you:", insert after "and the app invitation and launch news to people who registered interest.":

```
 Teachers also receive an occasional email about what is new in the app.
```

- [ ] **Step 3: Move the version**

```ts
export const LEGAL_LAST_UPDATED = { ar: '20 تشرين الثاني 2026', en: '20 November 2026' };
```
```ts
export const LEGAL_VERSION = '2026-11-20';
```

Add one line to the file's header comment, in the list of what each version changed (follow the form of the existing lines there): `2026-11-20 — teachers receive an occasional what's-new email (spec 2026-11-20-teacher-newsletter-design.md)`.

- [ ] **Step 4: Run the policy tests**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/legalVersion.test.ts services/__tests__/legalDocs.test.ts`
Expected: PASS. If `legalDocs.test.ts` compares the two languages section by section, both bullets changed together, so it should hold.

Also run `grep -rn "2026-11-19" artifacts/api-server/src/lib/termsAcceptance.ts artifacts/mobile/services/__tests__ | head` and, if the API pins an accepted-version list, add `2026-11-20` there the way earlier bumps did.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/constants/legal.ts
git commit -m "Privacy policy: teachers receive an occasional what's-new email"
```

---

### Task 9: Write-up, full checks, PR

**Files:**
- Modify: `docs/status-log.md` (new entry at the TOP)
- Modify: `STATUS.md` (one line under *Open*; one line at the top of *Recent changes*)

- [ ] **Step 1: Add the log entry at the top of `docs/status-log.md`**

Title: `## Teacher newsletter: a what's-new email an admin sends after a test copy (2026-11-20)`. Write, in plain sentences, from what you actually ran:

- What it is: the three routes, the two tables, the screen, the draft builder; spec and plan paths.
- The approval rule, in one sentence, and that no schedule exists.
- **Verified:** list each test file you ran and saw pass, and what you saw in the browser.
- **Not verified:** no real email was ever sent, so delivery, spam placement, how the mail renders in Gmail and Outlook, and the one-click unsubscribe from a real inbox are untested. Which DB-backed tests you could not run locally, if any. Resend plan caps and the sending domain were not checked. The policy sentence was written by a model and not read by a lawyer.
- **Known limits:** opt-out, not opt-in (the owner's decision, 2026-11-20); unsubscribe stops all general mail to the address; the send is synchronous; a `sent-not-recorded` answer means do not retry.
- **Before the first real issue (owner):** check Resend caps against the eligible count and the sending domain; send the test; open every link; then send.

- [ ] **Step 2: Edit `STATUS.md`**

Under *Open*, add:

```
- **Teacher newsletter is built and has never sent a real email.** A system admin drafts it from «ما الجديد» on `/admin/newsletter`, and the server sends only text that was test-sent to the admin in the last 24 hours; there is no schedule. Every verified teacher receives it unless they unsubscribe (opt-out, the owner's decision); the policy sentence (`LEGAL_VERSION` 2026-11-20) was not read by a lawyer. Before the first issue: check the Resend plan's caps and the sending domain. Entry: «Teacher newsletter: a what's-new email an admin sends after a test copy» in the log.
```

At the top of *Recent changes*, add: `- 2026-11-20 — Teacher newsletter: a what's-new email an admin sends after a test copy`. Also update the `LEGAL_VERSION` date wherever `STATUS.md` states the current one (search it for `LEGAL_VERSION`), and the migration count if it states one that is now wrong.

- [ ] **Step 3: Run what CI runs**

```bash
pnpm run typecheck
```
```bash
cd artifacts/api-server && pnpm build && pnpm test
```
```bash
cd artifacts/mobile && pnpm test
```
```bash
cd lib/curriculum && pnpm test && pnpm run verify
```

Expected: all pass. The math verifier's Python test is untouched by this change; say in the PR body that it was not run. Read `git diff --stat origin/main...HEAD`: every line must be a text diff (a `Bin` line for a text file means corruption).

- [ ] **Step 4: Commit and push**

```bash
git add docs/status-log.md STATUS.md
git commit -m "Status: teacher newsletter write-up"
git push -u origin claude/sweet-lamport-8ngmki
```

- [ ] **Step 5: Update the PR**

The branch already has a draft PR (NizarAbuahmad/Iqraa#1513, spec only). Retitle it `Teacher newsletter: a what's-new email sent only after a test copy` and rewrite the body to cover: what it does; the approval rule; the two differences from the spec (own rate limiter, `sending_at`); what was and was not verified, copied from the log entry; that the migration only creates tables (no `destructive-migration` line needed); that no «ما الجديد» entry is added because only an admin can see the screen; the owner's steps before a first send. Keep it a draft: the owner reviews before merge, and merging deploys the API, the migration and the web bundle.

---

## Self-review (done while writing)

- **Spec coverage:** approval rule → Tasks 4, 5 (and the screen's lock, 7). Draft, 31-day first window, first-issue sentence, links, empty case → Task 6. Per-paragraph direction → Task 1. Recipients → Task 4, checked end to end in Task 5. Three routes, guards, mount order, `systemDb` listing → Task 5. Teacher footer and per-address link → Tasks 2, 4. Two tables, RLS classification, non-destructive migration → Task 3. Screen and dashboard link, no «ما الجديد» entry → Tasks 7, 9. Policy sentence and version → Task 8. Tests listed in the spec → Tasks 1, 4, 5, 6. Risks and owner steps → Task 9's write-up.
- **Left out, as the spec says:** scheduling, tracking, other audiences, AI text, an issue history screen, a product-news-only switch.
- **Names used across tasks:** `sendBroadcast(recipients, subject, bodyHtml, unsubscribeUrl(r), footer?)`; `TEACHER_FOOTER`; `teacherUnsubscribeUrl`; `pickTeacherRecipients`; `newsletterHash`; `parseNewsletter` → `{subject, text}`; `sendDecision`; `newsletterIssues.sendingAt` / `sentAt` / `testedAt` / `contentHash`; `newsletterSends.issueId` / `userId`; `buildNewsletterDraft({entries, since, today, ar, en})` → `{subject, body, count}`.
