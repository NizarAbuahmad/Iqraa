import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * `systemDb` is the connection row-level security does not apply to. Every file that
 * reaches for it is a hole in the wall, so the list is pinned here with the reason for
 * each — adding one means editing this test, which is where a reviewer asks "why?".
 *
 * Keep the list short. A file belongs on it only if it must act without a user
 * (login, a link-based exam, a notification fan-out) or read another user's rows to
 * decide something (a block, a push token). A route a signed-in user calls, over data
 * they are entitled to, belongs on `db` — the policies cover it.
 */
const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const ALLOWED: Record<string, string> = {
  "middlewares/auth.ts": "looks the caller up before any identity exists (and skips three round trips per request)",
  "routes/auth.ts": "sign-in, sign-up, refresh, password reset and claim run before — or without — a user identity; they own the token tables",
  "routes/admin.ts": "admin-only routes that read and revoke across every user, plus public site-signup ingestion",
  "routes/moderation.ts": "admin-only: reads the reported thread's messages, which the admin is not a participant of",
  "routes/studentAttempt.ts": "a student takes an exam from a share link with no login, so no identity",
  "routes/messaging.ts": "a recipient's blocks and push tokens belong to the recipient, and a phone handed to another account re-registers a token that still belongs to the last one",
  "routes/roster.ts": "reissuing a login code revokes that account's refresh tokens, and a rename re-derives a linked account's name — both write another user's row, which the app role cannot",
  "lib/evaluationAudience.ts": "read for link-based exams (no identity); an empty read means 'everyone', so it must not be filtered",
  "lib/inboxSummary.ts": "unreadTotals counts each recipient's whole inbox and honours their blocks for the push badge, run under the sender's identity, who cannot see either",
  "lib/classThread.ts": "reconciles who is in a class thread: a student claiming cannot see the thread or the other members' links",
  "lib/rosterLinkState.ts": "the auth middleware asks whether a student has a teacher link before any identity is set, to decide if a parent must approve",
  "lib/guardianRequests.ts": "the parent's approval link has no user, and sign-up and verification queue and mail the request before one exists; the table has no app-role grant",
  "lib/rosterClaim.ts": "resolves a claim code before any roster link for the claimer exists",
  "lib/resultsReleaseNotify.ts": "notifies every linked student and parent, none of whom is the teacher whose request triggered it",
  "lib/familyAccess.ts": "accountsLinkedTo / liveClassStudentIds find the accounts and children a teacher's action is about — other people's roster links and settings, which that teacher cannot see",
  "lib/familyPush.ts": "reads the recipients' device tokens (each belongs to the recipient) and prunes the dead ones; the caller is a teacher",
  "lib/homeworkMaterial.ts": "a student or parent opens the teacher's saved material attached to a homework — the teacher's row, read only after the homework, class and membership checks pass as the caller",
  "lib/homeworkReminders.ts": "the day-before reminder is run by Cloud Scheduler with no user, over every teacher's homework and every family's ticks",
  "lib/adminNotify.ts": "notifies every system admin from a public, unauthenticated request",
  "modules/assessment/attemptGrading.ts": "server-side grading writes the grade tables, which only a teacher's identity may write directly",
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sources(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

describe("which files may use the connection that bypasses row-level security", () => {
  const using = sources(src)
    .filter(f => /\bsystemDb\b/.test(readFileSync(f, "utf8")))
    .map(f => path.relative(src, f).split(path.sep).join("/"))
    .sort();

  test("exactly the pinned files", () => {
    assert.deepEqual(using, Object.keys(ALLOWED).sort());
  });

  test("the auth token tables are only ever touched from a file that may use it", () => {
    const tokenTables = /\b(refreshTokens|passwordResetTokens|emailVerificationTokens)\b/;
    const offenders = sources(src)
      .filter(f => tokenTables.test(readFileSync(f, "utf8")))
      .map(f => path.relative(src, f).split(path.sep).join("/"))
      .filter(f => !(f in ALLOWED));
    assert.deepEqual(offenders, [], "these touch the token tables but are not on the systemDb list — the app role has no access to them");
  });
});
