import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { familyMessages, selectRecipients, type LinkedAccount } from "../familyPush.ts";
import { clip } from "../familyPushText.ts";

const acct = (over: Partial<LinkedAccount>): LinkedAccount => ({
  userId: "u-parent",
  relation: "guardian",
  studentId: "s-sara",
  childName: "سارة",
  pushPrefs: {},
  suspended: false,
  ...over,
});

describe("selectRecipients", () => {
  it("keeps every linked account that wants this category", () => {
    const r = selectRecipients([acct({}), acct({ userId: "u-student", relation: "self" })], "homework");
    assert.deepEqual(r.map(x => x.userId), ["u-parent", "u-student"]);
  });
  it("drops a suspended account", () => {
    assert.deepEqual(selectRecipients([acct({ suspended: true })], "homework"), []);
  });
  it("drops an account that switched THIS category off, and only this one", () => {
    assert.deepEqual(selectRecipients([acct({ pushPrefs: { homework: false } })], "homework"), []);
    assert.equal(selectRecipients([acct({ pushPrefs: { homework: false } })], "exams").length, 1);
  });
  it("keeps one entry per account, relation and child", () => {
    assert.equal(selectRecipients([acct({}), acct({})], "results").length, 1);
    assert.equal(selectRecipients([acct({}), acct({ studentId: "s-adam", childName: "آدم" })], "results").length, 2);
  });
  it("hands on no switches or suspension, only who and which child", () => {
    assert.deepEqual(selectRecipients([acct({})], "results"), [
      { userId: "u-parent", relation: "guardian", studentId: "s-sara", childName: "سارة" },
    ]);
  });
});

describe("familyMessages", () => {
  const delivery = { channelId: "homework" as const, sound: "default" as const };
  const tokens = [
    { userId: "u-parent", expoPushToken: "ExponentPushToken[p1]" },
    { userId: "u-parent", expoPushToken: "ExponentPushToken[p2]" },
    { userId: "u-student", expoPushToken: "ExponentPushToken[s1]" },
  ];
  const recipients = [
    { userId: "u-parent", relation: "guardian" as const, studentId: "s-sara", childName: "سارة" },
    { userId: "u-parent", relation: "guardian" as const, studentId: "s-adam", childName: "آدم" },
    { userId: "u-student", relation: "self" as const, studentId: "s-sara", childName: "سارة" },
  ];
  const text = (r: { relation: string; childName: string }) =>
    r.relation === "guardian" ? { title: `${r.childName}: واجب جديد`, body: "b" } : { title: "واجب جديد", body: "b" };

  it("builds one message per recipient per device, naming each child for a guardian", () => {
    const out = familyMessages({ recipients, tokens, text, data: { screen: "school" }, delivery });
    assert.equal(out.length, 5);
    assert.deepEqual(out.filter(m => m.to === "ExponentPushToken[p1]").map(m => m.title).sort(), ["آدم: واجب جديد", "سارة: واجب جديد"]);
    assert.deepEqual(out.find(m => m.to === "ExponentPushToken[s1]"), {
      to: "ExponentPushToken[s1]",
      title: "واجب جديد",
      body: "b",
      data: { screen: "school" },
      channelId: "homework",
      sound: "default",
    });
  });
  it("skips a recipient whose text is null, and one with no device", () => {
    const out = familyMessages({ recipients, tokens: tokens.slice(2), text: r => (r.relation === "self" ? null : text(r)), data: {}, delivery });
    assert.deepEqual(out, []);
  });
  it("never sends the same words to the same device twice", () => {
    const twice = [recipients[0]!, { ...recipients[0]!, studentId: "s-sara-row-2" }];
    assert.equal(familyMessages({ recipients: twice, tokens: tokens.slice(0, 1), text, data: {}, delivery }).length, 1);
  });
});

describe("clip", () => {
  it("leaves a short text alone and folds whitespace", () => {
    assert.equal(clip("  واجب   الرياضيات ", 40), "واجب الرياضيات");
  });
  it("cuts a long text to max code points with «…»", () => {
    const cut = clip("أ".repeat(60), 10);
    assert.equal([...cut].length, 10);
    assert.ok(cut.endsWith("…"));
  });
  it("never splits a character made of two code units", () => {
    assert.equal(clip("😀".repeat(5), 3), "😀😀…");
  });
});
