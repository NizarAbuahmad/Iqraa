/**
 * PATCH's partial-update rule.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/pickDefined.test.ts
 *
 * The case that matters is `null`. `saved_materials.class_group_id` is
 * nullable, so detaching a material from a class is a PATCH carrying
 * `classGroupId: null` — and every falsy-instead-of-undefined check drops it,
 * which makes attach work, detach quietly do nothing, and no error appear
 * anywhere. Same for clearing a topic, or setting isFavorite back to false.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { pickDefined } from "../pickDefined.ts";

describe("pickDefined", () => {
  it("keeps null — that is a clear, not an omission", () => {
    assert.deepEqual(
      pickDefined({ classGroupId: null }, ["classGroupId"]),
      { classGroupId: null },
    );
  });

  it("keeps the other falsy values a teacher can actually send", () => {
    assert.deepEqual(
      pickDefined({ isFavorite: false, topic: "", grade: 0 }, [
        "isFavorite",
        "topic",
        "grade",
      ]),
      { isFavorite: false, topic: "", grade: 0 },
    );
  });

  it("drops keys the body did not carry", () => {
    assert.deepEqual(
      pickDefined({ title: "درس", topic: undefined }, ["title", "topic"]),
      { title: "درس" },
    );
  });

  it("ignores keys outside the allowlist", () => {
    // The reason this is an allowlist: a client sending userId must not be
    // able to hand its materials to another teacher.
    const body = { title: "درس", userId: "someone-else" } as Record<string, unknown>;
    assert.deepEqual(pickDefined(body, ["title"]), { title: "درس" });
  });

  it("returns an empty object for an empty body", () => {
    assert.deepEqual(pickDefined({} as Record<string, unknown>, ["title"]), {});
  });
});
