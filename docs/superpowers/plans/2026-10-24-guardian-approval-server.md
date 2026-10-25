# Parent approval for email students — server (PR A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An email student is locked by the server until a parent approves by email, behind `GUARDIAN_APPROVAL` (off by default, so merging changes nothing for anyone).

**Architecture:** A pure gate (`lib/guardianGate.ts`) decides who is pending and what a pending account may reach; `authMiddleware` enforces it next to the suspension check. A `guardian_consents` table (owner-only, like the token tables) holds one current request per student; a service (`lib/guardianRequests.ts`) queues, issues (token hashed at rest, plaintext only in the mail) and decides; a public path-scoped router serves the parent's page; `POST /auth/guardian-request`, `GET /auth/me` and the sign-up, verify-email, Google and role-switch routes are wired to it.

**Tech Stack:** Express + drizzle-orm (Postgres), `node --test` with `--experimental-strip-types`, esbuild bundle, Resend over `fetch`.

**Spec:** `docs/superpowers/specs/2026-10-24-guardian-approval-design.md` (amended in this PR: nullable `token_hash`/`expires_at`, flag-dependent sign-up, `GET /guardian-consent/config`). The app (PR B) gets its own plan after this one merges, because it reads this PR's real response shapes.

## Global Constraints

- **Flag:** `GUARDIAN_APPROVAL=true` enables everything; read at call time (`guardianApprovalEnabled()`), never captured at import. Unset ⇒ every existing request behaves exactly as today (the tick is still required at sign-up and role switch).
- **Token:** 32 random bytes, `base64url` (43 characters), only its sha256 hex stored, single use, valid 7 days from the moment it is mailed.
- **Limits:** 3 requests per student and 5 per parent address, per rolling 24 hours (rows in `guardian_consents` by `created_at`). Over either: 429 `guardian_rate_limited`.
- **Allowlist for a pending account (exact):** `GET /auth/me`, `POST /auth/guardian-request`, `POST /auth/logout`, `DELETE /auth/users/me`, `GET /auth/claim`, `POST /auth/claim`, `DELETE /auth/claim`. Everything else: 403 `guardian_approval_required`.
- **Pending means:** flag on, `role = 'student'`, `email IS NOT NULL`, `guardian_approved_at IS NULL`, and no live roster link.
- **Mail copy:** Arabic first then English; the Arabic brand is «إقرأ» and the Latin name is "Iqrra" (never "Iqraa"/"Iqra"/«اقرأ»-as-brand — CI fails them). Child's first name only; HTML-escape it.
- **Source rules (CLAUDE.md):** files loaded directly by `node --test` import siblings with an explicit `.ts` extension and import nothing that reaches `@workspace/db`, `logger` or `email.ts`. No `sed -i`/`perl -pi` on source: use the Edit tool. Schema changes only via `pnpm --filter @workspace/db run generate`; on a migration-number clash with `main`, delete mine and regenerate. `git add` named paths only.
- **Verification before each PR push:** `pnpm run typecheck` (repo root); api-server `pnpm build` then `pnpm test` with `REQUIRE_DB_TESTS=true`; `pnpm --filter @workspace/db test` with `RLS_TEST_DATABASE_URL` set. Local Postgres in this sandbox: `pg_ctlcluster 16 main start`; `TEST_DATABASE_URL=postgres://iqraa_dev:devonly@localhost:5432/postgres`.
- **Draft PR** (the migration is additive, but the PR deploys code and a migration; follow repo practice: open as draft, caveats in the body).

## File Structure

| File | Responsibility |
| --- | --- |
| `artifacts/api-server/src/lib/features.ts` (modify) | `guardianApprovalEnabled()` |
| `artifacts/api-server/src/lib/guardianGate.ts` (create) | Pure: `needsLinkLookup`, `pendingGuardian`, `guardianMayReach`, `guardianStatus` |
| `artifacts/api-server/src/lib/guardianConsent.ts` (create) | Pure: parent-email validation, token generate/hash/shape, `maskEmail`, limits, TTL |
| `artifacts/api-server/src/lib/guardianConsentEmail.ts` (create) | Pure: subject and HTML body of the parent mail (escaped) |
| `artifacts/api-server/src/lib/email.ts` (modify) | `sendGuardianConsentEmail` (Resend transport, dev log) |
| `lib/db/src/schema/users.ts` (modify) | `users.guardianApprovedAt`, table `guardianConsents` |
| `lib/db/migrations/0018_*.sql` (generated + RLS lines) | Additive migration |
| `lib/db/src/__tests__/rlsCoverage.test.ts` (modify) | classify `guardian_consents` as locked |
| `artifacts/api-server/src/lib/rosterLinkState.ts` (create) | `hasLiveRosterLink` (moved out of `routes/auth.ts`) |
| `artifacts/api-server/src/lib/guardianRequests.ts` (create) | DB service: queue, issue+send, current, lookup, decide, counts |
| `artifacts/api-server/src/routes/guardianConsent.ts` (create) | Public router: config, parent page read, decide |
| `artifacts/api-server/src/routes/index.ts` (modify) | mount the public router |
| `artifacts/api-server/src/middlewares/auth.ts` (modify) | the gate |
| `artifacts/api-server/src/routes/auth.ts` (modify) | `POST /guardian-request`, `/me`, register, verify-email, Google, role |
| `artifacts/api-server/src/lib/roleSwitch.ts` (modify) | `ageTickRequired` input |
| `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts` (modify) | pin the two new `systemDb` users |
| `artifacts/api-server/src/lib/__tests__/guardianGate.test.ts`, `guardianConsent.test.ts`, `guardianConsentEmail.test.ts`, `roleSwitchGuardian.test.ts` (create) | unit tests |
| `artifacts/api-server/src/routes/__tests__/guardianApproval.db.test.ts` (create) | DB-backed tests, grown task by task |
| `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts` (modify) | public routes mount |
| `docs/status-log.md`, `STATUS.md`, the spec (modify) | write-up, open item, status line |

---

### Task 1: The flag and the pure gate

**Files:**
- Modify: `artifacts/api-server/src/lib/features.ts` (append)
- Create: `artifacts/api-server/src/lib/guardianGate.ts`
- Test: `artifacts/api-server/src/lib/__tests__/guardianGate.test.ts`

**Interfaces:**
- Produces: `guardianApprovalEnabled(): boolean`; in `guardianGate.ts`: `interface GuardianSubject { role: string; email: string | null; guardianApprovedAt: Date | null }`, `needsLinkLookup(s, flagOn): boolean`, `pendingGuardian(s, o: { flagOn: boolean; hasLiveLink: boolean }): boolean`, `guardianMayReach(method: string, originalUrl: string): boolean`, `type GuardianStatus = "not_required" | "approved" | "needed" | "waiting" | "declined"`, `interface GuardianRequestView { decision: "approved" | "declined" | null; expiresAt: Date | null }`, `guardianStatus(s, o: { flagOn: boolean; hasLiveLink: boolean; request: GuardianRequestView | null; now: Date }): GuardianStatus`.

- [ ] **Step 1: Write the failing test**

```ts
// artifacts/api-server/src/lib/__tests__/guardianGate.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { guardianMayReach, guardianStatus, needsLinkLookup, pendingGuardian } from "../guardianGate.ts";

const student = { role: "student", email: "s@example.test", guardianApprovedAt: null as Date | null };
const NOW = new Date("2026-10-24T12:00:00Z");
const later = new Date("2026-10-31T12:00:00Z");
const earlier = new Date("2026-10-20T12:00:00Z");

describe("pendingGuardian", () => {
  it("holds an email student with no approval and no teacher link, when the flag is on", () => {
    assert.equal(pendingGuardian(student, { flagOn: true, hasLiveLink: false }), true);
  });
  it("never holds anyone when the flag is off", () => {
    assert.equal(pendingGuardian(student, { flagOn: false, hasLiveLink: false }), false);
  });
  it("does not hold a student a teacher has vouched for (live roster link)", () => {
    assert.equal(pendingGuardian(student, { flagOn: true, hasLiveLink: true }), false);
  });
  it("does not hold a code-only student (no email)", () => {
    assert.equal(pendingGuardian({ ...student, email: null }, { flagOn: true, hasLiveLink: false }), false);
  });
  it("does not hold an approved student", () => {
    assert.equal(pendingGuardian({ ...student, guardianApprovedAt: earlier }, { flagOn: true, hasLiveLink: false }), false);
  });
  it("does not hold a teacher, a parent or an admin", () => {
    for (const role of ["teacher", "parent", "school_admin", "system_admin"]) {
      assert.equal(pendingGuardian({ ...student, role }, { flagOn: true, hasLiveLink: false }), false, role);
    }
  });
});

describe("needsLinkLookup", () => {
  it("is true only for the candidates, so the link query runs for almost nobody", () => {
    assert.equal(needsLinkLookup(student, true), true);
    assert.equal(needsLinkLookup(student, false), false);
    assert.equal(needsLinkLookup({ ...student, role: "teacher" }, true), false);
    assert.equal(needsLinkLookup({ ...student, email: null }, true), false);
    assert.equal(needsLinkLookup({ ...student, guardianApprovedAt: earlier }, true), false);
  });
});

describe("guardianMayReach", () => {
  const may: [string, string][] = [
    ["GET", "/api/auth/me"],
    ["POST", "/api/auth/guardian-request"],
    ["POST", "/api/auth/logout"],
    ["DELETE", "/api/auth/users/me"],
    ["GET", "/api/auth/claim"],
    ["POST", "/api/auth/claim"],
    ["DELETE", "/api/auth/claim"],
    ["get", "/api/auth/me?x=1"],
    ["GET", "/auth/me/"],
  ];
  for (const [method, url] of may) {
    it(`lets ${method} ${url} through`, () => assert.equal(guardianMayReach(method, url), true));
  }
  const may_not: [string, string][] = [
    ["GET", "/api/student/exams"],
    ["POST", "/api/auth/role"],
    ["PATCH", "/api/auth/me"],
    ["GET", "/api/auth/me/ai-usage"],
    ["POST", "/api/auth/add-email"],
    ["GET", "/api/messaging/contacts"],
    ["DELETE", "/api/auth/users/avatar"],
  ];
  for (const [method, url] of may_not) {
    it(`stops ${method} ${url}`, () => assert.equal(guardianMayReach(method, url), false));
  }
});

describe("guardianStatus", () => {
  const base = { flagOn: true, hasLiveLink: false, now: NOW };
  it("is not_required when the flag is off, for a non-student, with no email, or when linked", () => {
    assert.equal(guardianStatus(student, { ...base, flagOn: false, request: null }), "not_required");
    assert.equal(guardianStatus({ ...student, role: "teacher" }, { ...base, request: null }), "not_required");
    assert.equal(guardianStatus({ ...student, email: null }, { ...base, request: null }), "not_required");
    assert.equal(guardianStatus(student, { ...base, hasLiveLink: true, request: null }), "not_required");
  });
  it("is approved once guardian_approved_at is set, even if later linked", () => {
    const s = { ...student, guardianApprovedAt: earlier };
    assert.equal(guardianStatus(s, { ...base, request: null }), "approved");
    assert.equal(guardianStatus(s, { ...base, hasLiveLink: true, request: null }), "approved");
  });
  it("is needed with no request, or when the open request has expired", () => {
    assert.equal(guardianStatus(student, { ...base, request: null }), "needed");
    assert.equal(guardianStatus(student, { ...base, request: { decision: null, expiresAt: earlier } }), "needed");
  });
  it("is waiting for an open request, issued or not yet issued", () => {
    assert.equal(guardianStatus(student, { ...base, request: { decision: null, expiresAt: later } }), "waiting");
    assert.equal(guardianStatus(student, { ...base, request: { decision: null, expiresAt: null } }), "waiting");
  });
  it("is declined when the latest request was declined", () => {
    assert.equal(guardianStatus(student, { ...base, request: { decision: "declined", expiresAt: later } }), "declined");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/guardianGate.test.ts`
Expected: FAIL (`Cannot find module '.../guardianGate.ts'`).

- [ ] **Step 3: Write the implementation**

Append to `artifacts/api-server/src/lib/features.ts` (after `masteryGateEnabled`):

```ts

/**
 * Whether an email student is held until a parent approves by email.
 *
 * Off unless `GUARDIAN_APPROVAL=true`, and that default is the point: turning it on locks every existing
 * email student until a parent acts, so it is switched on only once the app that shows the waiting screen has
 * reached users and the parent-consent wording has been read by a lawyer. Off, sign-up and role switches keep
 * asking for the age tick (`lib/ageConfirmation.ts`) and nothing else changes. Spec:
 * `docs/superpowers/specs/2026-10-24-guardian-approval-design.md`.
 */
export function guardianApprovalEnabled(): boolean {
  return process.env.GUARDIAN_APPROVAL === "true";
}
```

Create `artifacts/api-server/src/lib/guardianGate.ts`:

```ts
/**
 * Who is held until a parent approves, what a held account may still reach, and what the app is told.
 *
 * No database or flag import, so `node --test` can load it (same reason as `suspension.ts`, whose `routeKey` it
 * reuses). The caller supplies the flag and the one fact that needs a query, the roster link.
 */
import { routeKey } from "./suspension.ts";

export interface GuardianSubject {
  role: string;
  /** Null for an account made from a teacher's code alone: the teacher vouches for it. */
  email: string | null;
  guardianApprovedAt: Date | null;
}

/** Whether the roster-link query is worth running. True for almost nobody, which keeps the gate off the hot path. */
export function needsLinkLookup(s: GuardianSubject, flagOn: boolean): boolean {
  return flagOn && s.role === "student" && s.email !== null && s.guardianApprovedAt === null;
}

/** A student with an email, no parent approval and no teacher link, while the flag is on. */
export function pendingGuardian(s: GuardianSubject, o: { flagOn: boolean; hasLiveLink: boolean }): boolean {
  return needsLinkLookup(s, o.flagOn) && !o.hasLiveLink;
}

/**
 * What a pending account may still do: read itself, ask for approval, sign out, erase itself (erasure does not
 * pause, as for a suspended account) and join a class with a teacher's code, the other way in. Matched on
 * `originalUrl` through `routeKey`, which strips the query, the `/api` prefix and a trailing slash.
 */
const MAY_REACH = new Set([
  "GET /auth/me",
  "POST /auth/guardian-request",
  "POST /auth/logout",
  "DELETE /auth/users/me",
  "GET /auth/claim",
  "POST /auth/claim",
  "DELETE /auth/claim",
]);

export function guardianMayReach(method: string, originalUrl: string): boolean {
  return MAY_REACH.has(routeKey(method, originalUrl));
}

export type GuardianStatus = "not_required" | "approved" | "needed" | "waiting" | "declined";

/** The latest request that is not superseded, reduced to what the status needs. */
export interface GuardianRequestView {
  decision: "approved" | "declined" | null;
  /** Null until the mail is issued. */
  expiresAt: Date | null;
}

export function guardianStatus(
  s: GuardianSubject,
  o: { flagOn: boolean; hasLiveLink: boolean; request: GuardianRequestView | null; now: Date },
): GuardianStatus {
  if (!o.flagOn || s.role !== "student" || s.email === null) return "not_required";
  if (s.guardianApprovedAt !== null) return "approved";
  if (o.hasLiveLink) return "not_required";
  const r = o.request;
  if (!r) return "needed";
  if (r.decision === "declined") return "declined";
  if (r.expiresAt !== null && r.expiresAt <= o.now) return "needed";
  return "waiting";
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/guardianGate.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/features.ts artifacts/api-server/src/lib/guardianGate.ts artifacts/api-server/src/lib/__tests__/guardianGate.test.ts
git commit -m "Guardian approval: the flag and the pure gate"
```

---

### Task 2: Pure consent helpers

**Files:**
- Create: `artifacts/api-server/src/lib/guardianConsent.ts`
- Test: `artifacts/api-server/src/lib/__tests__/guardianConsent.test.ts`

**Interfaces:**
- Consumes: `isValidEmailAddress(value: unknown): value is string` from `./emailAddress.ts` (pure).
- Produces: `CONSENT_TTL_MS`, `DAY_MS`, `GUARDIAN_LIMITS = { perStudentPerDay: 3, perParentPerDay: 5 }`, `normalizeParentEmail(raw: unknown, ownEmail: string | null): ParentEmailResult`, `generateConsentToken(): string`, `hashConsentToken(token: string): string`, `looksLikeConsentToken(t: unknown): t is string`, `maskEmail(email: string): string`, `limitReached(count: number, max: number): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// artifacts/api-server/src/lib/__tests__/guardianConsent.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  CONSENT_TTL_MS,
  DAY_MS,
  GUARDIAN_LIMITS,
  generateConsentToken,
  hashConsentToken,
  limitReached,
  looksLikeConsentToken,
  maskEmail,
  normalizeParentEmail,
} from "../guardianConsent.ts";

describe("normalizeParentEmail", () => {
  it("trims and lower-cases a valid address", () => {
    assert.deepEqual(normalizeParentEmail("  Parent@Example.COM ", "kid@example.test"), { ok: true, email: "parent@example.com" });
  });
  it("is required: undefined, null, empty and blank are all parent_email_required", () => {
    for (const raw of [undefined, null, "", "   "]) {
      const r = normalizeParentEmail(raw, "kid@example.test");
      assert.equal(r.ok, false);
      if (!r.ok) assert.equal(r.code, "parent_email_required");
    }
  });
  it("refuses something that is not an address, including a non-string", () => {
    for (const raw of ["not-an-email", "a@b", 42, ["p@example.com"], { a: 1 }]) {
      const r = normalizeParentEmail(raw, "kid@example.test");
      assert.equal(r.ok, false, JSON.stringify(raw));
      if (!r.ok) assert.equal(r.code, "parent_email_invalid");
    }
  });
  it("refuses the student's own address, however it is cased or padded", () => {
    const r = normalizeParentEmail(" KID@example.test ", "kid@example.test");
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.code, "parent_email_is_own");
      assert.equal(r.status, 400);
    }
  });
  it("accepts any address when the student has none yet", () => {
    assert.equal(normalizeParentEmail("p@example.com", null).ok, true);
  });
});

describe("consent token", () => {
  it("is 43 url-safe characters, different every time, and recognised by looksLikeConsentToken", () => {
    const a = generateConsentToken();
    const b = generateConsentToken();
    assert.match(a, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(a, b);
    assert.equal(looksLikeConsentToken(a), true);
  });
  it("rejects anything that is not that shape before it reaches the database", () => {
    for (const t of ["", "abc", "a".repeat(42), "a".repeat(44), `${"a".repeat(42)}!`, undefined, null, 5]) {
      assert.equal(looksLikeConsentToken(t), false, String(t));
    }
  });
  it("hashes to a stable sha256 hex that is not the token", () => {
    const t = generateConsentToken();
    assert.equal(hashConsentToken(t), hashConsentToken(t));
    assert.match(hashConsentToken(t), /^[0-9a-f]{64}$/);
    assert.notEqual(hashConsentToken(t), t);
    assert.notEqual(hashConsentToken(t), hashConsentToken(generateConsentToken()));
  });
});

describe("maskEmail", () => {
  it("keeps two characters of a long local part and the whole domain", () => {
    assert.equal(maskEmail("parent@gmail.com"), "pa***@gmail.com");
  });
  it("keeps one character of a short local part", () => {
    assert.equal(maskEmail("ab@x.com"), "a***@x.com");
    assert.equal(maskEmail("a@x.com"), "a***@x.com");
  });
});

describe("limits and constants", () => {
  it("has the numbers the spec states", () => {
    assert.equal(GUARDIAN_LIMITS.perStudentPerDay, 3);
    assert.equal(GUARDIAN_LIMITS.perParentPerDay, 5);
    assert.equal(CONSENT_TTL_MS, 7 * 24 * 60 * 60 * 1000);
    assert.equal(DAY_MS, 24 * 60 * 60 * 1000);
  });
  it("limitReached is true at the cap, not above it", () => {
    assert.equal(limitReached(2, 3), false);
    assert.equal(limitReached(3, 3), true);
    assert.equal(limitReached(4, 3), true);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/guardianConsent.test.ts`
Expected: FAIL (`Cannot find module '../guardianConsent.ts'`).

- [ ] **Step 3: Write the implementation**

```ts
// artifacts/api-server/src/lib/guardianConsent.ts
/**
 * The rules of a parent's approval that need no database: the address, the token, the limits.
 *
 * The token is 32 random bytes, base64url (43 characters). Only its sha256 is ever stored, so the plaintext exists
 * for exactly as long as it takes to put it in the mail. Random and that long, so a plain sha256 is right (the
 * reasoning `loginCode.ts` gives).
 */
import crypto from "node:crypto";
import { isValidEmailAddress } from "./emailAddress.ts";

export const DAY_MS = 24 * 60 * 60 * 1000;
/** A link works for seven days from the moment it is mailed. */
export const CONSENT_TTL_MS = 7 * DAY_MS;
export const GUARDIAN_LIMITS = { perStudentPerDay: 3, perParentPerDay: 5 } as const;

export type ParentEmailResult =
  | { ok: true; email: string }
  | {
      ok: false;
      status: 400;
      code: "parent_email_required" | "parent_email_invalid" | "parent_email_is_own";
      error: string;
    };

const refuse = (
  code: "parent_email_required" | "parent_email_invalid" | "parent_email_is_own",
  error: string,
): ParentEmailResult => ({ ok: false, status: 400, code, error });

/** Trimmed and lower-cased like every address here, and never the student's own. */
export function normalizeParentEmail(raw: unknown, ownEmail: string | null): ParentEmailResult {
  if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
    return refuse("parent_email_required", "A parent's email is required");
  }
  if (!isValidEmailAddress(raw)) {
    return refuse("parent_email_invalid", "That does not look like an email address");
  }
  const email = raw.toLowerCase().trim();
  if (ownEmail !== null && email === ownEmail.toLowerCase().trim()) {
    return refuse("parent_email_is_own", "Enter a parent's email, not your own");
  }
  return { ok: true, email };
}

export function generateConsentToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashConsentToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Shape check only, so a junk path segment never becomes a query. */
export function looksLikeConsentToken(t: unknown): t is string {
  return typeof t === "string" && /^[A-Za-z0-9_-]{43}$/.test(t);
}

/** `parent@gmail.com` → `pa***@gmail.com`; a one- or two-character local part keeps one character. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  const local = email.slice(0, at);
  const keep = local.length > 2 ? 2 : 1;
  return `${local.slice(0, keep)}***${email.slice(at)}`;
}

export function limitReached(count: number, max: number): boolean {
  return count >= max;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/guardianConsent.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/guardianConsent.ts artifacts/api-server/src/lib/__tests__/guardianConsent.test.ts
git commit -m "Guardian approval: parent-email, token and limit helpers"
```

---

### Task 3: The parent's email

**Files:**
- Create: `artifacts/api-server/src/lib/guardianConsentEmail.ts`
- Modify: `artifacts/api-server/src/lib/email.ts` (append `sendGuardianConsentEmail`; `renderEmailShell` is a private function in the same file, defined near the top)
- Test: `artifacts/api-server/src/lib/__tests__/guardianConsentEmail.test.ts`

**Interfaces:**
- Produces: `guardianConsentSubject: string`; `guardianConsentBodyHtml(childFirstName: string, link: string): string` (pure, escapes both inputs); `sendGuardianConsentEmail(to: string, childFirstName: string, link: string): Promise<boolean>` (true = accepted by Resend; false with no key, in which case non-production logs `{ to, link }`).

- [ ] **Step 1: Write the failing test**

```ts
// artifacts/api-server/src/lib/__tests__/guardianConsentEmail.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { guardianConsentBodyHtml, guardianConsentSubject } from "../guardianConsentEmail.ts";

const LINK = "https://app.iqrra.com/guardian/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";

describe("guardianConsentBodyHtml", () => {
  const html = guardianConsentBodyHtml("سلمى", LINK);

  it("names the child and carries the link exactly once as the button target", () => {
    assert.ok(html.includes("سلمى"));
    assert.equal(html.split(`href="${LINK}"`).length - 1, 1);
  });
  it("is bilingual, Arabic first, with the brand spelled the way CI requires", () => {
    assert.ok(html.indexOf('dir="rtl"') < html.indexOf('dir="ltr"'));
    assert.ok(html.includes("«إقرأ»"));
    assert.ok(html.includes("Iqrra"));
    assert.ok(!html.includes("Iqraa"));
    assert.ok(!html.includes("«اقرأ»"));
  });
  it("says what approving means and that the link lasts seven days", () => {
    assert.ok(html.includes("7"));
    assert.match(html, /parent or legal guardian/i);
    assert.ok(html.includes("وليّ"));
  });
  it("escapes the child's name and the link: a first name is typed by the student", () => {
    const evil = guardianConsentBodyHtml('<img src=x onerror=alert(1)>"', 'https://x.test/?a="b"&c=<d>');
    assert.ok(!evil.includes("<img src=x"));
    assert.ok(evil.includes("&lt;img"));
    assert.ok(!evil.includes('href="https://x.test/?a="b"'));
    assert.ok(evil.includes("&quot;"));
  });
  it("has a bilingual subject that names Iqrra", () => {
    assert.ok(guardianConsentSubject.includes("Iqrra"));
    assert.ok(guardianConsentSubject.includes("إقرأ"));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/guardianConsentEmail.test.ts`
Expected: FAIL (`Cannot find module '../guardianConsentEmail.ts'`).

- [ ] **Step 3: Write the implementation**

Create `artifacts/api-server/src/lib/guardianConsentEmail.ts`. **Before writing the Arabic, load the `anthropic-skills:arabic-copy-reviewer` skill and have it review the Arabic paragraphs below; keep the structure, change only wording it flags.** The wording is a draft for a lawyer's read.

```ts
/**
 * The mail a parent receives to approve their child's account. Pure (no logger, no fetch) so a test can load it;
 * `email.ts` wraps it in the shared shell and sends it.
 *
 * The child's first name is typed by the child, so it is escaped like every other interpolation here.
 */
function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const guardianConsentSubject =
  "طلب موافقة وليّ الأمر على حساب في إقرأ / Parent approval for an Iqrra account";

const BUTTON =
  "display:inline-block;background:#0F766E;color:#FFFFFF;text-decoration:none;font-weight:bold;" +
  "padding:12px 24px;border-radius:8px;";

export function guardianConsentBodyHtml(childFirstName: string, link: string): string {
  const name = esc(childFirstName.trim() || "—");
  const href = esc(link);
  return `
    <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-bottom:24px;">
      <p>مرحبًا،</p>
      <p>أنشأ <b>${name}</b> حسابًا في «إقرأ»، وهي منصّة تساعد الطلبة في دروسهم وفق المنهاج الأردني. لا يعمل الحساب إلا بعد موافقتك بصفتك وليّ الأمر.</p>
      <p>بالضغط على «أوافق» في الصفحة التالية تؤكّد أنك وليّ أمر ${name} أو وصيّه القانوني، وأنك توافق على استخدامه «إقرأ» وفق شروط الاستخدام وسياسة الخصوصية. ويمكنك أيضًا الرفض من الصفحة نفسها.</p>
      <p style="text-align:center;margin:24px 0;"><a href="${href}" style="${BUTTON}">مراجعة الطلب</a></p>
      <p>يصلح الرابط لمدة 7 أيام ولمرة واحدة. إذا لم تكن تتوقّع هذه الرسالة فتجاهلها، ولن يُفعَّل الحساب.</p>
    </div>
    <hr style="border:none;border-top:1px solid #E2E8F0;" />
    <div dir="ltr" style="font-family:Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;margin-top:24px;">
      <p>Hello,</p>
      <p><b>${name}</b> created a student account on Iqrra, a platform that helps pupils with their lessons in the Jordanian curriculum. The account does not work until you, as their parent or legal guardian, approve it.</p>
      <p>By pressing “Approve” on the next page you confirm that you are ${name}'s parent or legal guardian and that you agree to their using Iqrra under the terms of use and privacy policy. You can also decline on the same page.</p>
      <p style="text-align:center;margin:24px 0;"><a href="${href}" style="${BUTTON}">Review the request</a></p>
      <p>This link works once and for 7 days. If you were not expecting this email, ignore it and the account will not be activated.</p>
    </div>
  `;
}
```

Append to `artifacts/api-server/src/lib/email.ts`, and add `import { guardianConsentBodyHtml, guardianConsentSubject } from "./guardianConsentEmail.ts";` with the other imports at the top of the file:

```ts

/**
 * The parent's approval mail. Same transport and failure posture as `sendVerificationEmail`: no key means no mail
 * and `false`, and the link is logged outside production so local dev and the DB tests can follow it. In production
 * only the address is logged, because the link is the credential.
 */
export async function sendGuardianConsentEmail(to: string, childFirstName: string, link: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    const loggable = process.env.NODE_ENV === "production" ? { to } : { to, link };
    logger.warn(loggable, "RESEND_API_KEY not set — guardian consent email not sent");
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "Iqrra <onboarding@resend.dev>",
        to,
        subject: guardianConsentSubject,
        html: renderEmailShell(guardianConsentBodyHtml(childFirstName, link)),
      }),
    });
    if (!res.ok) {
      logger.error({ to, status: res.status, body: await res.text() }, "resend send failed (guardian consent)");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err, to }, "resend send threw (guardian consent)");
    return false;
  }
}
```

- [ ] **Step 4: Run the test, then typecheck**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/guardianConsentEmail.test.ts && pnpm run typecheck`
Expected: PASS, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/guardianConsentEmail.ts artifacts/api-server/src/lib/email.ts artifacts/api-server/src/lib/__tests__/guardianConsentEmail.test.ts
git commit -m "Guardian approval: the parent's email"
```

---

### Task 4: Schema, migration, RLS classification

**Files:**
- Modify: `lib/db/src/schema/users.ts` (a column after `guardianConfirmedAt`; a table after `emailVerificationTokens`)
- Create (generated): `lib/db/migrations/0018_<name>.sql` plus its `meta/` entries
- Modify: `lib/db/src/__tests__/rlsCoverage.test.ts` (`LOCKED` list)

**Interfaces:**
- Produces: `users.guardianApprovedAt`; exported table `guardianConsents` with columns `id, userId, parentEmail, tokenHash (nullable, unique), createdAt, sentAt, expiresAt, decidedAt, decision, supersededAt`.

- [ ] **Step 1: Edit the schema**

In `lib/db/src/schema/users.ts`, directly after the `guardianConfirmedAt` column add:

```ts
  /**
   * When a parent approved this student's account by email (`guardian_consents`). Null until then. Read by
   * `api-server/src/lib/guardianGate.ts`; `guardianConfirmedAt` above is the older tick and is no longer written
   * once `GUARDIAN_APPROVAL` is on.
   */
  guardianApprovedAt: timestamp("guardian_approved_at", { withTimezone: true }),
```

After the `emailVerificationTokens` table add:

```ts

/**
 * A parent's approval of a student's account. Owner-only like the other token tables: the parent has no account,
 * so the public route reads it on `systemDb`, and no role the app uses has any grant on it.
 *
 * `tokenHash` and `expiresAt` stay null until the mail is issued: sign-up queues a request before the student has
 * verified their own email, and the plaintext token must exist only when it is mailed (it is never stored).
 * A student has one current request: a newer one sets `supersededAt` on the older.
 */
export const guardianConsents = pgTable(
  "guardian_consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    parentEmail: text("parent_email").notNull(),
    tokenHash: text("token_hash").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decision: text("decision").$type<"approved" | "declined">(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
  },
  t => [
    index("guardian_consents_user_idx").on(t.userId),
    index("guardian_consents_parent_idx").on(t.parentEmail, t.createdAt),
  ],
);
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm --filter @workspace/db run generate`
Expected: a new `lib/db/migrations/0018_*.sql` containing `ALTER TABLE "users" ADD COLUMN "guardian_approved_at"…`, `CREATE TABLE "guardian_consents"…` with the user foreign key and both indexes. If `main` already has a `0018`, delete the generated files and the new journal/snapshot entries and re-run after merging `main`.

- [ ] **Step 3: Append the locked-table lines to the generated SQL**

Append to the end of the new `0018_*.sql` (a statement-breakpoint after the last generated statement, exactly as `0008` and `0017` do):

```sql
--> statement-breakpoint
ALTER TABLE "guardian_consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Owner connection only: no policy and no grant, like the token tables (0008). The parent has no account,
-- so the public route and the sign-up code read and write this table on systemDb.
REVOKE ALL ON "guardian_consents" FROM iqraa_app;
```

- [ ] **Step 4: Classify the table and run the db tests**

In `lib/db/src/__tests__/rlsCoverage.test.ts` change the `LOCKED` list to:

```ts
const LOCKED = ["email_verification_tokens", "guardian_consents", "password_reset_tokens", "refresh_tokens"] as const;
```

Run (Postgres up): `RLS_TEST_DATABASE_URL=postgres://iqraa_dev:devonly@localhost:5432/postgres pnpm --filter @workspace/db test`
Expected: all pass, including "each table is protected, locked, or explicitly deferred" and "the app role … never the locked ones". Also confirm the migration set applies to an empty database (the db suite does this) and that `pnpm run typecheck` is clean.

- [ ] **Step 5: Commit**

```bash
git add lib/db/src/schema/users.ts lib/db/migrations lib/db/src/__tests__/rlsCoverage.test.ts
git commit -m "Guardian approval: guardian_approved_at and the guardian_consents table"
```

---

### Task 5: The service and the parent's public page

> **Changed after this plan was written (ruling R10, final fix wave):** the token no longer travels in a path. The mail links to `{origin}/guardian#{token}`, and the public API is `POST /guardian-consent/lookup` `{token}` and `POST /guardian-consent/decide` `{token, decision, confirmGuardian}`; `GET /guardian-consent/:token`, `POST /guardian-consent/:token` and the path redaction (`lib/logUrl.ts`) below no longer exist. The code snippets in this section show the original shapes. The spec is current.

**Files:**
- Create: `artifacts/api-server/src/lib/rosterLinkState.ts`, `artifacts/api-server/src/lib/guardianRequests.ts`, `artifacts/api-server/src/routes/guardianConsent.ts`
- Modify: `artifacts/api-server/src/routes/auth.ts` (replace the private `hasLiveRosterLink` with an import), `artifacts/api-server/src/routes/index.ts` (mount), `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts` (pin), `artifacts/api-server/src/routes/__tests__/mountOrder.test.ts`
- Test: `artifacts/api-server/src/routes/__tests__/guardianApproval.db.test.ts` (created here, grown in Tasks 6-8)

**Interfaces:**
- Consumes: `generateConsentToken`, `hashConsentToken`, `looksLikeConsentToken`, `CONSENT_TTL_MS`, `DAY_MS` (Task 2); `sendGuardianConsentEmail` (Task 3); `guardianConsents`, `users` (Task 4); `guardianApprovalEnabled` (Task 1).
- Produces (`rosterLinkState.ts`): `hasLiveRosterLink(userId: string): Promise<boolean>`.
- Produces (`guardianRequests.ts`): `recentCounts(userId: string, parentEmail: string, now?: Date): Promise<{ forStudent: number; forParent: number }>`; `countForParent(parentEmail: string, now?: Date): Promise<number>`; `queueRequest(userId: string, parentEmail: string): Promise<string>`; `currentRequest(userId: string): Promise<typeof guardianConsents.$inferSelect | null>`; `issueAndSend(userId: string): Promise<{ ok: true; emailSent: boolean; expiresAt: Date; parentEmail: string } | { ok: false; reason: "no_request" | "already_issued" }>`; `sendQueuedGuardianRequest(userId: string): Promise<void>` (never throws; does nothing with the flag off); `lookupByToken(token: unknown, now?: Date): Promise<{ status: "open"; childFirstName: string } | { status: "expired" | "decided" | "invalid" }>`; `decideByToken(token: unknown, decision: "approved" | "declined", now?: Date): Promise<"ok" | "unusable">`.
- Produces (route): `GET /api/guardian-consent/config` → `{ enabled }`; `GET /api/guardian-consent/:token` → the `lookupByToken` result; `POST /api/guardian-consent/:token` body `{ decision, confirmGuardian }` → 200 `{ decision }`, 400 `decision_invalid` / `guardian_confirmation_required`, 410 `consent_link_unusable`; the last two routes answer 404 `guardian_approval_disabled` with the flag off.

- [ ] **Step 1: Write the failing DB tests (public page)**

Create `artifacts/api-server/src/routes/__tests__/guardianApproval.db.test.ts`:

```ts
/**
 * Parent approval for email students (spec: docs/superpowers/specs/2026-10-24-guardian-approval-design.md), against
 * a real database through the built bundle. `on` runs with GUARDIAN_APPROVAL=true, `off` without it.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");

describeDb("parent approval for email students", () => {
  let db: TestDb;
  let on: TestServer;
  let off: TestServer;
  let n = 0;

  const q = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) =>
    (await db.pool.query<T>(text, params)).rows;

  /** A user row. `email: null` is a code-only account; `approved` sets guardian_approved_at. */
  async function mkUser(role: string, o: { email?: string | null; approved?: boolean; verified?: boolean } = {}) {
    n += 1;
    const email = o.email === undefined ? `u${n}@example.test` : o.email;
    return (
      await q<{ id: string }>(
        `INSERT INTO users (first_name, last_name, role, email, email_verified, guardian_approved_at)
         VALUES ($1, 'T', $2, $3, $4, CASE WHEN $5::boolean THEN now() END) RETURNING id`,
        [`Kid${n}`, role, email, o.verified ?? email !== null, o.approved ?? false],
      )
    )[0].id;
  }

  /** An issued consent row with a known token. */
  async function mkConsent(
    userId: string,
    o: { token?: string; expires?: string; decided?: "approved" | "declined"; superseded?: boolean; parent?: string } = {},
  ) {
    const token = o.token ?? newToken();
    await q(
      `INSERT INTO guardian_consents (user_id, parent_email, token_hash, sent_at, expires_at, decided_at, decision, superseded_at)
       VALUES ($1, $2, $3, now(), now() + $4::interval, CASE WHEN $5::text IS NOT NULL THEN now() END, $5::text,
               CASE WHEN $6::boolean THEN now() END)`,
      [userId, o.parent ?? "parent@example.test", sha(token), o.expires ?? "7 days", o.decided ?? null, o.superseded ?? false],
    );
    return token;
  }

  before(async () => {
    db = await setupTestDb();
    on = await startServer({ databaseUrl: db.url, env: { GUARDIAN_APPROVAL: "true" } });
    off = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await off?.stop();
    await db?.drop();
  });

  describe("the parent's public page", () => {
    it("config says whether the flag is on, with or without it", async () => {
      assert.deepEqual((await call(on, "GET", "/guardian-consent/config")).json, { enabled: true });
      assert.deepEqual((await call(off, "GET", "/guardian-consent/config")).json, { enabled: false });
    });

    it("an open link shows the child's first name and nothing else", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const res = await call(on, "GET", `/guardian-consent/${token}`);
      assert.equal(res.status, 200, res.text);
      assert.deepEqual(res.json, { status: "open", childFirstName: res.json.childFirstName });
      assert.match(res.json.childFirstName, /^Kid\d+$/);
      assert.deepEqual(Object.keys(res.json).sort(), ["childFirstName", "status"]);
    });

    it("an unknown, malformed, expired, decided or superseded link says so", async () => {
      const kid = await mkUser("student");
      const status = async (t: string) => (await call(on, "GET", `/guardian-consent/${t}`)).json.status;
      assert.equal(await status(newToken()), "invalid");
      assert.equal(await status("not-a-token"), "invalid");
      assert.equal(await status(await mkConsent(kid, { expires: "-1 day" })), "expired");
      assert.equal(await status(await mkConsent(kid, { decided: "declined" })), "decided");
      assert.equal(await status(await mkConsent(kid, { superseded: true })), "invalid");
    });

    it("approving needs the parent's confirmation, a valid decision, and then unlocks the student once", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const bad = await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "maybe" });
      assert.equal(bad.status, 400);
      assert.equal(bad.json.code, "decision_invalid");
      const unticked = await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "approved" });
      assert.equal(unticked.status, 400);
      assert.equal(unticked.json.code, "guardian_confirmation_required");
      const [before] = await q<{ guardian_approved_at: Date | null }>(`SELECT guardian_approved_at FROM users WHERE id = $1`, [kid]);
      assert.equal(before.guardian_approved_at, null, "a refused approval changes nothing");

      const ok = await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "approved", confirmGuardian: true });
      assert.equal(ok.status, 200, ok.text);
      assert.deepEqual(ok.json, { decision: "approved" });
      const [after] = await q<{ guardian_approved_at: Date | null }>(`SELECT guardian_approved_at FROM users WHERE id = $1`, [kid]);
      assert.ok(after.guardian_approved_at);

      const again = await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "approved", confirmGuardian: true });
      assert.equal(again.status, 410);
      assert.equal(again.json.code, "consent_link_unusable");
      assert.equal((await call(on, "GET", `/guardian-consent/${token}`)).json.status, "decided");
    });

    it("declining records the decision and leaves the account locked; it needs no confirmation tick", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const res = await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "declined" });
      assert.equal(res.status, 200, res.text);
      const [u] = await q<{ guardian_approved_at: Date | null }>(`SELECT guardian_approved_at FROM users WHERE id = $1`, [kid]);
      assert.equal(u.guardian_approved_at, null);
      const [c] = await q<{ decision: string; decided_at: Date }>(`SELECT decision, decided_at FROM guardian_consents WHERE token_hash = $1`, [sha(token)]);
      assert.equal(c.decision, "declined");
      assert.ok(c.decided_at);
    });

    it("an expired, superseded or unknown link cannot be decided (410) and changes nothing", async () => {
      const kid = await mkUser("student");
      for (const token of [await mkConsent(kid, { expires: "-1 day" }), await mkConsent(kid, { superseded: true }), newToken()]) {
        const res = await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "approved", confirmGuardian: true });
        assert.equal(res.status, 410, token);
      }
      const [u] = await q<{ guardian_approved_at: Date | null }>(`SELECT guardian_approved_at FROM users WHERE id = $1`, [kid]);
      assert.equal(u.guardian_approved_at, null);
    });

    it("two parents clicking at once: exactly one wins", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const body = { decision: "approved", confirmGuardian: true };
      const results = await Promise.all([1, 2, 3].map(() => call(on, "POST", `/guardian-consent/${token}`, undefined, body)));
      assert.deepEqual(results.map(r => r.status).sort(), [200, 410, 410]);
    });

    it("with the flag off the page and the decision are closed (404), only config answers", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const get = await call(off, "GET", `/guardian-consent/${token}`);
      assert.equal(get.status, 404);
      assert.equal(get.json.code, "guardian_approval_disabled");
      const post = await call(off, "POST", `/guardian-consent/${token}`, undefined, { decision: "approved", confirmGuardian: true });
      assert.equal(post.status, 404);
    });
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run (Postgres up, bundle built): `cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://iqraa_dev:devonly@localhost:5432/postgres node --experimental-strip-types --test src/routes/__tests__/guardianApproval.db.test.ts`
Expected: FAIL (the routes 404 / the table is missing from the bundle's code).

- [ ] **Step 3: Move `hasLiveRosterLink` out of `routes/auth.ts`**

Create `artifacts/api-server/src/lib/rosterLinkState.ts` with the function exactly as it is now in `routes/auth.ts` (lines ~320-337, with its doc comment), importing from the pool that bypasses row-level security because the auth middleware asks it before any identity exists:

```ts
/**
 * Whether an account holds a roster link to a student who is not archived.
 *
 * Lives here, not in `routes/auth.ts`, because the auth middleware needs the same answer to decide whether a
 * student is held for a parent's approval, and a middleware cannot import a route. Archived rows do not count:
 * `/messaging/contacts` already drops them, and this is that rule.
 */
import { systemDb as db, rosterLinks, students } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

export async function hasLiveRosterLink(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: rosterLinks.id })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .where(and(eq(rosterLinks.userId, userId), isNull(students.archivedAt)))
    .limit(1);
  return !!row;
}
```

In `routes/auth.ts`: delete the local `async function hasLiveRosterLink` and its doc comment, and add `import { hasLiveRosterLink } from "../lib/rosterLinkState.ts";` next to the other `lib` imports. Run `pnpm run typecheck` in `artifacts/api-server`: no errors, every existing call site unchanged.

- [ ] **Step 4: Write the service**

Create `artifacts/api-server/src/lib/guardianRequests.ts`:

```ts
/**
 * Parent-approval requests: queue one, mail it, look it up by the parent's link, decide it.
 *
 * `systemDb` on purpose (pinned in `systemDbFiles.test.ts`): the parent has no account, so the public route has no
 * identity, and sign-up and verification run before one exists. The table has no grant for the app role.
 *
 * One current request per student. A request is *queued* with no token (sign-up, before the student's own email is
 * verified), then *issued*: the token is generated, only its hash is stored, and the plaintext goes into the mail.
 */
import { systemDb as db, guardianConsents, users } from "@workspace/db";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { logger } from "./logger.js";
import { sendGuardianConsentEmail } from "./email.js";
import { guardianApprovalEnabled } from "./features.js";
import {
  CONSENT_TTL_MS,
  DAY_MS,
  generateConsentToken,
  hashConsentToken,
  looksLikeConsentToken,
} from "./guardianConsent.ts";

/** The app's web origin: the mail links to `{base}/guardian/{token}`. */
function linkBase(): string {
  return (process.env.GUARDIAN_LINK_BASE ?? "https://app.iqrra.com").replace(/\/+$/, "");
}

export async function countForParent(parentEmail: string, now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - DAY_MS);
  const [row] = await db
    .select({ n: count() })
    .from(guardianConsents)
    .where(and(eq(guardianConsents.parentEmail, parentEmail), gt(guardianConsents.createdAt, since)));
  return Number(row?.n ?? 0);
}

export async function recentCounts(
  userId: string,
  parentEmail: string,
  now: Date = new Date(),
): Promise<{ forStudent: number; forParent: number }> {
  const since = new Date(now.getTime() - DAY_MS);
  const [s] = await db
    .select({ n: count() })
    .from(guardianConsents)
    .where(and(eq(guardianConsents.userId, userId), gt(guardianConsents.createdAt, since)));
  return { forStudent: Number(s?.n ?? 0), forParent: await countForParent(parentEmail, now) };
}

/** Supersedes the student's open request and queues a new one with no token. Returns the new row's id. */
export async function queueRequest(userId: string, parentEmail: string): Promise<string> {
  return db.transaction(async tx => {
    await tx
      .update(guardianConsents)
      .set({ supersededAt: new Date() })
      .where(
        and(
          eq(guardianConsents.userId, userId),
          isNull(guardianConsents.decidedAt),
          isNull(guardianConsents.supersededAt),
        ),
      );
    const [row] = await tx
      .insert(guardianConsents)
      .values({ userId, parentEmail })
      .returning({ id: guardianConsents.id });
    return row!.id;
  });
}

/** The newest request that has not been superseded (declined ones included). */
export async function currentRequest(userId: string): Promise<typeof guardianConsents.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(guardianConsents)
    .where(and(eq(guardianConsents.userId, userId), isNull(guardianConsents.supersededAt)))
    .orderBy(desc(guardianConsents.createdAt))
    .limit(1);
  return row ?? null;
}

export type IssueResult =
  | { ok: true; emailSent: boolean; expiresAt: Date; parentEmail: string }
  | { ok: false; reason: "no_request" | "already_issued" };

/**
 * Generates the token for the current queued request, stores its hash and seven-day expiry, and mails the link.
 * `sent_at` is stamped only when the provider accepted the mail, so a failed send can be resent.
 */
export async function issueAndSend(userId: string): Promise<IssueResult> {
  const cur = await currentRequest(userId);
  if (!cur || cur.decidedAt) return { ok: false, reason: "no_request" };
  if (cur.tokenHash) return { ok: false, reason: "already_issued" };

  const token = generateConsentToken();
  const expiresAt = new Date(Date.now() + CONSENT_TTL_MS);
  // Conditional on the token still being null, so two concurrent issues cannot both mail a link.
  const [claimed] = await db
    .update(guardianConsents)
    .set({ tokenHash: hashConsentToken(token), expiresAt })
    .where(and(eq(guardianConsents.id, cur.id), isNull(guardianConsents.tokenHash)))
    .returning({ id: guardianConsents.id });
  if (!claimed) return { ok: false, reason: "already_issued" };

  const [kid] = await db.select({ firstName: users.firstName }).from(users).where(eq(users.id, userId)).limit(1);
  const emailSent = await sendGuardianConsentEmail(cur.parentEmail, kid?.firstName ?? "", `${linkBase()}/guardian/${token}`);
  if (emailSent) {
    await db.update(guardianConsents).set({ sentAt: new Date() }).where(eq(guardianConsents.id, cur.id));
  }
  return { ok: true, emailSent, expiresAt, parentEmail: cur.parentEmail };
}

/**
 * Issues the request a sign-up queued, now that the student's own email is verified. Does nothing with the flag
 * off or when there is nothing queued, and never throws: the verification that called it has already succeeded.
 */
export async function sendQueuedGuardianRequest(userId: string): Promise<void> {
  if (!guardianApprovalEnabled()) return;
  try {
    const cur = await currentRequest(userId);
    if (cur && !cur.decidedAt && !cur.tokenHash) await issueAndSend(userId);
  } catch (err) {
    logger.error({ err, userId }, "could not send the queued guardian request");
  }
}

export type TokenView =
  | { status: "open"; childFirstName: string }
  | { status: "expired" | "decided" | "invalid" };

/** What the parent's page shows for a token: the child's first name when open, otherwise only why not. */
export async function lookupByToken(token: unknown, now: Date = new Date()): Promise<TokenView> {
  if (!looksLikeConsentToken(token)) return { status: "invalid" };
  const [row] = await db
    .select({
      decidedAt: guardianConsents.decidedAt,
      supersededAt: guardianConsents.supersededAt,
      expiresAt: guardianConsents.expiresAt,
      firstName: users.firstName,
    })
    .from(guardianConsents)
    .innerJoin(users, eq(users.id, guardianConsents.userId))
    .where(eq(guardianConsents.tokenHash, hashConsentToken(token)))
    .limit(1);
  if (!row || row.supersededAt) return { status: "invalid" };
  if (row.decidedAt) return { status: "decided" };
  if (!row.expiresAt || row.expiresAt <= now) return { status: "expired" };
  return { status: "open", childFirstName: row.firstName };
}

/**
 * Records the parent's decision. One conditional update, so a token works once and two clicks cannot both win;
 * approving sets `users.guardian_approved_at` in the same transaction.
 */
export async function decideByToken(
  token: unknown,
  decision: "approved" | "declined",
  now: Date = new Date(),
): Promise<"ok" | "unusable"> {
  if (!looksLikeConsentToken(token)) return "unusable";
  return db.transaction(async tx => {
    const [row] = await tx
      .update(guardianConsents)
      .set({ decision, decidedAt: now })
      .where(
        and(
          eq(guardianConsents.tokenHash, hashConsentToken(token)),
          isNull(guardianConsents.decidedAt),
          isNull(guardianConsents.supersededAt),
          gt(guardianConsents.expiresAt, now),
        ),
      )
      .returning({ userId: guardianConsents.userId });
    if (!row) return "unusable";
    if (decision === "approved") {
      await tx.update(users).set({ guardianApprovedAt: now }).where(eq(users.id, row.userId));
    }
    return "ok";
  });
}
```

- [ ] **Step 5: Write the public router and mount it**

Create `artifacts/api-server/src/routes/guardianConsent.ts`:

```ts
/**
 * The parent's approval page, with no login: the parent has no account, the link is the credential.
 *
 * Every path starts `/guardian-consent`, so this router, mounted at the root, shadows nothing (the lesson in
 * `mountOrder.test.ts`). `GET /guardian-consent/config` is declared before `/:token`, or "config" would be read as
 * a token. Rate limited per IP, and it never says whether a token ever existed beyond "this link does not work".
 */
import { Router } from "express";
import { logger } from "../lib/logger.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { guardianApprovalEnabled } from "../lib/features.js";
import { decideByToken, lookupByToken } from "../lib/guardianRequests.ts";

const router = Router();
const limiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, name: "guardian-consent" });

const disabled = { code: "guardian_approval_disabled", error: "Not available" };

router.get("/guardian-consent/config", (_req, res) => {
  res.json({ enabled: guardianApprovalEnabled() });
});

router.get("/guardian-consent/:token", limiter, async (req, res) => {
  if (!guardianApprovalEnabled()) {
    res.status(404).json(disabled);
    return;
  }
  try {
    res.json(await lookupByToken(req.params["token"]));
  } catch (err) {
    logger.error({ err }, "guardian consent lookup failed");
    res.status(500).json({ error: "Could not load this request" });
  }
});

router.post("/guardian-consent/:token", limiter, async (req, res) => {
  if (!guardianApprovalEnabled()) {
    res.status(404).json(disabled);
    return;
  }
  try {
    const body = (req.body ?? {}) as { decision?: unknown; confirmGuardian?: unknown };
    if (body.decision !== "approved" && body.decision !== "declined") {
      res.status(400).json({ error: "Choose approve or decline", code: "decision_invalid" });
      return;
    }
    // A literal true, like the terms tick: approving is a statement the parent makes.
    if (body.decision === "approved" && body.confirmGuardian !== true) {
      res.status(400).json({ error: "Confirm that you are this child's parent or legal guardian", code: "guardian_confirmation_required" });
      return;
    }
    const outcome = await decideByToken(req.params["token"], body.decision);
    if (outcome !== "ok") {
      res.status(410).json({ error: "This link no longer works", code: "consent_link_unusable" });
      return;
    }
    res.json({ decision: body.decision });
  } catch (err) {
    logger.error({ err }, "guardian consent decision failed");
    res.status(500).json({ error: "Could not record your answer" });
  }
});

export default router;
```

In `artifacts/api-server/src/routes/index.ts` add `import guardianConsentRouter from "./guardianConsent";` beside `studentAttemptRouter`'s import, and mount it directly above `router.use(studentAttemptRouter);` with this comment:

```ts
// The parent's approval page: public (the parent has no account), every path under /guardian-consent, rate limited.
router.use(guardianConsentRouter);
```

- [ ] **Step 6: Pin the two new `systemDb` users**

In `artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts`, add to `ALLOWED` (keep the existing entries):

```ts
  "lib/rosterLinkState.ts": "the auth middleware asks whether a student has a teacher link before any identity is set, to decide if a parent must approve",
  "lib/guardianRequests.ts": "the parent's approval link has no user, and sign-up and verification queue and mail the request before one exists; the table has no app-role grant",
```

- [ ] **Step 7: Add the mount-order checks**

In `mountOrder.test.ts`, inside the existing `describe`, add (the server there has no database and no flag):

```ts
  it("serves the guardian-approval config without a token, and closes the rest with the flag off", async () => {
    const config = await fetch(`${base}/guardian-consent/config`);
    assert.equal(config.status, 200);
    assert.deepEqual(await config.json(), { enabled: false });
    const page = await fetch(`${base}/guardian-consent/${"a".repeat(43)}`);
    assert.equal(page.status, 404);
    assert.equal(((await page.json()) as { code: string }).code, "guardian_approval_disabled");
  });

  it("does not let the guardian-consent router shadow an unowned path", async () => {
    const res = await fetch(`${base}/guardian-consents-typo`);
    assert.equal(res.status, 404);
  });
```

- [ ] **Step 8: Run everything for this task**

Run: `cd artifacts/api-server && pnpm run typecheck && pnpm build && TEST_DATABASE_URL=postgres://iqraa_dev:devonly@localhost:5432/postgres REQUIRE_DB_TESTS=true node --experimental-strip-types --test src/routes/__tests__/guardianApproval.db.test.ts src/routes/__tests__/mountOrder.test.ts src/lib/__tests__/systemDbFiles.test.ts`
Expected: typecheck clean; all pass.

- [ ] **Step 9: Commit**

```bash
git add artifacts/api-server/src/lib/rosterLinkState.ts artifacts/api-server/src/lib/guardianRequests.ts artifacts/api-server/src/routes/guardianConsent.ts artifacts/api-server/src/routes/index.ts artifacts/api-server/src/routes/auth.ts artifacts/api-server/src/lib/__tests__/systemDbFiles.test.ts artifacts/api-server/src/routes/__tests__/mountOrder.test.ts artifacts/api-server/src/routes/__tests__/guardianApproval.db.test.ts
git commit -m "Guardian approval: the request service and the parent's public page"
```

---

### Task 6: The gate in the auth middleware

**Files:**
- Modify: `artifacts/api-server/src/middlewares/auth.ts`
- Test: `artifacts/api-server/src/routes/__tests__/guardianApproval.db.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: `guardianApprovalEnabled` (Task 1), `needsLinkLookup`, `pendingGuardian`, `guardianMayReach` (Task 1), `hasLiveRosterLink` (Task 5).
- Produces: a pending account's non-allowlisted requests answer 403 `guardian_approval_required`.

- [ ] **Step 1: Write the failing tests**

Append inside the outer `describe` of `guardianApproval.db.test.ts`:

```ts
  describe("the gate", () => {
    async function linked(userId: string) {
      const teacher = await mkUser("teacher");
      const [stu] = await q<{ id: string }>(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'x') RETURNING id`, [teacher]);
      await q(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [stu.id, userId]);
    }
    const blocked = (r: { status: number; json: any }) => {
      assert.equal(r.status, 403);
      assert.equal(r.json.code, "guardian_approval_required");
    };

    it("holds a pending email student on a route from each router, and lets the allowlist through", async () => {
      const kid = await mkUser("student");
      blocked(await call(on, "GET", "/student/exams", kid));
      blocked(await call(on, "GET", "/messaging/contacts", kid));
      blocked(await call(on, "POST", "/auth/role", kid, { role: "parent" }));
      blocked(await call(on, "POST", "/auth/add-email", kid, { email: "x@example.test", password: "Sufficiently1Strong!" }));
      blocked(await call(on, "GET", "/auth/me/ai-usage", kid));

      const me = await call(on, "GET", "/auth/me", kid);
      assert.equal(me.status, 200, me.text);
      const claim = await call(on, "GET", "/auth/claim", kid);
      assert.notEqual(claim.status, 403, "joining a class with a teacher's code stays open");
    });

    it("never holds a code-only student, a linked student, an approved student, a teacher or a parent", async () => {
      const codeOnly = await mkUser("student", { email: null });
      const linkedKid = await mkUser("student");
      await linked(linkedKid);
      const approved = await mkUser("student", { approved: true });
      const teacher = await mkUser("teacher");
      const parent = await mkUser("parent");
      for (const id of [codeOnly, linkedKid, approved]) {
        const r = await call(on, "GET", "/student/exams", id);
        assert.equal(r.status, 200, `${id}: ${r.text}`);
      }
      assert.notEqual((await call(on, "GET", "/classes", teacher)).status, 403);
      assert.notEqual((await call(on, "GET", "/parent/exams", parent)).json?.code, "guardian_approval_required");
    });

    it("is inert with the flag off: the same pending student reaches everything", async () => {
      const kid = await mkUser("student");
      const r = await call(off, "GET", "/student/exams", kid);
      assert.equal(r.status, 200, r.text);
    });

    it("lifts the moment a parent approves, without a new sign-in", async () => {
      const kid = await mkUser("student");
      blocked(await call(on, "GET", "/student/exams", kid));
      const token = await mkConsent(kid);
      assert.equal((await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "approved", confirmGuardian: true })).status, 200);
      assert.equal((await call(on, "GET", "/student/exams", kid)).status, 200);
    });

    it("lifts when a teacher's per-student code links the account", async () => {
      const kid = await mkUser("student");
      blocked(await call(on, "GET", "/student/exams", kid));
      await linked(kid);
      assert.equal((await call(on, "GET", "/student/exams", kid)).status, 200);
    });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://iqraa_dev:devonly@localhost:5432/postgres node --experimental-strip-types --test src/routes/__tests__/guardianApproval.db.test.ts`
Expected: the new `the gate` tests FAIL (pending student gets 200).

- [ ] **Step 3: Add the gate to `authMiddleware`**

In `artifacts/api-server/src/middlewares/auth.ts` add imports:

```ts
import { guardianApprovalEnabled } from "../lib/features.js";
import { guardianMayReach, needsLinkLookup, pendingGuardian } from "../lib/guardianGate.ts";
import { hasLiveRosterLink } from "../lib/rosterLinkState.ts";
```

Add `guardianApprovedAt: users.guardianApprovedAt,` to the `.select({…})` object. Directly after the suspended-account block (and before `const { suspendedAt: _suspendedAt, … } = user;`) insert:

```ts
    // A student with an email and no teacher's code is held until a parent approves (lib/guardianGate.ts), here
    // for the same reason suspension is: a route added tomorrow is closed to them by default. The cheap checks run
    // first, so the roster-link query is asked only of a student who could be held and is not on the allowlist.
    const guardianOn = guardianApprovalEnabled();
    if (needsLinkLookup(user, guardianOn) && !guardianMayReach(req.method, req.originalUrl || req.url)) {
      if (pendingGuardian(user, { flagOn: guardianOn, hasLiveLink: await hasLiveRosterLink(user.id) })) {
        res.status(403).json({
          error: "A parent must approve this account first.",
          code: "guardian_approval_required",
        });
        return;
      }
    }
```

and extend the destructuring so the approval timestamp is not copied onto `req.user`:

```ts
    const {
      suspendedAt: _suspendedAt,
      suspendedReason: _suspendedReason,
      guardianApprovedAt: _guardianApprovedAt,
      ...principal
    } = user;
```

- [ ] **Step 4: Run, expect pass; run the whole suite for regressions**

Run: `cd artifacts/api-server && pnpm run typecheck && pnpm build && TEST_DATABASE_URL=postgres://iqraa_dev:devonly@localhost:5432/postgres REQUIRE_DB_TESTS=true pnpm test`
Expected: all pass (the middleware change must not affect any existing test, since the flag is off there).

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/middlewares/auth.ts artifacts/api-server/src/routes/__tests__/guardianApproval.db.test.ts
git commit -m "Guardian approval: the server holds a pending student"
```

---

### Task 7: Asking for approval, and telling the app

**Files:**
- Modify: `artifacts/api-server/src/routes/auth.ts` (`POST /guardian-request`, `GET /me`)
- Test: `artifacts/api-server/src/routes/__tests__/guardianApproval.db.test.ts` (append)

**Interfaces:**
- Consumes: `normalizeParentEmail`, `GUARDIAN_LIMITS`, `limitReached`, `maskEmail` (Task 2); `queueRequest`, `issueAndSend`, `recentCounts`, `currentRequest` (Task 5); `guardianStatus` (Task 1).
- Produces: `POST /api/auth/guardian-request` body `{ parentEmail }` → 200 `{ parentEmailMasked, emailSent, expiresAt }`; 400 `parent_email_*`; 404 `guardian_approval_disabled`; 409 `guardian_not_required` | `guardian_already_approved` | `email_not_verified`; 429 `guardian_rate_limited`. `GET /api/auth/me` gains `guardianStatus` and, for needed/waiting/declined, `guardianParentEmailMasked`.

- [ ] **Step 1: Write the failing tests**

Append inside the outer `describe`:

```ts
  describe("asking for approval and reading the status", () => {
    /** Every parent link the `on` server has logged so far, oldest first. */
    const links = () => [...on.logs().matchAll(/\/guardian\/([A-Za-z0-9_-]{43})/g)].map(m => m[1]);
    const ask = (userId: string, parentEmail: unknown) => call(on, "POST", "/auth/guardian-request", userId, { parentEmail });

    it("a pending student asks: a link is issued once, the row is stored hashed, and /me says waiting", async () => {
      const kid = await mkUser("student");
      const me0 = await call(on, "GET", "/auth/me", kid);
      assert.equal(me0.json.guardianStatus, "needed");
      assert.equal(me0.json.guardianParentEmailMasked, undefined);

      const before = links().length;
      const res = await ask(kid, " Mum@Example.test ");
      assert.equal(res.status, 200, res.text);
      assert.equal(res.json.parentEmailMasked, "mu***@example.test");
      assert.equal(typeof res.json.emailSent, "boolean");
      assert.equal(links().length, before + 1, "exactly one link was issued");
      const token = links().at(-1)!;

      const [row] = await q<{ parent_email: string; token_hash: string; expires_at: Date }>(
        `SELECT parent_email, token_hash, expires_at FROM guardian_consents WHERE user_id = $1`,
        [kid],
      );
      assert.equal(row.parent_email, "mum@example.test");
      assert.equal(row.token_hash, sha(token));
      assert.ok(Math.abs(row.expires_at.getTime() - (Date.now() + 7 * 86400_000)) < 60_000, "seven days");

      const me = await call(on, "GET", "/auth/me", kid);
      assert.equal(me.json.guardianStatus, "waiting");
      assert.equal(me.json.guardianParentEmailMasked, "mu***@example.test");
      assert.equal((await call(on, "GET", `/guardian-consent/${token}`)).json.status, "open");
    });

    it("asking again supersedes the old link: only the newest one works", async () => {
      const kid = await mkUser("student");
      assert.equal((await ask(kid, "a@example.test")).status, 200);
      const first = links().at(-1)!;
      assert.equal((await ask(kid, "b@example.test")).status, 200);
      const second = links().at(-1)!;
      assert.notEqual(first, second);
      assert.equal((await call(on, "GET", `/guardian-consent/${first}`)).json.status, "invalid");
      assert.equal((await call(on, "GET", `/guardian-consent/${second}`)).json.status, "open");
    });

    it("a declined student can ask again with another address and is then waiting again", async () => {
      const kid = await mkUser("student");
      assert.equal((await ask(kid, "a@example.test")).status, 200);
      await call(on, "POST", `/guardian-consent/${links().at(-1)}`, undefined, { decision: "declined" });
      assert.equal((await call(on, "GET", "/auth/me", kid)).json.guardianStatus, "declined");
      assert.equal((await ask(kid, "b@example.test")).status, 200);
      assert.equal((await call(on, "GET", "/auth/me", kid)).json.guardianStatus, "waiting");
    });

    it("refuses a missing, malformed or own address (400) before issuing anything", async () => {
      const kid = await mkUser("student", { email: "kid@example.test" });
      const before = links().length;
      for (const [value, code] of [[undefined, "parent_email_required"], ["nope", "parent_email_invalid"], ["KID@example.test", "parent_email_is_own"]] as const) {
        const r = await ask(kid, value);
        assert.equal(r.status, 400, String(value));
        assert.equal(r.json.code, code);
      }
      assert.equal(links().length, before);
      assert.deepEqual(await q(`SELECT 1 FROM guardian_consents WHERE user_id = $1`, [kid]), []);
    });

    it("needs the student's own email verified first (409)", async () => {
      const kid = await mkUser("student", { verified: false });
      const r = await ask(kid, "p@example.test");
      assert.equal(r.status, 409);
      assert.equal(r.json.code, "email_not_verified");
    });

    it("is not for anyone who is not held: approved, linked, code-only, teacher (409 or 403, nothing queued)", async () => {
      const approved = await mkUser("student", { approved: true });
      const r = await ask(approved, "p@example.test");
      assert.equal(r.status, 409);
      assert.equal(r.json.code, "guardian_already_approved");
      const teacher = await mkUser("teacher");
      const t = await ask(teacher, "p@example.test");
      assert.equal(t.status, 409);
      assert.equal(t.json.code, "guardian_not_required");
      assert.deepEqual(await q(`SELECT 1 FROM guardian_consents WHERE user_id = ANY($1::uuid[])`, [[approved, teacher]]), []);
    });

    it("stops at 3 requests a day per student and 5 a day per parent address (429)", async () => {
      const kid = await mkUser("student");
      for (let i = 0; i < 3; i += 1) assert.equal((await ask(kid, `p${i}@example.test`)).status, 200, `request ${i + 1}`);
      const over = await ask(kid, "p9@example.test");
      assert.equal(over.status, 429);
      assert.equal(over.json.code, "guardian_rate_limited");

      for (let i = 0; i < 5; i += 1) {
        const other = await mkUser("student");
        assert.equal((await ask(other, "shared@example.test")).status, 200, `student ${i + 1}`);
      }
      const sixth = await mkUser("student");
      assert.equal((await ask(sixth, "shared@example.test")).status, 429);
    });

    it("with the flag off the route does not exist for them (404) and /me says not_required", async () => {
      const kid = await mkUser("student");
      const r = await call(off, "POST", "/auth/guardian-request", kid, { parentEmail: "p@example.test" });
      assert.equal(r.status, 404);
      assert.equal(r.json.code, "guardian_approval_disabled");
      assert.equal((await call(off, "GET", "/auth/me", kid)).json.guardianStatus, "not_required");
    });

    it("/me says not_required for a teacher, a code-only student and a linked student, approved for an approved one", async () => {
      const teacher = await mkUser("teacher");
      const codeOnly = await mkUser("student", { email: null });
      const approved = await mkUser("student", { approved: true });
      assert.equal((await call(on, "GET", "/auth/me", teacher)).json.guardianStatus, "not_required");
      assert.equal((await call(on, "GET", "/auth/me", codeOnly)).json.guardianStatus, "not_required");
      assert.equal((await call(on, "GET", "/auth/me", approved)).json.guardianStatus, "approved");
    });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://iqraa_dev:devonly@localhost:5432/postgres node --experimental-strip-types --test src/routes/__tests__/guardianApproval.db.test.ts`
Expected: the new tests FAIL (route 404; `/me` has no `guardianStatus`).

- [ ] **Step 3: Add the route and the `/me` fields**

In `routes/auth.ts` add imports next to the other `lib` imports:

```ts
import { guardianApprovalEnabled } from "../lib/features.js";
import { guardianStatus } from "../lib/guardianGate.ts";
import { GUARDIAN_LIMITS, limitReached, maskEmail, normalizeParentEmail } from "../lib/guardianConsent.ts";
import { currentRequest, issueAndSend, queueRequest, recentCounts } from "../lib/guardianRequests.ts";
```

(`studentAccountsEnabled` is already imported from `../lib/features.js`; add `guardianApprovalEnabled` to that existing import instead of a second line if the linter objects.) Add a limiter beside the other per-user limiters:

```ts
const guardianRequestLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20, name: "guardian-request", key: perUser });
```

Add the route directly above `// POST /auth/login`:

```ts
/**
 * POST /auth/guardian-request — a held student gives (or changes) their parent's email and a link is mailed.
 *
 * Allowed through the middleware gate (lib/guardianGate.ts) because it is how a held student gets out. Each call
 * supersedes the previous link. Limited to 3 a day per student and 5 a day per parent address, counted from
 * `guardian_consents`, on top of the per-user hourly limiter above.
 */
router.post("/guardian-request", authMiddleware, guardianRequestLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    if (!guardianApprovalEnabled()) {
      res.status(404).json({ code: "guardian_approval_disabled", error: "Not available" });
      return;
    }
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.id)).limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const status = guardianStatus(user, {
      flagOn: true,
      hasLiveLink: user.role === "student" ? await hasLiveRosterLink(user.id) : false,
      request: await currentRequestView(user.id),
      now: new Date(),
    });
    if (status === "approved") {
      res.status(409).json({ error: "This account is already approved", code: "guardian_already_approved" });
      return;
    }
    if (status === "not_required") {
      res.status(409).json({ error: "This account does not need a parent's approval", code: "guardian_not_required" });
      return;
    }
    if (!user.emailVerified) {
      res.status(409).json({ error: "Verify your own email first", code: "email_not_verified" });
      return;
    }
    const parent = normalizeParentEmail((req.body ?? {}).parentEmail, user.email);
    if (!parent.ok) {
      res.status(parent.status).json({ error: parent.error, code: parent.code });
      return;
    }
    const counts = await recentCounts(user.id, parent.email);
    if (limitReached(counts.forStudent, GUARDIAN_LIMITS.perStudentPerDay) || limitReached(counts.forParent, GUARDIAN_LIMITS.perParentPerDay)) {
      res.status(429).json({ error: "Too many requests. Try again tomorrow.", code: "guardian_rate_limited" });
      return;
    }
    await queueRequest(user.id, parent.email);
    const issued = await issueAndSend(user.id);
    res.json({
      parentEmailMasked: maskEmail(parent.email),
      emailSent: issued.ok ? issued.emailSent : false,
      expiresAt: issued.ok ? issued.expiresAt : null,
    });
  } catch (err) {
    logger.error({ err }, "guardian request failed");
    res.status(500).json({ error: "Could not send the request" });
  }
});
```

and, beside `hasLiveRosterLink`'s old position, a small local helper used by this route and by `/me`:

```ts
/** The current request reduced to what `guardianStatus` reads; null when the flag is off or none exists. */
async function currentRequestView(userId: string) {
  if (!guardianApprovalEnabled()) return null;
  const cur = await currentRequest(userId);
  return cur ? { decision: cur.decision, expiresAt: cur.expiresAt } : null;
}
```

In `GET /me`, after `hasRosterLink` is computed and before `res.json`, add:

```ts
    const guardian = guardianStatus(user, {
      flagOn: guardianApprovalEnabled(),
      hasLiveLink: hasRosterLink === true,
      request: user.role === "student" ? await currentRequestView(user.id) : null,
      now: new Date(),
    });
    const guardianRequest = guardian === "waiting" || guardian === "declined" ? await currentRequest(user.id) : null;
```

and add to the `res.json({ … })` object, after `lastLogin: user.lastLogin,`:

```ts
      // Whether a parent must approve this student's account, and where the request stands. The app reads it on
      // every boot and again whenever a call answers guardian_approval_required.
      guardianStatus: guardian,
      ...(guardianRequest ? { guardianParentEmailMasked: maskEmail(guardianRequest.parentEmail) } : {}),
```

- [ ] **Step 4: Run, expect pass**

Run: `cd artifacts/api-server && pnpm run typecheck && pnpm build && TEST_DATABASE_URL=postgres://iqraa_dev:devonly@localhost:5432/postgres node --experimental-strip-types --test src/routes/__tests__/guardianApproval.db.test.ts`
Expected: typecheck clean, all pass.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/routes/auth.ts artifacts/api-server/src/routes/__tests__/guardianApproval.db.test.ts
git commit -m "Guardian approval: ask for approval, and tell the app where it stands"
```

---

### Task 8: Sign-up, verification, Google and role switch

**Files:**
- Modify: `artifacts/api-server/src/lib/roleSwitch.ts`, `artifacts/api-server/src/routes/auth.ts` (register, verify-email, Google new account, `/role`, Google role-conflict path)
- Test: `artifacts/api-server/src/lib/__tests__/roleSwitchGuardian.test.ts` (create), `guardianApproval.db.test.ts` (append)

**Interfaces:**
- Consumes: everything above.
- Produces: with the flag on, `POST /auth/register` and `POST /auth/google` (new student) take `parentEmail` instead of the tick; the request is queued at sign-up and issued after the student's email is verified (`verify-email` or Google's already-verified address); `decideRoleSwitch` takes `ageTickRequired?: boolean` (default true).

- [ ] **Step 1: Write the failing unit test for the role switch**

```ts
// artifacts/api-server/src/lib/__tests__/roleSwitchGuardian.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { decideRoleSwitch } from "../roleSwitch.ts";

const base = {
  currentRole: "teacher",
  requestedRole: "student",
  studentAccountsEnabled: true,
  hasRosterLink: async () => false,
  hasTeachingData: async () => false,
};

describe("decideRoleSwitch with a parent's approval instead of the tick", () => {
  it("still asks for the tick by default", async () => {
    const d = await decideRoleSwitch(base);
    assert.equal(d.ok, false);
    if (!d.ok) assert.equal(d.code, "age_confirmation_required");
  });
  it("does not ask for it when ageTickRequired is false", async () => {
    const d = await decideRoleSwitch({ ...base, ageTickRequired: false });
    assert.deepEqual(d, { ok: true, role: "student", changed: true });
  });
  it("still refuses a linked or teaching account first, whatever the tick setting", async () => {
    const linked = await decideRoleSwitch({ ...base, currentRole: "parent", ageTickRequired: false, hasRosterLink: async () => true });
    assert.equal(linked.ok, false);
    if (!linked.ok) assert.equal(linked.code, "role_locked_linked");
    const teaching = await decideRoleSwitch({ ...base, ageTickRequired: false, hasTeachingData: async () => true });
    assert.equal(teaching.ok, false);
    if (!teaching.ok) assert.equal(teaching.code, "role_locked_teaching");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/roleSwitchGuardian.test.ts`
Expected: FAIL (`ageTickRequired: false` still returns `age_confirmation_required`).

- [ ] **Step 3: Add `ageTickRequired` to `decideRoleSwitch`**

In `lib/roleSwitch.ts`, add to `RoleSwitchInput` after `ageConfirmed`:

```ts
  /**
   * Whether a change into student needs the tick. True (the default) until `GUARDIAN_APPROVAL` is on: then a
   * parent's approval replaces it, and switching into student just produces an account held for approval.
   */
  ageTickRequired?: boolean;
```

and change the check in `settle()` to:

```ts
    if (changed && role === "student" && (input.ageTickRequired ?? true) && input.ageConfirmed !== true) {
```

Run the test from Step 1 again: PASS.

- [ ] **Step 4: Write the failing DB tests (sign-up and role switch)**

Append inside the outer `describe` of `guardianApproval.db.test.ts`:

```ts
  describe("sign-up, verification and role switch", () => {
    const PASSWORD = "Sufficiently1Strong!";
    const TERMS = { acceptedTerms: true, termsVersion: "2026-10-23" };
    const links = () => [...on.logs().matchAll(/\/guardian\/([A-Za-z0-9_-]{43})/g)].map(m => m[1]);

    const signUp = (server: TestServer, email: string, extra: Record<string, unknown>) =>
      call(server, "POST", "/auth/register", undefined, {
        firstName: "Kid", lastName: "Signup", email, password: PASSWORD, confirmPassword: PASSWORD, role: "student", ...TERMS, ...extra,
      });

    /** The 6-digit code the server logs (no RESEND_API_KEY in tests). */
    async function verificationCode(server: TestServer, email: string): Promise<string> {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const lines = server.logs().split("\n");
        for (let i = lines.length - 1; i >= 0; i -= 1) {
          if (!lines[i].includes(`"${email}"`)) continue;
          for (let k = i; k < Math.min(i + 6, lines.length); k += 1) {
            const m = lines[k].match(/code\S*:\s*"(\d{6})"/);
            if (m) return m[1];
          }
        }
        await new Promise(r => setTimeout(r, 200));
      }
      throw new Error(`no verification code logged for ${email}`);
    }

    it("with the flag on, a student must give a parent's email (not the tick), and not their own", async () => {
      const missing = await signUp(on, "need1@example.test", { ageConfirmed: true });
      assert.equal(missing.status, 400);
      assert.equal(missing.json.code, "parent_email_required");
      const own = await signUp(on, "need2@example.test", { parentEmail: "NEED2@example.test" });
      assert.equal(own.json.code, "parent_email_is_own");
      assert.deepEqual(await q(`SELECT 1 FROM users WHERE email IN ('need1@example.test','need2@example.test')`), [], "nothing was created");
    });

    it("queues the request at sign-up, mails the parent only after the student verifies, then holds them", async () => {
      const email = "flow1@example.test";
      const before = links().length;
      const reg = await signUp(on, email, { parentEmail: "Mum.Flow1@example.test" });
      assert.equal(reg.status, 201, reg.text);
      const [row] = await q<{ id: string; token_hash: string | null; expires_at: Date | null; parent_email: string }>(
        `SELECT c.id, c.token_hash, c.expires_at, c.parent_email FROM guardian_consents c JOIN users u ON u.id = c.user_id WHERE u.email = $1`,
        [email],
      );
      assert.equal(row.parent_email, "mum.flow1@example.test");
      assert.equal(row.token_hash, null, "queued with no token");
      assert.equal(row.expires_at, null);
      assert.equal(links().length, before, "nothing is mailed to the parent before the student verifies");
      const [u] = await q<{ guardian_confirmed_at: Date | null }>(`SELECT guardian_confirmed_at FROM users WHERE email = $1`, [email]);
      assert.equal(u.guardian_confirmed_at, null, "the flag-on path does not record a tick");

      const verified = await call(on, "POST", "/auth/verify-email", undefined, { email, code: await verificationCode(on, email) });
      assert.equal(verified.status, 200, verified.text);
      assert.equal(links().length, before + 1, "the parent is mailed once, after verification");
      const [after] = await q<{ token_hash: string | null }>(`SELECT token_hash FROM guardian_consents WHERE id = $1`, [row.id]);
      assert.equal(after.token_hash, sha(links().at(-1)!));

      const token = verified.json.accessToken as string;
      const held = await fetch(`${on.base}/student/exams`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(held.status, 403);
      assert.equal(((await held.json()) as { code: string }).code, "guardian_approval_required");

      assert.equal((await call(on, "POST", `/guardian-consent/${links().at(-1)}`, undefined, { decision: "approved", confirmGuardian: true })).status, 200);
      const freed = await fetch(`${on.base}/student/exams`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(freed.status, 200);
    });

    it("the parent-address limit applies at sign-up: a sixth student on one address is refused (429) and not created", async () => {
      for (let i = 0; i < 5; i += 1) {
        const r = await signUp(on, `cap${i}@example.test`, { parentEmail: "cap.parent@example.test" });
        assert.equal(r.status, 201, `${i}: ${r.text}`);
      }
      const sixth = await signUp(on, "cap5@example.test", { parentEmail: "cap.parent@example.test" });
      assert.equal(sixth.status, 429);
      assert.equal(sixth.json.code, "guardian_rate_limited");
      assert.deepEqual(await q(`SELECT 1 FROM users WHERE email = 'cap5@example.test'`), []);
    });

    it("a teacher and a parent sign up exactly as before, with no parent email", async () => {
      for (const role of ["teacher", "parent"]) {
        const r = await signUp(on, `${role}.plain@example.test`, { role });
        assert.equal(r.status, 201, `${role}: ${r.text}`);
      }
    });

    it("with the flag off, sign-up is exactly as before: the tick is required, a parent email is ignored", async () => {
      const noTick = await signUp(off, "off1@example.test", { parentEmail: "p@example.test" });
      assert.equal(noTick.status, 400);
      assert.equal(noTick.json.code, "age_confirmation_required");
      const ticked = await signUp(off, "off2@example.test", { ageConfirmed: true, parentEmail: "p@example.test" });
      assert.equal(ticked.status, 201, ticked.text);
      assert.deepEqual(await q(`SELECT 1 FROM guardian_consents c JOIN users u ON u.id = c.user_id WHERE u.email = 'off2@example.test'`), []);
      const [u] = await q<{ guardian_confirmed_at: Date | null }>(`SELECT guardian_confirmed_at FROM users WHERE email = 'off2@example.test'`);
      assert.ok(u.guardian_confirmed_at);
    });

    it("role switch: with the flag on a teacher becomes a held student with no tick; with it off the tick is asked", async () => {
      const t1 = await mkUser("teacher");
      const switched = await call(on, "POST", "/auth/role", t1, { role: "student" });
      assert.equal(switched.status, 200, switched.text);
      const me = await call(on, "GET", "/auth/me", t1);
      assert.equal(me.json.role, "student");
      assert.equal(me.json.guardianStatus, "needed");
      const [u] = await q<{ guardian_confirmed_at: Date | null }>(`SELECT guardian_confirmed_at FROM users WHERE id = $1`, [t1]);
      assert.equal(u.guardian_confirmed_at, null);

      const t2 = await mkUser("teacher");
      const noTick = await call(off, "POST", "/auth/role", t2, { role: "student" });
      assert.equal(noTick.status, 400);
      assert.equal(noTick.json.code, "age_confirmation_required");
      assert.equal((await call(off, "POST", "/auth/role", t2, { role: "student", ageConfirmed: true })).status, 200);
    });
  });
```

- [ ] **Step 5: Run to see them fail**

Run: `cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://iqraa_dev:devonly@localhost:5432/postgres node --experimental-strip-types --test src/routes/__tests__/guardianApproval.db.test.ts`
Expected: the new tests FAIL (register still asks for the tick; no request is queued; the role switch still wants the tick).

- [ ] **Step 6: Wire the routes**

Add to the `lib` imports in `routes/auth.ts` (merge with the Task 7 lines): `countForParent, sendQueuedGuardianRequest` from `../lib/guardianRequests.ts`.

**`/register`** — replace the block that begins `// A student with an email has no teacher's code vouching for them…` through its `if (!age.ok) { … }` with:

```ts
    // A student with an email has no teacher's code vouching for them. With GUARDIAN_APPROVAL on, a parent
    // approves by email (lib/guardianConsent.ts); with it off they tick that they are an adult or have a
    // guardian's agreement (lib/ageConfirmation.ts). The live app still sends the tick until the flag is on.
    const holdForParent = role === "student" && guardianApprovalEnabled();
    let parentEmail = "";
    if (holdForParent) {
      const parent = normalizeParentEmail((req.body as { parentEmail?: unknown }).parentEmail, email);
      if (!parent.ok) {
        res.status(parent.status).json({ error: parent.error, code: parent.code });
        return;
      }
      if (limitReached(await countForParent(parent.email), GUARDIAN_LIMITS.perParentPerDay)) {
        res.status(429).json({ error: "Too many requests for that address. Try again tomorrow.", code: "guardian_rate_limited" });
        return;
      }
      parentEmail = parent.email;
    }
    const age: ReturnType<typeof ageConfirmation> = holdForParent
      ? { ok: true, guardianConfirmedAt: null }
      : ageConfirmation(req.body, role);
    if (!age.ok) {
      res.status(age.status).json({ error: age.error, code: age.code });
      return;
    }
```

and directly after `if (!user) throw new Error("Failed to create user");` add:

```ts
    // Queued with no token: the parent is mailed only after the student has verified their own address.
    if (holdForParent) {
      try {
        await queueRequest(user.id, parentEmail);
      } catch (err) {
        // The account exists and can ask again from the waiting screen; this must not turn a sign-up into a 500.
        logger.error({ err, userId: user.id }, "could not queue the guardian request at sign-up");
      }
    }
```

**`POST /verify-email`** — directly after the `const [verified] = await db.update(users)…returning();` statement add:

```ts
    // The student's own address is now proved, so a parent's approval request queued at sign-up can be mailed.
    if (verified.role === "student") await sendQueuedGuardianRequest(verified.id);
```

**`POST /google` (new account)** — replace the `// Same as /register: a student with no teacher's code confirms their age.` block (`const age = ageConfirmation(req.body, role); if (!age.ok) {…}`) with the same logic, using the Google address:

```ts
        // Same as /register: a parent's approval when GUARDIAN_APPROVAL is on, the age tick otherwise.
        const holdForParent = role === "student" && guardianApprovalEnabled();
        let parentEmail = "";
        if (holdForParent) {
          const parent = normalizeParentEmail((req.body as { parentEmail?: unknown }).parentEmail, email);
          if (!parent.ok) {
            res.status(parent.status).json({ error: parent.error, code: parent.code });
            return;
          }
          if (limitReached(await countForParent(parent.email), GUARDIAN_LIMITS.perParentPerDay)) {
            res.status(429).json({ error: "Too many requests for that address. Try again tomorrow.", code: "guardian_rate_limited" });
            return;
          }
          parentEmail = parent.email;
        }
        const age: ReturnType<typeof ageConfirmation> = holdForParent
          ? { ok: true, guardianConfirmedAt: null }
          : ageConfirmation(req.body, role);
        if (!age.ok) {
          res.status(age.status).json({ error: age.error, code: age.code });
          return;
        }
```

and, immediately after the `[user] = await db.insert(users)…returning();` statement of that branch, add:

```ts
        // Google has already proved the address, so the parent can be mailed at once.
        if (holdForParent && user) {
          try {
            await queueRequest(user.id, parentEmail);
            await sendQueuedGuardianRequest(user.id);
          } catch (err) {
            logger.error({ err, userId: user.id }, "could not queue the guardian request for a Google sign-up");
          }
        }
```

**`POST /role`** — change the `decideRoleSwitch({ … })` call to add one argument after `ageConfirmed`:

```ts
      ageTickRequired: !guardianApprovalEnabled(),
```

and change `...(decision.role === "student" ? { guardianConfirmedAt: new Date() } : {}),` to:

```ts
            ...(decision.role === "student" && !guardianApprovalEnabled() ? { guardianConfirmedAt: new Date() } : {}),
```

**Google existing-account role conflict** — in its `decideRoleSwitch`/`googleRoleConflict` call (the one that passes `ageConfirmed: req.body?.ageConfirmed === true`) add `ageTickRequired: !guardianApprovalEnabled(),` beside it, and change `...(decision.changed && decision.role === "student" ? { guardianConfirmedAt: new Date() } : {}),` to `...(decision.changed && decision.role === "student" && !guardianApprovalEnabled() ? { guardianConfirmedAt: new Date() } : {}),`. If that call goes through a wrapper rather than `decideRoleSwitch` directly, add the field to the wrapper's input type and forward it; run `pnpm run typecheck` to find it.

- [ ] **Step 7: Run everything for this task**

Run: `cd artifacts/api-server && pnpm run typecheck && node --experimental-strip-types --test src/lib/__tests__/roleSwitchGuardian.test.ts src/lib/__tests__/roleSwitch.test.ts && pnpm build && TEST_DATABASE_URL=postgres://iqraa_dev:devonly@localhost:5432/postgres REQUIRE_DB_TESTS=true pnpm test`
Expected: typecheck clean; the whole api-server suite passes, including the tests written for the 2026-10-23 tick (they run with the flag off and must be untouched).

- [ ] **Step 8: Commit**

```bash
git add artifacts/api-server/src/lib/roleSwitch.ts artifacts/api-server/src/routes/auth.ts artifacts/api-server/src/lib/__tests__/roleSwitchGuardian.test.ts artifacts/api-server/src/routes/__tests__/guardianApproval.db.test.ts
git commit -m "Guardian approval: sign-up, verification, Google and role switch"
```

---

### Task 9: Mutation checks, write-up, PR

**Files:**
- Modify: `docs/status-log.md` (new entry at the top), `STATUS.md` (a line in Recent changes, an Open item, the section count), `docs/superpowers/specs/2026-10-24-guardian-approval-design.md` (status line)

- [ ] **Step 1: Mutation checks (each: edit with the Edit tool, `pnpm build`, run the DB test file, expect the named failure, restore with the Edit tool, rebuild, confirm green)**

1. In `middlewares/auth.ts`, change `pendingGuardian(user, { flagOn: guardianOn, hasLiveLink: await hasLiveRosterLink(user.id) })` to pass `hasLiveLink: true`. Expected failures: the gate tests that expect 403.
2. In `lib/guardianGate.ts`, add `"GET /student/exams"` to `MAY_REACH`. Expected: the unit test `stops GET /api/student/exams` and the gate DB test fail.
3. In `lib/guardianRequests.ts` `decideByToken`, remove `isNull(guardianConsents.decidedAt),`. Expected: the single-use and "two parents clicking at once" tests fail.
4. In `lib/guardianRequests.ts` `queueRequest`, remove the superseding `update`. Expected: "asking again supersedes the old link" fails.
5. In `routes/auth.ts` verify-email, remove the `sendQueuedGuardianRequest` call. Expected: the sign-up flow test fails at "the parent is mailed once".

Record in the log which test caught each.

- [ ] **Step 2: Full verification**

Run, in order: `pnpm run typecheck` (repo root); `cd artifacts/api-server && pnpm build && TEST_DATABASE_URL=postgres://iqraa_dev:devonly@localhost:5432/postgres REQUIRE_DB_TESTS=true pnpm test`; `cd ../.. && RLS_TEST_DATABASE_URL=postgres://iqraa_dev:devonly@localhost:5432/postgres pnpm --filter @workspace/db test`.
Expected: all green; note the counts for the PR body.

- [ ] **Step 3: Write-up**

Add at the top of `docs/status-log.md` (directly under the header, before the newest entry) a section titled `## Parent approval for email students — server (PR A) — 2026-10-24` covering: what was built, that `GUARDIAN_APPROVAL` is off by default and nothing changes at merge, the five mutation checks and what caught each, the counts, and **Not verified / known limits**: the Google sign-up path was reviewed but not exercised (no Google credential); the mail was never sent through Resend (no key locally); the app (PR B) does not exist yet, so turning the flag on today would lock existing email students out with no waiting screen; the parent-consent wording is a draft; email-based consent proves mailbox access only. In `STATUS.md`: add `- 2026-10-24 — Parent approval for email students: the server (off)` at the top of Recent changes (drop the oldest line to keep 30), bump `The log has N sections` to the real `grep -c '^## ' docs/status-log.md`, and add an **Open** bullet: `GUARDIAN_APPROVAL` is built and off; do **not** set it until PR B (the app's waiting screen) is out and the parent-consent wording has been read. In the spec set the status line to `**Status:** server implemented (PR A); app (PR B) not started.`

- [ ] **Step 4: Document the two settings**

In `.env.example`, directly after the `# STUDENT_ACCOUNTS=true` line (line 82), add:

```
# [OPTIONAL] Must be exactly "true" to hold every student who signed up with an email (and has no teacher's code)
# until a parent approves by email. Off is the shipping default: turning it on locks existing email students until a
# parent acts, so set it only once the app's waiting screen has reached users and the parent-consent wording has
# been read. See artifacts/api-server/src/lib/features.ts and
# docs/superpowers/specs/2026-10-24-guardian-approval-design.md.
# GUARDIAN_APPROVAL=true

# [OPTIONAL] The web origin the parent's approval mail links to ({origin}/guardian/{token}).
# Default: https://app.iqrra.com
# GUARDIAN_LINK_BASE=https://app.iqrra.com
```

- [ ] **Step 5: Commit, push, draft PR**

```bash
git add .env.example docs/status-log.md STATUS.md docs/superpowers/specs/2026-10-24-guardian-approval-design.md
git commit -m "Guardian approval (server): write-up"
git push -u origin claude/nice-volta-qf1nyt
```

Open a **draft** PR "Parent approval for email students: the server (flag off)". Body: What / Before merging (the migration is additive and runs on deploy; the flag stays unset; do not set it before PR B) / Verified (counts, mutation checks) / Not verified (the list above). Then `subscribe_pr_activity`.
