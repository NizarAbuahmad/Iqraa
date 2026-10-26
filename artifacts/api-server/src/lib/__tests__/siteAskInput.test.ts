/**
 * POST /site/ask body validation.
 *
 * The route is public, so this is the first line of defence: a visitor's
 * message is short, history is short, and a client may never supply a `system`
 * turn. Over a cap is refused, not cut — a silent cut would answer a question
 * the visitor did not ask.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseSiteAsk,
  SITE_ASK_HISTORY_MAX_TURNS,
  SITE_ASK_MESSAGE_MAX_CHARS,
  SITE_ASK_REPLY_MAX_CHARS,
} from "../siteAskInput.ts";

describe("parseSiteAsk", () => {
  it("accepts a question with no history and trims it", () => {
    assert.deepEqual(parseSiteAsk({ message: "  هل إقرأ مجاني؟  " }), {
      ok: true,
      value: { message: "هل إقرأ مجاني؟", history: [] },
    });
  });

  it("accepts up to the cap of earlier turns, in order", () => {
    const history = [
      { role: "user", content: "ما هو إقرأ؟" },
      { role: "assistant", content: "مساعد تحضير للمعلمين." },
      { role: "user", content: "وهل هو مجاني؟" },
      { role: "assistant", content: "نعم في النسخة التجريبية." },
    ];
    assert.equal(history.length, SITE_ASK_HISTORY_MAX_TURNS);
    const parsed = parseSiteAsk({ message: "وما الصفوف؟", history });
    assert.deepEqual(parsed, { ok: true, value: { message: "وما الصفوف؟", history } });
  });

  it("refuses a body that is not an object, and a missing or blank message", () => {
    for (const body of [null, undefined, "hello", 3, [], {}]) {
      assert.equal(parseSiteAsk(body).ok, false, JSON.stringify(body));
    }
    for (const message of [undefined, null, "", "   ", 5, {}, ["x"]]) {
      assert.equal(parseSiteAsk({ message }).ok, false, JSON.stringify(message));
    }
  });

  it("refuses a message over the cap rather than cutting it", () => {
    assert.equal(parseSiteAsk({ message: "ا".repeat(SITE_ASK_MESSAGE_MAX_CHARS) }).ok, true);
    assert.equal(parseSiteAsk({ message: "ا".repeat(SITE_ASK_MESSAGE_MAX_CHARS + 1) }).ok, false);
  });

  it("refuses more turns than the cap, and a history that is not an array", () => {
    const turn = { role: "user", content: "سؤال" };
    const tooMany = Array.from({ length: SITE_ASK_HISTORY_MAX_TURNS + 1 }, () => turn);
    assert.equal(parseSiteAsk({ message: "x", history: tooMany }).ok, false);
    assert.equal(parseSiteAsk({ message: "x", history: "oops" }).ok, false);
    assert.equal(parseSiteAsk({ message: "x", history: { 0: turn } }).ok, false);
  });

  it("refuses a turn with an unknown role or no content, and never accepts system", () => {
    for (const role of ["system", "developer", "tool", "", undefined, 1]) {
      const parsed = parseSiteAsk({ message: "x", history: [{ role, content: "hi" }] });
      assert.equal(parsed.ok, false, `role ${String(role)}`);
    }
    assert.equal(parseSiteAsk({ message: "x", history: [{ role: "user", content: "   " }] }).ok, false);
    assert.equal(parseSiteAsk({ message: "x", history: [null] }).ok, false);
  });

  it("lets the bot's own earlier reply run longer than a visitor's turn", () => {
    const longReply = "ب".repeat(SITE_ASK_REPLY_MAX_CHARS);
    assert.equal(parseSiteAsk({ message: "x", history: [{ role: "assistant", content: longReply }] }).ok, true);
    assert.equal(
      parseSiteAsk({ message: "x", history: [{ role: "assistant", content: longReply + "ب" }] }).ok,
      false,
    );
    const longQuestion = "ا".repeat(SITE_ASK_MESSAGE_MAX_CHARS + 1);
    assert.equal(parseSiteAsk({ message: "x", history: [{ role: "user", content: longQuestion }] }).ok, false);
  });
});
