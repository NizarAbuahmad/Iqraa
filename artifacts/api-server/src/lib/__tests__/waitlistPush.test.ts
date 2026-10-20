/**
 * The push an admin gets when someone joins iqrra.com's waitlist. Pure on
 * purpose: adminNotify.ts imports the database at module scope, so the wording
 * and the routing fields are pinned here and the DB/Expo plumbing is not.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { waitlistPush } from "../waitlistPush.ts";
import { PUSH_CHANNEL } from "../pushNotifications.ts";

test("names the email and opens the collected-emails screen on the admin channel", () => {
  const push = waitlistPush({ email: "a@b.com", context: "" });
  assert.equal(push.title, "تسجيل جديد في قائمة الانتظار");
  assert.equal(push.body, "a@b.com");
  assert.deepEqual(push.data, { screen: "admin-signups" });
  assert.equal(push.channelId, PUSH_CHANNEL.admin);
});

test("adds the page the signup came from when the site sent one", () => {
  assert.equal(waitlistPush({ email: "a@b.com", context: "android" }).body, "a@b.com · android");
});

test("keeps a hostile or oversized context from bloating the push body", () => {
  const body = waitlistPush({ email: "a@b.com", context: "x".repeat(500) }).body;
  assert.ok(body.length <= 120, `body was ${body.length} chars`);
  assert.ok(body.startsWith("a@b.com"));
});
