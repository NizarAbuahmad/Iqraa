/**
 * Who an abuse report may name.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/reportDecision.test.ts
 *
 * The attack these close: moderation acts on `reportedUserId` and `messageId`
 * straight off the report row — suspending the one, archiving the other — and
 * the route that wrote the row only ever checked that the *reporter* belonged
 * to the thread. A participant of any thread could therefore name any
 * non-admin user and any message id, and an approving admin would carry it
 * out against someone who was never part of the conversation.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveReport } from "../reportDecision.ts";

const THREAD = "thread-1";
const REPORTER = "user-reporter";
const TARGET = "user-target";
const OUTSIDER = "user-outsider";

/** Membership and message ownership as plain data; no database in sight. */
function stubs(opts: { members?: string[]; messages?: Record<string, string> } = {}) {
  const members = new Set(opts.members ?? [REPORTER, TARGET]);
  const messages = opts.messages ?? {};
  return {
    isParticipant: async (userId: string) => members.has(userId),
    threadIdOfMessage: async (messageId: string) => messages[messageId] ?? null,
  };
}

describe("resolveReport", () => {
  it("accepts a report naming a participant of the reporter's own thread", async () => {
    const out = await resolveReport({
      threadId: THREAD,
      reporterUserId: REPORTER,
      reportedUserId: TARGET,
      messageId: null,
      ...stubs(),
    });
    assert.deepEqual(out, { ok: true });
  });

  it("refuses a reporter who is not in the thread, without saying it exists", async () => {
    const out = await resolveReport({
      threadId: THREAD,
      reporterUserId: OUTSIDER,
      reportedUserId: TARGET,
      messageId: null,
      ...stubs(),
    });
    assert.equal(out.ok, false);
    assert.equal(out.ok === false && out.status, 404);
    assert.equal(out.ok === false && out.code, "report_thread_not_found");
  });

  it("refuses a target who is not in the thread — the suspension vector", async () => {
    // The whole point: REPORTER is legitimately in the thread and names
    // somebody who never was. Approving this used to suspend that account.
    const out = await resolveReport({
      threadId: THREAD,
      reporterUserId: REPORTER,
      reportedUserId: OUTSIDER,
      messageId: null,
      ...stubs(),
    });
    assert.equal(out.ok, false);
    assert.equal(out.ok === false && out.code, "report_target_not_in_thread");
  });

  it("refuses a message belonging to another thread — the hide vector", async () => {
    const out = await resolveReport({
      threadId: THREAD,
      reporterUserId: REPORTER,
      reportedUserId: TARGET,
      messageId: "msg-elsewhere",
      ...stubs({ messages: { "msg-elsewhere": "thread-2" } }),
    });
    assert.equal(out.ok, false);
    assert.equal(out.ok === false && out.code, "report_message_not_in_thread");
  });

  it("refuses a message that does not exist at all", async () => {
    const out = await resolveReport({
      threadId: THREAD,
      reporterUserId: REPORTER,
      reportedUserId: TARGET,
      messageId: "msg-nonexistent",
      ...stubs(),
    });
    assert.equal(out.ok, false);
    assert.equal(out.ok === false && out.code, "report_message_not_in_thread");
  });

  it("accepts a message that does belong to the thread", async () => {
    const out = await resolveReport({
      threadId: THREAD,
      reporterUserId: REPORTER,
      reportedUserId: TARGET,
      messageId: "msg-1",
      ...stubs({ messages: { "msg-1": THREAD } }),
    });
    assert.deepEqual(out, { ok: true });
  });

  it("admits anyone in a group thread, not just two sides", async () => {
    // A class group has many participants; the rule is membership of this
    // thread, not a two-party relationship.
    const out = await resolveReport({
      threadId: THREAD,
      reporterUserId: REPORTER,
      reportedUserId: "student-7",
      messageId: null,
      ...stubs({ members: [REPORTER, TARGET, "student-7", "student-8"] }),
    });
    assert.deepEqual(out, { ok: true });
  });

  it("does not look a message up when none was named", async () => {
    // Ordering matters for cost, and for the error a caller sees: a report
    // with no message must never fail on message grounds.
    let looked = 0;
    const out = await resolveReport({
      threadId: THREAD,
      reporterUserId: REPORTER,
      reportedUserId: TARGET,
      messageId: null,
      isParticipant: async (u: string) => [REPORTER, TARGET].includes(u),
      threadIdOfMessage: async () => {
        looked++;
        return null;
      },
    });
    assert.deepEqual(out, { ok: true });
    assert.equal(looked, 0);
  });
});
