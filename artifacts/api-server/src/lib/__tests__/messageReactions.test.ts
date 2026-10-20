/**
 * What this guards: who may react to what, and what a reaction summary shows.
 *
 * The decision under test that is easiest to break later: a student in an
 * announcement-only group (`studentPostingEnabled = false`) MAY react. The send
 * route refuses them with `group_read_only`; a tidy-minded edit that "makes
 * reactions match" would quietly re-close the one channel they have.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  REACTION_EMOJI,
  isAllowedReaction,
  reactionAccess,
  summarizeReactions,
  type ReactionRow,
} from "../messageReactions.ts";

describe("isAllowedReaction", () => {
  it("accepts each of the six emoji", () => {
    for (const e of REACTION_EMOJI) assert.equal(isAllowedReaction(e), true, e);
    assert.equal(REACTION_EMOJI.length, 6);
  });

  it("pins the heart to heart + variation selector", () => {
    assert.equal(REACTION_EMOJI[1], "❤️");
    // A bare U+2764 is a different string: rejected loudly, not normalised.
    assert.equal(isAllowedReaction("❤"), false);
  });

  it("rejects everything else", () => {
    for (const v of ["", "👎", "😀", "👍👍", "👍‍", " 👍", "a".repeat(200), 1, null, undefined, {}, ["👍"]]) {
      assert.equal(isAllowedReaction(v), false, String(v));
    }
  });
});

const row = (messageId: string, userId: string, emoji: string): ReactionRow => ({ messageId, userId, emoji });
const none = new Set<string>();

describe("summarizeReactions", () => {
  const rows = [
    row("m1", "u1", "👍"),
    row("m1", "u2", "👍"),
    row("m1", "u3", "🙏"),
    row("m2", "u1", "😂"),
  ];

  it("counts per emoji and marks the viewer's own", () => {
    const out = summarizeReactions(rows, "u1", { viewerIsTeacher: false, hiddenUserIds: none });
    assert.deepEqual(out.get("m1"), [
      { emoji: "👍", count: 2, mine: true },
      { emoji: "🙏", count: 1, mine: false },
    ]);
    assert.deepEqual(out.get("m2"), [{ emoji: "😂", count: 1, mine: true }]);
  });

  it("has no entry for a message nobody reacted to", () => {
    const out = summarizeReactions(rows, "u1", { viewerIsTeacher: false, hiddenUserIds: none });
    assert.equal(out.has("m3"), false);
  });

  it("orders chips by the fixed emoji order, whatever order the rows came in", () => {
    const shuffled = [row("m", "a", "🙏"), row("m", "b", "👏"), row("m", "c", "👍")];
    const out = summarizeReactions(shuffled, "z", { viewerIsTeacher: false, hiddenUserIds: none });
    assert.deepEqual(out.get("m")!.map(s => s.emoji), ["👍", "👏", "🙏"]);
  });

  it("gives userIds to a teacher only, sorted so a poll never reshuffles them", () => {
    const teacher = summarizeReactions(rows, "t", { viewerIsTeacher: true, hiddenUserIds: none });
    assert.deepEqual(teacher.get("m1")![0]!.userIds, ["u1", "u2"]);
    const student = summarizeReactions(rows, "u1", { viewerIsTeacher: false, hiddenUserIds: none });
    for (const list of student.values()) for (const s of list) assert.equal("userIds" in s, false);
    const unsorted = [row("m", "b", "👍"), row("m", "a", "👍")];
    assert.deepEqual(
      summarizeReactions(unsorted, "t", { viewerIsTeacher: true, hiddenUserIds: none }).get("m")![0]!.userIds,
      ["a", "b"],
    );
  });

  it("drops reactions from hidden (blocked) users from count, mine and userIds", () => {
    const out = summarizeReactions(rows, "t", { viewerIsTeacher: true, hiddenUserIds: new Set(["u2"]) });
    assert.deepEqual(out.get("m1")![0], { emoji: "👍", count: 1, mine: false, userIds: ["u1"] });
    // A hidden viewer id cannot mark `mine`; nobody blocks themselves, but the rule is "hidden rows are gone".
    const self = summarizeReactions(rows, "u1", { viewerIsTeacher: false, hiddenUserIds: new Set(["u1"]) });
    assert.equal(self.get("m1")![0]!.mine, false);
  });

  it("removes a message whose only reactions were hidden", () => {
    const out = summarizeReactions(rows, "t", { viewerIsTeacher: false, hiddenUserIds: new Set(["u1"]) });
    assert.equal(out.has("m2"), false);
  });

  it("ignores a stored emoji outside the current set rather than showing it", () => {
    const out = summarizeReactions([row("m", "a", "🦄")], "z", { viewerIsTeacher: false, hiddenUserIds: none });
    assert.equal(out.size, 0);
  });
});

describe("reactionAccess", () => {
  const base = {
    isParticipant: true,
    messageInThread: true,
    messageArchived: false,
    viewerIsTeacher: false,
    viewerBlocksSender: false,
    threadType: "class_group" as const,
    studentPostingEnabled: true,
  };

  it("lets a participant react to a live message", () => {
    assert.equal(reactionAccess(base), "ok");
  });

  it("lets a student react in an announcement-only group — the decision this feature exists for", () => {
    assert.equal(reactionAccess({ ...base, studentPostingEnabled: false }), "ok");
    assert.equal(reactionAccess({ ...base, threadType: "custom_group", studentPostingEnabled: false }), "ok");
  });

  it("hides the thread from a non-participant", () => {
    assert.equal(reactionAccess({ ...base, isParticipant: false }), "not_found");
  });

  it("does not find a message in another thread, or an archived one", () => {
    assert.equal(reactionAccess({ ...base, messageInThread: false }), "not_found");
    assert.equal(reactionAccess({ ...base, messageArchived: true }), "not_found");
  });

  it("hides a blocked sender's message from a non-teacher, never from a teacher", () => {
    assert.equal(reactionAccess({ ...base, viewerBlocksSender: true }), "not_found");
    assert.equal(reactionAccess({ ...base, viewerBlocksSender: true, viewerIsTeacher: true }), "ok");
  });
});
