/**
 * The family's per-objective summary (`topicSummary`). What it must never do: name a topic
 * off one question, show a number, list more than three either way, or show an id the
 * curriculum does not know.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { TOPIC_LIMIT, topicSummary } from "../topicSummary.ts";

const CATALOG: Record<string, { description: string; descriptionAr: string }> = {
  oA: { description: "Solve linear systems", descriptionAr: "يحل نظامًا من معادلتين خطيتين" },
  oB: { description: "Find a slope", descriptionAr: "يجد ميل مستقيم" },
  oC: { description: "Factor a quadratic", descriptionAr: "يحلل عبارة تربيعية" },
  oD: { description: "Graph a line", descriptionAr: "يمثل مستقيمًا بيانيًا" },
  oE: { description: "Read a table", descriptionAr: "يقرأ جدولًا" },
  oF: { description: "Only English", descriptionAr: "" },
};
const resolve = (ids: readonly string[]) => ({
  found: ids.filter(id => CATALOG[id]).map(id => ({ id, ...CATALOG[id]! })),
});
const score = (objectiveId: string, percent: number, questionCount: number, marksLost = 0) => ({
  objectiveId, earned: 0, total: 0, percent, questionCount, marksLost, bloomsRank: 0,
});

describe("topicSummary", () => {
  it("names what went well and what needs work, from two questions or more", () => {
    const t = topicSummary([score("oA", 90, 2), score("oB", 40, 3, 6), score("oC", 70, 4)], resolve);
    assert.deepEqual(t.strong, [{ objectiveId: "oA", title: "Solve linear systems", titleAr: "يحل نظامًا من معادلتين خطيتين" }]);
    assert.deepEqual(t.weak, [{ objectiveId: "oB", title: "Find a slope", titleAr: "يجد ميل مستقيم" }]);
  });

  it("never names a topic off one question, either way", () => {
    assert.deepEqual(topicSummary([score("oA", 100, 1), score("oB", 0, 1, 2)], resolve), { strong: [], weak: [] });
  });

  it("puts the topics that cost the most marks first, and stops at three", () => {
    const t = topicSummary(
      [score("oA", 10, 2, 2), score("oB", 20, 2, 8), score("oC", 30, 2, 5), score("oD", 40, 2, 1), score("oE", 50, 2, 9)],
      resolve,
    );
    assert.equal(t.weak.length, TOPIC_LIMIT);
    assert.deepEqual(t.weak.map(x => x.objectiveId), ["oE", "oB", "oC"]);
  });

  it("drops an objective the curriculum no longer knows, and falls back to the English title", () => {
    const t = topicSummary([score("gone", 95, 3), score("oF", 95, 3)], resolve);
    assert.deepEqual(t.strong, [{ objectiveId: "oF", title: "Only English", titleAr: "Only English" }]);
  });

  it("carries no numbers", () => {
    const t = topicSummary([score("oA", 90, 2), score("oB", 40, 3, 6)], resolve);
    for (const item of [...t.strong, ...t.weak]) assert.deepEqual(Object.keys(item).sort(), ["objectiveId", "title", "titleAr"]);
  });

  it("reads a missing or malformed column as nothing, never throws", () => {
    for (const raw of [undefined, null, {}, "x", [null, 1, { objectiveId: 3 }, { objectiveId: "oA" }]]) {
      assert.deepEqual(topicSummary(raw, resolve), { strong: [], weak: [] });
    }
  });

  it("resolves real ids through the curriculum by default", () => {
    // An id the catalog cannot have: the default resolver is wired, and drops it.
    assert.deepEqual(topicSummary([score("no-such-objective", 95, 3)]), { strong: [], weak: [] });
  });
});
